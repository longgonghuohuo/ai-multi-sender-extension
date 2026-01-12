// Gemini Content Script
(function() {
  console.log('AI Multi Sender: Gemini content script loaded');

  // 查找输入框
  function findInput() {
    const selectors = [
      '.ql-editor[contenteditable="true"]',
      'div[contenteditable="true"][role="textbox"]',
      'rich-textarea div[contenteditable="true"]',
      '[aria-label*="Enter a prompt"]',
      '[aria-label*="prompt"]'
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const rect = element.getBoundingClientRect();
        if (rect.height > 20 && rect.width > 100) {
          console.log('[Gemini] Found input:', selector);
          return element;
        }
      }
    }
    return null;
  }

  // 查找发送按钮
  function findSendButton() {
    const selectors = [
      'button[aria-label*="Send"]',
      'button[aria-label*="发送"]',
      'button.send-button',
      'button[type="submit"]',
      '[aria-label*="submit"]'
    ];

    for (const selector of selectors) {
      const buttons = document.querySelectorAll(selector);
      for (const button of buttons) {
        // 查找包含发送图标的按钮
        if (button.offsetParent !== null) {
          console.log('[Gemini] Found send button:', selector);
          return button;
        }
      }
    }

    // 备选方案：查找输入框附近的按钮
    const input = findInput();
    if (input) {
      const container = input.closest('form, [role="form"], .input-container, .chat-input');
      if (container) {
        const buttons = container.querySelectorAll('button');
        for (const button of buttons) {
          if (button.offsetParent !== null && !button.disabled) {
            console.log('[Gemini] Found nearby button');
            return button;
          }
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
        console.warn('[Gemini] Cursor positioning failed:', e);
      }

      console.log('[Gemini] Text filled successfully');

      // 等待一小段时间后点击发送按钮
      setTimeout(() => {
        const sendButton = findSendButton();
        if (sendButton && !sendButton.disabled) {
          console.log('[Gemini] Clicking send button');
          sendButton.click();
        } else {
          console.warn('[Gemini] Send button not found or disabled');
        }
      }, 500);

      return true;
    } catch (error) {
      console.error('[Gemini] Fill error:', error);
      return false;
    }
  }

  // 监听消息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'checkAvailability') {
      const hasInput = findInput() !== null;
      sendResponse({ available: hasInput, site: 'Gemini' });
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
          sendResponse({ success: true, site: 'Gemini' });
        } else {
          sendResponse({ success: false, error: '填充失败' });
        }
      } catch (error) {
        console.error('[Gemini] Error:', error);
        sendResponse({ success: false, error: error.message });
      }
      return true;
    }

    return false;
  });
})();
