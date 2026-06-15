# 数据导出指南

直接用 `sqlite3` CLI 从数据库读 / 导。三个常用主题：

- [芯片测试数据](#1-芯片测试数据)
- [分级规则](#2-分级规则)
- [用户数据](#3-用户数据)

末尾附 [整库备份与还原](#4-整库备份与还原)。

## 数据库位置

| 环境 | 路径 |
|---|---|
| 本地开发 | `prisma/dev.db` |
| Docker 部署 | `data/prod.db`（容器内 `/data/prod.db`） |

```bash
# 本地
sqlite3 prisma/dev.db

# Docker
docker compose exec semidata sqlite3 /data/prod.db
```

进入交互模式后可用 `.tables`、`.schema <表名>`、`.mode column`、`.headers on`、`.exit` 等元命令。

---

## 1. 芯片测试数据

### 1.1 单批次的所有芯片（原始测试参数）

```bash
sqlite3 -header -csv prisma/dev.db <<'SQL' > chips-of-batch.csv
SELECT chipId, lotId, waferId, dieX, dieY,
       productModel, packageType, testTempC, testVoltageV,
       vthV, iddUa, leakageNa, frequencyMhz, powerMw,
       passCount, failCount, binCode,
       testDurationS, testTimestamp
FROM Chip
WHERE batchId = '<BATCH_ID>'
ORDER BY chipId;
SQL
```

> 把 `<BATCH_ID>` 替换为目标批次 ID。查 ID 用：
> `sqlite3 prisma/dev.db "SELECT id, name, rowCount, createdAt FROM Batch ORDER BY createdAt DESC LIMIT 10;"`

### 1.2 单批次的芯片 + 评级结果（推荐导给客户）

```bash
sqlite3 -header -csv prisma/dev.db <<'SQL' > chips-with-grade.csv
SELECT c.chipId, c.lotId, c.waferId,
       c.frequencyMhz, c.leakageNa, c.vthV, c.iddUa, c.failCount,
       c.binCode AS originalBin,
       a.grade AS recommendedGrade,
       a.score,
       a.recommendedPriceCny,
       a.rationale
FROM ChipAssessment a
JOIN Chip   c ON c.id = a.chipId
WHERE a.reportId = (
  SELECT id FROM Report
  WHERE batchId = '<BATCH_ID>'
  ORDER BY createdAt DESC LIMIT 1
)
ORDER BY c.chipId;
SQL
```

### 1.3 跨批次：某型号芯片的全部数据

```bash
sqlite3 -header -csv prisma/dev.db <<'SQL' > sd-mcu-7a-all.csv
SELECT c.chipId, c.lotId, c.waferId,
       c.frequencyMhz, c.leakageNa, c.vthV, c.iddUa,
       c.binCode, c.testTimestamp,
       b.name AS batchName, b.createdAt AS batchUploadedAt
FROM Chip c
JOIN Batch b ON b.id = c.batchId
WHERE c.productModel = 'SD-MCU-7A'
ORDER BY c.testTimestamp DESC;
SQL
```

### 1.4 按 Lot × Wafer 汇总良率

```bash
sqlite3 -header -csv prisma/dev.db <<'SQL' > yield-by-wafer.csv
SELECT lotId, waferId,
       count(*) AS total,
       sum(CASE WHEN failCount IS NULL OR failCount = 0 THEN 1 ELSE 0 END) AS pass,
       round(100.0 * sum(CASE WHEN failCount IS NULL OR failCount = 0 THEN 1 ELSE 0 END) / count(*), 2) AS yield_pct,
       round(avg(frequencyMhz), 1) AS avg_freq_mhz,
       round(avg(leakageNa),  1)   AS avg_leakage_na
FROM Chip
GROUP BY lotId, waferId
ORDER BY lotId, waferId;
SQL
```

### 1.5 整张报告汇总（含等级分布与推荐总价）

```bash
sqlite3 -header -csv prisma/dev.db <<'SQL' > reports-summary.csv
SELECT r.id AS reportId,
       b.name AS batchName,
       u.name AS generatedBy,
       r.algorithm,
       r.createdAt,
       json_extract(r.summary, '$.total')                    AS total_chips,
       round(json_extract(r.summary, '$.yield') * 100, 2)    AS yield_pct,
       json_extract(r.summary, '$.totalRecommendedPriceCny') AS total_cny,
       round(json_extract(r.summary, '$.avgPriceCny'), 2)    AS avg_price_cny,
       json_extract(r.summary, '$.gradeDistribution')        AS grade_dist_json
FROM Report r
JOIN Batch b ON b.id = r.batchId
JOIN User  u ON u.id = r.generatedById
ORDER BY r.createdAt DESC;
SQL
```

---

## 2. 分级规则

### 2.1 所有规则集（含 JSON 内容）

```bash
sqlite3 -header -csv prisma/dev.db <<'SQL' > rulesets.csv
SELECT id, slug, name, isDefault,
       (SELECT name FROM User WHERE id = createdById) AS createdBy,
       createdAt,
       rules AS rules_json
FROM RuleSet
ORDER BY isDefault DESC, createdAt;
SQL
```

`rules_json` 字段是 JSON 字符串。

### 2.2 把规则 JSON 直接导成单独 .json 文件

```bash
# 单条规则集的 rules JSON 单独保存
sqlite3 prisma/dev.db \
  "SELECT rules FROM RuleSet WHERE isDefault = 1;" \
  > default-ruleset.json
```

### 2.3 拆开规则集里的每条字段评分（方便做表格）

```bash
sqlite3 -header -csv prisma/dev.db <<'SQL' > rule-fields.csv
SELECT
  rs.name                                  AS ruleset,
  json_extract(f.value, '$.field')         AS field,
  json_extract(f.value, '$.weight')        AS weight,
  json_extract(f.value, '$.min')           AS min,
  json_extract(f.value, '$.max')           AS max,
  json_extract(f.value, '$.ideal')         AS ideal,
  json_extract(f.value, '$.tolerance')     AS tolerance
FROM RuleSet rs, json_each(rs.rules, '$.fields') f
ORDER BY rs.name, json_extract(f.value, '$.weight') DESC;
SQL
```

### 2.4 价格表

```bash
sqlite3 -header -csv prisma/dev.db <<'SQL' > price-table.csv
SELECT
  rs.name                                      AS ruleset,
  json_extract(rs.rules, '$.priceTable.S')     AS price_s,
  json_extract(rs.rules, '$.priceTable.A')     AS price_a,
  json_extract(rs.rules, '$.priceTable.B')     AS price_b,
  json_extract(rs.rules, '$.priceTable.C')     AS price_c,
  json_extract(rs.rules, '$.priceTable.D')     AS price_d,
  json_extract(rs.rules, '$.priceTable.FAIL')  AS price_fail
FROM RuleSet rs;
SQL
```

---

## 3. 用户数据

> 密码以 bcrypt 哈希存储，导出包含 `passwordHash` 时务必谨慎对待文件。下面所有查询都**不带**密码哈希。

### 3.1 全部用户

```bash
sqlite3 -header -csv prisma/dev.db <<'SQL' > users.csv
SELECT email AS username, name, company, role, createdAt
FROM User
ORDER BY createdAt;
SQL
```

### 3.2 用户授权矩阵（谁能看哪些数据集）

```bash
sqlite3 -header -csv prisma/dev.db <<'SQL' > user-permissions.csv
SELECT u.email AS username, u.name, u.company,
       d.slug  AS dataset_slug,
       d.name  AS dataset_name,
       d.kind,
       p.grantedAt
FROM DatasetPermission p
JOIN User    u ON u.id = p.userId
JOIN Dataset d ON d.id = p.datasetId
ORDER BY u.email, d.kind, d.name;
SQL
```

### 3.3 普通用户尚未被授权的列表

```bash
sqlite3 -header -csv prisma/dev.db <<'SQL' > unauthorized-users.csv
SELECT email AS username, name, company, createdAt
FROM User
WHERE role = 'USER'
  AND id NOT IN (SELECT DISTINCT userId FROM DatasetPermission)
ORDER BY createdAt;
SQL
```

### 3.4 用户活动统计（上传 / 报告 / 数据集创建）

```bash
sqlite3 -header -csv prisma/dev.db <<'SQL' > user-activity.csv
SELECT u.email AS username, u.name, u.company, u.role,
       (SELECT count(*) FROM Batch    WHERE uploadedById  = u.id) AS uploads,
       (SELECT count(*) FROM Report   WHERE generatedById = u.id) AS reports_generated,
       (SELECT count(*) FROM Dataset  WHERE createdById   = u.id) AS datasets_created,
       (SELECT count(*) FROM DatasetPermission WHERE userId = u.id) AS datasets_can_view
FROM User u
ORDER BY uploads + reports_generated DESC;
SQL
```

---

## 4. 整库备份与还原

### 备份

```bash
# A. 文件级复制（最快，单文件）
cp prisma/dev.db prisma/dev.db.bak

# B. 在线 .backup（对运行中的 DB 安全，推荐）
sqlite3 prisma/dev.db ".backup prisma/dev.db.bak"

# C. SQL 文本 dump（含 schema + 数据，可读、可 diff、可跨版本恢复）
sqlite3 prisma/dev.db .dump > backup-$(date +%Y%m%d).sql

# Docker 环境
docker compose exec semidata sqlite3 /data/prod.db .dump > backup.sql
```

### 还原

```bash
# 从 .bak 文件恢复
cp prisma/dev.db.bak prisma/dev.db

# 从 .sql dump 恢复
rm prisma/dev.db
sqlite3 prisma/dev.db < backup.sql
```

---

## 一次性脚本范例（导全部三类）

把上述查询打成一个脚本：

```bash
#!/bin/sh
# scripts/export-snapshot.sh
set -e
DB="${1:-prisma/dev.db}"
OUT="exports-$(date +%Y%m%d-%H%M)"
mkdir -p "$OUT"

echo "→ 导出到 $OUT/"

# 芯片数据 + 评级
sqlite3 -header -csv "$DB" "
SELECT c.chipId, c.lotId, c.waferId, c.binCode,
       c.frequencyMhz, c.leakageNa, c.vthV, c.iddUa, c.failCount,
       a.grade, a.score, a.recommendedPriceCny, a.rationale,
       b.name AS batchName
FROM ChipAssessment a
JOIN Chip c  ON c.id = a.chipId
JOIN Batch b ON b.id = c.batchId
ORDER BY b.name, c.chipId;" > "$OUT/chips-graded.csv"

# 规则
sqlite3 -header -csv "$DB" \
  "SELECT name, isDefault, createdAt, rules FROM RuleSet;" \
  > "$OUT/rulesets.csv"

# 用户 + 授权
sqlite3 -header -csv "$DB" \
  "SELECT email, name, company, role, createdAt FROM User ORDER BY createdAt;" \
  > "$OUT/users.csv"
sqlite3 -header -csv "$DB" "
SELECT u.email AS username, u.name, d.name AS dataset, d.kind, p.grantedAt
FROM DatasetPermission p
JOIN User u    ON u.id = p.userId
JOIN Dataset d ON d.id = p.datasetId
ORDER BY u.email;" > "$OUT/permissions.csv"

echo "✓ 完成"
ls -lh "$OUT/"
```

用法：

```bash
chmod +x scripts/export-snapshot.sh
./scripts/export-snapshot.sh                  # 本地 dev.db
./scripts/export-snapshot.sh data/prod.db     # Docker 库
```
