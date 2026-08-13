# 多多贝 · 官网静态站（duoduobei-web）

多多贝（duoduobei.com）品牌官网与落地页的纯静态站点。内容由 `*.template.html` + YAML 数据文件经构建脚本渲染生成，部署到 Cloudflare Pages。

## 技术栈

- 纯静态 HTML（无框架、无运行时）
- 构建脚本：Node.js（原生，无打包器）
- 模板渲染：自写的轻量占位符替换（`{{path.to.value}}` 标量替换 + `{{#each}}` / `{{#if}}` 块）
- YAML 内容文件：`landing.content.yml`

## 目录结构

```
duoduobei-web/
├── landing.template.html   # 首页模板（输出 index.html）
├── about.template.html     # 关于页模板（输出 about.html）
├── story.template.html     # 品牌故事页模板（输出 story.html）
├── landing.content.yml     # 所有页面共享的内容与链接数据（唯一可编辑数据源）
├── build-landing.mjs       # 构建脚本：渲染模板 + 章节一致性校验
├── docs/                   # 文档（about.md 等）
├── logos/ logo-delivery/   # 品牌素材
├── trading-personality-h5/ # 投资人格测试小游戏（子项目，独立静态页）
├── site/                   # 构建辅助模块（geml 渲染等）
├── package.json
└── .gitignore
```

> 构建产物 `index.html` / `about.html` / `story.html` / `landing.html` 由构建脚本生成，**不入库**（已在 `.gitignore` 中限定根目录忽略）。

## 本地开发

```bash
# 安装依赖
npm install

# 构建全部页面
npm run build          # 等价于 node build-landing.mjs all

# 仅构建单个页面（landing|about|story）
node build-landing.mjs landing
node build-landing.mjs about
node build-landing.mjs story
```

构建会：
1. 读取 `landing.content.yml` 与对应模板
2. 渲染占位符（标量 / `{{#each}}` / `{{#if}}`）与内联 SVG 图标
3. 校验 `docs/about.md` 的章节标题结构是否与 `about.template.html` 的 `data-about-section` 一致（`verifyAboutDrift`，不一致则报错）
4. 输出到根目录 `index.html` / `about.html` / `story.html`

## 编辑内容

**所有跳转链接的唯一可编辑源是 `landing.content.yml` 顶部的 `links` 段**：

```yaml
links:
  app: "https://app.duoduobei.com"
  temperature: "https://app.duoduobei.com/temperature"
  explore: "https://app.duoduobei.com/explore"
  home: "https://duoduobei.com"
  personality: "https://duoduobei.com/personality/"
  feedback: "https://feedback.duoduobei.com"
  donate: "https://duoduobei.com/donate/"
  docsPrivacy: "https://docs.duoduobei.com/privacy/"
  docsDisclaimer: "https://docs.duoduobei.com/disclaimer/"
  github: "https://github.com/imoyao"
```

模板里用 `{{links.app}}` 等方式引用，**不要在模板里硬编码域名**。改链接只需改这一处，重新 `npm run build` 即可。

页面文案、导航、footer 等结构性内容也都在 `landing.content.yml` 中按页面分区维护（如 `nav`、`hero`、`footer`、`aboutLinks` 等）。

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

- `trading-personality-h5/`：投资人格测试 H5 小游戏，独立静态页（`index.html` + `quiz-data.json`），不经模板渲染，链接在 `index.html` 内硬编码绝对域名。其临时调试产物（`_*` 前缀）已被 `.gitignore` 忽略。
