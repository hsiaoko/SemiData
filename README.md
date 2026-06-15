# YieldEx Bench · 芯测台

芯片封测数据的录入、检索、分级与定价报告平台。中文界面，视觉方向 **Wafer Iridescent**。

- **多数据集**：管理员可创建任意「数据集」（Dataset），自定义字段 schema
- **权限隔离**：表级授权 — admin 勾选哪些用户能看哪些数据集
- **用户注册**：账号自助注册（无需邮箱），新账号默认零权限，等 admin 授权；注册必填公司
- **拖拽上传**：admin 拖一份 CSV → 自动识别字段 → 入库到指定数据集
- **分级报告**：内置「芯片封测」数据集支持自动分级 + 推荐价格 + PDF / Excel 导出（中文渲染）
- **晶圆 Die Grid**：登录页、工作台、批次详情、报告封面贯穿一致的视觉签名

---

## 快速开始

### 方式 A：本机直接跑

```bash
npm install
npm run setup-fonts       # 下载 PDF 中文字体（Adobe Source Han Sans CN）
npx prisma migrate dev --name init --skip-seed
npm run prisma:seed       # 创建账号 + 600 颗示例芯片 + 默认规则集 + 示例自定义数据集
npm run dev               # http://localhost:3000
```

### 方式 B：Docker

```bash
# 0. 启动 Docker Desktop / Engine
# 1. （生产建议）覆盖密钥
export AUTH_SECRET=$(openssl rand -hex 32)
# 2. 构建并启动（字体在构建期自动下载）
docker compose up --build -d
# 3. 看日志确认 migrate + seed 成功
docker compose logs -f semidata
# 4. 访问 http://localhost:3000
```

数据持久化在本地 `./data/prod.db`。换机器只需把 `./data` 目录带走，再 `docker compose up` 即可。

```bash
docker compose down                                          # 停止
docker compose down && rm -rf data && docker compose up -d   # 清除数据重新开始
```

### 管理员账号

首次部署后跑 seed 会生成一个默认管理员。如需新增管理员或重置密码：

```bash
npx tsx scripts/create-admin.ts <username> <password> [显示名] [公司]
```

普通用户通过 `/signup` 自助注册，注册后处于「等待授权」状态，需由管理员在数据集详情页勾选授权。

### 试一遍主流程

1. **以 admin 登录** → 工作台显示内置「芯片封测数据」的示例报告
2. 侧栏 **数据集** → 点 **+ 新建数据集**，定义字段 schema（如 `sample_id` / `cycles` / `pass`）
3. 侧栏 **数据录入** → 选目标数据集 → 拖 CSV（也可直接下载 `public/sample-data/sample-200.csv`）→ 字段映射 → 入库
4. 进入该数据集详情 → 在 **PERMISSIONS · 用户授权** 面板勾选某个 USER → 保存
5. 退出登录，以该 USER 登录 → 现在可以看到这一个数据集
6. 内置「芯片封测」数据集还可一键 **生成报告** → PDF / Excel 导出，文件名与正文均为中文

---

## 权限模型

| 角色 | 默认能做什么 |
|---|---|
| **ADMIN** | 一切：创建/删除数据集、定义 schema、上传数据、生成报告、授权 USER、管理用户、调整规则 |
| **USER** | 仅查看 admin 勾选授权的数据集；不能上传、不能创建数据集 |

- 注册新账号默认是 USER 且无任何 dataset 权限 → 登录后进「等待授权」页
- 授权粒度为「表级」：勾选 = 能看到这个 dataset（含其下全部批次、记录与报告）
- 所有 API 路由都在服务端做 `canViewDataset()` 校验，前端隐藏只是辅助
- 每个用户可在「我的账号」页修改姓名、公司、密码

---

## 技术栈

- **Next.js 14 App Router** · TypeScript
- **SQLite + Prisma** · 单文件存储，迁移可追溯
- **NextAuth (Auth.js) v5** Credentials + JWT session · bcryptjs
- **Tailwind CSS** + 自定义 Wafer Iridescent design tokens
- **react-dropzone** + **papaparse** 端到端 CSV 上传
- **recharts** + 自研 DieGrid（SVG/Canvas 双引擎）
- **@react-pdf/renderer** 报告 PDF（中文走 Source Han Sans）· **exceljs** 报告 Excel

---

## 数据模型

| 模型 | 含义 |
|---|---|
| `User` | 账号 + 角色（ADMIN / USER）+ 公司，账号 = 任意用户名字符串（不强制邮箱） |
| `Dataset` | 一个「数据集」= 一张逻辑表，`kind` ∈ `BUILTIN_CHIP` / `CUSTOM`，自带 schema JSON |
| `DatasetPermission` | (user × dataset) VIEW 权限 — admin 默认全权，不在表里 |
| `Batch` | 一次 CSV 上传 = 一个批次，归属某个 Dataset |
| `Chip` | 芯片（仅内置 `BUILTIN_CHIP` 使用，保留固定 schema 支持评级算法） |
| `DatasetRecord` | 自定义 dataset 的通用行（一行 = 一个 record，字段塞进 dataJson） |
| `Report` | 对一个 Batch 跑出的分级 + 定价报告 |
| `ChipAssessment` | 每颗芯片的等级、综合分、推荐价、评级理由（中文自然语言） |
| `RuleSet` | 分级算法的字段权重、硬否决、价格表配置 |

