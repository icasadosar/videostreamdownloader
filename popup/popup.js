// popup.js - VideoStreamDownloader (Descarga persistente en segundo plano)

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
  const chkAdvanced = document.getElementById('chkAdvanced');

  let currentTabId = null;
  let activeTabTitle = 'video_stream';
  let activeTabOrigin = 'https://rfcylf.isquad.tv/';
  let isAdvancedEnabled = false;
  let pollIntervals = new Map();

  chrome.storage.local.get(['showAdvancedOptions'], (result) => {
    isAdvancedEnabled = !!result.showAdvancedOptions;
    chkAdvanced.checked = isAdvancedEnabled;
    toggleAdvancedRows(isAdvancedEnabled);
  });

  chkAdvanced.addEventListener('change', (e) => {
    isAdvancedEnabled = e.target.checked;
    chrome.storage.local.set({ showAdvancedOptions: isAdvancedEnabled });
    toggleAdvancedRows(isAdvancedEnabled);
  });

  function toggleAdvancedRows(show) {
    document.querySelectorAll('.action-row.advanced-options').forEach(el => {
      if (show) {
        el.classList.add('show');
      } else {
        el.classList.remove('show');
      }
    });
  }

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

      let items = response.items;

      const masterItems = items.filter(i => i.url.toLowerCase().includes('master') || i.url.toLowerCase().includes('playlist.m3u8'));
      if (masterItems.length > 0) {
        items = masterItems;
      }

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

      const isMaster = item.url.toLowerCase().includes('master') || item.type.includes('Master');
      const badgeStyle = isMaster ? 'background-color: #3df59e; color: #000;' : '';

      const rawTitle = item.pageTitle || activeTabTitle || 'Partido iSquad';
      const displayTitle = rawTitle.trim();
      const cleanTitleForCmd = rawTitle.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 40);

      const advancedShowClass = isAdvancedEnabled ? 'show' : '';

      card.innerHTML = `
        <div class="media-card-header">
          <span class="badge-type" style="${badgeStyle}">${escapeHtml(item.type)}</span>
          <span class="media-time">${escapeHtml(item.timestamp)}</span>
        </div>
        <div class="media-title" title="${escapeHtml(displayTitle)}">${escapeHtml(displayTitle)}</div>
        <div class="media-url" title="${escapeHtml(item.url)}">${escapeHtml(item.url)}</div>

        <!-- Descarga Directa Button -->
        <button class="btn-download-direct" id="btn_${item.id}" data-url="${escapeHtml(item.url)}" data-id="${escapeHtml(item.id)}" data-title="${escapeHtml(displayTitle)}">
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
          <div class="progress-actions">
            <button class="btn-cancel-download" id="btnCancel_${item.id}" data-id="${escapeHtml(item.id)}" title="Cancelar descarga">
              ✕ Cancelar Descarga
            </button>
          </div>
        </div>

        <!-- Comandos secundarios -->
        <div class="action-row advanced-options ${advancedShowClass}">
          <button class="btn-action btn-copy-ffmpeg" data-url="${escapeHtml(item.url)}" data-title="${escapeHtml(cleanTitleForCmd)}">
            ⚡ FFmpeg
          </button>
          <button class="btn-action btn-copy-ytdlp" data-url="${escapeHtml(item.url)}" data-title="${escapeHtml(cleanTitleForCmd)}">
            🔻 yt-dlp
          </button>
          <button class="btn-action btn-copy-url" data-url="${escapeHtml(item.url)}">
            📋 URL
          </button>
        </div>
      `;

      mediaListContainer.appendChild(card);

      // Comprobar si hay una descarga en segundo plano activa para este ítem al abrir el popup
      checkBackgroundDownloadState(item.id);
    });

    attachCardEventListeners();
  }

  function checkBackgroundDownloadState(itemId) {
    chrome.runtime.sendMessage({ action: 'GET_BACKGROUND_DOWNLOAD_STATUS', itemId: itemId }, (res) => {
      if (chrome.runtime.lastError || !res || !res.exists) return;

      const target = document.getElementById(`btn_${itemId}`);
      const progressBox = document.getElementById(`progress_${itemId}`);
      const statusText = document.getElementById(`statusText_${itemId}`);
      const percentText = document.getElementById(`percentText_${itemId}`);
      const barFill = document.getElementById(`barFill_${itemId}`);
      const btnCancel = document.getElementById(`btnCancel_${itemId}`);

      if (!target || !progressBox) return;

      progressBox.style.display = 'block';
      barFill.style.width = `${res.percent}%`;
      percentText.textContent = `${res.percent}%`;
      statusText.textContent = res.status;

      if (res.isCompleted) {
        target.innerHTML = '✅ ¡Descargado!';
        target.style.backgroundColor = '#22c55e';
        target.style.opacity = '1';
        target.disabled = true;
        if (btnCancel) btnCancel.style.display = 'none';
      } else if (res.isError) {
        target.disabled = false;
        target.style.opacity = '1';
        target.innerHTML = '⚠️ Reintentar Descarga';
        if (btnCancel) btnCancel.style.display = 'none';
      } else {
        target.disabled = true;
        target.style.opacity = '0.6';
        target.innerHTML = '⌛ Descargando en segundo plano...';
        if (btnCancel) btnCancel.style.display = 'inline-flex';
        startPollingDownloadState(itemId);
      }
    });
  }

  function startPollingDownloadState(itemId) {
    if (pollIntervals.has(itemId)) return;

    const intervalId = setInterval(() => {
      chrome.runtime.sendMessage({ action: 'GET_BACKGROUND_DOWNLOAD_STATUS', itemId: itemId }, (res) => {
        if (chrome.runtime.lastError || !res || !res.exists) {
          clearInterval(intervalId);
          pollIntervals.delete(itemId);
          return;
        }

        const target = document.getElementById(`btn_${itemId}`);
        const statusText = document.getElementById(`statusText_${itemId}`);
        const percentText = document.getElementById(`percentText_${itemId}`);
        const barFill = document.getElementById(`barFill_${itemId}`);
        const btnCancel = document.getElementById(`btnCancel_${itemId}`);

        if (barFill) barFill.style.width = `${res.percent}%`;
        if (percentText) percentText.textContent = `${res.percent}%`;
        if (statusText) statusText.textContent = res.status;

        if (res.isCompleted) {
          clearInterval(intervalId);
          pollIntervals.delete(itemId);
          if (target) {
            target.innerHTML = '✅ ¡Descargado!';
            target.style.backgroundColor = '#22c55e';
            target.style.opacity = '1';
            target.disabled = true;
          }
          if (btnCancel) btnCancel.style.display = 'none';
          showToast('¡Vídeo guardado en tus descargas!');
        } else if (res.isError) {
          clearInterval(intervalId);
          pollIntervals.delete(itemId);
          if (target) {
            target.disabled = false;
            target.style.opacity = '1';
            target.innerHTML = '⚠️ Reintentar Descarga';
          }
          if (btnCancel) btnCancel.style.display = 'none';
          showToast('Error en descarga. Activa Opciones Avanzadas para FFmpeg.');
        }
      });
    }, 500);

    pollIntervals.set(itemId, intervalId);
  }

  function cancelDownload(itemId) {
    if (pollIntervals.has(itemId)) {
      clearInterval(pollIntervals.get(itemId));
      pollIntervals.delete(itemId);
    }

    chrome.runtime.sendMessage({
      action: 'CANCEL_BACKGROUND_DOWNLOAD',
      itemId: itemId
    }, () => {
      resetDownloadCard(itemId);
      showToast('Descarga cancelada');
    });
  }

  function resetDownloadCard(itemId) {
    const target = document.getElementById(`btn_${itemId}`);
    const progressBox = document.getElementById(`progress_${itemId}`);
    const barFill = document.getElementById(`barFill_${itemId}`);
    const percentText = document.getElementById(`percentText_${itemId}`);
    const statusText = document.getElementById(`statusText_${itemId}`);

    if (progressBox) progressBox.style.display = 'none';
    if (barFill) barFill.style.width = '0%';
    if (percentText) percentText.textContent = '0%';
    if (statusText) statusText.textContent = 'Iniciando descarga...';

    if (target) {
      target.disabled = false;
      target.style.opacity = '1';
      target.style.backgroundColor = '';
      target.innerHTML = '📥 Descargar Vídeo Directo (.mp4 / .ts)';
    }
  }

  function attachCardEventListeners() {
    document.querySelectorAll('.btn-download-direct').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget;
        const url = target.getAttribute('data-url');
        const itemId = target.getAttribute('data-id');
        const matchTitle = target.getAttribute('data-title') || 'video_stream';

        const progressBox = document.getElementById(`progress_${itemId}`);
        const statusText = document.getElementById(`statusText_${itemId}`);
        const btnCancel = document.getElementById(`btnCancel_${itemId}`);

        target.disabled = true;
        target.style.opacity = '0.6';
        target.innerHTML = '⌛ Descargando en segundo plano...';
        progressBox.style.display = 'block';
        if (btnCancel) btnCancel.style.display = 'inline-flex';

        const sanitizeFilename = matchTitle
          .replace(/[\\/:*?"<>|]/g, '_')
          .trim();

        // Solicitar al Service Worker de fondo que inicie la descarga
        chrome.runtime.sendMessage({
          action: 'START_BACKGROUND_DOWNLOAD',
          itemId: itemId,
          url: url,
          filename: `${sanitizeFilename}.mp4`,
          tabId: currentTabId
        }, (res) => {
          if (chrome.runtime.lastError) {
            target.disabled = false;
            target.style.opacity = '1';
            target.innerHTML = '⚠️ Reintentar Descarga';
            statusText.textContent = 'Error al iniciar descarga en segundo plano';
            if (btnCancel) btnCancel.style.display = 'none';
            return;
          }
          startPollingDownloadState(itemId);
        });
      });
    });

    document.querySelectorAll('.btn-cancel-download').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const itemId = e.currentTarget.getAttribute('data-id');
        cancelDownload(itemId);
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
