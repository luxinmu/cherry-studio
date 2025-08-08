import { loggerService } from '@logger'
import { getConfigDir } from '@main/utils/file'
import { app, safeStorage } from 'electron'
import { EventEmitter } from 'events'
import fs from 'fs/promises'
import path from 'path'

const logger = loggerService.withContext('SSOService')

// SSO配置接口
interface SSOConfig {
  clientId?: string
  secret?: string
  accessEnv?: 'test' | 'product'
  loginUrl?: string
  enabled?: boolean
}

// SSO用户信息接口
interface SSOUserInfo {
  email: string
  login: string
  name: string
  code: string
  tenantId: number
  id: number
}

// SSO Token信息接口
interface SSOTokenInfo {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  userInfo?: SSOUserInfo
}

class SSOService extends EventEmitter {
  private tokenFilePath: string
  private configFilePath: string
  private config: SSOConfig = {}
  private currentToken: SSOTokenInfo | null = null
  private refreshTimer: NodeJS.Timeout | null = null

  constructor() {
    super()
    this.tokenFilePath = path.join(app.getPath('userData'), '.meituan_sso_token')
    this.configFilePath = path.join(getConfigDir(), 'sso-config.json')
    this.loadConfig()
    this.loadStoredToken()
  }

  /**
   * 生成美团SSO签名认证头
   */
  private generateSignedHeaders(method: string, uri: string, clientId: string, secret: string): Record<string, string> {
    // 获取UTC时间字符串
    const timespan = new Date().toUTCString()

    // 构建签名字符串：method + " " + uri + "\n" + timespan
    const stringToSign = `${method} ${uri}\n${timespan}`

    logger.debug('String to sign:', stringToSign)

    // 使用HMAC-SHA1生成签名
    const hash = crypto.createHmac('sha1', secret).update(stringToSign, 'utf8').digest()

    // 转换为Base64
    const signature = hash.toString('base64')

    // 构建Authorization头：MWS + " " + client_id + ":" + signature
    const authorization = `MWS ${clientId}:${signature}`

    logger.debug('Generated authorization:', authorization.replace(signature, '***'))

    return {
      Authorization: authorization,
      Date: timespan,
      ClientId: clientId
    }
  }

  /**
   * 加载SSO配置
   */
  private async loadConfig(): Promise<void> {
    try {
      // 首先尝试从配置文件加载
      let configFromFile: Partial<SSOConfig> = {}
      try {
        const configData = await fs.readFile(this.configFilePath, 'utf-8')
        configFromFile = JSON.parse(configData)
        logger.debug('SSO config loaded from file')
      } catch (error) {
        // 配置文件不存在或读取失败，使用默认配置
        logger.debug('SSO config file not found, using defaults')
      }

      // 合并配置：环境变量 > 配置文件 > 默认值
      this.config = {
        enabled: process.env.MEITUAN_SSO_ENABLED === 'true' || configFromFile.enabled || false,
        clientId: process.env.MEITUAN_SSO_CLIENT_ID || configFromFile.clientId || '',
        secret: process.env.MEITUAN_SSO_SECRET || configFromFile.secret || '',
        accessEnv: (process.env.MEITUAN_SSO_ENV as 'test' | 'product') || configFromFile.accessEnv || 'product',
        loginUrl: process.env.MEITUAN_SSO_LOGIN_URL || configFromFile.loginUrl || 'https://ssosv.sankuai.com'
      }

      logger.debug('SSO config loaded:', {
        ...this.config,
        secret: this.config.secret ? '***' : '',
        clientId: this.config.clientId ? this.config.clientId.substring(0, 8) + '***' : ''
      })
    } catch (error) {
      logger.error('Failed to load SSO config:', error as Error)
    }
  }

