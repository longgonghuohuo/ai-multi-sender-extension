// Claude Content Script
(function() {
  console.log('AI Multi Sender: Claude content script loaded');

  // 查找输入框
  function findInput() {
    const selectors = [
      'div[contenteditable="true"].ProseMirror',
      'div[contenteditable="true"][data-placeholder]',
      '.ProseMirror[contenteditable="true"]',
      'fieldset div[contenteditable="true"]',
      '[data-testid="chat-input"]'
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const rect = element.getBoundingClientRect();
        if (rect.height > 20 && rect.width > 100) {
          console.log('[Claude] Found input:', selector);
          return element;
        }
      }
    }
    return null;
  }

  // 填充文本到输入框
  function fillInput(element, text) {
    try {
      element.focus();

      // 清空现有内容
      element.innerHTML = '';

      // 插入新内容
      const p = document.createElement('p');
      p.textContent = text;
      element.appendChild(p);

      // 触发输入事件
      element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      element.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));

      // 设置光标到末尾
      try {
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(element);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      } catch (e) {
        console.warn('[Claude] Cursor positioning failed:', e);
      }

      console.log('[Claude] Text filled successfully');
      return true;
    } catch (error) {
      console.error('[Claude] Fill error:', error);
      return false;
    }
  }

  // 监听消息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'checkAvailability') {
      const hasInput = findInput() !== null;
      sendResponse({ available: hasInput, site: 'Claude' });
      return true;
    }

    if (request.action === 'sendQuestion') {
      try {
        const input = findInput();
        if (!input) {
          sendResponse({ success: false, error: '未找到输入框' });
          return true;
        }

        const success = fillInput(input, request.question);
        if (success) {
          sendResponse({ success: true, site: 'Claude' });
        } else {
          sendResponse({ success: false, error: '填充失败' });
        }
      } catch (error) {
        console.error('[Claude] Error:', error);
        sendResponse({ success: false, error: error.message });
      }
      return true;
    }

    return false;
  });
})();
