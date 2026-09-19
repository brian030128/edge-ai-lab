# Lab page

The lab's website. Every word on it — the PI's bio, the roster, the publication
list, the blog — is a file in this repository. Nobody edits HTML to update the
site; they edit a JSON file or drop in a Markdown post, and the page reads it.

There is no build step, no framework and no dependencies. The repository *is*
the deployable site.

```
npm run serve     # http://localhost:4173
npm run verify    # validate content/ and the blog index
```

Node is only needed for the scripts. The site itself is plain HTML, CSS and ES
modules; any static server will do (`python -m http.server` works fine).

## What is where

```
index.html               page shell: sidebar, language switch, nothing content-specific
site.config.json         where the page reads content from (see below)
assets/
  css/site.css           design tokens first, then every component
  js/app.js              boot, routing (#/ and #/notes/<slug>), event wiring
  js/views.js            one function per section; pure data in, HTML out
  js/source.js           local or GitHub content source, caching, edit links
  js/markdown.js         the blog's Markdown renderer
  js/util.js             escaping, localisation, front matter — shared with the scripts
content/                 everything a lab member ever edits
  site.json              lab identity, PI, research themes, contact and openings
  people.json            current members by group, and the alumni table
  publications.json      papers, with the theme ids used by the filters
  img/                   portraits and any other pictures
  blog/
    index.json           generated listing — run npm run blog:index
    YYYY-MM-DD-slug.zh.md   posts, one file per language
scripts/
  serve.mjs              local preview server
  check-content.mjs      validates content/ and reports the exact field at fault
  build-blog-index.mjs   rebuilds content/blog/index.json from the posts
  import-roster.py       rebuilds people.json from the roster spreadsheet
吳凱強實驗室學生成員.xlsx  the roster as the lab keeps it
.github/
  workflows/pages.yml    validate on every pull request, publish main to Pages
  ISSUE_TEMPLATE/        forms for people who would rather not edit JSON
```

## Reading content out of the repository

`site.config.json` decides where the browser fetches `content/` from.

```jsonc
{
  "source": {
    "mode": "local",              // "local" or "github"
    "local":  { "base": "content" },
    "github": { "path": "content" }
  },
  "repo": { "host": "github.com", "owner": "example-lab", "name": "lab-page", "branch": "main" },
  "cache": { "ttlSeconds": 300 }
}
```

**`local`** — the page reads the copy of `content/` deployed next to it. The site
is a self-contained snapshot; updating it means deploying again. This is the
default and the right choice for GitHub Pages, where a commit redeploys anyway.

**`github`** — the page reads `content/` straight from
`raw.githubusercontent.com/<owner>/<name>/<branch>/`. A commit to that branch
changes the live site with no rebuild and no deploy, which is useful when the
page is hosted somewhere that does not rebuild on push, or when the content
branch is not the branch the site is served from. `repo.owner` and `repo.name`
must be set, and the repository must be public.

Either way `repo` is worth filling in: it is what turns on the "edit this data
on GitHub" link in the footer.

Query overrides, for previewing a change before it is merged:

| URL | Effect |
| --- | --- |
| `?source=github` | read from the configured repository |
| `?source=local` | read the deployed copy |
| `?branch=new-members` | read a different branch |
| `?repo=owner/name` | read a different repository |
| `?fresh=1` | ignore the session cache |

So a student can push a branch and send round
`https://…/?source=github&branch=my-branch` to show what their change looks like.

## Making changes

### Add someone to the roster

Open `content/people.json` and add an entry to the right group. `id` must be
unique — blog posts credit their author by it.

```jsonc
{
  "id": "陳建嘉",                              // unique; blog posts credit authors by it
  "name": { "zh": "陳建嘉", "en": "Jian-Jia Chen" },   // or just "陳建嘉"
  "aliases": ["JJ Chen"],                     // how they appear in author lists
  "since": 2024,                              // shown as "2024 年進入實驗室"
  "focus": ["Speculative decoding", "quantization"],
  "work": "Speculative decoding, kv cache compression, quantization",
  "email": "",
  "photo": "",                                // optional; initials are used when empty
  "links": []
}
```

