'use client';
import Link from 'next/link';
import { useState } from 'react';
import { DieGrid } from '@/components/DieGrid';
import { gradeColor } from '@/lib/colors';
import { StatNumber } from '@/components/StatNumber';
import { BinBar } from '@/components/BinBar';

export type HeroBatch = {
  id: string;
  name: string;
  description: string | null;
  datasetName: string;
  datasetKind: string;
  count: number;
  createdAt: string;
  hasReport: boolean;
  summary: any | null;
  grades: string[]; // 用于绘 DieGrid，最多 1500 条
};

export function HomeBody({
  batches,
  isAdmin,
  datasetsCount,
  totalRecords,
  totalReports,
}: {
  batches: HeroBatch[];
  isAdmin: boolean;
  datasetsCount: number;
  totalRecords: number;
  totalReports: number;
}) {
  // 默认显示最新有报告的批次；没有则第一条
  const initialId = batches.find((b) => b.hasReport)?.id ?? batches[0]?.id ?? '';
  const [selectedId, setSelectedId] = useState(initialId);
  const selected = batches.find((b) => b.id === selectedId) ?? batches[0];

  return (
    <>
      {selected ? <Hero batch={selected} /> : <EmptyHero isAdmin={isAdmin} />}

      <div className="grid grid-cols-3 gap-6">
        <RecentBatchesPanel
          batches={batches}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <ScopePanel
          isAdmin={isAdmin}
          datasetsCount={datasetsCount}
          totalRecords={totalRecords}
          totalReports={totalReports}
        />
        <QuickActionsPanel isAdmin={isAdmin} />
      </div>
    </>
  );
}

function Hero({ batch }: { batch: HeroBatch }) {
  const dies = batch.grades.map((g) => ({ x: 0 as const, y: 0 as const, color: gradeColor(g) }));
  const s = batch.summary;

  return (
    <section className="grid grid-cols-[auto_1fr] gap-10 mb-14 border-t border-b border-line py-10">
      <div>
        {dies.length > 0 ? (
          <DieGrid dies={dies} size={300} />
        ) : (
          <div className="w-[300px] h-[300px] border border-dashed border-line flex items-center justify-center serial">
            尚无报告 — 无 Die Grid
          </div>
        )}
        <div className="serial mt-3 text-center">
          {batch.datasetKind === 'BUILTIN_CHIP' ? batch.datasetName : `${batch.datasetName} · 按推荐等级`}
        </div>
      </div>
      <div className="flex flex-col justify-between">
        <div>
          <div className="serial mb-2 flex items-center gap-3">
            <span>SELECTED · {batch.id.slice(-6).toUpperCase()}</span>
            <span className="tag text-cobalt">{batch.datasetKind === 'BUILTIN_CHIP' ? '芯片' : 'CUSTOM'}</span>
          </div>
          <h2 className="display-zh text-3xl text-ink mb-1">{batch.name}</h2>
          <div className="text-sm text-ink-3">{batch.description ?? '—'}</div>
        </div>
        {s ? (
          <>
            <div className="grid grid-cols-4 gap-6">
              <StatNumber label="记录数" value={s.total.toLocaleString()} size="md" />
              <StatNumber
                label="良率"
                value={`${(s.yield * 100).toFixed(1)}%`}
                size="md"
                accent={s.yield > 0.9 ? 'cobalt' : 'pink'}
              />
              <StatNumber
                label="推荐总价"
                value={`¥${Math.round(s.totalRecommendedPriceCny).toLocaleString()}`}
                size="md"
                accent="cobalt"
              />
              <StatNumber label="平均单价" value={`¥${s.avgPriceCny.toFixed(2)}`} size="md" />
            </div>
            <div>
              <div className="eyebrow mb-2">GRADE DISTRIBUTION</div>
              <BinBar
                distribution={s.gradeDistribution}
                order={['S', 'A', 'B', 'C', 'D', 'FAIL']}
                height={20}
              />
            </div>
          </>
        ) : (
          <div className="text-sm text-ink-3 py-8">
            该批次尚未生成报告 —
            <Link href={`/batches/${batch.id}#report`} className="text-cobalt hover:underline ml-1">
              前往生成 →
            </Link>
          </div>
        )}
        <div className="flex gap-3">
          {s && (
            <Link href={`/batches/${batch.id}/report`} className="btn-primary">
              查看完整报告 →
            </Link>
          )}
          <Link href={`/batches/${batch.id}`} className="btn-ghost">
            批次详情
          </Link>
        </div>
      </div>
    </section>
  );
}

