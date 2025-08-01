import { getEnvironmentConfig } from './environment'

// 获取当前环境配置
const envConfig = getEnvironmentConfig()

// SSO配置
export const ssoConfig = {
  clientId: envConfig.ssoClientId,
  accessEnv: envConfig.ssoAccessEnv,
  rewriteLocation: '/',
  callbackUrl: '#/sso/callback',
  logoutUri: '#/sso/logout',
  isDebug: true,
  loginSchema: 'https',
  sameSite: false
}

// SSO工具对象
export const ssoWeb = {
  // 获取登录URL
  getLoginUrl: () => {
    const redirectUrl = encodeURIComponent(window.location.href)
    return `https://sso.sankuai.com/login?clientId=${ssoConfig.clientId}&accessEnv=${ssoConfig.accessEnv}&redirectUrl=${redirectUrl}`
  },

  // 登录方法
  login: async () => {
    // 从URL或localStorage获取ssoid
    const urlParams = new URLSearchParams(window.location.search)
    const ssoid = urlParams.get('ssoid') || localStorage.getItem('ssoid')

    if (ssoid) {
      localStorage.setItem('ssoid', ssoid)
      return ssoid
    }

    // 如果没有ssoid，返回null
    return null
  }
}

// SSO请求认证对象
export const ssoReqAuth = {
  // 验证是否已登录
  isAuthenticated: () => {
    const ssoid = localStorage.getItem('ssoid')
    return !!ssoid
  }
}
