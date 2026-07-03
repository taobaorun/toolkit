# Markdown 模块自动识别并渲染当前页内容

本 ExecPlan 是一个活文档。`进展`、`意外发现`、`决策日志`、`结果回顾`等章节必须随工作推进保持更新。

## 目的 / 全局视角

给 `toolkit-extension` 的 **Markdown** 模块增加"自动识别当前标签页的 Markdown 内容并自动渲染"的能力。

用户打开一个原始 Markdown 页面（如 `*.md` 文件、`raw.githubusercontent.com`、`text/plain` 且内容像 markdown 的页面），然后切到侧边栏的 Markdown 标签 —— 扩展会自动抓取该页文本、载入源码框并渲染预览，无需手动复制粘贴。若当前页不是原始 markdown，则回退为抓取整页可见正文作为 markdown 源。用户还能通过"Load page"按钮随时手动重新抓取。

**用户能看到它在工作**：打开任意 `.md` 原始链接 → 点 Markdown 标签 → 源码框立即出现该文件内容，预览区渲染出格式化结果。

## 确认状态

- [x] **待用户确认** — 创建完 ExecPlan 后，将目标、影响范围、关键决策展示给用户，等用户确认后再开始执行。
- [x] (2026-07-03 09:05 GMT+8) 用户已确认（"LGTM"），HTML 基线冻结，开始执行

## 进展

- [x] (2026-07-03 09:11 GMT+8) 步骤 1：`manifest.json` 增加 `scripting` 权限
- [x] (2026-07-03 09:12 GMT+8) 步骤 2：`lib/markdown.js` 增加页面抓取与自动识别逻辑（toolbar 加 "Load page" 按钮 + `md-status` 状态提示，render 末尾 `loadFromPage(true)` 自动尝试一次；`sidepanel.css` 补 `.md-status` 样式）
- [x] (2026-07-03 09:12 GMT+8) 步骤 3：非扩展上下文/不可注入页（`chrome://`、`file://`、无 `chrome.scripting`）优雅降级，保留示例并给状态提示；`auto` 仅在源码框空或为初始示例时覆盖
- [x] (2026-07-03 09:13 GMT+8) 步骤 4：更新 `tools/toolkit-extension/README.md` 功能说明与权限表
- [x] (2026-07-03 09:50 GMT+8) 步骤 5：验证 — 检测逻辑 Node 单测 14/14 通过；用户在本地 `file://` 的 `.md` 文件上确认自动识别 + 渲染**已可用**（"可以了"）。
- [x] (2026-07-03 09:45 GMT+8) 追加：支持本地 `file://` 文件 + 用户反馈驱动的诊断改进（见意外发现/决策日志）
- [x] (2026-07-03 10:15 GMT+8) 追加：检测到 markdown 时自动切到 Markdown 页签并切 Preview（`sidepanel.js` 启动探测 + `markdown.js` 暴露 `probeActivePage` / 加载 raw 时 `setView('preview')`）
- [x] (2026-07-03 10:25 GMT+8) 追加：清理 JSON 编辑器/对比的预填示例，四个输入框默认空 + 空态防呆（`json-editor.js` / `json-compare.js`）

## 意外发现

- 发现：`sidepanel.css` 无 `--text-muted` token，muted 文本用的是 `--text-3`。
  证据：`grep` 显示 token 定义为 `--text` / `--text-2` / `--text-3`（含 dark 主题一套）。`.md-status` 已改用 `--text-3`。
- 发现：`.md-toolbar` 已有 `.spacer { flex:1 }`，把 Copy 推到右侧；新按钮 "Load page" 与 `#mdStatus` 放在 spacer 之前即自然左对齐，无需额外布局改动。
- 发现（用户反馈 2026-07-03 09:33）：默认预填的 `sampleMd` 营销示例会顶在编辑器里，用户视为需"清理"的噪音。
  证据：用户粘回的正是 `sampleMd` 全文。已改为**空默认 + 引导 placeholder**，自动加载因此能在首次打开就填充。
- 发现（用户反馈）："手工清空后 Load 不生效"。根因非代码逻辑错误，而是环境：
  证据一：`Load page` 仅对可注入网页有效；活动标签若是 `chrome://extensions` / 新标签页 / 扩展自身窗口则不可读。
  证据二：**(re)load 未打包扩展后，此前已打开的标签需刷新一次**，`chrome.scripting` 才对其生效，否则 `executeScript` 静默失败。
  之前的状态提示文案太弱，用户看不出"为什么没反应"。已改为可操作文案，并让不可注入提示带上被拒页面（`describeUrl`），自诊断。
- 发现（用户实测 2026-07-03 09:45）：用户的真实用法是**在 Chrome 里打开本地 `file://` 的 `.md` 文件**，而初版 `isInjectable` 把 `file://` 排除，导致永远"unavailable"。
  证据：用户地址栏为 `文件 | /Users/.../context-overflow-session-segmentation.md`；状态栏 "Open a web page to load its Markdown"。
  处置：`file://` 移出排除列表 → 允许注入；注入失败时对 `file://` 给专门提示引导开启"允许访问文件网址"。用户开启该开关 + 重载扩展 + 刷新页面后确认可用。