function EmptyHero({ isAdmin }: { isAdmin: boolean }) {
  return (
    <section className="mb-14 border-t border-b border-line py-16 text-center">
      <div className="eyebrow mb-3">NO DATA</div>
      <h2 className="display-zh text-3xl mb-3">
        {isAdmin ? '尚无任何批次' : '已授权数据集暂无数据'}
      </h2>
      <p className="text-sm text-ink-3 mb-6">
        {isAdmin ? '前往「数据录入」拖一份 CSV 开始' : '等待管理员上传数据'}
      </p>
      {isAdmin && (
        <Link href="/upload" className="btn-primary">
          前往数据录入 →
        </Link>
      )}
    </section>
  );
}

function RecentBatchesPanel({
  batches,
  selectedId,
  onSelect,
}: {
  batches: HeroBatch[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="card p-6">
      <div className="eyebrow mb-4">RECENT BATCHES</div>
      {batches.length === 0 ? (
        <div className="text-ink-3 text-sm">暂无批次</div>
      ) : (
        <ul className="divide-y divide-line">
          {batches.map((b) => {
            const isSelected = b.id === selectedId;
            return (
              <li key={b.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onSelect(b.id)}
                    className={`text-left flex-1 min-w-0 group ${isSelected ? '' : 'opacity-80 hover:opacity-100'}`}
                  >
                    <div className={`text-sm font-medium truncate ${isSelected ? 'text-cobalt' : 'text-ink group-hover:text-cobalt'}`}>
                      {isSelected && <span className="text-cobalt mr-1">▸</span>}
                      {b.name}
                    </div>
                    <div className="serial mt-0.5 flex gap-3">
                      <span>{b.count.toLocaleString()} 行</span>
                      <span>{b.datasetName}</span>
                      {!b.hasReport && <span className="text-ink-3">无报告</span>}
                    </div>
                  </button>
                  <Link
                    href={`/batches/${b.id}`}
                    className="serial text-cobalt hover:underline whitespace-nowrap ml-2"
                  >
                    详情 →
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div className="serial mt-4 pt-3 border-t border-line leading-relaxed">
        点击批次名切换上方统计；点「详情 →」跳转到批次详情页。
      </div>
    </div>
  );
}

function ScopePanel({
  isAdmin,
  datasetsCount,
  totalRecords,
  totalReports,
}: {
  isAdmin: boolean;
  datasetsCount: number;
  totalRecords: number;
  totalReports: number;
}) {
  return (
    <div className="card p-6">
      <div className="eyebrow mb-4">SCOPE · {isAdmin ? 'ALL DATA' : 'YOUR ACCESS'}</div>
      <div className="space-y-5">
        <StatNumber label="可见数据集" value={datasetsCount.toLocaleString()} size="sm" />
        <StatNumber label="芯片记录数" value={totalRecords.toLocaleString()} size="sm" />
        <StatNumber label="报告总数" value={totalReports.toLocaleString()} size="sm" />
      </div>
    </div>
  );
}

function QuickActionsPanel({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="card p-6 flex flex-col justify-between">
      <div>
        <div className="eyebrow mb-4">QUICK ACTIONS</div>
        <div className="space-y-3">
          <Link href="/datasets" className="btn-ghost w-full justify-center">
            浏览数据集
          </Link>
          {isAdmin && (
            <Link href="/upload" className="btn-primary w-full justify-center">
              + 上传新批次
            </Link>
          )}
          {isAdmin && (
            <Link href="/datasets/new" className="btn-ghost w-full justify-center">
              + 新建数据集
            </Link>
          )}
        </div>
      </div>
      <div className="serial mt-6 leading-relaxed">
        提示：每个数据集独立 schema、独立授权。普通用户只能看到 admin 勾选过的数据集。
      </div>
    </div>
  );
}
