# Toolkit Tools

本目录存放所有工具，每个工具是一个独立子目录。

## 工具目录结构

```
<tool-name>/
├── .tool.yml          # 工具元信息与 artifact 声明（必填）
├── README.md          # 用途、安装、使用说明（必填）
├── src/               # 核心源码
├── cli/               # CLI 入口（如果 artifact 包含 cli）
├── extension/         # Chrome 扩展源码（如果 artifact 包含 chrome-extension）
├── web/               # Web 前端源码（如果 artifact 包含 web）
├── package.json       # Node.js 依赖（如有）
├── go.mod             # Go 依赖（如有）
└── tests/             # 测试
```

## .tool.yml 规范

每个工具必须有 `.tool.yml`，声明工具元信息和构建目标：

```yaml
name: <tool-name>          # 工具名称，kebab-case
description: <一句话描述>
artifacts:                 # 至少声明一种 artifact
  - type: cli
    runtime: node | python | go
    entry: <入口文件>
    install: <安装命令>
  - type: chrome-extension
    source_dir: extension/
    output: <输出的 .zip 文件名>
  - type: web
    source_dir: web/
    output_dir: dist/web/
```

### artifact 类型说明

| Type | 描述 | 安装方式 |
|------|------|----------|
| `cli` | 命令行工具 | npm install -g / pip install / go install |
| `chrome-extension` | Chrome 浏览器扩展 | 开发者模式加载已解压目录 或 .zip 安装 |
| `web` | 静态 Web 应用 | 直接打开 HTML 或部署到静态服务器 |