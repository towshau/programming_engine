#!/usr/bin/env python3
"""
Backfill exercise_library.equipment_tags (text[]) for holiday-program filtering.

See docs/data-model.md § exercise_library for tag vocabulary.

Usage:
  Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env at repo root.
  python tools/backfill_exercise_equipment_tags.py
  python tools/backfill_exercise_equipment_tags.py --dry-run
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:
    pass


def get_supabase():
    url = (os.environ.get("SUPABASE_URL") or "").strip().strip('"\'')
    key = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_ANON_KEY") or "").strip().strip(
        '"\''
    )
    if not url or not key:
        print("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env", file=sys.stderr)
        sys.exit(1)
    from supabase import create_client

    return create_client(url, key)


_NON_EXERCISE_EXACT = frozenset(
    {
        "SMM Manual Entry",
        "Step Count - Manual Entry",
        "Body Weight",
        "Body Fat Percentage",
        "Cardio Completed - Please Tick Below",
        "Base - Week 2: Vo2",
    }
)


def tag_exercise(name: str, movement_tag: str | None) -> list[str]:
    """Return sorted unique canonical tags."""
    if (name or "").strip() in _NON_EXERCISE_EXACT:
        return []

    n = (name or "").lower()
    mt = (movement_tag or "").strip()
    s: set[str] = set()

    # Movement tag hints (TeamBuildr category)
    if mt in ("Rehab", "Mobility"):
        s.add("bodyweight")
    if mt == "Plyometric":
        s.add("bodyweight")

    # Viking + Landmine — specialty rack; not generic corner landmine
    if "viking" in n and "landmine" in n:
        return sorted({"barbell", "landmine_viking"})

    # --- Specific multi-word (before generic keywords)
    if "hammer strength" in n:
        s.add("machine_other")
    if "hack squat" in n:
        s.add("hack_squat")
    if "smith machine" in n:
        s.add("smith_machine")
    if "trap bar" in n:
        s.add("trap_bar")
    if "safety bar" in n:
        s.add("safety_bar")
    if "swiss bar" in n:
        s.add("swiss_bar")
    if "ez bar" in n:
        s.add("ez_bar")

    # Cable stack (explicit "Cable" or "Pulley" in name)
    if "cable" in n or "pulley" in n or "pulleys" in n:
        s.add("cable")

    if "dumbbell" in n:
        s.add("dumbbell")
    if "barbell" in n:
        s.add("barbell")
    if "kettlebell" in n or " kb " in n or n.endswith(" kb"):
        s.add("kettlebell")
    if "weight plate" in n or "plate grip" in n or "holding plate" in n:
        s.add("weight_plate")
    if "medicine ball" in n or "wall ball" in n:
        s.add("medicine_ball")
    if "foam roll" in n or "foam roller" in n:
        s.add("foam_roller")

    if "band" in n or "banded" in n:
        s.add("band")
    if "trx" in n or "suspension" in n:
        s.add("trx")

    if "assault run" in n or "assault runner" in n:
        s.add("treadmill")
        s.add("assault_runner")
    elif "treadmill" in n:
        s.add("treadmill")
    if "bike erg" in n or "echo bike" in n or "bike " in n and "erg" in n:
        s.add("bike")
    if "rower" in n:
        s.add("rower")
    if "elliptical" in n:
        s.add("elliptical")

    if "leg press" in n:
        s.add("leg_press")
    if "leg extension" in n:
        s.add("leg_extension")
    if "leg curl" in n or "hamstring curl" in n:
        s.add("leg_curl")

    if "chest press" in n and "machine" in n:
        s.add("chest_press_machine")

    if "pulldown" in n and "machine" in n:
        s.add("pulldown_machine")
    elif "pulldown" in n or "pull in" in n:
        s.add("cable")
    if "facepull" in n or "face pull" in n:
        s.add("cable")
    if "pressdown" in n or "press down" in n:
        s.add("cable")

    # Seated / kneeling rows — cable stack (unless Hammer Strength handled above)
    if ("row - seated" in n or "row - kneeling" in n) and "hammer strength" not in n:
        s.add("cable")
    if "row - bent over" in n and "towel" not in n:
        s.add("cable")
    if "reverse fly" in n and "wrist cuff" in n:
        s.add("cable")
    if "tricep extension" in n and "overhead" in n and "rope" in n:
        s.add("cable")

    if "landmine" in n and "viking" not in n:
        s.add("landmine")
        s.add("barbell")

    if "chin up" in n or "chin-up" in n:
        s.add("pull_up_bar")
    if "pull up" in n or "pull-up" in n or "pullup" in n:
        s.add("pull_up_bar")
    if "scap pull" in n:
        s.add("pull_up_bar")
    if "dip - straight bar" in n or ("dip -" in n and "bar" in n):
        s.add("dip_bar")
    if "leg raise" in n and "dip" in n:
        s.add("dip_bar")

    if "rack pull" in n:
        s.add("barbell")
        s.add("power_rack")
    if "power clean" in n:
        s.add("barbell")

    if "bench" in n or "incline" in n or "preacher" in n:
        if "medicine" not in n:
            s.add("bench")
    if "flat" in n and "press" in n and "swiss" not in n:
        s.add("bench")

    if "45 deg" in n and "back extension" in n:
        s.add("back_extension")
    elif "back extension" in n and "prone" not in n:
        s.add("back_extension")

    if "ab roll" in n:
        s.add("ab_wheel")

    if "ring" in n and "row" in n:
        s.add("rings")
    if "parallette" in n:
        s.add("parallette_bar")

    if "box jump" in n or "box drop" in n or "single leg box" in n:
        s.add("plyo_box")
    if "step up" in n or "step down" in n or "hip hitching" in n:
        s.add("plyo_box")

    if "farmer carry" in n:
        s.add("weight_plate" if "plate grip" in n else "dumbbell")

    if "push up" in n or "push-up" in n:
        s.add("bodyweight")
    if "plank" in n:
        s.add("bodyweight")
    if "hollow body" in n:
        s.add("bodyweight")
    if "sit up" in n or "sit-up" in n or "crunch" in n:
        s.add("bodyweight")
    if "glute bridge" in n and "barbell" not in n and "dumbbell" not in n:
        s.add("bodyweight")
    if "wall sit" in n:
        s.add("bodyweight")

    if "lunge" in n and "landmine" not in n and "dumbbell" not in n and "barbell" not in n:
        s.add("bodyweight")
    if "split squat" in n and "landmine" not in n and "safety" not in n:
        if "dumbbell" not in n and "barbell" not in n:
            s.add("bodyweight")

    if "squat - counterbalance" in n:
        s.add("dumbbell")
    if "squat - spanish" in n:
        s.add("band")
        s.add("bodyweight")
    if "pistol squat" in n:
        s.add("bodyweight")
        s.add("bench")

    if "dead hang" in n:
        s.add("pull_up_bar")
    if "pogo" in n or ("jump" in n and "box" in n):
        s.add("bodyweight")

    if "pendulum" in n:
        s.add("pendulum")

    # Cable: Pulldown / high pulley without "machine" in name
    if "pulldown" in n and "machine" not in n and "pulldown_machine" not in s:
        s.add("cable")

    # Adductor / abductor machine
    if "adductor" in n and "machine" in n:
        s.add("machine_other")
    if "45 degree" in n and "machine" in n:
        s.add("machine_other")

    if "bicep curl" in n and "machine" in n:
        s.add("machine_other")
    if "kickback" in n and "machine" in n:
        s.add("machine_other")
    if "hip abduction" in n and "machine" in n:
        s.add("machine_other")
    if "hip adduction" in n and "machine" in n and "cable" not in n:
        s.add("machine_other")
    if "seated row" in n and "machine" in n:
        s.add("machine_other")
    if n.strip() == "dip - weighted":
        s.add("dip_bar")
        s.add("weight_plate")
    if "leg raise" in n and "hanging" in n:
        s.add("pull_up_bar")
    if "leg raise" in n and "lying" in n:
        s.add("bodyweight")
    if "ext rotation" in n:
        s.add("dumbbell")
    if "bicep" in n and "rotating" in n and "alternating" in n:
        s.add("dumbbell")
    if "tricep extension" in n and "bar" in n and "overhead" in n:
        s.add("cable")

    if "calf raise" in n and "seated" in n:
        s.add("machine_other")
    if "calf raise" in n and "pendulum" in n:
        s.add("pendulum")

    # Fallback: still empty — bodyweight mobility / warm-up by name
    if not s:
        if any(
            x in n
            for x in (
                "stretch",
                "mobility",
                "foam",
                "pigeon",
                "couch",
                "cat camel",
                "thread",
                "thoracic",
                "hip airplane",
                "jefferson curl",
                "pec stretch",
                "pelvic",
                "butchers",
                "frog rock",
                "cars",
                "rotation - cuban",
            )
        ):
            s.add("bodyweight")
        elif mt in ("Rehab", "Mobility", "Plyometric"):
            s.add("bodyweight")

    # Final catch-all for unnamed-equipment patterns
    if not s:
        if n.startswith("row -") or " - row" in n:
            s.add("cable")
        elif "deadlift" in n:
            s.add("barbell")
        elif "squat -" in n or n.startswith("squat "):
            if "pendulum" in n:
                s.add("pendulum")
            elif "safety" in n:
                s.add("safety_bar")
            else:
                s.add("bodyweight")
        elif "press -" in n or n.startswith("press "):
            if "landmine" in n:
                s.add("landmine")
                s.add("barbell")
            else:
                s.add("dumbbell")
        elif "lateral raise" in n or "y raise" in n or "trap raise" in n or "trap -" in n:
            s.add("dumbbell")
        elif "copenhagen" in n:
            s.add("bench")
            s.add("bodyweight")
        elif "calf raise" in n:
            s.add("bodyweight")
        elif "hip thrust" in n:
            s.add("bench")
            s.add("barbell")
        elif "side bend" in n:
            s.add("weight_plate")
        elif "forearm" in n:
            s.add("dumbbell")
        elif "wrist" in n:
            s.add("dumbbell")
        elif "hamstring bridge" in n or "hamstring scoop" in n:
            s.add("bodyweight")
        elif "hinge -" in n:
            s.add("bodyweight")
        elif "hip flexion" in n:
            s.add("bodyweight")
        elif "knee raise" in n or "knee -" in n:
            s.add("bodyweight")
        elif "shotgun" in n or "x sit up" in n:
            s.add("bodyweight")
        elif "russian twist" in n:
            s.add("medicine_ball")
        elif "wall ball" in n.lower():
            s.add("medicine_ball")
        elif "standing ankle" in n:
            s.add("bodyweight")
        elif "deadbug" in n or "dead bug" in n:
            s.add("bodyweight")
        elif "bird dog" in n:
            s.add("bodyweight")
        elif "bicycle" in n:
            s.add("bodyweight")
        elif "dragon flag" in n:
            s.add("bench")
        elif "l sit" in n or "l-sit" in n:
            s.add("parallette_bar")
        elif "side plank" in n:
            s.add("bodyweight")
        elif "curtsy" in n:
            s.add("landmine")
            s.add("barbell")
        elif "med ball" in n or "rotational throw" in n:
            s.add("medicine_ball")
        elif "tibial" in n:
            s.add("bodyweight")
        elif "shoulder" in n and "1." in n:
            s.add("bodyweight")
        elif "lower back" in n and "1." in n:
            s.add("bodyweight")
        elif "knee 1." in n:
            s.add("bodyweight")
        elif "elbow 1." in n:
            s.add("dumbbell")
        elif "alternating split squat jump" in n:
            s.add("bodyweight")
        elif "ball slam" in n:
            s.add("medicine_ball")
        elif "drop jump" in n or "vertical jump" in n:
            s.add("bodyweight")
        elif "lateral hop" in n or "lateral jump" in n:
            s.add("bodyweight")
        elif "rapid response" in n:
            s.add("bodyweight")
        elif "split squat stance" in n:
            s.add("bodyweight")
        elif "single leg drop" in n:
            s.add("bodyweight")
        elif "single leg pogo" in n:
            s.add("bodyweight")
        elif "jumps - split" in n:
            s.add("bodyweight")
        elif "squat jump" in n:
            s.add("bodyweight")
        elif "bicycles" in n:
            s.add("bodyweight")
        elif "reverse crunch" in n:
            s.add("bodyweight")

    return sorted(s)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    sb = get_supabase()
    res = sb.table("exercise_library").select("id, exercise_name, tags").execute()
    rows = res.data or []
    if not rows:
        print("No rows in exercise_library", file=sys.stderr)
        sys.exit(1)

    counts: dict[str, int] = {}
    empty = 0
    updates: list[tuple[int, list[str]]] = []

    for row in rows:
        eid = row["id"]
        name = row["exercise_name"] or ""
        movement = row.get("tags")
        tags = tag_exercise(name, movement if isinstance(movement, str) else None)
        updates.append((eid, tags))
        if not tags:
            empty += 1
        for t in tags:
            counts[t] = counts.get(t, 0) + 1

    print(f"Total exercises: {len(rows)}")
    print(f"Empty tags: {empty}")
    print("Tag counts:")
    for k in sorted(counts.keys()):
        print(f"  {k}: {counts[k]}")

    if args.dry_run:
        print("Dry run — no DB updates.")
        return

    for i, (eid, tags) in enumerate(updates, 1):
        sb.table("exercise_library").update({"equipment_tags": tags}).eq("id", eid).execute()
        if i % 100 == 0:
            print(f"  Updated {i}/{len(updates)}...")

    print(f"Done. Updated {len(updates)} rows.")


if __name__ == "__main__":
    main()
