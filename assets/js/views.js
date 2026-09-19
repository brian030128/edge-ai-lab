// Section renderers. Each takes the loaded content plus the current language
// and returns a string of HTML. Nothing here touches the network or the DOM.

import { esc, escUrl, t, alt, list, fmtDate } from "./util.js";
import { markdown } from "./markdown.js";

export const UI = {
  zh: {
    menu: "選單",
    pi: "實驗室主持人",
    themes: "研究主題",
    works: "論文著作",
    people: "實驗室成員",
    blog: "研究日誌",
    join: "聯絡與加入",
    papers: "看論文",
    joinUs: "加入我們",
    current: "在學",
    past: "畢業",
    people_n: (n) => `${n} 位`,
    papers_n: (n) => `${n} 篇`,
    all: "全部",
    since: (y) => `${y} 年進入實驗室`,
    alumni: "畢業校友",
    alumniNote: "在學期間與目前去向，由校友自行回報；空白表示尚未更新。",
    colName: "姓名",
    colDegree: "學位",
    colYear: "在學期間",
    colResearch: "研究方向",
    colNow: "目前",
    readingNow: "研究中",
    back: "回研究日誌",
    by: "作者",
    noPubs: "這個主題目前還沒有論文。",
    noPosts: "還沒有文章。",
    editOnGit: "在 GitHub 編輯這份資料",
    interests: "研究興趣",
    education: "學歷與經歷",
    contact: "聯絡方式",
    email: "電子郵件",
    office: "研究室",
    address: "地址",
    tel: "電話",
    lastPost: "最新日誌",
    toappear: "即將發表",
    manuscript: "手稿",
  },
  en: {
    menu: "Menu",
    pi: "Principal investigator",
    themes: "Research themes",
    works: "Publications",
    people: "Lab members",
    blog: "Lab notes",
    join: "Contact and openings",
    papers: "Read the papers",
    joinUs: "Join the lab",
    current: "Current",
    past: "Graduated",
    people_n: (n) => `${n} ${n === 1 ? "person" : "people"}`,
    papers_n: (n) => `${n} ${n === 1 ? "paper" : "papers"}`,
    all: "All",
    since: (y) => `Joined ${y}`,
    alumni: "Alumni",
    alumniNote: "Years in the lab and current role, as reported by alumni. Blank means not yet updated.",
    colName: "Name",
    colDegree: "Degree",
    colYear: "Years",
    colResearch: "Research",
    colNow: "Now",
    readingNow: "Working on",
    back: "All lab notes",
    by: "By",
    noPubs: "No papers under this theme yet.",
    noPosts: "No notes yet.",
    editOnGit: "Edit this data on GitHub",
    interests: "Research interests",
    education: "Education and appointments",
    contact: "Contact",
    email: "Email",
    office: "Office",
    address: "Address",
    tel: "Phone",
    lastPost: "Latest note",
    toappear: "To appear",
    manuscript: "Manuscript",
  },
};

/** A photo path in content/ is resolved against whichever source is in use,
 *  so the same config works for a local deploy and for reading from GitHub.
 *  Absolute URLs are left alone. */
function assetUrl(data, path) {
  if (!path) return "";
  if (/^(https?:|data:|\/)/i.test(path)) return path;
  return typeof data.asset === "function" ? data.asset(path) : path;
}

export const SECTIONS = [
  { id: "pi", key: "pi" },
  { id: "themes", key: "themes" },
  { id: "works", key: "works" },
  { id: "people", key: "people" },
  { id: "notes", key: "blog" },
  { id: "join", key: "join" },
];

/* ------------------------------------------------------------------ hero -- */

/** True when a value has text in at least one language. `{ zh: "", en: "" }`
 *  is a field someone has not filled in yet, not a value. */
function has(value, lang) {
  return Boolean(t(value, lang).trim());
}

