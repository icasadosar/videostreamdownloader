// background.js - Service Worker VideoStreamDownloader (Motor de descarga en segundo plano)

importScripts('popup/hlsDownloader.js');

const tabMediaStore = new Map();
const activeDownloads = new Map(); // downloadId -> { url, filename, percent, status, isCompleted, isError, errorMsg, downloader }

async function setupRefererRules() {
  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [1001],
      addRules: [
        {
          id: 1001,
          priority: 1,
          action: {
            type: 'modifyHeaders',
            requestHeaders: [
              { header: 'Referer', operation: 'set', value: 'https://rfcylf.isquad.tv/' },
              { header: 'Origin', operation: 'set', value: 'https://rfcylf.isquad.tv' }
            ]
          },
          condition: {
            requestDomains: ['cdn.myautomatic.tv', 'myautomatic.tv', 'isquad.tv'],
            resourceTypes: ['xmlhttprequest', 'media', 'other', 'websocket']
          }
        }
      ]
    });
  } catch (e) {
    console.error('Error al configurar reglas de Referer:', e);
  }
}

setupRefererRules();

function isMediaUrl(url) {
  if (!url || typeof url !== 'string') return false;
  
  if (url.match(/\.(png|jpg|jpeg|gif|svg|ico|css|js|woff|woff2|ttf|eot)(\?.*)?$/i)) {
    return false;
  }

  const lowerUrl = url.toLowerCase();

  if (lowerUrl.includes('.m3u8') || lowerUrl.includes('.mpd') || lowerUrl.includes('.mp4')) {
    return true;
  }

  return false;
}

function getMediaTypeLabel(url) {
  const lower = url.toLowerCase();
  if (lower.includes('master')) return '⭐ HLS Master Playlist';
  if (lower.includes('.m3u8')) return 'HLS Stream (.m3u8)';
  if (lower.includes('.mpd')) return 'DASH (.mpd)';
  if (lower.includes('.mp4')) return 'Vídeo MP4';
  return 'Stream de Vídeo';
}

function isMasterUrl(url) {
  const lower = url.toLowerCase();
  return lower.includes('master') || lower.includes('playlist.m3u8');
}

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.tabId < 0) return;
    const url = details.url;

    if (!isMediaUrl(url)) return;

    if (!tabMediaStore.has(details.tabId)) {
      tabMediaStore.set(details.tabId, new Map());
    }

    const tabStore = tabMediaStore.get(details.tabId);

    if (isMasterUrl(url)) {
      for (const [storedUrl] of tabStore.entries()) {
        if (storedUrl.includes('.m3u8')) {
          tabStore.delete(storedUrl);
        }
      }
    } else if (url.includes('.m3u8')) {
      const hasMaster = Array.from(tabStore.keys()).some(u => isMasterUrl(u));
      if (hasMaster) {
        return;
      }
    }

    if (tabStore.has(url)) return;

    let hostname = 'stream';
    try {
      hostname = new URL(url).hostname;
    } catch (e) {}

    const mediaItem = {
      id: 'media_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      url: url,
      type: getMediaTypeLabel(url),
      pageTitle: 'Vídeo Detectado',
      hostname: hostname,
      timestamp: new Date().toLocaleTimeString(),
      tabId: details.tabId
    };

    tabStore.set(url, mediaItem);

    const count = tabStore.size;
    chrome.action.setBadgeText({ tabId: details.tabId, text: String(count) });
    chrome.action.setBadgeBackgroundColor({ tabId: details.tabId, color: '#3df59e' });
    chrome.action.setBadgeTextColor({ tabId: details.tabId, color: '#000000' });

    chrome.tabs.get(details.tabId, (tab) => {
      if (!chrome.runtime.lastError && tab && tab.title) {
        if (mediaItem.pageTitle === 'Vídeo Detectado') {
          mediaItem.pageTitle = tab.title;
        }
      }
    });
  },
  { urls: ["<all_urls>"] }
);

chrome.tabs.onRemoved.addListener((tabId) => {
  tabMediaStore.delete(tabId);
});