Groups are whatever you put in the file — 博士班 and 碩士班 at the moment.
Rename them, reorder them or add one, and the hero strip, the counts and the
roster all follow. A group with no members is hidden rather than printed empty,
so adding 大學部專題生 back is one entry whenever there is a 專題生 to put in it.

`import-roster.py` only writes the groups the spreadsheet has, so a group added
by hand has to be re-added after an import. Read `git diff` before committing
an import for exactly this reason.

Someone doing a second degree here takes `stages` in place of `since`, and the
roster prints the progression instead of a single join year:

```jsonc
"stages": [
  { "degree": { "zh": "碩士", "en": "MS" },  "since": 2022, "year": 2024 },
  { "degree": { "zh": "博士", "en": "PhD" }, "since": 2024 }
]
```

A stage with no `year` is the one they are in now — it reads 博士 2024 年起 /
PhD since 2024. Someone still in the lab belongs here and not in the alumni
table, however many degrees they have finished.

Aliases matter because publication lists print initials. Giving 陳建嘉 the alias
"JJ Chen" is what sets that name in bold in the publications section. An alias
belongs to one person; the validator rejects two people claiming the same one.

### Move someone to alumni

Cut the entry out of its group and add it to `alumni`, with the degree, the
years, what they worked on and where they went:

```jsonc
{
  "name": { "zh": "王培碩", "en": "Pei-Shuo Wang" },
  "degree": { "zh": "碩士", "en": "MS" },
  "since": 2023,                     // the table prints "2023-2026"
  "year": 2026,                      // the year they left; the table sorts on it
  "research": "Acceleration for the Inference of Offloaded Large Language Models",
  "focus": ["Speculative Decoding", "quantization"],
  "now": { "org": "UT Austin", "role": { "zh": "博士生", "en": "PhD student" } }
}
```

Someone who stayed through several stages — a master's, then a doctorate, then
a postdoc — is one person with one row. Give them `stages` instead of a single
`degree` and date range:

```jsonc
{
  "name": { "zh": "黃寗琪", "en": "Ning-Chi Huang" },
  "stages": [
    { "degree": { "zh": "碩士", "en": "MS" } },
    { "degree": { "zh": "博士", "en": "PhD" }, "since": 2017, "year": 2021 },
    { "degree": { "zh": "博士後", "en": "Postdoc" } }
  ],
  "now": { "org": { "zh": "成大電機", "en": "NCKU EE" },
           "role": { "zh": "助理教授", "en": "Assistant professor" } }
}
```

The 學位 column prints 碩士 → 博士 → 博士後, and the years column spans from the
earliest start to the latest end. A stage may omit its years; the validator
warns so the gap is visible rather than forgotten.

`degree`, `year` and `now` may all be missing. A roster kept for ten years has
gaps, so the validator warns instead of failing, and rows with no year sort
last. Someone who did a master's here and stayed on for a PhD appears in both
places: give the alias to the current record only.

### Add a paper

Append to `content/publications.json`. `themes` must use ids from the `themes`
list in `site.json` — the validator will tell you if one does not exist.
Authors are plain strings; any author whose name or alias matches someone in
`people.json` is set in bold automatically, so there is no second list of lab
authors to keep in sync.

A paper with no year yet takes a `status` instead, and is listed above the years:

```jsonc
{ "id": "shadowspec", "status": "toappear",   "title": "...", "venue": "..." }
{ "id": "sysarray",   "status": "manuscript", "title": "..." }
```

`toappear` prints under 即將發表, `manuscript` under 手稿, and a manuscript may
omit the venue. Give the entry a `year` when it is published and it moves into
the main list on its own.

### Write a blog post

Create `content/blog/YYYY-MM-DD-slug.zh.md` (or `.en.md`, or both — a post can
exist in one language and the page falls back to the one that exists):

