#!/usr/bin/env python3
"""
Deterministic program generator.

Takes a member's normalised past program (from staging or in-memory), engine
config (rules, scheme, exclusions), exercise library, and phase detection
result, then produces the next program as canonical JSON.

Algorithm:
  1. Read the most recent block of sessions (the "current program").
  2. Use phase detection to decide the next rep range.
  3. For exercise_behavior = same_exercises: carry forward the same exercises
     with updated rep ranges. For allow_exercise_changes: swap C/D exercises.
  4. Apply rules: max 2 per series, C-series self-sufficient, avoid banned
     exercises, exclude member exclusions, pairings work at both gyms.
  5. Assign set structures (standard 3-3-2).
  6. Output canonical payload JSON.

Usage:
  python tools/generate_program.py <member_id> [--scheme Strength] [--sessions-per-week 3]

Requires: pip install supabase python-dotenv
"""

import json
import os
import sys
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
    SERIES_ORDER,
)
from detect_phase import detect_phase_for_member
from load_rules import load_config


# ── Helpers ──────────────────────────────────────────────────────────────────

C_SERIES_GOOD_TAGS = {
    "Elbow Flexion", "Elbow Extension", "Core Stability",
    "Spinal Flexion", "Core-Rotation",
}
C_SERIES_BAD_TAGS = {
    "Horizontal Press", "Vertical Press", "Lower Body Push",
    "Lower Body Pull", "Hip Dominant",
}
AVOID_EXERCISES_DEFAULT = {"walking lunges", "farmer carries"}

PRESS_TAGS = {"Vertical Press", "Horizontal Press"}
PULL_TAGS = {"Vertical Pull", "Horizontal Pull"}


def _apply_press_pull_pairing(exercises, rules):
    """Re-pair so press+pull share A/B series; press in the '1' slot.

    Only activates when the superset_press_pull_pairing rule is loaded AND the
    session contains at least one press and one pull exercise.  Accessories
    (non-press/pull) flow into the remaining series slots.
    """
    rule = rules.get("superset_press_pull_pairing")
    if not rule:
        return exercises

    press_tags = set(rule.get("press_tags", PRESS_TAGS))
    pull_tags = set(rule.get("pull_tags", PULL_TAGS))
    press_first = rule.get("press_first", True)

    presses = [ex for ex in exercises if (ex.get("tags") or "") in press_tags]
    pulls = [ex for ex in exercises if (ex.get("tags") or "") in pull_tags]
    others = [ex for ex in exercises
              if (ex.get("tags") or "") not in press_tags | pull_tags]

    if not presses or not pulls:
        return exercises

    remaining_pulls = list(pulls)
    pairs = []
    for press in presses:
        if remaining_pulls:
            pairs.append((press, remaining_pulls.pop(0)))
        else:
            pairs.append((press, None))
    solo_pulls = remaining_pulls

    SERIES = ["A", "B", "C", "D"]
    result = []
    si = 0

    for press, pull in pairs:
        if si >= len(SERIES):
            break
        letter = SERIES[si]
        if press_first:
            press["series_label"] = f"{letter}1"
            result.append(press)
            if pull:
                pull["series_label"] = f"{letter}2"
                result.append(pull)
        else:
            if pull:
                pull["series_label"] = f"{letter}1"
                result.append(pull)
            press["series_label"] = f"{letter}2"
            result.append(press)
        si += 1

    for pull in solo_pulls:
        if si >= len(SERIES):
            break
        pull["series_label"] = f"{SERIES[si]}1"
        result.append(pull)
        si += 1

    for acc in others:
        if si >= len(SERIES):
            acc["series_label"] = "extra"
            result.append(acc)
            continue
        letter = SERIES[si]
        slot = sum(1 for r in result
                   if (r.get("series_label") or "").startswith(letter)) + 1
        acc["series_label"] = f"{letter}{slot}"
        result.append(acc)
        if slot >= 2:
            si += 1

    return result


def _parse_rep_range(rr):
    """'8-10' -> (8, 10).  '3-5' -> (3, 5).  Single number -> (n, n)."""
    if not rr:
        return (8, 10)
    parts = str(rr).split("-")
    try:
        if len(parts) == 2:
            return (int(parts[0]), int(parts[1]))
        return (int(parts[0]), int(parts[0]))
    except ValueError:
        return (8, 10)


def _format_rep_range(low, high):
    if low == high:
        return str(low)
    return f"{low}-{high}"


def _is_c_series_ok(exercise_name, tags):
    """Check if exercise is suitable for C-series (self-sufficient, minimal equipment)."""
    name_lower = exercise_name.lower()
    if any(bad in name_lower for bad in ["hip thrust", "leg press", "leg extension", "leg curl"]):
        return False
    if tags and tags in C_SERIES_BAD_TAGS:
        return False
    return True


