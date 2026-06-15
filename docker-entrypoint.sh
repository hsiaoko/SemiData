#!/bin/sh
set -e

echo "→ 应用迁移…"
npx prisma migrate deploy

# 首次启动时跑 seed（用 SEED_SENTINEL 文件做幂等标记）
SENTINEL="/data/.seeded"
if [ ! -f "$SENTINEL" ]; then
  echo "→ 首次启动：写入示例账号 / 规则集 / 示例批次…"
  npx tsx prisma/seed.ts || echo "⚠ seed 失败，继续启动"
  touch "$SENTINEL"
else
  echo "→ 已有 sentinel，跳过 seed"
fi

echo "→ 启动 Next.js…"
exec npx next start -p "${PORT:-3000}" -H 0.0.0.0
