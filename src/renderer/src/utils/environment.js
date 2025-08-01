// 环境配置
const environments = {
  production: {
    name: '生产环境',
    apiBaseUrl: 'https://fin.it.st.sankuai.com',
    ssoClientId: 'bc576f319c',
    ssoAccessEnv: 'product'
  },
  test: {
    name: '测试环境',
    apiBaseUrl: 'https://1941-ajtqk-sl-fin.it.test.sankuai.com',
    ssoClientId: '740e989c62',
    ssoAccessEnv: 'test'
  }
}

// 获取当前环境
export const getCurrentEnvironment = () => {
  // 从localStorage获取环境设置，如果没有则根据URL判断
  const savedEnv = localStorage.getItem('current-environment')

  if (savedEnv && environments[savedEnv]) {
    return savedEnv
  }

  // 根据当前URL判断环境
  const currentUrl = window.location.href
  if (currentUrl.includes('fin.it.st.sankuai.com')) {
    return 'production'
  }

  // 默认为测试环境
  return 'test'
}

// 设置当前环境
export const setCurrentEnvironment = (env) => {
  if (environments[env]) {
    localStorage.setItem('current-environment', env)
    return true
  }
  return false
}

// 获取环境配置
export const getEnvironmentConfig = () => {
  const currentEnv = getCurrentEnvironment()
  return environments[currentEnv]
}

// 获取所有可用环境
export const getAllEnvironments = () => {
  return Object.keys(environments).map((key) => ({
    id: key,
    ...environments[key]
  }))
}
