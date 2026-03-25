#!/usr/bin/env python3
"""
One-off backfill: normalize each active member's current TeamBuildr data
into a programming_generated row.

This captures what is *actually happening* in TeamBuildr right now (no phase
progression) so admins can review, tweak, finalize, and mark uploaded.

Usage:
  python tools/backfill_current_programs.py                     # all active members
  python tools/backfill_current_programs.py --dry-run            # preview without writing
  python tools/backfill_current_programs.py --member-id <uuid>   # single member
  python tools/backfill_current_programs.py --skip-existing       # skip members who already have rows

Requires: pip install supabase python-dotenv
"""

import json
import os
import sys
import uuid
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
from generate_program import (
    detect_sessions_per_week,
    extract_current_program,
)
from detect_phase import detect_phase_for_member


MIN_SESSIONS = 3


def fetch_active_member_ids(supabase):
    """Return deduplicated list of active member UUIDs.

    Uses member_memberships (accessible with anon key) rather than
    member_database (RLS-protected) to avoid needing the service role key.
    """
    r = (
        supabase.table("member_memberships")
        .select("member_id")
        .eq("status", "active")
        .execute()
    )
    seen = set()
    ids = []
    for row in (r.data or []):
        mid = row["member_id"]
        if mid not in seen:
            seen.add(mid)
            ids.append(mid)
    return ids


def fetch_members_with_generated(supabase):
    """Return set of member_ids that already have programming_generated rows."""
    r = (
        supabase.table("programming_generated")
        .select("member_id")
        .execute()
    )
    return {row["member_id"] for row in (r.data or [])}


def convert_actual_reps_to_prescription(sets_list):
    """Convert actual logged reps (numbers) into a prescription string.

    Looks at the actual reps performed across all sets and produces a range
    like '8-10'. Falls back to the raw values if they're already strings.
    """
    nums = []
    for s in sets_list:
        r = s.get("reps")
        if r is None:
            continue
        try:
            nums.append(int(float(r)))
        except (ValueError, TypeError):
            if isinstance(r, str) and r.strip():
                return r.strip()
    if not nums:
        return "8-10"
    lo, hi = min(nums), max(nums)
    if lo == hi:
        return str(lo)
    return f"{lo}-{hi}"


def build_canonical_payload(extracted_sessions, phase_result, spw):
    """Convert extracted TB sessions into the canonical programming_generated
    payload shape (same as generate_next_program output)."""
    new_sessions = []
    for day_idx, old_session in enumerate(extracted_sessions, start=1):
        new_exercises = []
        for ex in old_session.get("exercises", []):
            label = ex.get("series_label") or ""
            if not label or label.lower() in ("warm up", "extra"):
                continue
            if label is None:
                continue

            old_sets = ex.get("sets", [])
            reps_str = convert_actual_reps_to_prescription(old_sets)

            new_sets = []
            for i, s in enumerate(old_sets, start=1):
                new_sets.append({
                    "set_number": i,
                    "reps": reps_str,
                })

            if not new_sets:
                new_sets = [{"set_number": 1, "reps": reps_str}]

            new_exercises.append({
                "exercise_name": ex.get("exercise_name", ""),
                "exercise_id": ex.get("exercise_id"),
                "series_label": label,
                "tags": ex.get("tags"),
                "sets": new_sets,
                "row_id": str(uuid.uuid4()),
            })

        new_sessions.append({
            "day": day_idx,
            "exercises": new_exercises,
        })

    current_rep_range = (phase_result or {}).get("current_rep_range")
    confidence = (phase_result or {}).get("confidence")

    return {
        "sessions": new_sessions,
        "metadata": {
            "scheme": "GPP",
            "current_rep_range": current_rep_range,
            "confidence": confidence,
            "sessions_per_week": spw,
            "backfill": True,
        },
    }


