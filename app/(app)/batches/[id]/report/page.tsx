import { notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { canViewDataset, isAdmin } from '@/lib/permissions';
import { DieGrid } from '@/components/DieGrid';
import { gradeColor } from '@/lib/colors';
import { StatNumber } from '@/components/StatNumber';
import { BinBar } from '@/components/BinBar';
import { ReportScatter } from './ReportScatter';
import { AssessmentsTable } from './AssessmentsTable';
import { CustomAssessmentsTable } from './CustomAssessmentsTable';
import { GenerateReportButton } from '../GenerateReportButton';

export const dynamic = 'force-dynamic';

export default async function ReportPage({ params }: { params: { id: string } }) {
  const session = await auth();
  const user = session!.user as any;

  const batch = await prisma.batch.findUnique({
    where: { id: params.id },
    include: {
      uploadedBy: { select: { name: true } },
      dataset: { select: { kind: true, schema: true, name: true } },
      reports: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          generatedBy: { select: { name: true } },
          ruleSet: { select: { name: true } },
        },
      },
    },
  });
  if (!batch) notFound();
  if (!isAdmin(user) && !(await canViewDataset(user, batch.datasetId))) {
    return <div className="p-10 text-bin-c">无权访问此批次（所属数据集未授权）</div>;
  }
  const report = batch.reports[0];
  if (!report) {
    return (
      <div className="p-10 max-w-3xl mx-auto text-center">
        <div className="eyebrow mb-3">NO REPORT</div>
        <h1 className="display-zh text-3xl mb-3">该批次尚未生成报告</h1>
        <p className="text-sm text-ink-3 mb-6">
          点击下方按钮，对全部 {batch.rowCount} 条记录运行评级算法。
        </p>
        <GenerateReportButton batchId={batch.id} datasetId={batch.datasetId} isAdmin={isAdmin(user)} />
      </div>
    );
  }

  const rawSummary = JSON.parse(report.summary);
  const summary = {
    total: 0, yield: 0, gradeDistribution: {}, avgScore: 0,
    totalRecommendedPriceCny: 0, avgPriceCny: 0, minPriceCny: 0, maxPriceCny: 0,
    ...rawSummary,
  };

  const isBuiltin = batch.dataset.kind === 'BUILTIN_CHIP';

  return (
    <div className="p-10 max-w-[1280px]">
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <div className="eyebrow mb-2 flex items-center gap-3">
            <span>REPORT · {report.id.slice(-8).toUpperCase()}</span>
            <span className={`tag ${isBuiltin ? 'text-cobalt' : 'text-ink-3'}`}>
              {isBuiltin ? '芯片评级' : batch.dataset.name}
            </span>
          </div>
          <h1 className="display-zh text-4xl text-ink">{batch.name}</h1>
        </div>
        <Link href={`/batches/${batch.id}`} className="serial hover:text-ink">← 返回批次</Link>
      </div>
      <div className="text-sm text-ink-3 mb-8 flex gap-5 flex-wrap">
        {isAdmin(user) ? (
          <>
            <span>规则集：<span className="text-ink-2">{report.ruleSet?.name ?? '内置默认'}</span></span>
            <span>·</span>
          </>
        ) : (
          <>
            <span>已应用分析规则</span>
            <span>·</span>
          </>
        )}
        <span>算法：<span className="num text-ink-2">{report.algorithm}</span></span>
        <span>·</span>
        <span>生成人：{report.generatedBy.name}</span>
        <span>·</span>
        <span>{new Date(report.createdAt).toLocaleString('zh-CN', { hour12: false })}</span>
      </div>

      {isBuiltin ? (
        <BuiltinReportBody batch={batch} report={report} summary={summary} />
      ) : (
        <CustomReportBody batch={batch} report={report} summary={summary} />
      )}
    </div>
  );
}

async function BuiltinReportBody({ batch, report, summary }: any) {
  const assessments = await prisma.chipAssessment.findMany({
    where: { reportId: report.id },
    include: {
      chip: {
        select: {
          chipId: true, lotId: true, waferId: true,
          frequencyMhz: true, leakageNa: true, vthV: true, iddUa: true,
        },
      },
    },
  });

  const dies = assessments.slice(0, 1500).map((a) => ({
    x: 0, y: 0,
    color: gradeColor(a.grade),
    id: a.chipId,
    title: `${a.chip.chipId} · ${a.grade} · ¥${a.recommendedPriceCny}`,
  }));

  const scatter = assessments
    .filter((a) => a.chip.frequencyMhz != null && a.chip.leakageNa != null)
    .slice(0, 1000)
    .map((a) => ({
      x: a.chip.frequencyMhz!,
      y: a.chip.leakageNa!,
      grade: a.grade,
    }));

  return (
    <>
      <section className="grid grid-cols-[300px_1fr] gap-10 mb-12 border-t border-b border-line py-10">
        <div>
          <DieGrid dies={dies} size={300} />
          <div className="serial mt-3 text-center">DIE GRID · 按推荐等级着色</div>
        </div>
        <SummaryRight batch={batch} summary={summary} />
      </section>

      <section className="mb-12">
        <div className="eyebrow mb-3">FREQUENCY × LEAKAGE · 频率与漏电流散点</div>
        <div className="card p-6">
          <ReportScatter data={scatter} />
        </div>
        <p className="serial mt-2 leading-relaxed">
          理想区：频率高、漏电流低（图左上）。每个点按推荐等级着色。
        </p>
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-3">
          <div className="eyebrow">ASSESSMENTS · 单芯片评级明细</div>
          <div className="serial">共 {assessments.length.toLocaleString()} 条</div>
        </div>
        <AssessmentsTable
          rows={assessments.map((a) => ({
            id: a.id,
            chipId: a.chip.chipId,
            lotId: a.chip.lotId,
            waferId: a.chip.waferId,
            grade: a.grade,
            score: a.score,
            recommendedPriceCny: a.recommendedPriceCny,
            rationale: a.rationale,
            frequencyMhz: a.chip.frequencyMhz,
            leakageNa: a.chip.leakageNa,
          }))}
        />
      </section>
    </>
  );
}

