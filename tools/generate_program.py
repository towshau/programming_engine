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
    "Lower Body Pull", "Hip Dominant", "Plyometric",
}
WARMUP_ONLY_TAGS = {"Mobility", "Plyometric", "Rehab", "External Rotation"}
AVOID_EXERCISES_DEFAULT = {"walking lunges", "farmer carries"}

PRESS_TAGS = {"Vertical Press", "Horizontal Press"}
PULL_TAGS = {"Vertical Pull", "Horizontal Pull"}

LOWER_BODY_TAGS = {"Lower Body Push", "Lower Body Pull", "Hip Dominant", "Hip Abduction", "Lower Leg"}
UPPER_BODY_TAGS = {
    "Horizontal Press", "Vertical Press", "Horizontal Pull", "Vertical Pull",
    "Dip", "Lateral & Front Raise", "Elbow Flexion", "Elbow Extension",
}
SERIES_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"]


def _get_priority_tier(tags, rules):
    """Return tier number (1=highest) for exercise by tag; higher tier = placed first."""
    rule = rules.get("exercise_priority", {})
    order = rule.get("priority_order") or []
    tag = tags or ""
    for i, entry in enumerate(order):
        if tag in (entry.get("tags") or []):
            return entry.get("tier", 99)
    return 99


def _sort_by_priority(exercises, rules):
    """Sort exercises by global priority tier so compounds get A/B slots first."""
    return sorted(exercises, key=lambda ex: _get_priority_tier(ex.get("tags"), rules))


def _detect_session_type(exercises):
    """Classify session as upper, lower, or full based on tag majority."""
    lower_count = sum(1 for ex in exercises if (ex.get("tags") or "") in LOWER_BODY_TAGS)
    upper_count = sum(1 for ex in exercises if (ex.get("tags") or "") in UPPER_BODY_TAGS)
    total = len(exercises)
    if total == 0:
        return "upper"
    if lower_count > upper_count and lower_count >= total / 2:
        return "lower"
    if upper_count > lower_count and upper_count >= total / 2:
        return "upper"
    return "full"


def _apply_lower_body_pairing(exercises, rules):
    """Pair lower body push + pull (or hip dominant) in A/B supersets.

    Push-led: A1=Push, A2=Pull, B1=Push, B2=Accessory. Pull-led: A1=Pull, A2=Pull, B1=Push, B2=Accessory.
    """
    rule = rules.get("superset_lower_body_pairing")
    if not rule:
        return exercises

    push_tags = set(rule.get("push_tags", ["Lower Body Push"]))
    pull_tags = set(rule.get("pull_tags", ["Lower Body Pull", "Hip Dominant"]))
    accessory_tags = set(rule.get("accessory_tags", ["Hip Abduction", "Lower Leg", "Hip Flexion"]))
    push_first = rule.get("push_first", True)

    pushes = [ex for ex in exercises if (ex.get("tags") or "") in push_tags]
    pulls = [ex for ex in exercises if (ex.get("tags") or "") in pull_tags]
    accessories = [ex for ex in exercises
                   if (ex.get("tags") or "") in accessory_tags
                   or (ex.get("tags") or "") not in push_tags | pull_tags | accessory_tags
                   and ex.get("tags")]

    # Determine push-led vs pull-led from first compound in original order
    first_compound_tag = None
    for ex in exercises:
        t = ex.get("tags") or ""
        if t in push_tags or t in pull_tags:
            first_compound_tag = t
            break
    lead_is_push = first_compound_tag in push_tags if first_compound_tag else True

    remaining_pulls = list(pulls)
    pairs = []
    for push in pushes:
        if remaining_pulls:
            pairs.append((push, remaining_pulls.pop(0)))
        else:
            pairs.append((push, None))
    solo_pulls = remaining_pulls

    result = []
    si = 0

    if lead_is_push and push_first:
        for push, pull in pairs:
            if si >= len(SERIES_LETTERS):
                break
            letter = SERIES_LETTERS[si]
            push["series_label"] = f"{letter}1"
            result.append(push)
            if pull:
                pull["series_label"] = f"{letter}2"
                result.append(pull)
            si += 1
        for pull in solo_pulls:
            if si >= len(SERIES_LETTERS):
                break
            pull["series_label"] = f"{SERIES_LETTERS[si]}1"
            result.append(pull)
            si += 1
    else:
        # Pull-led: A1=A2=Pulls, B1=Push B2=Accessory, then more pulls/pushes
        for i in range(0, len(pulls), 2):
            if si >= len(SERIES_LETTERS):
                break
            letter = SERIES_LETTERS[si]
            result.append(pulls[i])
            pulls[i]["series_label"] = f"{letter}1"
            if i + 1 < len(pulls):
                result.append(pulls[i + 1])
                pulls[i + 1]["series_label"] = f"{letter}2"
            si += 1
        for push in pushes:
            if si >= len(SERIES_LETTERS):
                break
            letter = SERIES_LETTERS[si]
            push["series_label"] = f"{letter}1"
            result.append(push)
            if accessories:
                acc = accessories.pop(0)
                acc["series_label"] = f"{letter}2"
                result.append(acc)
            si += 1
        for pull in solo_pulls:
            if si >= len(SERIES_LETTERS):
                break
            pull["series_label"] = f"{SERIES_LETTERS[si]}1"
            result.append(pull)
            si += 1

    for acc in accessories:
        if si >= len(SERIES_LETTERS):
            acc["series_label"] = "extra"
            result.append(acc)
            continue
        letter = SERIES_LETTERS[si]
        slot = sum(1 for r in result if (r.get("series_label") or "").startswith(letter)) + 1
        acc["series_label"] = f"{letter}{slot}"
        result.append(acc)
        if slot >= 2:
            si += 1

    return result


