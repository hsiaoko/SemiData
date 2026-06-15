'use client';
import { useState } from 'react';
import Link from 'next/link';
import { DataTable, type Column } from '@/components/DataTable';
import { gradeColor } from '@/lib/colors';

type Chip = {
  id: string;
  chipId: string;
  lotId: string | null;
  waferId: string | null;
  binCode: string | null;
  frequencyMhz: number | null;
  leakageNa: number | null;
  vthV: number | null;
  iddUa: number | null;
  failCount: number | null;
  testTimestamp: string | null;
};

function fmt(v: number | null, d = 2) {
  return v == null ? '—' : v.toFixed(d);
}

export function BatchChipsTable({ chips }: { chips: Chip[] }) {
  const [q, setQ] = useState('');

  const columns: Column<Chip>[] = [
    {
      key: 'chipId',
      header: '芯片编号',
      render: (c) => <span className="num font-medium">{c.chipId}</span>,
      width: 140,
    },
    { key: 'lotId', header: 'Lot', mono: true, width: 130 },
    { key: 'waferId', header: 'Wafer', mono: true, width: 80, align: 'center' },
    {
      key: 'binCode',
      header: 'BIN',
      width: 80,
      align: 'center',
      render: (c) => (
        <span className="tag" style={{ color: gradeColor(c.binCode), borderColor: gradeColor(c.binCode) }}>
          {c.binCode ?? '—'}
        </span>
      ),
    },
    {
      key: 'frequencyMhz',
      header: '频率 (MHz)',
      mono: true,
      align: 'right',
      width: 100,
      accessor: (c) => c.frequencyMhz,
      render: (c) => fmt(c.frequencyMhz, 1),
    },
    {
      key: 'leakageNa',
      header: '漏电 (nA)',
      mono: true,
      align: 'right',
      width: 100,
      accessor: (c) => c.leakageNa,
      render: (c) => fmt(c.leakageNa, 1),
    },
    {
      key: 'vthV',
      header: 'Vth (V)',
      mono: true,
      align: 'right',
      width: 80,
      accessor: (c) => c.vthV,
      render: (c) => fmt(c.vthV, 3),
    },
    {
      key: 'iddUa',
      header: 'IDD (μA)',
      mono: true,
      align: 'right',
      width: 90,
      accessor: (c) => c.iddUa,
      render: (c) => fmt(c.iddUa, 1),
    },
    {
      key: 'failCount',
      header: '失败项',
      mono: true,
      align: 'right',
      width: 70,
      accessor: (c) => c.failCount ?? 0,
      render: (c) => (c.failCount && c.failCount > 0 ? <span className="text-bin-c num">{c.failCount}</span> : <span className="num text-ink-3">0</span>),
    },
    {
      key: 'testTimestamp',
      header: '测试时间',
      width: 140,
      accessor: (c) => c.testTimestamp,
      render: (c) => (
        <span className="serial">
          {c.testTimestamp ? new Date(c.testTimestamp).toLocaleString('zh-CN', { hour12: false }).slice(5, 16) : '—'}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between mb-3 items-center">
        <input
          className="input max-w-xs"
          placeholder="按芯片编号 / Lot / Wafer 筛选…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="serial">虚拟分页 · 50 行/页</div>
      </div>
      <DataTable columns={columns} rows={chips} rowKey={(c) => c.id} search={q} pageSize={50} />
    </div>
  );
}
