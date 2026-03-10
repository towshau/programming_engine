#!/usr/bin/env python3
"""
End-to-end pipeline: Ingest -> Load config -> Generate -> Write.

Runs all four steps for one member and persists the generated program to
programming_generated (and optionally to programming_normalized_programs).

Usage:
  python tools/run_pipeline.py <member_id> --scheme Strength --sessions-per-week 3
  python tools/run_pipeline.py <member_id>                    # defaults: GPP, 3 days, 6 weeks

Options:
  --scheme           GPP | Strength | Hypertrophy (default GPP)
  --sessions-per-week  2, 3, or 4 (default 3)
  --duration-weeks   4 or 6 (default 6)
  --skip-staging     Don't write to programming_normalized_programs
  --dry-run          Print program JSON but don't write to Supabase
  --output FILE      Also save program JSON to a local file

Requires: pip install supabase python-dotenv
"""

import argparse
import json
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
from detect_phase import detect_phase_for_member
from load_rules import load_config
from generate_program import generate_next_program, detect_sessions_per_week


def main():
    ap = argparse.ArgumentParser(description="Run full programming pipeline for one member")
    ap.add_argument("member_id", help="Member UUID")
    ap.add_argument("--scheme", default="GPP", help="GPP | Strength | Hypertrophy")
    ap.add_argument("--sessions-per-week", type=int, default=None, choices=[2, 3, 4],
                    help="Override; auto-detected from history if omitted")
    ap.add_argument("--duration-weeks", type=int, default=6)
    ap.add_argument("--skip-staging", action="store_true", help="Skip writing to staging")
    ap.add_argument("--dry-run", action="store_true", help="Print JSON, don't write to DB")
    ap.add_argument("--output", default=None, help="Save program JSON to file")
    args = ap.parse_args()

    sb = get_supabase()
    run_id = str(uuid.uuid4())
    member_id = args.member_id

    print(f"=== Pipeline run {run_id[:8]}... for member {member_id} ===\n")

    # ── Step 1: Ingest / Normalize ──
    print("[1/4] Ingest: fetching member data...")
    rows = fetch_results_for_member(sb, member_id)
    if not rows:
        print(f"  No rows in member_tbresults for {member_id}. Aborting.", file=sys.stderr)
        sys.exit(1)

    exercise_lib = fetch_exercise_library(sb)
    past = normalize(rows, exercise_lib)
    sessions = past["sessions"]
    print(f"  Normalised {len(sessions)} sessions.")

    # Auto-detect sessions per week if not overridden
    spw = args.sessions_per_week or detect_sessions_per_week(sessions)
    print(f"  Sessions per week: {spw}" + (" (auto-detected)" if not args.sessions_per_week else " (override)"))

    if not args.skip_staging and not args.dry_run:
        staging_row = {
            "run_id": run_id,
            "member_id": member_id,
            "assigned_to": None,
            "payload": past,
        }
        sb.table("programming_normalized_programs").insert(staging_row).execute()
        print(f"  Written to programming_normalized_programs.")

    # ── Step 2: Phase Detection ──
    print(f"\n[2/4] Phase detection (scheme={args.scheme})...")
    phase = detect_phase_for_member(sb, member_id, args.scheme, sessions)
    print(f"  Current: {phase.get('current_rep_range')}  Next: {phase.get('next_rep_range')}  Confidence: {phase.get('confidence')}")
    if phase.get("confidence") == "low":
        print("  WARNING: Low confidence -- consider coach review before using this program.", file=sys.stderr)

    # ── Step 3: Load Config ──
    print(f"\n[3/4] Loading rules + config...")
    config = load_config(sb, member_id=member_id, scheme_name=args.scheme)
    print(f"  {len(config['rules'])} rules, {len(config['scheme'])} scheme steps, {len(config['exclusions'])} exclusions.")

    # ── Step 4: Generate ──
    print(f"\n[4/4] Generating next program...")
    program = generate_next_program(
        sessions,
        exercise_lib,
        phase,
        config,
        sessions_per_week=spw,
    )

    program["metadata"] = {
        "run_id": run_id,
        "member_id": member_id,
        "scheme": args.scheme,
        "current_rep_range": phase.get("current_rep_range"),
        "next_rep_range": phase.get("next_rep_range"),
        "phase_order": phase.get("next_order"),
        "confidence": phase.get("confidence"),
        "exercise_behavior": phase.get("exercise_behavior"),
        "sessions_per_week": spw,
        "duration_weeks": args.duration_weeks,
    }

    # Print summary
    print(f"\n  Generated {len(program.get('sessions', []))} day(s):")
    rules_applied = list(config["rules"].keys())
    for i, sess in enumerate(program.get("sessions", []), 1):
        exs = sess.get("exercises", [])
        print(f"    Day {i}: {len(exs)} exercises")
        for ex in exs:
            n_sets = len(ex.get("sets", []))
            reps = ex["sets"][0]["reps"] if ex.get("sets") else "?"
            print(f"      {ex.get('series_label',''):4s} {ex['exercise_name']:<50s} {n_sets}x{reps}")

    # Save to file
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(program, f, indent=2, default=str)
        print(f"\n  Saved to {args.output}")

    # Write to programming_generated
    if not args.dry_run:
        gen_row = {
            "run_id": run_id,
            "member_id": member_id,
            "assigned_to": None,
            "sessions_per_week": spw,
            "duration_weeks": args.duration_weeks,
            "phase_number": phase.get("next_order"),
            "scheme_name": args.scheme,
            "rep_range": phase.get("next_rep_range"),
            "changes_summary": f"Phase detection: {phase.get('current_rep_range')} -> {phase.get('next_rep_range')} (confidence: {phase.get('confidence')})",
            "rules_applied": rules_applied,
            "payload": program,
        }
        sb.table("programming_generated").insert(gen_row).execute()
        print(f"\n  Written to programming_generated (run_id={run_id})")
    else:
        print(f"\n  DRY RUN -- not written to database.")
        print(json.dumps(program, indent=2, default=str))

    print(f"\n=== Pipeline complete ===")


if __name__ == "__main__":
    main()
