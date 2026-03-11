#!/usr/bin/env python3
"""
Weekly batch generator: find members whose programs are due within 8 days
and generate their next program.

Cohort: active, non-test members where:
  - (due_date <= today + 8 days AND programming_stage IN (update_stage, complete))
  - OR programming_stage = 'awaiting_program'
  - AND no programming_generated row for this member in the last 7 days

Writes to programming_generated only. Does NOT update member_programs
(stage, due_date) -- coaches handle that manually for now.

Usage:
  python tools/run_weekly_batch.py                        # full batch
  python tools/run_weekly_batch.py --dry-run              # generate but don't write
  python tools/run_weekly_batch.py --limit 5              # cap at 5 members
  python tools/run_weekly_batch.py --member-id <uuid>     # override cohort, one member
  python tools/run_weekly_batch.py --duration-weeks 4     # non-default duration

Requires: pip install supabase python-dotenv
"""

import argparse
import json
import sys
import uuid
from datetime import datetime, timedelta
from pathlib import Path

_tools_dir = str(Path(__file__).resolve().parent)
if _tools_dir not in sys.path:
    sys.path.insert(0, _tools_dir)

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:
    pass

from normalize_one_member import (
    get_supabase,
    fetch_exercise_library,
    fetch_results_for_member,
    normalize,
)
from detect_phase import detect_phase_for_member
from load_rules import load_config
from generate_program import generate_next_program, detect_sessions_per_week


LOOKAHEAD_DAYS = 8
RECENT_WINDOW_DAYS = 7


def fetch_eligible_members(sb):
    """Query members whose programs are due within LOOKAHEAD_DAYS or awaiting."""
    cutoff = (datetime.now() + timedelta(days=LOOKAHEAD_DAYS)).strftime("%Y-%m-%d")

    due_soon = (
        sb.table("member_programs")
        .select("member_id, due_date, programming_stage, programming_coach_id, scheme_name, member_name")
        .in_("programming_stage", ["update_stage", "complete"])
        .lte("due_date", cutoff)
        .execute()
    )

    awaiting = (
        sb.table("member_programs")
        .select("member_id, due_date, programming_stage, programming_coach_id, scheme_name, member_name")
        .eq("programming_stage", "awaiting_program")
        .execute()
    )

    seen = set()
    members = []
    for row in (due_soon.data or []) + (awaiting.data or []):
        mid = row["member_id"]
        if mid in seen:
            continue
        seen.add(mid)
        members.append(row)

    return members


def fetch_active_member_ids(sb):
    """Get set of active, non-test member IDs for filtering.

    Requires service role key for member_database access (RLS).
    Returns None if the table is inaccessible, so callers can skip the filter.
    """
    r = (
        sb.table("member_database")
        .select("id")
        .eq("current_status", "active")
        .eq("test_account", False)
        .execute()
    )
    ids = {row["id"] for row in (r.data or [])}
    if not ids:
        print("  WARNING: member_database returned 0 rows (likely RLS — add SUPABASE_SERVICE_ROLE_KEY to .env).", file=sys.stderr)
        return None
    return ids


def fetch_recently_generated(sb):
    """Get member_ids that already have a programming_generated row in the last N days."""
    cutoff = (datetime.now() - timedelta(days=RECENT_WINDOW_DAYS)).isoformat()
    r = (
        sb.table("programming_generated")
        .select("member_id")
        .gte("created_at", cutoff)
        .execute()
    )
    return {row["member_id"] for row in (r.data or [])}


def run_pipeline_for_member(sb, member_id, scheme_name, exercise_lib, duration_weeks):
    """Run the full pipeline for one member. Returns (program_dict, phase_dict, config) or raises."""
    rows = fetch_results_for_member(sb, member_id)
    if not rows:
        raise ValueError(f"No rows in member_tbresults")

    past = normalize(rows, exercise_lib)
    sessions = past["sessions"]
    if not sessions:
        raise ValueError("Normalization produced 0 sessions")

    spw = detect_sessions_per_week(sessions)
    phase = detect_phase_for_member(sb, member_id, scheme_name, sessions)
    config = load_config(sb, member_id=member_id, scheme_name=scheme_name)

    program = generate_next_program(
        sessions, exercise_lib, phase, config, sessions_per_week=spw,
    )

    run_id = str(uuid.uuid4())
    program["metadata"] = {
        "run_id": run_id,
        "member_id": member_id,
        "scheme": scheme_name,
        "current_rep_range": phase.get("current_rep_range"),
        "next_rep_range": phase.get("next_rep_range"),
        "phase_order": phase.get("next_order"),
        "confidence": phase.get("confidence"),
        "exercise_behavior": phase.get("exercise_behavior"),
        "sessions_per_week": spw,
        "duration_weeks": duration_weeks,
    }

    return program, phase, config, run_id, spw


