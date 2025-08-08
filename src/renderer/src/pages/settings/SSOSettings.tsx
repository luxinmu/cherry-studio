import { Button, Card, Space, Typography, Tag, Divider, Alert } from 'antd'
import {
  SettingOutlined,
  LoginOutlined,
  LogoutOutlined,
  UserOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons'
import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'
import SSOLoginModal from '@renderer/components/SSOLogin/SSOLoginModal'
import SSOConfigModal from '@renderer/components/SSOLogin/SSOConfigModal'

const { Title, Text, Paragraph } = Typography

// 样式组件
const SettingsContainer = styled.div`
  padding: 24px;
  max-width: 800px;
`

const StatusCard = styled(Card)`
  margin-bottom: 24px;

  .ant-card-body {
    padding: 24px;
  }
`

const UserInfoSection = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 16px 0;
`

const UserAvatar = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #1890ff;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 20px;
`

const ActionSection = styled.div`
  margin-top: 24px;
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

interface SSOConfig {
  enabled: boolean
  clientId: string
  secret: string
  accessEnv: 'test' | 'product'
  loginUrl: string
}

const SSOSettings: React.FC = () => {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [ssoEnabled, setSsoEnabled] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userInfo, setUserInfo] = useState<SSOUserInfo | null>(null)
  const [config, setConfig] = useState<SSOConfig | null>(null)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showConfigModal, setShowConfigModal] = useState(false)

  // 检查SSO状态
  const checkSSOStatus = async () => {
    setLoading(true)

    try {
      // 获取配置
      const currentConfig = await window.api.sso.getConfig()
      setConfig(currentConfig)
      setSsoEnabled(currentConfig.enabled)

      if (currentConfig.enabled) {
        // 检查登录状态
        const loggedIn = await window.api.sso.isLoggedIn()
        setIsLoggedIn(loggedIn)

        if (loggedIn) {
          // 获取用户信息
          const user = await window.api.sso.getUserInfo()
          setUserInfo(user)
        }
      }
    } catch (error) {
      console.error('检查SSO状态失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 处理登录成功
  const handleLoginSuccess = (user: SSOUserInfo) => {
    setUserInfo(user)
    setIsLoggedIn(true)
    setShowLoginModal(false)
  }

  // 处理配置保存
  const handleConfigSaved = (newConfig: SSOConfig) => {
    setConfig(newConfig)
    setSsoEnabled(newConfig.enabled)
    setShowConfigModal(false)

    // 如果禁用了SSO，清除登录状态
    if (!newConfig.enabled) {
      setIsLoggedIn(false)
      setUserInfo(null)
    }
  }

  // 处理登出
  const handleLogout = async () => {
    try {
      await window.api.sso.logout()
      setIsLoggedIn(false)
      setUserInfo(null)
      window.message.success('SSO登出成功')
    } catch (error) {
      console.error('SSO登出失败:', error)
      window.message.error('登出失败')
    }
  }

  // 组件挂载时检查状态
  useEffect(() => {
    checkSSOStatus()
  }, [])

  // 渲染状态标签
  const renderStatusTag = () => {
    if (!ssoEnabled) {
      return <Tag color="default">未启用</Tag>
    }

    if (isLoggedIn) {
      return (
        <Tag color="success" icon={<CheckCircleOutlined />}>
          已登录
        </Tag>
      )
    }

    return (
      <Tag color="warning" icon={<ExclamationCircleOutlined />}>
        未登录
      </Tag>
    )
  }

  // 渲染配置状态
  const renderConfigStatus = () => {
    if (!config) return null

    const hasClientId = !!config.clientId
    const hasSecret = !!config.secret

    return (
      <Space direction="vertical" size="small">
        <div>
          <Text strong>访问环境: </Text>
          <Tag color={config.accessEnv === 'product' ? 'blue' : 'orange'}>
            {config.accessEnv === 'product' ? '生产环境' : '测试环境'}
          </Tag>
        </div>
        <div>
          <Text strong>Client ID: </Text>
          {hasClientId ? <Tag color="success">已配置</Tag> : <Tag color="error">未配置</Tag>}
        </div>
        <div>
          <Text strong>Client Secret: </Text>
          {hasSecret ? <Tag color="success">已配置</Tag> : <Tag color="error">未配置</Tag>}
        </div>
      </Space>
    )
  }

  return (
    <SettingsContainer>
      <Title level={3}>美团SSO设置</Title>

      <Paragraph type="secondary">配置美团SSO单点登录，登录后可以访问需要认证的MCP服务。</Paragraph>

      {/* 状态卡片 */}
      <StatusCard
        title={
          <Space>
            <UserOutlined />
            SSO状态
            {renderStatusTag()}
          </Space>
        }
        loading={loading}>
        {!ssoEnabled ? (
          <Alert message="SSO功能未启用" description="请先配置并启用SSO功能，然后进行登录。" type="info" showIcon />
        ) : isLoggedIn && userInfo ? (
          // 已登录状态
          <div>
            <UserInfoSection>
              <UserAvatar>
                <UserOutlined />
              </UserAvatar>
              <div>
                <Title level={5} style={{ margin: 0 }}>
                  {userInfo.name}
                </Title>
                <Text type="secondary">{userInfo.email}</Text>
              </div>
            </UserInfoSection>

            <Space direction="vertical" size="small">
              <div>
                <Text strong>用户名: </Text>
                <Text>{userInfo.login}</Text>
              </div>
              <div>
                <Text strong>员工号: </Text>
                <Text>{userInfo.code}</Text>
              </div>
              <div>
                <Text strong>租户ID: </Text>
                <Text>{userInfo.tenantId}</Text>
              </div>
            </Space>
          </div>
        ) : (
          // 未登录状态
          <Alert message="尚未登录" description="请使用美团SSO账号登录以访问需要认证的服务。" type="warning" showIcon />
        )}
      </StatusCard>

      {/* 配置信息卡片 */}
      {ssoEnabled && (
        <StatusCard
          title={
            <Space>
              <SettingOutlined />
              配置信息
            </Space>
          }>
          {renderConfigStatus()}
        </StatusCard>
      )}

      <Divider />

      {/* 操作按钮 */}
      <ActionSection>
        <Space size="middle">
          <Button type="primary" icon={<SettingOutlined />} onClick={() => setShowConfigModal(true)}>
            配置SSO
          </Button>

          {ssoEnabled && (
            <>
              {isLoggedIn ? (
                <Button danger icon={<LogoutOutlined />} onClick={handleLogout}>
                  登出
                </Button>
              ) : (
                <Button
                  type="primary"
                  icon={<LoginOutlined />}
                  onClick={() => setShowLoginModal(true)}
                  disabled={!config?.clientId || !config?.secret}>
                  登录
                </Button>
              )}
            </>
          )}

          <Button onClick={checkSSOStatus}>刷新状态</Button>
        </Space>
      </ActionSection>

      {/* 使用说明 */}
      <Card title="使用说明" style={{ marginTop: 24 }}>
        <Space direction="vertical" size="middle">
          <div>
            <Title level={5}>1. 配置SSO</Title>
            <Paragraph>
              点击"配置SSO"按钮，填入从
              <a href="https://open.sankuai.com/" target="_blank" rel="noopener noreferrer">
                美团企业开放平台
              </a>
              获取的Client ID和Secret。
            </Paragraph>
          </div>

          <div>
            <Title level={5}>2. 登录认证</Title>
            <Paragraph>配置完成后，点击"登录"按钮进行SSO认证。系统会打开浏览器跳转到SSO登录页面。</Paragraph>
          </div>

          <div>
            <Title level={5}>3. 使用MCP服务</Title>
            <Paragraph>登录成功后，系统会自动为所有MCP请求添加认证头，您可以无缝访问需要认证的美团MCP服务。</Paragraph>
          </div>
        </Space>
      </Card>

      {/* 模态框 */}
      <SSOLoginModal
        visible={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      <SSOConfigModal
        visible={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        onConfigSaved={handleConfigSaved}
      />
    </SettingsContainer>
  )
}

export default SSOSettings
