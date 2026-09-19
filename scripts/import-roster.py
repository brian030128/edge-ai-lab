#!/usr/bin/env python3
"""Regenerate content/people.json from the roster spreadsheet.

The lab keeps its roster in 吳凱強實驗室學生成員.xlsx. This reads that file
directly (no dependencies — an .xlsx is a zip of XML) and rewrites people.json,
preserving the English names and author aliases already recorded there, since
those are not in the spreadsheet.

    python scripts/import-roster.py [path/to/roster.xlsx]

Expected sheets and columns:
    current members    name | pursuing_degree | year_in | research direction | key skills
    graduated students name | where_to_go | degree | year_in | year_out | research direction | key skills

Always run `npm run check` afterwards, then read the diff before committing.
"""

import json, re, sys, zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BOOK = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "吳凱強實驗室學生成員.xlsx"
OUT = ROOT / "content" / "people.json"
M = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"

DEGREE = {
    "phd degree": {"zh": "博士", "en": "PhD"},
    "master degree": {"zh": "碩士", "en": "MS"},
    "research assistant": {"zh": "研究助理", "en": "Research assistant"},
}


def read_rows(book, sheet):
    z = zipfile.ZipFile(book)
    shared = [
        "".join(t.text or "" for t in si.iter(M + "t"))
        for si in ET.fromstring(z.read("xl/sharedStrings.xml")).iter(M + "si")
    ]
    rows = []
    for row in ET.fromstring(z.read(f"xl/worksheets/sheet{sheet}.xml")).iter(M + "row"):
        cells = {}
        for c in row.iter(M + "c"):
            col = "".join(ch for ch in c.get("r", "") if ch.isalpha())
            v, is_ = c.find(M + "v"), c.find(M + "is")
            if c.get("t") == "s" and v is not None:
                val = shared[int(v.text)]
            elif is_ is not None:
                val = "".join(x.text or "" for x in is_.iter(M + "t"))
            elif v is not None:
                val = v.text
            else:
                continue
            if val:
                cells[col] = val
        if cells:
            rows.append(cells)
    return rows[1:]  # drop the header row


def clean(v):
    return re.sub(r"\s+", " ", str(v or "")).strip()


def year(v):
    try:
        return int(float(clean(v)))
    except ValueError:
        return None


def text(v):
    t = clean(v)
    return "" if t.upper() == "TBA" else t


def tags(v):
    seen = []
    for t in re.split(r"[,、]", clean(v)):
        t = t.strip()
        if t and t.upper() != "TBA" and t not in seen:
            seen.append(t)
    return seen


def destination(v):
    """'聯發科技 (MediaTek)' -> bilingual org; '博士生@Cornell' -> org plus role."""
    s = clean(v)
    if not s:
        return None
    m = re.match(r"^(.*?)@(.+)$", s)
    if m:
        role = m.group(1).strip()
        return {"org": m.group(2).strip(),
                "role": {"zh": role, "en": "PhD student" if "博士生" in role else role}}
    m = re.match(r"^(.+?)\s*\(([^)]+)\)$", s)
    if m:
        return {"org": {"zh": m.group(1).strip(), "en": m.group(2).strip()}}
    return {"org": s}


def previous_extras():
    """Keep what the spreadsheet does not carry: English names, author aliases,
    and the stages of anyone who passed through the lab more than once."""
    if not OUT.exists():
        return {}
    old = json.loads(OUT.read_text(encoding="utf-8"))
    extras = {}
    def take(p):
        name = p.get("name")
        zh = name if isinstance(name, str) else (name or {}).get("zh", "")
        role = (p.get("now") or {}).get("role")
        if not zh or not (isinstance(name, dict) or p.get("aliases") or p.get("stages") or role):
            return
        kept = extras.setdefault(zh, {"name": name, "aliases": None, "stages": None, "now": None})
        if isinstance(name, dict):
            kept["name"] = name
        # Someone can appear twice (a master's alumnus who stayed for a PhD).
        # Aliases belong to one record only, or author highlighting is ambiguous.
        if p.get("aliases") and not kept["aliases"]:
            kept["aliases"] = p["aliases"]
        if p.get("stages") and not kept["stages"]:
            kept["stages"] = p["stages"]
        if role and not kept["now"]:
            kept["now"] = p["now"]
    for g in old.get("groups", []):
        for m in g.get("members", []):
            take(m)
    for a in old.get("alumni", []):
        take(a)
    return extras


