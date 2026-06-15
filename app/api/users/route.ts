import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const { email, name, company, password, role } = await req.json();
  if (!email || !name || !company || !password || password.length < 4) {
    return NextResponse.json({ error: '账号/姓名/公司/密码必填，密码至少 4 位' }, { status: 400 });
  }
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return NextResponse.json({ error: '账号已存在' }, { status: 400 });
  const hash = await bcrypt.hash(password, 10);
  const u = await prisma.user.create({
    data: {
      email,
      name,
      company: String(company).slice(0, 120),
      passwordHash: hash,
      role: role === 'ADMIN' ? 'ADMIN' : 'USER',
    },
  });
  return NextResponse.json({ id: u.id });
}
