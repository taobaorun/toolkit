# mcp-debug 工具开发

本 ExecPlan 是一个活文档。`进展`、`意外发现`、`决策日志`、`结果回顾`等章节必须随工作推进保持更新。

## 目的 / 全局视角

开发一个 Shell 实现的 MCP 服务调试工具。用户只需指定传输类型（`sse` 或 `streamable`）、服务 URL 和调试动作（`list` / `call`），工具自动完成 MCP 协议握手（initialize → initialized → 执行动作），并以格式化 JSON 输出结果。

最终效果：
```bash
# 列出工具
./mcp-debug.sh sse http://localhost:11768/mcpserver1/sse list

# 调用工具
./mcp-debug.sh streamable http://localhost:11768/mcpserver1/streamable/mcp call tool_name '{"key":"value"}'
```

## 确认状态

- [x] **待用户确认** — 创建完 ExecPlan 后，将目标、影响范围、关键决策展示给用户
- [x] 用户已确认，开始执行 (2026-06-14 10:30)

## 进展

- [x] (2026-06-14 10:30) 创建 `tools/mcp-debug/` 目录结构（`.tool.yml`、`README.md`）
- [x] (2026-06-14 10:30) 实现主入口 `mcp-debug.sh`：参数解析 → 分发到对应 transport
- [x] (2026-06-14 10:30) 实现 Streamable HTTP transport：initialize → session 提取 → list/call
- [x] (2026-06-14 10:30) 实现 SSE transport：SSE 连接管理 → session 获取 → initialize → list/call
- [x] (2026-06-14 10:30) 格式化 JSON 输出（jq + 无 jq 降级）
- [ ] 验证：对真实 MCP 服务执行 list 和 call

## 意外发现

_待执行过程中记录_

## 决策日志

- 决策：单文件实现全部逻辑，不拆分 SSE/Streamable 到独立文件
  理由：总行数 ~230 行，拆分反而增加维护负担；两个 transport 共享参数解析、依赖检查、JSON 格式化等工具函数
  日期/作者：2026-06-14 / yuanxuan

- 决策：Streamable transport 中初始化请求的 `Accept` header 使用 `text/event-stream, application/json`
  理由：基于语雀文档中的 curl 示例；部分 MCP 服务实现只接受 event-stream Accept 才会返回 session header
  日期/作者：2026-06-14 / yuanxuan

- 决策：SSE 模式用临时文件 + grep 解析 SSE 流，而非命名管道
  理由：临时文件更简单，调试时可以查看原始 SSE 输出；命名管道在高并发场景更好但此处不需要
  日期/作者：2026-06-14 / yuanxuan

## 结果回顾

完成了 mcp-debug 工具的单文件 Shell 实现（~230 行），覆盖了 Streamable 和 SSE 两种 MCP 传输协议。

**做了什么**：
- 实现了参数解析、依赖检查（curl/jq）、友好的 usage 提示和错误处理
- Streamable transport：initialize → 提取 session header → initialized → list/call → jq 格式化输出
- SSE transport：后台 curl 维持 SSE → 解析 endpoint event 提取 sessionId → 通过 /mcp/message POST 协议交互 → 从 SSE 流匹配 JSON-RPC 响应

**遗留问题**：
- 缺少对真实 MCP 服务的端到端验证（需要可访问的 MCP 测试服务）
- SSE 响应解析使用 grep + python3 fallback，极端情况下可能漏掉跨行 JSON 响应
- 未添加 shell 单元测试（shell 脚本的测试基础设施待建立）

---

## 上下文和方向

### 当前状态

项目是 toolkit monorepo，所有工具在 `tools/` 下。尚无任何工具实现。mcp-debug 是第一个工具。

### MCP 协议关键要点（来自语雀文档）

**SSE Transport**：
1. 建立 SSE 长连接 → 获取 sessionId（从 endpoint 事件的 URL 参数中提取）
2. 通过 `POST /mcp/message?sessionId=<id>` 发送 JSON-RPC 请求
3. 响应通过 SSE 流返回（不是 POST 的 HTTP response body）

