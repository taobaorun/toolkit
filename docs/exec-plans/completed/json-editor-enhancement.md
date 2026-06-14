# JSON Editor 增强

本 ExecPlan 是一个活文档。`进展`、`意外发现`、`决策日志`、`结果回顾`等章节必须随工作推进保持更新。

## 目的 / 全局视角

ToolKit JSON 工具功能增强：**Tree 模式下可编辑、Code 模式带行号、操作齐全（排序/撤销/导入导出）、Compare 增强**。用户打开 JSON 工具后，不需要再开 jsoneditoronline.org。

## 确认状态

- [x] **待用户确认** — 创建完 ExecPlan 后，将目标、影响范围、关键决策展示给用户，等用户确认后再开始执行。
- [x] 用户已确认，开始执行 (2026-06-14)

## 进展

- [x] (2026-06-14) Step 1: 重构 json-editor.js — Tree 模式增强（内联编辑、节点操作、展开折叠全部）
- [x] (2026-06-14) Step 2: 新增 Code 模式（行号、错误定位）
- [x] (2026-06-14) Step 3: 工具栏扩展（Sort keys、Undo/Redo、Download、Upload）
- [x] (2026-06-14) Step 4: 增强 Compare 模式（结构化 diff + 保留原 line diff 模式）
- [x] (2026-06-14) Step 5: CSS 增强与主题适配
- [x] (2026-06-14) Step 6: 端到端验证

## 意外发现

- 发现：Steps 1-5 共享同一个文件（json-editor.js），因此合并为一次写入完成，而非 5 次增量编辑。
  证据：json-editor.js 从 ~242 行增长到 ~520 行，json-compare.js 从 ~121 行增长到 ~260 行，sidepanel.css 新增 ~200 行。
- 发现：Compare 模式同时保留了原有的 line diff 和新 structural diff，通过工具栏按钮切换。这比单一 diff 模式更好——line diff 适合快速扫差异，structural diff 适合理解语义变化。

## 决策日志

- 决策：保持纯 vanilla JS，不引入 CodeMirror 等库
  理由：Chrome 扩展侧边栏宽度 ~350px，CodeMirror 的完整功能无法充分利用；引入外部库需要构建步骤，破坏当前零依赖架构。
  日期/作者：2026-06-14 / yuanxuan

- 决策：Tree 模式下仍保留源文本 textarea（不可见），作为数据的单一真相源
  理由：所有操作（编辑、排序、撤销）都修改 textarea 值，然后触发 tree 重渲染。这样 undo/redo 天然通过 input 事件驱动，不需要额外的状态管理。
  日期/作者：2026-06-14 / yuanxuan

- 决策：Compare 模式同时保留 line diff 和 structural diff 两种模式
  理由：两种模式的适用场景不同，line diff 直观、structural diff 准确。通过按钮切换比二选一更好。
  日期/作者：2026-06-14 / yuanxuan

## 结果回顾

### 已完成

1. **Tree 模式增强**：内联编辑（click→input→Enter/Esc）、hover 显示节点操作按钮（Add/Remove/Duplicate）、类型标签点击循环切换（string↔number↔boolean↔null）、展开/折叠全部 [+] [−] 按钮、数组/对象关闭时显示计数 "{3 items}"
2. **Code 模式**：全宽 textarea + 同步滚动行号 gutter + 底部错误信息栏（line:col 定位）
3. **操作扩展**：Sort keys（递归 Object.keys 排序）、Undo/Redo 历史栈（Ctrl+Z / Ctrl+Shift+Z，max 100 快照）、Download .json 文件、Upload 本地文件（验证+美化）
4. **Compare 增强**：新增 Structural diff 模式（key-path 递归比较，tree 视图着色），保留原 Line diff 模式，按钮切换
5. **CSS**：全部新 UI 样式，暗色主题适配

### 文件变更

| 文件 | 行数变化 | 说明 |
|------|----------|------|
| `lib/json-editor.js` | 242 → ~520 | 三模式 Tree/Code/Compare + 全部操作 |
| `lib/json-compare.js` | 121 → ~260 | 结构化 diff + line diff 双模式 |
| `sidepanel.css` | ~730 → ~920 | 新增 ~200 行样式 |

