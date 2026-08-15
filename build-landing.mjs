// 构建时注入：读取 landing.content.yml，替换 landing.template.html 中的令牌，
// 输出纯静态 index.html（无运行时依赖，SEO 友好）。
//
// 令牌语法：
//   {{ path.to.value }}            标量替换（点路径）
//   {{#each path.to.array}} ... {{/each}}   循环；循环体内用 {{field}} 引用当前项
//   {{.}}                           循环项为字符串时引用自身
//   <!--ICON:name-->                替换为脚本内 ICONS 映射的 SVG 内部路径（设计素材，不入 YML）
//
// 运行：node scripts/build-landing.mjs   或   pnpm run build:landing

import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const root = process.cwd();
const ymlPath = path.join(root, 'landing.content.yml');
const data = yaml.load(fs.readFileSync(ymlPath, 'utf8'));

// 多页构建：landing / about 共用同一份 YML 文案源，各自独立模板
// ===== 全局贝壳装饰片段（<!--SHELL_DECO--> 注入） =====
// 线条手绘风格贝壳/海星/气泡，用于点缀各页面空白区域
// CSS 与 landing.template.html 的 .shell-deco 保持一致，通过 --line-dark 共享描边色
const SHELL_DECO = `<style>
  /* ===== 线条贝壳散落装饰（沙滩上的贝壳） ===== */
  .shell-deco {
    position: absolute; pointer-events: none; z-index: 1;
    opacity: 0.12; transition: opacity 0.4s ease;
  }
  .shell-deco svg { width: 100%; height: 100%; overflow: visible; }
  .shell-deco path, .shell-deco ellipse, .shell-deco circle, .shell-deco line {
    fill: none; stroke: var(--line-dark); stroke-width: 0.8;
    stroke-linecap: round; stroke-linejoin: round;
  }
  .shell-deco--nautilus   { width: 64px; height: 60px; }
  .shell-deco--scallop    { width: 68px; height: 58px; }
  .shell-deco--conch      { width: 52px; height: 80px; }
  .shell-deco--clam       { width: 72px; height: 46px; }
  .shell-deco--starfish   { width: 60px; height: 56px; }
  .shell-deco--bubble     { width: 36px; height: 36px; }
  @media (max-width: 720px) { .shell-deco { display: none; } }
</style>
<!-- 散落贝壳装饰（页面级绝对定位，各模板按需放置） -->
<div class="shell-deco shell-deco--nautilus" style="top:18%;left:3%;transform:rotate(-25deg)" aria-hidden="true">
  <svg viewBox="0 0 64 60"><path d="M12,48 Q8,30 22,16 T48,10 Q58,20 52,38 T28,54Q16,52 12,48M22,16 Q32,8 44,14M28,24 Q38,18 46,26M20,32 Q32,26 40,34M18,40 Q28,36 34,42" /></svg>
</div>
<div class="shell-deco shell-deco--scallop" style="top:42%;right:2%;transform:rotate(15deg)" aria-hidden="true">
  <svg viewBox="0 0 68 58"><path d="M6,38 Q34,6 62,38 Q34,54 6,38M34,14 V38M22,20 Q34,16 46,20M16,26 Q34,20 52,26M10,32 Q34,26 58,32" /><path d="M30,42 Q34,44 38,42" stroke-width="0.5"/></svg>
</div>
<div class="shell-deco shell-deco--starfish" style="top:72%;left:5%;transform:rotate(-10deg)" aria-hidden="true">
  <svg viewBox="0 0 60 56"><path d="M30,4 L34,22 L52,18 L40,32 L56,42 L38,40 L30,56 L22,40 L4,42 L20,32 L8,18 L26,22Z" /><circle cx="30" cy="28" r="4" stroke-width="0.5"/><circle cx="26" cy="26" r="0.8" fill="var(--line-dark)"/><circle cx="34" cy="26" r="0.8" fill="var(--line-dark)"/></svg>
</div>
<div class="shell-deco shell-deco--conch" style="top:65%;right:5%;transform:rotate(20deg)" aria-hidden="true">
  <svg viewBox="0 0 52 80"><path d="M26,4 Q38,8 40,24 Q42,44 30,64 Q18,48 16,28 Q14,12 26,4M20,18 Q26,14 32,18M18,28 Q26,22 34,28M18,38 Q26,34 32,38M22,50 Q26,46 30,50" /><path d="M26,4 Q20,10 18,20" stroke-width="0.5"/></svg>
</div>
<div class="shell-deco shell-deco--bubble" style="top:28%;right:8%" aria-hidden="true">
  <svg viewBox="0 0 36 36"><ellipse cx="18" cy="18" rx="16" ry="14" /><path d="M10,14 Q14,10 18,13M22,12 Q26,14 24,18" stroke-width="0.5"/></svg>
</div>
<div class="shell-deco shell-deco--scallop" style="bottom:12%;left:12%;transform:rotate(-18deg);width:44px;height:38px" aria-hidden="true">
  <svg viewBox="0 0 68 58"><path d="M6,38 Q34,6 62,38 Q34,54 6,38M34,14 V38M22,20 Q34,16 46,20M16,26 Q34,20 52,26" /></svg>
</div>`;

