import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { isAdmin } from '@/lib/permissions';

export const runtime = 'nodejs';

// 列出该 dataset 已绑定的规则集 — 仅 admin 可见
// 普通用户的"生成报告"按钮不走选择对话框（后端自动选默认）
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!isAdmin(user)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const bindings = await prisma.datasetRuleSet.findMany({
    where: { datasetId: params.id },
    include: { ruleSet: { select: { id: true, name: true, description: true, isDefault: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return NextResponse.json(bindings.map((b) => b.ruleSet));
}

const body = z.object({ ruleSetIds: z.array(z.string()).max(50) });

// 全量替换绑定列表（仅 admin）
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user as any)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }
  const dataset = await prisma.dataset.findUnique({ where: { id: params.id } });
  if (!dataset) return NextResponse.json({ error: 'dataset not found' }, { status: 404 });

  const current = await prisma.datasetRuleSet.findMany({ where: { datasetId: dataset.id } });
  const currentIds = new Set(current.map((b) => b.ruleSetId));
  const target = new Set(parsed.data.ruleSetIds);

  const toAdd = [...target].filter((id) => !currentIds.has(id));
  const toRemove = [...currentIds].filter((id) => !target.has(id));

  await prisma.$transaction([
    ...toAdd.map((ruleSetId) =>
      prisma.datasetRuleSet.create({ data: { datasetId: dataset.id, ruleSetId } }),
    ),
    ...(toRemove.length > 0
      ? [prisma.datasetRuleSet.deleteMany({ where: { datasetId: dataset.id, ruleSetId: { in: toRemove } } })]
      : []),
  ]);

  return NextResponse.json({ added: toAdd.length, removed: toRemove.length });
}
