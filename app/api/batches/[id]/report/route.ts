import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { createReport } from '@/lib/report/generate';
import { canViewDataset, isAdmin } from '@/lib/permissions';

export const runtime = 'nodejs';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const user = session.user as any;
  const userId = user.id as string;

  const batch = await prisma.batch.findUnique({ where: { id: params.id } });
  if (!batch) return NextResponse.json({ error: 'batch not found' }, { status: 404 });
  if (!isAdmin(user) && !(await canViewDataset(user, batch.datasetId))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const body = await _req.json().catch(() => ({} as any));

  // 解析规则集：必须在 dataset 绑定列表里
  const bindings = await prisma.datasetRuleSet.findMany({
    where: { datasetId: batch.datasetId },
    include: { ruleSet: { select: { id: true, isDefault: true } } },
  });
  const boundIds = new Set(bindings.map((b) => b.ruleSetId));

  let ruleSetId: string | undefined = body?.ruleSetId;
  if (ruleSetId) {
    if (!boundIds.has(ruleSetId)) {
      return NextResponse.json(
        { error: '指定的规则集未与该数据集绑定，无权使用' },
        { status: 400 },
      );
    }
  } else {
    // 未指定 — 优先用绑定列表里的 default，否则用绑定列表第一条
    const defaultBound = bindings.find((b) => b.ruleSet.isDefault);
    ruleSetId = defaultBound?.ruleSetId ?? bindings[0]?.ruleSetId;
  }
  if (!ruleSetId) {
    return NextResponse.json(
      { error: '该数据集尚未绑定任何规则集，请联系管理员在数据集详情页绑定后再生成报告' },
      { status: 400 },
    );
  }

  const { reportId, summary } = await createReport({
    batchId: batch.id,
    userId,
    ruleSetId,
  });
  return NextResponse.json({ reportId, summary });
}
