# 代码风格指南

本文档定义项目的代码规范，所有贡献者（人类和 AI Agent）必须遵循。

> **为什么重要：** 一致的风格降低代码审查的认知负担，让 diff 更清晰，并帮助 AI Agent 产出与代码库风格一致的代码。

---

## 语言

### 注释

所有代码注释必须使用**英文**。注释应解释 *why*，而非 *what*——代码本身已经展示了做了什么。

```javascript
// Good: 解释原因
// Retry up to 3 times because the upstream API returns 503 during cold start
const MAX_RETRIES = 3;

// Bad: 重复代码
// Set max retries to 3
const MAX_RETRIES = 3;
```

### 错误信息

所有异常信息、日志输出和 API 错误响应必须使用**英文**。错误信息应具有可操作性——告诉开发者出了什么问题，最好还能说明如何修复。

```javascript
// Good
throw new Error("Failed to connect to database. Check that DB_URL is configured correctly.");

// Bad
throw new Error("连接失败");
throw new Error("error");
```

### 日志信息

所有日志信息必须使用**英文**。包含足够的上下文以定位来源——模块名、函数名和关键标识符。

```javascript
// Good
console.log(`[UserService.createUser] created user id=${userId}, email=${email}`);
console.warn(`[OrderService.charge] retrying payment attempt ${attempt}/${MAX_RETRIES}`);

// Bad
console.log("成功创建用户");
console.log("出错了");
```

### UI / 面向用户的文案

UI 字符串和面向用户的文本应遵循项目的 i18n 策略。如果工具面向中文用户，UI 文案可以使用中文——但应放在独立的 message 文件或配置中，不硬编码在核心逻辑中。

---

## 命名

由于项目包含多种语言，遵循各语言的社区惯例：

| 语言 | 变量/函数 | 类/接口 | 常量 | 文件 |
|------|----------|---------|------|------|
| JavaScript/TypeScript | `camelCase` | `PascalCase` | `UPPER_SNAKE_CASE` | `kebab-case.ts` |
| Python | `snake_case` | `PascalCase` | `UPPER_SNAKE_CASE` | `snake_case.py` |
| Go | `camelCase` (private) / `PascalCase` (public) | `PascalCase` | `UPPER_SNAKE_CASE` | `snake_case.go` |
| Shell | `snake_case` | — | `UPPER_SNAKE_CASE` | `kebab-case.sh` |

布尔值在支持的语言中使用 `is`、`has`、`can` 前缀：

```javascript
// Good
let isAuthenticated = false;
let hasPermission = true;
let canRetry = false;
```

---

## 函数/方法

- 保持简短、聚焦单一职责（目标 30 行以内）
- 优先使用提前返回（guard clauses）而非深层嵌套
- 明确的访问修饰符（TypeScript/Go/Java）

```javascript
// Good — guard clauses 让主路径清晰可见
function createOrder(request) {
    if (!request) throw new Error("request must not be null");
    if (!inventoryService.hasStock(request.itemId)) {
        throw new Error(`Item ${request.itemId} is out of stock`);
    }
    return orderRepository.save(buildOrder(request));
}

// Bad — 嵌套条件隐藏了逻辑
function createOrder(request) {
    if (request) {
        if (inventoryService.hasStock(request.itemId)) {
            return orderRepository.save(buildOrder(request));
        } else {
            throw new Error("out of stock");
        }
    } else {
        throw new Error("null request");
    }
}
```

---

## 错误处理

- 不要静默捕获并忽略异常
- 使用具体的错误类型，让调用方可以精确处理
- 总是日志或重新抛出，不要同时做两件事（避免重复记录同一错误）
- 包装异常时包含原因

```javascript
// Good
try {
    await db.save(record);
} catch (err) {
    console.error(`[Repo.save] DB write failed recordId=${record.id}`, err);
    throw new PersistenceError(`Failed to save record ${record.id}`, { cause: err });
}

// Bad — 静默吞掉
try {
    await db.save(record);
} catch (e) {
    // ignore
}
```

---

## 导入/依赖

- 不使用通配符导入（`import *`）
- 导入分组顺序：标准库 → 第三方 → 项目内部
- 提交前移除未使用的导入

```javascript
// Good
import { readFile } from "node:fs/promises";

import express from "express";

import { UserService } from "./services/user.js";

// Bad
import * from "./utils";
import express from "express";
import { readFile } from "node:fs/promises";
```

---

## 测试

- 测试文件命名：`<文件名>.test.<ext>` 或放在 `tests/` 目录
- 使用描述性的测试名，读起来像自然语言句子：`should_returnEmpty_when_userNotFound`
- 所有测试描述使用英文
- 使用 Arrange / Act / Assert（AAA）结构组织

```javascript
// Good
test("should throw OutOfStockError when item has no inventory", () => {
    // Arrange
    when(inventoryService.hasStock("item-123")).mockReturnValue(false);

    // Act & Assert
    expect(() => orderService.createOrder(requestWithItem("item-123")))
        .toThrow(OutOfStockError);
});

// Bad
test("test库存不足") { ... }
test("test1") { ... }
```

---

## Git 提交

遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>(<scope>): <英文摘要，祈使语气>
```

| Type | 使用场景 |
|------|----------|
| `feat` | 新功能 |
| `fix` | 修复缺陷 |
| `refactor` | 不改变行为的代码重构 |
| `test` | 添加或更新测试 |
| `docs` | 文档变更 |
| `chore` | 构建脚本、CI、依赖更新 |

```bash
# Good
git commit -m "feat(iam-token): add token refresh support"
git commit -m "fix(mcp-debug): handle null response in connection test"
git commit -m "refactor(utils): extract common HTTP client"

# Bad
git commit -m "update"
git commit -m "修复bug"
git commit -m "fixed stuff"
```

---

## 项目特定覆盖

> 本项目为多语言工具集合，以下规则补充上述通用规范。

| 规则 | 覆盖值 | 原因 |
|------|--------|------|
| 每个工具必须有 README.md | 强制 | 说明用途、安装、使用方式 |
| 工具间禁止代码依赖 | 强制 | 每个工具是独立可维护的单元 |
| 配置文件位置 | 各工具根目录 | 无统一配置，按工具独立管理 |