- 发现：Chrome 读取本地 `file://` 需扩展级"允许访问文件网址"开关（用户手动开），非清单权限可覆盖；未开时 `executeScript` 失败。这是 Chrome 硬性安全要求，代码无法绕过，只能引导。

## 决策日志

- 决策：检测范围采用"两者结合" —— 优先识别原始 markdown 页面，否则回退抓取整页可见文本。
  理由：用户离开未回复澄清问题；此策略覆盖面最广且对典型场景（看 .md 文件）最精准。
  日期/作者：2026-07-03 / yuanxuan

- 决策：加载时机采用"自动加载一次 + 可手动刷新"。
  理由：既满足"自动"诉求，又通过按钮保证可控、避免覆盖用户已输入内容（仅在源码框为空或仍是初始示例时自动覆盖）。
  日期/作者：2026-07-03 / yuanxuan

- 决策：检测到 markdown 时自动切到 Markdown 页签 + Preview（用户要求）。检测逻辑从 `markdown.js` 抽成可复用的 `fetchActivePage`，对外暴露 `probeActivePage`；`sidepanel.js` 启动先渲染默认 JSON，再异步探测活动页，是 markdown 就 `switchTab('markdown')`。
  理由：探测无 DOM 依赖，可在渲染任一模块前独立运行；先渲染默认页保证面板即时出现（代价是 markdown 页会有一次很短的 json→markdown 闪动，已向用户说明可改为"探测后再定首页签"）。加载 raw markdown 时 `setView('preview')` 直接给渲染结果。
  日期/作者：2026-07-03 / yuanxuan

- 决策：JSON 编辑器/对比清空预填示例（用户要求"不需要这些"），并为空输入加防呆。
  理由：与 markdown 的空默认一致，减少噪音。空字符串非合法 JSON，会触发 `renderTree` / `showCodeError` / compare `renderDiff` 报 "Invalid JSON"，故三处均加"空即空态、不报错"守卫；顺带删除孤儿 `getDefaultJson` / `getDefaultChanged`。
  日期/作者：2026-07-03 / yuanxuan

- 决策：移除预填 `sampleMd`，编辑器默认空 + 引导 placeholder；`isSourceReplaceable()` 简化为"仅空时可覆盖"。
  理由：用户视示例为噪音；空默认让自动加载首开即生效，且"空才自动覆盖、非空即保护用户输入"语义更简单清晰。顺带清理孤儿函数 `textareaSafe`。
  日期/作者：2026-07-03 / yuanxuan

- 决策：加载失败/不可注入时用可操作状态文案，而非静默或含糊提示。
  理由：真实故障多为环境性（活动页不可注入、扩展重载后旧标签未刷新），代码无法自动修复，但清晰文案能让用户一步自救。
  日期/作者：2026-07-03 / yuanxuan

- 决策：用 `chrome.scripting.executeScript` 注入函数读取页面，而非 `fetch(tab.url)`。
  理由：`executeScript` 能同时拿到"是否为原始 markdown（单一 `<pre>` / `text/plain`）"的判断和渲染后可见文本；`fetch` 对普通网页只能拿到 HTML 源码，无法满足回退抓取正文的需求。
  日期/作者：2026-07-03 / yuanxuan

## 结果回顾

**做了什么**：Markdown 模块现会在切到该标签时自动读取当前活动标签页 —— 若为原始 markdown（`text/plain` / 单一 `<pre>` / `.md` 后缀）载入其源码，否则回退载入整页可见正文，并渲染预览。新增 "Load page" 按钮强制重抓、`#mdStatus` 显示来源/状态。自动加载对用户已编辑内容有保护（空或初始示例才覆盖），不可注入页优雅降级。

**改动文件**（3 计划 + 1 顺带）：
- `tools/toolkit-extension/manifest.json` — 加 `scripting` 权限
- `tools/toolkit-extension/lib/markdown.js` — 核心逻辑
- `tools/toolkit-extension/README.md` — 功能与权限说明
- `tools/toolkit-extension/sidepanel.css` — `.md-status` 样式（计划外，用于新状态提示）

**效果如何**：`node --check` 与 manifest JSON 解析通过；检测逻辑 Node 单测 14/14 通过（`isInjectable` 拦截 chrome/file/extension 页、`isRaw` 双信号识别、`isSourceReplaceable` 保护用户输入）。

**执行中扩展的范围**（均已用户确认可用）：
- 本地 `file://` `.md` 文件支持（用户主用法）+ 文件访问开关引导文案。
- 自诊断状态文案：不可注入页显示被拒 URL、注入失败区分 file:// 与需刷新。
- 检测到 markdown 时自动切 Markdown 页签 + Preview 模式。
- 清理 JSON 编辑器/对比预填示例，四输入框默认空 + 空态防呆。

