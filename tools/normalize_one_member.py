#!/usr/bin/env python3
"""
Normalize past program for one member and write to staging.

Reads member_tbresults + exercise_library for the given member_id, groups by
workout (workout_id) into sessions with exercises and sets, then upserts one
row into programming_past_programs_staging.

Where normalized workouts go: programming_past_programs_staging (one row per
member per run_id; payload = jsonb with sessions/exercises/sets).

Usage:
  Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) in .env.
  python tools/normalize_one_member.py <member_id>
  python tools/normalize_one_member.py   # uses first member found in member_tbresults

Requires: pip install supabase python-dotenv
"""

import json
import os
import sys
import uuid
from collections import defaultdict
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
        print("SUPABASE_URL in .env looks wrong. Use your real project URL, e.g. https://xxxxx.supabase.co", file=sys.stderr)
        sys.exit(1)
    try:
        from supabase import create_client
        return create_client(url, key)
    except ImportError:
        print("Install: pip install supabase python-dotenv", file=sys.stderr)
        sys.exit(1)


def fetch_results_for_member(supabase, member_id):
    r = supabase.table("member_tbresults").select("*").eq("member_id", member_id).execute()
    return r.data or []


def fetch_exercise_library(supabase):
    r = supabase.table("exercise_library").select("exercise_id, exercise_name").execute()
    return {row["exercise_name"]: row["exercise_id"] for row in (r.data or [])}


def normalize(rows, name_to_id):
    """Group tbresults rows into sessions (by workout_id) and exercises with sets."""
    # workout_id -> list of rows
    by_workout = defaultdict(list)
    for row in rows:
        wid = row.get("workout_id") or row.get("assigned_date")
        by_workout[wid].append(row)

    sessions = []
    for workout_id, workout_rows in sorted(by_workout.items(), key=lambda x: str(x[0])):
        # exercise_name -> list of set rows
        by_exercise = defaultdict(list)
        for row in workout_rows:
            by_exercise[row["exercise_name"]].append(row)

        exercises = []
        for exercise_name, set_rows in sorted(by_exercise.items()):
            sets = []
            for r in sorted(set_rows, key=lambda x: (x.get("set_number") or 0)):
                sets.append({
                    "set_number": r.get("set_number"),
                    "reps": r.get("reps"),
                    "result": r.get("result"),
                })
            exercises.append({
                "exercise_name": exercise_name,
                "exercise_id": name_to_id.get(exercise_name),
                "tags": (set_rows[0].get("tags") if set_rows else None),
                "sets": sets,
            })

        first = workout_rows[0]
        sessions.append({
            "workout_id": str(workout_id),
            "assigned_date": first.get("assigned_date"),
            "completed_date": first.get("completed_date"),
            "exercises": exercises,
        })

    return {"sessions": sessions}


def main():
    supabase = get_supabase()

    if len(sys.argv) >= 2:
        member_id = sys.argv[1]
    else:
        r = supabase.table("member_tbresults").select("member_id").not_.is_("member_id", "null").limit(1).execute()
        if not r.data:
            print("No member_id in member_tbresults. Pass member_id as argument.", file=sys.stderr)
            sys.exit(1)
        member_id = r.data[0]["member_id"]
        print(f"Using first member: {member_id}")

    rows = fetch_results_for_member(supabase, member_id)
    if not rows:
        print(f"No rows in member_tbresults for member_id={member_id}", file=sys.stderr)
        sys.exit(1)

    name_to_id = fetch_exercise_library(supabase)
    payload = normalize(rows, name_to_id)

    run_id = str(uuid.uuid4())
    row = {
        "run_id": run_id,
        "member_id": member_id,
        "assigned_to": None,
        "payload": payload,
    }

    supabase.table("programming_past_programs_staging").insert(row).execute()
    print(f"Upserted 1 row to programming_past_programs_staging: run_id={run_id}, member_id={member_id}")
    print("Payload sessions:", len(payload["sessions"]))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        if "getaddrinfo" in str(e).lower() or "ConnectError" in type(e).__name__:
            print("Could not reach Supabase (DNS/network failed). Check SUPABASE_URL in .env and internet access.", file=sys.stderr)
            sys.exit(1)
        raise
