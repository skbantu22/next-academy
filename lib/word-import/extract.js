"use client";

// ---------------------------------------------------------------------------
// Client-side extraction from the parsed Word content (html + text) that the
// Admin-only /api/admin/word-import route returns. No network, no database.
// ---------------------------------------------------------------------------

const norm = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// "Label: value" fields (and multi-line blocks like Description / Syllabus).
// `fieldDefs`: [{ key, label, aliases?: [], multiline?: boolean }]
export function extractFields(text, fieldDefs) {
  const lines = String(text || "").split("\n");
  const labelFor = (line) => {
    const match = /^\s*([A-Za-z][A-Za-z0-9 /&()_-]{0,48}?)\s*[:\-–]\s*(.*)$/.exec(line);
    if (!match) return null;
    return { label: norm(match[1]), rest: match[2].trim() };
  };
  const defByLabel = new Map();
  for (const def of fieldDefs) {
    for (const alias of [def.label, def.key, ...(def.aliases || [])]) defByLabel.set(norm(alias), def);
  }

  const out = {};
  for (let i = 0; i < lines.length; i += 1) {
    const parsed = labelFor(lines[i]);
    if (!parsed) continue;
    const def = defByLabel.get(parsed.label);
    if (!def) continue;

    if (!def.multiline) {
      if (parsed.rest && out[def.key] === undefined) out[def.key] = parsed.rest;
      continue;
    }
    // Multi-line: take `rest` plus following lines until the next known label.
    const collected = parsed.rest ? [parsed.rest] : [];
    let j = i + 1;
    for (; j < lines.length; j += 1) {
      const next = labelFor(lines[j]);
      if (next && defByLabel.has(next.label)) break;
      collected.push(lines[j]);
    }
    const block = collected.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    if (block && out[def.key] === undefined) out[def.key] = block;
    i = j - 1;
  }
  return out;
}

// All <table> elements in the parsed html → { headers, rows }.
export function extractTables(html) {
  if (typeof window === "undefined" || !window.DOMParser) return [];
  const doc = new DOMParser().parseFromString(`<div>${html || ""}</div>`, "text/html");
  return [...doc.querySelectorAll("table")].map((table) => {
    const trs = [...table.querySelectorAll("tr")];
    if (!trs.length) return { headers: [], rows: [] };
    const cellsOf = (tr) => [...tr.querySelectorAll("th,td")].map((cell) => cell.textContent.replace(/\s+/g, " ").trim());
    const headers = cellsOf(trs[0]);
    const rows = trs.slice(1).map(cellsOf).filter((cells) => cells.some(Boolean));
    return { headers, rows };
  }).filter((table) => table.headers.length);
}

// Choose the table that best matches the expected record columns and map
// each column to a header index.
// `columnDefs`: [{ key, label, aliases?: [] }]
export function matchTable(tables, columnDefs) {
  let best = null;
  for (const table of tables) {
    const mapping = {};
    let score = 0;
    table.headers.forEach((header, index) => {
      const h = norm(header);
      for (const def of columnDefs) {
        if (mapping[def.key] !== undefined) continue;
        const names = [def.key, def.label, ...(def.aliases || [])].map(norm);
        if (names.some((name) => name && (name === h || h.includes(name) || name.includes(h)))) {
          mapping[def.key] = index;
          score += 1;
        }
      }
    });
    if (!best || score > best.score) best = { table, mapping, score };
  }
  return best && best.score ? best : null;
}

export function tableToRecords(table, mapping, columnDefs) {
  return table.rows.map((cells) => {
    const record = {};
    for (const def of columnDefs) {
      const index = mapping[def.key];
      let value = index === undefined ? "" : (cells[index] || "").trim();
      if (def.normalize) value = def.normalize(value);
      record[def.key] = value;
    }
    return record;
  });
}

// Validate + dedupe one record. `dedupe`: { keys: [], existing: [], check?: fn }
export function evaluateRecord(record, columnDefs, dedupe) {
  const errors = [];
  for (const def of columnDefs) {
    const value = record[def.key];
    if (def.required && !value) errors.push(`${def.label} is required`);
    if (value && def.validate) {
      const message = def.validate(value, record);
      if (message) errors.push(message);
    }
  }

  let duplicateOf = null;
  if (!errors.length && dedupe) {
    if (typeof dedupe.check === "function") {
      duplicateOf = dedupe.check(record) || null;
    } else if (Array.isArray(dedupe.existing) && Array.isArray(dedupe.keys)) {
      const hit = dedupe.existing.find((existing) =>
        dedupe.keys.some((key) => {
          const a = norm(record[key]);
          const b = norm(existing[key]);
          return a && a === b;
        }),
      );
      duplicateOf = hit ? (hit.id || hit.uid || true) : null;
    }
  }

  return {
    status: errors.length ? "invalid" : duplicateOf ? "duplicate" : "valid",
    errors,
    duplicateOf,
  };
}
