import Link from 'next/link';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { StatNumber } from '@/components/StatNumber';
import { BinBar } from '@/components/BinBar';
import { DieGrid } from '@/components/DieGrid';
import { gradeColor } from '@/lib/colors';
import { getVisibleDatasetIds, isAdmin, batchWhereForUser } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const session = await auth();
  const user = session!.user as any;
  const visible = await getVisibleDatasetIds(user);

  // 普通用户 + 无任何授权 → 等待授权页
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

  const heroBatch = batches.find((b) => b.reports.length > 0 && b.dataset.kind === 'BUILTIN_CHIP') ?? batches[0];
  let heroDies: { color: string; x: 0; y: 0 }[] = [];
  let heroSummary: any = null;
  if (heroBatch?.reports[0]) {
    heroSummary = {
      total: 0, yield: 0, gradeDistribution: {}, totalRecommendedPriceCny: 0, avgPriceCny: 0,
      ...JSON.parse(heroBatch.reports[0].summary),
    };
    const assessments = await prisma.chipAssessment.findMany({
      where: { reportId: heroBatch.reports[0].id },
      select: { grade: true },
      take: 1500,
    });
    heroDies = assessments.map((a) => ({ x: 0, y: 0, color: gradeColor(a.grade) }));
  }

  const [datasetsCount, totalChips, totalReports] = await Promise.all([
    prisma.dataset.count({
      where: isAdmin(user) ? {} : { id: { in: visible as string[] } },
    }),
    prisma.chip.count({ where: { batch: where } }),
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

      {heroBatch && heroSummary ? (
        <section className="grid grid-cols-[auto_1fr] gap-10 mb-14 border-t border-b border-line py-10">
          <div>
            <DieGrid dies={heroDies} size={300} />
            <div className="serial mt-3 text-center">{heroBatch.dataset.name}</div>
          </div>
          <div className="flex flex-col justify-between">
            <div>
              <div className="serial mb-2">LATEST · {heroBatch.id.slice(-6).toUpperCase()}</div>
              <h2 className="display-zh text-3xl text-ink mb-1">{heroBatch.name}</h2>
              <div className="text-sm text-ink-3">{heroBatch.description ?? '—'}</div>
            </div>
            <div className="grid grid-cols-4 gap-6">
              <StatNumber label="芯片数" value={heroSummary.total.toLocaleString()} size="md" />
              <StatNumber
                label="良率"
                value={`${(heroSummary.yield * 100).toFixed(1)}%`}
                size="md"
                accent={heroSummary.yield > 0.9 ? 'cobalt' : 'pink'}
              />
              <StatNumber
                label="推荐总价"
                value={`¥${Math.round(heroSummary.totalRecommendedPriceCny).toLocaleString()}`}
                size="md"
                accent="cobalt"
              />
              <StatNumber label="平均单价" value={`¥${heroSummary.avgPriceCny.toFixed(2)}`} size="md" />
            </div>
            <div>
              <div className="eyebrow mb-2">GRADE DISTRIBUTION</div>
              <BinBar distribution={heroSummary.gradeDistribution} order={['S', 'A', 'B', 'C', 'D', 'FAIL']} height={20} />
            </div>
            <div className="flex gap-3">
              <Link href={`/batches/${heroBatch.id}/report`} className="btn-primary">查看完整报告 →</Link>
              <Link href={`/batches/${heroBatch.id}`} className="btn-ghost">浏览芯片明细</Link>
            </div>
          </div>
        </section>
      ) : (
        <section className="mb-14 border-t border-b border-line py-16 text-center">
          <div className="eyebrow mb-3">NO DATA</div>
          <h2 className="display-zh text-3xl mb-3">{isAdmin(user) ? '尚无任何批次' : '已授权数据集暂无数据'}</h2>
          <p className="text-sm text-ink-3 mb-6">
            {isAdmin(user) ? '前往「数据录入」拖一份 CSV 开始' : '等待管理员上传数据'}
          </p>
          {isAdmin(user) && <Link href="/upload" className="btn-primary">前往数据录入 →</Link>}
        </section>
      )}

      <div className="grid grid-cols-3 gap-6">
        <div className="card p-6">
          <div className="eyebrow mb-4">RECENT BATCHES</div>
          {batches.length === 0 ? (
            <div className="text-ink-3 text-sm">暂无批次</div>
          ) : (
            <ul className="divide-y divide-line">
              {batches.map((b) => (
                <li key={b.id} className="py-3 first:pt-0 last:pb-0">
                  <Link
                    href={b.dataset.kind === 'BUILTIN_CHIP' ? `/batches/${b.id}` : `/datasets/${b.datasetId}`}
                    className="block hover:text-cobalt"
                  >
                    <div className="text-sm font-medium truncate">{b.name}</div>
                    <div className="serial mt-0.5 flex gap-3">
                      <span>{(b._count.chips || b._count.records).toLocaleString()} 行</span>
                      <span>{b.dataset.name}</span>
                      <span className="ml-auto">{new Date(b.createdAt).toLocaleDateString('zh-CN')}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card p-6">
          <div className="eyebrow mb-4">SCOPE · {isAdmin(user) ? 'ALL DATA' : 'YOUR ACCESS'}</div>
          <div className="space-y-5">
            <StatNumber label="可见数据集" value={datasetsCount.toLocaleString()} size="sm" />
            <StatNumber label="芯片记录数" value={totalChips.toLocaleString()} size="sm" />
            <StatNumber label="报告总数" value={totalReports.toLocaleString()} size="sm" />
          </div>
        </div>
        <div className="card p-6 flex flex-col justify-between">
          <div>
            <div className="eyebrow mb-4">QUICK ACTIONS</div>
            <div className="space-y-3">
              <Link href="/datasets" className="btn-ghost w-full justify-center">浏览数据集</Link>
              {isAdmin(user) && <Link href="/upload" className="btn-primary w-full justify-center">+ 上传新批次</Link>}
              {isAdmin(user) && <Link href="/datasets/new" className="btn-ghost w-full justify-center">+ 新建数据集</Link>}
            </div>
          </div>
          <div className="serial mt-6 leading-relaxed">
            提示：每个数据集独立 schema、独立授权。普通用户只能看到 admin 勾选过的数据集。
          </div>
        </div>
      </div>
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
          管理员会在「数据集」详情页勾选你的账号，授权后刷新即可访问。
        </p>
        <div className="serial">PENDING-USER-ACCESS · 0 datasets visible</div>
      </div>
    </div>
  );
}
