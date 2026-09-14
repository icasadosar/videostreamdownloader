// background.js - Service Worker VideoStreamDownloader (Filtrado de Master Playlists)

const tabMediaStore = new Map();

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

    // Si la nueva URL es una Master Playlist:
    if (isMasterUrl(url)) {
      // Eliminar sub-playlists secundarias (como index.m3u8) que se hayan capturado antes
      for (const [storedUrl, item] of tabStore.entries()) {
        if (!isMasterUrl(storedUrl) && storedUrl.includes('.m3u8')) {
          tabStore.delete(storedUrl);
        }
      }
    } else if (url.includes('.m3u8')) {
      // Si no es master pero ya tenemos una master playlist guardada, ignorar sub-playlists secundarias
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
        mediaItem.pageTitle = tab.title;
      }
    });
  },
  { urls: ["<all_urls>"] }
);

chrome.tabs.onRemoved.addListener((tabId) => {
  tabMediaStore.delete(tabId);
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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

    // Filtrar preferentemente solo Master Playlists si existen
    const masterItems = items.filter(i => isMasterUrl(i.url));
    if (masterItems.length > 0) {
      items = masterItems;
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
});