  /**
   * 保存SSO配置到文件
   */
  private async saveConfigToFile(): Promise<void> {
    try {
      // 确保配置目录存在
      await fs.mkdir(path.dirname(this.configFilePath), { recursive: true })

      // 保存配置（不包含敏感信息的调试版本用于日志）
      const configToSave = { ...this.config }
      await fs.writeFile(this.configFilePath, JSON.stringify(configToSave, null, 2), 'utf-8')

      logger.debug('SSO config saved to file')
    } catch (error) {
      logger.error('Failed to save SSO config:', error as Error)
      throw error
    }
  }

  /**
   * 从本地文件加载存储的token
   */
  private async loadStoredToken(): Promise<void> {
    try {
      const encryptedToken = await fs.readFile(this.tokenFilePath)
      const tokenData = JSON.parse(safeStorage.decryptString(Buffer.from(encryptedToken)))

      // 检查token是否过期
      if (tokenData.expiresAt && Date.now() > tokenData.expiresAt) {
        logger.debug('Stored token expired, removing')
        await this.clearToken()
        return
      }

      this.currentToken = tokenData
      this.emit('tokenLoaded', this.currentToken)
      logger.debug('SSO token loaded from storage')

      // 设置自动刷新
      this.scheduleTokenRefresh()
    } catch (error) {
      // 文件不存在或解密失败不是错误
      logger.debug('No valid stored token found')
    }
  }

  /**
   * 保存token到本地文件
   */
  private async saveToken(tokenInfo: SSOTokenInfo): Promise<void> {
    try {
      const encryptedToken = safeStorage.encryptString(JSON.stringify(tokenInfo))
      await fs.writeFile(this.tokenFilePath, encryptedToken)
      this.currentToken = tokenInfo
      this.emit('tokenSaved', tokenInfo)
      logger.debug('SSO token saved to storage')

      // 设置自动刷新
      this.scheduleTokenRefresh()
    } catch (error) {
      logger.error('Failed to save SSO token:', error as Error)
      throw error
    }
  }

  /**
   * 清除存储的token
   */
  public async clearToken(): Promise<void> {
    try {
      await fs.unlink(this.tokenFilePath).catch(() => {}) // 忽略文件不存在的错误
      this.currentToken = null

      if (this.refreshTimer) {
        clearTimeout(this.refreshTimer)
        this.refreshTimer = null
      }

      this.emit('tokenCleared')
      logger.debug('SSO token cleared')
    } catch (error) {
      logger.error('Failed to clear SSO token:', error as Error)
    }
  }