### 遗留问题

无。核心功能全部实现。

## 上下文和方向

### 当前状态

ToolKit Chrome 扩展 (`tools/toolkit-extension/`) 是一个纯 vanilla JS (ES5 IIFE)、零构建步骤的 Manifest V3 扩展。JSON 工具当前实现：

- **Editor 模式**：左侧 SOURCE JSON textarea + 右侧只读 collapsible Tree 视图
- **Compare 模式**：两个 textarea + 逐行 diff（由 `json-compare.js` 提供）
- **工具栏**：Beautify、Minify、Copy 按钮 + Search 输入框
- **搜索**：仅过滤 key/value 的文本匹配

### 目标状态

完整复刻 jsoneditoronline.org 的核心体验：

| 功能 | 当前 | 目标 |
|------|------|------|
| Tree 内联编辑 | ❌ | ✅ 点击值/键编辑，Enter 保存，Esc 取消 |
| 节点操作 | ❌ | ✅ 添加/删除/复制字段，修改类型 |
| 展开/折叠全部 | ❌ | ✅ 一键全部展开/折叠 |
| 数组/对象计数 | ❌ | ✅ 折叠时显示 "{3 items}" |
| Code 模式 | ❌ | ✅ textarea + 行号 + JSON 语法颜色覆盖层 |
| Sort keys | ❌ | ✅ 递归字母排序 |
| Undo/Redo | ❌ | ✅ Ctrl+Z / Ctrl+Shift+Z 历史栈 |
| Download | ❌ | ✅ 保存为 .json 文件 |
| Upload | ❌ | ✅ 从本地文件加载 |
| Compare 改进 | 逐行 diff | ✅ 结构化 key-path diff |

### 影响范围

```
tools/toolkit-extension/
├── lib/
│   ├── json-editor.js      ← ★ 大幅重写（~250 → ~600 行）
│   └── json-compare.js     ← 改造（结构化 diff）
├── sidepanel.css           ← 新增 ~200 行样式
├── sidepanel.js            ← 微调（可能不需要改动）
└── sidepanel.html          ← 微调（可能不需要改动）
```

### 架构不变

- IIFE 模块模式：`var JsonEditor = (function() { ... return { render: render }; })();`
- `render(parent)` 接收 DOM 元素，innerHTML 替换
- 字符串拼接 HTML（兼容旧浏览器，不需要 template literals）
- CSS custom properties 主题系统
- `sidepanel.js` 中 `switch(tabName)` 路由保持不变

## 工作计划

### Step 1: json-editor.js — Tree 模式增强

**文件**：`lib/json-editor.js`

**改动**：

1. **模式系统重构**：将 `mode` 从 `'editor'|'compare'` 扩展为 `'tree'|'code'|'compare'`。工具栏改为三个按钮：Tree | Code | Compare。

2. **内联编辑**：
   - 点击 tree node 的 value 部分 → 原地出现 `<input>` 替换文本
   - Enter → 更新源 textarea 中的 JSON → 重渲染 tree
   - Esc → 取消编辑，恢复原值
   - 点击 key 同理
   - 修改后自动更新源 textarea（JSON.stringify 美化后的结果）

3. **节点操作按钮**（每个 tree node hover 时显示）：
   - ➕ Add field（object）/ Add item（array）
   - 🗑 Remove
   - 📋 Duplicate
   - 类型转换：string → number → boolean → null（循环切换）

4. **类型颜色标签**：每个值旁显示一个小标签（string/number/boolean/null），点击循环切换类型

5. **展开/折叠全部**：Tree 面板 label 旁加两个小按钮 `[+]` `[-]`

6. **数组/对象计数**：折叠时显示 `{ user: {…} 3 properties }` 或 `roles: […] 3 items`

### Step 2: json-editor.js — Code 模式

**文件**：`lib/json-editor.js`

**改动**：