---

## 分级算法（仅内置芯片数据集）

```
score = 0.7 × ruleScore + 0.3 × percentileScore
```

- `ruleScore`：按 `frequencyMhz / leakageNa / vthV / iddUa` 的区间或理想值打分加权（**AND 叠加**：所有字段共同贡献综合分）
- `percentileScore`：当前批次内 `frequencyMhz` 的分位
- **硬否决**（`failCount > 0` 等）→ **OR 触发**，任一命中直接判为 `FAIL`，价格 = 0
- 分级映射：`S ≥ 90`，`A ≥ 75`，`B ≥ 60`，`C ≥ 45`，`D < 45`
- 价格：等级基准价 × (1 + 同等级内排名微调 ±10%)
- 算法实现在 `lib/grading/`；接入 ML 模型只需在 `lib/grading/index.ts` 增加 `model` 分支

报告里的 `rationale` 字段会用自然语言解释每颗芯片的评级原因，例如：

> 最高频率 489.8 MHz（在规格内，靠近边界）；漏电流 15.5 nA（位于规格中段，表现良好）；阈值电压 Vth 0.711 V（贴近理想 0.7 V）。综合 81.2 分（规则项 90/100，批内 最高频率 分位 60），列为 一级 (A)，建议单价 ¥13.76。

规则集可视化编辑：admin 登录 → 侧栏 **规则配置**。页面顶部「HOW IT WORKS」面板有详细的 JSON 字段语义、规则间关系、写一条新规则的范例。

---

## 目录结构

```
app/
  login/                     登录页（Die Grid 背景）
  signup/                    注册页（必填账号 / 姓名 / 公司 / 密码）
  (app)/                     主应用（侧栏布局，需登录）
    page.tsx                 工作台
    account/                 我的账号（改资料 / 改密码）
    upload/                  数据录入（选 dataset → 拖 CSV → 字段映射）
    datasets/                数据集列表 / 详情 / 新建（admin）
    batches/                 批次列表 / 详情 / 报告
    rules/                   规则配置 + 使用说明（admin）
    users/                   用户管理（admin）
  api/                       路由处理器（auth / account / batches / datasets / rules / users）
components/                  共享组件（DieGrid / BinBar / Dropzone / DataTable / StatNumber）
lib/
  db.ts                      Prisma client
  colors.ts                  等级 / BIN 颜色映射（服务端/客户端共用）
  permissions.ts             权限工具
  csv/                       CSV 列别名 + 解析
  datasets/builtin.ts        内置芯片 schema
  grading/                   规则评分 + 分位 + 价格 + 自然语言 rationale
  report/                    网页报告数据聚合 + PDF + Excel
prisma/
  schema.prisma
  seed.ts                    内置账号 + 600 颗示例芯片 + 自定义数据集样例 + 示例 CSV
scripts/
  create-admin.ts            新增 / 升级管理员账号
  setup-fonts.sh             下载 PDF 渲染所需的中文字体
public/
  sample-data/sample-200.csv
  fonts/                     运行时下载，.gitignore 排除
auth.ts                      NextAuth 配置（Node 运行时）
auth.config.ts               NextAuth 配置（Edge 安全，供 middleware）
middleware.ts                路由保护
Dockerfile + docker-compose.yml + docker-entrypoint.sh
```

---

## 设计原则

- 视觉签名是 **Live Die Grid**：一颗芯片 = 一个 12px 方格，按等级着色，登录页缓慢呼吸
- 配色：硅基板灰 `#DCD9D2` + 钴蓝 `#1B4FE3` + 光刻品红 `#E63780`，避开 SaaS 通用 dashboard 配色
- 等宽数字：所有数据相关数字用 JetBrains Mono（或系统等宽），让排版本身传达"工程精度"
- 中文标题用思源黑体 / 系统中文字体的细体大字号，与英文 eyebrow（间距很宽的等宽小标签）形成反差

字体为避免内网环境下 dev 编译被 Google Fonts CDN 阻塞，**未引入 `next/font/google`**；PDF 渲染走 Adobe Source Han Sans CN 本地 OTF 字体（由 `npm run setup-fonts` 下载）。

---

## 常用运维命令

```bash
# 新增 / 升级管理员（密码也会被重置）
npx tsx scripts/create-admin.ts <username> <password> [显示名] [公司]

# 在 Docker 容器内执行
docker compose exec semidata npx tsx scripts/create-admin.ts <username> <password>

# 重新下载中文字体（PDF 中文必须）
npm run setup-fonts

# 完全重置数据库（开发期）
rm prisma/dev.db && npx prisma migrate dev --skip-seed && npm run prisma:seed

# 大改后遇到 Next.js dev 报 clientModules / 莫名编译错误
lsof -ti:3000 | xargs kill -9 && rm -rf .next && npm run dev
```

---

## 已知限制 / 不在范围内

- 仅支持 CSV 离线导入，无实时测试机数据流接入
- 仅密码登录，无 SSO / LDAP
- ML 模型为占位接口，尚未训练
- 自定义数据集仅支持查看 / 导入 / 导出原始数据，不自动跑分级（分级算法依赖芯片固定 schema）
- 多用户写并发未做行级锁；同时上传同一批次可能产生重复记录（实际场景受 SQLite 写锁约束）
