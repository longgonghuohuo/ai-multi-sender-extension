// Sidepanel Script
(function() {
  const questionInput = document.getElementById('questionInput');
  const sendBtn = document.getElementById('sendBtn');
  const toast = document.getElementById('toast');

  const chatgptCard = document.getElementById('chatgptCard');
  const claudeCard = document.getElementById('claudeCard');
  const geminiCard = document.getElementById('geminiCard');

  // 显示Toast
  function showToast(message, type = 'info') {
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  }

  // 更新AI卡片状态
  function updateCardStatus(card, available, count = 0) {
    const dot = card.querySelector('.status-dot');
    const info = card.querySelector('.ai-info');

    if (available) {
      card.className = 'ai-card active';
      dot.className = 'status-dot active';
      info.className = 'ai-info success';
      info.textContent = `${count} 个标签页已就绪`;
    } else {
      card.className = 'ai-card inactive';
      dot.className = 'status-dot inactive';
      info.className = 'ai-info error';
      info.textContent = '未检测到，请打开网页';
    }
  }

  // 检测可用的AI标签页
  async function checkAvailableTabs() {
    try {
      const tabs = await chrome.tabs.query({});

      const aiTabs = {
        chatgpt: [],
        claude: [],
        gemini: []
      };

      const promises = tabs.map(tab => {
        return new Promise(resolve => {
          const timeout = setTimeout(() => resolve(), 300);

          if (tab.url && (tab.url.includes('chat.openai.com') || tab.url.includes('chatgpt.com'))) {
            chrome.tabs.sendMessage(tab.id, { action: 'checkAvailability' }, response => {
              clearTimeout(timeout);
              if (!chrome.runtime.lastError && response && response.available) {
                aiTabs.chatgpt.push(tab);
              }
              resolve();
            });
          } else if (tab.url && tab.url.includes('claude.ai')) {
            chrome.tabs.sendMessage(tab.id, { action: 'checkAvailability' }, response => {
              clearTimeout(timeout);
              if (!chrome.runtime.lastError && response && response.available) {
                aiTabs.claude.push(tab);
              }
              resolve();
            });
          } else if (tab.url && tab.url.includes('gemini.google.com')) {
            chrome.tabs.sendMessage(tab.id, { action: 'checkAvailability' }, response => {
              clearTimeout(timeout);
              if (!chrome.runtime.lastError && response && response.available) {
                aiTabs.gemini.push(tab);
              }
              resolve();
            });
          } else {
            clearTimeout(timeout);
            resolve();
          }
        });
      });

      await Promise.all(promises);

      updateCardStatus(chatgptCard, aiTabs.chatgpt.length > 0, aiTabs.chatgpt.length);
      updateCardStatus(claudeCard, aiTabs.claude.length > 0, aiTabs.claude.length);
      updateCardStatus(geminiCard, aiTabs.gemini.length > 0, aiTabs.gemini.length);

      const totalTabs = aiTabs.chatgpt.length + aiTabs.claude.length + aiTabs.gemini.length;
      sendBtn.disabled = totalTabs === 0;

    } catch (error) {
      console.error('检测失败:', error);
    }
  }

  // 发送到所有AI - 使用直接注入的方式
  window.sendToAll = async function() {
    const question = questionInput.value.trim();

    if (!question) {
      showToast('⚠️ 请先输入问题！', 'error');
      questionInput.focus();
      return;
    }

    console.log('[发送] 开始发送:', question);

    sendBtn.disabled = true;
    const originalText = sendBtn.innerHTML;
    sendBtn.innerHTML = '<span>⏳</span><span>发送中...</span>';

    try {
      const tabs = await chrome.tabs.query({});
      const results = { success: [], failed: [] };

      for (const tab of tabs) {
        const isAITab =
          (tab.url && tab.url.includes('chat.openai.com')) ||
          (tab.url && tab.url.includes('chatgpt.com')) ||
          (tab.url && tab.url.includes('claude.ai')) ||
          (tab.url && tab.url.includes('gemini.google.com'));

        if (!isAITab) continue;

        try {
          console.log('[发送] 处理标签页:', tab.url);

          // 直接注入代码填充输入框
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (text) => {
              // ChatGPT
              const chatgptSelectors = [
                '#prompt-textarea',
                'textarea[placeholder*="Message"]',
                'textarea[data-id="root"]'
              ];

              // Claude
              const claudeSelectors = [
                'div[contenteditable="true"].ProseMirror',
                'div[contenteditable="true"][data-placeholder]'
              ];

              // Gemini
              const geminiSelectors = [
                '.ql-editor[contenteditable="true"]',
                'div[contenteditable="true"][role="textbox"]'
              ];

              const allSelectors = [...chatgptSelectors, ...claudeSelectors, ...geminiSelectors];

              for (const selector of allSelectors) {
                const element = document.querySelector(selector);
                if (element) {
                  element.focus();

                  if (element.tagName === 'TEXTAREA') {
                    // Textarea 处理
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                      window.HTMLTextAreaElement.prototype,
                      'value'
                    )?.set;

                    if (nativeInputValueSetter) {
                      nativeInputValueSetter.call(element, text);
                    } else {
                      element.value = text;
                    }

                    element.dispatchEvent(new Event('input', { bubbles: true }));
                    element.dispatchEvent(new Event('change', { bubbles: true }));
                  } else if (element.contentEditable === 'true') {
                    // ContentEditable 处理
                    element.innerHTML = '';
                    const p = document.createElement('p');
                    p.textContent = text;
                    element.appendChild(p);

                    element.dispatchEvent(new Event('input', { bubbles: true }));
                    element.dispatchEvent(new InputEvent('input', { bubbles: true }));
                  }

                  return { success: true, selector };
                }
              }

              return { success: false, error: '未找到输入框' };
            },
            args: [question]
          });

          results.success.push(tab.url);
          console.log('[发送] 成功:', tab.url);
        } catch (error) {
          console.error('[发送] 失败:', tab.url, error);
          results.failed.push({ site: tab.url, error: error.message });
        }
      }

      sendBtn.innerHTML = originalText;
      sendBtn.disabled = false;

      if (results.success.length > 0) {
        showToast(`✅ 成功发送到 ${results.success.length} 个 AI`, 'success');
        chrome.storage.local.set({ lastQuestion: question });
      } else {
        showToast('❌ 未找到已打开的 AI 标签页', 'error');
      }
    } catch (error) {
      sendBtn.innerHTML = originalText;
      sendBtn.disabled = false;
      showToast(`❌ 发送失败: ${error.message}`, 'error');
      console.error('[发送] 异常:', error);
    }
  };

  // 清空输入
  window.clearInput = function() {
    questionInput.value = '';
    questionInput.focus();
    showToast('✨ 已清空', 'info');
  };

  // 一键打开所有AI标签页
  window.openAllAITabs = async function() {
    showToast('📂 正在打开所有 AI 标签页...', 'info');

    try {
      // 打开三个 AI 标签页
      await chrome.tabs.create({ url: 'https://chatgpt.com', active: false });
      await chrome.tabs.create({ url: 'https://claude.ai', active: false });
      await chrome.tabs.create({ url: 'https://gemini.google.com', active: false });

      showToast('✅ 已打开所有 AI，等待加载...', 'success');

      // 等待 3 秒后自动检测
      setTimeout(() => {
        checkAvailableTabs();
        showToast('🎯 AI 已就绪，可以发送问题了！', 'success');
      }, 3000);
    } catch (error) {
      showToast('❌ 打开失败: ' + error.message, 'error');
    }
  };

  // 快捷键支持
  questionInput.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      sendToAll();
    }
  });

  // 自动保存
  let saveTimeout;
  questionInput.addEventListener('input', function() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      chrome.storage.local.set({ lastQuestion: questionInput.value });
    }, 500);
  });

  // 恢复输入
  chrome.storage.local.get(['lastQuestion'], function(result) {
    if (result.lastQuestion) {
      questionInput.value = result.lastQuestion;
    }
  });

  // 定时检测
  checkAvailableTabs();
  setInterval(checkAvailableTabs, 3000);

  // 欢迎提示
  setTimeout(() => {
    showToast('👋 AI Multi Sender 已就绪！', 'info');
  }, 500);
})();
