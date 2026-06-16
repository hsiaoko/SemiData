import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';

export const runtime = 'nodejs';

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user as any)) {
    return NextResponse.json({ error: '仅管理员可删除数据集' }, { status: 403 });
  }
  const ds = await prisma.dataset.findUnique({
    where: { id: params.id },
    include: { _count: { select: { batches: true, records: true } } },
  });
  if (!ds) return NextResponse.json({ error: 'dataset not found' }, { status: 404 });
  if (ds.kind === 'BUILTIN_CHIP') {
    return NextResponse.json({ error: '内置数据集不可删除' }, { status: 400 });
  }
  // 级联删除靠 schema 上的 onDelete: Cascade（Batch / Record / Permission / RuleSet binding）
  await prisma.dataset.delete({ where: { id: params.id } });
  return NextResponse.json({
    ok: true,
    removed: {
      batches: ds._count.batches,
      records: ds._count.records,
    },
  });
}