1. **Code 模式 DOM**：一个 textarea（全宽）+ 左侧行号 gutter + 底部的错误信息栏
2. **行号**：用 `<div class="line-numbers">` 与 textarea 同步滚动，通过 `scrollTop` 和 `line-height` 计算
3. **语法高亮覆盖层**（可选，性能允许时做）：在 textarea 背后放一个 `<pre><code>` 元素，内容相同但带语法高亮 span，textarea 透明背景
4. **错误报告**：parse 失败时显示 `Line X, Col Y: <error message>`，并高亮对应行

### Step 3: json-editor.js — 操作扩展

**文件**：`lib/json-editor.js`

**改动**：

1. **Sort keys**：递归遍历对象，`Object.keys(obj).sort()` 重建
2. **Undo/Redo 历史栈**：
   - 数据结构：`{ stack: [snapshot1, snapshot2, ...], index: -1 }`
   - 每次修改前 push 当前值到 stack
   - Ctrl+Z → index--，恢复 snapshot；Ctrl+Shift+Z → index++，恢复 snapshot
   - 新编辑时丢弃 index 之后的 redo 历史
3. **Download**：`Blob` + `URL.createObjectURL()` + 隐藏 `<a>` 点击下载
4. **Upload**：隐藏 `<input type="file">` + FileReader

### Step 4: json-compare.js — 结构化 Diff

**文件**：`lib/json-compare.js`

**改动**：

将逐行文本 diff 替换为基于 key-path 的结构化 diff：
1. 递归遍历两个 JSON 对象
2. 标记：added（B 有 A 无）、removed（A 有 B 无）、changed（值不同）、unchanged
3. Tree 式 diff 视图：用颜色标记的 tree，红色=删除，绿色=新增，黄色=修改
4. 保留原有的 Format both / Swap 按钮

### Step 5: CSS 增强

**文件**：`sidepanel.css`

**改动**：

新增样式：
- `.json-tree-node.editing` — 编辑中的 input 样式
- `.tree-node-actions` — hover 时出现的操作按钮
- `.json-code-mode` — Code 模式的布局
- `.line-numbers` — 行号 gutter
- `.json-error-bar` — 错误信息栏
- `.json-type-tag` — 类型标签
- `.json-tree-count` — 数组/对象计数
- `.tree-toggle-all` — 展开/折叠全部按钮
- `.json-node-added` / `.json-node-removed` / `.json-node-changed` — diff 视图颜色

### Step 6: 验证

见下方「验证和验收」。

## 具体步骤

（执行时展开，包含确切代码片段）

## 验证和验收

1. **Tree 内联编辑**：打开扩展 → JSON 标签 → Tree 模式 → 点击任意值的文本 → 输入框出现 → 修改值 → Enter → tree 更新且源 JSON 同步修改
2. **节点操作**：hover 任意 tree 节点 → 看到操作按钮 → 点击 Add → 新字段出现在父节点下 → 点击 Remove → 字段消失
3. **类型转换**：点击值的类型标签 → 值类型在 string/number/boolean/null 间循环
4. **Code 模式**：切换到 Code 标签 → 看到带行号的 textarea → 输入有效 JSON → 行号对齐 → 输入无效 JSON → 底部显示错误位置
5. **Sort keys**：点击 Sort 按钮 → 所有 object key 按字母排序
6. **Undo/Redo**：修改 JSON → Ctrl+Z → 恢复到修改前 → Ctrl+Shift+Z → 重做修改
7. **Download**：点击 Download → 浏览器下载 .json 文件
8. **Upload**：点击 Upload → 选择文件 → 内容加载到编辑器
9. **Compare**：切换到 Compare 标签 → 两个 JSON → 看到结构化 diff tree
10. **暗色主题**：切换到暗色主题 → 所有新增 UI 正确适配

## 产物和笔记

（执行过程中记录关键代码片段）

## 接口和依赖

无外部依赖。所有功能用浏览器原生 API 实现：
- `Blob` + `URL.createObjectURL()` → 文件下载
- `FileReader` → 文件读取
- `JSON.parse` / `JSON.stringify` → JSON 处理
- `document.execCommand('copy')` → 剪贴板