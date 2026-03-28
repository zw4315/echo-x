# Echo-X

X (Twitter) 语言学习助手浏览器扩展，帮助你在浏览 X 时学习外语。

## 功能

- 📝 自动提取 X 帖子内容
- 🤖 AI 智能分析：翻译、分词、语法讲解、重点词汇
- 💭 回复助手：帮你润色英文回复

## 快速开始

### 1. 配置 API Key

```bash
# 编辑配置文件
vim config.json

# 填入你的 Kimi API Key
{
  "api_key": "sk-kimi-xxxxxxxxxxxxxxxx",
  "gateway_host": "127.0.0.1",
  "gateway_port": 9742
}
```

### 2. 启动本地网关

```bash
./setup.sh
```

此命令会自动：
- 安装 uv（如未安装）
- 创建 Python 虚拟环境
- 安装依赖
- 启动网关服务

**保持此终端运行**，扩展才能正常使用。

### 3. 安装浏览器扩展

1. 打开 Chrome/Edge 扩展管理页 (`chrome://extensions` 或 `edge://extensions`)
2. 开启"开发人员模式"
3. 点击"加载解压缩的扩展"，选择 `dist` 文件夹

### 4. 使用

1. 打开任意 X 帖子页面（URL 包含 `/status/`）
2. 点击浏览器工具栏的 Echo-X 图标打开侧边栏
3. 点击"🔄 刷新"按钮提取帖子内容
4. AI 会自动分析内容（如果网关已连接）

## 设置

- 点击设置按钮 (⚙️) 或按 `Alt + S` 打开设置面板
- 显示本地网关连接状态
- 可选择不同的 AI 模型

## 文件说明

| 文件 | 说明 |
|------|------|
| `setup.sh` | 一键启动本地网关 |
| `gateway.py` | 网关服务主程序 |
| `config.json` | API Key 配置（已 gitignore） |
| `config.json.example` | 配置模板 |

## 技术栈

- TypeScript + Chrome Extension Manifest V3
- Python + uv + openai SDK
- Kimi AI (Moonshot)

## 许可证

MIT
