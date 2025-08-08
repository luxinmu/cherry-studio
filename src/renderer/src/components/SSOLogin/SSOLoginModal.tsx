import { Button, Modal, Typography, Space, Alert, Spin } from 'antd'
import { LoginOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons'
import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

const { Title, Text, Paragraph } = Typography

// 样式组件
const LoginContainer = styled.div`
  text-align: center;
  padding: 20px;
`

const UserInfoContainer = styled.div`
  padding: 16px;
  background: #f5f5f5;
  border-radius: 8px;
  margin: 16px 0;
`

const UserAvatar = styled.div`
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #1890ff;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
  color: white;
  font-size: 24px;
`

// SSO用户信息接口
interface SSOUserInfo {
  email: string
  login: string
  name: string
  code: string
  tenantId: number
  id: number
}

interface SSOLoginModalProps {
  visible: boolean
  onClose: () => void
  onLoginSuccess?: (userInfo: SSOUserInfo) => void
}

export const SSOLoginModal: React.FC<SSOLoginModalProps> = ({
  visible,
  onClose,
  onLoginSuccess
}) => {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userInfo, setUserInfo] = useState<SSOUserInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ssoEnabled, setSsoEnabled] = useState(false)

  // 检查SSO状态
  const checkSSOStatus = async () => {
    try {
      const enabled = await window.api.sso.isEnabled()
      setSsoEnabled(enabled)

      if (enabled) {
        const loggedIn = await window.api.sso.isLoggedIn()
        setIsLoggedIn(loggedIn)

        if (loggedIn) {
          const user = await window.api.sso.getUserInfo()
          setUserInfo(user)
        }
      }
    } catch (err) {
      console.error('检查SSO状态失败:', err)
      setError('无法检查SSO状态')
    }
  }

  // 处理SSO登录
  const handleLogin = async () => {
    setLoading(true)
    setError(null)

    try {
      // 启动SSO登录流程
      const loginUrl = await window.api.sso.startLogin()

      // 打开外部浏览器进行登录
      await window.api.shell.openExternal(loginUrl)

      // 监听协议回调
      const removeListener = window.api.protocol.onReceiveData(async (data) => {
        try {
          const url = new URL(data.url)
          const code = url.searchParams.get('code')

          if (code) {
            // 处理回调
            const user = await window.api.sso.handleCallback(code)
            setUserInfo(user)
            setIsLoggedIn(true)
            onLoginSuccess?.(user)

            window.message.success('SSO登录成功')
          } else {
            throw new Error('未收到授权码')
          }
        } catch (err) {
          console.error('SSO回调处理失败:', err)
          setError(err instanceof Error ? err.message : '登录失败')
        } finally {
          setLoading(false)
          removeListener()
        }
      })

    } catch (err) {
      console.error('SSO登录失败:', err)
      setError(err instanceof Error ? err.message : '登录失败')
      setLoading(false)
    }
  }

  // 处理SSO登出
  const handleLogout = async () => {
    setLoading(true)
    setError(null)

    try {
      await window.api.sso.logout()
      setIsLoggedIn(false)
      setUserInfo(null)
      window.message.success('SSO登出成功')
    } catch (err) {
      console.error('SSO登出失败:', err)
      setError(err instanceof Error ? err.message : '登出失败')
    } finally {
      setLoading(false)
    }
  }

  // 组件挂载时检查状态
  useEffect(() => {
    if (visible) {
      checkSSOStatus()
    }
  }, [visible])

  // 如果SSO未启用
  if (!ssoEnabled) {
    return (
      <Modal
        title="美团SSO登录"
        open={visible}
        onCancel={onClose}
        footer={[
          <Button key="close" onClick={onClose}>
            关闭
          </Button>
        ]}
      >
        <LoginContainer>
          <Alert
            message="SSO未启用"
            description="美团SSO功能未启用，请联系管理员配置相关环境变量。"
            type="warning"
            showIcon
          />
        </LoginContainer>
      </Modal>
    )
  }

  return (
    <Modal
      title="美团SSO登录"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={480}
    >
      <LoginContainer>
        {error && (
          <Alert
            message="错误"
            description={error}
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
            closable
            onClose={() => setError(null)}
          />
        )}

        {loading && (
          <div style={{ textAlign: 'center', margin: '20px 0' }}>
            <Spin size="large" />
            <Paragraph style={{ marginTop: 16 }}>
              {isLoggedIn ? '正在登出...' : '正在登录...'}
            </Paragraph>
          </div>
        )}

        {!loading && (
          <>
            {isLoggedIn && userInfo ? (
              // 已登录状态
              <div>
                <UserAvatar>
                  <UserOutlined />
                </UserAvatar>

                <Title level={4}>欢迎，{userInfo.name}</Title>

                <UserInfoContainer>
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <div>
                      <Text strong>邮箱：</Text>
                      <Text>{userInfo.email}</Text>
                    </div>
                    <div>
                      <Text strong>用户名：</Text>
                      <Text>{userInfo.login}</Text>
                    </div>
                    <div>
                      <Text strong>员工号：</Text>
                      <Text>{userInfo.code}</Text>
                    </div>
                  </Space>
                </UserInfoContainer>

                <Space>
                  <Button
                    type="primary"
                    danger
                    icon={<LogoutOutlined />}
                    onClick={handleLogout}
                  >
                    登出
                  </Button>
                  <Button onClick={onClose}>
                    关闭
                  </Button>
                </Space>
              </div>
            ) : (
              // 未登录状态
              <div>
                <UserAvatar>
                  <UserOutlined />
                </UserAvatar>

                <Title level={4}>美团SSO登录</Title>

                <Paragraph type="secondary">
                  使用美团SSO账号登录，登录后可以访问需要认证的MCP服务。
                </Paragraph>

                <Space>
                  <Button
                    type="primary"
                    icon={<LoginOutlined />}
                    onClick={handleLogin}
                    size="large"
                  >
                    登录
                  </Button>
                  <Button onClick={onClose}>
                    取消
                  </Button>
                </Space>
              </div>
            )}
          </>
        )}
      </LoginContainer>
    </Modal>
  )
}

export default SSOLoginModal
