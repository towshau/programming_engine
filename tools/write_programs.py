#!/usr/bin/env python3
"""
Persist a generated program to programming_generated.

Reads the program payload from a JSON file or stdin. Inserts one row per
(run_id, member_id). Used after a generator (or manual build) produces
the program JSON.

Canonical payload shape: same as staging — { "sessions": [ { "day", "exercises": [ { "exercise_name", "exercise_id", "series_label", "sets": [...] } ] } ] }. See docs/data-model.md.

Usage:
  Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.

  # From file
  python tools/write_programs.py --run-id <uuid> --member-id <uuid> --sessions-per-week 3 program.json

  # From stdin (e.g. pipe from generator)
  python tools/write_programs.py --run-id <uuid> --member-id <uuid> --sessions-per-week 3 < program.json

  Optional: --assigned-to, --duration-weeks, --phase-number, --scheme-name, --rep-range, --changes-summary, --rules-applied (JSON array string).

Requires: pip install supabase python-dotenv
"""

import argparse
import json
import os
import sys
import uuid
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:
    pass


def get_supabase():
    url = (os.environ.get("SUPABASE_URL") or "").strip().strip('"\'')
    key = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_ANON_KEY") or "").strip().strip('"\'')
    if not url or not key:
        print("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) in .env", file=sys.stderr)
        sys.exit(1)
    if "your-project" in url or not url.startswith("https://"):
        print("SUPABASE_URL in .env looks wrong.", file=sys.stderr)
        sys.exit(1)
    try:
        from supabase import create_client
        return create_client(url, key)
    except ImportError:
        print("Install: pip install supabase python-dotenv", file=sys.stderr)
        sys.exit(1)


def main():
    ap = argparse.ArgumentParser(description="Write generated program to programming_generated")
    ap.add_argument("payload_file", nargs="?", help="JSON file with payload; if omitted, read from stdin")
    ap.add_argument("--run-id", required=True, help="Generation run UUID (e.g. from uuidgen)")
    ap.add_argument("--member-id", required=True, help="Member UUID")
    ap.add_argument("--sessions-per-week", type=int, required=True, choices=[1, 2, 3, 4, 5, 6], help="1 through 6")
    ap.add_argument("--assigned-to", default=None, help="Optional coach UUID")
    ap.add_argument("--duration-weeks", type=int, default=6, help="Program duration (default 6)")
    ap.add_argument("--phase-number", type=int, default=None, help="Scheme phase (e.g. 1-4)")
    ap.add_argument("--scheme-name", default=None, help="e.g. GPP, Strength, Hypertrophy")
    ap.add_argument("--rep-range", default=None, help="e.g. 8-10")
    ap.add_argument("--changes-summary", default=None, help="Human-readable what changed")
    ap.add_argument("--rules-applied", default=None, help="JSON array of rule_keys, e.g. '[\"max_exercises_per_series\"]'")
    args = ap.parse_args()

    # Payload: file or stdin
    if args.payload_file:
        with open(args.payload_file, "r", encoding="utf-8") as f:
            payload = json.load(f)
    else:
        payload = json.load(sys.stdin)

    if "sessions" not in payload:
        print("Payload must contain 'sessions' key.", file=sys.stderr)
        sys.exit(1)

    run_id = args.run_id
    try:
        uuid.UUID(run_id)
    except ValueError:
        print("--run-id must be a valid UUID", file=sys.stderr)
        sys.exit(1)
    try:
        uuid.UUID(args.member_id)
    except ValueError:
        print("--member-id must be a valid UUID", file=sys.stderr)
        sys.exit(1)

    rules_applied = None
    if args.rules_applied:
        try:
            rules_applied = json.loads(args.rules_applied)
        except json.JSONDecodeError:
            print("--rules-applied must be valid JSON array", file=sys.stderr)
            sys.exit(1)

    row = {
        "run_id": run_id,
        "member_id": args.member_id,
        "assigned_to": args.assigned_to,
        "sessions_per_week": args.sessions_per_week,
        "duration_weeks": args.duration_weeks,
        "payload": payload,
    }
    if args.phase_number is not None:
        row["phase_number"] = args.phase_number
    if args.scheme_name:
        row["scheme_name"] = args.scheme_name
    if args.rep_range:
        row["rep_range"] = args.rep_range
    if args.changes_summary:
        row["changes_summary"] = args.changes_summary
    if rules_applied is not None:
        row["rules_applied"] = rules_applied

    supabase = get_supabase()
    supabase.table("programming_generated").insert(row).execute()
    print(f"Inserted 1 row: run_id={run_id}, member_id={args.member_id}, sessions={len(payload['sessions'])}")


if __name__ == "__main__":
    main()
