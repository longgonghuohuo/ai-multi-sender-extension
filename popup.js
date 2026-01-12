// Popup Script
document.addEventListener('DOMContentLoaded', function() {
  const questionInput = document.getElementById('questionInput');
  const sendBtn = document.getElementById('sendBtn');
  const clearBtn = document.getElementById('clearBtn');
  const statusDiv = document.getElementById('status');
  const tabsListDiv = document.getElementById('tabsList');

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
          // 添加超时处理
          const timeout = setTimeout(() => resolve(), 500);

          if (tab.url && (tab.url.includes('chat.openai.com') || tab.url.includes('chatgpt.com'))) {
            chrome.tabs.sendMessage(tab.id, { action: 'checkAvailability' }, response => {
              clearTimeout(timeout);
              if (chrome.runtime.lastError) {
                console.log('ChatGPT tab error:', chrome.runtime.lastError.message);
                resolve();
                return;
              }
              if (response && response.available) {
                aiTabs.chatgpt.push(tab);
              }
              resolve();
            });
          } else if (tab.url && tab.url.includes('claude.ai')) {
            chrome.tabs.sendMessage(tab.id, { action: 'checkAvailability' }, response => {
              clearTimeout(timeout);
              if (chrome.runtime.lastError) {
                console.log('Claude tab error:', chrome.runtime.lastError.message);
                resolve();
                return;
              }
              if (response && response.available) {
                aiTabs.claude.push(tab);
              }
              resolve();
            });
          } else if (tab.url && tab.url.includes('gemini.google.com')) {
            chrome.tabs.sendMessage(tab.id, { action: 'checkAvailability' }, response => {
              clearTimeout(timeout);
              if (chrome.runtime.lastError) {
                console.log('Gemini tab error:', chrome.runtime.lastError.message);
                resolve();
                return;
              }
              if (response && response.available) {
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
        updateTabsList(aiTabs);
      });
    });
  }

  // 更新标签页列表显示
  function updateTabsList(aiTabs) {
    const totalTabs = aiTabs.chatgpt.length + aiTabs.claude.length + aiTabs.gemini.length;

    if (totalTabs === 0) {
      tabsListDiv.innerHTML = '<div style="color: #dc3545;">⚠️ 未检测到任何 AI 网页，请先打开对应网站</div>';
      sendBtn.disabled = true;
      return;
    }

    sendBtn.disabled = false;

    let html = '';
    if (aiTabs.chatgpt.length > 0) {
      html += `<div><span class="dot active"></span>ChatGPT (${aiTabs.chatgpt.length} 个标签页)</div>`;
    } else {
      html += '<div><span class="dot inactive"></span>ChatGPT (未打开)</div>';
    }

    if (aiTabs.claude.length > 0) {
      html += `<div><span class="dot active"></span>Claude (${aiTabs.claude.length} 个标签页)</div>`;
    } else {
      html += '<div><span class="dot inactive"></span>Claude (未打开)</div>';
    }

    if (aiTabs.gemini.length > 0) {
      html += `<div><span class="dot active"></span>Gemini (${aiTabs.gemini.length} 个标签页)</div>`;
    } else {
      html += '<div><span class="dot inactive"></span>Gemini (未打开)</div>';
    }

    tabsListDiv.innerHTML = html;
  }

  // 显示状态消息
  function showStatus(message, type = 'info') {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;

    if (type !== 'error') {
      setTimeout(() => {
        statusDiv.className = 'status';
      }, 3000);
    }
  }

  // 发送问题到所有标签页
  async function sendToAllTabs() {
    const question = questionInput.value.trim();

    if (!question) {
      showStatus('请输入问题！', 'error');
      questionInput.focus();
      return;
    }

    // 保存问题到存储
    chrome.storage.local.set({ lastQuestion: question });

    sendBtn.disabled = true;
    showStatus('正在发送...', 'info');

    chrome.tabs.query({}, async function(tabs) {
      const results = {
        success: [],
        failed: []
      };

      const sendPromises = tabs.map(tab => {
        return new Promise(resolve => {
          const isAITab =
            tab.url.includes('chat.openai.com') ||
            tab.url.includes('chatgpt.com') ||
            tab.url.includes('claude.ai') ||
            tab.url.includes('gemini.google.com');

          if (!isAITab) {
            resolve();
            return;
          }

          chrome.tabs.sendMessage(
            tab.id,
            { action: 'sendQuestion', question: question },
            response => {
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

      // 显示结果
      if (results.success.length > 0) {
        showStatus(
          `✅ 成功发送到 ${results.success.length} 个页面: ${results.success.join(', ')}`,
          'success'
        );
      } else {
        showStatus('❌ 发送失败，请确保已打开 AI 网页并处于对话页面', 'error');
      }

      if (results.failed.length > 0) {
        console.error('发送失败的页面:', results.failed);
      }

      sendBtn.disabled = false;
    });
  }

  // 清空输入框
  function clearInput() {
    questionInput.value = '';
    questionInput.focus();
    chrome.storage.local.remove(['lastQuestion']);
    showStatus('已清空', 'info');
  }

  // 事件监听
  sendBtn.addEventListener('click', sendToAllTabs);
  clearBtn.addEventListener('click', clearInput);

  // 支持 Ctrl/Cmd + Enter 快捷键发送
  questionInput.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      sendToAllTabs();
    }
  });

  // 初始化时检测可用标签页
  checkAvailableTabs();

  // 每2秒刷新一次标签页状态
  setInterval(checkAvailableTabs, 2000);
});
