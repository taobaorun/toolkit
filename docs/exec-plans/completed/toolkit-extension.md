# ToolKit Chrome Extension 完整实现

本 ExecPlan 是一个活文档。`进展`、`意外发现`、`决策日志`、`结果回顾`等章节必须随工作推进保持更新。

## 目的 / 全局视角

将设计稿中的 ToolKit Chrome 扩展完整实现为一个可用的浏览器侧边栏面板，包含 JSON（编辑+对比）、Cookies、Markdown、AI Chat 四个工具模块。

最终效果：用户在 Chrome 中安装扩展后，点击工具栏图标或按 `Cmd/Ctrl+Shift+K` 打开侧边栏，在 4 个工具标签间切换使用。

## 确认状态

- [x] **待用户确认** — 创建完 ExecPlan 后展示目标、影响范围、关键决策
- [x] 用户已确认，开始执行 (2026-06-14 11:58)

## 进展

- [x] (2026-06-14 12:03) 创建 `tools/toolkit-extension/` 目录结构和 Chrome 扩展骨架
- [x] (2026-06-14 12:03) 实现全局框架：主题系统、标签导航、侧边栏布局
- [x] (2026-06-14 12:05) 实现 JSON Editor 模式：编辑器 + 树形视图 + 搜索/美化/压缩
- [x] (2026-06-14 12:05) 实现 JSON Compare 模式：左右对比 diff
- [x] (2026-06-14 12:07) 实现 Cookies 模块：cookie 读取、搜索、详情、导出
- [x] (2026-06-14 12:07) 实现 Markdown 模块：三视图切换 + marked.js 渲染
- [x] (2026-06-14 12:07) 实现 AI Chat 模块：快捷提示词 + 上下文感知
- [x] (2026-06-14 12:21) 验证：JSON Editor 树形视图、无 console 错误

## 意外发现

- 发现：`escapeHtml(JSON.stringify(...))` 在 textarea 中导致 JSON 解析失败
  证据：textarea 内容是 HTML，但 `escapeHtml` 将 `"` 转义为 `&quot;`，导致 `JSON.parse` 失败。修复：textarea 内不需要 HTML 转义。
- 发现：chrome.cookies API 在 file:// 协议下不可用
  证据：直接打开 sidepanel.html 时需用示例数据 fallback；在真实 Chrome 扩展环境中正常工作。

## 决策日志

- 决策：Markdown 使用 marked 库渲染
  理由：用户指定。marked 成熟可靠，支持完整 GFM 语法
  日期/作者：2026-06-14 / yuanxuan

- 决策：Cookie 模块使用 demo 数据 fallback
  理由：chrome.cookies API 在非扩展环境下不可用，提供示例数据确保离线可预览
  日期/作者：2026-06-14 / yuanxuan

- 决策：JSON diff 使用逐行 hash set 对比
  理由：简单高效，覆盖行级增删标注需求；不引入完整 diff 算法
  日期/作者：2026-06-14 / yuanxuan

## 结果回顾

完成了 ToolKit Chrome 扩展的全部 4 个模块实现（~1644 行），纯原生 HTML/CSS/JS，零 npm 依赖（marked 内联）。

**做了什么**：
- Chrome 扩展骨架：Manifest V3 + sidePanel API + background service worker
- 全局框架：CSS 变量主题系统（dark/light）+ 4 标签导航
- JSON Editor：textarea 编辑器 + 可折叠树形视图 + 搜索/美化/压缩/复制
- JSON Compare：左右双编辑器 + 逐行 diff 标注 +/− + 格式化/交换按钮
- Cookies：域名分组列表 + 搜索 + 详情弹窗 + 复制值 + 导出 JSON
- Markdown：Source/Split/Preview 三视图 + marked.js 实时渲染
- AI Chat：4 个快捷提示词 + 多轮对话 + 页面上下文显示 + 模拟响应

**遗留问题**：
- AI Chat 使用本地模拟响应，未接入真实 LLM API
- 未在真实 Chrome 扩展环境中加载测试（需 `chrome://extensions` 加载）
- Cookies 在 file:// 协议下使用 demo 数据，需在真实网站测试

---

## 上下文和方向

### 当前状态

项目是 toolkit monorepo，`tools/` 下已有 `mcp-debug`（Shell CLI）。本次新增 Chrome 扩展工具。

### 参考设计

设计稿路径：`file:///Users/yuanxuan/Downloads/ToolKit.html`（已通过浏览器渲染分析）

## 工作计划

### 新增文件

```
tools/toolkit-extension/
├── .tool.yml                          # artifact: [chrome-extension]
├── README.md                          # 安装与使用说明
├── manifest.json                      # Chrome Extension Manifest V3
├── sidepanel.html                     # 侧边栏 HTML（主入口）
├── sidepanel.js                       # 侧边栏主逻辑
├── sidepanel.css                      # 侧边栏样式
├── background.js                      # Service Worker（快捷键、右键菜单）
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── lib/                               # 各工具模块
    ├── json-editor.js                 # JSON 编辑器 + 树形视图
    ├── json-compare.js                # JSON 对比 diff
    ├── cookies.js                     # Cookie 读取与展示
    ├── marked.min.js                  # Markdown 解析库
    └── ai-chat.js                     # AI Chat 面板
```

### 架构

