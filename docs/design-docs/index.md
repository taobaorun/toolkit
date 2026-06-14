# 设计文档索引

本目录存放系统架构和模块设计的详细文档。

**本目录的具体设计文档使用 HTML 格式**（Tier 3 HTML native，激活 `html-artifact` skill 编写）。架构图、时序图、数据流图这些可视化信息是设计文档的核心价值，Markdown 表达不了。本索引文件保持 Markdown，方便 Agent 快速扫描。

## 文档列表

| 文档 | 描述 | 状态 |
|------|------|------|
| [core-beliefs.md](core-beliefs.md) | 核心设计信念和原则 | 活跃 |

## 如何添加新设计文档

1. 在本目录创建新的 HTML 文件（激活 `html-artifact` skill 的 report 场景）
2. 更新本索引文件，添加一行链接 + 一句话描述
3. 确保文档包含：背景、设计决策、权衡考量、实现要点