```markdown
---
title: 同一支程式，兩台同型號手機差了 40%
summary: 我們花了三週才發現，問題不在模型，而在桌上那盞燈。
author: chia-ling-wu
tags: 量測, 基準測試
---

Body text. Headings, lists, tables, quotes, fenced code and images all work.
```

Then regenerate the listing:

```
npm run blog:index
```

Commit the post *and* `content/blog/index.json`. CI fails if they disagree.

### Change the look

Everything visual comes from the tokens at the top of `assets/css/site.css` —
five colours, two typefaces, one spacing scale, and a dark palette that mirrors
them. Changing `--seal` recolours every mark of state on the site; changing
`--ink` and `--paper` changes its temperature. The type scale is the only other
thing worth touching.

## Validation

```
npm run check       # content/ is well formed and internally consistent
npm run blog:check  # blog/index.json matches the posts on disk
npm run verify      # both
```

`check-content.mjs` reports the file and the field, not a stack trace:

```
  error    content/publications.json → items[3].themes[0]: "edge" is not a theme id in site.json
  warning  content/people.json → groups[2].members[1].focus: no specialisation listed
```

It checks that ids are unique, that every localised field has at least one
language, that years are years, that links are links, that publication themes
exist, and that a blog post's author is a real person id. Warnings do not fail
the build; errors do.

## Publishing

The workflow in `.github/workflows/pages.yml` validates content on every pull
request and publishes `main` to GitHub Pages. Turn on Pages for the repository
with **Settings → Pages → Source: GitHub Actions**, and the site is live at
`https://<owner>.github.io/<name>/`.

Because the repository is the site, any static host works too: copy the whole
directory. Do not "build" it.

## Updating the roster from the spreadsheet

The lab keeps its roster in `吳凱強實驗室學生成員.xlsx`. After editing it:

```
python scripts/import-roster.py
npm run check
git diff content/people.json     # read this before committing
```

A name that appears in both sheets is treated as a current member and left out
of the alumni table — someone who finished a master's here and came back for a
doctorate has not left. The importer prints those names so the decision is
visible; record the earlier degree as a stage on their current entry.

The importer rewrites `people.json` from the two sheets and preserves what the
spreadsheet does not carry: English names, author aliases, `stages`, and a job
title typed in by hand (kept only while the organisation stays the same — if
someone moves, the new destination wins).
Undergraduates are not in the spreadsheet either, so add them to `people.json`
by hand — the importer leaves that group untouched.

## Pictures

Put them in `content/img/` and reference them as `img/<file>`, for example
`"photo": "img/pi.jpg"`. Paths are resolved against whichever content source is
in use, so the same value works locally and when reading from GitHub; absolute
URLs are left alone. Resize before committing — a portrait shows at about 300px
wide, so a 800px-wide JPEG is plenty.

Anyone with no `photo` gets their initials in a ruled frame. That is a
deliberate placeholder, not a missing image.

## Still to fill in

- `content/site.json` — the lab email, the PI's email, office and room number,
  and links for the PI (department profile, Scholar). Empty fields are hidden
  rather than printed blank, so the contact list stays tidy meanwhile.
- `content/people.json` — `npm run check` lists the real gaps as warnings:
  students with no specialisation recorded, alumni with no destination or no
  year, and the two research assistants with no dates.
- `content/blog/` — empty. The section shows its empty state until the first
  post lands.

## Notes

- Two languages throughout. Any text field can be `"plain string"` or
  `{ "zh": "…", "en": "…" }`; the switch in the sidebar picks one and falls
  back to the other when a translation is missing.
- Everything from `content/` is escaped before it reaches the page, including
  Markdown, so a stray `<script>` in a post renders as text.
- Dark mode follows the operating system. Reduced-motion preferences are
  respected — the one animation on the page is the cohort strip filling in.
- Requires a browser with ES modules and `IntersectionObserver`: anything from
  2018 onward.

MIT for the code in `assets/` and `scripts/`. The contents of `content/` are the
lab's own.
