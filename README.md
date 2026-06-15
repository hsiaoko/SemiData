# SemiData · 封测数据中枢

芯片封测数据的录入、检索与分级定价分析平台。

- **拖拽 CSV** → 自动识别字段 → 入库（SQLite）
- **多用户 + 角色**（管理员 / 普通）
- **报告**：每颗芯片自动评级 + 推荐价格，导出 PDF / Excel
- **晶圆 Die Grid** 可视化贯穿登录、批次详情、报告封面
- 中文界面，视觉方向：Wafer Iridescent

## 快速开始

### 方式 A：本机直接跑（开发）

```bash
npm install
npx prisma migrate dev --name init --skip-seed
npm run prisma:seed      # 创建账号 + 600 颗示例芯片 + 默认规则集
npm run dev              # http://localhost:3000
```

### 方式 B：Docker（推荐用于异机部署）

```bash
# 1. 启动 Docker Desktop / Engine
# 2. （生产建议）覆盖密钥：
export AUTH_SECRET=$(openssl rand -hex 32)
# 3. 一键构建并启动
docker compose up --build -d
# 4. 看日志确认 migrate + seed 成功
docker compose logs -f semidata
# 5. 访问 http://localhost:3000
```

数据持久化在本地 `./data/prod.db`。换机器只需要把 `./data` 目录带走，再 `docker compose up` 即可。

```bash
# 停止
docker compose down
# 清除数据重新开始
docker compose down && rm -rf data && docker compose up --build -d
```

### 内置账号

| 角色 | 邮箱 | 密码 |
|---|---|---|
| 管理员 | `admin@semidata.local` | `admin1234` |
| 普通用户 | `demo@semidata.local` | `demo1234` |

### 试一遍主流程

1. 登录后会自动看到一份示例批次的工作台
2. 点侧栏「**数据录入**」→ 把 `public/sample-data/sample-200.csv` 拖进去（页面右上角也可下载该示例 CSV）
3. 浏览自动识别的字段映射，确认后入库
4. 在「**批次浏览**」点入这个批次 → 点 **生成报告** → 查看分级、推荐价、散点图
5. 报告右上角点 **导出 PDF** 或 **导出 Excel**
6. 用管理员登录后可访问 `/rules` 调整分级算法权重 / 价格表

## 技术栈

- Next.js 14 App Router · TypeScript
- SQLite + Prisma + better-sqlite3（实际由 Prisma 默认驱动）
- NextAuth (Auth.js) v5 + bcryptjs，JWT session
- Tailwind CSS + 自定义 Wafer Iridescent token
- react-dropzone / papaparse · recharts · exceljs · @react-pdf/renderer

## 数据模型

| 模型 | 含义 |
|---|---|
| `User` | 账号 + 角色 |
| `Batch` | 一次 CSV 上传 = 一个批次 |
| `Chip` | 一颗芯片 / 最小封装单元 |
| `Report` | 对一个 Batch 跑出来的分级 + 定价报告 |
| `ChipAssessment` | 每颗芯片的等级、综合分、推荐价、评级理由 |
| `RuleSet` | 分级算法的字段权重、硬否决、价格表配置 |

## 分级算法（默认规则集）

```
score = 0.7 × ruleScore + 0.3 × percentileScore
```

- `ruleScore`：按 `frequencyMhz / leakageNa / vthV / iddUa` 的区间或理想值打分加权
- `percentileScore`：批内 `frequencyMhz` 的分位
- `failCount > 0` 直接判为 `FAIL`，价格 = 0
- 分级：S ≥ 90, A ≥ 75, B ≥ 60, C ≥ 45, D < 45
- 价格：基础价 × (1 + 同等级内排名微调 ±10%)

算法实现：`lib/grading/`。新接入 ML 模型只需在 `lib/grading/index.ts` 增加 `model` 分支即可。

## 目录结构

```
app/
  (auth)            登录页
  (app)             主应用（带侧栏布局）
    page.tsx        工作台
    upload          数据录入
    batches         批次列表 / 详情 / 报告
    rules           规则配置（admin）
    users           用户管理（admin）
  api/              路由处理器
components/         共享组件（DieGrid, BinBar, Dropzone, DataTable, StatNumber）
lib/
  db.ts             Prisma client
  csv/              CSV 列别名 + 解析
  grading/          规则评分 + 分位 + 价格
  report/           网页报告 + PDF + Excel 共用一份 ReportData
prisma/
  schema.prisma
  seed.ts           默认 admin + 600 颗示例芯片 + 示例 CSV
public/sample-data/sample-200.csv
auth.ts             NextAuth 配置 (Node)
auth.config.ts      NextAuth 配置 (Edge 安全，用于 middleware)
middleware.ts       路由保护
```

## 设计原则

- 视觉签名是「**Live Die Grid**」：一颗芯片 = 一个 12px 方格，按等级着色
- 颜色：硅基板灰 + 钴蓝 + 光刻品红，避开 SaaS 通用 dashboard 配色
- 所有数据相关数字用 JetBrains Mono 等宽，让排版本身传达"工程精度"
- 中文标题用思源黑体细体大字号，与英文 eyebrow（间距很宽的等宽小标签）形成对比

## 已知限制 / 不在范围内

- 仅支持 CSV 离线导入（无实时测试机数据流接入）
- 仅密码登录（无 SSO / LDAP）
- ML 模型为占位接口，尚未训练
- 仅本地 `npm run dev` 使用，未提供生产部署脚本
# SemiData