def _is_excluded(exercise_name, exercise_id, exclusions, avoid_list):
    """Check if exercise is excluded for this member or on the avoid list."""
    if exercise_id and exercise_id in exclusions:
        return True
    if exercise_name.lower() in {a.lower() for a in avoid_list}:
        return True
    return False


# ── Frequency detection ──────────────────────────────────────────────────────

def detect_sessions_per_week(sessions):
    """Infer sessions-per-week from the member's recent training history.

    Counts distinct day signatures (unique A-series exercise combos) in the
    most recent ~4 weeks of full sessions. Returns 2, 3, or 4.
    """
    sorted_sessions = sorted(
        sessions,
        key=lambda s: s.get("assigned_date") or s.get("day") or "",
        reverse=True,
    )

    full_days = [s for s in sorted_sessions if len(s.get("exercises", [])) >= 3]

    def _day_signature(sess):
        a_names = sorted(
            ex["exercise_name"]
            for ex in sess.get("exercises", [])
            if (ex.get("series_label") or "").upper() in ("A1", "A2")
        )
        return tuple(a_names)

    # Look at the most recent ~16 sessions (roughly 4 weeks) and count unique day patterns
    recent = full_days[:16]
    signatures = set()
    for sess in recent:
        sig = _day_signature(sess)
        if sig:
            signatures.add(sig)

    distinct = len(signatures)
    if distinct >= 4:
        return 4
    elif distinct <= 2:
        return 2
    return 3


# ── Core generator ───────────────────────────────────────────────────────────

def extract_current_program(sessions, sessions_per_week=3):
    """Extract the most recent complete program block with distinct day structures.

    Scans backwards through sessions and collects sessions that each have at
    least 3 exercises and a unique set of A-series exercises (so we get Day 1,
    Day 2, Day 3 — not the same day repeated from different weeks).
    """
    sorted_sessions = sorted(
        sessions,
        key=lambda s: s.get("assigned_date") or s.get("day") or "",
        reverse=True,
    )

    def _day_signature(sess):
        a_names = sorted(
            ex["exercise_name"]
            for ex in sess.get("exercises", [])
            if (ex.get("series_label") or "").upper() in ("A1", "A2")
        )
        return tuple(a_names)

    seen_signatures = set()
    result = []
    for sess in sorted_sessions:
        if len(sess.get("exercises", [])) < 3:
            continue
        sig = _day_signature(sess)
        if sig in seen_signatures:
            continue
        seen_signatures.add(sig)
        result.append(sess)
        if len(result) >= sessions_per_week:
            break

    if len(result) < sessions_per_week:
        full_days = [s for s in sorted_sessions if len(s.get("exercises", [])) >= 3]
        return full_days[:sessions_per_week]

    return result


def generate_next_program(
    sessions,
    exercise_lib,
    phase_result,
    config,
    sessions_per_week=3,
):
    """Generate the next program from the current program and config.

    Returns canonical payload dict: { "sessions": [...] }.
    """
    rules = config["rules"]
    exclusions = set(config.get("exclusions") or [])
    avoid_list = set()
    avoid_rule = rules.get("avoid_exercises_when_possible", {})
    if "exercises" in avoid_rule:
        avoid_list = set(avoid_rule["exercises"])

    next_rep_range = phase_result.get("next_rep_range") or "8-10"
    exercise_behavior = phase_result.get("exercise_behavior", "same_exercises")
    rep_low, rep_high = _parse_rep_range(next_rep_range)

    set_structure = rules.get("set_structures", {}).get("standard", {"a": 3, "b": 3, "c": 2})
    sets_a = set_structure.get("a", 3)
    sets_b = set_structure.get("b", 3)
    sets_c = set_structure.get("c", 2)

    # Accessory rep range: compounds get the scheme range; isolation gets +2 reps
    acc_low = min(rep_low + 2, 12)
    acc_high = min(rep_high + 2, 14)

    current_block = extract_current_program(sessions, sessions_per_week=sessions_per_week)

    if not current_block:
        return {"sessions": [], "error": "No recent sessions found to base program on."}

    new_sessions = []
    for day_idx, old_session in enumerate(current_block, start=1):

        # Phase 1: collect eligible exercises (no sets yet)
        collected = []
        for ex in old_session.get("exercises", []):
            label = ex.get("series_label") or ""
            name = ex.get("exercise_name", "")
            eid = ex.get("exercise_id")
            tags = ex.get("tags")

            if not label or label == "Warm Up":
                continue
            if _is_excluded(name, eid, exclusions, avoid_list):
                continue

            series_letter = label[0].upper() if label else "C"
            if series_letter in ("C", "D") and not _is_c_series_ok(name, tags):
                continue

            info = exercise_lib.get(name) or {}
            collected.append({
                "exercise_name": name,
                "exercise_id": info.get("exercise_id") or eid,
                "series_label": label,
                "tags": tags,
                "_series_assignment": ex.get("series_assignment") or [],
            })

        # Phase 2: apply press/pull superset pairing
        collected = _apply_press_pull_pairing(collected, rules)

        # Phase 3: assign sets based on final series labels
        new_exercises = []
        for ex in collected:
            label = ex["series_label"]
            series_letter = label[0].upper() if label else "C"
            tags = ex.get("tags")
            sa = ex.pop("_series_assignment", [])

            is_compound = (
                tags in (
                    "Horizontal Press", "Vertical Press", "Horizontal Pull",
                    "Vertical Pull", "Lower Body Push", "Lower Body Pull",
                    "Hip Dominant",
                )
                and "A" in sa
            )

            if series_letter == "A":
                num_sets = sets_a
                reps_str = _format_rep_range(rep_low, rep_high)
            elif series_letter == "B" and is_compound:
                num_sets = sets_b
                reps_str = _format_rep_range(rep_low, rep_high)
            elif series_letter == "B":
                num_sets = sets_b
                reps_str = _format_rep_range(acc_low, acc_high)
            else:
                num_sets = sets_c
                reps_str = _format_rep_range(acc_low, acc_high)

            new_exercises.append({
                "exercise_name": ex["exercise_name"],
                "exercise_id": ex["exercise_id"],
                "series_label": label,
                "tags": tags,
                "sets": [
                    {"set_number": i + 1, "reps": reps_str}
                    for i in range(num_sets)
                ],
            })

        new_sessions.append({
            "day": day_idx,
            "exercises": new_exercises,
        })

    return {"sessions": new_sessions}