export function heroView(data, lang) {
  const ui = UI[lang];
  const lab = data.site.lab || {};
  const rows = cohortRows(data.people, lang);
  let tick = 0;

  const strip = rows.map((row) => `
    <div class="cohort__row">
      <span class="cohort__label">${esc(row.label)}</span>
      <span class="cohort__ticks" aria-hidden="true">${
        row.marks.map((past) =>
          `<i class="tick${past ? " tick--past" : ""}" style="animation-delay:${(tick++ * 22)}ms"></i>`
        ).join("")
      }</span>
      <span class="cohort__count">${esc(row.countLabel)}</span>
    </div>`).join("");

  return `
  <section class="panel hero" id="top">
    <p class="hero__inst">${esc(t(lab.institution, lang))}</p>
    <h1 class="hero__name">${esc(t(lab.name, lang))}${
      alt(lab.name, lang) ? `<span>${esc(alt(lab.name, lang))}</span>` : ""
    }</h1>
    <p class="hero__statement">${esc(t(lab.statement, lang))}</p>
    <div class="hero__actions">
      <a class="btn" href="#works">${esc(ui.papers)}</a>
      <a class="btn btn--seal" href="#join">${esc(ui.joinUs)}</a>
    </div>

    <div class="cohort">
      <div class="cohort__rows">${strip}</div>
      <p class="cohort__key">
        <span><i></i>${esc(ui.current)}</span>
        <span><i class="is-past"></i>${esc(ui.past)}</span>
      </p>
    </div>
  </section>`;
}

function cohortRows(people, lang) {
  const rows = [];
  for (const group of list(people.groups)) {
    const members = list(group.members);
    if (!members.length) continue;
    rows.push({
      label: t(group.label, lang),
      marks: members.map(() => false),
      countLabel: UI[lang].people_n(members.length),
    });
  }
  const alumni = list(people.alumni);
  if (alumni.length) {
    rows.push({
      label: UI[lang].alumni,
      marks: alumni.map(() => true),
      countLabel: UI[lang].people_n(alumni.length),
    });
  }
  return rows;
}

/* -------------------------------------------------------------------- PI -- */

export function piView(data, lang) {
  const ui = UI[lang];
  const pi = data.site.pi || {};
  const bio = list(pi.bio?.[lang] ?? pi.bio?.zh ?? pi.bio);

  const meta = [];
  if (pi.email) meta.push([ui.email, `<a href="mailto:${escUrl(pi.email)}">${esc(pi.email)}</a>`]);
  if (has(pi.office, lang)) meta.push([ui.office, esc(t(pi.office, lang))]);
  for (const link of list(pi.links)) {
    meta.push([esc(t(link.label, lang)), `<a href="${escUrl(link.href)}" target="_blank" rel="noopener">${esc(link.text || shortHost(link.href))}</a>`]);
  }

  return `
  <section class="panel" id="pi">
    ${sectionHead(ui.pi, lang === "zh" ? UI.en.pi : UI.zh.pi)}
    <div class="pi">
      <div>
        ${portrait(pi, lang, data)}
        <dl class="pi__meta">
          ${meta.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join("")}
        </dl>
      </div>
      <div>
        <h3 class="pi__name">${esc(t(pi.name, lang))}${
          alt(pi.name, lang) ? `<span>${esc(alt(pi.name, lang))}</span>` : ""
        }</h3>
        <p class="pi__title">${esc(t(pi.title, lang))}</p>
        <div class="prose">${bio.map((p) => `<p>${esc(p)}</p>`).join("")}</div>

        ${list(pi.interests).length ? `
          <h4 class="subhead">${esc(ui.interests)}</h4>
          <ul class="tags">${list(pi.interests).map((i) => `<li>${esc(t(i, lang))}</li>`).join("")}</ul>
        ` : ""}

        ${list(pi.education).length ? `
          <h4 class="subhead">${esc(ui.education)}</h4>
          <ul class="timeline">${list(pi.education).map((row) => `
            <li${row.year ? "" : ' class="timeline__row--nodate"'}>${
              row.year ? `<b>${esc(row.year)}</b>` : ""
            }<span>${esc(t(row.detail, lang))}</span></li>
          `).join("")}</ul>
        ` : ""}
      </div>
    </div>
  </section>`;
}

