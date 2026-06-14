# mcp-debug

MCP 服务调试工具 — 通过 Shell 脚本一键调试 MCP 服务的 `tools/list` 和 `tools/call` 动作。

支持 **SSE** 和 **Streamable HTTP** 两种 MCP 传输协议。

## 依赖

- `curl` — HTTP 请求（系统自带）
- `jq`（可选）— JSON 格式化输出。未安装时输出原始 JSON

```bash
brew install jq  # macOS
```

## 安装

```bash
# curl 一键安装
curl -sSL https://github.com/<user>/toolkit/raw/master/tools/mcp-debug/mcp-debug.sh -o /usr/local/bin/mcp-debug
chmod +x /usr/local/bin/mcp-debug

# 或者本地直接运行
./tools/mcp-debug/mcp-debug.sh <type> <url> <action>
```

## 用法

```bash
mcp-debug.sh <type> <url> <action> [tool_name] [tool_args]
```

### 参数

| 参数 | 说明 |
|------|------|
| `type` | 传输类型：`sse` 或 `streamable` |
| `url` | MCP 服务的完整 endpoint URL |
| `action` | 调试动作：`list`（列出工具）或 `call`（调用工具） |
| `tool_name` | 工具名称，仅 `call` 时需要 |
| `tool_args` | 工具参数 JSON，仅 `call` 时需要 |

### 示例

```bash
# Streamable — 列出工具
./mcp-debug.sh streamable http://localhost:11768/mcpserver1/streamable/mcp list

# SSE — 列出工具
./mcp-debug.sh sse http://localhost:11768/mcpserver1/sse list

# Streamable — 调用工具
./mcp-debug.sh streamable http://localhost:11768/mcpserver1/streamable/mcp call my_tool '{"key":"value"}'

# SSE — 调用工具
./mcp-debug.sh sse http://localhost:11768/mcpserver1/sse call my_tool '{}'
```

## 原理

### Streamable HTTP

```
POST initialize → 提取 mcp-session-id header
  → POST notifications/initialized
  → POST tools/list 或 tools/call
  → JSON response in HTTP body ✅
```

### SSE

```
curl -N <url> (后台维持 SSE 连接)
  → 解析 endpoint event 获取 sessionId
  → POST /mcp/message?sessionId=<id> (initialize)
  → POST /mcp/message?sessionId=<id> (tools/list or tools/call)
  → 从 SSE 流中匹配 JSON-RPC id 获取响应 ✅
```

## 注意事项

- 每次调用独立完成 MCP 握手（initialize → initialized），不复用 session
- SSE 模式需要服务端支持标准的 `/mcp/message?sessionId=` 端点
- 调试完成后 SSE 连接自动清理