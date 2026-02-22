# AI Multi Sender

一个 Chrome 扩展：一键把同一个问题发到你勾选的平台。

## 支持平台

- ChatGPT (`chat.openai.com`, `chatgpt.com`)
- Claude (`claude.ai`)
- Gemini (`gemini.google.com`)
- Grok (`grok.com`)

你可以任选一个、两个或多个平台，不强制必须三个都用。

## 核心特点

- 一次输入，多平台发送
- 可选择发送模式：继续聊天 / 开启新会话 / 自动判断
- 支持一键打开选中平台
- 历史问题本地保存，可导出
- 数据仅保存在浏览器本地
- 不需要填写任何 API Key

## 安装

1. 打开 Chrome，进入 `chrome://extensions/`
2. 打开右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择本项目目录 `ai-multi-sender-extension`

## 使用

1. 先登录你要用的平台账号（可只登录其中一部分）
2. 打开扩展，勾选要发送的平台
3. 输入问题，点击发送

## 快捷键

- `Ctrl + Enter`：发送（Mac 用 `Cmd + Enter`）

## 隐私与安全

- 项目不内置 API 密钥
- 项目不上传你的提问内容到第三方服务器
- 如果你要公开 fork，请不要提交你本地的私密配置文件（如 `.env`）

## License

MIT