// Mensajería y control de descargas en segundo plano
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'SET_TAB_TITLE') {
    const tabId = sender.tab ? sender.tab.id : request.tabId;
    if (tabId && tabMediaStore.has(tabId) && request.title) {
      const tabStore = tabMediaStore.get(tabId);
      for (const item of tabStore.values()) {
        item.pageTitle = request.title;
      }
    }
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'GET_MEDIA_ITEMS') {
    const tabId = request.tabId;
    const tabMap = tabMediaStore.get(tabId);
    
    let items = [];
    if (tabMap && tabMap.size > 0) {
      items = Array.from(tabMap.values());
    } else {
      for (const [tId, map] of tabMediaStore.entries()) {
        if (map.size > 0) {
          items = Array.from(map.values());
          break;
        }
      }
    }

    const masterItems = items.filter(i => isMasterUrl(i.url));
    if (masterItems.length > 0) {
      items = [masterItems[masterItems.length - 1]];
    }

    sendResponse({ items: items });
    return true;
  }

  if (request.action === 'CLEAR_MEDIA_ITEMS') {
    const tabId = request.tabId;
    tabMediaStore.delete(tabId);
    chrome.action.setBadgeText({ tabId: tabId, text: '' });
    sendResponse({ success: true });
    return true;
  }

  // --- MOTOR DE DESCARGA EN SEGUNDO PLANO ---
  if (request.action === 'START_BACKGROUND_DOWNLOAD') {
    const { itemId, url, filename, tabId } = request;

    if (activeDownloads.has(itemId)) {
      sendResponse({ status: 'already_running' });
      return true;
    }

    const downloadState = {
      itemId: itemId,
      url: url,
      filename: filename,
      percent: 0,
      status: 'Conectando con el servidor HLS...',
      isCompleted: false,
      isError: false,
      errorMsg: '',
      tabId: tabId
    };

    const downloader = new self.HlsDownloader(
      url,
      filename,
      (percent, message) => {
        downloadState.percent = percent;
        downloadState.status = message;

        // Actualizar el badge en la barra del navegador para mostrar porcentaje de descarga
        if (tabId) {
          chrome.action.setBadgeText({ tabId: tabId, text: `${percent}%` });
          chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: '#3df59e' });
          chrome.action.setBadgeTextColor({ tabId: tabId, color: '#000000' });
        }
      },
      () => {
        downloadState.isCompleted = true;
        downloadState.percent = 100;
        downloadState.status = '¡Descarga completada!';

        if (tabId) {
          chrome.action.setBadgeText({ tabId: tabId, text: '✅' });
        }
      },
      (errorMsg) => {
        downloadState.isError = true;
        downloadState.errorMsg = errorMsg;
        downloadState.status = `Error: ${errorMsg}`;

        if (tabId) {
          chrome.action.setBadgeText({ tabId: tabId, text: '⚠️' });
        }
      }
    );

    downloadState.downloader = downloader;
    activeDownloads.set(itemId, downloadState);

    downloader.start();
    sendResponse({ status: 'started' });
    return true;
  }

  if (request.action === 'GET_BACKGROUND_DOWNLOAD_STATUS') {
    const { itemId } = request;
    const downloadState = activeDownloads.get(itemId);

    if (downloadState) {
      sendResponse({
        exists: true,
        percent: downloadState.percent,
        status: downloadState.status,
        isCompleted: downloadState.isCompleted,
        isError: downloadState.isError,
        errorMsg: downloadState.errorMsg
      });
    } else {
      sendResponse({ exists: false });
    }
    return true;
  }

  if (request.action === 'CANCEL_BACKGROUND_DOWNLOAD') {
    const { itemId } = request;
    const downloadState = activeDownloads.get(itemId);

    if (downloadState) {
      if (downloadState.downloader) {
        downloadState.downloader.cancel();
      }
      const tabId = downloadState.tabId;
      activeDownloads.delete(itemId);

      if (tabId) {
        const tabMap = tabMediaStore.get(tabId);
        const count = tabMap ? tabMap.size : 0;
        chrome.action.setBadgeText({ tabId: tabId, text: count > 0 ? String(count) : '' });
        chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: '#3df59e' });
        chrome.action.setBadgeTextColor({ tabId: tabId, color: '#000000' });
      }
    }

    sendResponse({ success: true, cancelled: true });
    return true;
  }
});