def write_generated(sb, run_id, member_id, program, phase, config, scheme_name, spw, duration_weeks, coach_id):
    """Write one row to programming_generated."""
    rules_applied = list(config["rules"].keys())
    row = {
        "run_id": run_id,
        "member_id": member_id,
        "assigned_to": coach_id,
        "sessions_per_week": spw,
        "duration_weeks": duration_weeks,
        "phase_number": phase.get("next_order"),
        "scheme_name": scheme_name,
        "rep_range": phase.get("next_rep_range"),
        "changes_summary": (
            f"Phase detection: {phase.get('current_rep_range')} -> "
            f"{phase.get('next_rep_range')} (confidence: {phase.get('confidence')})"
        ),
        "rules_applied": rules_applied,
        "payload": program,
    }
    sb.table("programming_generated").insert(row).execute()


def main():
    ap = argparse.ArgumentParser(description="Weekly batch program generation")
    ap.add_argument("--dry-run", action="store_true", help="Generate but don't write to DB")
    ap.add_argument("--limit", type=int, default=None, help="Max members to process")
    ap.add_argument("--member-id", default=None, help="Override cohort: run for one member")
    ap.add_argument("--duration-weeks", type=int, default=6, help="Program duration (default 6)")
    args = ap.parse_args()

    sb = get_supabase()

    print("=" * 60)
    print(f"WEEKLY BATCH GENERATION — {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("=" * 60)

    # Build cohort
    if args.member_id:
        mp_row = (
            sb.table("member_programs")
            .select("member_id, due_date, programming_stage, programming_coach_id, scheme_name, member_name")
            .eq("member_id", args.member_id)
            .limit(1)
            .execute()
        )
        cohort = mp_row.data or [{"member_id": args.member_id, "scheme_name": "GPP", "member_name": args.member_id}]
    else:
        cohort = fetch_eligible_members(sb)

    active_ids = fetch_active_member_ids(sb)
    recently_generated = fetch_recently_generated(sb)

    # Filter
    eligible = []
    skipped_inactive = 0
    skipped_recent = 0
    for m in cohort:
        mid = m["member_id"]
        if active_ids is not None and mid not in active_ids:
            skipped_inactive += 1
            continue
        if mid in recently_generated and not args.member_id:
            skipped_recent += 1
            continue
        eligible.append(m)

    if args.limit:
        eligible = eligible[: args.limit]

    print(f"\nCohort: {len(cohort)} candidates")
    print(f"  Skipped (not active): {skipped_inactive}")
    print(f"  Skipped (generated <{RECENT_WINDOW_DAYS}d ago): {skipped_recent}")
    print(f"  Eligible: {len(eligible)}")
    if args.dry_run:
        print("  MODE: DRY RUN (no writes)")
    print()

    # Pre-load exercise library once
    exercise_lib = fetch_exercise_library(sb)

    generated = 0
    failed = 0
    results = []

    for i, m in enumerate(eligible, 1):
        mid = m["member_id"]
        name = m.get("member_name") or mid[:8]
        scheme = m.get("scheme_name") or "GPP"
        coach_id = m.get("programming_coach_id")
        stage = m.get("programming_stage", "?")
        due = m.get("due_date", "?")

        print(f"[{i}/{len(eligible)}] {name} ({stage}, due {due}, scheme {scheme})")

        try:
            program, phase, config, run_id, spw = run_pipeline_for_member(
                sb, mid, scheme, exercise_lib, args.duration_weeks,
            )

            n_days = len(program.get("sessions", []))
            confidence = phase.get("confidence", "?")
            rep_range = f"{phase.get('current_rep_range')} -> {phase.get('next_rep_range')}"

            if not args.dry_run:
                write_generated(sb, run_id, mid, program, phase, config, scheme, spw, args.duration_weeks, coach_id)

            print(f"  OK: {n_days} days, {spw}D/wk, {rep_range}, confidence={confidence}")
            generated += 1
            results.append({"member": name, "status": "ok", "days": n_days, "confidence": confidence})

        except Exception as exc:
            print(f"  FAIL: {exc}", file=sys.stderr)
            failed += 1
            results.append({"member": name, "status": "fail", "error": str(exc)})

    # Summary
    print()
    print("=" * 60)
    print(f"SUMMARY: {generated} generated, {failed} failed, {skipped_recent} skipped (recent)")
    if args.dry_run:
        print("DRY RUN — nothing written to database.")
    print("=" * 60)

    if failed > 0:
        print("\nFailures:")
        for r in results:
            if r["status"] == "fail":
                print(f"  {r['member']}: {r['error']}")

    sys.exit(1 if failed > 0 and generated == 0 else 0)


if __name__ == "__main__":
    main()
