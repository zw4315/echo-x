# Kimi (Moonshot) API 配置指南

## 什么是 Kimi?

Kimi 是月之暗面 (Moonshot AI) 开发的大语言模型，特点：
- ✅ 国内可用，无需翻墙
- ✅ 支持长文本 (128k 上下文)
- ✅ 价格优惠，新用户有免费额度
- ✅ OpenAI API 兼容格式

## 快速开始

### 1. 获取 API Key

1. 访问 https://platform.moonshot.cn/
2. 用手机号或邮箱注册账号
3. 进入「API Key 管理」
4. 点击「创建 API Key」
5. 复制生成的密钥 (格式: `sk-xxxxxxxx`)

### 2. 在 Echo-X 中配置

1. 点击 Echo-X 图标打开侧边栏
2. 点击 ⚙️ 设置按钮
3. **API 提供商** 选择: `Kimi (Moonshot)`
4. **API Key** 填入: `sk-xxxxxxxx` (从上面复制的)
5. **AI 模型** 选择:
   - `moonshot-v1-8k` - 便宜够用
   - `moonshot-v1-32k` - 长文本
   - `moonshot-v1-128k` - 超长文本
6. 点击「保存设置」

### 3. 测试

打开一个 X 帖子，等待 AI 分析，如果能正常显示翻译和分析，说明配置成功！

## 费用说明

| 模型 | 输入 (每百万 tokens) | 输出 (每百万 tokens) |
|------|---------------------|---------------------|
| moonshot-v1-8k | ¥12 | ¥12 |
| moonshot-v1-32k | ¥24 | ¥24 |
| moonshot-v1-128k | ¥60 | ¥60 |

**新用户福利**: 注册送 15 元代金券

**实际使用估算**:
- 分析一条帖子: 约 1000-2000 tokens
- 成本: 约 ¥0.01-0.03 (1-3 分钱)
- 免费额度可用: 约 500-1000 次分析

## 与 OpenAI 对比

| 特性 | OpenAI | Kimi |
|------|--------|------|
| 国内访问 | 需要翻墙 | ✅ 直接访问 |
| API 速度 | 快 | 快 |
| 中文能力 | 好 | ✅ 更好 |
| 价格 | $0.15/M | ¥12/M (约 $1.7/M) |
| 长文本 | 128k | ✅ 128k-200k |

## 故障排除

### API Key 无效
```
Error: 401 Unauthorized
```
- 检查 API Key 是否复制完整
- 确认 Key 没有被禁用
- 在 Kimi 控制台查看 Key 状态

### 模型不存在
```
Error: model not found
```
- 确保选择了正确的模型名称
- 尝试切换为 `moonshot-v1-8k`

### 网络错误
```
Error: Failed to fetch
```
- 检查网络连接
- 确认浏览器可以访问 https://api.moonshot.cn/
- 尝试刷新页面

## 切换回 OpenAI

如果想切回 OpenAI:
1. 设置面板中 **API 提供商** 选择 `OpenAI`
2. **API Key** 填入 OpenAI 的 key (格式: `sk-...`)
3. **AI 模型** 选择 `gpt-4o-mini`

两个提供商的设置是独立的，可以随时切换。

## 高级: 自定义后端

如果你有自建的后端服务，可以在设置中配置 **API Base URL**:
- 留空: 使用官方 API
- 自定义: 如 `https://your-api.com/v1`

这适用于:
- 企业内部代理
- API 聚合服务
- 本地模型部署
