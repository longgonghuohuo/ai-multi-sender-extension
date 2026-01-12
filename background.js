// Background Service Worker
// 点击插件图标时打开全屏页面

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({
    url: chrome.runtime.getURL('simple.html')
  });
});