def _enforce_series_eligibility(exercises, exercise_lib):
    """Ensure each exercise's series_label is within its series_assignment. Bump or drop violations."""
    allowed_ab = []
    allowed_bc = []
    allowed_cd = []
    overflow = []
    for ex in exercises:
        name = ex.get("exercise_name", "")
        label = ex.get("series_label") or ""
        if label == "extra":
            overflow.append(ex)
            continue
        letter = label[0].upper() if label else "C"
        info = exercise_lib.get(name) or {}
        sa = info.get("series_assignment") or ex.get("_series_assignment") or []
        if not sa:
            allowed_cd.append(ex)
            continue
        sa_set = set(str(s).upper() for s in sa if s)
        if sa_set == {"WARM UP"}:
            continue
        if "A" in sa_set:
            if letter in ("A", "B"):
                allowed_ab.append(ex)
            else:
                ex["series_label"] = "A1"
                allowed_ab.append(ex)
        elif "B" in sa_set:
            allowed_bc.append(ex)
        elif "C" in sa_set or "D" in sa_set:
            if letter in ("C", "D", "E", "F", "G", "H"):
                allowed_cd.append(ex)
            else:
                ex["series_label"] = "C1"
                allowed_cd.append(ex)
        else:
            allowed_bc.append(ex)

    # Reassign series letters: A-only get A,B; B/C get B,C; C/D get C,D,E...
    result = []
    si = 0
    for ex in allowed_ab:
        if si >= 2:
            overflow.append(ex)
            continue
        letter = SERIES_LETTERS[si]
        slot = sum(1 for r in result if (r.get("series_label") or "").startswith(letter)) + 1
        ex["series_label"] = f"{letter}{slot}"
        result.append(ex)
        if slot >= 2:
            si += 1
    si = 1
    for ex in allowed_bc:
        if si >= len(SERIES_LETTERS):
            ex["series_label"] = "extra"
            result.append(ex)
            continue
        letter = SERIES_LETTERS[si]
        slot = sum(1 for r in result if (r.get("series_label") or "").startswith(letter)) + 1
        ex["series_label"] = f"{letter}{slot}"
        result.append(ex)
        if slot >= 2:
            si += 1
    si = 2
    for ex in allowed_cd:
        if si >= len(SERIES_LETTERS):
            ex["series_label"] = "extra"
            result.append(ex)
            continue
        letter = SERIES_LETTERS[si]
        slot = sum(1 for r in result if (r.get("series_label") or "").startswith(letter)) + 1
        ex["series_label"] = f"{letter}{slot}"
        result.append(ex)
        if slot >= 2:
            si += 1
    for ex in overflow:
        ex["series_label"] = "extra"
        result.append(ex)
    return result


