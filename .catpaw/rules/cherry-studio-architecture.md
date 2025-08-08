# Cherry Studio Electron 架构文档

## 项目概述

Cherry Studio 是一个基于 Electron 构建的跨平台 AI 桌面客户端，支持多种 LLM 提供商，可在 Windows、Mac 和 Linux 上运行。项目采用现代化的技术栈和模块化架构设计。

## 技术栈

### 核心框架

- **Electron**: 37.2.3 - 跨平台桌面应用框架
- **Node.js**: >=22.0.0 - 服务端运行时
- **TypeScript**: ^5.6.2 - 类型安全的 JavaScript

### 构建工具

- **electron-vite**: 4.0.0 - Electron 应用构建工具
- **Vite**: rolldown-vite@latest - 快速构建工具
- **SWC**: React 编译器，提供更快的构建速度

### 前端技术

- **React**: ^19.0.0 - UI 框架
- **Antd**: 5.24.7 - UI 组件库
- **Styled Components**: ^6.1.11 - CSS-in-JS 样式方案
- **Redux Toolkit**: ^2.2.5 - 状态管理
- **React Router**: 6 - 路由管理

### 数据存储

- **LibSQL**: 0.14.0 - SQLite 兼容数据库
- **Dexie**: ^4.0.8 - IndexedDB 封装库
- **Electron Store**: ^8.2.0 - 配置存储

## Electron 架构设计

### 1. 多进程架构

```
Cherry Studio Application
├── 主进程 (Main Process)
│   ├── 应用生命周期管理
│   ├── 窗口管理 (WindowService)
│   ├── 系统集成服务
│   ├── IPC 通信处理
│   └── 原生 API 访问
├── 渲染进程 (Renderer Process)
│   ├── 主窗口 (index.html)
│   ├── 迷你窗口 (miniWindow.html)
│   ├── 选择工具栏 (selectionToolbar.html)
│   ├── 选择操作 (selectionAction.html)
│   └── 追踪窗口 (traceWindow.html)
└── 预加载脚本 (Preload Scripts)
    └── 安全的 API 桥接
```

### 2. 主进程架构 (src/main/)

#### 核心模块

- **index.ts**: 应用入口，负责初始化和生命周期管理
- **bootstrap.ts**: 应用启动前的初始化配置
- **ipc.ts**: IPC 通信处理中心 (29KB)
- **config.ts**: 应用配置管理

#### 服务层 (services/)

主进程包含 30+ 个专业化服务：

**核心服务**
- `WindowService.ts` (21KB): 窗口管理和状态控制
- `ConfigManager.ts` (7KB): 配置管理
- `LoggerService.ts` (11KB): 日志服务
- `AppService.ts` (3KB): 应用基础服务

**AI 相关服务**
- `MCPService.ts` (32KB): Model Context Protocol 服务
- `CopilotService.ts` (7KB): AI 助手服务
- `KnowledgeService.ts` (24KB): 知识库管理
- `VertexAIService.ts` (5KB): Google Vertex AI 集成

**文件和存储服务**
- `FileStorage.ts` (19KB): 文件存储管理
- `BackupManager.ts` (23KB): 备份管理
- `S3Storage.ts` (5KB): S3 存储集成
- `WebDav.ts` (4KB): WebDAV 集成

**系统集成服务**
- `SelectionService.ts` (50KB): 文本选择和处理
- `ShortcutService.ts` (9KB): 快捷键管理
- `TrayService.ts` (4KB): 系统托盘
- `ProxyManager.ts` (7KB): 代理管理
- `AppUpdater.ts` (10KB): 自动更新

**专业化服务**
- `ExportService.ts` (11KB): 导出功能
- `SearchService.ts` (2KB): 搜索服务
- `ThemeService.ts` (2KB): 主题管理
- `NotificationService.ts` (1KB): 通知服务

#### 集成模块 (integration/)

- 第三方服务集成
- API 客户端管理
- 外部工具连接

#### 知识库 (knowledge/)

- 知识库数据处理
- 文档解析和索引
- 向量化存储

#### MCP 服务器 (mcpServers/)

- Model Context Protocol 服务器实现
- 插件化扩展支持

### 3. 渲染进程架构 (src/renderer/src/)

#### 应用结构

```
src/renderer/src/
├── App.tsx - 应用根组件
├── Router.tsx - 路由配置
├── entryPoint.tsx - 入口点
└── init.ts - 初始化脚本
```

#### 核心模块

