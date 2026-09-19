// A small Markdown renderer for blog posts.
//
// Supports what a lab blog actually uses: headings, paragraphs, lists, fenced
// code, blockquotes, tables, images, links, emphasis, inline code and rules.
// Everything is escaped before any markup is added, so a post cannot inject
// HTML into the page.

import { esc, escUrl } from "./util.js";

export function markdown(src) {
  const lines = String(src ?? "").replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    // fenced code
    const fence = /^(```|~~~)\s*([\w+-]*)\s*$/.exec(line);
    if (fence) {
      const body = [];
      i++;
      while (i < lines.length && !new RegExp(`^${fence[1]}\\s*$`).test(lines[i])) body.push(lines[i++]);
      i++;
      const lang = fence[2] ? ` data-lang="${esc(fence[2])}"` : "";
      out.push(`<pre${lang}><code>${esc(body.join("\n"))}</code></pre>`);
      continue;
    }

    // heading
    const head = /^(#{1,6})\s+(.*)$/.exec(line);
    if (head) {
      const level = Math.min(head[1].length + 1, 6); // post title is the h1
      out.push(`<h${level}>${inline(head[2].trim())}</h${level}>`);
      i++;
      continue;
    }

    // horizontal rule
    if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) {
      out.push("<hr>");
      i++;
      continue;
    }

    // blockquote
    if (/^\s{0,3}>/.test(line)) {
      const body = [];
      while (i < lines.length && /^\s{0,3}>/.test(lines[i])) body.push(lines[i++].replace(/^\s{0,3}>\s?/, ""));
      out.push(`<blockquote>${markdown(body.join("\n"))}</blockquote>`);
      continue;
    }

    // table
    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1])) {
      const header = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(cells(lines[i++]));
      out.push(
        "<table><thead><tr>" +
        header.map((c) => `<th>${inline(c)}</th>`).join("") +
        "</tr></thead><tbody>" +
        rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("") +
        "</tbody></table>"
      );
      continue;
    }

    // list
    const bullet = /^(\s*)([-*+]|\d+[.)])\s+/.exec(line);
    if (bullet) {
      const ordered = /\d/.test(bullet[2]);
      const items = [];
      let current = null;
      while (i < lines.length) {
        const item = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(lines[i]);
        if (item) {
          if (current) items.push(current);
          current = [item[3]];
          i++;
        } else if (lines[i].trim() && /^\s{2,}/.test(lines[i]) && current) {
          current.push(lines[i].trim());
          i++;
        } else if (!lines[i].trim() && current && /^(\s*)([-*+]|\d+[.)])\s+/.test(lines[i + 1] || "")) {
          i++;
        } else {
          break;
        }
      }
      if (current) items.push(current);
      const tag = ordered ? "ol" : "ul";
      out.push(`<${tag}>${items.map((p) => `<li>${inline(p.join(" "))}</li>`).join("")}</${tag}>`);
      continue;
    }

    // paragraph
    const para = [];
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) para.push(lines[i++]);
    if (para.length) out.push(`<p>${inline(para.join("\n"))}</p>`);
    else i++;
  }

  return out.join("\n");
}

function isBlockStart(line) {
  return (
    /^(```|~~~)/.test(line) ||
    /^#{1,6}\s/.test(line) ||
    /^\s{0,3}>/.test(line) ||
    /^\s*\|/.test(line) ||
    /^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line) ||
    /^(\s*)([-*+]|\d+[.)])\s+/.test(line)
  );
}

function cells(line) {
  return line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
}

function inline(text) {
  // Inline code is extracted first so its contents are never re-parsed.
  const code = [];
  let work = String(text).replace(/`([^`]+)`/g, (_, body) => {
    code.push(body);
    return `\u0000${code.length - 1}\u0000`;
  });

  work = esc(work);

  work = work
    .replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g,
      (_, altText, src, title) =>
        `<img src="${escUrl(src)}" alt="${altText}"${title ? ` title="${title}"` : ""} loading="lazy">`)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
      const external = /^https?:/i.test(href);
      return `<a href="${escUrl(href)}"${external ? ' target="_blank" rel="noopener"' : ""}>${label}</a>`;
    })
    .replace(/(^|[\s(])\*\*([^*]+)\*\*/g, "$1<strong>$2</strong>")
    .replace(/(^|[\s(])__([^_]+)__/g, "$1<strong>$2</strong>")
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/(^|[\s(])_([^_\n]+)_/g, "$1<em>$2</em>")
    .replace(/  \n/g, "<br>\n");

  return work.replace(/\u0000(\d+)\u0000/g, (_, n) => `<code>${esc(code[Number(n)])}</code>`);
}