function portrait(person, lang, data) {
  if (person.photo) {
    return `<img class="pi__portrait" src="${escUrl(assetUrl(data, person.photo))}" alt="${esc(t(person.name, lang))}" loading="lazy">`;
  }
  return `<div class="pi__portrait pi__portrait--empty" aria-hidden="true"><span>${esc(initial(person.name))}</span></div>`;
}

function initial(name) {
  const zh = typeof name === "object" ? name.zh : "";
  const en = typeof name === "object" ? name.en : String(name ?? "");
  if (zh) return zh.slice(-2);
  return (en || "?").trim().charAt(0).toUpperCase();
}

function shortHost(href) {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return href;
  }
}

/* ---------------------------------------------------------------- themes -- */

export function themesView(data, lang) {
  const ui = UI[lang];
  const themes = list(data.site.themes);
  if (!themes.length) return "";
  const pubs = list(data.publications.items);

  return `
  <section class="panel" id="themes">
    ${sectionHead(ui.themes, lang === "zh" ? UI.en.themes : UI.zh.themes)}
    <div class="themes">
      ${themes.map((theme) => {
        const n = pubs.filter((p) => list(p.themes).includes(theme.id)).length;
        return `
        <article class="theme">
          <h3 class="theme__name">${esc(t(theme.name, lang))}${
            alt(theme.name, lang) ? `<span>${esc(alt(theme.name, lang))}</span>` : ""
          }</h3>
          <p class="theme__body">${esc(t(theme.summary, lang))}</p>
          <a class="theme__count" href="#works?theme=${esc(theme.id)}">${esc(ui.papers_n(n))}</a>
        </article>`;
      }).join("")}
    </div>
  </section>`;
}

/* ---------------------------------------------------------- publications -- */

export function worksView(data, lang, activeTheme = "all") {
  const ui = UI[lang];
  const themes = list(data.site.themes);
  const all = list(data.publications.items);
  const names = labNames(data.people, data.site);

  const shown = activeTheme === "all" ? all : all.filter((p) => list(p.themes).includes(activeTheme));
  const years = [...new Set(shown.map((p) => Number(p.year)))].sort((a, b) => b - a);

  const filters = [{ id: "all", label: ui.all, n: all.length }]
    .concat(themes.map((th) => ({
      id: th.id,
      label: t(th.name, lang),
      n: all.filter((p) => list(p.themes).includes(th.id)).length,
    })))
    .map((f) => `
      <button class="filter" type="button" data-theme="${esc(f.id)}" aria-pressed="${f.id === activeTheme}">
        ${esc(f.label)} <span>${f.n}</span>
      </button>`).join("");

  return `
  <section class="panel" id="works">
    ${sectionHead(ui.works, lang === "zh" ? UI.en.works : UI.zh.works, ui.papers_n(all.length))}
    <div class="filters" id="pubFilters">${filters}</div>
    <div id="pubList">${worksBody(data, lang, activeTheme)}</div>
  </section>`;
}

/** Just the year-grouped list — re-rendered on its own when a filter changes. */
export function worksBody(data, lang, activeTheme = "all") {
  const ui = UI[lang];
  const all = list(data.publications.items);
  const names = labNames(data.people, data.site);
  const shown = activeTheme === "all" ? all : all.filter((p) => list(p.themes).includes(activeTheme));
  const years = [...new Set(shown.map((p) => Number(p.year)).filter(Boolean))].sort((a, b) => b - a);

  const pending = shown.filter((p) => !p.year && p.status);
  if (!years.length && !pending.length) return `<p class="empty">${esc(ui.noPubs)}</p>`;

  const pendingBlocks = ["toappear", "manuscript"].map((status) => {
    const items = pending.filter((p) => p.status === status);
    if (!items.length) return "";
    return `
    <div class="year-block">
      <h3 class="year-block__year year-block__year--status">${esc(ui[status])}</h3>
      <ul class="pubs">${items.map((p) => pubItem(p, lang, names)).join("")}</ul>
    </div>`;
  }).join("");

  return pendingBlocks + years.map((year) => `
    <div class="year-block">
      <h3 class="year-block__year">${esc(year)}</h3>
      <ul class="pubs">
        ${shown.filter((p) => Number(p.year) === year).map((p) => pubItem(p, lang, names)).join("")}
      </ul>
    </div>`).join("");
}

