# 多多贝 · 官网静态站（duoduobei-web）

多多贝（duoduobei.com）品牌官网与落地页的纯静态站点。内容由 `*.template.html` + YAML 数据文件经构建脚本渲染生成，部署到 Cloudflare Pages。

## 技术栈

- 纯静态 HTML（无框架、无运行时）
- 构建脚本：Node.js（原生，无打包器）
- 模板渲染：自写的轻量占位符替换（`{{path.to.value}}` 标量替换 + `{{#each}}` / `{{#if}}` 块，支持嵌套与 `{{{ }}}` 原样输出）
- YAML 内容文件：`landing.content.yml`（**派生物**，见下文「内容来源与同步」）

## 目录结构

```
duoduobei-web/
├── landing.template.html   # 首页模板（输出 index.html）
├── about.template.html     # 关于页模板（输出 about.html）
├── story.template.html     # 品牌故事页模板（输出 story.html）
├── legal.template.html     # 法律/说明长文页模板（输出 privacy/terms/disclaimer/donate.html）
├── landing.content.yml     # 主站渲染数据（隐私/服务条款/免责/赞赏为派生，由文档站同步而来）
├── build-landing.mjs       # 构建脚本：渲染模板
├── scripts/
│   └── sync-docs-content.mjs  # 把文档站 Markdown 同步进 landing.content.yml（文档站→主站）
├── logos/ logo-delivery/   # 品牌素材
├── personality/            # 投资人格测试小游戏（子项目，独立静态页）
├── site/                   # 构建辅助模块（geml 渲染等）
├── package.json
└── .gitignore
```

> 构建产物 `index.html` / `about.html` / `story.html` / `privacy.html` / `terms.html` / `disclaimer.html` / `donate.html` 由构建脚本生成，**不入库**（已在 `.gitignore` 中限定根目录忽略）。

## 本地开发

```bash
# 安装依赖
npm install

# 构建全部页面
npm run build          # 等价于 node build-landing.mjs all

# 仅构建单个页面
node build-landing.mjs landing
node build-landing.mjs about
node build-landing.mjs story
node build-landing.mjs privacy
node build-landing.mjs terms
node build-landing.mjs disclaimer
node build-landing.mjs donate
```

构建会：
1. 读取 `landing.content.yml` 与对应模板
2. 渲染占位符（标量 / `{{#each}}` / `{{#if}}` / `{{{ }}}`）与内联 SVG 图标
3. 法律类页面（privacy/terms/disclaimer/donate）由 `landing.content.yml` 的 `legal.<key>` 段预渲染为 HTML 片段注入
4. 输出到根目录对应 `.html`

## 内容来源与同步（单一基准）

**文档站 `fundmate/docs/*.md` 是唯一基准**（关于我们、隐私政策、服务条款、免责声明、赞赏）。
主站 `landing.content.yml` 中的 `about.blocks` 与 `legal.*` 段是**派生物**，不要手动编辑：

- `fundmate/docs/about.md` → `landing.content.yml` 的 `about.blocks`
- `fundmate/docs/privacy.md` → `legal.privacy`
- `fundmate/docs/terms.md` → `legal.terms`
- `fundmate/docs/disclaimer.md` → `legal.disclaimer`
- `fundmate/docs/donate.md` → `legal.donate`
- （`story.md` 不存在，品牌故事仅在主站 `landing.content.yml` 的 `brandStory` 维护，不同步）

同步由 `scripts/sync-docs-content.mjs` 完成：解析文档站 Markdown → 写入主站 yml。
每周由 GitHub Actions（`.github/workflows/sync-docs.yml`，周一 UTC 触发 + 手动 `workflow_dispatch`）自动运行，
yml 变化后自动 commit 并 push，触发 Cloudflare Pages 重新部署。

**本地手动同步**：

```bash
# 需本机同时存在 fundmate 仓库（默认 ../fundmate/docs），或指定路径：
DOCS_DIR=/path/to/fundmate/docs node scripts/sync-docs-content.mjs
npm run build
```

> 文档站 Markdown 用 VitePress 渲染长文；主站用 yml 渲染为独立主域名页面（如 `/privacy.html`），
> 两者形态不同、互不耦合。文档站为唯一基准，改文档站即可，主站自动跟随。

## 编辑内容

**跳转链接的唯一可编辑源是 `landing.content.yml` 顶部的 `links` 段**（模板用 `{{links.app}}` 引用，勿硬编码域名）：

```yaml
links:
  app: "https://app.duoduobei.com"
  temperature: "https://app.duoduobei.com/temperature"
  explore: "https://app.duoduobei.com/explore"
  home: "https://duoduobei.com"
  personality: "https://duoduobei.com/personality/"
  feedback: "https://feedback.duoduobei.com"
  donate: "/donate.html"
  docsPrivacy: "/privacy.html"
  docsDisclaimer: "/disclaimer.html"
  terms: "/terms.html"
  github: "https://github.com/imoyao"
```

导航、footer 等结构性内容在 `landing.content.yml` 中按页面分区维护（如 `nav`、`hero`、`footer`、`aboutLinks` 等）。
关于我们 / 隐私 / 服务条款 / 免责 / 赞赏的**文案**请改文档站 `fundmate/docs/*.md`，不要改主站 yml。

## 部署（Cloudflare Pages）

本项目是纯静态站，**必须用 Cloudflare Pages 部署，不要用 Worker**。

在 CF 控制台 **Workers & Pages → Pages → Create a project → Connect to Git**，选择本仓库，填写：

| 配置项 | 值 |
| --- | --- |
| Framework preset | `None` |
| Build command | `npm run build` |
| Build output directory | `/`（根目录） |
| Root directory | 留空（仓库根） |

> ⚠️ 注意：务必在 **Pages** 子页创建项目。若在 **Workers** 子页创建，会生成 Worker 项目并跑 `wrangler deploy`，它会把 `node_modules/` 整体当作 assets 上传，其中 `workerd` 二进制（约 144 MiB）超过 Workers Assets 25 MiB 单文件上限，导致 `Asset too large` 报错。Pages 的构建流程只上传输出目录的静态文件，不会碰 `node_modules`。

### 域名

部署后在 Pages 项目的 **Custom domains** 中绑定 `duoduobei.com` 等域名（从旧项目解绑后重新绑定即可）。

## 子项目

- `personality/`：投资人格测试 H5 小游戏，独立静态页（`index.html` + `quiz-data.json`），不经模板渲染，链接在 `index.html` 内硬编码绝对域名。其临时调试产物（`_*` 前缀）已被 `.gitignore` 忽略。
