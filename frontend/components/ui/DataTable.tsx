"use client";

import React, { useState, useMemo } from "react";
import { Search, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  align?: "left" | "center" | "right";
  sortable?: boolean;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  searchKey?: string;
  searchPlaceholder?: string;
  pageSize?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  searchKey,
  searchPlaceholder = "Search records...",
  pageSize = 10,
  emptyTitle = "No records found",
  emptyDescription = "No data matches your current search or filter criteria.",
  className = "",
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [density, setDensity] = useState<"compact" | "comfortable">("comfortable");

  // Filtering
  const filteredData = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter((item) => {
      if (searchKey) {
        return String(item[searchKey] ?? "").toLowerCase().includes(q);
      }
      return Object.values(item).some((v) =>
        String(v ?? "").toLowerCase().includes(q)
      );
    });
  }, [data, search, searchKey]);

  // Sorting
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    return [...filteredData].sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;
      if (typeof valA === "number" && typeof valB === "number") {
        return sortOrder === "asc" ? valA - valB : valB - valA;
      }
      return sortOrder === "asc"
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [filteredData, sortKey, sortOrder]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const paginatedData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, page, pageSize]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortOrder === "asc") setSortOrder("desc");
      else {
        setSortKey(null);
        setSortOrder("asc");
      }
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  const rowPadding = density === "compact" ? "py-2 px-3 text-[11px]" : "py-3 px-4 text-xs";

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Top Table Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        {/* Search Input */}
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-app-subtle" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={searchPlaceholder}
            className="w-full bg-app-card border border-app-border rounded-xl pl-9 pr-3 py-1.5 text-xs text-app-text placeholder:text-app-subtle focus:outline-none focus:border-silicon-cyan focus:ring-1 focus:ring-silicon-cyan/30 transition-all"
          />
        </div>

        {/* Density & Count */}
        <div className="flex items-center space-x-3 text-app-muted">
          <span className="text-[11px]">
            Showing <strong className="text-app-text">{paginatedData.length}</strong> of{" "}
            <strong className="text-app-text">{sortedData.length}</strong>
          </span>

          <div className="flex items-center space-x-1 border border-app-border rounded-lg p-0.5 bg-app-card">
            <button
              onClick={() => setDensity("compact")}
              className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                density === "compact" ? "bg-silicon-cyan/20 text-silicon-cyan font-bold" : "hover:text-app-text"
              }`}
            >
              Compact
            </button>
            <button
              onClick={() => setDensity("comfortable")}
              className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                density === "comfortable" ? "bg-silicon-cyan/20 text-silicon-cyan font-bold" : "hover:text-app-text"
              }`}
            >
              Comfortable
            </button>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-app-card border border-app-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-app-border bg-app-cardHover/60 text-app-muted text-[11px] font-semibold uppercase tracking-wider">
                {columns.map((col) => {
                  const isSorted = sortKey === col.key;
                  const alignClass =
                    col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left";

                  return (
                    <th
                      key={col.key}
                      onClick={() => col.sortable !== false && handleSort(col.key)}
                      className={`py-3 px-4 ${alignClass} ${
                        col.sortable !== false ? "cursor-pointer select-none hover:text-app-text" : ""
                      } ${col.className || ""}`}
                    >
                      <div
                        className={`inline-flex items-center space-x-1 ${
                          col.align === "right" ? "justify-end" : col.align === "center" ? "justify-center" : ""
                        }`}
                      >
                        <span>{col.header}</span>
                        {col.sortable !== false && (
                          <span className="text-app-subtle">
                            {isSorted ? (
                              sortOrder === "asc" ? (
                                <ChevronUp className="w-3 h-3 text-silicon-cyan" />
                              ) : (
                                <ChevronDown className="w-3 h-3 text-silicon-cyan" />
                              )
                            ) : (
                              <ChevronDown className="w-3 h-3 opacity-30" />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-app-border/60">
              {paginatedData.map((row, idx) => (
                <tr
                  key={idx}
                  className="hover:bg-app-cardHover/50 transition-colors duration-100 group"
                >
                  {columns.map((col) => {
                    const alignClass =
                      col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left";
                    return (
                      <td key={col.key} className={`${rowPadding} ${alignClass} text-app-text ${col.className || ""}`}>
                        {col.render ? col.render(row) : String(row[col.key] ?? "—")}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {paginatedData.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="py-12 text-center text-app-muted">
                    <div className="max-w-xs mx-auto space-y-1">
                      <div className="font-semibold text-app-text">{emptyTitle}</div>
                      <p className="text-[11px] text-app-subtle">{emptyDescription}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-app-border bg-app-cardHover/30 flex items-center justify-between text-xs text-app-muted">
            <span className="text-[11px]">
              Page <strong className="text-app-text">{page}</strong> of{" "}
              <strong className="text-app-text">{totalPages}</strong>
            </span>

            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-app-border bg-app-card hover:bg-app-cardHover disabled:opacity-40 disabled:pointer-events-none transition-colors"
                title="Previous page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-app-border bg-app-card hover:bg-app-cardHover disabled:opacity-40 disabled:pointer-events-none transition-colors"
                title="Next page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
