# Cherry Studio 美团SSO集成指南

## 概述

Cherry Studio 已集成美团SSO认证系统，支持在使用MCP服务时自动注入SSO认证token，实现无缝的企业级认证体验。

## 功能特性

- ✅ **无侵入式集成**：未登录时保持现有体验不变
- ✅ **自动认证注入**：SSO登录后自动为MCP请求添加认证头
- ✅ **支持@mtfe/mcp-proxy**：完全兼容美团MCP代理服务
- ✅ **Token自动管理**：支持token刷新和过期处理
- ✅ **多环境支持**：支持测试和生产环境切换

## 配置要求

### 配置方式

Cherry Studio支持两种配置方式，按优先级排序：

1. **图形界面配置**（推荐）：通过设置页面进行配置
2. **环境变量配置**：通过系统环境变量配置（优先级更高）

### 图形界面配置（推荐）

1. 打开Cherry Studio设置页面
2. 找到"美团SSO设置"选项
3. 点击"配置SSO"按钮
4. 填写以下信息：
   - **启用SSO功能**：开启/关闭SSO功能
   - **Client ID**：从美团企业开放平台获取
   - **Client Secret**：从美团企业开放平台获取
   - **访问环境**：选择生产环境或测试环境
   - **SSO登录地址**：通常使用默认值

### 环境变量配置（可选）

如果需要通过环境变量配置，可以设置以下变量：

```bash
# 启用SSO功能
MEITUAN_SSO_ENABLED=true

# SSO客户端配置（必需）
MEITUAN_SSO_CLIENT_ID=your_client_id
MEITUAN_SSO_SECRET=your_client_secret

# 环境配置（可选，默认为product）
MEITUAN_SSO_ENV=product  # 或 test

# SSO登录地址（可选，默认为官方地址）
MEITUAN_SSO_LOGIN_URL=https://ssosv.sankuai.com
```

**注意**：环境变量的优先级高于图形界面配置。

### 获取SSO客户端配置

