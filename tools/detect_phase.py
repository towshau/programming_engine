#!/usr/bin/env python3
"""
Phase detection for the programming engine.

Given a member's normalised sessions and their assigned progression scheme,
detect which phase (rep-range step) they are currently in and recommend
the next phase.  Works with fuzzy / imperfect rep data — uses median reps
across A-series compounds, direction-of-travel across blocks, and a
confidence score to handle real-world noise.

Can be used standalone (CLI) or imported into normalize_one_member.py.

Usage:
  python tools/detect_phase.py <member_id> <scheme_name>
  python tools/detect_phase.py <member_id>               # defaults to GPP

Requires: pip install supabase python-dotenv
"""

import math
import os
import sys
from collections import defaultdict
from pathlib import Path
from statistics import median

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:
    pass

# ---------------------------------------------------------------------------
# Detection bands — maps a scheme rep-range label to a numeric band used
# for fuzzy matching.  "centre" is the ideal median; "low"/"high" define the
# acceptance window.  Bands deliberately overlap so direction-of-travel can
# break ties.
# ---------------------------------------------------------------------------

DETECTION_BANDS = {
    "10-12": {"low": 9,  "high": 14, "centre": 11},
    "8-10":  {"low": 7,  "high": 11, "centre": 9},
    "6-8":   {"low": 5,  "high": 9,  "centre": 7},
    "4-6":   {"low": 3,  "high": 7,  "centre": 5},
    "3-5":   {"low": 1,  "high": 6,  "centre": 4},
}

A_SERIES_LABELS = {"A1", "A2"}
BLOCK_SESSION_COUNT = 4  # sessions per block for median calculation


def fetch_schemes(supabase):
    """Load all active progression schemes from Supabase, keyed by name."""
    r = (
        supabase.table("programming_progression_schemes")
        .select("*")
        .eq("active", True)
        .order('"order"')
        .execute()
    )
    schemes = defaultdict(list)
    for row in (r.data or []):
        schemes[row["name"]].append(row)
    return dict(schemes)


def _extract_a_series_reps(session):
    """Return a flat list of rep counts from A-series exercises in one session."""
    reps = []
    for ex in session.get("exercises", []):
        label = (ex.get("series_label") or "").upper()
        if label not in A_SERIES_LABELS:
            continue
        for s in ex.get("sets", []):
            r = s.get("reps")
            if r is not None:
                try:
                    reps.append(int(r))
                except (ValueError, TypeError):
                    pass
    return reps


def compute_block_medians(sessions, block_size=BLOCK_SESSION_COUNT):
    """Split sessions into blocks (most recent first) and return median reps per block.

    Returns a list of dicts sorted newest-first:
      [{"block": 0, "median": 5.0, "n_reps": 12, "sessions": [...]}, ...]
    Block 0 is the most recent.
    """
    sorted_sessions = sorted(
        sessions,
        key=lambda s: s.get("assigned_date") or s.get("day") or "",
        reverse=True,
    )

    blocks = []
    for i in range(0, len(sorted_sessions), block_size):
        chunk = sorted_sessions[i : i + block_size]
        all_reps = []
        for sess in chunk:
            all_reps.extend(_extract_a_series_reps(sess))
        if all_reps:
            blocks.append({
                "block": len(blocks),
                "median": median(all_reps),
                "n_reps": len(all_reps),
                "sessions": chunk,
            })
    return blocks


def _closest_band(med, scheme_ranges):
    """Find the scheme range whose centre is closest to the given median.

    Only considers ranges that actually exist in the scheme.
    Returns (range_label, distance).
    """
    best_label = None
    best_dist = float("inf")
    for rng in scheme_ranges:
        band = DETECTION_BANDS.get(rng)
        if not band:
            continue
        dist = abs(med - band["centre"])
        if dist < best_dist:
            best_dist = dist
            best_label = rng
    return best_label, best_dist


