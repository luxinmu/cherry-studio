import { Button, Modal, Form, Input, Select, Switch, Space, Alert, Typography } from 'antd'
import { SettingOutlined, SaveOutlined } from '@ant-design/icons'
import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

const { Title, Paragraph, Text } = Typography
const { Option } = Select

// 样式组件
const ConfigContainer = styled.div`
  padding: 20px;
`

const FormSection = styled.div`
  margin-bottom: 24px;
  padding: 16px;
  background: #fafafa;
  border-radius: 8px;
`

const SectionTitle = styled(Title)`
  margin-bottom: 16px !important;
  color: #1890ff;
`

// SSO配置接口
interface SSOConfig {
  enabled: boolean
  clientId: string
  secret: string
  accessEnv: 'test' | 'product'
  loginUrl: string
}

interface SSOConfigModalProps {
  visible: boolean
  onClose: () => void
  onConfigSaved?: (config: SSOConfig) => void
}

export const SSOConfigModal: React.FC<SSOConfigModalProps> = ({
  visible,
  onClose,
  onConfigSaved
}) => {
  const { t } = useTranslation()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [config, setConfig] = useState<SSOConfig | null>(null)

  // 加载当前配置
  const loadConfig = async () => {
    setLoading(true)
    setError(null)

    try {
      const currentConfig = await window.api.sso.getConfig()
      setConfig(currentConfig)

      // 设置表单值
      form.setFieldsValue({
        enabled: currentConfig.enabled || false,
        clientId: currentConfig.clientId || '',
        secret: currentConfig.secret || '',
        accessEnv: currentConfig.accessEnv || 'product',
        loginUrl: currentConfig.loginUrl || 'https://ssosv.sankuai.com'
      })
    } catch (err) {
      console.error('加载SSO配置失败:', err)
      setError('无法加载SSO配置')
    } finally {
      setLoading(false)
    }
  }

  // 保存配置
  const handleSave = async (values: any) => {
    setSaving(true)
    setError(null)

    try {
      const newConfig: SSOConfig = {
        enabled: values.enabled,
        clientId: values.clientId?.trim() || '',
        secret: values.secret?.trim() || '',
        accessEnv: values.accessEnv,
        loginUrl: values.loginUrl?.trim() || 'https://ssosv.sankuai.com'
      }

      await window.api.sso.updateConfig(newConfig)
      setConfig(newConfig)
      onConfigSaved?.(newConfig)

      window.message.success('SSO配置保存成功')
    } catch (err) {
      console.error('保存SSO配置失败:', err)
      setError(err instanceof Error ? err.message : '保存配置失败')
    } finally {
      setSaving(false)
    }
  }

  // 重置为默认配置
  const handleReset = () => {
    form.setFieldsValue({
      enabled: false,
      clientId: '',
      secret: '',
      accessEnv: 'product',
      loginUrl: 'https://ssosv.sankuai.com'
    })
  }

  // 测试配置
  const handleTest = async () => {
    try {
      const values = await form.validateFields()

      if (!values.enabled) {
        window.message.warning('请先启用SSO功能')
        return
      }

      if (!values.clientId || !values.secret) {
        window.message.warning('请填写完整的客户端配置')
        return
      }

      // 先保存配置，然后验证
      const testConfig = {
        enabled: values.enabled,
        clientId: values.clientId?.trim() || '',
        secret: values.secret?.trim() || '',
        accessEnv: values.accessEnv,
        loginUrl: values.loginUrl?.trim() || 'https://ssosv.sankuai.com'
      }

      await window.api.sso.updateConfig(testConfig)

      // 验证配置
      const validation = await window.api.sso.validateConfig()

      if (validation.valid) {
        window.message.success('配置验证通过')
      } else {
        window.message.error(`配置验证失败: ${validation.errors.join(', ')}`)
      }
    } catch (err) {
      console.error('配置测试失败:', err)
      window.message.error('配置验证失败')
    }
  }

  // 组件挂载时加载配置
  useEffect(() => {
    if (visible) {
      loadConfig()
    }
  }, [visible])

  return (
    <Modal
      title={
        <Space>
          <SettingOutlined />
          美团SSO配置
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={680}
      footer={[
        <Button key="reset" onClick={handleReset}>
          重置
        </Button>,
        <Button key="test" onClick={handleTest}>
          测试配置
        </Button>,
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button
          key="save"
          type="primary"
          icon={<SaveOutlined />}
          loading={saving}
          onClick={() => form.submit()}
        >
          保存配置
        </Button>
      ]}
    >
      <ConfigContainer>
        {error && (
          <Alert
            message="配置错误"
            description={error}
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
            closable
            onClose={() => setError(null)}
          />
        )}

        <Alert
          message="配置说明"
          description={
            <div>
              <Paragraph>
                美团SSO配置用于企业级单点登录认证。配置完成后，可以在使用MCP服务时自动注入认证token。
              </Paragraph>
              <ul>
                <li>Client ID 和 Secret 可从 <a href="https://open.sankuai.com/" target="_blank" rel="noopener noreferrer">美团企业开放平台</a> 获取</li>
                <li>回调地址需要配置为：<Text code>cherrystudio://sso/callback</Text></li>
                <li>配置将保存在本地配置文件中，环境变量优先级更高</li>
              </ul>
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          disabled={loading}
        >
          <FormSection>
            <SectionTitle level={5}>基础设置</SectionTitle>

            <Form.Item
              name="enabled"
              label="启用SSO功能"
              valuePropName="checked"
              extra="启用后可以使用美团SSO进行单点登录"
            >
              <Switch />
            </Form.Item>

            <Form.Item
              name="accessEnv"
              label="访问环境"
              extra="选择要访问的环境，影响SSO服务地址和认证范围"
            >
              <Select>
                <Option value="product">生产环境 (Product)</Option>
                <Option value="test">测试环境 (Test)</Option>
              </Select>
            </Form.Item>
          </FormSection>

          <FormSection>
            <SectionTitle level={5}>客户端配置</SectionTitle>

            <Form.Item
              name="clientId"
              label="Client ID"
              rules={[
                {
                  validator: (_, value) => {
                    const enabled = form.getFieldValue('enabled')
                    if (enabled && !value?.trim()) {
                      return Promise.reject('启用SSO时必须填写Client ID')
                    }
                    return Promise.resolve()
                  }
                }
              ]}
              extra="从美团企业开放平台获取的应用Client ID"
            >
              <Input placeholder="请输入Client ID" />
            </Form.Item>

            <Form.Item
              name="secret"
              label="Client Secret"
              rules={[
                {
                  validator: (_, value) => {
                    const enabled = form.getFieldValue('enabled')
                    if (enabled && !value?.trim()) {
                      return Promise.reject('启用SSO时必须填写Client Secret')
                    }
                    return Promise.resolve()
                  }
                }
              ]}
              extra="从美团企业开放平台获取的应用Client Secret"
            >
              <Input.Password placeholder="请输入Client Secret" />
            </Form.Item>
          </FormSection>

          <FormSection>
            <SectionTitle level={5}>高级设置</SectionTitle>

            <Form.Item
              name="loginUrl"
              label="SSO登录地址"
              rules={[
                { type: 'url', message: '请输入有效的URL地址' }
              ]}
              extra="SSO服务的登录地址，通常不需要修改"
            >
              <Input placeholder="https://ssosv.sankuai.com" />
            </Form.Item>
          </FormSection>
        </Form>

        {config && (
          <Alert
            message="当前配置状态"
            description={
              <Space direction="vertical" size="small">
                <Text>启用状态: {config.enabled ? '已启用' : '未启用'}</Text>
                <Text>访问环境: {config.accessEnv === 'product' ? '生产环境' : '测试环境'}</Text>
                <Text>Client ID: {config.clientId ? `${config.clientId.substring(0, 8)}***` : '未配置'}</Text>
                <Text>Client Secret: {config.secret ? '已配置' : '未配置'}</Text>
              </Space>
            }
            type="success"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
      </ConfigContainer>
    </Modal>
  )
}

export default SSOConfigModal
