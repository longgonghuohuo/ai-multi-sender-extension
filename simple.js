// Simple.js - AI Multi Sender v2.2
// 核心功能：一键打开3个AI新窗口并发送问题

(function() {
  // 等待 DOM 加载完成
  document.addEventListener('DOMContentLoaded', function() {
    console.log('[初始化] DOM 加载完成，开始绑定事件...');

    const questionInput = document.getElementById('questionInput');
    const sendBtn = document.getElementById('sendBtn');
    const clearBtn = document.getElementById('clearBtn');
    const exportBtn = document.getElementById('exportBtn');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    const toast = document.getElementById('toast');
    const historyList = document.getElementById('historyList');

    // 检查元素是否存在
    console.log('[初始化] sendBtn:', sendBtn ? '找到' : '未找到');
    console.log('[初始化] questionInput:', questionInput ? '找到' : '未找到');

    // 显示Toast提示
    function showToast(message, type = 'info') {
      if (!toast) return;
      toast.textContent = message;
      toast.className = `toast ${type}`;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 3000);
    }

    // ==================== 核心功能：发送到所有AI ====================
    async function sendToAll() {
      console.log('[发送] sendToAll 被调用！');

      const question = questionInput.value.trim();
      if (!question) {
        showToast('请先输入问题！', 'error');
        questionInput.focus();
        return;
      }

      sendBtn.disabled = true;
      sendBtn.innerHTML = '<span>⏳</span><span>发送中...</span>';
      showToast('正在打开AI窗口...', 'info');

      try {
        // 检查是否已有打开的AI窗口
        const existingTabs = await checkExistingAITabs();
        console.log('[发送] 已有AI标签页数量:', existingTabs.length);

        if (existingTabs.length > 0) {
          // 已有窗口 → 在已有窗口中追问
          console.log('[发送] 在已有窗口中追问');
          showToast('在已有窗口中追问...', 'info');
          await sendToExistingTabs(question, existingTabs);
        } else {
          // 没有窗口 → 打开3个新窗口
          console.log('[发送] 打开3个新窗口');
          await openThreeNewWindows(question);
        }

        // 保存到历史
        await saveToHistory(question);
        showToast('发送成功！', 'success');

      } catch (error) {
        console.error('[发送] 错误:', error);
        showToast('发送失败: ' + error.message, 'error');
      } finally {
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<span>🚀</span><span>发送到所有AI</span>';
      }
    }

    // 检查已有的AI标签页
    async function checkExistingAITabs() {
      const tabs = await chrome.tabs.query({});
      return tabs.filter(tab => {
        if (!tab.url) return false;
        return tab.url.includes('chatgpt.com') ||
               tab.url.includes('claude.ai') ||
               tab.url.includes('gemini.google.com');
      });
    }

    // 打开3个新窗口
    async function openThreeNewWindows(question) {
      const aiSites = [
        { name: 'ChatGPT', url: 'https://chatgpt.com/' },
        { name: 'Claude', url: 'https://claude.ai/new' },
        { name: 'Gemini', url: 'https://gemini.google.com/app' }
      ];

      const createdTabs = [];

      for (const site of aiSites) {
        try {
          console.log(`[打开] 正在打开 ${site.name}...`);

          // 创建新窗口
          const newWindow = await chrome.windows.create({
            url: site.url,
            type: 'normal',
            focused: false
          });

          console.log(`[打开] ${site.name} 窗口已创建, windowId:`, newWindow.id);

          if (newWindow.tabs && newWindow.tabs[0]) {
            createdTabs.push({
              name: site.name,
              tabId: newWindow.tabs[0].id,
              windowId: newWindow.id
            });
          }
        } catch (err) {
          console.error(`[打开] ${site.name} 失败:`, err);
        }
      }

      // 等待页面加载
      console.log('[等待] 等待页面加载 (5秒)...');
      showToast('等待页面加载...', 'info');
      await new Promise(resolve => setTimeout(resolve, 5000));

      // 填充问题到每个窗口
      for (const tab of createdTabs) {
        await fillQuestionAndSend(tab.tabId, question, tab.name);
      }
    }

    // 在已有标签页中追问
    async function sendToExistingTabs(question, tabs) {
      for (const tab of tabs) {
        const siteName = getSiteName(tab.url);
        await fillQuestionAndSend(tab.id, question, siteName);
      }
    }

    // 填充问题并发送
    async function fillQuestionAndSend(tabId, question, siteName) {
      try {
        console.log(`[填充] ${siteName}, tabId: ${tabId}`);

        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: (text) => {
            console.log('[页面脚本] 开始填充问题:', text.substring(0, 50) + '...');

            // 所有可能的输入框选择器
            const inputSelectors = [
              // ChatGPT
              '#prompt-textarea',
              'textarea[placeholder*="Message"]',
              'textarea[data-id="root"]',
              // Claude
              'div[contenteditable="true"].ProseMirror',
              'div[contenteditable="true"][data-placeholder]',
              // Gemini
              '.ql-editor[contenteditable="true"]',
              'div[contenteditable="true"][role="textbox"]',
              'rich-textarea div[contenteditable="true"]'
            ];

            // 所有可能的发送按钮选择器
            const sendSelectors = [
              // ChatGPT
              'button[data-testid="send-button"]',
              'button[aria-label="Send prompt"]',
              // Claude
              'button[aria-label="Send Message"]',
              'button[aria-label="发送消息"]',
              // Gemini
              'button[aria-label="Send message"]',
              'button.send-button',
              'button[mattooltip="Send message"]'
            ];

            // 查找输入框
            let inputElement = null;
            for (const selector of inputSelectors) {
              const el = document.querySelector(selector);
              if (el) {
                inputElement = el;
                console.log('[页面脚本] 找到输入框:', selector);
                break;
              }
            }

            if (!inputElement) {
              console.error('[页面脚本] 未找到输入框！');
              return { success: false, error: '未找到输入框' };
            }

            // 填充内容
            inputElement.focus();

            if (inputElement.tagName === 'TEXTAREA') {
              // Textarea 类型 (ChatGPT)
              const setter = Object.getOwnPropertyDescriptor(
                window.HTMLTextAreaElement.prototype, 'value'
              )?.set;
              if (setter) {
                setter.call(inputElement, text);
              } else {
                inputElement.value = text;
              }
              inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            } else {
              // ContentEditable 类型 (Claude, Gemini)
              inputElement.innerHTML = '';
              const p = document.createElement('p');
              p.textContent = text;
              inputElement.appendChild(p);
              inputElement.dispatchEvent(new Event('input', { bubbles: true }));
              inputElement.dispatchEvent(new InputEvent('input', {
                bubbles: true,
                inputType: 'insertText',
                data: text
              }));
            }

            console.log('[页面脚本] 内容已填充，等待点击发送...');

            // 等待一下再点击发送
            setTimeout(() => {
              for (const selector of sendSelectors) {
                const btn = document.querySelector(selector);
                if (btn && !btn.disabled) {
                  console.log('[页面脚本] 找到发送按钮:', selector);
                  btn.click();
                  console.log('[页面脚本] 已点击发送按钮');
                  return;
                }
              }
              console.warn('[页面脚本] 未找到可用的发送按钮');
            }, 800);

            return { success: true };
          },
          args: [question]
        });

        console.log(`[填充] ${siteName} 完成`);
      } catch (err) {
        console.error(`[填充] ${siteName} 失败:`, err);
      }
    }

    // 获取网站名称
    function getSiteName(url) {
      if (url.includes('chatgpt.com')) return 'ChatGPT';
      if (url.includes('claude.ai')) return 'Claude';
      if (url.includes('gemini.google.com')) return 'Gemini';
      return 'Unknown';
    }

    // ==================== 其他功能 ====================

    // 清空输入
    function clearInput() {
      questionInput.value = '';
      questionInput.focus();
      showToast('已清空', 'info');
    }

    // 保存到历史
    async function saveToHistory(question) {
      try {
        const result = await chrome.storage.local.get('history');
        const history = result.history || [];

        history.unshift({
          id: Date.now(),
          question: question,
          timestamp: new Date().toLocaleString('zh-CN')
        });

        if (history.length > 100) history.splice(100);
        await chrome.storage.local.set({ history });
        loadHistory();
      } catch (e) {
        console.error('[历史] 保存失败:', e);
      }
    }

    // 加载历史记录
    async function loadHistory() {
      try {
        const result = await chrome.storage.local.get('history');
        const history = result.history || [];

        if (!historyList) return;

        if (history.length === 0) {
          historyList.innerHTML = '<div class="history-empty">暂无历史记录</div>';
          return;
        }

        historyList.innerHTML = history.map(item => `
          <div class="history-item" data-question="${escapeHtml(item.question)}">
            <div class="history-timestamp">${item.timestamp}</div>
            <div class="history-question">${escapeHtml(item.question)}</div>
          </div>
        `).join('');

        // 为历史记录项添加点击事件
        historyList.querySelectorAll('.history-item').forEach(item => {
          item.addEventListener('click', function() {
            questionInput.value = this.dataset.question;
            questionInput.focus();
            showToast('已填充', 'info');
          });
        });
      } catch (e) {
        console.error('[历史] 加载失败:', e);
      }
    }

    // 导出历史
    async function exportHistory() {
      const result = await chrome.storage.local.get('history');
      const history = result.history || [];

      if (history.length === 0) {
        showToast('没有历史记录', 'error');
        return;
      }

      const content = history.map((item, i) =>
        `${i + 1}. [${item.timestamp}]\n${item.question}\n`
      ).join('\n---\n\n');

      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AI提问历史_${new Date().toISOString().split('T')[0]}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('已导出', 'success');
    }

    // 清空历史
    async function clearHistory() {
      if (!confirm('确定清空所有历史记录？')) return;
      await chrome.storage.local.set({ history: [] });
      loadHistory();
      showToast('已清空', 'info');
    }

    // HTML转义
    function escapeHtml(str) {
      return str.replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
    }

    // ==================== 绑定事件 ====================

    // 发送按钮
    if (sendBtn) {
      sendBtn.addEventListener('click', function() {
        console.log('[事件] 发送按钮被点击');
        sendToAll();
      });
      console.log('[初始化] 发送按钮事件已绑定');
    }

    // 清空按钮
    if (clearBtn) {
      clearBtn.addEventListener('click', clearInput);
    }

    // 导出按钮
    if (exportBtn) {
      exportBtn.addEventListener('click', exportHistory);
    }

    // 清空历史按钮
    if (clearHistoryBtn) {
      clearHistoryBtn.addEventListener('click', clearHistory);
    }

    // 快捷键 Ctrl+Enter
    if (questionInput) {
      questionInput.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          console.log('[事件] Ctrl+Enter 快捷键触发');
          sendToAll();
        }
      });
    }

    // 自动保存输入
    if (questionInput) {
      questionInput.addEventListener('input', function() {
        chrome.storage.local.set({ lastQuestion: questionInput.value });
      });

      // 恢复上次输入
      chrome.storage.local.get(['lastQuestion'], function(result) {
        if (result.lastQuestion) {
          questionInput.value = result.lastQuestion;
        }
      });
    }

    // 加载历史记录
    loadHistory();

    console.log('[初始化] AI Multi Sender v2.2 已就绪！');
    showToast('AI Multi Sender v2.2 已就绪！', 'info');
  });
})();
