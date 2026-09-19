// Boot, routing and event wiring.
//
// The page has two routes: the index (#/ plus in-page anchors) and a single
// lab note (#/notes/<slug>). Content is fetched once, then every re-render —
// language switch, publication filter — is a pure function of that data.

import { createSource } from "./source.js";
import { t, list, parseFrontMatter, foldLocalised, splitTags } from "./util.js";
import {
  UI, SECTIONS, heroView, piView, themesView, worksView, worksBody, peopleView,
  notesView, postView, joinView, colophonView,
} from "./views.js";

const view = document.getElementById("view");
const boot = document.getElementById("boot");
const navList = document.getElementById("navList");
const navWrap = document.querySelector(".rail__nav");
const navToggle = document.getElementById("navToggle");
const langToggle = document.getElementById("langToggle");
const sourceNote = document.getElementById("sourceNote");

const state = {
  lang: readLang(),
  data: null,
  source: null,
  theme: "all",
  postCache: new Map(),
};

start();

async function start() {
  try {
    state.source = await createSource();
    state.data = await loadContent(state.source);
    document.documentElement.lang = state.lang === "zh" ? "zh-Hant" : "en";
    document.documentElement.dataset.lang = state.lang;
    wireChrome();
    await route();
    window.addEventListener("hashchange", route);
  } catch (err) {
    showError(err);
  } finally {
    boot.hidden = true;
  }
}

async function loadContent(source) {
  const [site, people, publications, blog] = await Promise.all([
    source.json("site.json"),
    source.json("people.json"),
    source.json("publications.json"),
    source.json("blog/index.json").catch(() => ({ posts: [] })),
  ]);

  const data = { site, people, publications, blog };
  // Photos live in content/ too, so they follow whichever source is in use.
  data.asset = (path) => source.url(path);
  data.blog.posts = list(blog.posts)
    .map((p) => ({ ...p, authorName: authorName(p.author, data) }))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return data;
}

function authorName(id, data) {
  if (!id) return "";
  if (id === "pi" || id === data.site.pi?.id) return data.site.pi?.name || "";
  for (const g of list(data.people.groups)) {
    for (const m of list(g.members)) if (m.id === id) return m.name;
  }
  for (const a of list(data.people.alumni)) if (a.id === id) return a.name;
  return id;
}

/* ---------------------------------------------------------------- chrome -- */

function wireChrome() {
  renderNav();
  renderSourceNote();

  langToggle.textContent = state.lang === "zh" ? "English" : "中文";
  langToggle.addEventListener("click", () => {
    state.lang = state.lang === "zh" ? "en" : "zh";
    try { localStorage.setItem("lab:lang", state.lang); } catch { /* fine */ }
    document.documentElement.lang = state.lang === "zh" ? "zh-Hant" : "en";
    document.documentElement.dataset.lang = state.lang;
    langToggle.textContent = state.lang === "zh" ? "English" : "中文";
    renderNav();
    renderSourceNote();
    route({ keepScroll: true });
  });

  navToggle.addEventListener("click", () => {
    const open = navWrap.dataset.open === "true";
    navWrap.dataset.open = String(!open);
    navToggle.setAttribute("aria-expanded", String(!open));
  });

  // Filters swap only the list, so the section keeps its place on screen.
  view.addEventListener("click", (e) => {
    const btn = e.target.closest("#pubFilters [data-theme]");
    if (!btn) return;
    state.theme = btn.dataset.theme;
    document.getElementById("pubList").innerHTML = worksBody(state.data, state.lang, state.theme);
    for (const b of document.querySelectorAll("#pubFilters [data-theme]")) {
      b.setAttribute("aria-pressed", String(b.dataset.theme === state.theme));
    }
  });

  navList.addEventListener("click", (e) => {
    if (e.target.closest("a")) {
      navWrap.dataset.open = "false";
      navToggle.setAttribute("aria-expanded", "false");
    }
  });

  const labName = t(state.data.site.lab?.name, state.lang);
  document.title = `${labName} — ${t(state.data.site.lab?.institution, state.lang)}`;
  for (const node of document.querySelectorAll("[data-bind]")) {
    const key = node.dataset.bind;
    if (key === "lab.short") node.textContent = state.data.site.lab?.short || "LAB";
    if (key === "lab.name") node.textContent = labName;
  }
}

function renderNav() {
  const ui = UI[state.lang];
  const hasThemes = list(state.data.site.themes).length > 0;
  navList.innerHTML = SECTIONS
    .filter((s) => (s.id === "themes" ? hasThemes : true))
    .map((s) => `<li><a href="#${s.id}">${ui[s.key]}</a></li>`)
    .join("");
}

