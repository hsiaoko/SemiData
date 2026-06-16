import Link from 'next/link';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { getVisibleDatasetIds, isAdmin, batchWhereForUser } from '@/lib/permissions';
import { HomeBody, type HeroBatch } from './HomeBody';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const session = await auth();
  const user = session!.user as any;
  const visible = await getVisibleDatasetIds(user);

  if (!isAdmin(user) && Array.isArray(visible) && visible.length === 0) {
    return <PendingApprovalPage name={user.name ?? user.email} />;
  }

  const where = batchWhereForUser(visible);

  const batches = await prisma.batch.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 6,
    include: {
      dataset: { select: { name: true, slug: true, kind: true } },
      _count: { select: { chips: true, reports: true, records: true } },
      reports: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });

  // 每个 batch 准备 hero 所需数据
  const heroBatches: HeroBatch[] = await Promise.all(
    batches.map(async (b) => {
      const latestReport = b.reports[0];
      let summary: any = null;
      let grades: string[] = [];
      if (latestReport) {
        summary = {
          total: 0,
          yield: 0,
          gradeDistribution: {},
          totalRecommendedPriceCny: 0,
          avgPriceCny: 0,
          ...JSON.parse(latestReport.summary),
        };
        if (b.dataset.kind === 'BUILTIN_CHIP') {
          const assessments = await prisma.chipAssessment.findMany({
            where: { reportId: latestReport.id },
            select: { grade: true },
            take: 1500,
          });
          grades = assessments.map((a) => a.grade);
        } else if (latestReport.assessmentsJson) {
          const items: { grade: string }[] = JSON.parse(latestReport.assessmentsJson);
          grades = items.slice(0, 1500).map((a) => a.grade);
        }
      }
      return {
        id: b.id,
        name: b.name,
        description: b.description,
        datasetName: b.dataset.name,
        datasetKind: b.dataset.kind,
        count: b._count.chips || b._count.records,
        createdAt: b.createdAt.toISOString(),
        hasReport: b._count.reports > 0,
        summary,
        grades,
      };
    }),
  );

  const [datasetsCount, totalChips, totalRecords, totalReports] = await Promise.all([
    prisma.dataset.count({
      where: isAdmin(user) ? {} : { id: { in: visible as string[] } },
    }),
    prisma.chip.count({ where: { batch: where } }),
    prisma.datasetRecord.count({ where: { batch: where } }),
    prisma.report.count({ where: { batch: where } }),
  ]);

  return (
    <div className="p-10 max-w-[1280px]">
      <div className="flex items-baseline justify-between mb-10">
        <div>
          <div className="eyebrow mb-2">DASHBOARD · 00</div>
          <h1 className="display-zh text-5xl text-ink">工作台</h1>
        </div>
        <div className="serial">{new Date().toLocaleString('zh-CN', { hour12: false })}</div>
      </div>

      <HomeBody
        batches={heroBatches}
        isAdmin={isAdmin(user)}
        datasetsCount={datasetsCount}
        totalRecords={totalChips + totalRecords}
        totalReports={totalReports}
      />
    </div>
  );
}

function PendingApprovalPage({ name }: { name: string }) {
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-10">
      <div className="max-w-xl text-center">
        <div className="eyebrow mb-4">PENDING · 等待授权</div>
        <h1 className="display-zh text-5xl text-ink mb-4">你好，{name}</h1>
        <p className="text-base text-ink-2 leading-relaxed mb-2">
          账号已注册成功，但管理员尚未授予你任何数据集的访问权限。
        </p>
        <p className="text-sm text-ink-3 leading-relaxed mb-8">
          请联系管理员（账号 <span className="num text-ink-2">admin</span>）申请授权。
        </p>
        <div className="serial">PENDING-USER-ACCESS · 0 datasets visible</div>
      </div>
    </div>
  );
}
