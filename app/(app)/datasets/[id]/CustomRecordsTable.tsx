'use client';
import { useEffect, useState, useMemo } from 'react';
import { DataTable, type Column } from '@/components/DataTable';
import type { DatasetSchema } from '@/lib/datasets/builtin';

type R = { id: string; createdAt: string; dataJson: string };

export function CustomRecordsTable({ datasetId, schema }: { datasetId: string; schema: DatasetSchema }) {
  const [rows, setRows] = useState<any[] | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch(`/api/datasets/${datasetId}/records?limit=2000`)
      .then((r) => r.json())
      .then((data: R[]) => {
        setRows(
          data.map((r) => ({
            id: r.id,
            createdAt: r.createdAt,
            ...JSON.parse(r.dataJson),
          })),
        );
      });
  }, [datasetId]);

  // 全部列展示 — 不再仅前 8 个
  const columns = useMemo<Column<any>[]>(() => {
    const cols: Column<any>[] = schema.fields.map((f) => ({
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
    cols.push({
      key: 'createdAt',
      header: '入库时间',
      width: 130,
      render: (r) => (
        <span className="serial whitespace-nowrap">
          {new Date(r.createdAt).toLocaleString('zh-CN', { hour12: false }).slice(5, 16)}
        </span>
      ),
    });
    return cols;
  }, [schema]);

  if (rows === null) return <div className="card p-10 text-center text-ink-3 text-sm">加载中…</div>;
  if (rows.length === 0) return <div className="card p-10 text-center text-ink-3 text-sm">该数据集尚无数据</div>;

  return (
    <div>
      <div className="flex justify-between mb-3 items-center">
        <input
          className="input max-w-xs"
          placeholder="筛选…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="serial">
          {rows.length.toLocaleString()} 条记录 · {schema.fields.length} 列
        </div>
      </div>
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} search={search} pageSize={50} />
    </div>
  );
}
