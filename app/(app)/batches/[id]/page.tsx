import { notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { canViewDataset, isAdmin } from '@/lib/permissions';
import { DieGrid } from '@/components/DieGrid';
import { gradeColor } from '@/lib/colors';
import { StatNumber } from '@/components/StatNumber';
import { BinBar } from '@/components/BinBar';
import { BatchChipsTable } from './ChipsTable';
import { GenerateReportButton } from './GenerateReportButton';

export const dynamic = 'force-dynamic';

export default async function BatchDetail({ params }: { params: { id: string } }) {
  const session = await auth();
  const user = session!.user as any;

  const batch = await prisma.batch.findUnique({
    where: { id: params.id },
    include: {
      uploadedBy: { select: { name: true, id: true } },
      reports: { orderBy: { createdAt: 'desc' }, take: 5 },
    },
  });
  if (!batch) notFound();
  if (!isAdmin(user) && !(await canViewDataset(user, batch.datasetId))) {
    return <div className="p-10 text-bin-c">无权访问此批次（所属数据集未授权）</div>;
  }

  const chips = await prisma.chip.findMany({
    where: { batchId: batch.id },
    orderBy: { chipId: 'asc' },
  });

  // BIN 分布（来自原始 binCode）
  const binDist: Record<string, number> = {};
  let totalFail = 0;
  for (const c of chips) {
    const k = c.binCode ?? 'BIN?';
    binDist[k] = (binDist[k] ?? 0) + 1;
    if ((c.failCount ?? 0) > 0) totalFail++;
  }
  const yieldPct = chips.length > 0 ? ((chips.length - totalFail) / chips.length) * 100 : 0;

  // Die grid 颜色：按 binCode 上色
  const dies = chips.slice(0, 1500).map((c) => ({
    x: 0, y: 0,
    color: gradeColor(c.binCode),
    id: c.id,
    title: `${c.chipId} · ${c.binCode ?? '?'}`,
  }));

  const latestReport = batch.reports[0];

  return (
    <div className="p-10 max-w-[1280px]">
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <div className="eyebrow mb-2">BATCH · {batch.id.slice(-8).toUpperCase()}</div>
          <h1 className="display-zh text-4xl text-ink">{batch.name}</h1>
        </div>
        <Link href="/batches" className="serial hover:text-ink">← 返回列表</Link>
      </div>
      <div className="text-sm text-ink-3 mb-8 flex gap-5">
        <span>{batch.description ?? '无备注'}</span>
        <span>·</span>
        <span>上传人：{batch.uploadedBy.name}</span>
        <span>·</span>
        <span>{new Date(batch.createdAt).toLocaleString('zh-CN', { hour12: false })}</span>
      </div>

      <section className="grid grid-cols-[300px_1fr] gap-10 mb-10 border-t border-b border-line py-8">
        <div>
          <DieGrid dies={dies} size={300} />
          <div className="serial mt-3 text-center">DIE GRID · 测试 BIN</div>
        </div>
        <div className="flex flex-col justify-between">
          <div className="grid grid-cols-4 gap-6">
            <StatNumber label="芯片数" value={chips.length.toLocaleString()} size="md" />
            <StatNumber label="原始良率" value={`${yieldPct.toFixed(1)}%`} accent={yieldPct > 90 ? 'cobalt' : 'pink'} size="md" />
            <StatNumber label="文件大小" value={batch.fileSize > 0 ? `${(batch.fileSize / 1024).toFixed(1)} KB` : '—'} size="md" />
            <StatNumber label="报告数" value={batch.reports.length} size="md" />
          </div>
          <div>
            <div className="eyebrow mb-2">BIN DISTRIBUTION</div>
            <BinBar distribution={binDist} order={Object.keys(binDist).sort()} height={20} />
          </div>
          <div className="flex gap-3" id="report">
            {latestReport ? (
              <Link href={`/batches/${batch.id}/report`} className="btn-primary">查看最新报告 →</Link>
            ) : (
              <GenerateReportButton batchId={batch.id} />
            )}
            {latestReport && <GenerateReportButton batchId={batch.id} label="重新生成报告" variant="ghost" />}
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-3">
          <div className="eyebrow">CHIPS · 芯片明细</div>
          <div className="serial">共 {chips.length.toLocaleString()} 条记录</div>
        </div>
        <BatchChipsTable chips={chips.map((c) => ({
          id: c.id,
          chipId: c.chipId,
          lotId: c.lotId,
          waferId: c.waferId,
          binCode: c.binCode,
          frequencyMhz: c.frequencyMhz,
          leakageNa: c.leakageNa,
          vthV: c.vthV,
          iddUa: c.iddUa,
          failCount: c.failCount,
          testTimestamp: c.testTimestamp?.toISOString() ?? null,
        }))} />
      </section>
    </div>
  );
}