def process_one_member(supabase, member_id, exercise_lib, run_id, dry_run=False):
    """Process a single member: normalize, extract, build payload, insert.

    Returns (success: bool, message: str).
    """
    rows = fetch_results_for_member(supabase, member_id)
    if not rows:
        return False, "no member_tbresults rows"

    payload = normalize(rows, exercise_lib)
    sessions = payload.get("sessions", [])

    full_sessions = [s for s in sessions if len(s.get("exercises", [])) >= 3]
    if len(full_sessions) < MIN_SESSIONS:
        return False, f"only {len(full_sessions)} full sessions (need {MIN_SESSIONS})"

    spw = detect_sessions_per_week(sessions)
    extracted = extract_current_program(sessions, sessions_per_week=spw)

    if not extracted:
        return False, "extract_current_program returned empty"

    phase_result = None
    try:
        phase_result = detect_phase_for_member(supabase, member_id, "GPP", sessions)
    except Exception as exc:
        phase_result = {"current_rep_range": None, "confidence": None, "error": str(exc)}

    canonical = build_canonical_payload(extracted, phase_result, spw)

    total_exercises = sum(len(s.get("exercises", [])) for s in canonical["sessions"])

    gen_row = {
        "run_id": run_id,
        "member_id": member_id,
        "assigned_to": None,
        "sessions_per_week": spw,
        "duration_weeks": 6,
        "phase_number": (phase_result or {}).get("current_order"),
        "scheme_name": "GPP",
        "rep_range": (phase_result or {}).get("current_rep_range"),
        "changes_summary": "Backfill from TeamBuildr data",
        "rules_applied": None,
        "payload": canonical,
        "coach_edited": False,
        "coach_approved": False,
        "uploaded_to_teambuildr": False,
        "next_due_date": None,
    }

    if dry_run:
        return True, f"{spw}x/wk, {len(canonical['sessions'])} days, {total_exercises} exercises, rep_range={gen_row['rep_range']}"

    try:
        supabase.table("programming_generated").insert(gen_row).execute()
    except Exception as exc:
        return False, f"insert failed: {exc}"

    return True, f"{spw}x/wk, {len(canonical['sessions'])} days, {total_exercises} exercises, rep_range={gen_row['rep_range']}"


def main():
    import argparse
    import time

    ap = argparse.ArgumentParser(description="Backfill programming_generated from TB data")
    ap.add_argument("--member-id", default=None, help="Run for a single member UUID")
    ap.add_argument("--dry-run", action="store_true", help="Preview without writing to DB")
    ap.add_argument("--skip-existing", action="store_true", help="Skip members who already have programming_generated rows")
    args = ap.parse_args()

    supabase = get_supabase()
    exercise_lib = fetch_exercise_library(supabase)
    run_id = str(uuid.uuid4())

    print(f"Backfill run_id: {run_id}")
    if args.dry_run:
        print("DRY RUN — no rows will be written\n")

    if args.member_id:
        member_ids = [args.member_id]
    else:
        member_ids = fetch_active_member_ids(supabase)
        print(f"Found {len(member_ids)} active members")

    if args.skip_existing:
        existing = fetch_members_with_generated(supabase)
        before = len(member_ids)
        member_ids = [m for m in member_ids if m not in existing]
        print(f"Skipping {before - len(member_ids)} members with existing rows → {len(member_ids)} to process")

    success_count = 0
    skip_count = 0
    fail_count = 0
    start = time.time()

    for i, mid in enumerate(member_ids, 1):
        try:
            ok, msg = process_one_member(supabase, mid, exercise_lib, run_id, dry_run=args.dry_run)
        except Exception as exc:
            ok = False
            msg = f"unexpected error: {exc}"

        prefix = "OK" if ok else "SKIP"
        if not ok:
            skip_count += 1
        else:
            success_count += 1

        if i <= 10 or i % 50 == 0 or not ok:
            print(f"  [{i}/{len(member_ids)}] {prefix}: {mid[:8]}… — {msg}")

    elapsed = time.time() - start
    print(f"\nDone in {elapsed:.1f}s")
    print(f"  Success: {success_count}")
    print(f"  Skipped: {skip_count}")
    print(f"  Total:   {len(member_ids)}")

    if args.dry_run:
        print("\nThis was a dry run. Re-run without --dry-run to write rows.")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        if "getaddrinfo" in str(e).lower() or "ConnectError" in type(e).__name__:
            print("Could not reach Supabase. Check SUPABASE_URL in .env.", file=sys.stderr)
            sys.exit(1)
        raise