def restore(entry, extras):
    zh = entry["name"] if isinstance(entry["name"], str) else entry["name"].get("zh")
    kept = extras.get(zh)
    if not kept:
        return
    entry["name"] = kept["name"]
    if kept.get("aliases"):
        entry["aliases"] = kept.pop("aliases")  # first record to ask keeps them
    if kept.get("stages"):
        # Stages replace the single degree and date range the sheet provides.
        entry["stages"] = kept["stages"]
        for gone in ("degree", "since", "year"):
            entry.pop(gone, None)

    # The spreadsheet records where someone went, but not what they do there.
    # Keep a job title that was filled in by hand, unless they have since moved.
    old_now = kept.get("now") or {}
    new_now = entry.get("now") or {}
    same_org = json.dumps(old_now.get("org"), sort_keys=True, ensure_ascii=False) ==                json.dumps(new_now.get("org"), sort_keys=True, ensure_ascii=False)
    if old_now.get("role") and new_now and same_org:
        new_now["role"] = old_now["role"]
        if old_now.get("href") and not new_now.get("href"):
            new_now["href"] = old_now["href"]


def main():
    extras = previous_extras()
    phd, masters = [], []
    for row in read_rows(BOOK, 1):
        name = clean(row.get("A"))
        if not name:
            continue
        m = {"id": name, "name": name}
        if year(row.get("C")):
            m["since"] = year(row.get("C"))
        if tags(row.get("E")):
            m["focus"] = tags(row.get("E"))
        if text(row.get("D")):
            m["work"] = text(row.get("D"))
        m["links"] = []
        restore(m, extras)
        (phd if clean(row.get("B")).lower() == "phd degree" else masters).append(m)

    current_names = {m["name"] if isinstance(m["name"], str) else m["name"]["zh"]
                     for m in phd + masters}

    alumni, returning = [], []
    for row in read_rows(BOOK, 2):
        name = clean(row.get("A"))
        if not name:
            continue
        # Someone who finished a degree here and came back for another is a
        # current member, not an alumnus. Record the earlier degree as a stage
        # on their current entry instead.
        if name in current_names:
            returning.append(name)
            continue
        a = {"name": name}
        d = DEGREE.get(clean(row.get("C")).lower())
        if d:
            a["degree"] = d
        if year(row.get("D")):
            a["since"] = year(row.get("D"))
        if year(row.get("E")):
            a["year"] = year(row.get("E"))
        if text(row.get("F")):
            a["research"] = text(row.get("F"))
        if tags(row.get("G")):
            a["focus"] = tags(row.get("G"))
        if destination(row.get("B")):
            a["now"] = destination(row.get("B"))
        restore(a, extras)
        alumni.append(a)

    people = {
        "groups": [
            {"id": "phd", "label": {"zh": "博士班", "en": "Doctoral students"}, "members": phd},
            {"id": "masters", "label": {"zh": "碩士班", "en": "Master's students"}, "members": masters},
        ],
        "alumni": alumni,
    }
    OUT.write_text(json.dumps(people, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUT.relative_to(ROOT)} — {len(phd)} PhD, {len(masters)} master's, {len(alumni)} alumni.")
    print("Groups that are not in the spreadsheet must be re-added to people.json by hand.")
    if returning:
        print("Still in the lab, so left out of the alumni table: " + ", ".join(returning))


if __name__ == "__main__":
    main()
