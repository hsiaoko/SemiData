import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(req: Request) {
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
    await prisma.ruleSet.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
  }
  const created = await prisma.ruleSet.create({
    data: {
      name: String(name).slice(0, 120),
      description: description ? String(description).slice(0, 300) : null,
      rules: rules,
      isDefault: !!isDefault,
      createdById: (session.user as any).id,
    },
  });
  return NextResponse.json({ id: created.id });
}
