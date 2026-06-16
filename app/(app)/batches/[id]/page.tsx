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
import { BatchRecordsTable } from './BatchRecordsTable';

export const dynamic = 'force-dynamic';

export default async function BatchDetail({ params }: { params: { id: string } }) {
  const session = await auth();
  const user = session!.user as any;

  const batch = await prisma.batch.findUnique({
    where: { id: params.id },
    include: {
      uploadedBy: { select: { name: true, id: true } },
      dataset: { select: { id: true, name: true, slug: true, kind: true, schema: true } },
      reports: { orderBy: { createdAt: 'desc' }, take: 5 },
    },
  });
  if (!batch) notFound();
  if (!isAdmin(user) && !(await canViewDataset(user, batch.datasetId))) {
    return <div className="p-10 text-bin-c">无权访问此批次（所属数据集未授权）</div>;
  }
  const isBuiltin = batch.dataset.kind === 'BUILTIN_CHIP';
  const latestReport = batch.reports[0];

  if (isBuiltin) {
    return BuiltinChipBody({ batch, latestReport, user });
  }
  return CustomBatchBody({ batch, latestReport, user });
}

async function BuiltinChipBody({ batch, latestReport, user }: any) {
  const chips = await prisma.chip.findMany({
    where: { batchId: batch.id },
    orderBy: { chipId: 'asc' },
  });

  const binDist: Record<string, number> = {};
  let totalFail = 0;
  for (const c of chips) {
    const k = c.binCode ?? 'BIN?';
    binDist[k] = (binDist[k] ?? 0) + 1;
    if ((c.failCount ?? 0) > 0) totalFail++;
  }
  const yieldPct = chips.length > 0 ? ((chips.length - totalFail) / chips.length) * 100 : 0;

  const dies = chips.slice(0, 1500).map((c) => ({
    x: 0, y: 0,
    color: gradeColor(c.binCode),
    id: c.id,
    title: `${c.chipId} · ${c.binCode ?? '?'}`,
  }));

  return (
    <div className="p-10 max-w-[1280px]">
      <BatchHeader batch={batch} />

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
          <ActionRow batch={batch} latestReport={latestReport} user={user} />
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-3">
          <div className="eyebrow">CHIPS · 芯片明细</div>
          <div className="serial">共 {chips.length.toLocaleString()} 条记录</div>
        </div>
        <BatchChipsTable chips={chips.map((c) => ({
          id: c.id, chipId: c.chipId, lotId: c.lotId, waferId: c.waferId, binCode: c.binCode,
          frequencyMhz: c.frequencyMhz, leakageNa: c.leakageNa, vthV: c.vthV, iddUa: c.iddUa,
          failCount: c.failCount, testTimestamp: c.testTimestamp?.toISOString() ?? null,
        }))} />
      </section>
    </div>
  );
}

