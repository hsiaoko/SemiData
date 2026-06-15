'use client';
import { useState } from 'react';
import { DataTable, type Column } from '@/components/DataTable';
import { gradeColor } from '@/lib/colors';

type Row = {
  id: string;
  chipId: string;
  lotId: string | null;
  waferId: string | null;
  grade: string;
  score: number;
  recommendedPriceCny: number;
  rationale: string;
  frequencyMhz: number | null;
  leakageNa: number | null;
};

const GRADES = ['S', 'A', 'B', 'C', 'D', 'FAIL'];

export function AssessmentsTable({ rows }: { rows: Row[] }) {
  const [search, setSearch] = useState('');
  const [filterGrade, setFilterGrade] = useState<string | null>(null);

  const filtered = filterGrade ? rows.filter((r) => r.grade === filterGrade) : rows;

  const columns: Column<Row>[] = [
    {
      key: 'chipId',
      header: '芯片',
      width: 130,
      render: (r) => <span className="num font-medium">{r.chipId}</span>,
    },
    { key: 'lotId', header: 'Lot', mono: true, width: 130 },
    { key: 'waferId', header: 'Wafer', mono: true, width: 70, align: 'center' },
    {
      key: 'grade',
      header: '等级',
      width: 70,
      align: 'center',
      accessor: (r) => GRADES.indexOf(r.grade),
      render: (r) => (
        <span className="tag" style={{ color: gradeColor(r.grade), borderColor: gradeColor(r.grade) }}>
          {r.grade}
        </span>
      ),
    },
    {
      key: 'score',
      header: '综合分',
      mono: true,
      align: 'right',
      width: 80,
      accessor: (r) => r.score,
      render: (r) => r.score.toFixed(1),
    },
    {
      key: 'frequencyMhz',
      header: '频率 MHz',
      mono: true,
      align: 'right',
      width: 90,
      accessor: (r) => r.frequencyMhz ?? 0,
      render: (r) => r.frequencyMhz?.toFixed(1) ?? '—',
    },
    {
      key: 'leakageNa',
      header: '漏电 nA',
      mono: true,
      align: 'right',
      width: 90,
      accessor: (r) => r.leakageNa ?? 0,
      render: (r) => r.leakageNa?.toFixed(1) ?? '—',
    },
    {
      key: 'recommendedPriceCny',
      header: '推荐价 ¥',
      mono: true,
      align: 'right',
      width: 100,
      accessor: (r) => r.recommendedPriceCny,
      render: (r) => (
        <span className={r.recommendedPriceCny > 0 ? 'text-cobalt' : 'text-ink-3'}>
          ¥{r.recommendedPriceCny.toFixed(2)}
        </span>
      ),
    },
    {
      key: 'rationale',
      header: '评级理由',
      render: (r) => <span className="text-2xs text-ink-3 leading-relaxed">{r.rationale}</span>,
    },
  ];

  return (
    <div>
      <div className="flex gap-3 mb-3 items-center">
        <input
          className="input max-w-xs"
          placeholder="搜索芯片 / Lot / 理由…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-1.5">
          <button
            type="button"
            className={`tag ${!filterGrade ? 'text-cobalt' : 'text-ink-3'}`}
            onClick={() => setFilterGrade(null)}
          >
            全部
          </button>
          {GRADES.map((g) => (
            <button
              key={g}
              type="button"
              className="tag"
              style={{
                color: filterGrade === g ? gradeColor(g) : '#6B6E76',
                borderColor: filterGrade === g ? gradeColor(g) : '#C9C5BB',
              }}
              onClick={() => setFilterGrade((f) => (f === g ? null : g))}
            >
              {g}
            </button>
          ))}
        </div>
      </div>
      <DataTable columns={columns} rows={filtered} rowKey={(r) => r.id} search={search} pageSize={50} />
    </div>
  );
}