function pubItem(p, lang, names) {
  const authors = list(p.authors).map((a) => {
    const name = typeof a === "string" ? a : t(a, lang);
    return names.has(normalise(name)) ? `<b>${esc(name)}</b>` : esc(name);
  }).join(", ");

  const links = list(p.links).map((l) =>
    `<a href="${escUrl(l.href)}" target="_blank" rel="noopener">${esc(t(l.label, lang))}</a>`
  ).join("");

  return `
  <li class="pub">
    <h4 class="pub__title">${esc(t(p.title, lang))}${
      p.award ? `<span class="seal-mark">${esc(t(p.award, lang))}</span>` : ""
    }</h4>
    <p class="pub__authors">${authors}</p>
    <p class="pub__venue">${esc(t(p.venue, lang))}</p>
    ${links ? `<p class="pub__links">${links}</p>` : ""}
  </li>`;
}

function normalise(name) {
  return String(name).toLowerCase().replace(/[\s.*†‡]/g, "");
}

function labNames(people, site) {
  const set = new Set();
  const add = (name) => {
    if (!name) return;
    if (typeof name === "string") set.add(normalise(name));
    else for (const v of Object.values(name)) if (v) set.add(normalise(v));
  };
  const addPerson = (p) => {
    if (!p) return;
    add(p.name);
    // Publication lists print initials ("KC Wu"); aliases say which person that is.
    for (const alias of list(p.aliases)) add(alias);
  };
  addPerson(site.pi);
  for (const g of list(people.groups)) for (const m of list(g.members)) addPerson(m);
  for (const a of list(people.alumni)) addPerson(a);
  return set;
}

/* ---------------------------------------------------------------- people -- */

export function peopleView(data, lang) {
  const ui = UI[lang];
  const groups = list(data.people.groups);
  const alumni = list(data.people.alumni);
  const total = groups.reduce((n, g) => n + list(g.members).length, 0);

  return `
  <section class="panel" id="people">
    ${sectionHead(ui.people, lang === "zh" ? UI.en.people : UI.zh.people, ui.people_n(total))}

    ${groups.map((group) => {
      const members = list(group.members);
      if (!members.length) return "";
      return `
      <section class="group">
        <div class="group__head">
          <h3>${esc(t(group.label, lang))}${
            alt(group.label, lang) ? `<span>${esc(alt(group.label, lang))}</span>` : ""
          }</h3>
          <b>${esc(ui.people_n(members.length))}</b>
        </div>
        <ul class="roster">${members.map((m) => personRow(m, lang, data)).join("")}</ul>
      </section>`;
    }).join("")}

    ${alumni.length ? alumniTable(alumni, lang) : ""}
  </section>`;
}

/** "碩士 2022–2024 · 博士 2024 年起" for someone on their second degree here. */
function stageLine(person, lang) {
  return list(person.stages).map((st) => {
    const degree = t(st.degree, lang);
    if (st.since && st.year) return `${degree} ${st.since}–${st.year}`;
    if (st.since) return lang === "zh" ? `${degree} ${st.since} 年起` : `${degree} since ${st.since}`;
    return degree;
  }).filter(Boolean).join(" · ");
}