1. 访问[美团企业开放平台](https://open.sankuai.com/)
2. 创建新应用或使用现有应用
3. 配置回调地址：`cherrystudio://sso/callback`
4. 获取Client ID和Client Secret

## 使用方法

### 1. SSO配置和登录

1. 在Cherry Studio中打开设置页面
2. 找到"美团SSO设置"选项
3. 点击"配置SSO"按钮，填写Client ID和Secret
4. 启用SSO功能并保存配置
5. 点击"登录"按钮进行SSO认证
6. 系统会打开浏览器跳转到SSO登录页面
7. 完成登录后会自动回调到Cherry Studio

### 2. 配置美团MCP服务器

#### 方式一：使用预设模板

Cherry Studio提供了常用美团MCP服务的预设模板：

- **学城MCP服务**：美团学城知识库服务
- **MDP Agent**：美团数据平台Agent服务
- **MCPHub服务**：美团MCPHub平台服务

#### 方式二：手动配置

在MCP设置中添加新服务器，使用以下配置：

```json
{
  "name": "美团MCP服务",
  "type": "stdio",
  "command": "npx",
  "args": [
    "-y",
    "--registry=http://r.npm.sankuai.com",
    "@mtfe/mcp-proxy@latest",
    "https://your-mcp-server.sankuai.com/mcp",
    "--clientId", "your_client_id",
    "--accessEnv", "product",
    "--transport", "http-first"
  ]
}
```

### 3. 认证流程

1. **未登录状态**：MCP服务正常工作，但无法访问需要认证的功能
2. **SSO登录后**：系统自动为所有MCP请求添加`Authorization: Bearer <token>`头
3. **Token过期**：系统自动尝试刷新token，失败时提示重新登录

## 技术实现

### 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                    Cherry Studio                            │
├─────────────────────────────────────────────────────────────┤
│  主进程 (Main Process)                                       │
│  ├── SSOService.ts                                         │
│  │   ├── SSO登录管理                                        │
│  │   ├── Token存储和刷新                                     │
│  │   └── 认证状态管理                                        │
│  │                                                          │
│  ├── MCPService.ts (已修改)                                 │
│  │   ├── 集成SSO认证                                        │
│  │   ├── 自动注入Authorization头                            │
│  │   └── 支持@mtfe/mcp-proxy                               │
│  │                                                          │
│  └── IPC通信层                                              │
├─────────────────────────────────────────────────────────────┤
│  渲染进程 (Renderer Process)                                │
│  ├── SSO登录界面                                            │
│  ├── 认证状态显示                                           │
│  └── MCP设置集成                                            │
└─────────────────────────────────────────────────────────────┘
```

### 关键组件

#### SSOService
- 负责SSO登录流程管理
- Token的安全存储和自动刷新
- 为MCP请求提供认证头

#### MCPService集成
- 在创建MCP transport时自动注入SSO认证头
- 支持StreamableHTTP和SSE两种传输协议
- 与现有OAuth认证机制兼容

#### 美团MCP代理支持
- 完全兼容`@mtfe/mcp-proxy`参数格式
- 支持所有代理配置选项
- 自动处理认证头注入

## 配置示例

### 完整的环境变量配置

```bash
# .env 文件示例
MEITUAN_SSO_ENABLED=true
MEITUAN_SSO_CLIENT_ID=your_client_id_here
MEITUAN_SSO_SECRET=your_client_secret_here
MEITUAN_SSO_ENV=product
MEITUAN_SSO_LOGIN_URL=https://ssosv.sankuai.com
```

### MCP服务器配置示例

#### 学城知识库服务
```json
{
  "name": "学城MCP服务",
  "type": "stdio",
  "command": "npx",
  "args": [
    "-y",
    "--registry=http://r.npm.sankuai.com",
    "@mtfe/mcp-proxy@latest",
    "https://km.it.st.sankuai.com/xtable/mcp/mcp",
    "--clientId", "3434c9fc56"
  ]
}
```

#### MDP Agent服务
```json
{
  "name": "MDP Agent",
  "type": "stdio",
  "command": "npx",
  "args": [
    "-y",
    "--registry=http://r.npm.sankuai.com",
    "@mtfe/mcp-proxy@latest",
    "https://mdp.sankuai.com/mdp/agent/sse",
    "--clientId", "81470364",
    "--transport", "sse-only",
    "--keepAlive"
  ]
}
```

## 故障排除

### 常见问题

#### 1. SSO登录失败
- 检查环境变量配置是否正确
- 确认Client ID和Secret是否有效
- 检查网络连接和防火墙设置

#### 2. MCP认证失败
- 确认已完成SSO登录
- 检查MCP服务器是否支持Bearer token认证
- 验证clientId配置是否正确

#### 3. Token过期问题
- 系统会自动尝试刷新token
- 如果刷新失败，需要重新登录
- 检查token存储文件权限

### 调试方法

#### 启用调试日志
```bash
DEBUG=SSOService,MCPService npm start
```

#### 检查token状态
在开发者工具中执行：
```javascript
// 检查SSO状态
await window.api.sso.isLoggedIn()
await window.api.sso.getUserInfo()
```

## 安全考虑

### Token安全
- Token使用Electron的safeStorage进行加密存储
- 支持自动过期和刷新机制
- 不在日志中记录敏感信息

### 网络安全
- 所有SSO通信使用HTTPS
- 支持企业代理配置
- 遵循美团安全规范

## 更新日志

### v1.0.0
- 初始版本发布
- 支持基本SSO登录功能
- 集成@mtfe/mcp-proxy支持

### 后续计划
- [ ] 支持多租户SSO
- [ ] 添加SSO用户权限管理
- [ ] 支持更多美团内部服务

## 技术支持

如遇到问题，请：

1. 查看本文档的故障排除部分
2. 检查Cherry Studio日志文件
3. 联系美团SSO运维团队
4. 在GitHub提交Issue

---

**注意**：本功能需要Cherry Studio v2.0.0或更高版本。
