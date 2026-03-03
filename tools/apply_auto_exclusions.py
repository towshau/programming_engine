#!/usr/bin/env python3
"""
Apply auto-exclusions from coach feedback (self-improving loop).

Reads programming_feedback; for any (member_id, exercise_id) with 3+ negative
feedbacks, ensures a row exists in programming_exercise_exclusions so the
engine will not assign that exercise to that member again.

Negative feedback types: exercise_swap, pairing_issue, too_hard, too_easy, other.
"positive" is not counted.

Usage:
  Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) in .env.
  python tools/apply_auto_exclusions.py

Idempotent: does not duplicate exclusions; only inserts where missing.
"""

import os
import sys
from pathlib import Path

# Optional: load .env from repo root
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:
    pass

NEGATIVE_FEEDBACK_TYPES = (
    "exercise_swap",
    "pairing_issue",
    "too_hard",
    "too_easy",
    "other",
)
AUTO_REASON = "auto_exclusion_from_feedback"
THRESHOLD = 3


def get_supabase():
    url = (os.environ.get("SUPABASE_URL") or "").strip().strip('"\'')
    key = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_ANON_KEY") or "").strip().strip('"\'')
    if not url or not key:
        print("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) in .env", file=sys.stderr)
        sys.exit(1)
    if "your-project" in url or not url.startswith("https://"):
        print("SUPABASE_URL in .env looks wrong. Use your real project URL, e.g. https://xxxxx.supabase.co", file=sys.stderr)
        sys.exit(1)
    try:
        from supabase import create_client
        return create_client(url, key)
    except ImportError:
        print("Install supabase: pip install supabase", file=sys.stderr)
        sys.exit(1)


def main():
    supabase = get_supabase()

    # All negative feedback rows with an exercise_id
    r = (
        supabase.table("programming_feedback")
        .select("member_id, exercise_id")
        .in_("feedback_type", list(NEGATIVE_FEEDBACK_TYPES))
        .not_.is_("exercise_id", "null")
        .execute()
    )
    rows = r.data or []

    # Count per (member_id, exercise_id)
    from collections import Counter
    counts = Counter((row["member_id"], row["exercise_id"]) for row in rows)

    # Above threshold
    to_exclude = [
        {"member_id": mid, "exercise_id": eid}
        for (mid, eid), count in counts.items()
        if count >= THRESHOLD
    ]
    if not to_exclude:
        print("No (member_id, exercise_id) with 3+ negative feedbacks.")
        return

    # Existing active exclusions
    existing = set()
    for pair in to_exclude:
        r = (
            supabase.table("programming_exercise_exclusions")
            .select("id")
            .eq("member_id", pair["member_id"])
            .eq("exercise_id", pair["exercise_id"])
            .eq("active", True)
            .execute()
        )
        if (r.data or []):
            existing.add((pair["member_id"], pair["exercise_id"]))

    # Insert missing
    to_insert = [
        {"member_id": p["member_id"], "exercise_id": p["exercise_id"], "reason": AUTO_REASON, "active": True}
        for p in to_exclude
        if (p["member_id"], p["exercise_id"]) not in existing
    ]
    if not to_insert:
        print("All such exclusions already exist.")
        return

    for row in to_insert:
        supabase.table("programming_exercise_exclusions").insert(row).execute()
    print(f"Inserted {len(to_insert)} auto-exclusion(s).")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        if "getaddrinfo" in str(e).lower() or "ConnectError" in type(e).__name__:
            print("Could not reach Supabase (DNS/network failed). Check:", file=sys.stderr)
            print("  1. SUPABASE_URL in .env is your real project URL (e.g. https://xxxxx.supabase.co)", file=sys.stderr)
            print("  2. No quotes or extra spaces around the URL", file=sys.stderr)
            print("  3. You have internet access", file=sys.stderr)
            sys.exit(1)
        raise