function personRow(m, lang, data) {
  const ui = UI[lang];
  const links = list(m.links).map((l) =>
    `<a href="${escUrl(l.href)}" target="_blank" rel="noopener">${esc(t(l.label, lang))}</a>`
  );
  if (m.email) links.unshift(`<a href="mailto:${escUrl(m.email)}">${esc(m.email)}</a>`);

  const role = list(m.stages).length
    ? stageLine(m, lang)
    : (m.role ? t(m.role, lang) : (m.since ? ui.since(m.since) : ""));

  return `
  <li class="person">
    ${m.photo
      ? `<img class="person__photo" src="${escUrl(assetUrl(data, m.photo))}" alt="${esc(t(m.name, lang))}" loading="lazy">`
      : `<div class="person__photo person__photo--empty" aria-hidden="true">${esc(initial(m.name))}</div>`}
    <div class="person__id">
      <h4 class="person__name">${esc(t(m.name, lang))}${
        alt(m.name, lang) ? `<span>${esc(alt(m.name, lang))}</span>` : ""
      }</h4>
      ${role ? `<p class="person__role">${esc(role)}</p>` : ""}
    </div>
    <div class="person__detail">
      ${list(m.focus).length
        ? `<ul class="tags">${list(m.focus).map((f) => `<li>${esc(t(f, lang))}</li>`).join("")}</ul>`
        : ""}
      ${m.work ? `<p class="person__work">${esc(t(m.work, lang))}</p>` : ""}
      ${links.length ? `<p class="person__links">${links.join("")}</p>` : ""}
    </div>
  </li>`;
}

function alumniTable(alumni, lang) {
  const ui = UI[lang];
  // Most recent first; anyone whose years were never recorded sorts last.
  const left = (p) => Math.max(
    Number(p.year) || 0,
    ...list(p.stages).map((s) => Number(s.year) || 0)
  );
  const rows = [...alumni].sort((a, b) => left(b) - left(a));

  // Someone may pass through the lab more than once — a master's, then a
  // doctorate, then a postdoc. `stages` keeps that as one person, one row.
  const spans = (a) => (list(a.stages).length ? list(a.stages) : [a]);

  const degrees = (a) => spans(a)
    .map((s) => t(s.degree, lang))
    .filter(Boolean)
    .join(" → ");

  const years = (a) => {
    const starts = spans(a).map((s) => Number(s.since)).filter(Boolean);
    const ends = spans(a).map((s) => Number(s.year)).filter(Boolean);
    const from = starts.length ? Math.min(...starts) : null;
    const to = ends.length ? Math.max(...ends) : null;
    if (from && to) return from === to ? String(from) : `${from}–${to}`;
    return String(to || from || "");
  };

  return `
  <section class="group">
    <div class="group__head">
      <h3>${esc(ui.alumni)}${lang === "zh" ? `<span>${esc(UI.en.alumni)}</span>` : ""}</h3>
      <b>${esc(ui.people_n(rows.length))}</b>
    </div>
    <p class="note note--table">${esc(ui.alumniNote)}</p>
    <table class="alumni">
      <thead>
        <tr>
          <th>${esc(ui.colName)}</th>
          <th>${esc(ui.colDegree)}</th>
          <th>${esc(ui.colYear)}</th>
          <th>${esc(ui.colResearch)}</th>
          <th>${esc(ui.colNow)}</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((a) => `
        <tr>
          <td class="col-name" data-label="${esc(ui.colName)}">${esc(t(a.name, lang))}${
            alt(a.name, lang) ? `<span>${esc(alt(a.name, lang))}</span>` : ""
          }</td>
          <td class="col-degree" data-label="${esc(ui.colDegree)}">${esc(degrees(a))}</td>
          <td class="col-year" data-label="${esc(ui.colYear)}">${esc(years(a))}</td>
          <td class="col-research" data-label="${esc(ui.colResearch)}">${esc(t(a.research, lang))}${
            list(a.focus).length
              ? `<span>${list(a.focus).map((f) => esc(t(f, lang))).join(" · ")}</span>`
              : ""
          }</td>
          <td class="col-now" data-label="${esc(ui.colNow)}">${
            a.now
              ? `${a.now.href
                  ? `<b><a href="${escUrl(a.now.href)}" target="_blank" rel="noopener">${esc(t(a.now.org, lang))}</a></b>`
                  : `<b>${esc(t(a.now.org, lang))}</b>`}
                 ${a.now.role ? `<span>${esc(t(a.now.role, lang))}</span>` : ""}`
              : ""
          }</td>
        </tr>`).join("")}
      </tbody>
    </table>
  </section>`;
}

/* ------------------------------------------------------------------ blog -- */

