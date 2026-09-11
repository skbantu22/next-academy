"use client";

import { useMemo, useState } from "react";

// Cell value for a column (accessor > key). Used for search, sort, filter.
export function cellValue(column, row) {
  if (column.sortValue) return column.sortValue(row);
  if (column.accessor) return column.accessor(row);
  return row[column.key];
}

const asText = (value) => {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
};

// ---------------------------------------------------------------------------
// Headless table state: search + per-column filters + sort + pagination.
// Pure derivation from `rows`; the DataTable component renders the result.
// ---------------------------------------------------------------------------
export function useDataTable({ rows = [], columns = [], initialSort = null, pageSize: initialPageSize = 10 }) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({}); // { [colKey]: value }
  const [sort, setSort] = useState(initialSort); // { key, dir: "asc" | "desc" }
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const searchable = useMemo(
    () => columns.filter((col) => col.searchable !== false),
    [columns],
  );
  const filterable = useMemo(() => columns.filter((col) => col.filter), [columns]);

  // Options for each filterable column (static list or derived from rows).
  const filterOptions = useMemo(() => {
    const map = {};
    for (const col of filterable) {
      if (typeof col.filter.options === "function") map[col.key] = col.filter.options(rows);
      else if (Array.isArray(col.filter.options)) map[col.key] = col.filter.options;
      else {
        const seen = new Set();
        for (const row of rows) {
          const value = asText(cellValue(col, row)).trim();
          if (value) seen.add(value);
        }
        map[col.key] = [...seen].sort().map((value) => ({ value, label: value }));
      }
    }
    return map;
  }, [filterable, rows]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (term) {
        const hit = searchable.some((col) => asText(cellValue(col, row)).toLowerCase().includes(term));
        if (!hit) return false;
      }
      for (const col of filterable) {
        const active = filters[col.key];
        if (active === undefined || active === "" || active === "__all__") continue;
        if (col.filter.predicate) {
          if (!col.filter.predicate(row, active)) return false;
        } else if (asText(cellValue(col, row)) !== String(active)) {
          return false;
        }
      }
      return true;
    });
  }, [rows, search, filters, searchable, filterable]);

  const sortedRows = useMemo(() => {
    if (!sort?.key) return filteredRows;
    const col = columns.find((entry) => entry.key === sort.key);
    if (!col) return filteredRows;
    const dir = sort.dir === "desc" ? -1 : 1;
    return [...filteredRows].sort((a, b) => {
      const va = cellValue(col, a);
      const vb = cellValue(col, b);
      if (va === vb) return 0;
      if (va === null || va === undefined || va === "") return 1;
      if (vb === null || vb === undefined || vb === "") return -1;
      const na = typeof va === "number" ? va : Number(va);
      const nb = typeof vb === "number" ? vb : Number(vb);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return (na - nb) * dir;
      return asText(va).localeCompare(asText(vb), undefined, { numeric: true }) * dir;
    });
  }, [filteredRows, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = useMemo(
    () => sortedRows.slice((safePage - 1) * pageSize, safePage * pageSize),
    [sortedRows, safePage, pageSize],
  );

  const toggleSort = (key) => {
    setPage(1);
    setSort((current) => {
      if (current?.key !== key) return { key, dir: "asc" };
      if (current.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  };
  const setFilter = (key, value) => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  };
  const updateSearch = (value) => {
    setPage(1);
    setSearch(value);
  };
  const reset = () => {
    setSearch("");
    setFilters({});
    setSort(initialSort);
    setPage(1);
  };

  const activeFilterCount =
    (search.trim() ? 1 : 0) +
    Object.values(filters).filter((value) => value && value !== "__all__").length;

  return {
    search, setSearch: updateSearch,
    filters, setFilter, filterOptions, filterable,
    sort, toggleSort,
    page: safePage, setPage, pageSize, setPageSize, pageCount,
    total: rows.length,
    filteredRows, sortedRows, pageRows,
    activeFilterCount, reset,
  };
}
