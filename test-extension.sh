#!/bin/bash

echo "=================================="
echo "🧪 AI Multi Sender 自动测试脚本"
echo "=================================="
echo ""

# 检查扩展目录
if [ ! -f "manifest.json" ]; then
  echo "❌ 错误: 请在扩展目录中运行此脚本"
  exit 1
fi

echo "✅ 扩展目录检查通过"
echo ""

# 检查关键文件
echo "📁 检查关键文件..."
files=("simple.html" "simple.js" "background.js" "manifest.json" "content-chatgpt.js" "content-claude.js" "content-gemini.js")

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✅ $file"
  else
    echo "  ❌ $file 缺失"
  fi
done

echo ""
echo "🔍 检查代码修改..."

# 检查 sendToAll 是否包含自动打开逻辑
if grep -q "自动打开" simple.js; then
  echo "  ✅ sendToAll 函数已包含自动打开逻辑"
else
  echo "  ❌ sendToAll 函数缺少自动打开逻辑"
fi

# 检查按钮数量
button_count=$(grep -c "class=\"btn" simple.html)
echo "  ℹ️  按钮数量: $button_count 个"

echo ""
echo "=================================="
echo "📋 测试说明"
echo "=================================="
echo ""
echo "请手动完成以下测试:"
echo ""
echo "【测试1: 无标签页时自动打开】"
echo "1. 关闭所有 ChatGPT/Claude/Gemini 标签页"
echo "2. 点击扩展图标"
echo "3. 输入问题: '测试自动打开功能'"
echo "4. 点击 '🚀 发送到所有AI' 按钮"
echo "5. 预期: 自动打开3个标签页并填充问题"
echo ""
echo "【测试2: 已有标签页时直接发送】"
echo "1. 保持测试1打开的标签页"
echo "2. 输入新问题: '测试直接发送功能'"
echo "3. 点击 '🚀 发送到所有AI' 按钮"
echo "4. 预期: 直接向已打开的标签页发送"
echo ""
echo "【测试3: 并排窗口模式】"
echo "1. 关闭所有AI标签页"
echo "2. 输入问题: '测试并排窗口'"
echo "3. 点击 '🪟 并排窗口模式' 按钮"
echo "4. 预期: 3个窗口并排打开"
echo ""
echo "=================================="
echo "🎯 完成!"
echo "=================================="
