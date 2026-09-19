#!/usr/bin/env node
// Regenerate content/blog/index.json from the Markdown files beside it.
//
// Post files are named  YYYY-MM-DD-slug.md  or  YYYY-MM-DD-slug.<lang>.md
// so a post can exist in one language or both. Everything the listing needs
// lives in each file's front matter; this script just collects it, which keeps
// the same fact from being written down twice.
//
//   node scripts/build-blog-index.mjs          write the index
//   node scripts/build-blog-index.mjs --check  fail if the index is stale (CI)

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// The same front matter parser the browser uses — one implementation, two runtimes.
import { parseFrontMatter } from "../assets/js/util.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const blogDir = join(root, "content", "blog");
const indexFile = join(blogDir, "index.json");
const FILE_RE = /^(\d{4}-\d{2}-\d{2})-([a-z0-9-]+?)(?:\.(zh|en))?\.md$/;

const files = (await readdir(blogDir)).filter((f) => f.endsWith(".md")).sort();
const bySlug = new Map();
const problems = [];

for (const file of files) {
  const m = FILE_RE.exec(file);
  if (!m) {
    problems.push(`${file}: expected YYYY-MM-DD-slug.md or YYYY-MM-DD-slug.<zh|en>.md`);
    continue;
  }
  const [, date, slug, lang = "zh"] = m;
  const { data } = parseFrontMatter(await readFile(join(blogDir, file), "utf8"));

  if (!data.title) problems.push(`${file}: front matter is missing "title"`);

  const entry = bySlug.get(slug) || {
    slug,
    date,
    title: {},
    summary: {},
    file: {},
    author: "",
    tags: [],
  };
  entry.date = data.date || entry.date || date;
  entry.title[lang] = data.title || slug;
  if (data.summary) entry.summary[lang] = data.summary;
  entry.file[lang] = file;
  entry.author = entry.author || data.author || "";
  if (data.tags) {
    for (const tag of String(data.tags).split(",").map((s) => s.trim()).filter(Boolean)) {
      if (!entry.tags.includes(tag)) entry.tags.push(tag);
    }
  }
  bySlug.set(slug, entry);
}

const posts = [...bySlug.values()]
  .map((p) => ({ ...p, summary: Object.keys(p.summary).length ? p.summary : undefined }))
  .sort((a, b) => b.date.localeCompare(a.date));

const next = `${JSON.stringify({ posts }, null, 2)}\n`;

if (problems.length) {
  for (const p of problems) console.error(`  ${p}`);
  console.error(`\n${problems.length} problem(s) in content/blog. Nothing written.`);
  process.exit(1);
}

if (process.argv.includes("--check")) {
  const current = await readFile(indexFile, "utf8").catch(() => "");
  if (current !== next) {
    console.error("content/blog/index.json is out of date. Run: npm run blog:index");
    process.exit(1);
  }
  console.log(`content/blog/index.json is current (${posts.length} posts).`);
} else {
  await writeFile(indexFile, next, "utf8");
  console.log(`Wrote content/blog/index.json — ${posts.length} posts.`);
}
