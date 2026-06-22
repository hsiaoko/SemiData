# YieldEx Bench · 芯测台

芯片封测 / 闪存老化 / 任意自定义测试数据的录入、检索、分级与定价报告平台。中文界面，视觉方向 **Wafer Iridescent**。

- **多数据集**：管理员任意创建「数据集」（Dataset），自定义字段 schema
- **多对多规则集**：每个数据集可绑定一条或多条评级规则；admin 决定可用规则，user 不可见
- **通用评级算法**：不再只支持内置芯片字段 — 任何 CUSTOM 数据集都能配规则跑报告（含 `notEquals` 硬否决、自动解析 `"X.XX MB/s"` 字符串数值）
- **权限隔离**：表级授权 — admin 勾选哪些用户能看哪些数据集
- **用户注册**：账号自助注册（无需邮箱，仅用户名），新账号默认零权限；注册必填公司
- **拖拽上传**：admin 拖一份 CSV → 自动识别字段 → 入库到指定数据集
- **分级报告**：网页 / PDF / Excel 三种形态，全部中文渲染；自然语言 rationale 解释每条记录的评级原因
- **导出含 Y 列**：任何有 VIEW 权限的用户都能导出全部数据；如数据集绑了规则，自动附加等级 / 综合分 / 推荐价 / 评级理由
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

### 方式 C：生产模式后台运行（PM2，适合 VPS / 云服务器裸机部署）

如果不想用 Docker，想直接在云服务器（腾讯云 / 阿里云 / AWS EC2 等）以守护进程方式跑，推荐 PM2：

```bash
# 1. 安装依赖与构建产物（一次性）
npm install
npm run setup-fonts              # 下载 PDF 中文字体
npx prisma migrate deploy        # 生产用 deploy，不要用 dev
npm run prisma:seed              # 仅首次部署需要
npm run build                    # ★ 生产模式必须 build；不 build 就 start 会报 prerender-manifest.json 缺失

# 2. 配置 .env（项目根目录，已 .gitignore，需要在服务器上手动创建）
cat > .env <<EOF
DATABASE_URL="file:./prisma/prod.db"
AUTH_SECRET="$(openssl rand -hex 32)"
NEXTAUTH_URL="http://你的公网IP:3000"
EOF

# 3. 用 PM2 守护
npm install -g pm2
pm2 start npm --name yieldex -- start    # 后台跑 `npm run start`
pm2 logs yieldex                          # 跟踪日志
pm2 save                                  # 保存当前进程列表
pm2 startup                               # 开机自启；按提示复制最后一行 sudo 命令执行一次
```

之后浏览器访问 `http://你的公网IP:3000` 即可。

**云服务器还要开 3000 端口**：控制台 → 安全组 → 入站规则 → 新增一条：协议 `TCP`，端口 `3000`，来源 `0.0.0.0/0`（含义：放开给所有 IP；自有内网部署可填具体网段）。系统层若开了 `ufw` 还需 `sudo ufw allow 3000/tcp`。

**改了代码 / 拉了新版本**：

```bash
git pull
npm install                      # 依赖有变才需要
npx prisma migrate deploy        # 有新迁移才需要
npm run build
pm2 restart yieldex
```

**常用 PM2 命令**：

```bash
pm2 status                   # 看所有进程
pm2 logs yieldex --lines 100 # 看最近 100 行日志
pm2 restart yieldex
pm2 stop yieldex
pm2 delete yieldex           # 彻底移除
pm2 monit                    # 实时 CPU/内存监控面板
```

**关于域名 / HTTPS**：换访问地址（绑了域名、加了 Nginx 反代、上了 HTTPS）后，记得同步改 `.env` 里的 `NEXTAUTH_URL` 再 `pm2 restart yieldex`。`trustHost: true` 已配置，所以任何 host 都能正常签发 session，但登录回调跳转仍以 `NEXTAUTH_URL` 为准。

**用 Nginx 反代到 80/443**（推荐生产用法）：

```nginx
server {
  listen 80;
  server_name 你的域名;
  client_max_body_size 100M;     # CSV 上传可能较大
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

配好后 `.env` 中改 `NEXTAUTH_URL="http://你的域名"`（不带 :3000），并把云安全组的 3000 端口关掉、只开放 80/443。

### 方式 D：打包成镜像分发（生产）

```bash
# 多平台构建（Mac M 系列开发机 → x86 服务器必须指定 --platform）
docker buildx build --platform linux/amd64 -t yieldex:0.1 --load .