function renderSourceNote() {
  sourceNote.innerHTML = state.source.describe(state.lang);
}

/* ---------------------------------------------------------------- routes -- */

async function route(opts = {}) {
  const hash = location.hash.replace(/^#/, "");

  // #works?theme=edge — a theme link from the research section.
  const themed = /^works\?theme=(.+)$/.exec(hash);
  if (themed) {
    state.theme = decodeURIComponent(themed[1]);
    history.replaceState(null, "", "#works");
    renderIndex();
    scrollToId("works");
    return;
  }

  const post = /^\/notes\/(.+)$/.exec(hash);
  if (post) {
    await renderPost(decodeURIComponent(post[1]));
    return;
  }

  renderIndex();

  if (hash && hash !== "/" && !opts.keepScroll) scrollToId(hash);
  else if (!opts.keepScroll) window.scrollTo(0, 0);
}

function renderIndex() {
  const d = state.data;
  view.innerHTML = [
    heroView(d, state.lang),
    piView(d, state.lang),
    themesView(d, state.lang),
    worksView(d, state.lang, state.theme),
    peopleView(d, state.lang),
    notesView(d, state.lang),
    joinView(d, state.lang),
    colophonView(state.source, d, state.lang),
  ].join("");

  spy();
}

async function renderPost(slug) {
  const post = list(state.data.blog.posts).find((p) => p.slug === slug);
  if (!post) {
    view.innerHTML = notesView(state.data, state.lang);
    return;
  }
  try {
    // A post may exist in one language or both; t() falls back to whichever
    // translation the repository actually has.
    const file = t(post.file, state.lang) || `${slug}.md`;
    const key = `${slug}:${file}`;
    let entry = state.postCache.get(key);
    if (!entry) {
      const raw = await state.source.text(`blog/${file}`);
      const { data, body } = parseFrontMatter(raw);
      entry = { data, body };
      state.postCache.set(key, entry);
    }
    const merged = {
      ...post,
      title: post.title || entry.data.title || foldLocalised(entry.data, "title"),
      date: post.date || entry.data.date,
      tags: list(post.tags).length ? post.tags : splitTags(entry.data.tags),
    };
    view.innerHTML = postView(merged, entry.body, state.lang);
    document.title = `${t(merged.title, state.lang)} — ${t(state.data.site.lab?.name, state.lang)}`;
    window.scrollTo(0, 0);
    document.getElementById("main").focus({ preventScroll: true });
    markNav("notes");
  } catch (err) {
    showError(err);
  }
}

/* ----------------------------------------------------------------- misc --- */

function scrollToId(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: prefersMotion() ? "smooth" : "auto", block: "start" });

  // Web fonts change how tall everything is. When someone opens a deep link
  // before the fonts arrive, correct the position once they have.
  if (document.fonts && document.fonts.status !== "loaded") {
    document.fonts.ready.then(() => {
      const target = document.getElementById(id);
      if (target) target.scrollIntoView({ behavior: "auto", block: "start" });
    });
  }
}

function prefersMotion() {
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function spy() {
  const panels = SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean);
  if (!panels.length || !("IntersectionObserver" in window)) return;
  const seen = new Map();
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) seen.set(e.target.id, e.intersectionRatio);
    let best = "";
    let bestRatio = 0;
    for (const [id, ratio] of seen) {
      if (ratio > bestRatio) { best = id; bestRatio = ratio; }
    }
    if (best) markNav(best);
  }, { rootMargin: "-20% 0px -60% 0px", threshold: [0, .25, .5, 1] });
  for (const p of panels) io.observe(p);
}

function markNav(id) {
  for (const a of navList.querySelectorAll("a")) {
    a.setAttribute("aria-current", String(a.getAttribute("href") === `#${id}`));
  }
}

function readLang() {
  try {
    const saved = localStorage.getItem("lab:lang");
    if (saved === "zh" || saved === "en") return saved;
  } catch { /* fine */ }
  return "zh";
}

function showError(err) {
  const tpl = document.getElementById("tpl-error");
  const node = tpl.content.cloneNode(true);
  node.querySelector(".lede").textContent = state.source
    ? `來源 / Source: ${state.source.mode}`
    : "site.config.json";
  node.querySelector(".err").textContent = String(err && err.message ? err.message : err);
  view.replaceChildren(node);
  boot.hidden = true;
  console.error(err);
}
