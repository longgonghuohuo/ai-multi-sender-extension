# 测试指南 - AI Multi Sender

## 🎯 最新版本特性

### ✅ 已修复的问题
1. **检测超时问题** - 添加了 500ms 超时机制
2. **Content Script 优化** - 重构了所有三个 AI 的注入脚本
3. **错误处理增强** - 添加了详细的日志和错误提示
4. **输入框查找** - 改进了选择器，支持更多页面状态

### 🆕 代码改进
- 统一的 `findInput()` 函数
- 统一的 `fillInput()` 函数
- 更好的可见性检测（检查元素尺寸）
- 添加了 `[AI名称]` 前缀的日志，便于调试

## 📋 测试前准备

### 第一步：刷新插件

```bash
1. 打开 chrome://extensions/
2. 找到 AI Multi Sender
3. 点击刷新图标 🔄
4. 确保没有错误提示
```

### 第二步：打开 AI 网页

**必须按照以下要求操作：**

| AI 平台 | URL | 要求 |
|---------|-----|------|
| ChatGPT | https://chatgpt.com | 已登录 + 新对话页面 |
| Claude | https://claude.ai | 已登录 + 对话页面 |
| Gemini | https://gemini.google.com | 已登录 + 主页 |

**重要提示：**
- ✅ 必须是**新对话**页面，不能是历史记录
- ✅ 必须看到**输入框**
- ✅ 页面必须**完全加载**完成

## 🧪 测试步骤

### 测试 1：检查 Content Script 是否加载

#### ChatGPT

```javascript
// 打开 https://chatgpt.com
// 按 F12 打开控制台
// 应该看到:
AI Multi Sender: ChatGPT content script loaded

// 如果没有看到，刷新页面
```

#### Claude

```javascript
// 打开 https://claude.ai
// 按 F12 打开控制台
// 应该看到:
AI Multi Sender: Claude content script loaded

// 如果没有看到，刷新页面
```

#### Gemini

```javascript
// 打开 https://gemini.google.com
// 按 F12 打开控制台
// 应该看到:
AI Multi Sender: Gemini content script loaded

// 如果没有看到，刷新页面
```

### 测试 2：检查输入框检测

在各个 AI 网页的控制台输入：

```javascript
// 手动测试输入框检测
chrome.runtime.sendMessage(
  { action: 'checkAvailability' },
  response => console.log('检测结果:', response)
);

// 期望输出:
// ChatGPT: { available: true, site: 'ChatGPT' }
// Claude: { available: true, site: 'Claude' }
// Gemini: { available: true, site: 'Gemini' }
```

### 测试 3：检查插件弹窗

```bash
1. 点击浏览器工具栏的插件图标
2. 应该看到全页面界面（不是小弹窗）
3. 等待 1-2 秒
4. 检查右侧的 AI 状态卡片

期望结果:
- ChatGPT 卡片变成绿色，显示"1 个标签页已就绪"
- Claude 卡片变成绿色，显示"1 个标签页已就绪"
- Gemini 卡片变成绿色，显示"1 个标签页已就绪"
- 底部的"发送到所有 AI"按钮可点击（不是灰色）
```

### 测试 4：测试发送功能

```bash
1. 在插件的输入框中输入测试问题:
   "你好，请简单介绍一下自己"

2. 点击"🚀 发送到所有 AI"按钮

3. 应该看到:
   - 按钮变成"正在发送..."
   - 出现加载动画（旋转圈）
   - 1-2 秒后显示成功消息
   - 例如: "✅ 成功发送到 3 个页面：ChatGPT、Claude、Gemini"

4. 切换到各个 AI 标签页

5. 检查问题是否已填充:
   - ChatGPT: 输入框应该有"你好，请简单介绍一下自己"
   - Claude: 输入框应该有"你好，请简单介绍一下自己"
   - Gemini: 输入框应该有"你好，请简单介绍一下自己"
```

## 🐛 常见问题排查

### 问题 1：插件图标点击后没反应

**排查步骤：**
1. 检查 manifest.json 是否正确
2. 刷新插件
3. 重启浏览器

### 问题 2：状态显示"未检测到，请打开网页"

**原因：**
- Content script 未加载
- 不在对话页面
- 输入框未加载