# 选一：导出 tar 直传服务器
docker save yieldex:0.1 | gzip > yieldex-0.1.tar.gz
scp yieldex-0.1.tar.gz user@server:~
ssh user@server "gunzip -c yieldex-0.1.tar.gz | docker load"

# 选二：推 GitHub Container Registry
docker login ghcr.io -u hsiaoko
docker buildx build --platform linux/amd64,linux/arm64 \
  -t ghcr.io/hsiaoko/semidata:latest --push .

# 服务器侧 docker-compose.yml 把 build: . 换成 image: <镜像 tag>
docker compose up -d
```

### 管理员账号

首次部署后跑 seed 会生成一个默认管理员。如需新增管理员或重置密码：

```bash
npx tsx scripts/create-admin.ts <username> <password> [显示名] [公司]
# Docker
docker compose exec semidata npx tsx scripts/create-admin.ts <username> <password>
```

普通用户通过 `/signup` 自助注册，注册后处于「等待授权」状态，需由管理员在数据集详情页 **PERMISSIONS · 用户授权** 面板勾选。

### 试一遍主流程

1. **以 admin 登录** → 工作台显示最新有报告的批次；点 RECENT BATCHES 里的任意批次 → 顶部统计切换
2. 侧栏 **数据集** → 点 **+ 新建数据集**，定义字段 schema
3. 进入新数据集详情 → **RULE SETS** 面板勾选评级规则 → 保存
4. **PERMISSIONS** 面板勾选哪些用户能看 → 保存
5. 侧栏 **数据录入** → 选目标数据集 → 拖 CSV → 字段映射 → 入库
6. 回数据集详情，点「**导出全部 CSV + Y 列 ↓**」就能拿到含等级/推荐价/评级理由的完整表
7. 在批次详情或报告页可一键 **导出 PDF / Excel**

---

## 工作台交互

- **Hero（顶部统计卡）**：默认显示最新有报告的批次 — DieGrid + 良率 + 推荐总价 + 等级分布
- **RECENT BATCHES 面板**：
  - 点 batch **标题** → 仅更新顶部 Hero（不跳页）
  - 点行尾 **「详情 →」** → 跳转到批次详情页
- 当前选中的批次标题前有蓝色 ▸ 标记

---

## 权限模型

| 角色 | 默认能做什么 |
|---|---|
| **ADMIN** | 一切：创建/删除数据集、定义 schema、上传数据、绑定/解绑规则集、生成报告、授权 USER、管理用户、写规则 |
| **USER** | 仅查看 admin 勾选授权的数据集；不能上传、不能创建数据集、**不见规则集名字**（报告里规则用「已应用分析规则」泛称） |

- 注册新账号默认是 USER 且无任何 dataset 权限 → 登录后进「等待授权」页
- 授权粒度为「表级」：勾选 = 能看到这个 dataset（含其下全部批次、记录与报告）
- 所有 API 路由都在服务端做 `canViewDataset()` / `isAdmin()` 校验，前端隐藏只是辅助
- 每个用户可在「**我的账号**」页改自己的姓名 / 公司 / 密码（账号本身不可改）

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
| `User` | 账号 + 姓名 + 公司（必填）+ 角色（ADMIN / USER） |
| `Dataset` | 一个「数据集」= 一张逻辑表，`kind` ∈ `BUILTIN_CHIP` / `CUSTOM`，自带 schema JSON |
| `DatasetPermission` | (user × dataset) VIEW 权限 — admin 默认全权，不在表里 |
| `DatasetRuleSet` | (dataset × ruleSet) 多对多绑定，admin 决定哪些规则可用于该数据集的报告 |
| `Batch` | 一次 CSV 上传 = 一个批次，归属某个 Dataset |
| `Chip` | 芯片（仅内置 `BUILTIN_CHIP` 使用，保留固定 schema 支持原算法） |
| `DatasetRecord` | 自定义 dataset 的通用行（一行 = 一个 record，字段塞进 dataJson） |
| `Report` | 对一个 Batch 跑出的分级 + 定价报告（含 summary；CUSTOM 还多一个 assessmentsJson） |
| `ChipAssessment` | BUILTIN_CHIP 报告的每颗芯片评级（chipId 关联） |
| `RuleSet` | 评级算法的字段权重、硬否决、价格表配置 |

---

## 评级算法 · 规则 = X₁ ∧ X₂ ∧ … → Y

```
综合分 = 规则分 × (1 - percentileWeight)
        + 批内分位分 × percentileWeight
