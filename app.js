// App.js - 全屏三栏模式主逻辑
(function() {
  const mainInput = document.getElementById('mainInput');
  const sendBtn = document.getElementById('sendBtn');
  const toast = document.getElementById('toast');
  const loadingOverlay = document.getElementById('loadingOverlay');

  // 显示Toast提示
  function showToast(message, type = 'info') {
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add('show');

    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }

  // 显示/隐藏加载状态
  function showLoading(show = true) {
    loadingOverlay.className = show ? 'loading-overlay active' : 'loading-overlay';
  }

  // 发送到所有AI
  window.sendToAll = async function() {
    const question = mainInput.value.trim();

    if (!question) {
      showToast('⚠️ 请先输入问题！', 'error');
      mainInput.focus();
      return;
    }

    showLoading(true);
    sendBtn.disabled = true;

    try {
      // 查询所有标签页
      const tabs = await chrome.tabs.query({});

      const results = {
        success: [],
        failed: []
      };

      // 发送到每个AI标签页
      const promises = tabs.map(tab => {
        return new Promise(resolve => {
          const isAITab =
            (tab.url && tab.url.includes('chat.openai.com')) ||
            (tab.url && tab.url.includes('chatgpt.com')) ||
            (tab.url && tab.url.includes('claude.ai')) ||
            (tab.url && tab.url.includes('gemini.google.com'));

          if (!isAITab) {
            resolve();
            return;
          }

          const timeout = setTimeout(() => {
            results.failed.push({ site: tab.url, error: '超时' });
            resolve();
          }, 5000);

          chrome.tabs.sendMessage(
            tab.id,
            { action: 'sendQuestion', question: question },
            response => {
              clearTimeout(timeout);
              if (chrome.runtime.lastError) {
                results.failed.push({
                  site: tab.url,
                  error: chrome.runtime.lastError.message
                });
              } else if (response && response.success) {
                results.success.push(response.site);
              } else if (response && response.error) {
                results.failed.push({
                  site: response.site || tab.url,
                  error: response.error
                });
              }
              resolve();
            }
          );
        });
      });

      await Promise.all(promises);

      showLoading(false);
      sendBtn.disabled = false;

      // 显示结果
      if (results.success.length > 0) {
        showToast(
          `✅ 成功发送到 ${results.success.length} 个 AI：${results.success.join('、')}`,
          'success'
        );
      } else if (results.failed.length > 0) {
        showToast(
          `❌ 发送失败！请确保 AI 网页在对话页面。`,
          'error'
        );
        console.error('发送失败详情:', results.failed);
      } else {
        showToast('⚠️ 未检测到任何 AI 标签页', 'error');
      }
    } catch (error) {
      showLoading(false);
      sendBtn.disabled = false;
      showToast(`❌ 发送失败: ${error.message}`, 'error');
      console.error('发送错误:', error);
    }
  };

  // 刷新所有iframe
  window.refreshAll = function() {
    const frames = ['chatgptFrame', 'geminiFrame', 'claudeFrame'];
    frames.forEach(id => {
      const frame = document.getElementById(id);
      if (frame) {
        frame.src = frame.src;
      }
    });
    showToast('🔄 正在刷新所有窗口...', 'info');
  };

  // 清空输入
  window.clearInput = function() {
    if (mainInput.value.trim() && !confirm('确定要清空输入吗？')) {
      return;
    }
    mainInput.value = '';
    mainInput.focus();
    showToast('✨ 已清空', 'info');
  };

  // 快捷键支持
  mainInput.addEventListener('keydown', function(e) {
    // Ctrl/Cmd + Enter 发送
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      sendToAll();
    }
    // Ctrl/Cmd + K 清空
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      mainInput.value = '';
    }
  });

  // 自动保存输入
  let saveTimeout;
  mainInput.addEventListener('input', function() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      chrome.storage.local.set({ lastQuestion: mainInput.value });
    }, 500);
  });

  // 恢复上次的输入
  chrome.storage.local.get(['lastQuestion'], function(result) {
    if (result.lastQuestion) {
      mainInput.value = result.lastQuestion;
    }
  });

  // 欢迎提示
  setTimeout(() => {
    showToast('👋 AI Multi Sender 已就绪！在下方输入问题即可同时发送到三个 AI', 'info');
  }, 1000);

  // 监听iframe加载错误
  const frames = document.querySelectorAll('.ai-iframe');
  frames.forEach(frame => {
    frame.addEventListener('error', function() {
      console.error(`iframe 加载失败: ${frame.id}`);
    });
  });
})();