**解决方案：**
```bash
1. 打开 AI 网页的 F12 控制台
2. 查看是否有 "content script loaded" 消息
3. 如果没有，刷新网页
4. 确保在正确的页面（对话页面）
5. 等待页面完全加载
```

### 问题 3：发送失败

**检查清单：**
- [ ] Content script 已加载（查看控制台）
- [ ] 在对话页面（不是设置或历史页）
- [ ] 输入框可见（手动点击能输入）
- [ ] 没有其他扩展冲突

**详细排查：**

在 AI 网页的控制台输入：

```javascript
// 手动测试发送
chrome.runtime.sendMessage(
  {
    action: 'sendQuestion',
    question: '测试问题'
  },
  response => console.log('发送结果:', response)
);

// 期望输出:
// { success: true, site: 'ChatGPT' }
// 或
// { success: false, error: '具体错误信息' }
```

### 问题 4：找不到输入框

**ChatGPT 的输入框选择器：**
```javascript
// 在 ChatGPT 页面的控制台测试
document.querySelector('#prompt-textarea')
document.querySelector('textarea[placeholder*="Message"]')
```

**Claude 的输入框选择器：**
```javascript
// 在 Claude 页面的控制台测试
document.querySelector('div[contenteditable="true"].ProseMirror')
document.querySelector('.ProseMirror[contenteditable="true"]')
```

**Gemini 的输入框选择器：**
```javascript
// 在 Gemini 页面的控制台测试
document.querySelector('.ql-editor[contenteditable="true"]')
document.querySelector('div[contenteditable="true"][role="textbox"]')
```

如果以上都返回 `null`，说明页面结构已更新，需要更新选择器。

## ✅ 测试检查清单

完整测试前，请确保：

- [ ] 已刷新插件
- [ ] 三个 AI 网页都已打开并登录
- [ ] 在对话页面（不是设置或历史页）
- [ ] 每个页面的控制台都显示 "content script loaded"
- [ ] 插件弹窗显示三个绿色状态卡片
- [ ] 能够成功发送测试问题
- [ ] 问题已填充到三个网页的输入框

## 📊 性能指标

| 操作 | 期望时间 | 说明 |
|------|---------|------|
| Content script 加载 | <1秒 | 页面加载时自动注入 |
| 检测 AI 状态 | <500ms | 每个标签页 |
| 发送问题 | 1-2秒 | 包含所有三个 AI |
| 插件弹窗打开 | <200ms | 即时显示 |

## 🔍 调试技巧

### 1. 查看详细日志

在插件弹窗上**右键 > 检查**，打开弹窗的控制台：

```javascript
// 查看检测日志
// 应该看到类似:
ChatGPT tab error: ... 或成功消息
Claude tab error: ... 或成功消息
Gemini tab error: ... 或成功消息
```

### 2. 手动注入测试

如果 content script 没有自动加载，可以手动注入测试：

```javascript
// 在 AI 网页的控制台
// 复制对应的 content-xxx.js 的内容并执行
```

### 3. 检查权限

```bash
打开 chrome://extensions/
点击 AI Multi Sender 的"详细信息"
检查"网站访问权限":
- 应该包含 chat.openai.com
- 应该包含 chatgpt.com
- 应该包含 claude.ai
- 应该包含 gemini.google.com
```

## 🎉 测试成功标准

如果满足以下所有条件，说明插件工作正常：

1. ✅ 三个 AI 网页的控制台都显示 "content script loaded"
2. ✅ 插件弹窗显示三个绿色状态卡片
3. ✅ 能够成功发送问题
4. ✅ 问题自动填充到三个 AI 的输入框
5. ✅ 没有报错信息
6. ✅ 响应时间在预期范围内

## 📝 报告问题

如果发现 bug，请提供以下信息：

1. **浏览器信息**
   - Chrome 版本
   - 操作系统

2. **错误信息**
   - 控制台错误截图
   - 插件弹窗的控制台日志

3. **复现步骤**
   - 详细的操作步骤
   - 当前页面的 URL
   - 是否在对话页面

4. **环境信息**
   - 是否已登录各个 AI
   - 是否有其他扩展冲突
   - 网络环境（公司/家庭）

---

祝测试顺利！ 🚀
