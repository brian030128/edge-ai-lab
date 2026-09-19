#!/usr/bin/env node
// Validate everything under content/ before it reaches the site.
//
// The page is only as good as these files, and most edits arrive as a pull
// request from someone adding themselves or a paper. This script is what tells
// them what is wrong, in the file and field they actually edited.
//
//   npm run check

import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const contentDir = join(root, "content");

const errors = [];
const warnings = [];

const fail = (file, path, msg) => errors.push(`${file} → ${path}: ${msg}`);
const warn = (file, path, msg) => warnings.push(`${file} → ${path}: ${msg}`);

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const arr = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);

/** A localised value: a plain string, or { zh, en } with at least one filled. */
function checkLocalised(file, path, value, { required = true } = {}) {
  if (value == null || value === "") {
    if (required) fail(file, path, "is required");
    return;
  }
  if (typeof value === "string" || typeof value === "number") return;
  if (!isObj(value)) return fail(file, path, "must be text or { zh, en }");
  const filled = ["zh", "en"].filter((k) => value[k]);
  if (!filled.length) fail(file, path, "needs at least one of zh / en");
  for (const k of Object.keys(value)) {
    if (!["zh", "en"].includes(k)) warn(file, `${path}.${k}`, "unknown language key, ignored by the page");
  }
}

