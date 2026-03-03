#!/usr/bin/env python3
"""
Normalize past program for one member and write to staging.

Reads member_tbresults + exercise_library for the given member_id, groups by
**day (assigned_date)** so all exercises on the same day form one session (Day 1,
Day 2, ...), then writes one row to programming_past_programs_staging.

Where normalized workouts go: programming_past_programs_staging (one row per
member per run_id; payload = jsonb with sessions/exercises/sets).

Usage:
  Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) in .env.
  python tools/normalize_one_member.py <member_id> [--scheme GPP|Strength|Hypertrophy]
  python tools/normalize_one_member.py   # uses first member found, defaults to GPP

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

# Allow import whether run from repo root or tools/
_tools_dir = str(Path(__file__).resolve().parent)
if _tools_dir not in sys.path:
    sys.path.insert(0, _tools_dir)
from detect_phase import detect_phase_for_member


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
    r = supabase.table("exercise_library").select("exercise_id, exercise_name, tags, series_assignment").execute()
    lib = {}
    for row in (r.data or []):
        lib[row["exercise_name"]] = {
            "exercise_id": row["exercise_id"],
            "tags": row.get("tags"),
            "series_assignment": row.get("series_assignment"),
        }
    return lib


SERIES_ORDER = ["A", "B", "C", "D"]
MAX_PER_SERIES = 2


def _series_priority(series_list):
    """Return the index of the earliest series this exercise is eligible for.
    Lower = higher priority (A=0, B=1, C=2, D=3). Warm Up and unassigned sort last."""
    if not series_list:
        return 99
    for i, s in enumerate(SERIES_ORDER):
        if s in series_list:
            return i
    return 99


def assign_series(exercises, exercise_lib):
    """Assign a series label (A1, A2, B1, B2, ...) to each exercise in a session.

    Rules:
    - Max 2 exercises per series.
    - Each exercise is placed in its earliest eligible series that still has room.
    - Warm Up exercises are separated into their own group.
    - Exercises with no series_assignment (metrics, etc.) are excluded.
    """
    warm_up = []
    to_place = []

    for ex in exercises:
        info = exercise_lib.get(ex["exercise_name"]) or {}
        eligibility = info.get("series_assignment") or []
        if "Warm Up" in eligibility:
            ex["series_label"] = "Warm Up"
            warm_up.append(ex)
        elif not eligibility:
            ex["series_label"] = None
        else:
            to_place.append((ex, eligibility))

    to_place.sort(key=lambda pair: _series_priority(pair[1]))

    slots = {s: 0 for s in SERIES_ORDER}
    placed = []

    for ex, eligibility in to_place:
        assigned = False
        for s in SERIES_ORDER:
            if s in eligibility and slots[s] < MAX_PER_SERIES:
                slot_num = slots[s] + 1
                ex["series_label"] = f"{s}{slot_num}"
                slots[s] += 1
                placed.append(ex)
                assigned = True
                break
        if not assigned:
            # Overflow: all eligible series are full, push to next available
            for s in SERIES_ORDER:
                if slots[s] < MAX_PER_SERIES:
                    slot_num = slots[s] + 1
                    ex["series_label"] = f"{s}{slot_num}"
                    slots[s] += 1
                    placed.append(ex)
                    assigned = True
                    break
        if not assigned:
            ex["series_label"] = "extra"
            placed.append(ex)

    return warm_up + placed


def normalize(rows, exercise_lib):
    """Group tbresults rows by day (assigned_date); each day = one session.

    Exercises are ordered by series assignment (A1, A2, B1, B2, C1, C2, D1, D2)
    using the series_assignment column from exercise_library.
    """
    by_day = defaultdict(list)
    for row in rows:
        day = row.get("assigned_date") or row.get("completed_date")
        if day:
            by_day[day].append(row)

    sessions = []
    for day, day_rows in sorted(by_day.items()):
        by_exercise = defaultdict(list)
        for row in day_rows:
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
            info = exercise_lib.get(exercise_name) or {}
            exercises.append({
                "exercise_name": exercise_name,
                "exercise_id": info.get("exercise_id"),
                "tags": info.get("tags") or (set_rows[0].get("tags") if set_rows else None),
                "series_assignment": info.get("series_assignment"),
                "sets": sets,
            })

        ordered = assign_series(exercises, exercise_lib)

        first = day_rows[0]
        sessions.append({
            "day": day,
            "assigned_date": first.get("assigned_date"),
            "completed_date": first.get("completed_date"),
            "exercises": ordered,
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

    exercise_lib = fetch_exercise_library(supabase)
    payload = normalize(rows, exercise_lib)

    # --- Phase detection (optional: pass --scheme <name>) ---
    scheme_name = "GPP"
    if "--scheme" in sys.argv:
        idx = sys.argv.index("--scheme")
        if idx + 1 < len(sys.argv):
            scheme_name = sys.argv[idx + 1]

    try:
        phase = detect_phase_for_member(
            supabase, member_id, scheme_name, payload["sessions"]
        )
        payload["phase_detection"] = phase
        print(f"\nPhase detection (scheme={scheme_name}):")
        print(f"  Current range:  {phase.get('current_rep_range')}")
        print(f"  Median reps:    {phase.get('median_reps')}")
        print(f"  Direction:      {phase.get('direction')}")
        print(f"  Next range:     {phase.get('next_rep_range')}")
        print(f"  Confidence:     {phase.get('confidence')}")
        if phase.get("reason"):
            print(f"  Note:           {phase['reason']}")
    except Exception as exc:
        print(f"Phase detection skipped: {exc}", file=sys.stderr)
        payload["phase_detection"] = None

    run_id = str(uuid.uuid4())
    row = {
        "run_id": run_id,
        "member_id": member_id,
        "assigned_to": None,
        "payload": payload,
    }

    supabase.table("programming_past_programs_staging").insert(row).execute()
    print(f"\nUpserted 1 row to programming_past_programs_staging: run_id={run_id}, member_id={member_id}")
    print("Payload sessions:", len(payload["sessions"]))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        if "getaddrinfo" in str(e).lower() or "ConnectError" in type(e).__name__:
            print("Could not reach Supabase (DNS/network failed). Check SUPABASE_URL in .env and internet access.", file=sys.stderr)
            sys.exit(1)
        raise
