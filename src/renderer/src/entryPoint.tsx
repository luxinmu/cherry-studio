import './assets/styles/index.scss'
import '@ant-design/v5-patch-for-react-19'

import axios from 'axios'
import React from 'react'
import { createRoot } from 'react-dom/client'

import App from './App'
import { getEnvironmentConfig } from './utils/environment'

// 获取当前环境配置
const envConfig = getEnvironmentConfig()

// 添加请求拦截器
axios.interceptors.request.use(
  (config) => {
    console.log('发送请求:', config.url)
    return config
  },
  (error) => {
    console.error('请求错误:', error)
    return Promise.reject(error)
  }
)

// 添加响应拦截器
axios.interceptors.response.use(
  (response) => {
    console.log('收到响应:', response.config.url, response.status)

    // SSO 认证服务化状态码处理
    if (response.data?.status === 401000 && response.data?.data?.code === '30010') {
      console.warn('需要SSO认证')
      redirectToSSOLogin()
      return Promise.reject(new Error('需要SSO认证'))
    }

    // 处理未授权情况
    if (response.status === 401 || response.data?.status === 401) {
      console.warn('未授权，重定向到登录页')
      redirectToSSOLogin()
      return Promise.reject(new Error('未授权'))
    }

    return response
  },
  (error) => {
    console.error('响应错误:', error.config?.url, error.message)

    if (error.response?.status === 401) {
      console.warn('请求失败，状态码401')
      redirectToSSOLogin()
    }

    return Promise.reject(error)
  }
)

// 重定向到SSO登录页
function redirectToSSOLogin() {
  const clientId = envConfig.ssoClientId
  const accessEnv = envConfig.ssoAccessEnv
  const redirectUrl = encodeURIComponent(window.location.href)
  const loginUrl = `https://sso.sankuai.com/login?clientId=${clientId}&accessEnv=${accessEnv}&redirectUrl=${redirectUrl}`
  window.location.href = loginUrl
}

// 从URL中获取SSO token
function getSSOTokenFromUrl() {
  const urlParams = new URLSearchParams(window.location.search)
  return urlParams.get('ssoid') || localStorage.getItem('ssoid')
}

// 确保在应用启动前先进行SSO登录
async function initApp() {
  try {
    const ssoid = getSSOTokenFromUrl()

    if (ssoid) {
      // 保存token到localStorage
      localStorage.setItem('ssoid', ssoid)

      // 设置全局请求头
      axios.defaults.headers.common['access-token'] = ssoid
      axios.defaults.headers.common['x-requested-with'] = 'XMLHttpRequest'

      // 渲染应用
      const root = createRoot(document.getElementById('root') as HTMLElement)
      root.render(
        <React.StrictMode>
          <App ssoid={ssoid} environmentConfig={envConfig} />
        </React.StrictMode>
      )
    } else {
      // 没有token，重定向到登录页
      redirectToSSOLogin()
    }
  } catch (error) {
    console.error('SSO登录失败:', error)
    redirectToSSOLogin()
  }
}

// 启动应用
initApp()
