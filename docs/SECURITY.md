# 安全规范

本文档记录安全相关的最佳实践和注意事项。

## 基本原则

### 1. 最小权限

> 每个组件只应拥有完成任务所需的最小权限。

- 不硬编码敏感信息
- 使用环境变量或配置文件管理密钥
- API 密钥和 Token 按最小范围签发

### 2. 纵深防御

> 不要依赖单一安全机制，多层防护更可靠。

- 输入验证 + 输出编码
- 网络隔离 + 认证 + 授权
- 日志 + 监控 + 告警

### 3. 安全默认

> 默认配置应该是安全的配置。

- 新功能默认关闭危险操作
- 错误信息不应泄露内部实现细节
- 调试模式默认关闭

## 编码安全

### 敏感信息管理

```bash
# Good — 使用环境变量
export API_KEY="xxx"
export DB_PASSWORD="xxx"

# Bad — 硬编码在代码中
const API_KEY = "sk-xxx";  // NEVER DO THIS
```

- 所有密钥、Token、密码通过环境变量注入
- `.env` 文件必须在 `.gitignore` 中
- 提供 `.env.example` 模板，不含真实密钥

### 输入验证

- 所有外部输入必须验证和清理
- 永远不要信任用户输入
- 使用参数化查询防止注入攻击

```javascript
// Good — 参数化查询
db.query("SELECT * FROM users WHERE id = ?", [userId]);

// Bad — 字符串拼接
db.query(`SELECT * FROM users WHERE id = '${userId}'`);
```

### 依赖安全

- 定期检查依赖漏洞（`npm audit`、`pip audit`）
- 锁定依赖版本（`package-lock.json`、`requirements.txt` 含版本号）
- 及时更新已知漏洞的依赖

### 错误处理

- 不在用户可见的错误信息中暴露内部实现
- 不在日志中记录完整的敏感数据（Token、密码）
- 使用错误码而非内部堆栈信息返回给客户端

```javascript
// Good — 给用户通用错误，内部记录详细日志
console.error(`[Auth] login failed for user ${userId}: invalid token`, { cause: err });
return { error: "Authentication failed. Please check your credentials." };

// Bad — 泄露内部信息
res.status(500).json({ error: err.stack });
```

## 工具特定安全

### MCP 工具

- 不在 MCP 工具描述中暴露敏感参数
- 验证 MCP 请求来源
- 限制 MCP 连接的权限范围

### Web 工具

- 设置合理的 CORS 策略
- 使用 HTTPS（即使是本地开发也建议）
- 防范 CSRF 和 XSS

### CLI 工具

- 不记录完整的命令行参数（可能包含密钥）
- 敏感操作（删除、覆盖）需要确认
- 不支持任意命令执行

## 安全检查清单

- [ ] 敏感信息不硬编码
- [ ] `.env` 在 `.gitignore` 中
- [ ] 提供了 `.env.example`
- [ ] 外部输入已验证
- [ ] 无 SQL/命令注入风险
- [ ] 依赖已审计，无不安全版本
- [ ] 错误信息不泄露内部细节
- [ ] Token/密钥有合理的过期时间