```

- **fields**（软评分）：每个字段 `min / max / ideal / tolerance` 计算 0–100 子分，按 `weight` 加权平均 → 规则分。**叠加关系**（AND）：所有字段共同贡献
- **hardReject**（硬否决）：任一命中即判 FAIL，价格 = 0，不参与综合分。**OR 关系**（一票否决）。支持 `greaterThan / lessThan / equals / notEquals`
- **percentileField**：批内分位评分参考字段；数据是 `"9.58 MB/s"` 这种字符串也能解析数字前缀
- **分级映射**：S ≥ 90 / A ≥ 75 / B ≥ 60 / C ≥ 45 / D < 45
- **价格**：等级基准价 × (1 + 同等级内排名微调 ±10%)

报告里的 `rationale` 用自然语言解释，例如：

> read_speed 94.7（位于规格中段，表现良好）；write_speed 72.5（位于规格中段，表现良好）。综合 90.6 分（规则项 88/100，批内 write_speed 分位 98），列为 特级 (S)，建议单价 ¥12.78。

FAIL 行直接说明命中的硬否决条件：

> result = SIZE OVER LIMIT（命中硬否决条件 ≠ PASS）。该芯片不参与综合评分，直接判为 失效 (FAIL)，不建议出货。

规则集可视化编辑：admin 登录 → 侧栏 **规则配置**。页面顶部「HOW IT WORKS · 如何写一条规则」帮助面板（通用版，不绑死任何具体 schema）有详细的 JSON 字段语义、字段评分 vs 硬否决的区别、写一条新规则的完整范例。

---

## 数据导出

### A. 报告导出（PDF / Excel）

报告页右上「导出 PDF →」「导出 Excel」按钮，或批次详情页同样按钮。两种数据集（BUILTIN_CHIP / CUSTOM）都支持，文件名与正文均为中文。PDF 中文走 Adobe Source Han Sans CN。

### B. 数据集级导出（含 Y 列）

任何对该数据集有 VIEW 权限的用户都能用 — 在数据集详情页点：

- **导出全部 CSV + Y 列 ↓**
- **导出全部 Excel + Y 列 ↓**

导出包含 schema 全部列 + 所属批次列；如果该 dataset 绑定了规则集，自动附加 4 列：等级 / 综合分 / 推荐价 / 评级理由。Excel 中等级单元格自动按颜色着色。

### C. 批次级原始数据

批次详情页「导出原始 CSV / Excel」— 不含评级，仅原始 schema 列。

### D. 命令行 SQL 导出

详细指南：[docs/data-export.md](docs/data-export.md)。

一键导一份"快照"：

```bash
./scripts/export-snapshot.sh                  # 本地 dev.db
./scripts/export-snapshot.sh data/prod.db     # Docker 部署库
docker compose exec semidata sh /app/scripts/export-snapshot.sh /data/prod.db
```

输出到 `exports-YYYYMMDD-HHMM/` 目录，包含 6 个 CSV：芯片+评级、芯片原始数据、规则集、用户、授权矩阵、报告汇总。

---

## 目录结构

```
app/
  login/                     登录页（Die Grid 背景）
  signup/                    注册页（必填账号 / 姓名 / 公司 / 密码）
  (app)/                     主应用（侧栏布局，需登录）
    page.tsx                 工作台（server，调 HomeBody client）
    HomeBody.tsx             工作台 client：Hero 切换 + 三栏
    account/                 我的账号（改资料 / 改密码）
    upload/                  数据录入（选 dataset → 拖 CSV → 字段映射）
    datasets/                数据集列表 / 详情 / 新建（admin）
      [id]/PermissionsPanel  授权用户（admin）
      [id]/RuleSetsPanel     绑定规则集（admin）
      [id]/DeleteDatasetButton  删除（admin，BUILTIN 不可删）
    batches/                 批次列表 / 详情 / 报告
      [id]/page              BUILTIN 走 DieGrid + 散点 + 芯片表；CUSTOM 走简化版
    rules/                   规则配置（admin） + 通用帮助面板
    users/                   用户管理（admin）
  api/                       路由处理器
    auth/[...nextauth]       NextAuth
    auth/register            注册
    account                  改自己的资料/密码
    batches/[id]/report      生成报告（按绑定规则）
    batches/[id]/export      报告 PDF/Excel 导出
    batches/[id]/export-raw  原始数据 CSV/Excel
    datasets/[id]            DELETE
    datasets/[id]/export     含 Y 列的全量导出
    datasets/[id]/permissions  授权
    datasets/[id]/rule-sets    规则绑定（仅 admin）
    rules                    规则 CRUD
    users                    用户 CRUD
