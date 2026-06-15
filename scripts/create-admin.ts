/* eslint-disable no-console */
// 用法：npx tsx scripts/create-admin.ts <username> <password> [显示名] [公司]
//      npx tsx scripts/create-admin.ts chenmk 123456 陈某某 YieldEx
//
// username 直接作为登录账号（无需邮箱）。
// 已存在的账号会被升级为 ADMIN，并重置密码。

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const [username, password, name, company] = process.argv.slice(2);
  if (!username || !password) {
    console.error('用法: npx tsx scripts/create-admin.ts <username> <password> [显示名] [公司]');
    process.exit(1);
  }
  const displayName = name ?? username;
  const companyName = company ?? 'YieldEx 内部';
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email: username },
    update: { passwordHash, role: 'ADMIN', name: displayName, company: companyName },
    create: { email: username, passwordHash, role: 'ADMIN', name: displayName, company: companyName },
  });

  console.log(`✓ 管理员就绪：${user.email} · ${user.company} · 角色 ${user.role}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
