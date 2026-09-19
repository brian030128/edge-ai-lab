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
  blog/
    index.json           generated listing — run npm run blog:index
    YYYY-MM-DD-slug.zh.md   posts, one file per language
scripts/
  serve.mjs              local preview server
  check-content.mjs      validates content/ and reports the exact field at fault
  build-blog-index.mjs   rebuilds content/blog/index.json from the posts
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
  "id": "chia-ling-wu",
  "name": { "zh": "吳佳玲", "en": "Chia-Ling Wu" },
  "role": { "zh": "碩士班二年級", "en": "Second-year master's student" },
  "focus": [                                  // what they specialise in
    { "zh": "基準測試", "en": "Benchmarking" }
  ],
  "work": { "zh": "…", "en": "…" },           // one or two sentences
  "email": "clwu@example.edu.tw",
  "photo": "",                                // optional; initials are used when empty
  "links": [{ "label": "GitHub", "href": "https://github.com/…" }]
}
```

Groups are whatever you put in `people.json` — the four here are 博士後研究員,
博士班, 碩士班 and 大學部專題生. Rename them, reorder them or add one; the hero
strip, the navigation counts and the roster all follow the file.

### Move someone to alumni

Cut the entry out of its group and add it to `alumni`, with the degree, the year
they left, their thesis title and where they went:

```jsonc
{
  "id": "cheng-hao-shih",
  "name": { "zh": "施承澔", "en": "Cheng-Hao Shih" },
  "degree": { "zh": "博士", "en": "PhD" },
  "year": 2025,
  "thesis": { "zh": "…", "en": "…" },
  "now": { "org": "MediaTek", "role": { "zh": "資深編譯器工程師", "en": "Senior compiler engineer" } }
}
```

The alumni table sorts itself by year. Undergraduates who did a 大學部專題 belong
here too, with `degree` 學士 / BS.

### Add a paper

Append to `content/publications.json`. `themes` must use ids from
`site.json`'s `themes` list — the validator will tell you if one does not exist.
Authors are plain strings; any author whose name matches someone in
`people.json` (current or alumni, 中文 or English) is set in bold automatically,
so there is no separate list of lab authors to keep in sync.

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

## Before this goes live

The content here is placeholder. Replace, in order:

1. `content/site.json` — lab name, institution, statement, the PI's bio,
   research themes, contact details, the openings text.
2. `content/people.json` — everyone. Delete the example people rather than
   editing around them.
3. `content/publications.json` — real papers; the example links point at
   `example.org` and will not resolve.
4. `content/blog/` — delete the three example posts.
5. `site.config.json` — `repo.owner` and `repo.name`, so the footer's edit link
   and `?source=github` work.
6. Portraits: drop images under `content/img/` and set `photo` to
   `img/<file>`. Until then the page draws initials, which is a deliberate
   placeholder rather than a broken image.

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