**遗留 / 备注**：
- 面板启动时 json→markdown 有一次很短闪动（为即时出面板换来的取舍），用户如介意可改为"探测后再定首个页签"。
- `HTML` 为 Stage-2 批准基线，按生命周期不重渲；执行期新增范围以本 MD 为准。

**最终状态**：功能全部落地并经用户在真实本地 `.md` 上确认可用。归档到 `completed/`。

## 上下文和方向

- 扩展根目录：`tools/toolkit-extension/`，Manifest V3，侧边栏（side panel）形态。
- 模块以 IIFE 形式挂到全局，由 `sidepanel.js` 的 `switchTab()` 调用 `MarkdownModule.render(content)`。脚本在 `sidepanel.html` 中按顺序引入，`marked.min.js` 先于各模块加载。
- `lib/markdown.js`：当前 `render()` 渲染 Source/Split/Preview 三视图，源码框预填硬编码 `sampleMd`，`renderPreview()` 用全局 `marked.parse()` 渲染。
- 读取当前标签页的既有范式在 `lib/cookies.js`：`chrome.tabs.query({active:true, currentWindow:true}, ...)`，并对 `file://` / `chrome://` 等无权限场景做降级。
- `manifest.json` 现有权限：`sidePanel`, `cookies`, `activeTab`, `tabs`；`host_permissions: <all_urls>`。缺少 `scripting`，需补。

## 工作计划

1. **`tools/toolkit-extension/manifest.json`**：`permissions` 数组追加 `"scripting"`。

2. **`tools/toolkit-extension/lib/markdown.js`**：
   - toolbar 增加 `<button id="mdLoadPage">Load page</button>` 与一个状态提示 span（显示"Loaded from <host>"或"No markdown detected"）。
   - 新增 `loadFromPage(auto)`：
     - 若无 `chrome.scripting` / `chrome.tabs` → 状态提示"Page loading unavailable here"，返回（保留示例）。
     - `chrome.tabs.query({active,currentWindow})` 取当前标签；跳过 `chrome://`、`chrome-extension://`、`file://` 之外不可注入页面。
     - `chrome.scripting.executeScript({target:{tabId}, func: extractPageContent})` 注入以下页面函数并取回 `{isRaw, url, text}`：
       - `isRaw = document.contentType === 'text/plain' || (body 仅一个子节点且为 <pre>)`
       - `text = isRaw ? preText : document.body.innerText`
     - 结合 URL 后缀（`.md` / `.markdown`）加强 `isRaw` 判断。
     - `auto` 模式下：仅当源码框为空或内容 === 初始 `sampleMd` 时才覆盖，避免冲掉用户输入。
     - 载入后 `renderPreview()` 并更新状态提示。
   - `render()` 末尾调用 `loadFromPage(true)` 自动尝试一次。
   - 手动按钮绑定 `loadFromPage(false)`（强制覆盖）。

3. **`tools/toolkit-extension/README.md`**：Markdown 功能条目补充"自动识别当前页内容"。

## 具体步骤

在仓库根目录：

```bash
# 编辑三个文件（见工作计划）
# 加载/重载未打包扩展：Chrome → chrome://extensions → 打开开发者模式 → 加载 tools/toolkit-extension
make lint            # 若有 JS lint 目标
```

## 验证和验收

以行为验收，加载扩展后：

1. **原始 .md 页面**：打开 `https://raw.githubusercontent.com/<任意含 README 的 repo>/master/README.md` → 点 Markdown 标签 → 源码框自动填入该文件全文，预览区渲染出标题/列表/代码块；状态提示显示来源 host。
2. **普通网页**：打开一个普通 HTML 页面（如新闻页）→ 点 Markdown 标签 → 源码框填入该页可见正文文本，预览按 markdown 渲染（纯文本也应正常显示）。
3. **不可注入页**：停在 `chrome://extensions` → 点 Markdown 标签 → 不报错，保留示例内容，状态提示"Page loading unavailable here"。
4. **手动刷新**：在任意页手动改动源码框后点 "Load page" → 重新抓取覆盖，预览更新。
5. **不覆盖输入**：自动加载后手动编辑源码框，再切走标签又切回 → 自动加载不应冲掉已编辑内容（源码框非空且非示例 → 不覆盖）。

## 产物和笔记

页面注入函数（片段示意）：

```js
function extractPageContent() {
  var body = document.body;
  var onlyPre = body && body.children.length === 1 &&
                body.firstElementChild.tagName === 'PRE';
  var isRaw = document.contentType === 'text/plain' || onlyPre;
  var text = onlyPre ? body.firstElementChild.innerText
                     : (body ? body.innerText : '');
  return { isRaw: isRaw, url: location.href, text: text };
}
```

## 接口和依赖

- `chrome.tabs` / `chrome.scripting`（MV3）—— 读取并注入当前标签页。
- `chrome.scripting` 需在 `manifest.json` 的 `permissions` 声明；注入目标已由 `host_permissions: <all_urls>` 覆盖。
- 全局 `marked`（`lib/marked.min.js`）—— 渲染 markdown，已存在。
- 无新增第三方依赖。
