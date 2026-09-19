// Small shared helpers. No dependencies anywhere in this project.

/** Escape text for safe insertion into HTML. Content comes from the repo, but
 *  it is still text from a file someone edited — never trust it as markup. */
export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

/** Escape a URL, dropping anything that is not a safe scheme. */
export function escUrl(value) {
  const raw = String(value ?? "").trim();
  if (/^(javascript|data|vbscript):/i.test(raw)) return "#";
  return esc(raw);
}

/** Pick a language from a localised value.
 *  Accepts "plain string" or { zh: "…", en: "…" }; falls back to the other
 *  language rather than rendering nothing. */
export function t(value, lang = "zh") {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  const other = lang === "zh" ? "en" : "zh";
  return String(value[lang] ?? value[other] ?? "");
}

/** The language a value does NOT have as its primary — used for the
 *  second line under a heading. Empty when there is only one language. */
export function alt(value, lang = "zh") {
  if (!value || typeof value !== "object") return "";
  const other = lang === "zh" ? "en" : "zh";
  if (!value[lang] || !value[other]) return "";
  return String(value[other]);
}

export function list(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

/** 2026-08-14 -> "2026.08.14" (zh) / "14 Aug 2026" (en) */
export function fmtDate(iso, lang = "zh") {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ""));
  if (!m) return String(iso ?? "");
  const [, y, mo, d] = m;
  if (lang === "zh") return `${y}.${mo}.${d}`;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${Number(d)} ${months[Number(mo) - 1]} ${y}`;
}

/** Parse the `key: value` front matter block used by blog posts.
 *  Deliberately a tiny subset of YAML so the same parser runs in the browser
 *  and in the Node scripts without a dependency. */
export function parseFrontMatter(text) {
  const src = String(text ?? "").replace(/^﻿/, "");
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(src);
  if (!m) return { data: {}, body: src };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const at = line.indexOf(":");
    if (at === -1) continue;
    const key = line.slice(0, at).trim();
    let val = line.slice(at + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    data[key] = val;
  }
  return { data, body: src.slice(m[0].length) };
}

/** Front matter uses flat keys (title_zh, title_en). Fold them back into
 *  the { zh, en } shape the rest of the app speaks. */
export function foldLocalised(data, key) {
  const zh = data[`${key}_zh`];
  const en = data[`${key}_en`];
  if (zh || en) return { zh: zh || "", en: en || "" };
  return data[key] ? String(data[key]) : "";
}

export function splitTags(value) {
  if (Array.isArray(value)) return value;
  return String(value ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}
