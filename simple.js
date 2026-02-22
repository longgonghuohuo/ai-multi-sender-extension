// Simple.js - AI Multi Sender
// 核心功能：平台筛选、会话模式（继续/新开/自动）、并排窗口发送

(function() {
  const CONTINUE_WINDOW_MS = 10 * 60 * 1000;
  const NEW_SESSION_WINDOW_MS = 30 * 60 * 1000;
  const SESSION_STORAGE_KEY = 'activeAISessionV3';
  const SETTINGS_STORAGE_KEY = 'senderSettingsV3';

  const SITE_CONFIG = {
    chatgpt: {
      id: 'chatgpt',
      name: 'ChatGPT',
      matchers: ['chatgpt.com', 'chat.openai.com'],
      newUrl: () => `https://chatgpt.com/?temporary-chat=true&fresh=${Date.now()}`,
      resumeUrl: () => `https://chatgpt.com/?fresh=${Date.now()}`
    },
    claude: {
      id: 'claude',
      name: 'Claude',
      matchers: ['claude.ai'],
      newUrl: () => `https://claude.ai/new?fresh=${Date.now()}`,
      resumeUrl: () => `https://claude.ai/new?fresh=${Date.now()}`
    },
    gemini: {
      id: 'gemini',
      name: 'Gemini',
      matchers: ['gemini.google.com'],
      newUrl: () => `https://gemini.google.com/app?fresh=${Date.now()}`,
      resumeUrl: () => `https://gemini.google.com/app?fresh=${Date.now()}`
    },
    grok: {
      id: 'grok',
      name: 'Grok',
      matchers: ['grok.com', 'x.com/i/grok'],
      newUrl: () => `https://grok.com/?fresh=${Date.now()}`,
      resumeUrl: () => `https://grok.com/?fresh=${Date.now()}`
    }
  };

  const DEFAULT_SITES = ['chatgpt', 'claude', 'gemini'];

  document.addEventListener('DOMContentLoaded', async function() {
    console.log('[初始化] DOM 加载完成，开始绑定事件...');

    const questionInput = document.getElementById('questionInput');
    const sendBtn = document.getElementById('sendBtn');
    const clearBtn = document.getElementById('clearBtn');
    const exportBtn = document.getElementById('exportBtn');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    const openSelectedBtn = document.getElementById('openSelectedBtn');
    const chatModeSelect = document.getElementById('chatModeSelect');
    const sessionHint = document.getElementById('sessionHint');
    const toast = document.getElementById('toast');
    const historyList = document.getElementById('historyList');

    const siteCheckboxes = Array.from(document.querySelectorAll('input[data-site]'));
    let isSending = false;

    function showToast(message, type = 'info') {
      if (!toast) return;
      toast.textContent = message;
      toast.className = `toast ${type}`;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 3000);
    }

    function sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    function withTimeout(promise, timeoutMs, label) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`${label} 超时 (${Math.round(timeoutMs / 1000)}s)`));
        }, timeoutMs);

        promise
          .then(value => {
            clearTimeout(timer);
            resolve(value);
          })
          .catch(error => {
            clearTimeout(timer);
            reject(error);
          });
      });
    }

    function formatDuration(ms) {
      if (!Number.isFinite(ms) || ms < 0) return '未知';
      const minutes = Math.floor(ms / 60000);
      if (minutes < 1) return '刚刚';
      if (minutes < 60) return `${minutes} 分钟前`;
      const hours = Math.floor(minutes / 60);
      return `${hours} 小时前`;
    }

    function isSiteUrl(siteId, url) {
      const config = SITE_CONFIG[siteId];
      if (!config || !url) return false;
      return config.matchers.some(part => url.includes(part));
    }

    function getSelectedSites() {
      return siteCheckboxes
        .filter(input => input.checked && SITE_CONFIG[input.dataset.site])
        .map(input => input.dataset.site);
    }

    function setSelectedSites(siteIds) {
      const siteSet = new Set(siteIds);
      siteCheckboxes.forEach(input => {
        input.checked = siteSet.has(input.dataset.site);
      });
    }

    async function loadSettings() {
      try {
        const result = await chrome.storage.local.get(SETTINGS_STORAGE_KEY);
        const settings = result[SETTINGS_STORAGE_KEY] || {};
        const selectedSites = Array.isArray(settings.selectedSites)
          ? settings.selectedSites.filter(site => SITE_CONFIG[site])
          : DEFAULT_SITES;
        const mode = settings.mode || 'auto';

        setSelectedSites(selectedSites.length > 0 ? selectedSites : DEFAULT_SITES);
        if (chatModeSelect) {
          chatModeSelect.value = mode;
        }
      } catch (error) {
        console.error('[设置] 加载失败:', error);
      }
    }

    async function saveSettings() {
      const selectedSites = getSelectedSites();
      const mode = chatModeSelect ? chatModeSelect.value : 'auto';

      await chrome.storage.local.set({
        [SETTINGS_STORAGE_KEY]: {
          selectedSites,
          mode
        }
      });
    }

    async function loadSession() {
      try {
        const result = await chrome.storage.local.get(SESSION_STORAGE_KEY);
        const session = result[SESSION_STORAGE_KEY];
        return session || { tabsBySite: {}, lastSentAt: null };
      } catch (error) {
        console.error('[会话] 读取失败:', error);
        return { tabsBySite: {}, lastSentAt: null };
      }
    }

    async function saveSession(session) {
      await chrome.storage.local.set({ [SESSION_STORAGE_KEY]: session });
    }

    async function refreshSessionHint() {
      if (!sessionHint) return;

      const session = await loadSession();
      const now = Date.now();

      if (!session.lastSentAt) {
        sessionHint.textContent = '暂无发送记录。可选择“开启新窗口”开始新会话。';
        return;
      }

      const elapsed = now - session.lastSentAt;
      let autoMode;

      if (elapsed <= CONTINUE_WINDOW_MS) {
        autoMode = '继续之前聊天';
      } else if (elapsed >= NEW_SESSION_WINDOW_MS) {
        autoMode = '开启新窗口';
      } else {
        autoMode = '继续之前聊天';
      }

      sessionHint.textContent = `上次发送：${formatDuration(elapsed)}；自动模式当前会选择：${autoMode}。`;
    }

    function resolveAutoMode(session, now) {
      if (!session.lastSentAt) {
        return 'new';
      }

      const elapsed = now - session.lastSentAt;
      if (elapsed <= CONTINUE_WINDOW_MS) {
        return 'continue';
      }

      if (elapsed >= NEW_SESSION_WINDOW_MS) {
        return 'new';
      }

      return 'continue';
    }

    async function resolveEffectiveMode(modeValue, session) {
      if (modeValue === 'continue' || modeValue === 'new') {
        return modeValue;
      }

      if (modeValue === 'auto') {
        return resolveAutoMode(session, Date.now());
      }

      const keepChat = window.confirm(
        '发送模式选择:\n\n确定 = 继续之前聊天\n取消 = 开启新窗口'
      );
      return keepChat ? 'continue' : 'new';
    }

    async function getValidTabFromRecord(siteId, record) {
      if (!record || !record.tabId) return null;

      try {
        const tab = await chrome.tabs.get(record.tabId);
        if (!tab || !isSiteUrl(siteId, tab.url || '')) {
          return null;
        }

        return {
          siteId,
          name: SITE_CONFIG[siteId].name,
          tabId: tab.id,
          windowId: tab.windowId
        };
      } catch (error) {
        return null;
      }
    }

    async function findAnyOpenTabForSite(siteId) {
      const tabs = await chrome.tabs.query({});
      const matched = tabs.find(tab => isSiteUrl(siteId, tab.url || ''));

      if (!matched) return null;
      return {
        siteId,
        name: SITE_CONFIG[siteId].name,
        tabId: matched.id,
        windowId: matched.windowId
      };
    }

    async function buildTileBounds(count) {
      const currentWindow = await chrome.windows.getCurrent();
      const screenLeft = Number.isFinite(window.screen.availLeft)
        ? window.screen.availLeft
        : (Number.isFinite(window.screenX) ? window.screenX : 0);
      const screenTop = Number.isFinite(window.screen.availTop)
        ? window.screen.availTop
        : (Number.isFinite(window.screenY) ? window.screenY : 0);
      const width = window.screen.availWidth || currentWindow.width || 1440;
      const height = window.screen.availHeight || currentWindow.height || 900;

      const baseWidth = Math.floor(width / Math.max(1, count));
      const bounds = [];

      for (let i = 0; i < count; i++) {
        const panelLeft = screenLeft + baseWidth * i;
        const panelWidth = i === count - 1 ? width - baseWidth * i : baseWidth;
        bounds.push({ left: panelLeft, top: screenTop, width: panelWidth, height });
      }

      return bounds;
    }

    function waitForTabReady(tabId, timeoutMs = 12000) {
      return new Promise(resolve => {
        let resolved = false;
        let timer = null;

        function cleanup() {
          if (resolved) return;
          resolved = true;
          if (timer) clearTimeout(timer);
          chrome.tabs.onUpdated.removeListener(onUpdated);
          resolve();
        }

        function onUpdated(updatedTabId, changeInfo) {
          if (updatedTabId === tabId && changeInfo.status === 'complete') {
            cleanup();
          }
        }

        timer = setTimeout(cleanup, timeoutMs);
        chrome.tabs.onUpdated.addListener(onUpdated);

        chrome.tabs.get(tabId, tab => {
          if (chrome.runtime.lastError || !tab) {
            cleanup();
            return;
          }

          if (tab.status === 'complete') {
            cleanup();
          }
        });
      });
    }

    async function openSiteWindow(siteId, bounds, forceNewConversation, focused = false) {
      const config = SITE_CONFIG[siteId];
      const launchUrl = forceNewConversation ? config.newUrl() : config.resumeUrl();

      const createdWindow = await chrome.windows.create({
        url: launchUrl,
        type: 'normal',
        focused,
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height
      });

      if (createdWindow.id) {
        await chrome.windows.update(createdWindow.id, {
          left: bounds.left,
          top: bounds.top,
          width: bounds.width,
          height: bounds.height
        });
      }

      const tab = createdWindow.tabs && createdWindow.tabs[0] ? createdWindow.tabs[0] : null;
      if (!tab || !tab.id) {
        throw new Error(`${config.name} 打开失败：未获取到标签页`);
      }

      await waitForTabReady(tab.id);

      return {
        siteId,
        name: config.name,
        tabId: tab.id,
        windowId: createdWindow.id
      };
    }

    async function ensureDedicatedWindow(siteId, target, bounds, focused = false) {
      if (!target || !target.tabId) {
        throw new Error(`${SITE_CONFIG[siteId].name} 无可用标签页`);
      }

      const tab = await chrome.tabs.get(target.tabId);
      if (!tab || !isSiteUrl(siteId, tab.url || '')) {
        throw new Error(`${SITE_CONFIG[siteId].name} 标签页已失效`);
      }

      const tabsInWindow = await chrome.tabs.query({ windowId: tab.windowId });

      if (tabsInWindow.length <= 1) {
        await chrome.windows.update(tab.windowId, {
          left: bounds.left,
          top: bounds.top,
          width: bounds.width,
          height: bounds.height,
          focused
        });

        return {
          siteId,
          name: SITE_CONFIG[siteId].name,
          tabId: tab.id,
          windowId: tab.windowId
        };
      }

      const movedWindow = await chrome.windows.create({
        tabId: tab.id,
        type: 'normal',
        focused,
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height
      });

      if (!movedWindow.id) {
        throw new Error(`${SITE_CONFIG[siteId].name} 独立窗口创建失败`);
      }

      await chrome.windows.update(movedWindow.id, {
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height,
        focused
      });

      const movedTab = movedWindow.tabs && movedWindow.tabs[0] ? movedWindow.tabs[0] : null;
      const tabId = movedTab && movedTab.id ? movedTab.id : tab.id;

      return {
        siteId,
        name: SITE_CONFIG[siteId].name,
        tabId,
        windowId: movedWindow.id
      };
    }

    async function tileSiteWindows(selectedSites, siteTabs) {
      const bounds = await buildTileBounds(selectedSites.length);
      const usedWindowIds = new Set();

      for (let index = 0; index < selectedSites.length; index++) {
        const siteId = selectedSites[index];
        const target = siteTabs[siteId];
        if (!target || !target.windowId || usedWindowIds.has(target.windowId)) {
          continue;
        }

        usedWindowIds.add(target.windowId);

        try {
          await chrome.windows.update(target.windowId, {
            left: bounds[index].left,
            top: bounds[index].top,
            width: bounds[index].width,
            height: bounds[index].height,
            focused: index === selectedSites.length - 1
          });
        } catch (error) {
          console.warn(`[布局] ${target.name} 位置调整失败:`, error);
        }
      }
    }

    async function ensureTabsForMode(selectedSites, mode, session) {
      const siteTabs = {};
      const openErrors = {};

      if (mode === 'new') {
        const bounds = await buildTileBounds(selectedSites.length);

        for (let index = 0; index < selectedSites.length; index++) {
          const siteId = selectedSites[index];
          try {
            siteTabs[siteId] = await withTimeout(
              openSiteWindow(
                siteId,
                bounds[index],
                true,
                index === selectedSites.length - 1
              ),
              20000,
              `${SITE_CONFIG[siteId].name} 打开窗口`
            );
          } catch (error) {
            openErrors[siteId] = error.message;
          }
        }

        if (Object.keys(siteTabs).length > 0) {
          await tileSiteWindows(selectedSites, siteTabs);
        }

        return { siteTabs, openErrors };
      }

      for (const siteId of selectedSites) {
        const sessionRecord = session.tabsBySite ? session.tabsBySite[siteId] : null;
        const validFromSession = await getValidTabFromRecord(siteId, sessionRecord);

        if (validFromSession) {
          siteTabs[siteId] = validFromSession;
          continue;
        }

        const foundOpenTab = await findAnyOpenTabForSite(siteId);
        if (foundOpenTab) {
          siteTabs[siteId] = foundOpenTab;
        }
      }

      const missingSites = selectedSites.filter(siteId => !siteTabs[siteId]);
      if (missingSites.length > 0) {
        const bounds = await buildTileBounds(missingSites.length);

        for (let index = 0; index < missingSites.length; index++) {
          const siteId = missingSites[index];
          try {
            siteTabs[siteId] = await withTimeout(
              openSiteWindow(siteId, bounds[index], false, false),
              20000,
              `${SITE_CONFIG[siteId].name} 打开窗口`
            );
          } catch (error) {
            openErrors[siteId] = error.message;
          }
        }
      }

      // 继续对话模式下，也强制每个平台独立窗口，避免多个平台挤在同一浏览器窗口里
      const fullBounds = await buildTileBounds(selectedSites.length);
      for (let index = 0; index < selectedSites.length; index++) {
        const siteId = selectedSites[index];
        const target = siteTabs[siteId];

        if (!target) continue;

        try {
          siteTabs[siteId] = await withTimeout(
            ensureDedicatedWindow(
              siteId,
              target,
              fullBounds[index],
              index === selectedSites.length - 1
            ),
            12000,
            `${SITE_CONFIG[siteId].name} 独立窗口`
          );
        } catch (error) {
          openErrors[siteId] = error.message;
        }
      }

      if (Object.keys(siteTabs).length > 0) {
        await tileSiteWindows(selectedSites, siteTabs);
      }

      return { siteTabs, openErrors };
    }

    async function tryStartFreshConversation(tabId, siteId) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          func: (targetSite) => {
            const selectors = {
              chatgpt: [
                'button[data-testid="create-new-chat-button"]',
                'a[data-testid="new-chat-button"]',
                'button[aria-label*="New chat"]',
                'button[aria-label*="新聊天"]'
              ],
              claude: [
                'a[href="/new"]',
                'button[aria-label*="New chat"]',
                'button[aria-label*="新对话"]'
              ],
              gemini: [
                'button[aria-label*="New chat"]',
                'button[aria-label*="新聊天"]',
                'button[aria-label*="New conversation"]'
              ],
              grok: [
                'button[aria-label*="New chat"]',
                'button[aria-label*="Start new"]'
              ]
            };

            const candidates = selectors[targetSite] || [];
            for (const selector of candidates) {
              const element = document.querySelector(selector);
              if (element) {
                element.click();
                return true;
              }
            }

            const fallback = Array.from(document.querySelectorAll('button, a')).find(el => {
              const text = (el.textContent || '').toLowerCase();
              return text.includes('new chat') || text.includes('新聊天') || text.includes('新对话');
            });

            if (fallback) {
              fallback.click();
              return true;
            }

            return false;
          },
          args: [siteId]
        });
      } catch (error) {
        console.warn(`[新会话] ${SITE_CONFIG[siteId].name} 未执行新建会话点击:`, error);
      }
    }

    async function fillQuestionAndSend(tabId, question, siteId, forceNewConversation) {
      const siteName = SITE_CONFIG[siteId] ? SITE_CONFIG[siteId].name : siteId;

      try {
        console.log(`[填充] ${siteName}, tabId: ${tabId}`);

        if (forceNewConversation) {
          await tryStartFreshConversation(tabId, siteId);
          await sleep(1200);
        }

        const results = await chrome.scripting.executeScript({
          target: { tabId },
          func: async payload => {
            const { text, targetSite } = payload;
            const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

            const inputBySite = {
              chatgpt: [
                '#prompt-textarea',
                'textarea[placeholder*="Message"]',
                'textarea[data-id="root"]'
              ],
              claude: [
                'div[contenteditable="true"].ProseMirror',
                'div[contenteditable="true"][data-placeholder]'
              ],
              gemini: [
                '.ql-editor[contenteditable="true"]',
                'rich-textarea div[contenteditable="true"]',
                'div[contenteditable="true"][role="textbox"]'
              ],
              grok: [
                'textarea',
                'div[contenteditable="true"][role="textbox"]',
                'div[contenteditable="true"]'
              ]
            };

            const sendBySite = {
              chatgpt: [
                'button[data-testid="send-button"]',
                'button[aria-label="Send prompt"]'
              ],
              claude: [
                'button[aria-label="Send Message"]',
                'button[aria-label="发送消息"]'
              ],
              gemini: [
                'button[aria-label="Send message"]',
                'button[mattooltip="Send message"]'
              ],
              grok: [
                'button[type="submit"]',
                'button[aria-label*="Send"]',
                'button[aria-label*="发送"]'
              ]
            };

            const genericInputs = [
              'textarea',
              'div[contenteditable="true"][role="textbox"]',
              'div[contenteditable="true"]'
            ];

            const genericSends = [
              'button[type="submit"]',
              'button[aria-label*="Send"]',
              'button[aria-label*="发送"]'
            ];

            function isVisible(element) {
              if (!element) return false;
              const rect = element.getBoundingClientRect();
              return rect.width > 0 && rect.height > 0;
            }

            function pickElement(selectors) {
              for (const selector of selectors) {
                const element = document.querySelector(selector);
                if (element && isVisible(element)) {
                  return element;
                }
              }
              return null;
            }

            const inputElement = pickElement([
              ...(inputBySite[targetSite] || []),
              ...genericInputs
            ]);

            if (!inputElement) {
              return { success: false, error: '未找到输入框' };
            }

            inputElement.focus();

            if (inputElement.tagName === 'TEXTAREA') {
              const setter = Object.getOwnPropertyDescriptor(
                window.HTMLTextAreaElement.prototype,
                'value'
              )?.set;

              if (setter) {
                setter.call(inputElement, text);
              } else {
                inputElement.value = text;
              }

              inputElement.dispatchEvent(new Event('input', { bubbles: true }));
              inputElement.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
              if (inputElement.classList.contains('ProseMirror')) {
                inputElement.innerHTML = `<p>${text}</p>`;
              } else {
                inputElement.textContent = text;
              }

              inputElement.dispatchEvent(new Event('input', { bubbles: true }));
              inputElement.dispatchEvent(
                new InputEvent('input', {
                  bubbles: true,
                  inputType: 'insertText',
                  data: text
                })
              );
            }

            await wait(800);

            const sendButton = pickElement([
              ...(sendBySite[targetSite] || []),
              ...genericSends
            ]);

            if (!sendButton) {
              return { success: false, error: '未找到发送按钮' };
            }

            if (sendButton.disabled) {
              return { success: false, error: '发送按钮不可用' };
            }

            sendButton.click();
            return { success: true };
          },
          args: [{ text: question, targetSite: siteId }]
        });

        const result = results && results[0] ? results[0].result : null;
        if (result && result.success) {
          return { success: true };
        }

        return {
          success: false,
          error: result && result.error ? result.error : '未知错误'
        };
      } catch (error) {
        console.error(`[填充] ${siteName} 失败:`, error);
        return { success: false, error: error.message };
      }
    }

    async function openSelectedSitesOnly() {
      const selectedSites = getSelectedSites();
      if (selectedSites.length === 0) {
        showToast('请至少选择一个目标平台', 'error');
        return;
      }

      try {
        const session = await loadSession();
        const requestedMode = chatModeSelect ? chatModeSelect.value : 'auto';
        const effectiveMode = await resolveEffectiveMode(requestedMode, session);

        showToast(
          effectiveMode === 'new' ? '正在开启新窗口并并排布局...' : '正在复用/补齐窗口并并排布局...',
          'info'
        );

        const { siteTabs, openErrors } = await withTimeout(
          ensureTabsForMode(selectedSites, effectiveMode, session),
          45000,
          '打开并排窗口'
        );

        const openedCount = Object.keys(siteTabs).length;
        if (openedCount === 0) {
          const firstError = Object.values(openErrors)[0] || '未知错误';
          throw new Error(`未成功打开任何窗口：${firstError}`);
        }

        await saveSession({
          tabsBySite: { ...(session.tabsBySite || {}), ...siteTabs },
          lastSentAt: session.lastSentAt || null,
          lastOpenedAt: Date.now()
        });

        await refreshSessionHint();
        if (Object.keys(openErrors).length > 0) {
          showToast(`已打开 ${openedCount} 个窗口，部分失败请重试`, 'info');
        } else {
          showToast('并排窗口已就绪', 'success');
        }
      } catch (error) {
        console.error('[并排打开] 失败:', error);
        showToast(`并排打开失败: ${error.message}`, 'error');
      }
    }

    async function sendToAll() {
      console.log('[发送] sendToAll 被调用！');

      if (isSending) {
        showToast('正在发送中，请稍候...', 'info');
        return;
      }

      const question = questionInput.value.trim();
      if (!question) {
        showToast('请先输入问题！', 'error');
        questionInput.focus();
        return;
      }

      const selectedSites = getSelectedSites();
      if (selectedSites.length === 0) {
        showToast('请至少选择一个目标平台', 'error');
        return;
      }

      isSending = true;
      sendBtn.disabled = true;
      sendBtn.innerHTML = '<span>⏳</span><span>发送中...</span>';

      let hardTimeoutFired = false;
      const hardTimeoutTimer = setTimeout(() => {
        hardTimeoutFired = true;
        isSending = false;
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<span>🚀</span><span>发送到所选AI</span>';
        showToast('发送流程超时，已自动解锁。请重试或切换“继续之前聊天”模式。', 'error');
      }, 90000);

      try {
        const session = await loadSession();
        const requestedMode = chatModeSelect ? chatModeSelect.value : 'auto';
        const effectiveMode = await resolveEffectiveMode(requestedMode, session);

        showToast(
          effectiveMode === 'new' ? '开启新窗口并发送...' : '继续之前聊天并发送...',
          'info'
        );

        const { siteTabs, openErrors } = await withTimeout(
          ensureTabsForMode(selectedSites, effectiveMode, session),
          45000,
          '准备目标窗口'
        );

        const successSites = [];
        const failedSites = [];

        for (const siteId of selectedSites) {
          const target = siteTabs[siteId];
          if (!target || !target.tabId) {
            const openErr = openErrors[siteId] || '未找到窗口';
            failedSites.push(`${SITE_CONFIG[siteId].name}(${openErr})`);
            continue;
          }

          const result = await withTimeout(
            fillQuestionAndSend(
              target.tabId,
              question,
              siteId,
              effectiveMode === 'new'
            ),
            20000,
            `${SITE_CONFIG[siteId].name} 发送`
          ).catch(error => ({
            success: false,
            error: error.message
          }));

          if (result.success) {
            successSites.push(SITE_CONFIG[siteId].name);
          } else {
            failedSites.push(`${SITE_CONFIG[siteId].name}(${result.error})`);
          }
        }

        await saveSession({
          tabsBySite: { ...(session.tabsBySite || {}), ...siteTabs },
          lastSentAt: Date.now(),
          lastOpenedAt: Date.now(),
          lastMode: effectiveMode
        });

        await saveToHistory(question);
        await refreshSessionHint();

        if (successSites.length > 0) {
          showToast(`发送成功：${successSites.join('、')}`, 'success');
        } else {
          showToast('发送失败，请确认目标网页已登录并可输入', 'error');
        }

        if (failedSites.length > 0) {
          console.warn('[发送] 失败详情:', failedSites);
        }
      } catch (error) {
        console.error('[发送] 错误:', error);
        showToast('发送失败: ' + error.message, 'error');
      } finally {
        clearTimeout(hardTimeoutTimer);
        isSending = false;
        if (!hardTimeoutFired) {
          sendBtn.disabled = false;
          sendBtn.innerHTML = '<span>🚀</span><span>发送到所选AI</span>';
        }
      }
    }

    function clearInput() {
      questionInput.value = '';
      questionInput.focus();
      showToast('已清空', 'info');
    }

    async function saveToHistory(question) {
      try {
        const result = await chrome.storage.local.get('history');
        const history = result.history || [];

        history.unshift({
          id: Date.now(),
          question,
          timestamp: new Date().toLocaleString('zh-CN')
        });

        if (history.length > 100) {
          history.splice(100);
        }

        await chrome.storage.local.set({ history });
        await loadHistory();
      } catch (error) {
        console.error('[历史] 保存失败:', error);
      }
    }

    async function loadHistory() {
      try {
        const result = await chrome.storage.local.get('history');
        const history = result.history || [];

        if (!historyList) return;

        if (history.length === 0) {
          historyList.innerHTML = '<div class="history-empty">暂无历史记录</div>';
          return;
        }

        historyList.innerHTML = history
          .map(item => `
            <div class="history-item" data-question="${escapeHtml(item.question)}">
              <div class="history-timestamp">${item.timestamp}</div>
              <div class="history-question">${escapeHtml(item.question)}</div>
            </div>
          `)
          .join('');

        historyList.querySelectorAll('.history-item').forEach(item => {
          item.addEventListener('click', function() {
            questionInput.value = this.dataset.question;
            questionInput.focus();
            showToast('已填充', 'info');
          });
        });
      } catch (error) {
        console.error('[历史] 加载失败:', error);
      }
    }

    async function exportHistory() {
      const result = await chrome.storage.local.get('history');
      const history = result.history || [];

      if (history.length === 0) {
        showToast('没有历史记录', 'error');
        return;
      }

      const content = history
        .map((item, i) => `${i + 1}. [${item.timestamp}]\n${item.question}\n`)
        .join('\n---\n\n');

      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AI提问历史_${new Date().toISOString().split('T')[0]}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('已导出', 'success');
    }

    async function clearHistory() {
      if (!confirm('确定清空所有历史记录？')) return;
      await chrome.storage.local.set({ history: [] });
      await loadHistory();
      showToast('已清空', 'info');
    }

    function escapeHtml(str) {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    if (sendBtn) {
      sendBtn.addEventListener('click', sendToAll);
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', clearInput);
    }

    if (exportBtn) {
      exportBtn.addEventListener('click', exportHistory);
    }

    if (clearHistoryBtn) {
      clearHistoryBtn.addEventListener('click', clearHistory);
    }

    if (openSelectedBtn) {
      openSelectedBtn.addEventListener('click', openSelectedSitesOnly);
    }

    if (chatModeSelect) {
      chatModeSelect.addEventListener('change', async () => {
        await saveSettings();
        await refreshSessionHint();
      });
    }

    siteCheckboxes.forEach(input => {
      input.addEventListener('change', async () => {
        const selected = getSelectedSites();
        if (selected.length === 0) {
          input.checked = true;
          showToast('至少保留一个目标平台', 'error');
          return;
        }

        await saveSettings();
      });
    });

    if (questionInput) {
      questionInput.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          sendToAll();
        }
      });

      questionInput.addEventListener('input', function() {
        chrome.storage.local.set({ lastQuestion: questionInput.value });
      });

      const result = await chrome.storage.local.get(['lastQuestion']);
      if (result.lastQuestion) {
        questionInput.value = result.lastQuestion;
      }
    }

    await loadSettings();
    await loadHistory();
    await refreshSessionHint();

    console.log('[初始化] AI Multi Sender 已就绪');
    showToast('AI Multi Sender 已就绪', 'info');
  });
})();