function checkUrl(file, path, value, { allowMailto = true } = {}) {
  if (!value) return;
  const ok = /^(https?:\/\/|mailto:|#|\/|[\w.-]+\/)/i.test(String(value));
  if (!ok) fail(file, path, `"${value}" is not a usable link (use https://…, mailto:… or a path)`);
  if (/^javascript:/i.test(String(value))) fail(file, path, "javascript: links are not allowed");
}

const aliasOwners = new Map();

/** Aliases say how a person's name is printed in an author list ("KC Wu").
 *  Two people claiming the same alias would make author highlighting wrong. */
function checkAliases(file, path, aliases, owner = path) {
  arr(aliases).forEach((a, i) => {
    if (typeof a !== "string" || !a.trim()) return fail(file, `${path}[${i}]`, "must be a name as it appears in author lists");
    const key = a.trim().toLowerCase();
    if (aliasOwners.has(key) && aliasOwners.get(key) !== owner) {
      fail(file, `${path}[${i}]`, `"${a}" is also claimed by ${aliasOwners.get(key)}`);
    }
    aliasOwners.set(key, owner);
  });
}

function checkLinks(file, path, links) {
  arr(links).forEach((l, i) => {
    checkLocalised(file, `${path}[${i}].label`, l.label);
    checkUrl(file, `${path}[${i}].href`, l.href);
  });
}

async function load(name) {
  const text = await readFile(join(contentDir, name), "utf8").catch(() => null);
  if (text === null) {
    errors.push(`content/${name}: file is missing`);
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    errors.push(`content/${name}: not valid JSON — ${err.message}`);
    return null;
  }
}

const site = await load("site.json");
const people = await load("people.json");
const pubs = await load("publications.json");
const blog = await load("blog/index.json");

/* ------------------------------------------------------------- site.json -- */

if (site) {
  const f = "content/site.json";
  const lab = site.lab || {};
  checkLocalised(f, "lab.name", lab.name);
  checkLocalised(f, "lab.institution", lab.institution);
  checkLocalised(f, "lab.statement", lab.statement);
  if (!lab.short) warn(f, "lab.short", "no short name, the sidebar will show LAB");
  checkLinks(f, "lab.links", lab.links);
  if (lab.contact?.email && !/^[^@\s]+@[^@\s]+$/.test(lab.contact.email)) {
    fail(f, "lab.contact.email", `"${lab.contact.email}" is not an email address`);
  }

  const pi = site.pi || {};
  checkLocalised(f, "pi.name", pi.name);
  checkLocalised(f, "pi.title", pi.title);
  checkLinks(f, "pi.links", pi.links);
  checkAliases(f, "pi.aliases", pi.aliases);
  const bio = isObj(pi.bio) ? pi.bio.zh || pi.bio.en : pi.bio;
  if (!arr(bio).length) fail(f, "pi.bio", "needs at least one paragraph");
  for (const langKey of ["zh", "en"]) {
    if (isObj(pi.bio) && pi.bio[langKey] && !Array.isArray(pi.bio[langKey])) {
      fail(f, `pi.bio.${langKey}`, "must be a list of paragraphs");
    }
  }
  arr(pi.education).forEach((row, i) => {
    if (!row.year) warn(f, `pi.education[${i}].year`, "no year, the row prints without one");
    checkLocalised(f, `pi.education[${i}].detail`, row.detail);
  });

  const themeIds = new Set();
  arr(site.themes).forEach((th, i) => {
    if (!th.id) fail(f, `themes[${i}].id`, "is required (publications refer to it)");
    if (themeIds.has(th.id)) fail(f, `themes[${i}].id`, `"${th.id}" is used twice`);
    themeIds.add(th.id);
    checkLocalised(f, `themes[${i}].name`, th.name);
    checkLocalised(f, `themes[${i}].summary`, th.summary);
  });
  site._themeIds = themeIds;

  const joinBody = isObj(site.join?.body) ? site.join.body.zh || site.join.body.en : site.join?.body;
  if (!arr(joinBody).length) warn(f, "join.body", "empty, the contact section will look bare");
  checkLinks(f, "join.cta", site.join?.cta);
}

/* ----------------------------------------------------------- people.json -- */

const ids = new Set();
const names = new Set();

if (people) {
  const f = "content/people.json";
  if (!arr(people.groups).length) fail(f, "groups", "needs at least one group");

  arr(people.groups).forEach((g, gi) => {
    if (!g.id) fail(f, `groups[${gi}].id`, "is required");
    checkLocalised(f, `groups[${gi}].label`, g.label);
    if (!arr(g.members).length) warn(f, `groups[${gi}].members`, "is empty, the group is hidden");

    arr(g.members).forEach((m, mi) => {
      const at = `groups[${gi}].members[${mi}]`;
      if (!m.id) fail(f, `${at}.id`, "is required (blog posts credit authors by id)");
      else if (ids.has(m.id)) fail(f, `${at}.id`, `"${m.id}" is used twice`);
      else ids.add(m.id);
      checkLocalised(f, `${at}.name`, m.name);
      checkLocalised(f, `${at}.role`, m.role, { required: false });
      arr(m.stages).forEach((st, si) => {
        checkLocalised(f, `${at}.stages[${si}].degree`, st.degree);
        for (const key of ["since", "year"]) {
          if (st[key] == null || st[key] === "") continue;
          if (!/^\d{4}$/.test(String(st[key]))) fail(f, `${at}.stages[${si}].${key}`, "must be a four-digit year");
        }
      });
      if (!arr(m.focus).length) warn(f, `${at}.focus`, "no specialisation listed");
      arr(m.focus).forEach((x, i) => checkLocalised(f, `${at}.focus[${i}]`, x));
      checkLocalised(f, `${at}.work`, m.work, { required: false });
      checkLinks(f, `${at}.links`, m.links);
      checkAliases(f, `${at}.aliases`, m.aliases, m.id || at);
      if (m.email && !/^[^@\s]+@[^@\s]+$/.test(m.email)) fail(f, `${at}.email`, `"${m.email}" is not an email address`);
      for (const n of nameStrings(m.name)) names.add(n);
    });
  });

  arr(people.alumni).forEach((a, i) => {
    const at = `alumni[${i}]`;
    if (a.id) {
      if (ids.has(a.id)) fail(f, `${at}.id`, `"${a.id}" is used twice`);
      ids.add(a.id);
    }
    checkLocalised(f, `${at}.name`, a.name);
    const stages = arr(a.stages);
    checkLocalised(f, `${at}.degree`, a.degree, { required: false });
    if (!a.degree && !stages.length) warn(f, `${at}.degree`, "no degree recorded");
    if (a.degree && stages.length) {
      warn(f, `${at}.degree`, "ignored because this entry has stages");
    }
    for (const key of ["year", "since"]) {
      if (a[key] == null || a[key] === "") continue;
      if (!/^\d{4}$/.test(String(a[key]))) fail(f, `${at}.${key}`, "must be a four-digit year");
    }
    // Someone who did a master's, a doctorate and a postdoc here is one person
    // with three stages, not three rows.
    stages.forEach((st, si) => {
      checkLocalised(f, `${at}.stages[${si}].degree`, st.degree);
      for (const key of ["since", "year"]) {
        if (st[key] == null || st[key] === "") continue;
        if (!/^\d{4}$/.test(String(st[key]))) fail(f, `${at}.stages[${si}].${key}`, "must be a four-digit year");
      }
      if (st.since && st.year && Number(st.year) < Number(st.since)) {
        fail(f, `${at}.stages[${si}]`, `ends (${st.year}) before it starts (${st.since})`);
      }
      if (!st.since && !st.year) warn(f, `${at}.stages[${si}]`, "has no years");
    });
    if (a.year == null && !stages.some((st) => st.year)) {
      warn(f, `${at}.year`, "no year recorded, this row sorts last");
    }
    checkLocalised(f, `${at}.research`, a.research, { required: false });
    checkAliases(f, `${at}.aliases`, a.aliases, a.id || at);
    if (!a.now?.org) warn(f, `${at}.now.org`, "no current organisation — the Now column will be blank");
    else checkLocalised(f, `${at}.now.org`, a.now.org);
    checkLocalised(f, `${at}.now.role`, a.now?.role, { required: false });
    if (a.now?.href) checkUrl(f, `${at}.now.href`, a.now.href);
    for (const n of nameStrings(a.name)) names.add(n);
  });
}

function nameStrings(name) {
  if (!name) return [];
  if (typeof name === "string") return [name];
  return Object.values(name).filter(Boolean);
}

/* ----------------------------------------------------- publications.json -- */

if (pubs) {
  const f = "content/publications.json";
  const seen = new Set();
  const themeIds = site?._themeIds ?? new Set();

  arr(pubs.items).forEach((p, i) => {
    const at = `items[${i}]`;
    if (!p.id) fail(f, `${at}.id`, "is required");
    else if (seen.has(p.id)) fail(f, `${at}.id`, `"${p.id}" is used twice`);
    else seen.add(p.id);
    checkLocalised(f, `${at}.title`, p.title);
    // A manuscript with no venue yet is a legitimate state.
    checkLocalised(f, `${at}.venue`, p.venue, { required: p.status !== "manuscript" });
    const STATUS = ["toappear", "manuscript"];
    if (p.status && !STATUS.includes(p.status)) {
      fail(f, `${at}.status`, `must be one of ${STATUS.join(", ")}`);
    }
    if (p.year == null || p.year === "") {
      if (!p.status) fail(f, `${at}.year`, `is required unless status is one of ${STATUS.join(", ")}`);
    } else if (!/^\d{4}$/.test(String(p.year))) {
      fail(f, `${at}.year`, "must be a four-digit year");
    }
    if (!arr(p.authors).length) fail(f, `${at}.authors`, "needs at least one author");
    arr(p.themes).forEach((th, ti) => {
      if (themeIds.size && !themeIds.has(th)) {
        fail(f, `${at}.themes[${ti}]`, `"${th}" is not a theme id in site.json`);
      }
    });
    checkLocalised(f, `${at}.award`, p.award, { required: false });
    checkLinks(f, `${at}.links`, p.links);

    const listed = arr(p.authors).some((a) => names.has(typeof a === "string" ? a : a?.en || a?.zh));
    if (names.size && !listed) {
      warn(f, `${at}.authors`, "no author matches a name in people.json, so none will be highlighted");
    }
  });
}

/* ------------------------------------------------------ blog/index.json -- */

if (blog) {
  const f = "content/blog/index.json";
  const slugs = new Set();
  arr(blog.posts).forEach((p, i) => {
    const at = `posts[${i}]`;
    if (!p.slug) fail(f, `${at}.slug`, "is required");
    else if (slugs.has(p.slug)) fail(f, `${at}.slug`, `"${p.slug}" is used twice`);
    else slugs.add(p.slug);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(p.date ?? ""))) fail(f, `${at}.date`, "must be YYYY-MM-DD");
    checkLocalised(f, `${at}.title`, p.title);
    if (!p.file || (isObj(p.file) && !Object.keys(p.file).length)) fail(f, `${at}.file`, "is required");
    if (p.author && ids.size && !ids.has(p.author) && p.author !== "pi") {
      fail(f, `${at}.author`, `"${p.author}" is not a person id in people.json (or "pi")`);
    }
  });
}

/* --------------------------------------------------------------- report -- */

for (const w of warnings) console.warn(`  warning  ${w}`);
for (const e of errors) console.error(`  error    ${e}`);

const counts = [
  people ? `${arr(people.groups).reduce((n, g) => n + arr(g.members).length, 0)} current members` : null,
  people ? `${arr(people.alumni).length} alumni` : null,
  pubs ? `${arr(pubs.items).length} publications` : null,
  blog ? `${arr(blog.posts).length} posts` : null,
].filter(Boolean).join(", ");

if (errors.length) {
  console.error(`\n${errors.length} error(s), ${warnings.length} warning(s). Fix the fields above and run npm run check again.`);
  process.exit(1);
}

console.log(`content/ is valid — ${counts}.${warnings.length ? ` ${warnings.length} warning(s).` : ""}`);