- **aiCore/**: AI 核心功能模块
- **components/**: 可复用 UI 组件
- **pages/**: 页面组件
- **store/**: Redux 状态管理
- **services/**: 渲染进程服务
- **hooks/**: React Hooks
- **utils/**: 工具函数

#### 专业化模块

- **databases/**: 数据库操作
- **handler/**: 事件处理器
- **providers/**: Context 提供者
- **queue/**: 任务队列管理
- **tools/**: 工具集成
- **trace/**: 追踪和监控
- **windows/**: 窗口管理
- **workers/**: Web Workers

### 4. 预加载脚本 (src/preload/)

#### 安全桥接

- **index.ts** (24KB): 主要的 API 桥接文件
- 通过 `contextBridge` 安全暴露主进程 API
- 实现上下文隔离，防止渲染进程直接访问 Node.js API

#### 主要 API 分类

```typescript
// 应用管理
app: { getAppInfo, reload, setProxy, checkForUpdate, ... }

// 文件操作
file: { select, upload, delete, read, write, ... }

// 备份服务
backup: { backup, restore, backupToWebdav, ... }

// 知识库
knowledgeBase: { create, reset, delete, add, ... }

// 系统集成
system: { getDeviceType, getHostname }
shortcuts: { update }
notification: { send }
```

### 5. 包管理架构 (packages/)

#### 模块化设计

- **shared/**: 共享代码和类型定义
- **mcp-trace/**: MCP 追踪模块
  - `trace-core/`: 核心追踪功能
  - `trace-node/`: Node.js 追踪实现
  - `trace-web/`: Web 追踪实现

## 构建配置

### Electron Vite 配置

```typescript
// electron.vite.config.ts
export default defineConfig({
  main: {
    // 主进程配置
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@main': resolve('src/main') } }
  },
  preload: {
    // 预加载脚本配置
    plugins: [react({ tsDecorators: true })]
  },
  renderer: {
    // 渲染进程配置
    plugins: [react(), CodeInspectorPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: 'src/renderer/index.html',
          miniWindow: 'src/renderer/miniWindow.html',
          selectionToolbar: 'src/renderer/selectionToolbar.html',
          selectionAction: 'src/renderer/selectionAction.html',
          traceWindow: 'src/renderer/traceWindow.html'
        }
      }
    }
  }
})
```

### 多窗口支持

应用支持 5 种不同类型的窗口：

1. **主窗口**: 主要的用户界面
2. **迷你窗口**: 精简版界面
3. **选择工具栏**: 文本选择工具
4. **选择操作**: 选择后的操作界面
5. **追踪窗口**: 调试和监控界面

## 关键特性实现

### 1. IPC 通信架构

- 使用 `IpcChannel` 枚举定义通信频道
- 支持同步和异步消息传递
- 实现追踪上下文传递 (`tracedInvoke`)

### 2. 安全模型

- 启用上下文隔离 (Context Isolation)
- 通过预加载脚本安全暴露 API
- 禁用 Node.js 集成在渲染进程中

### 3. 跨平台适配

```typescript
// 平台特定优化
if (isWin) {
  app.commandLine.appendSwitch('wm-window-animations-disabled')
}

if (isLinux && process.env.XDG_SESSION_TYPE === 'wayland') {
  app.commandLine.appendSwitch('enable-features', 'GlobalShortcutsPortal')
}
```

### 4. 性能优化

- 使用 SWC 替代 Babel 提升编译速度
- 代码分割和懒加载
- 生产环境禁用代码分割以减少文件数量

### 5. 开发体验

- 热重载支持
- 开发者工具集成
- 代码检查器插件
- TypeScript 严格模式

## 部署和分发

### 构建脚本

```json
{
  "build:win": "dotenv npm run build && electron-builder --win --x64 --arm64",
  "build:mac": "dotenv npm run build && electron-builder --mac --arm64 --x64",
  "build:linux": "dotenv npm run build && electron-builder --linux --x64 --arm64"
}
```

### 自动更新

- 集成 `electron-updater` 实现自动更新
- 支持测试通道和正式发布通道
- 增量更新支持

### 代码签名和公证

- macOS 应用公证支持
- Windows 代码签名
- 安全分发机制

## 开发指南

### 环境要求

- Node.js >= 22.0.0
- Yarn 4.9.1 (包管理器)
- 支持 TypeScript 的 IDE

### 开发命令

```bash
# 开发模式
yarn dev

# 构建应用
yarn build

# 类型检查
yarn typecheck

# 测试
yarn test

# 代码格式化
yarn format
```

### 项目结构最佳实践

1. **模块化设计**: 每个功能模块独立，便于维护
2. **类型安全**: 全面使用 TypeScript
3. **服务化架构**: 主进程采用服务化设计
4. **安全优先**: 严格的安全模型和权限控制
5. **跨平台兼容**: 考虑不同操作系统的差异

## 扩展和定制

### 插件系统

- MCP (Model Context Protocol) 服务器支持
- 可扩展的 AI 提供商集成
- 主题系统支持

### API 集成

- 支持多种 AI 服务提供商
- RESTful API 服务器
- WebDAV 和 S3 存储集成

### 国际化

- 多语言支持 (i18next)
- 自动翻译脚本
- 语言包管理

这个架构文档为 Cherry Studio 的开发、维护和扩展提供了全面的技术指导。
