// Echo-X Background Service Worker

// 点击扩展图标时打开侧边栏
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.windowId) {
    await chrome.sidePanel.open({ windowId: tab.windowId });
  }
});

// 初始化默认设置
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    apiModel: 'kimi-2.5-coding'
  });
  console.log('[Echo-X] Extension installed');
});