components/                  共享组件（DieGrid / BinBar / Dropzone / DataTable / StatNumber / SessionProvider / SignOutButton）
lib/
  db.ts                      Prisma client
  colors.ts                  等级 / BIN 颜色（服务端/客户端共用）
  permissions.ts             权限工具（isAdmin / canViewDataset / getVisibleDatasetIds）
  csv/                       CSV 列别名 + 解析
  datasets/builtin.ts        内置芯片 schema
  grading/                   通用评级（支持 string 字段 + notEquals + percentile）
  report/
    generate.ts              报告生成（BUILTIN 走 ChipAssessment / CUSTOM 走 assessmentsJson）
    pdf.tsx / excel.ts       BUILTIN_CHIP 报告导出
    custom-pdf.tsx / custom-excel.ts  CUSTOM 报告导出（动态列）
  export/csv.ts              CSV 工具（UTF-8 BOM + RFC 5987 文件名）
prisma/
  schema.prisma
  migrations/                所有迁移历史
  seed.ts                    seed admin / demo / 内置芯片 dataset / 默认规则集 / 自定义示例
scripts/
  create-admin.ts            新增 / 升级管理员账号
  setup-fonts.sh             下载 PDF 渲染所需的中文字体
  export-snapshot.sh         一键导 6 份 CSV 快照
public/
  sample-data/sample-200.csv 内置芯片示例 CSV
  sample-data/h5-flash-test-sample.csv  闪存示例 CSV
  fonts/                     运行时下载，.gitignore 排除
auth.ts                      NextAuth 配置（Node 运行时）
auth.config.ts               NextAuth 配置（Edge 安全，供 middleware）
middleware.ts                路由保护
Dockerfile + docker-compose.yml + docker-entrypoint.sh
docs/
  data-export.md             SQL 导出 / 备份指南
```

---

## 设计原则

- 视觉签名是 **Live Die Grid**：一颗芯片 = 一个 12px 方格，按等级着色，登录页缓慢呼吸
- 配色：硅基板灰 `#DCD9D2` + 钴蓝 `#1B4FE3` + 光刻品红 `#E63780`，避开 SaaS 通用 dashboard 配色
- 等宽数字：所有数据相关数字用 JetBrains Mono（或系统等宽），让排版本身传达「工程精度」
- 中文标题用思源黑体 / 系统中文字体的细体大字号，与英文 eyebrow（间距很宽的等宽小标签）形成反差

字体为避免内网环境下 dev 编译被 Google Fonts CDN 阻塞，**未引入 `next/font/google`**；PDF 渲染走 Adobe Source Han Sans CN 本地 OTF 字体（由 `npm run setup-fonts` 下载，约 16 MB，已 `.gitignore`）。

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

# 跨架构 build 镜像（Mac → Linux 服务器）
docker buildx build --platform linux/amd64 -t yieldex:0.1 --load .
```

---

## 已知限制 / 不在范围内

- 仅支持 CSV 离线导入，无实时测试机数据流接入
- 仅密码登录，无 SSO / LDAP
- ML 模型为占位接口，尚未训练
- 多用户写并发未做行级锁；同时上传同一批次可能产生重复记录（实际场景受 SQLite 写锁约束）
- SQLite 单文件部署，记录数 ~ 100 万 / 数据集 仍可流畅；更大量级建议替换 Postgres