async function CustomReportBody({ batch, report, summary }: any) {
  const items: { recordId: string; grade: string; score: number; recommendedPriceCny: number; rationale: string }[] =
    report.assessmentsJson ? JSON.parse(report.assessmentsJson) : [];
  const recordIds = items.map((i) => i.recordId);
  const records = recordIds.length > 0
    ? await prisma.datasetRecord.findMany({
        where: { id: { in: recordIds } },
        select: { id: true, dataJson: true },
      })
    : [];
  const recordById = new Map(records.map((r) => [r.id, JSON.parse(r.dataJson)]));

  const schema = JSON.parse(batch.dataset.schema) as { fields: { name: string; label: string; type: string }[] };
  // 过滤掉所有 record 都为空的列；剩下的列里挑前 3 个数值字段做表格展示
  const nonEmptyFieldNames = new Set<string>();
  for (const data of recordById.values()) {
    for (const k of Object.keys(data)) {
      const v = data[k];
      if (v != null && v !== '') nonEmptyFieldNames.add(k);
    }
  }
  const showFields = schema.fields
    .filter((f) => nonEmptyFieldNames.has(f.name))
    .filter((f) => f.type === 'integer' || f.type === 'number')
    .slice(0, 3);
  // 加一个唯一标识字段（required 的第一个或第一个有内容的字段）
  const idField =
    schema.fields.find((f) => f.name === 'sample_id' && nonEmptyFieldNames.has(f.name)) ??
    schema.fields.find((f) => f.required && nonEmptyFieldNames.has(f.name)) ??
    schema.fields.find((f) => nonEmptyFieldNames.has(f.name)) ??
    schema.fields[0];

  const rows = items.map((a) => {
    const data = recordById.get(a.recordId) ?? {};
    return {
      id: a.recordId,
      displayId: idField ? String(data[idField.name] ?? a.recordId.slice(-6)) : a.recordId.slice(-6),
      grade: a.grade,
      score: a.score,
      recommendedPriceCny: a.recommendedPriceCny,
      rationale: a.rationale,
      extras: Object.fromEntries(showFields.map((f) => [f.name, data[f.name] ?? null])),
    };
  });

  return (
    <>
      <section className="grid grid-cols-[1fr] gap-10 mb-12 border-t border-b border-line py-10">
        <SummaryRight batch={batch} summary={summary} idLabel="记录数" />
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-3">
          <div className="eyebrow">ASSESSMENTS · 单条记录评级明细</div>
          <div className="serial">共 {rows.length.toLocaleString()} 条</div>
        </div>
        <CustomAssessmentsTable
          rows={rows}
          idLabel={idField?.label ?? '记录'}
          extraFields={showFields.map((f) => ({ name: f.name, label: f.label }))}
        />
      </section>
    </>
  );
}

function SummaryRight({ batch, summary, idLabel = '芯片数' }: { batch: any; summary: any; idLabel?: string }) {
  return (
    <div className="flex flex-col justify-between gap-6">
      <div className="grid grid-cols-4 gap-6">
        <StatNumber label={idLabel} value={summary.total.toLocaleString()} size="lg" />
        <StatNumber
          label="良率"
          value={`${(summary.yield * 100).toFixed(1)}%`}
          accent={summary.yield > 0.9 ? 'cobalt' : 'pink'}
          size="lg"
          hint={`非 FAIL · ${Math.round(summary.yield * summary.total)} 条`}
        />
        <StatNumber
          label="推荐总价"
          value={`¥${Math.round(summary.totalRecommendedPriceCny).toLocaleString()}`}
          accent="cobalt"
          size="lg"
          hint={`均价 ¥${summary.avgPriceCny.toFixed(2)}`}
        />
        <StatNumber
          label="单价区间"
          value={`¥${summary.minPriceCny.toFixed(2)} – ${summary.maxPriceCny.toFixed(2)}`}
          size="sm"
        />
      </div>
      <div>
        <div className="eyebrow mb-2">GRADE DISTRIBUTION · 等级分布</div>
        <BinBar
          distribution={summary.gradeDistribution}
          order={['S', 'A', 'B', 'C', 'D', 'FAIL']}
          height={24}
        />
      </div>
      <div className="flex gap-3">
        <a href={`/api/batches/${batch.id}/export?format=pdf`} className="btn-primary">导出 PDF →</a>
        <a href={`/api/batches/${batch.id}/export?format=xlsx`} className="btn-ghost">导出 Excel</a>
      </div>
    </div>
  );
}
