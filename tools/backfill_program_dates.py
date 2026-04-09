#!/usr/bin/env python3
"""
Backfill script to populate start_date and end_date on programming_generated.
Used to support a continuous timeline of programs and chaining.

Usage:
  python tools/backfill_program_dates.py [--dry-run]
"""

import argparse
import os
import sys
from datetime import datetime, timedelta
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

def parse_date(date_str):
    if not date_str:
        return None
    # Handle ISO strings or simple YYYY-MM-DD
    if 'T' in date_str:
        return datetime.fromisoformat(date_str.replace('Z', '+00:00')).date()
    return datetime.strptime(date_str, "%Y-%m-%d").date()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="Do not execute updates")
    args = ap.parse_args()

    supabase = get_supabase()

    print("Fetching distinct member_ids from programming_generated...")
    res = supabase.table("programming_generated").select("member_id").execute()
    member_ids = list(set(r["member_id"] for r in res.data))
    
    print(f"Found {len(member_ids)} members. Backfilling dates...")

    updates = 0
    skipped = 0

    for member_id in member_ids:
        # Fetch all non-holiday programs for this member, ASC to process oldest first
        res = supabase.table("programming_generated") \
            .select("id, created_at, duration_weeks, next_due_date, start_date, end_date") \
            .eq("member_id", member_id) \
            .neq("program_type", "holiday") \
            .order("created_at", desc=False) \
            .execute()
        
        programs = res.data
        if not programs:
            continue

        previous_end_date = None

        for prog in programs:
            if prog.get("start_date") and prog.get("end_date"):
                skipped += 1
                previous_end_date = parse_date(prog["end_date"])
                continue

            duration_weeks = prog.get("duration_weeks") or 6
            next_due_date = parse_date(prog.get("next_due_date"))
            created_at = parse_date(prog.get("created_at"))

            if next_due_date:
                end_date = next_due_date
                start_date = end_date - timedelta(days=duration_weeks * 7)
            else:
                start_date = created_at
                end_date = start_date + timedelta(days=duration_weeks * 7)

            # Chain check: snap start_date to previous_end_date if they overlap or are close
            if previous_end_date and start_date < previous_end_date:
                start_date = previous_end_date
                end_date = start_date + timedelta(days=duration_weeks * 7)

            previous_end_date = end_date

            start_date_str = start_date.strftime("%Y-%m-%d")
            end_date_str = end_date.strftime("%Y-%m-%d")

            if not args.dry_run:
                supabase.table("programming_generated").update({
                    "start_date": start_date_str,
                    "end_date": end_date_str
                }).eq("id", prog["id"]).execute()
            
            updates += 1
            print(f"{'[DRY RUN] ' if args.dry_run else ''}Updated {prog['id']} -> start_date: {start_date_str}, end_date: {end_date_str}")

    print(f"Done. Updates: {updates}, Skipped (already set): {skipped}")

if __name__ == "__main__":
    main()