export function notesView(data, lang) {
  const ui = UI[lang];
  const posts = list(data.blog.posts);

  return `
  <section class="panel" id="notes">
    ${sectionHead(ui.blog, lang === "zh" ? UI.en.blog : UI.zh.blog)}
    ${posts.length ? `<ul class="posts">${posts.map((p) => `
      <li class="post-row">
        <span class="post-row__date">${esc(fmtDate(p.date, lang))}</span>
        <div>
          <h3 class="post-row__title"><a href="#/notes/${esc(p.slug)}">${esc(t(p.title, lang))}</a></h3>
          ${p.summary ? `<p class="post-row__summary">${esc(t(p.summary, lang))}</p>` : ""}
          ${p.authorName ? `<p class="post-row__by">${esc(ui.by)} ${esc(t(p.authorName, lang))}</p>` : ""}
        </div>
      </li>`).join("")}</ul>` : `<p class="empty">${esc(ui.noPosts)}</p>`}
  </section>`;
}

export function postView(post, body, lang) {
  const ui = UI[lang];
  return `
  <article class="panel post">
    <a class="post__back" href="#/notes">${esc(ui.back)}</a>
    <header class="post__head">
      <p class="post__date">${esc(fmtDate(post.date, lang))}</p>
      <h1 class="post__title">${esc(t(post.title, lang))}</h1>
      ${post.authorName ? `<p class="post__meta">${esc(ui.by)} ${esc(t(post.authorName, lang))}</p>` : ""}
    </header>
    <div class="prose">${markdown(body)}</div>
  </article>`;
}

/* ----------------------------------------------------------------- join --- */

export function joinView(data, lang) {
  const ui = UI[lang];
  const join = data.site.join || {};
  const contact = data.site.lab?.contact || {};

  const rows = [];
  if (contact.email) rows.push([ui.email, `<a href="mailto:${escUrl(contact.email)}">${esc(contact.email)}</a>`]);
  if (has(contact.office, lang)) rows.push([ui.office, esc(t(contact.office, lang))]);
  if (has(contact.address, lang)) rows.push([ui.address, esc(t(contact.address, lang))]);
  if (contact.phone) rows.push([ui.tel, esc(contact.phone)]);
  for (const l of list(data.site.lab?.links)) {
    rows.push([esc(t(l.label, lang)), `<a href="${escUrl(l.href)}" target="_blank" rel="noopener">${esc(l.text || shortHost(l.href))}</a>`]);
  }

  return `
  <section class="panel" id="join">
    ${sectionHead(ui.join, lang === "zh" ? UI.en.join : UI.zh.join)}
    <div class="contact">
      <div>
        <div class="prose">${list(join.body?.[lang] ?? join.body?.zh ?? join.body).map((p) => `<p>${esc(p)}</p>`).join("")}</div>
        ${list(join.cta).length ? `<p class="hero__actions">${list(join.cta).map((c) =>
          `<a class="btn btn--seal" href="${escUrl(c.href)}">${esc(t(c.label, lang))}</a>`).join("")}</p>` : ""}
      </div>
      <dl>${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join("")}</dl>
    </div>
  </section>`;
}

export function colophonView(source, data, lang) {
  const ui = UI[lang];
  const edit = source.editUrl("site.json");
  const repo = source.repoUrl();
  const year = new Date().getFullYear();
  return `
  <footer class="colophon">
    <span>© ${year} ${esc(t(data.site.lab?.name, lang))}</span>
    ${repo ? `<a href="${escUrl(repo)}" target="_blank" rel="noopener">${esc(source.repo.owner)}/${esc(source.repo.name)}</a>` : ""}
    ${edit ? `<a href="${escUrl(edit)}" target="_blank" rel="noopener">${esc(ui.editOnGit)}</a>` : ""}
  </footer>`;
}

/* --------------------------------------------------------------- shared --- */

function sectionHead(title, subtitle, aside = "") {
  return `
  <div class="section-head">
    <h2 class="h-section">${esc(title)}<span>${esc(subtitle)}</span></h2>
    ${aside ? `<p>${esc(aside)}</p>` : ""}
  </div>`;
}
