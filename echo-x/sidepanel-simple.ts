// 简化版 sidepanel - 用于调试

console.log('[Echo-X-Simple] Script loaded');

// 立即更新调试面板
try {
  const debugUrl = document.getElementById('debugUrl');
  if (debugUrl) {
    debugUrl.textContent = '简化版 JS 已加载';
  }
  console.log('[Echo-X-Simple] Debug panel updated');
} catch (e) {
  console.error('[Echo-X-Simple] Failed to update debug:', e);
}

// 检查 Chrome API
try {
  console.log('[Echo-X-Simple] Checking Chrome API...');
  console.log('chrome.runtime:', typeof chrome?.runtime);
  console.log('chrome.tabs:', typeof chrome?.tabs);
  console.log('chrome.storage:', typeof chrome?.storage);
  
  const debugStatus = document.getElementById('debugStatus');
  if (debugStatus) {
    debugStatus.textContent = 'Chrome API: runtime=' + typeof chrome?.runtime + 
                              ' tabs=' + typeof chrome?.tabs;
  }
} catch (e) {
  console.error('[Echo-X-Simple] Chrome API check failed:', e);
}

// 绑定刷新按钮
try {
  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      console.log('[Echo-X-Simple] Refresh clicked');
      const debugUrl = document.getElementById('debugUrl');
      if (debugUrl) debugUrl.textContent = '刷新中...';
      
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const debugStatus = document.getElementById('debugStatus');
        if (debugStatus) {
          debugStatus.textContent = '当前标签: ' + (tab?.url || 'null');
        }
        
        if (tab?.id) {
          try {
            const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_CURRENT_POST' });
            const debugError = document.getElementById('debugError');
            if (debugError) {
              debugError.textContent = '响应: ' + JSON.stringify(response).substring(0, 100);
            }
          } catch (sendErr) {
            const debugError = document.getElementById('debugError');
            if (debugError) {
              debugError.textContent = '发送失败: ' + (sendErr as Error).message;
            }
          }
        }
      } catch (e) {
        const debugError = document.getElementById('debugError');
        if (debugError) {
          debugError.textContent = '查询失败: ' + (e as Error).message;
        }
      }
    });
    console.log('[Echo-X-Simple] Refresh button bound');
  }
} catch (e) {
  console.error('[Echo-X-Simple] Failed to bind refresh:', e);
}

// 绑定强制注入按钮
try {
  const forceInjectBtn = document.getElementById('forceInjectBtn');
  if (forceInjectBtn) {
    forceInjectBtn.addEventListener('click', async () => {
      console.log('[Echo-X-Simple] Force inject clicked');
      const debugUrl = document.getElementById('debugUrl');
      if (debugUrl) debugUrl.textContent = '注入中...';
      
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          });
          if (debugUrl) debugUrl.textContent = '注入成功!';
        }
      } catch (e) {
        const debugError = document.getElementById('debugError');
        if (debugError) {
          debugError.textContent = '注入失败: ' + (e as Error).message;
        }
      }
    });
    console.log('[Echo-X-Simple] Force inject button bound');
  }
} catch (e) {
  console.error('[Echo-X-Simple] Failed to bind force inject:', e);
}

console.log('[Echo-X-Simple] Setup complete');
