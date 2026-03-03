#!/usr/bin/env python3
"""
Load engine config for a member: programming_rules, progression scheme, and exclusions.

Returns a dict ready for the generator:
  {
    "rules":       { rule_key: rule_value_dict, ... },
    "scheme":      [ { from_rep_range, to_rep_range, order, exercise_behavior }, ... ],
    "exclusions":  [ exercise_id, ... ],
  }

Can be used as a library (import load_config) or standalone (prints JSON).

Usage:
  python tools/load_rules.py --member-id <uuid> --scheme Strength
  python tools/load_rules.py                                       # rules only, no member-specific data

Requires: pip install supabase python-dotenv
"""

import json
import os
import sys
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:
    pass


def _get_supabase():
    url = (os.environ.get("SUPABASE_URL") or "").strip().strip('"\'')
    key = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_ANON_KEY") or "").strip().strip('"\'')
    if not url or not key:
        print("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env", file=sys.stderr)
        sys.exit(1)
    from supabase import create_client
    return create_client(url, key)


def load_rules(supabase, gym=None):
    """Load active programming_rules. Returns dict keyed by rule_key."""
    q = supabase.table("programming_rules").select("*").eq("active", True)
    r = q.execute()
    rules = {}
    for row in (r.data or []):
        row_gym = row.get("gym")
        if row_gym is not None and gym is not None and row_gym != gym:
            continue
        key = row["rule_key"]
        val = row.get("rule_value") or {}
        if isinstance(val, str):
            val = json.loads(val)
        rules[key] = {
            "name": row.get("name"),
            "category": row.get("category"),
            "priority": row.get("priority", 0),
            **val,
        }
    return rules


def load_scheme(supabase, scheme_name):
    """Load progression scheme rows for a given scheme name, ordered by step."""
    r = (
        supabase.table("programming_progression_schemes")
        .select("*")
        .eq("name", scheme_name)
        .eq("active", True)
        .order('"order"')
        .execute()
    )
    rows = r.data or []
    if not rows:
        raise ValueError(f"Scheme '{scheme_name}' not found or inactive.")
    return [
        {
            "order": row["order"],
            "from_rep_range": row["from_rep_range"],
            "to_rep_range": row["to_rep_range"],
            "exercise_behavior": row["exercise_behavior"],
        }
        for row in rows
    ]


def load_exclusions(supabase, member_id):
    """Load active exercise exclusions for a member. Returns list of exercise_ids."""
    r = (
        supabase.table("programming_exercise_exclusions")
        .select("exercise_id")
        .eq("member_id", member_id)
        .eq("active", True)
        .execute()
    )
    return [row["exercise_id"] for row in (r.data or [])]


def load_config(supabase, member_id=None, scheme_name="GPP", gym=None):
    """Load full engine config bundle for a member."""
    rules = load_rules(supabase, gym=gym)
    scheme = load_scheme(supabase, scheme_name)
    exclusions = load_exclusions(supabase, member_id) if member_id else []
    return {
        "rules": rules,
        "scheme": scheme,
        "exclusions": exclusions,
    }


def main():
    import argparse
    ap = argparse.ArgumentParser(description="Load engine rules/config for a member")
    ap.add_argument("--member-id", default=None, help="Member UUID (for exclusions)")
    ap.add_argument("--scheme", default="GPP", help="Scheme name: GPP, Strength, Hypertrophy (default GPP)")
    ap.add_argument("--gym", default=None, help="Gym filter (optional)")
    args = ap.parse_args()

    sb = _get_supabase()
    config = load_config(sb, member_id=args.member_id, scheme_name=args.scheme, gym=args.gym)

    print(json.dumps(config, indent=2, default=str))
    print(f"\nLoaded: {len(config['rules'])} rules, {len(config['scheme'])} scheme steps, {len(config['exclusions'])} exclusions", file=sys.stderr)


if __name__ == "__main__":
    main()
