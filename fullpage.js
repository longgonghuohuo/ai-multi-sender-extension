// Full Page Script
document.addEventListener('DOMContentLoaded', function() {
  const questionInput = document.getElementById('questionInput');
  const sendBtn = document.getElementById('sendBtn');
  const clearBtn = document.getElementById('clearBtn');
  const statusMessage = document.getElementById('statusMessage');

  const chatgptCard = document.getElementById('chatgptCard');
  const claudeCard = document.getElementById('claudeCard');
  const geminiCard = document.getElementById('geminiCard');

  // 从存储中恢复上次的输入
  chrome.storage.local.get(['lastQuestion'], function(result) {
    if (result.lastQuestion) {
      questionInput.value = result.lastQuestion;
    }
  });

  // 检测可用的标签页
  function checkAvailableTabs() {
    chrome.tabs.query({}, function(tabs) {
      const aiTabs = {
        chatgpt: [],
        claude: [],
        gemini: []
      };

      const promises = tabs.map(tab => {
        return new Promise(resolve => {
          const timeout = setTimeout(() => resolve(), 500);

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

      Promise.all(promises).then(() => {
        updateAIStatus(aiTabs);
      });
    });
  }

  // 更新 AI 状态卡片
  function updateAIStatus(aiTabs) {
    const totalTabs = aiTabs.chatgpt.length + aiTabs.claude.length + aiTabs.gemini.length;

    // ChatGPT
    if (aiTabs.chatgpt.length > 0) {
      chatgptCard.className = 'ai-status-card active';
      chatgptCard.querySelector('.ai-icon').className = 'ai-icon active';
      chatgptCard.querySelector('.ai-info').textContent = `${aiTabs.chatgpt.length} 个标签页已就绪`;
    } else {
      chatgptCard.className = 'ai-status-card inactive';
      chatgptCard.querySelector('.ai-icon').className = 'ai-icon inactive';
      chatgptCard.querySelector('.ai-info').textContent = '未检测到，请打开网页';
    }

    // Claude
    if (aiTabs.claude.length > 0) {
      claudeCard.className = 'ai-status-card active';
      claudeCard.querySelector('.ai-icon').className = 'ai-icon active';
      claudeCard.querySelector('.ai-info').textContent = `${aiTabs.claude.length} 个标签页已就绪`;
    } else {
      claudeCard.className = 'ai-status-card inactive';
      claudeCard.querySelector('.ai-icon').className = 'ai-icon inactive';
      claudeCard.querySelector('.ai-info').textContent = '未检测到，请打开网页';
    }

    // Gemini
    if (aiTabs.gemini.length > 0) {
      geminiCard.className = 'ai-status-card active';
      geminiCard.querySelector('.ai-icon').className = 'ai-icon active';
      geminiCard.querySelector('.ai-info').textContent = `${aiTabs.gemini.length} 个标签页已就绪`;
    } else {
      geminiCard.className = 'ai-status-card inactive';
      geminiCard.querySelector('.ai-icon').className = 'ai-icon inactive';
      geminiCard.querySelector('.ai-info').textContent = '未检测到，请打开网页';
    }

    // 更新发送按钮状态
    sendBtn.disabled = totalTabs === 0;
  }

  // 显示状态消息
  function showStatus(message, type = 'info') {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;

    if (type !== 'error') {
      setTimeout(() => {
        statusMessage.className = 'status-message';
      }, 5000);
    }
  }

  // 发送问题到所有标签页
  async function sendToAllTabs() {
    const question = questionInput.value.trim();

    if (!question) {
      showStatus('⚠️ 请输入问题！', 'error');
      questionInput.focus();
      return;
    }

    // 保存问题到存储
    chrome.storage.local.set({ lastQuestion: question });

    sendBtn.disabled = true;
    const originalText = sendBtn.innerHTML;
    sendBtn.innerHTML = '<span class="loading"></span><span>正在发送...</span>';

    chrome.tabs.query({}, async function(tabs) {
      const results = {
        success: [],
        failed: []
      };

      const sendPromises = tabs.map(tab => {
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
            results.failed.push({
              site: tab.url,
              error: '响应超时'
            });
            resolve();
          }, 3000);

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

      await Promise.all(sendPromises);

      // 恢复按钮
      sendBtn.innerHTML = originalText;
      sendBtn.disabled = false;

      // 显示结果
      if (results.success.length > 0) {
        showStatus(
          `✅ 成功发送到 ${results.success.length} 个页面：${results.success.join('、')}`,
          'success'
        );
      } else {
        showStatus(
          '❌ 发送失败！请确保已打开 AI 网页并处于对话页面。检查控制台查看详细错误。',
          'error'
        );
      }

      if (results.failed.length > 0) {
        console.error('发送失败的页面:', results.failed);
      }
    });
  }

  // 清空输入框
  function clearInput() {
    questionInput.value = '';
    questionInput.focus();
    chrome.storage.local.remove(['lastQuestion']);
    showStatus('✨ 已清空输入框', 'info');
  }

  // 事件监听
  sendBtn.addEventListener('click', sendToAllTabs);
  clearBtn.addEventListener('click', clearInput);

  // 支持 Ctrl/Cmd + Enter 快捷键发送
  questionInput.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      sendToAllTabs();
    }
  });

  // 初始化时检测可用标签页
  checkAvailableTabs();

  // 每3秒刷新一次标签页状态
  setInterval(checkAvailableTabs, 3000);
});