async function CustomBatchBody({ batch, latestReport, user }: any) {
  // 报告 summary
  let summary: any = null;
  if (latestReport) {
    summary = {
      total: 0, yield: 0, gradeDistribution: {}, totalRecommendedPriceCny: 0, avgPriceCny: 0,
      ...JSON.parse(latestReport.summary),
    };
  }

  // 记录数（精确）
  const recordCount = await prisma.datasetRecord.count({ where: { batchId: batch.id } });

  // 取前 200 条供表格展示
  const sampleRecords = await prisma.datasetRecord.findMany({
    where: { batchId: batch.id },
    orderBy: { createdAt: 'asc' },
    take: 200,
    select: { id: true, dataJson: true, createdAt: true },
  });
  const schema = JSON.parse(batch.dataset.schema);
  const allRows = sampleRecords.map((r) => ({ id: r.id, createdAt: r.createdAt.toISOString(), ...JSON.parse(r.dataJson) }));
  // 过滤掉所有空列
  const nonEmpty = new Set<string>();
  for (const r of allRows) for (const k of Object.keys(r)) {
    if (k === 'id' || k === 'createdAt') continue;
    const v = r[k];
    if (v != null && v !== '') nonEmpty.add(k);
  }
  const showFields = schema.fields.filter((f: any) => nonEmpty.has(f.name));

  return (
    <div className="p-10 max-w-[1280px]">
      <BatchHeader batch={batch} />

      <section className="mb-10 border-t border-b border-line py-8">
        <div className="grid grid-cols-4 gap-6 mb-6">
          <StatNumber label="记录数" value={recordCount.toLocaleString()} size="md" />
          <StatNumber label="数据集" value={batch.dataset.name} size="sm" />
          <StatNumber label="文件大小" value={batch.fileSize > 0 ? `${(batch.fileSize / 1024).toFixed(1)} KB` : '—'} size="md" />
          <StatNumber label="报告数" value={batch.reports.length} size="md" />
        </div>
        {summary && (
          <div className="grid grid-cols-4 gap-6 mb-6">
            <StatNumber
              label="良率"
              value={`${(summary.yield * 100).toFixed(1)}%`}
              accent={summary.yield > 0.9 ? 'cobalt' : 'pink'}
              size="md"
            />
            <StatNumber
              label="推荐总价"
              value={`¥${Math.round(summary.totalRecommendedPriceCny).toLocaleString()}`}
              accent="cobalt"
              size="md"
            />
            <StatNumber label="平均单价" value={`¥${summary.avgPriceCny.toFixed(2)}`} size="md" />
            <div>
              <div className="eyebrow mb-2">GRADE</div>
              <BinBar distribution={summary.gradeDistribution} order={['S', 'A', 'B', 'C', 'D', 'FAIL']} height={20} showLabels={false} />
            </div>
          </div>
        )}
        <ActionRow batch={batch} latestReport={latestReport} user={user} />
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-3">
          <div className="eyebrow">RECORDS · 数据预览（前 200 条）</div>
          <div className="serial">共 {recordCount.toLocaleString()} 条 · 显示 {showFields.length} 列（已自动隐藏全空列）</div>
        </div>
        <BatchRecordsTable rows={allRows} fields={showFields.map((f: any) => ({ name: f.name, label: f.label, type: f.type }))} />
        {recordCount > 200 && (
          <p className="serial mt-2">
            完整数据请使用上方 <span className="text-cobalt">导出原始 Excel</span> 或前往 <Link href={`/datasets/${batch.dataset.id}`} className="text-cobalt hover:underline">数据集页面</Link>。
          </p>
        )}
      </section>
    </div>
  );
}

function BatchHeader({ batch }: any) {
  return (
    <>
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <div className="eyebrow mb-2 flex items-center gap-3">
            <span>BATCH · {batch.id.slice(-8).toUpperCase()}</span>
            <Link href={`/datasets/${batch.dataset.id}`} className="tag text-cobalt hover:underline">
              {batch.dataset.name}
            </Link>
          </div>
          <h1 className="display-zh text-4xl text-ink">{batch.name}</h1>
        </div>
        <Link href="/batches" className="serial hover:text-ink">← 返回列表</Link>
      </div>
      <div className="text-sm text-ink-3 mb-8 flex gap-5 flex-wrap">
        <span>{batch.description ?? '无备注'}</span>
        <span>·</span>
        <span>上传人：{batch.uploadedBy.name}</span>
        <span>·</span>
        <span>{new Date(batch.createdAt).toLocaleString('zh-CN', { hour12: false })}</span>
      </div>
    </>
  );
}

function ActionRow({ batch, latestReport, user }: any) {
  return (
    <div className="flex flex-wrap gap-3 items-center" id="report">
      {latestReport ? (
        <>
          <Link href={`/batches/${batch.id}/report`} className="btn-primary">查看报告 →</Link>
          <a href={`/api/batches/${batch.id}/export?format=pdf`} className="btn-ghost" download>
            导出报告 PDF ↓
          </a>
          <a href={`/api/batches/${batch.id}/export?format=xlsx`} className="btn-ghost" download>
            导出报告 Excel ↓
          </a>
          <GenerateReportButton batchId={batch.id} datasetId={batch.datasetId} label="重新生成" variant="ghost" isAdmin={isAdmin(user)} />
        </>
      ) : (
        <GenerateReportButton batchId={batch.id} datasetId={batch.datasetId} isAdmin={isAdmin(user)} />
      )}
      <span className="text-ink-3 text-xs mx-1">·</span>
      <a href={`/api/batches/${batch.id}/export-raw?format=csv`} className="btn-ghost text-xs" download>
        原始 CSV ↓
      </a>
      <a href={`/api/batches/${batch.id}/export-raw?format=xlsx`} className="btn-ghost text-xs" download>
        原始 Excel ↓
      </a>
    </div>
  );
}
