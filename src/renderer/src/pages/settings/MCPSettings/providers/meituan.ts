import { loggerService } from '@logger'
import { nanoid } from '@reduxjs/toolkit'
import type { MCPServer } from '@renderer/types'
import i18next from 'i18next'

const logger = loggerService.withContext('MeituanMCPProvider')

// 美团MCP服务器配置接口
interface MeituanMCPConfig {
  serverUrl: string
  clientId?: string
  accessEnv?: 'test' | 'product'
  transport?: 'http-first' | 'sse-first' | 'http-only' | 'sse-only'
  keepAlive?: boolean
  headers?: Record<string, string>
}

// 美团MCP服务器同步结果
interface MeituanSyncResult {
  success: boolean
  message: string
  addedServers: MCPServer[]
  updatedServers: MCPServer[]
  errorDetails?: string
}

/**
 * 创建美团MCP服务器配置
 */
export const createMeituanMCPServer = (config: MeituanMCPConfig): MCPServer => {
  const {
    serverUrl,
    clientId,
    accessEnv = 'product',
    transport = 'http-first',
    keepAlive = false,
    headers = {}
  } = config

  // 构建@mtfe/mcp-proxy命令参数
  const args = [
    '-y',
    '--registry=http://r.npm.sankuai.com',
    '@mtfe/mcp-proxy@latest',
    serverUrl
  ]

  // 添加可选参数
  if (clientId) {
    args.push('--clientId', clientId)
  }

  if (accessEnv !== 'product') {
    args.push('--accessEnv', accessEnv)
  }

  if (transport !== 'http-first') {
    args.push('--transport', transport)
  }

  if (keepAlive) {
    args.push('--keepAlive')
  }

  // 添加自定义头部
  Object.entries(headers).forEach(([key, value]) => {
    args.push('--header', `${key}:${value}`)
  })

  const serverId = `meituan-${nanoid()}`
  const serverName = `美团MCP服务 (${serverUrl.split('/').pop() || 'Unknown'})`

  return {
    id: serverId,
    name: serverName,
    description: `美团MCP服务器，通过@mtfe/mcp-proxy代理访问`,
    type: 'stdio',
    command: 'npx',
    args,
    isActive: true,
    provider: 'Meituan',
    providerUrl: serverUrl,
    tags: ['meituan', 'sso', 'proxy'],
    env: {
      NODE_ENV: accessEnv === 'test' ? 'development' : 'production'
    }
  }
}

/**
 * 验证美团MCP服务器URL
 */
export const validateMeituanMCPUrl = (url: string): boolean => {
  try {
    const parsedUrl = new URL(url)
    // 检查是否是美团域名
    const meituanDomains = [
      'sankuai.com',
      'meituan.com',
      'dianping.com'
    ]

    return meituanDomains.some(domain =>
      parsedUrl.hostname.endsWith(domain) ||
      parsedUrl.hostname.includes(domain)
    )
  } catch {
    return false
  }
}

/**
 * 从现有服务器列表中查找美团MCP服务器
 */
export const findMeituanMCPServers = (servers: MCPServer[]): MCPServer[] => {
  return servers.filter(server =>
    server.provider === 'Meituan' ||
    server.tags?.includes('meituan') ||
    (server.command === 'npx' && server.args?.includes('@mtfe/mcp-proxy@latest'))
  )
}

/**
 * 更新美团MCP服务器配置
 */
export const updateMeituanMCPServer = (
  existingServer: MCPServer,
  config: Partial<MeituanMCPConfig>
): MCPServer => {
  const currentArgs = existingServer.args || []
  const serverUrlIndex = currentArgs.findIndex(arg =>
    arg.startsWith('http') && validateMeituanMCPUrl(arg)
  )

  if (serverUrlIndex === -1) {
    throw new Error('无法找到服务器URL参数')
  }

  const newConfig: MeituanMCPConfig = {
    serverUrl: config.serverUrl || currentArgs[serverUrlIndex],
    clientId: config.clientId,
    accessEnv: config.accessEnv || 'product',
    transport: config.transport || 'http-first',
    keepAlive: config.keepAlive || false,
    headers: config.headers || {}
  }

  return createMeituanMCPServer(newConfig)
}

/**
 * 获取美团MCP服务器的配置信息
 */
export const getMeituanMCPConfig = (server: MCPServer): MeituanMCPConfig | null => {
  if (!server.args || server.command !== 'npx') {
    return null
  }

  const args = server.args
  const proxyIndex = args.findIndex(arg => arg === '@mtfe/mcp-proxy@latest')

  if (proxyIndex === -1) {
    return null
  }

  const serverUrl = args[proxyIndex + 1]
  if (!serverUrl || !validateMeituanMCPUrl(serverUrl)) {
    return null
  }

  const config: MeituanMCPConfig = {
    serverUrl,
    accessEnv: 'product',
    transport: 'http-first',
    keepAlive: false,
    headers: {}
  }

  // 解析其他参数
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    const nextArg = args[i + 1]

    switch (arg) {
      case '--clientId':
        if (nextArg) config.clientId = nextArg
        break
      case '--accessEnv':
        if (nextArg && (nextArg === 'test' || nextArg === 'product')) {
          config.accessEnv = nextArg as 'test' | 'product'
        }
        break
      case '--transport':
        if (nextArg && ['http-first', 'sse-first', 'http-only', 'sse-only'].includes(nextArg)) {
          config.transport = nextArg as any
        }
        break
      case '--keepAlive':
        config.keepAlive = true
        break
      case '--header':
        if (nextArg && nextArg.includes(':')) {
          const [key, ...valueParts] = nextArg.split(':')
          config.headers![key] = valueParts.join(':')
        }
        break
    }
  }

  return config
}

/**
 * 同步美团MCP服务器（占位符实现）
 */
export const syncMeituanMCPServers = async (
  existingServers: MCPServer[]
): Promise<MeituanSyncResult> => {
  const t = i18next.t

  try {
    // 这里可以实现从美团内部服务发现MCP服务器的逻辑
    // 目前返回空结果，表示需要手动配置

    logger.debug('美团MCP服务器同步完成（手动配置模式）')

    return {
      success: true,
      message: t('settings.mcp.sync.noServersAvailable', '需要手动配置美团MCP服务器'),
      addedServers: [],
      updatedServers: []
    }
  } catch (error) {
    logger.error('美团MCP服务器同步失败:', error as Error)
    return {
      success: false,
      message: t('settings.mcp.sync.error', '同步失败'),
      addedServers: [],
      updatedServers: [],
      errorDetails: String(error)
    }
  }
}

/**
 * 生成美团MCP服务器示例配置
 */
export const getMeituanMCPExamples = (): Array<{
  name: string
  description: string
  config: MeituanMCPConfig
}> => {
  return [
    {
      name: '学城MCP服务',
      description: '美团学城知识库MCP服务',
      config: {
        serverUrl: 'https://km.it.st.sankuai.com/xtable/mcp/mcp',
        clientId: '3434c9fc56',
        accessEnv: 'product',
        transport: 'http-first'
      }
    },
    {
      name: 'MDP Agent',
      description: '美团数据平台Agent服务',
      config: {
        serverUrl: 'https://mdp.sankuai.com/mdp/agent/sse',
        clientId: '81470364',
        accessEnv: 'product',
        transport: 'sse-only',
        keepAlive: true
      }
    },
    {
      name: 'MCPHub服务',
      description: '美团MCPHub平台服务',
      config: {
        serverUrl: 'http://mcphub-server.sankuai.com/mcphub-api/f5be9b7954d844',
        accessEnv: 'product',
        transport: 'sse-only'
      }
    }
  ]
}
