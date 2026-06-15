'use client';
import { useMemo, useState } from 'react';

export type Column<T> = {
  key: string;
  header: string;
  width?: number | string;
  render?: (row: T) => React.ReactNode;
  accessor?: (row: T) => string | number | null | undefined;
  align?: 'left' | 'right' | 'center';
  mono?: boolean;
};

type Props<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  pageSize?: number;
  emptyText?: string;
  search?: string;
  onRowClick?: (row: T) => void;
};

export function DataTable<T>({
  columns, rows, rowKey, pageSize = 50, emptyText = '暂无数据', search, onRowClick,
}: Props<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!search) return rows;
    const s = search.toLowerCase();
    return rows.filter((r) =>
      columns.some((c) => {
        const v = c.accessor ? c.accessor(r) : (r as any)[c.key];
        return v != null && String(v).toLowerCase().includes(s);
      }),
    );
  }, [rows, search, columns]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return filtered;
    const acc = col.accessor ?? ((r: T) => (r as any)[col.key]);
    return [...filtered].sort((a, b) => {
      const av = acc(a) ?? '';
      const bv = acc(b) ?? '';
      if (av < bv) return -1 * sortDir;
      if (av > bv) return 1 * sortDir;
      return 0;
    });
  }, [filtered, sortKey, sortDir, columns]);

  const pageRows = sorted.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));

  if (rows.length === 0) {
    return <div className="text-ink-3 text-sm py-12 text-center">{emptyText}</div>;
  }

  return (
    <div>
      <div className="overflow-x-auto border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-2 text-ink-2">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`px-3 py-2.5 text-left font-mono text-2xs tracking-eyebrow uppercase whitespace-nowrap select-none cursor-pointer ${
                    c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : ''
                  }`}
                  style={{ width: c.width }}
                  onClick={() => {
                    if (sortKey === c.key) setSortDir((d) => (d === 1 ? -1 : 1));
                    else { setSortKey(c.key); setSortDir(1); }
                  }}
                >
                  <span className="flex items-center gap-1">
                    {c.header}
                    {sortKey === c.key && <span className="text-cobalt">{sortDir === 1 ? '↑' : '↓'}</span>}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr
                key={rowKey(row)}
                className={`border-t border-line hover:bg-surface-2/60 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((c) => {
                  const v = c.render ? c.render(row) : c.accessor ? c.accessor(row) : (row as any)[c.key];
                  return (
                    <td
                      key={c.key}
                      className={`px-3 py-2 ${c.mono ? 'num' : ''} ${c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : ''}`}
                    >
                      {v as React.ReactNode}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between text-2xs text-ink-3">
          <div className="num">
            共 {sorted.length} 行 · 第 {page + 1} / {totalPages} 页
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost py-1 px-3 text-xs" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
              上一页
            </button>
            <button className="btn-ghost py-1 px-3 text-xs" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
