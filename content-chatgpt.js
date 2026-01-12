// ChatGPT Content Script
(function() {
  console.log('AI Multi Sender: ChatGPT content script loaded');

  // 查找输入框
  function findInput() {
    const selectors = [
      '#prompt-textarea',
      'textarea[placeholder*="Message"]',
      'textarea[data-id="root"]',
      'textarea.m-0',
      '[contenteditable="true"][data-id]'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const rect = element.getBoundingClientRect();
        if (rect.height > 0 && rect.width > 0) {
          console.log('[ChatGPT] Found input:', selector);
          return element;
        }
      }
    }
    return null;
  }

  // 填充文本到输入框
  function fillInput(element, text) {
    try {
      if (element.tagName === 'TEXTAREA') {
        // Textarea 元素
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          'value'
        )?.set;

        if (nativeInputValueSetter) {
          nativeInputValueSetter.call(element, text);
        } else {
          element.value = text;
        }

        element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      } else if (element.contentEditable === 'true') {
        // ContentEditable 元素
        element.textContent = text;
        element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      }

      element.focus();
      console.log('[ChatGPT] Text filled successfully');
      return true;
    } catch (error) {
      console.error('[ChatGPT] Fill error:', error);
      return false;
    }
  }

  // 监听消息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'checkAvailability') {
      const hasInput = findInput() !== null;
      sendResponse({ available: hasInput, site: 'ChatGPT' });
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
          sendResponse({ success: true, site: 'ChatGPT' });
        } else {
          sendResponse({ success: false, error: '填充失败' });
        }
      } catch (error) {
        console.error('[ChatGPT] Error:', error);
        sendResponse({ success: false, error: error.message });
      }
      return true;
    }

    return false;
  });
})();