  /**
   * 安排token刷新
   */
  private scheduleTokenRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
    }

    if (!this.currentToken?.expiresAt) {
      return
    }

    // 在过期前5分钟刷新
    const refreshTime = this.currentToken.expiresAt - Date.now() - 5 * 60 * 1000
    if (refreshTime > 0) {
      this.refreshTimer = setTimeout(() => {
        this.refreshToken()
      }, refreshTime)
    }
  }

  /**
   * 刷新token
   */
  private async refreshToken(): Promise<void> {
    if (!this.currentToken?.refreshToken) {
      logger.warn('No refresh token available, clearing current token')
      await this.clearToken()
      return
    }

    try {
      logger.debug('Starting token refresh')

      // 美团SSO使用GET请求到/sson/oauth2.0/refresh-token端点
      const tokenUrl = `${this.config.loginUrl}/sson/oauth2.0/refresh-token`
      const params = new URLSearchParams({
        refresh_token: this.currentToken.refreshToken
      })

      const fullUrl = `${tokenUrl}?${params.toString()}`

      // 提取URI用于签名（只包含路径，不包含查询参数）
      const urlObj = new URL(fullUrl)
      const uri = urlObj.pathname

      // 生成签名认证头
      const signedHeaders = this.generateSignedHeaders('GET', uri, this.config.clientId!, this.config.secret!)

      logger.debug('Refreshing token at:', fullUrl)

      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json;charset=UTF-8',
          'User-Agent': 'Cherry-Studio/1.0',
          ...signedHeaders
        }
      })

      if (!response.ok) {
        const errorText = await response.text()
        logger.error('Token refresh failed:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        })
        throw new Error(`Token refresh failed: ${response.status} ${response.statusText}`)
      }

      const responseData = await response.json()

      // 根据返回的数据结构解析
      if (responseData.code === 200 && responseData.data) {
        const tokenData = responseData.data

        // 更新token信息
        const updatedTokenInfo: SSOTokenInfo = {
          ...this.currentToken,
          accessToken: tokenData.accessToken,
          refreshToken: tokenData.refreshToken || this.currentToken.refreshToken,
          expiresAt: tokenData.expires ? Date.now() + tokenData.expires * 1000 : Date.now() + 24 * 60 * 60 * 1000
        }

        await this.saveToken(updatedTokenInfo)
        logger.debug('Token refresh successful')
      } else {
        logger.error('Invalid refresh response:', responseData)
        throw new Error(`Token refresh failed: ${responseData.msg || 'Unknown error'}`)
      }
    } catch (error) {
      logger.error('Failed to refresh token:', error as Error)
      // 刷新失败，清除token，用户需要重新登录
      await this.clearToken()
      this.emit('tokenExpired')
    }
  }

  /**
   * 检查SSO是否启用
   */
  public isEnabled(): boolean {
    return this.config.enabled === true
  }

  /**
   * 检查是否已登录
   */
  public isLoggedIn(): boolean {
    return this.currentToken !== null && (!this.currentToken.expiresAt || Date.now() < this.currentToken.expiresAt)
  }

  /**
   * 获取当前访问token
   */
  public getAccessToken(): string | null {
    if (!this.isLoggedIn()) {
      return null
    }
    return this.currentToken?.accessToken || null
  }

  /**
   * 获取当前用户信息
   */
  public getUserInfo(): SSOUserInfo | null {
    if (!this.isLoggedIn()) {
      return null
    }
    return this.currentToken?.userInfo || null
  }

  /**
   * 启动SSO登录流程
   */
  public async startLogin(): Promise<string> {
    if (!this.isEnabled()) {
      throw new Error('SSO is not enabled')
    }

    if (!this.config.clientId) {
      throw new Error('SSO client ID is not configured')
    }

    // 生成回调地址
    const redirectUri = 'cherrystudio://sso/callback'

    // 生成登录URL，参考美团SSO的标准格式
    const loginUrl = `${this.config.loginUrl}/sson/login?client_id=${this.config.clientId}&locale=zh&redirect_uri=${encodeURIComponent(redirectUri)}&t=${Date.now()}`

    logger.debug('Generated SSO login URL:', loginUrl.replace(this.config.clientId!, '***'))
    return loginUrl
  }

  /**
   * 处理SSO回调
   */
  public async handleCallback(code: string): Promise<SSOUserInfo> {
    if (!this.config.clientId || !this.config.secret) {
      throw new Error('SSO configuration is incomplete')
    }

    try {
      logger.debug('Starting SSO token exchange with code')

      // 1. 使用授权码换取访问令牌
      const tokenResponse = await this.exchangeCodeForToken(code)
      logger.debug('Token exchange response:', tokenResponse)

      // 2. 使用访问令牌获取用户信息
      const userInfo = await this.getUserInfoFromToken(tokenResponse.access_token)
      logger.debug('User info from token response:', userInfo)

      // 3. 构建完整的token信息
      const tokenInfo: SSOTokenInfo = {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        expiresAt: tokenResponse.expires_in
          ? Date.now() + tokenResponse.expires_in * 1000
          : Date.now() + 24 * 60 * 60 * 1000,
        userInfo: userInfo
      }

      // 4. 保存token信息
      await this.saveToken(tokenInfo)
      logger.info('SSO login successful for user:', userInfo.login)

      return userInfo
    } catch (error) {
      logger.error('SSO callback handling failed:', error as Error)
      throw new Error(`SSO登录失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  /**
   * 使用授权码换取访问令牌
   */
  private async exchangeCodeForToken(code: string): Promise<{
    access_token: string
    refresh_token?: string
    expires_in?: number
    token_type?: string
  }> {
    // 美团SSO使用GET请求到/sson/oauth2.0/access-token端点
    const tokenUrl = `${this.config.loginUrl}/sson/oauth2.0/access-token`

    // 构建查询参数
    const params = new URLSearchParams({
      code: code
    })

    const fullUrl = `${tokenUrl}?${params.toString()}`

    // 提取URI用于签名（只包含路径，不包含查询参数）
    const urlObj = new URL(fullUrl)
    const uri = urlObj.pathname

    // 生成签名认证头
    const signedHeaders = this.generateSignedHeaders('GET', uri, this.config.clientId!, this.config.secret!)

    logger.debug('Exchanging code for token at:', fullUrl)

    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json;charset=UTF-8',
        'User-Agent': 'Cherry-Studio/1.0',
        ...signedHeaders
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error('Token exchange failed:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      })
      throw new Error(`Token exchange failed: ${response.status} ${response.statusText}`)
    }

    const responseData = await response.json()
    logger.debug('Token exchange complete.')

    // 根据返回的数据结构解析
    if (responseData.code === 200 && responseData.data) {
      const tokenData = responseData.data
      return {
        access_token: tokenData.accessToken,
        refresh_token: tokenData.refreshToken,
        expires_in: tokenData.expires || 86400,
        token_type: 'Bearer'
      }
    } else {
      logger.error('Invalid token response:', responseData)
      throw new Error(`Token exchange failed: ${responseData.msg || 'Unknown error'}`)
    }
  }

  /**
   * 使用访问令牌获取用户信息
   */
  private async getUserInfoFromToken(accessToken: string): Promise<SSOUserInfo> {
    const userInfoUrl = `${this.config.loginUrl}/open/api/session/userinfo`

    // 提取URI用于签名（只包含路径，不包含查询参数）
    const urlObj = new URL(userInfoUrl)
    const uri = urlObj.pathname

    // 生成签名认证头
    const signedHeaders = this.generateSignedHeaders('POST', uri, this.config.clientId!, this.config.secret!)

    // 构建请求体
    const requestBody = {
      accessToken: accessToken
    }

    logger.debug('Fetching user info from:', userInfoUrl)

    const response = await fetch(userInfoUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json;charset=UTF-8',
        'User-Agent': 'Cherry-Studio/1.0',
        ...signedHeaders
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error('User info fetch failed:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      })
      throw new Error(`Failed to fetch user info: ${response.status} ${response.statusText}`)
    }

    const responseData = await response.json()
    logger.debug('User info fetched successfully')

    // 根据返回的数据结构解析
    if (responseData.code === 200 && responseData.data) {
      const userData = responseData.data

      // 转换为标准格式
      const userInfo: SSOUserInfo = {
        email: userData.email,
        login: userData.loginName, // mis号
        name: userData.name || userData.loginName,
        code: userData.staffId || '', // 员工号
        tenantId: userData.tenantId || 1, // 美团默认为1
        id: userData.uid || 0
      }

      return userInfo
    } else {
      logger.error('Invalid user info response:', responseData)
      throw new Error(`Failed to fetch user info: ${responseData.msg || 'Unknown error'}`)
    }
  }

  /**
   * 登出
   */
  public async logout(): Promise<void> {
    // 如果有有效的token，先调用SSO登出端点
    if (this.isLoggedIn() && this.currentToken?.accessToken) {
      try {
        const logoutUrl = `${this.config.loginUrl}/sson/oauth2.0/logout`
        const params = new URLSearchParams({
          access_token: this.currentToken.accessToken,
          client_id: this.config.clientId!
        })

        const fullUrl = `${logoutUrl}?${params.toString()}`
        logger.debug('Logging out from SSO at:', fullUrl.replace(this.currentToken.accessToken, '***'))

        const response = await fetch(fullUrl, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'User-Agent': 'Cherry-Studio/1.0'
          }
        })

        if (!response.ok) {
          logger.warn('SSO logout request failed, but continuing with local cleanup:', {
            status: response.status,
            statusText: response.statusText
          })
        } else {
          logger.debug('SSO logout successful')
        }
      } catch (error) {
        logger.warn('SSO logout request failed, but continuing with local cleanup:', error as Error)
      }
    }

    // 无论SSO登出是否成功，都清除本地token
    await this.clearToken()
    logger.info('SSO logout completed')
  }

  /**
   * 获取配置
   */
  public getConfig(): SSOConfig {
    return { ...this.config }
  }

  /**
   * 更新配置
   */
  public async updateConfig(newConfig: Partial<SSOConfig>): Promise<void> {
    const oldConfig = { ...this.config }
    this.config = { ...this.config, ...newConfig }

    try {
      // 保存到配置文件
      await this.saveConfigToFile()

      logger.debug('SSO config updated and saved')
      this.emit('configUpdated', this.config)

      // 如果启用状态发生变化，重新检查登录状态
      if (oldConfig.enabled !== this.config.enabled) {
        if (!this.config.enabled) {
          // 如果禁用了SSO，清除当前token
          await this.clearToken()
        }
      }
    } catch (error) {
      // 如果保存失败，回滚配置
      this.config = oldConfig
      logger.error('Failed to update SSO config:', error as Error)
      throw error
    }
  }

  /**
   * 验证当前token是否有效
   */
  public async validateCurrentToken(): Promise<boolean> {
    if (!this.isLoggedIn()) {
      return false
    }

    try {
      const userInfoUrl = `${this.config.loginUrl}/sson/userinfo`
      const response = await fetch(userInfoUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.currentToken!.accessToken}`,
          Accept: 'application/json',
          'User-Agent': 'Cherry-Studio/1.0'
        }
      })

      if (response.ok) {
        logger.debug('Token validation successful')
        return true
      } else {
        logger.warn('Token validation failed, token may be expired')
        // 如果token无效，尝试刷新
        if (this.currentToken?.refreshToken) {
          await this.refreshToken()
          return this.isLoggedIn()
        }
        return false
      }
    } catch (error) {
      logger.error('Token validation error:', error as Error)
      return false
    }
  }

  /**
   * 为MCP请求生成认证头
   */
  public async getMCPAuthHeaders(): Promise<Record<string, string>> {
    // 首先验证token是否有效
    const isValid = await this.validateCurrentToken()
    if (!isValid) {
      logger.warn('No valid SSO token available for MCP request')
      return {}
    }

    const token = this.getAccessToken()
    if (!token) {
      return {}
    }

    return {
      Authorization: `Bearer ${token}`,
      'X-SSO-User': this.currentToken?.userInfo?.login || '',
      'X-SSO-Tenant': String(this.currentToken?.userInfo?.tenantId || 1)
    }
  }

  /**
   * 验证SSO配置是否完整
   */
  public validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!this.config.enabled) {
      return { valid: true, errors: [] } // SSO未启用时不需要验证
    }

    if (!this.config.clientId) {
      errors.push('MEITUAN_SSO_CLIENT_ID 环境变量未设置')
    }

    if (!this.config.secret) {
      errors.push('MEITUAN_SSO_SECRET 环境变量未设置')
    }

    if (!this.config.loginUrl) {
      errors.push('MEITUAN_SSO_LOGIN_URL 环境变量未设置')
    }

    if (this.config.accessEnv && !['test', 'product'].includes(this.config.accessEnv)) {
      errors.push('MEITUAN_SSO_ENV 环境变量值无效，应为 test 或 product')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * 获取配置状态信息（用于调试）
   */
  public getConfigStatus(): Record<string, any> {
    return {
      enabled: this.config.enabled,
      hasClientId: !!this.config.clientId,
      hasSecret: !!this.config.secret,
      accessEnv: this.config.accessEnv,
      loginUrl: this.config.loginUrl,
      configValid: this.validateConfig().valid
    }
  }
}

export default new SSOService()
