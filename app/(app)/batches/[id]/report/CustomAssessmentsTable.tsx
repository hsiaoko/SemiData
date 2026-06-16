'use client';
import { useState } from 'react';
import { DataTable, type Column } from '@/components/DataTable';
import { gradeColor } from '@/lib/colors';

type Row = {
  id: string;
  displayId: string;
  grade: string;
  score: number;
  recommendedPriceCny: number;
  rationale: string;
  extras: Record<string, any>;
};

const GRADES = ['S', 'A', 'B', 'C', 'D', 'FAIL'];

export function CustomAssessmentsTable({
  rows,
  idLabel,
  extraFields,
}: {
  rows: Row[];
  idLabel: string;
  extraFields: { name: string; label: string }[];
}) {
  const [search, setSearch] = useState('');
  const [filterGrade, setFilterGrade] = useState<string | null>(null);

  const filtered = filterGrade ? rows.filter((r) => r.grade === filterGrade) : rows;

  const columns: Column<Row>[] = [
    {
      key: 'displayId',
      header: idLabel,
      width: 160,
      render: (r) => <span className="num font-medium">{r.displayId}</span>,
    },
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
    ...extraFields.map((f) => ({
      key: f.name,
      header: f.label,
      mono: true,
      align: 'right' as const,
      width: 110,
      accessor: (r: Row) => {
        const v = r.extras[f.name];
        return typeof v === 'number' ? v : 0;
      },
      render: (r: Row) => {
        const v = r.extras[f.name];
        if (v == null) return '—';
        if (typeof v === 'number') return v.toFixed(2).replace(/\.?0+$/, '');
        return String(v);
      },
    })),
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
          placeholder="搜索 / 理由…"
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
