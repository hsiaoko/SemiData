'use client';
import { useState, useMemo } from 'react';
import { DataTable, type Column } from '@/components/DataTable';

type Row = { id: string; createdAt: string; [k: string]: any };
type Field = { name: string; label: string; type: string };

export function BatchRecordsTable({ rows, fields }: { rows: Row[]; fields: Field[] }) {
  const [search, setSearch] = useState('');

  const columns = useMemo<Column<Row>[]>(() => {
    return fields.map((f) => ({
      key: f.name,
      header: f.label,
      mono: f.type === 'number' || f.type === 'integer',
      align: f.type === 'number' || f.type === 'integer' ? ('right' as const) : ('left' as const),
      render: (r) => {
        const v = r[f.name];
        if (v == null || v === '') return <span className="text-ink-3">—</span>;
        if (typeof v === 'boolean') return v ? '✓' : '✗';
        if (f.type === 'datetime') return new Date(v).toLocaleString('zh-CN', { hour12: false }).slice(0, 16);
        return String(v);
      },
    }));
  }, [fields]);

  if (rows.length === 0) return <div className="card p-10 text-center text-ink-3 text-sm">无数据</div>;

  return (
    <div>
      <div className="flex justify-between mb-3 items-center">
        <input
          className="input max-w-xs"
          placeholder="筛选…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} search={search} pageSize={50} />
    </div>
  );
}
