import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const body = await req.json();
  const { name, description, rules, isDefault } = body as any;
  try {
    JSON.parse(rules);
  } catch {
    return NextResponse.json({ error: 'rules 必须是合法 JSON' }, { status: 400 });
  }
  if (isDefault) {
    await prisma.ruleSet.updateMany({ where: { isDefault: true, NOT: { id: params.id } }, data: { isDefault: false } });
  }
  await prisma.ruleSet.update({
    where: { id: params.id },
    data: {
      name: String(name).slice(0, 120),
      description: description ? String(description).slice(0, 300) : null,
      rules,
      isDefault: !!isDefault,
    },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const rs = await prisma.ruleSet.findUnique({ where: { id: params.id } });
  if (!rs) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (rs.isDefault) return NextResponse.json({ error: '不可删除默认规则集' }, { status: 400 });
  const usedBy = await prisma.report.count({ where: { ruleSetId: params.id } });
  if (usedBy > 0) {
    return NextResponse.json({ error: `已有 ${usedBy} 份报告引用此规则集，不可删除` }, { status: 400 });
  }
  await prisma.ruleSet.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