def detect_phase(scheme_rows, sessions):
    """Detect the current phase given scheme rows and normalised sessions.

    Returns a dict:
      {
        "current_rep_range":  "4-6",
        "current_order":      3,
        "next_rep_range":     "3-5",
        "next_order":         4,
        "exercise_behavior":  "same_exercises",
        "confidence":         "high",
        "median_reps":        4.5,
        "direction":          "down",
        "n_reps_sampled":     16,
        "blocks_analysed":    2,
      }
    """
    scheme_ranges = [r["from_rep_range"] for r in scheme_rows]
    # also include the "to" of the last step (the reset target)
    all_ranges = list(dict.fromkeys(scheme_ranges + [scheme_rows[-1]["to_rep_range"]]))

    blocks = compute_block_medians(sessions)
    if not blocks:
        return {
            "current_rep_range": None,
            "next_rep_range": scheme_rows[0]["to_rep_range"],
            "next_order": 1,
            "exercise_behavior": scheme_rows[0]["exercise_behavior"],
            "confidence": "none",
            "median_reps": None,
            "direction": None,
            "n_reps_sampled": 0,
            "blocks_analysed": 0,
            "reason": "No A-series rep data found.",
        }

    current_med = blocks[0]["median"]
    best_range, best_dist = _closest_band(current_med, all_ranges)

    # --- Direction of travel ---
    direction = None
    if len(blocks) >= 2:
        prev_med = blocks[1]["median"]
        if current_med < prev_med - 0.5:
            direction = "down"
        elif current_med > prev_med + 0.5:
            direction = "up"
        else:
            direction = "flat"

    # --- Resolve ambiguity when median sits in an overlap zone ---
    candidates = []
    for rng in all_ranges:
        band = DETECTION_BANDS.get(rng)
        if band and band["low"] <= current_med <= band["high"]:
            candidates.append(rng)

    if len(candidates) > 1 and direction:
        if direction == "down":
            # Pick the lower (further progressed) range
            candidates.sort(key=lambda r: DETECTION_BANDS[r]["centre"])
            best_range = candidates[0]
        elif direction == "up":
            # Pick the higher range (reset)
            candidates.sort(key=lambda r: DETECTION_BANDS[r]["centre"], reverse=True)
            best_range = candidates[0]
        # flat → keep the closest-centre pick

    # --- Map to scheme order ---
    current_order = None
    next_row = None
    for row in scheme_rows:
        if row["from_rep_range"] == best_range:
            current_order = row["order"]
            next_row = row
            break

    # If the detected range matches the *to* of the last step (e.g. "8-10" after a
    # reset in Strength), that means we're at the START of order 1.
    if current_order is None:
        last_to = scheme_rows[-1]["to_rep_range"]
        if best_range == last_to:
            # Just completed a reset — now sitting at the first step's "from"
            current_order = scheme_rows[0]["order"]
            next_row = scheme_rows[0]

    # Still can't match — fall back to order 1
    if next_row is None:
        next_row = scheme_rows[0]
        current_order = 0

    # --- Confidence ---
    if best_dist <= 1.0 and (direction in ("down", "up") or len(blocks) < 2):
        confidence = "high"
    elif best_dist <= 2.0 and direction is not None:
        confidence = "medium"
    else:
        confidence = "low"

    return {
        "current_rep_range": best_range,
        "current_order": current_order,
        "next_rep_range": next_row["to_rep_range"],
        "next_order": (current_order % len(scheme_rows)) + 1 if current_order else 1,
        "exercise_behavior": next_row["exercise_behavior"],
        "confidence": confidence,
        "median_reps": round(current_med, 1),
        "direction": direction,
        "n_reps_sampled": blocks[0]["n_reps"],
        "blocks_analysed": len(blocks),
    }


def detect_phase_for_member(supabase, member_id, scheme_name, sessions):
    """High-level convenience: fetch scheme from DB and detect phase."""
    schemes = fetch_schemes(supabase)
    rows = schemes.get(scheme_name)
    if not rows:
        raise ValueError(
            f"Scheme '{scheme_name}' not found. Available: {list(schemes.keys())}"
        )
    return detect_phase(rows, sessions)


# ---------------------------------------------------------------------------
# CLI: run standalone for a member
# ---------------------------------------------------------------------------

def _cli():
    from normalize_one_member import (
        get_supabase,
        fetch_exercise_library,
        fetch_results_for_member,
        normalize,
    )

    member_id = sys.argv[1] if len(sys.argv) >= 2 else None
    scheme_name = sys.argv[2] if len(sys.argv) >= 3 else "GPP"

    supabase = get_supabase()

    if not member_id:
        r = (
            supabase.table("member_tbresults")
            .select("member_id")
            .not_.is_("member_id", "null")
            .limit(1)
            .execute()
        )
        member_id = r.data[0]["member_id"]
        print(f"Using first member: {member_id}")

    rows = fetch_results_for_member(supabase, member_id)
    if not rows:
        print(f"No data for member {member_id}", file=sys.stderr)
        sys.exit(1)

    exercise_lib = fetch_exercise_library(supabase)
    payload = normalize(rows, exercise_lib)
    sessions = payload["sessions"]

    result = detect_phase_for_member(supabase, member_id, scheme_name, sessions)

    print(f"\n{'='*60}")
    print(f"Phase detection for member {member_id}")
    print(f"Scheme: {scheme_name}")
    print(f"{'='*60}")
    print(f"  Median reps (A-series):  {result['median_reps']}")
    print(f"  Reps sampled:            {result['n_reps_sampled']}")
    print(f"  Blocks analysed:         {result['blocks_analysed']}")
    print(f"  Direction of travel:     {result['direction']}")
    print(f"  Detected current range:  {result['current_rep_range']}")
    print(f"  Current scheme order:    {result['current_order']}")
    print(f"  Next rep range:          {result['next_rep_range']}")
    print(f"  Next scheme order:       {result['next_order']}")
    print(f"  Exercise behavior:       {result['exercise_behavior']}")
    print(f"  Confidence:              {result['confidence']}")
    if result.get("reason"):
        print(f"  Note:                    {result['reason']}")
    print()


if __name__ == "__main__":
    _cli()
