#!/usr/bin/env python3
"""
Append a new technical-debt item to docs/TECHNICAL-REVIEW.md.

Usage:
  python tools/add_technical_debt.py "Title of the debt" "Debt description." "Proposed solution."
  python tools/add_technical_debt.py   # interactive prompts

The new item is added as the next ### 2.N subsection before "## 3. Summary".
"""

import re
import sys
from pathlib import Path


DOC_NAME = "TECHNICAL-REVIEW.md"


def find_next_debt_number(content: str) -> int:
    """Find the highest ### 2.N and return N+1."""
    pattern = re.compile(r"^### 2\.(\d+)\s", re.MULTILINE)
    matches = pattern.findall(content)
    if not matches:
        return 1
    return max(int(m) for m in matches) + 1


def add_debt_section(content: str, number: int, title: str, debt: str, solution: str) -> str:
    """Insert a new ### 2.N subsection before '## 3. Summary'."""
    new_section = f"""
---

### 2.{number} {title}

**Debt:** {debt}

**Solution:** {solution}

---
"""
    # Insert before "## 3. Summary"
    marker = "## 3. Summary"
    if marker not in content:
        return content + new_section + "\n## 3. Summary\n"
    idx = content.index(marker)
    return content[:idx] + new_section + "\n" + content[idx:]


def main() -> None:
    repo_root = Path(__file__).resolve().parent.parent
    doc_path = repo_root / "docs" / DOC_NAME

    if not doc_path.exists():
        print(f"Error: {doc_path} not found.", file=sys.stderr)
        sys.exit(1)

    if len(sys.argv) >= 4:
        title = sys.argv[1]
        debt = sys.argv[2]
        solution = sys.argv[3]
    else:
        title = input("Title (short, e.g. 'Indexes missing'): ").strip()
        debt = input("Debt (description): ").strip()
        solution = input("Solution (proposed fix): ").strip()
        if not title or not debt or not solution:
            print("All three fields are required.", file=sys.stderr)
            sys.exit(1)

    content = doc_path.read_text(encoding="utf-8")
    next_num = find_next_debt_number(content)
    new_content = add_debt_section(content, next_num, title, debt, solution)
    doc_path.write_text(new_content, encoding="utf-8")
    print(f"Added ### 2.{next_num} {title} to docs/{DOC_NAME}")


if __name__ == "__main__":
    main()