def _apply_downgrade_to_b(exercises, rules):
    """Move exercises on the prefer_b_series_and_beyond list from A to B (and shift existing B)."""
    rule = rules.get("prefer_b_series_and_beyond", {})
    names = rule.get("exercise_names") or []
    if not names:
        return exercises
    name_lower = [n.lower() for n in names]
    in_a = [ex for ex in exercises if (ex.get("series_label") or "").upper().startswith("A")
            and any(sub in (ex.get("exercise_name") or "").lower() for sub in name_lower)]
    if not in_a:
        return exercises
    in_b = [ex for ex in exercises if (ex.get("series_label") or "").upper().startswith("B")]
    others = [ex for ex in exercises if ex not in in_a and ex not in in_b]
    k = len(in_a)
    for i, ex in enumerate(sorted(in_a, key=lambda e: e.get("series_label") or "")):
        ex["series_label"] = f"B{i + 1}"
    for i, ex in enumerate(sorted(in_b, key=lambda e: e.get("series_label") or "")):
        ex["series_label"] = f"B{k + i + 1}"
    def _slot_key(e):
        lab = (e.get("series_label") or "Z1")
        letter = lab[0] if lab else "Z"
        num = int(lab[1:]) if len(lab) > 1 and lab[1:].isdigit() else 0
        li = SERIES_LETTERS.index(letter) if letter in SERIES_LETTERS else 99
        return (li, num)
    result = in_a + in_b + others
    result.sort(key=_slot_key)
    return result


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

    result = []
    si = 0

    for press, pull in pairs:
        if si >= len(SERIES_LETTERS):
            break
        letter = SERIES_LETTERS[si]
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
        if si >= len(SERIES_LETTERS):
            break
        pull["series_label"] = f"{SERIES_LETTERS[si]}1"
        result.append(pull)
        si += 1

    for acc in others:
        if si >= len(SERIES_LETTERS):
            acc["series_label"] = "extra"
            result.append(acc)
            continue
        letter = SERIES_LETTERS[si]
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
    most recent ~4 weeks of full sessions. Returns 1 through 6.
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
    return max(1, min(distinct, 6))


def resolve_sessions_per_week(sessions, cli_override=None, stored_from_row=None):
    """Pick sessions/week for generation: CLI override, then DB/metadata, else detect."""
    if cli_override is not None and 1 <= cli_override <= 6:
        return cli_override
    if stored_from_row is not None:
        try:
            v = int(stored_from_row)
            if 1 <= v <= 6:
                return v
        except (TypeError, ValueError):
            pass
    return detect_sessions_per_week(sessions)


# ── Source: programming_generated vs tbresults ───────────────────────────────