const PAGES = {
  landing: { tpl: 'landing.template.html', out: 'index.html' },
  about: { tpl: 'about.template.html', out: 'about.html' },
  story: { tpl: 'story.template.html', out: 'story.html' },
  privacy: { tpl: 'legal.template.html', out: 'privacy.html', key: 'privacy' },
  terms: { tpl: 'legal.template.html', out: 'terms.html', key: 'terms' },
  disclaimer: { tpl: 'legal.template.html', out: 'disclaimer.html', key: 'disclaimer' },
  donate: { tpl: 'legal.template.html', out: 'donate.html', key: 'donate' },
};

function buildPage(key) {
  const { tpl: tplFile, out: outFile, key: dataKey } = PAGES[key];
  const tplPath = path.join(root, tplFile);
  const outPath = path.join(root, outFile);
  // legal 类页面：把当前 key 的 sections 渲染成 html 片段挂到 legal._current，供共用模板 {{{ }}} 输出
  if (dataKey) {
    const sec = (data.legal && data.legal[dataKey]) || { title: '', sections: [] };
    data.legal = data.legal || {};
    data.legal._current = { title: sec.title || '', slug: sec.slug || sec.title || '', html: renderSections(sec.sections || []) };
  }
  let html = fs.readFileSync(tplPath, 'utf8');

// 内联 SVG 图标内部路径（设计素材，不属于「可见文案」，故不入 YML）
const ICONS = {
  layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  'trending-up': '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
  list: '<rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="12" y2="14"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  'shield-check': '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="12 8 12 12 15 14"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  'grad-cap': '<path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1 3 3 6 3s6-2 6-3v-5"/>',
  refresh: '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
  rect: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/>',
  'circle-x': '<circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>',
  'file-text': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
  'bell-off': '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  'user-plus': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="17" y1="11" x2="23" y2="11"/><line x1="20" y1="8" x2="20" y2="14"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  chart: '<path d="M3 3v18h18"/><path d="M3 14l4-5 4 3 5-7 5 6"/>',
};

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function get(obj, p) {
  if (p === '.' || p === '') return obj;
  return p.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}

// html 已在 buildPage() 内读取（见上方）

// 1) 循环块 / 条件块 / 原样输出 / 标量替换（支持嵌套 each/if）
//    采用"最内层优先"正则（body 内不含 {{#each}}/{{#if}}）+ while 迭代，
//    由内向外逐层消解嵌套，避免非贪婪正则跨层截断的问题。
const eachReSrc = /\{\{#each\s+([\w.]+)\}\}((?:[\s\S](?!\{\{#each)(?!\{\{#if))*?)\{\{\/each\}\}/g;
const ifReSrc = /\{\{#if\s+([\w.]+)\}\}((?:[\s\S](?!\{\{#each)(?!\{\{#if))*?)\{\{\/if\}\}/g;
const rawReSrc = /\{\{\{\s*([\w.]+)\s*\}\}\}/g;
const scalarReSrc = /\{\{\s*([\w.]+)\s*\}\}/g;

// 渲染（支持嵌套）：ctx 为当前循环项上下文；路径在 ctx 取不到时回退到全局 data。
// 把 legal 页面的 sections（[{heading, paragraphs[], items[], links[], quote, tip}]）
// 渲染为 HTML 片段，供模板 {{{legal._current.html}}} 原样输出。
function renderSections(sections) {
  const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const part = (s) => {
    // 段落内已含脚本端 inlineMd 生成的 <a>/<strong>/<del>，此处原样输出；
    // 行首 markdown 标题（# / ## / ###）渲染为对应 h 标签，避免 "### 1.1" 以纯文本呈现
    const lines = String(s).split('\n').filter((l) => l.trim() !== '');
    return lines.map((l) => {
      const t = l.trim();
      if (t.startsWith('### ')) return `<h3>${t.slice(4)}</h3>`;
      if (t.startsWith('## ')) return `<h2>${t.slice(3)}</h2>`;
      if (t.startsWith('# ')) return `<h1>${t.slice(2)}</h1>`;
      return `<p>${l}</p>`;
    }).join('');
  };
  return sections
    .map((sec) => {
      let inner = '';
      if (sec.heading) inner += `<h2>${sec.heading}</h2>`;
      if (sec.paragraphs) inner += sec.paragraphs.map((p) => part(p)).join('');
      if (sec.items && sec.items.length) {
        inner += '<ul>' + sec.items.map((it) => `<li>${it}</li>`).join('') + '</ul>';
      }
      if (sec.links && sec.links.length) {
        inner += '<ul>' + sec.links.map((l) => `<li><a href="${escAttr(l.href)}" target="_blank" rel="noopener">${l.label}</a></li>`).join('') + '</ul>';
      }
      if (sec.quote) inner += `<blockquote>${sec.quote}</blockquote>`;
      if (sec.tip) inner += `<div class="tip">${sec.tip}</div>`;
      return `<section>${inner}</section>`;
    })
    .join('\n');
}

// 渲染（支持嵌套 each/if，由外向内展开，并保护未展开块内的标量不被提前清空）
// 旧实现用「最内层优先」正则，会导致：(1) 外层 each 含内层 each 时无法匹配；
// (2) 未展开循环体内的标量被外层标量替换用根 ctx 提前清空。
// 新实现改用计数配对定位每个块的最外层边界，由外向内消解，
// 内层块在外层展开后随递归获得正确的 item 上下文。
function render(tpl, ctx) {
  ctx = ctx || data;
  // 1) 由外向内展开 each/if（计数配对，允许 body 内含嵌套块）
  const openRe = /\{\{#(each|if)\s+([\w.]+)\}\}/g;
  let m;
  while ((m = openRe.exec(tpl))) {
    const type = m[1];
    const path = m[2];
    const openStart = m.index;
    const bodyStart = openStart + m[0].length;
    // 计数配对找对应的 {{/each}} 或 {{/if}}
    let depth = 1;
    const scanRe = /\{\{#(each|if)\s+[\w.]+\}\}|\{\{\/(?:each|if)\}\}/g;
    scanRe.lastIndex = bodyStart;
    let sm;
    let bodyEnd = -1;
    while ((sm = scanRe.exec(tpl))) {
      if (sm[0].startsWith('{{#')) depth++;
      else { depth--; if (depth === 0) { bodyEnd = sm.index; break; } }
    }
    if (bodyEnd < 0) { openRe.lastIndex = bodyStart; continue; } // 未配对，跳过
    const body = tpl.slice(bodyStart, bodyEnd);
    const closeTag = tpl.slice(bodyEnd).match(/\{\{\/(?:each|if)\}\}/)[0];
    const closeLen = closeTag.length;
    let replacement;
    if (type === 'each') {
      const arr = get(ctx, path);
      const list = Array.isArray(arr) ? arr : get(data, path);
      replacement = Array.isArray(list)
        ? list.map((item) => render(body, item)).join('')
        : '';
    } else {
      const v = get(ctx, path) != null ? get(ctx, path) : get(data, path);
      replacement = v ? render(body, ctx) : '';
    }
    tpl = tpl.slice(0, openStart) + replacement + tpl.slice(bodyEnd + closeLen);
    openRe.lastIndex = 0;
  }
  // 2) 标量 / 原样替换（跳过仍被未展开块包裹的令牌，避免提前清空）
  const ranges = [];
  const blockRe = /\{\{#(each|if)\s+[\w.]+\}\}([\s\S]*?)\{\{\/(?:each|if)\}\}/g;
  let bm;
  while ((bm = blockRe.exec(tpl))) ranges.push([bm.index, bm.index + bm[0].length]);
  const inBlock = (idx) => ranges.some(([s, e]) => idx >= s && idx < e);
  tpl = tpl.replace(rawReSrc, (_mm, p) => {
    const idx = rawReSrc.lastIndex - _mm.length;
    if (inBlock(idx)) return _mm;
    const v = get(ctx, p) != null ? get(ctx, p) : get(data, p);
    return v == null ? '' : String(v);
  });
  tpl = tpl.replace(scalarReSrc, (_mm, p) => {
    const idx = scalarReSrc.lastIndex - _mm.length;
    if (inBlock(idx)) return _mm;
    const v = get(ctx, p) != null ? get(ctx, p) : get(data, p);
    return v == null ? '' : esc(v);
  });
  return tpl;
}

html = render(html);

// 3) 图标注入
html = html.replace(/<!--ICON:([\w-]+)-->/g, (_m, name) => ICONS[name] || '');

// 3.5) 全局贝壳装饰注入
html = html.replace(/<!--SHELL_DECO-->/g, SHELL_DECO);

// 3.6) 外链强制新标签页打开（中央规则，覆盖全部页面，无需逐模板维护）
//      - 仅作用于第三方域名（http/https 且 host 非 duoduobei.com）；
//      - 站内导航（/、/#锚点、相对路径、本站绝对链接）保持同标签，符合常规浏览习惯；
//      - 缺失则补 target="_blank" 与 rel="noopener noreferrer"（合并已有 rel）。
const SELF_HOST = 'duoduobei.com';
html = html.replace(/<a\b([^>]*)>/g, (full, attrs) => {
  const hrefM = attrs.match(/\bhref\s*=\s*"([^"]*)"/);
  if (!hrefM) return full;
  const href = hrefM[1];
  if (!/^https?:\/\//i.test(href)) return full; // 非绝对外链（锚点/站内相对）不处理
  try {
    const host = new URL(href).hostname.replace(/^www\./, '');
    if (host.endsWith(SELF_HOST)) return full; // 本站链接，保持同标签
  } catch (e) { return full; }
  let a = attrs;
  if (!/\btarget\s*=/.test(a)) a += ' target="_blank"';
  const need = ['noopener', 'noreferrer'];
  const relM = a.match(/\brel\s*=\s*"([^"]*)"/);
  let rel = relM ? relM[1].split(/\s+/).filter(Boolean) : [];
  rel = [...new Set([...rel, ...need])];
  a = relM
    ? a.replace(/\brel\s*=\s*"[^"]*"/, 'rel="' + rel.join(' ') + '"')
    : a + ' rel="' + rel.join(' ') + '"';
  return '<a' + a + '>';
});

// 4) Marquee 无缝 + 满宽 + 去重打乱：
//    - 收集所有 eco-item 文本 → Set 去重 → Fisher-Yates 随机打乱；
//    - 偶数份保证 translateX(-50%) 两半二进制一致 → 无缝循环；
//    - 最小填充份数 MIN_ITEMS 保证轨道宽度大于任意常见视口，滚动时右侧不露白。
//    ⚠️ 为什么是 36（勿随手调小）：无缝循环的接缝要求"半轨宽 ≥ 视口宽"。
//      每项约 120–150px：24 项 → 半轨 ≈ 1800px，1920px 屏接缝处仍露白（曾实测）；
//      36 项 → 半轨 18 项 ≈ 2700px，可覆盖 1920px，4K 屏仅接缝瞬间略欠。
//      保持偶数份（此处 perSet=6 → copies=6）是 -50% 两半一致的前提。
const ECO_MIN_ITEMS = 36;
function shuffle(arr) { // Fisher-Yates
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
html = html.replace(
  /(<div class="eco-track"[^>]*>)([\s\S]*?)(<\/div>\s*(?=<\/div>))/g,
  (_m, open, body, close) => {
    // 提取 track 内所有 item：既支持纯文字 <span class="eco-item">文字</span>，
    // 也支持真实 Logo <div class="eco-item eco-logo">…<img>…</div>。
    // 按"内容"去重（文字按文本、Logo 按内部 HTML），原样保留各自标签，避免 logo 被丢弃。
    const itemRe = /<(span|div) class="eco-item(?: eco-logo)?"[^>]*>([\s\S]*?)<\/\1>/g;
    const raw = [...body.matchAll(itemRe)].map(m => {
      const [_, tag, inner] = m;
      return tag === 'div'
        ? { key: 'logo:' + inner, html: `<div class="eco-item eco-logo">${inner}</div>` }
        : { key: inner.trim(), html: `<span class="eco-item">${inner.trim()}</span>` };
    }).filter(x => x.key);
    // 去重 + 打乱
    const unique = shuffle([...new Map(raw.map(x => [x.key, x])).values()]);
    // 重建去重打乱后的 body
    const shuffledBody = unique.map(x => x.html).join('');
    const perSet = unique.length || 1;
    let copies = Math.max(2, Math.ceil(ECO_MIN_ITEMS / perSet));
    if (copies % 2 !== 0) copies += 1; // 强制偶数
    return open + shuffledBody.repeat(copies) + close;
  }
);

// 5) 内联 site.css：将 <link href="/site/css"> 替换为 <style> 块（保证产物可在 file:// 协议下自包含）
const siteCssPath = path.join(root, 'site', 'style.css');
if (fs.existsSync(siteCssPath)) {
  const siteCss = fs.readFileSync(siteCssPath, 'utf8');
  html = html.replace(
    /<link[^>]*href=["']\/site\/style\.css["'][^>]*>/,
    `<style>\n/* ==== auto-inlined from site/style.css ==== */\n${siteCss}\n/* ==== end inline ==== */\n</style>`
  );
  console.log('[build-landing] 已内联 site/style.css');
} else {
  console.warn('[build-landing] site/style.css 不存在，跳过内联（产物依赖 HTTP server）');
}

// 6) 校验：仍有未替换的令牌则告警
const leftover = html.match(/\{\{[^}]+\}\}/g);
if (leftover) {
  console.warn('[build-landing] 未替换的令牌：', [...new Set(leftover)]);
}

  fs.writeFileSync(outPath, html);
  console.log('[build-landing] 已生成 ' + outFile);
}

// 入口：node scripts/build-landing.mjs [page]   默认 landing；all = 全部页面
const arg = process.argv[2] || 'landing';
if (arg === 'all') {
  Object.keys(PAGES).forEach(buildPage);
} else if (PAGES[arg]) {
  buildPage(arg);
} else {
  console.error('[build-landing] 未知页面: ' + arg + '（可选: landing / about / story / privacy / terms / disclaimer / donate / all）');
  process.exit(1);
}
