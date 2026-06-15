#!/bin/sh
# 把芯片+评级、规则、用户+授权 一次性导成 CSV
# 用法：
#   ./scripts/export-snapshot.sh                  # 用 prisma/dev.db
#   ./scripts/export-snapshot.sh data/prod.db     # 自定义路径

set -e
DB="${1:-prisma/dev.db}"

if [ ! -f "$DB" ]; then
  echo "✗ 数据库文件不存在：$DB" >&2
  exit 1
fi

OUT="exports-$(date +%Y%m%d-%H%M)"
mkdir -p "$OUT"

echo "→ 数据库：$DB"
echo "→ 输出目录：$OUT/"

# 1. 芯片 + 最新报告评级
sqlite3 -header -csv "$DB" "
SELECT c.chipId, c.lotId, c.waferId, c.binCode,
       c.frequencyMhz, c.leakageNa, c.vthV, c.iddUa, c.failCount,
       a.grade, a.score, a.recommendedPriceCny, a.rationale,
       b.name AS batchName
FROM ChipAssessment a
JOIN Chip  c ON c.id = a.chipId
JOIN Batch b ON b.id = c.batchId
ORDER BY b.name, c.chipId;" > "$OUT/chips-graded.csv"

# 2. 全部芯片原始数据（无评级）
sqlite3 -header -csv "$DB" "
SELECT b.name AS batchName,
       c.chipId, c.lotId, c.waferId, c.dieX, c.dieY,
       c.frequencyMhz, c.leakageNa, c.vthV, c.iddUa, c.powerMw,
       c.passCount, c.failCount, c.binCode, c.testTimestamp
FROM Chip c
JOIN Batch b ON b.id = c.batchId
ORDER BY b.name, c.chipId;" > "$OUT/chips-raw.csv"

# 3. 规则集
sqlite3 -header -csv "$DB" \
  "SELECT name, isDefault, createdAt, rules FROM RuleSet;" \
  > "$OUT/rulesets.csv"

# 4. 用户（不含密码哈希）
sqlite3 -header -csv "$DB" \
  "SELECT email AS username, name, company, role, createdAt FROM User ORDER BY createdAt;" \
  > "$OUT/users.csv"

# 5. 授权矩阵
sqlite3 -header -csv "$DB" "
SELECT u.email AS username, u.name, u.company,
       d.slug AS dataset_slug, d.name AS dataset_name, d.kind,
       p.grantedAt
FROM DatasetPermission p
JOIN User    u ON u.id = p.userId
JOIN Dataset d ON d.id = p.datasetId
ORDER BY u.email, d.kind, d.name;" > "$OUT/permissions.csv"

# 6. 报告汇总
sqlite3 -header -csv "$DB" "
SELECT r.id AS reportId, b.name AS batchName,
       u.name AS generatedBy, r.algorithm, r.createdAt,
       json_extract(r.summary, '\$.total')                    AS total_chips,
       round(json_extract(r.summary, '\$.yield') * 100, 2)    AS yield_pct,
       json_extract(r.summary, '\$.totalRecommendedPriceCny') AS total_cny,
       round(json_extract(r.summary, '\$.avgPriceCny'), 2)    AS avg_price_cny
FROM Report r
JOIN Batch b ON b.id = r.batchId
JOIN User  u ON u.id = r.generatedById
ORDER BY r.createdAt DESC;" > "$OUT/reports.csv"

echo "✓ 完成"
ls -lh "$OUT/"
