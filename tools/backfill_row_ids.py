#!/usr/bin/env python3
"""
One-time migration: stamp a UUID `row_id` on every exercise inside every
programming_generated payload that doesn't already have one.

Safe to run multiple times (idempotent).

Usage:
  python tools/backfill_row_ids.py            # all rows
  python tools/backfill_row_ids.py --dry-run  # preview only
"""

import json
import os
import sys
import uuid
from pathlib import Path

_tools_dir = str(Path(__file__).resolve().parent)
if _tools_dir not in sys.path:
    sys.path.insert(0, _tools_dir)

from dotenv import load_dotenv
from supabase import create_client

env_path = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(dotenv_path=env_path)

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ["SUPABASE_ANON_KEY"]


def get_supabase():
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def backfill(dry_run: bool = False):
    sb = get_supabase()

    page_size = 500
    offset = 0
    updated = 0
    skipped = 0
    total = 0

    while True:
        resp = (
            sb.table("programming_generated")
            .select("id, payload")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        rows = resp.data or []
        if not rows:
            break

        for row in rows:
            total += 1
            payload = row.get("payload")
            if not payload or not isinstance(payload, dict):
                skipped += 1
                continue

            sessions = payload.get("sessions", [])
            needs_update = False

            for session in sessions:
                for ex in session.get("exercises", []):
                    if not ex.get("row_id"):
                        ex["row_id"] = str(uuid.uuid4())
                        needs_update = True

            if not needs_update:
                skipped += 1
                continue

            if dry_run:
                exercise_count = sum(
                    len(s.get("exercises", [])) for s in sessions
                )
                print(f"  [DRY RUN] Would update {row['id']} ({exercise_count} exercises)")
            else:
                sb.table("programming_generated").update(
                    {"payload": payload}
                ).eq("id", row["id"]).execute()

            updated += 1

        offset += page_size

    print(f"\nDone. Scanned {total} rows: {updated} updated, {skipped} already had row_ids.")
    return updated


if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    if dry_run:
        print("DRY RUN MODE — no writes will be made.\n")
    backfill(dry_run=dry_run)