```
┌─────────────────────────────────────────────┐
│  Side Panel                                  │
│  ┌──────────────────────────────────────┐   │
│  │  Header: Logo + Theme Toggle          │   │
│  ├──────────────────────────────────────┤   │
│  │  Tab Bar: JSON | Cookies | MD | AI   │   │
│  ├──────────────────────────────────────┤   │
│  │  Tool Content (dynamic)               │   │
│  │  ┌ JSON: Editor/Compare toggle       │   │
│  │  │  ├ Editor: [Editor] | [Tree]      │   │
│  │  │  └ Compare: [A] | [Diff] | [B]   │   │
│  │  ├ Cookies: [List] | [Detail]        │   │
│  │  ├ Markdown: [Source|Split|Preview]  │   │
│  │  └ AI Chat: [Chat Area] + [Input]    │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### 实现顺序

1. **Chrome 扩展骨架**（manifest.json + sidepanel.html + background.js + icons）
2. **全局框架**（主题系统、标签导航、布局 CSS）
3. **JSON Editor**（代码编辑器 + 树形视图 + 搜索/美化/压缩）
4. **JSON Compare**（左右分栏 diff 视图）
5. **Cookies**（chrome.cookies API + 列表/详情视图）
6. **Markdown**（Source/Split/Preview 三模式）
7. **AI Chat**（快捷提示词 + 对话界面 + 页面上下文）

## 具体步骤

### 步骤 1：Chrome 扩展骨架

创建 `tools/toolkit-extension/`，编写 manifest.json（Manifest V3，side_panel 权限）、background.js（快捷键 `Cmd+Shift+K`）、sidepanel.html 骨架。

验证：在 `chrome://extensions/` 开发者模式加载，点击图标应打开侧边栏。

### 步骤 2：全局框架

实现主题系统（CSS 变量 dark/light 切换）、4 标签导航栏、通用布局。

验证：标签切换正常，主题切换有效。

### 步骤 3：JSON Editor 模式

实现 textarea 编辑器 + 实时解析为树形视图（递归渲染可折叠节点）、搜索过滤、Beautify/Minify 按钮、Copy 按钮。

验证：粘贴 JSON → 树形视图自动展开/折叠 → 搜索高亮匹配 → Beautify/Minify 正确格式化。

### 步骤 4：JSON Compare 模式

实现左右两个编辑器 + 行级 diff 算法（逐行对比，标注 +- 变化）、Format both 按钮、Swap 按钮。

验证：左右粘贴不同 JSON → diff 视图正确标注增删行 → 统计行数变化。

### 步骤 5：Cookies 模块

使用 `chrome.cookies.getAll({})` API 获取当前站点 cookie，展示列表（域名筛选 + 搜索）、点击展开详情（值、域名、路径、过期时间、大小、安全标志）、Copy 和 Export 按钮。

验证：打开有 cookie 的网站 → Cookies 标签显示 cookie 列表 → 搜索过滤 → 查看详情。

### 步骤 6：Markdown 模块

实现 Source 模式（textarea）、Split 模式（左编辑右预览）、Preview 模式（仅预览）。使用 marked 库进行 Markdown → HTML 渲染。

验证：编写 Markdown → Split 模式实时预览 → Preview 模式全屏预览。

### 步骤 7：AI Chat 模块

实现对话界面（消息列表 + 输入框 + 发送按钮）、快捷提示词按钮（4 个：总结/提取要点/解释JSON/Cookie分析）、页面上下文显示（当前 URL）。

注意：AI Chat 本身不含 LLM 调用逻辑，快捷提示词作为预设文本填入输入框，用户可以复制或后续接入 API。

验证：点击快捷提示词 → 文本填入输入框 → 手动输入文本 → 发送显示在对话区。

### 步骤 8：验证

在 Chrome 中加载扩展：
1. 打开任意页面 → 点击扩展图标 → 侧边栏打开 → 4 个标签正常切换
2. JSON：粘贴 JSON → 树形视图渲染 → diff 对比
3. Cookies：显示当前站点 cookie
4. Markdown：编辑 → 实时预览
5. AI Chat：快捷提示词可用，对话可用
6. 快捷键 `Cmd/Ctrl+Shift+K` 打开/关闭侧边栏
7. 主题切换有效

## 验证和验收

- [ ] 扩展在 Chrome 中成功加载，侧边栏正常打开
- [ ] 4 个标签正常切换，各自功能完整
- [ ] JSON 编辑器：树形视图可折叠、搜索高亮、Beautify/Minify 正确
- [ ] JSON 对比：diff 标注正确、+10/−7 统计准确
- [ ] Cookies：显示当前站点 cookie、搜索有效、详情完整
- [ ] Markdown：三视图切换正常、实时预览正确
- [ ] AI Chat：快捷提示词填入、多轮对话正常
- [ ] 主题切换：暗色/亮色主题正常工作
- [ ] 快捷键：Cmd/Ctrl+Shift+K 打开/关闭侧边栏

## 接口和依赖

| 依赖 | 用途 |
|------|------|
| Chrome Extension API (sidePanel) | 侧边栏展示 |
| Chrome Extension API (cookies) | Cookie 读取 |
| Chrome Extension API (commands) | 快捷键绑定 |
| marked（~35KB，内联） | Markdown 渲染 |

## 产物和笔记

_待执行后填写_