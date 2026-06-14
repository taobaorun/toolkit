# Toolkit

一个小工具项目大杂烩，包含各种语言和场景的实用小工具（如 MCP 调试工具、iam_token 小工具等）。

文档语言: zh

---

## Agent 工作规范（必须遵循）

本文件是 Agent 进入项目的入口。Agent 在执行任务时必须遵循以下规范：

### 任务复杂度判断

| 复杂度 | 判断标准 | 工作方式 |
|--------|----------|----------|
| 简单 | 单文件修改、小 bug 修复、简单查询 | 直接执行 |
| 中等 | 涉及 2-5 个文件、需要设计思考 | 可选创建 ExecPlan |
| 复杂 | 涉及 5+ 文件、多模块改动、架构变更 | **必须创建 ExecPlan** |

### ExecPlan 工作流程

对于复杂任务，必须遵循：

```
1. 创建 ExecPlan → docs/exec-plans/active/<任务名>.md
2. 展示计划摘要给用户，等待确认后才能开始执行
3. 执行时持续更新 Progress（打勾 + 时间戳）
4. 完成后移动到 docs/exec-plans/completed/，编写结果回顾
```

**重要：ExecPlan 创建后不能自动执行，必须等用户确认方案后才开始。**

### 强制行为

- [ ] 任务开始前：读取本文档了解上下文
- [ ] 复杂任务：创建 ExecPlan
- [ ] **ExecPlan 创建后：展示摘要并等待用户确认**
- [ ] 执行过程中：更新 Progress
- [ ] 任务完成后：移动 ExecPlan，编写回顾
- [ ] 发现技术债务：记录到 docs/exec-plans/tech-debt-tracker.md

---

## 项目定位

**多语言、多场景**小工具 monorepo。所有工具源码在 `tools/` 目录下，每个工具独立、互不依赖。每个工具可声明多种 **artifact**（交付形态）：CLI、Chrome 扩展、Web 应用等。

新增工具：`tools/<tool-name>/`，内含 `README.md`、`.tool.yml`（artifact 声明）、源码和依赖文件。详见 [tools/README.md](tools/README.md)。

## 关键文档

- [代码规范](docs/CODE_STYLE.md) - 编写代码前必读
- [设计原则](docs/DESIGN.md) - 核心设计信念
- [执行计划规范](docs/PLANS.md) - ExecPlan 使用规范
- [安全规范](docs/SECURITY.md) - 安全最佳实践
- [工具目录说明](tools/README.md) - 工具结构与 .tool.yml 规范

## 常用命令

```bash
make help              # 查看所有命令
make build             # 构建所有工具
make build-<name>      # 构建特定工具，如 make build-iam-token
make build-cli         # 构建所有 CLI 工具
make build-extension   # 构建所有 Chrome 扩展
make lint              # 运行 lint
make test              # 运行测试
make clean             # 清理构建产物

# 也可以直接在工具目录下使用原生命令
cd tools/<name> && npm test
```

## 开发工作流

1. `git checkout -b feature/<name>` → 新建或修改工具目录
2. 遵循 Conventional Commits（英文摘要）提交
3. 创建 PR

## 代码规范摘要

- **注释/错误/日志**：英文；注释解释 *why*，错误可操作，日志含上下文
- **命名**：遵循各语言社区惯例（JS: camelCase, Python: snake_case, Go: PascalCase）
- **Git 提交**：`<type>(<scope>): <英文祈使摘要>`

## 注意事项

- 工具间禁止代码依赖；每个工具必须有 `.tool.yml` + `README.md`
- 新增工具不更新 AGENTS.md，除非引入新语言或结构变更
- `dist/` 是构建产物目录，不提交到 Git
- `Makefile` 通过 `.tool.yml` 自动发现和分发构建目标