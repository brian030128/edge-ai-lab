# Contributing

This is the lab's website. Everyone in the lab can change it, and most changes
are one line in one file.

## If you would rather not touch JSON

Open an issue. There are forms for the three common cases:

- **New lab member** — you joined, or you are adding someone who did
- **New publication** — a paper was accepted
- **Alumni update** — you graduated and started somewhere new

Whoever is maintaining the site that term will turn it into a commit. This is a
perfectly good way to contribute; nobody is judged for using the form.

## If you are editing the files

1. Make a branch. `git switch -c add-<what>`.
2. Edit the file under `content/`. The [README](README.md) shows the shape of
   each entry, and the file already contains examples to copy.
3. Run `npm run verify`. It prints the file and field of anything wrong.
4. Preview it: `npm run serve`, then open <http://localhost:4173>.
5. Open a pull request. CI runs the same checks.

For a blog post, also run `npm run blog:index` and commit the regenerated
`content/blog/index.json` alongside the post.

## Previewing a branch without merging

Push the branch and send people this link:

```
https://<the site>/?source=github&branch=<your-branch>
```

The page will read `content/` from that branch instead of the deployed copy.
This works for anyone, on any device, with no checkout.

## Review

Content changes — a new member, a paper, an alumni update, a post — need one
approving review and a green check. Approve someone else's the same day if you
can; a roster that is three months stale is worse than a typo.

Changes to `assets/` or `scripts/` should say in the pull request what they
change visually or structurally, and ideally include a before/after screenshot
at both a desktop and a phone width.

## House rules for the content

- Write names in both 中文 and English where the person has both. If someone
  only wants one, use one — the page falls back cleanly.
- Keep `work` and `summary` fields to one or two sentences. They are read in a
  list, not in isolation.
- Say what a person actually does, in words a new student would understand.
  "Distributed training" beats "cutting-edge scalable ML infrastructure".
- Do not add someone's photograph, phone number or personal email without
  asking them first. Initials are the default for a reason.
- Alumni entries are about where people went, not how they left. Keep them
  factual and current.

## Who owns what

The content is the lab's. The code under `assets/` and `scripts/` is MIT
licensed; if another lab wants to reuse the scaffolding, point them at it.
