// popup.js - VideoStreamDownloader

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

document.addEventListener('DOMContentLoaded', () => {
  const mediaListContainer = document.getElementById('mediaList');
  const emptyState = document.getElementById('emptyState');
  const tabDomainSpan = document.getElementById('tabDomain');
  const btnClear = document.getElementById('btnClear');
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');

  let currentTabId = null;
  let activeTabTitle = 'video_stream';
  let activeTabOrigin = 'https://rfcylf.isquad.tv/';

  chrome.tabs.query({ active: true }, (tabs) => {
    let targetTab = null;
    if (tabs && tabs.length > 0) {
      targetTab = tabs.find(t => t.url && (t.url.startsWith('http://') || t.url.startsWith('https://'))) || tabs[0];
    }

    if (targetTab) {
      currentTabId = targetTab.id;
      activeTabTitle = targetTab.title || 'video_stream';

      try {
        const urlObj = new URL(targetTab.url);
        tabDomainSpan.textContent = `${urlObj.hostname}`;
        activeTabOrigin = urlObj.origin + '/';
      } catch (e) {
        tabDomainSpan.textContent = targetTab.title || 'Pestaña Actual';
      }
    }

    loadMediaItems(currentTabId);
  });

  function loadMediaItems(tabId) {
    chrome.runtime.sendMessage({ action: 'GET_MEDIA_ITEMS', tabId: tabId }, (response) => {
      if (chrome.runtime.lastError || !response || !response.items) {
        showEmptyState();
        return;
      }

      const items = response.items;
      if (!items || items.length === 0) {
        showEmptyState();
      } else {
        renderMediaItems(items);
      }
    });
  }

  function showEmptyState() {
    emptyState.style.display = 'flex';
    mediaListContainer.style.display = 'none';
  }

  function renderMediaItems(items) {
    emptyState.style.display = 'none';
    mediaListContainer.style.display = 'flex';
    mediaListContainer.innerHTML = '';

    items.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'media-card';
      card.id = `card_${item.id}`;

      const isMaster = item.url.includes('master');
      const badgeStyle = isMaster ? 'background-color: #3df59e; color: #000;' : '';

      const titleClean = (item.pageTitle || activeTabTitle).replace(/[^a-zA-Z0-9\sáéíóúÁÉÍÓÚñÑ_-]/g, '').trim();

      card.innerHTML = `
        <div class="media-card-header">
          <span class="badge-type" style="${badgeStyle}">${escapeHtml(item.type)}</span>
          <span class="media-time">${escapeHtml(item.timestamp)}</span>
        </div>
        <div class="media-title" title="${escapeHtml(titleClean)}">${escapeHtml(titleClean || 'Vídeo Detectado')}</div>
        <div class="media-url" title="${escapeHtml(item.url)}">${escapeHtml(item.url)}</div>

        <!-- Descarga Directa Button -->
        <button class="btn-download-direct" data-url="${escapeHtml(item.url)}" data-id="${escapeHtml(item.id)}">
          📥 Descargar Vídeo Directo (.mp4 / .ts)
        </button>

        <!-- Progress Box -->
        <div class="progress-box" id="progress_${item.id}" style="display: none;">
          <div class="progress-info">
            <span class="progress-status-text" id="statusText_${item.id}">Iniciando descarga...</span>
            <span class="progress-status-text" id="percentText_${item.id}">0%</span>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" id="barFill_${item.id}"></div>
          </div>
        </div>

        <!-- Comandos secundarios con --referer -->
        <div class="action-row" style="margin-top: 8px;">
          <button class="btn-action btn-copy-ffmpeg" data-url="${escapeHtml(item.url)}" data-title="${escapeHtml(titleClean)}">
            ⚡ FFmpeg
          </button>
          <button class="btn-action btn-copy-ytdlp" data-url="${escapeHtml(item.url)}" data-title="${escapeHtml(titleClean)}">
            🔻 yt-dlp
          </button>
          <button class="btn-action btn-copy-url" data-url="${escapeHtml(item.url)}">
            📋 URL
          </button>
        </div>
      `;

      mediaListContainer.appendChild(card);
    });

    attachCardEventListeners();
  }

  function attachCardEventListeners() {
    document.querySelectorAll('.btn-download-direct').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget;
        const url = target.getAttribute('data-url');
        const itemId = target.getAttribute('data-id');

        const progressBox = document.getElementById(`progress_${itemId}`);
        const statusText = document.getElementById(`statusText_${itemId}`);
        const percentText = document.getElementById(`percentText_${itemId}`);
        const barFill = document.getElementById(`barFill_${itemId}`);

        target.disabled = true;
        target.style.opacity = '0.6';
        target.innerHTML = '⌛ Descargando...';
        progressBox.style.display = 'block';

        const sanitizeFilename = (activeTabTitle || 'video_stream')
          .replace(/[^a-zA-Z0-9_-]/g, '_')
          .substring(0, 40);

        const downloader = new window.HlsDownloader(
          url,
          `${sanitizeFilename}.mp4`,
          (percent, message) => {
            barFill.style.width = `${percent}%`;
            percentText.textContent = `${percent}%`;
            statusText.textContent = message;
          },
          () => {
            target.innerHTML = '✅ ¡Descargado!';
            target.style.backgroundColor = '#22c55e';
            target.style.opacity = '1';
            showToast('¡Vídeo guardado en tus descargas!');
          },
          (errorMsg) => {
            target.disabled = false;
            target.style.opacity = '1';
            target.innerHTML = '⚠️ Reintentar Descarga';
            statusText.textContent = `Error: ${errorMsg}`;
            showToast('Error en descarga directa. Prueba con la opción FFmpeg.');
          }
        );

        downloader.start();
      });
    });

    document.querySelectorAll('.btn-copy-ffmpeg').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const url = e.currentTarget.getAttribute('data-url');
        const rawTitle = e.currentTarget.getAttribute('data-title') || 'video_stream';
        const cleanTitle = rawTitle.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 35);
        const ffmpegCmd = `ffmpeg -headers "Referer: ${activeTabOrigin}" -i "${url}" -c copy "${cleanTitle}.mp4"`;
        copyToClipboard(ffmpegCmd, '¡Comando FFmpeg con Referer copiado!');
      });
    });

    document.querySelectorAll('.btn-copy-ytdlp').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const url = e.currentTarget.getAttribute('data-url');
        const rawTitle = e.currentTarget.getAttribute('data-title') || 'video_stream';
        const cleanTitle = rawTitle.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 35);
        const ytdlpCmd = `yt-dlp --referer "${activeTabOrigin}" "${url}" -o "${cleanTitle}.mp4"`;
        copyToClipboard(ytdlpCmd, '¡Comando yt-dlp copiado!');
      });
    });

    document.querySelectorAll('.btn-copy-url').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const url = e.currentTarget.getAttribute('data-url');
        copyToClipboard(url, '¡URL copiada al portapapeles!');
      });
    });
  }

  function copyToClipboard(text, message) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(message);
    }).catch(() => {
      showToast('Error al copiar al portapapeles');
    });
  }

  function showToast(message) {
    toastMsg.textContent = message;
    toast.style.display = 'block';
    setTimeout(() => {
      toast.style.display = 'none';
    }, 2500);
  }

  btnClear.addEventListener('click', () => {
    if (!currentTabId) return;
    chrome.runtime.sendMessage({ action: 'CLEAR_MEDIA_ITEMS', tabId: currentTabId }, () => {
      showEmptyState();
      showToast('Lista limpiada');
    });
  });
});