**Streamable HTTP Transport**：
1. `POST initialize` → 从响应头 `mcp-session-id` 获取 session ID
2. 后续请求都带 `mcp-session-id` header
3. 响应直接在 HTTP body 中返回（可以是 JSON 或 SSE stream）

### 关键术语

| 术语 | 说明 |
|------|------|
| SSE | Server-Sent Events，长连接推送协议 |
| Streamable HTTP | MCP 新传输协议，请求-响应模式，无需长连接 |
| JSON-RPC 2.0 | MCP 使用的 RPC 协议 |
| sessionId | MCP 会话标识，SSE 中通过 URL 参数传递，Streamable 中通过 HTTP header 传递 |

## 工作计划

### 新增文件

```
tools/mcp-debug/
├── .tool.yml              # artifact: [cli], runtime: shell
├── README.md              # 用途、使用说明
└── mcp-debug.sh           # 主脚本（单文件实现）
```

### 实现顺序

1. **`.tool.yml`** — 声明 CLI artifact，runtime: shell
2. **`mcp-debug.sh`** — 单文件实现全部功能（按"最小实现"原则，不拆多文件）
3. **`README.md`** — 使用说明和示例
4. 验证测试

## 具体步骤

### 步骤 1：创建工具骨架

```bash
mkdir -p tools/mcp-debug
```

创建 `.tool.yml` 和 `README.md`。

### 步骤 2：实现 mcp-debug.sh

脚本入口参数：
```bash
./mcp-debug.sh <type> <url> <action> [tool_name] [tool_args]
# type: sse | streamable
# url:  MCP 服务地址
# action: list | call
# tool_name: call 时需要
# tool_args: call 时需要，JSON 字符串
```

**Streamable transport 实现逻辑（较简单，先实现）**：
1. `POST initialize` → 用 `curl -i` 捕获响应头，`grep -i mcp-session-id` 提取 session ID
2. `POST notifications/initialized`（带 session header）
3. `POST tools/list` 或 `POST tools/call`（带 session header）
4. 响应通过 `jq` 格式化输出

**SSE transport 实现逻辑**：
1. 启动后台 `curl -N <url>`（用户提供的完整 SSE 地址），输出重定向到临时文件
2. 等待并解析 SSE 事件，提取 sessionId
3. `POST initialize` → 响应从 SSE 流读取
4. `POST tools/list` 或 `tools/call` → 响应从 SSE 流读取
5. 清理后台进程和临时文件

**关键实现细节**：
- 依赖 `curl` 和 `jq`（需要用户安装）
- SSE 响应解析：需要从 SSE 流中匹配 `id:` 对应的 JSON-RPC 响应
- 超时处理：SSE 连接设置合理超时（默认 10s）
- 错误处理：HTTP 错误码、JSON-RPC error 响应、连接失败

### 步骤 3：验证

```bash
# 对 Streamable 服务测试 list
./tools/mcp-debug/mcp-debug.sh streamable http://localhost:11768/mcpserver1/streamable/mcp list

# 对 SSE 服务测试 list
./tools/mcp-debug/mcp-debug.sh sse http://localhost:11768/mcpserver1/sse list

# 测试 call（需要知道实际 tool name）
./tools/mcp-debug/mcp-debug.sh streamable http://localhost:11768/mcpserver1/streamable/mcp call some_tool '{}'
```

## 验证和验收

1. `./mcp-debug.sh streamable <url> list` → 输出格式化的 tools 列表 JSON
2. `./mcp-debug.sh sse <url> list` → 输出格式化的 tools 列表 JSON
3. `./mcp-debug.sh streamable <url> call <name> '{}'` → 输出工具调用结果 JSON
4. 错误场景：无 jq 时给出友好提示；URL 不可达时给出明确错误

## 接口和依赖

| 依赖 | 用途 | 版本要求 |
|------|------|----------|
| `curl` | HTTP 请求（SSE + Streamable） | 系统自带 |
| `jq` | JSON 格式化输出 | >= 1.6 |
| `bash` | 脚本运行环境 | >= 4.0（macOS 自带） |

## 产物和笔记

_待执行后填写_