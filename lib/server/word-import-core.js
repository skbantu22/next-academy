import "server-only";

import mammoth from "mammoth";

export const MAX_DOCX_BYTES = 8 * 1024 * 1024; // 8 MB
const DOCX_MIME = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/octet-stream",
  "application/zip",
  "",
]);

const err = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });

// Parse an uploaded .docx buffer into safe, structured content. Never
// touches the database. Rejects anything that is not a readable Word file.
export async function parseDocx(file, buffer) {
  const name = (file?.name || "").toLowerCase();
  if (!name.endsWith(".docx")) throw err("Unable to read this Word document. Please upload a valid .docx file.");
  if (file?.type && !DOCX_MIME.has(file.type)) {
    throw err("Unable to read this Word document. Please upload a valid .docx file.");
  }
  if (!buffer?.length) throw err("No readable content found.");
  if (buffer.length > MAX_DOCX_BYTES) throw err("This Word document is too large — the limit is 8 MB.");
  // .docx is a zip; every real one starts with the local-file-header magic "PK".
  if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    throw err("Unable to read this Word document. Please upload a valid .docx file.");
  }

  let result;
  try {
    result = await mammoth.convertToHtml(
      { buffer },
      {
        styleMap: [
          "p[style-name='Title'] => h1.doc-title:fresh",
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Heading 3'] => h3:fresh",
        ],
      },
    );
  } catch {
    throw err("Unable to read this Word document. Please upload a valid .docx file.");
  }

  const html = sanitizeHtml(result.value || "");
  const text = htmlToText(html);
  if (!text.trim()) throw err("No readable content found.");

  return {
    html,
    text,
    warnings: (result.messages || []).filter((m) => m.type === "warning").map((m) => m.message).slice(0, 20),
  };
}

// Keep only the structural / inline tags we actually render in the preview.
// mammoth already produces clean HTML (no scripts/styles); this is a second
// guard so nothing unexpected is injected into the review panel.
const ALLOWED = new Set(["h1", "h2", "h3", "h4", "p", "ul", "ol", "li", "strong", "b", "em", "i", "u", "a", "br", "table", "thead", "tbody", "tr", "td", "th"]);

export function sanitizeHtml(html) {
  return html
    .replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (match, tag, attrs) => {
      const lower = tag.toLowerCase();
      if (!ALLOWED.has(lower)) return "";
      if (lower === "a") {
        const href = /href\s*=\s*"([^"]*)"/i.exec(attrs || "")?.[1] || "";
        const safe = /^https?:\/\//i.test(href) ? href : "";
        return safe ? `<a href="${safe}" target="_blank" rel="noreferrer">` : "<a>";
      }
      return match.startsWith("</") ? `</${lower}>` : `<${lower}>`;
    })
    .replace(/<!--[\s\S]*?-->/g, "");
}

export function htmlToText(html) {
  return html
    .replace(/<\/(p|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/td>\s*<td[^>]*>/gi, "\t")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}