def fetch_latest_generated_program(supabase, member_id):
    """Fetch the most recent programming_generated row for this member.

    Returns ``{"sessions": [...], "sessions_per_week": int|None}`` or None if no row.
    ``sessions_per_week`` is taken from the row column when 2–4, else from
    ``payload.metadata.sessions_per_week``. Used so coach/batch-sync truth carries forward.
    """
    r = (
        supabase.table("programming_generated")
        .select("payload, sessions_per_week")
        .eq("member_id", member_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not r.data or len(r.data) == 0:
        return None
    row = r.data[0]
    payload = row.get("payload") or {}
    sessions = payload.get("sessions") or []
    if not sessions:
        return None
    raw_spw = row.get("sessions_per_week")
    spw = None
    if raw_spw is not None:
        try:
            spw = int(raw_spw)
        except (TypeError, ValueError):
            spw = None
    if spw is None or not (1 <= spw <= 6):
        meta = payload.get("metadata") or {}
        m = meta.get("sessions_per_week")
        try:
            m = int(m) if m is not None else None
        except (TypeError, ValueError):
            m = None
        spw = m if (m is not None and 1 <= m <= 6) else None
    return {"sessions": sessions, "sessions_per_week": spw}


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

            if not label or label == "Warm Up" or label.upper().startswith("WU"):
                continue
            if _is_excluded(name, eid, exclusions, avoid_list):
                continue

            info = exercise_lib.get(name) or {}
            sa = ex.get("series_assignment") or info.get("series_assignment") or []
            sa_upper = {str(s).upper() for s in sa if s}

            if sa_upper == {"WARM UP"}:
                continue

            series_letter = label[0].upper() if label else "C"
            if series_letter in ("C", "D") and not _is_c_series_ok(name, tags):
                continue

            collected.append({
                "exercise_name": name,
                "exercise_id": info.get("exercise_id") or eid,
                "series_label": label,
                "tags": tags,
                "_series_assignment": sa,
            })

        # Phase 2: sort by global priority (compounds first)
        collected = _sort_by_priority(collected, rules)

        # Phase 3: apply pairing by session type
        session_type = _detect_session_type(collected)
        if session_type == "upper":
            collected = _apply_press_pull_pairing(collected, rules)
        elif session_type == "lower":
            collected = _apply_lower_body_pairing(collected, rules)
        else:
            upper = [ex for ex in collected if (ex.get("tags") or "") in UPPER_BODY_TAGS
                     or (ex.get("tags") or "") in PRESS_TAGS or (ex.get("tags") or "") in PULL_TAGS]
            lower = [ex for ex in collected if (ex.get("tags") or "") in LOWER_BODY_TAGS]
            other = [ex for ex in collected if ex not in upper and ex not in lower]
            upper = _apply_press_pull_pairing(upper + other, rules) if (upper or other) else []
            lower = _apply_lower_body_pairing(lower, rules) if lower else []
            relabel_map = {"A": "C", "B": "D", "C": "E", "D": "F", "E": "G", "F": "H", "G": "H", "H": "H"}
            for ex in lower:
                lab = ex.get("series_label") or ""
                if len(lab) >= 1 and lab[0] in relabel_map:
                    ex["series_label"] = relabel_map[lab[0]] + lab[1:]
            collected = upper + lower

        # Phase 3b: move prefer_b_series_and_beyond exercises from A to B
        collected = _apply_downgrade_to_b(collected, rules)

        # Phase 4: enforce series_assignment bounds (bump/drop violations)
        collected = _enforce_series_eligibility(collected, exercise_lib)

        # Phase 5: assign sets based on final series labels
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
                "row_id": str(uuid.uuid4()),
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
    ap.add_argument("--sessions-per-week", type=int, default=None, choices=[1, 2, 3, 4, 5, 6],
                    help="Override; auto-detected from history if omitted")
    ap.add_argument("--output", default=None, help="Write JSON to file (default: stdout)")
    ap.add_argument("--pretty", action="store_true", help="Pretty-print JSON")
    args = ap.parse_args()

    sb = get_supabase()
    exercise_lib = fetch_exercise_library(sb)

    # 1. Ingest: prefer latest programming_generated; fallback to member_tbresults
    gen = fetch_latest_generated_program(sb, args.member_id)
    stored_spw = None
    if gen:
        sessions = gen["sessions"]
        stored_spw = gen.get("sessions_per_week")
        print(f"Using {len(sessions)} sessions from programming_generated (latest row).", file=sys.stderr)
    else:
        print(f"Fetching data for member {args.member_id} from member_tbresults...", file=sys.stderr)
        rows = fetch_results_for_member(sb, args.member_id)
        if not rows:
            print(f"No data for member {args.member_id}", file=sys.stderr)
            sys.exit(1)
        payload = normalize(rows, exercise_lib)
        sessions = payload["sessions"]
        print(f"Normalised {len(sessions)} sessions from tbresults.", file=sys.stderr)

    # Phase detection always uses tbresults (actual logged reps)
    rows_tb = fetch_results_for_member(sb, args.member_id)
    sessions_tb = normalize(rows_tb, exercise_lib)["sessions"] if rows_tb else []

    spw = resolve_sessions_per_week(
        sessions,
        cli_override=args.sessions_per_week,
        stored_from_row=stored_spw,
    )
    if args.sessions_per_week in range(1, 7):
        spw_note = "override"
    elif stored_spw in range(1, 7) and spw == stored_spw:
        spw_note = "from latest programming_generated row"
    else:
        spw_note = "auto-detected"
    print(f"Sessions per week: {spw} ({spw_note})", file=sys.stderr)

    # 2. Phase detection (uses tbresults so next rep range reflects what member actually did)
    phase = detect_phase_for_member(sb, args.member_id, args.scheme, sessions_tb) if sessions_tb else detect_phase_for_member(sb, args.member_id, args.scheme, sessions)
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