# ── CLI ──────────────────────────────────────────────────────────────────────

def main():
    import argparse
    import uuid as _uuid

    ap = argparse.ArgumentParser(description="Generate next program for a member")
    ap.add_argument("member_id", help="Member UUID")
    ap.add_argument("--scheme", default="GPP", help="Scheme: GPP, Strength, Hypertrophy")
    ap.add_argument("--sessions-per-week", type=int, default=None, choices=[2, 3, 4],
                    help="Override; auto-detected from history if omitted")
    ap.add_argument("--output", default=None, help="Write JSON to file (default: stdout)")
    ap.add_argument("--pretty", action="store_true", help="Pretty-print JSON")
    args = ap.parse_args()

    sb = get_supabase()

    # 1. Ingest / normalize
    print(f"Fetching data for member {args.member_id}...", file=sys.stderr)
    rows = fetch_results_for_member(sb, args.member_id)
    if not rows:
        print(f"No data for member {args.member_id}", file=sys.stderr)
        sys.exit(1)

    exercise_lib = fetch_exercise_library(sb)
    payload = normalize(rows, exercise_lib)
    sessions = payload["sessions"]
    print(f"Normalised {len(sessions)} sessions.", file=sys.stderr)

    # Auto-detect sessions per week if not overridden
    spw = args.sessions_per_week or detect_sessions_per_week(sessions)
    print(f"Sessions per week: {spw}" + (" (auto-detected)" if not args.sessions_per_week else " (override)"), file=sys.stderr)

    # 2. Phase detection
    phase = detect_phase_for_member(sb, args.member_id, args.scheme, sessions)
    print(f"Phase: current={phase.get('current_rep_range')}, next={phase.get('next_rep_range')}, confidence={phase.get('confidence')}", file=sys.stderr)

    # 3. Load config
    config = load_config(sb, member_id=args.member_id, scheme_name=args.scheme)
    print(f"Config: {len(config['rules'])} rules, {len(config['scheme'])} scheme steps, {len(config['exclusions'])} exclusions.", file=sys.stderr)

    # 4. Generate
    result = generate_next_program(
        sessions,
        exercise_lib,
        phase,
        config,
        sessions_per_week=spw,
    )

    # Attach metadata
    result["metadata"] = {
        "member_id": args.member_id,
        "scheme": args.scheme,
        "current_rep_range": phase.get("current_rep_range"),
        "next_rep_range": phase.get("next_rep_range"),
        "phase_order": phase.get("next_order"),
        "confidence": phase.get("confidence"),
        "exercise_behavior": phase.get("exercise_behavior"),
        "sessions_per_week": spw,
    }

    indent = 2 if args.pretty else None
    out = json.dumps(result, indent=indent, default=str)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(out)
        print(f"Wrote program to {args.output}", file=sys.stderr)
    else:
        print(out)

    # Summary
    for i, sess in enumerate(result.get("sessions", []), 1):
        exs = sess.get("exercises", [])
        print(f"  Day {i}: {len(exs)} exercises", file=sys.stderr)
        for ex in exs:
            n_sets = len(ex.get("sets", []))
            reps = ex["sets"][0]["reps"] if ex.get("sets") else "?"
            print(f"    {ex.get('series_label',''):4s} {ex['exercise_name']:<50s} {n_sets}x{reps}", file=sys.stderr)


if __name__ == "__main__":
    main()
