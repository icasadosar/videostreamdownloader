// content.js - Escáner y Extracción de Fecha y Título del Partido (con envoltorio total Try-Catch)

function safeSendMessage(message) {
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
      chrome.runtime.sendMessage(message, () => {
        if (chrome.runtime.lastError) {
          // Ignorar silenciosamente si la extensión se recargó
        }
      });
    }
  } catch (e) {
    // Captura silenciosa de contexto invalidado
  }
}

function extractMatchTitleAndDate() {
  try {
    let dateText = '';
    const dateEl = document.querySelector('.date-over, .match-date, .video-date');
    if (dateEl && dateEl.textContent.trim()) {
      const rawDate = dateEl.textContent.trim();
      const matchDate = rawDate.match(/\d{2}[-/.]\d{2}[-/.]\d{4}|\d{4}[-/.]\d{2}[-/.]\d{2}/);
      if (matchDate) {
        dateText = matchDate[0].replace(/\//g, '-');
      } else if (rawDate.length <= 12) {
        dateText = rawDate;
      }
    }

    let titleText = '';
    const activeBreadcrumb = document.querySelector('.modern-breadcrumb-item.active, [aria-current="page"], .modern-breadcrumb-item:last-child');
    if (activeBreadcrumb && activeBreadcrumb.textContent.trim()) {
      titleText = activeBreadcrumb.textContent.trim();
    } else {
      const titleElements = document.querySelectorAll('.name-over, h1, h2, .match-title, .video-title');
      for (const el of titleElements) {
        const txt = el.textContent.trim();
        if (txt && txt.length > 5 && !txt.includes('Accede a todo') && !txt.includes('Suscripción')) {
          titleText = txt;
          break;
        }
      }
    }

    if (!titleText) titleText = document.title || 'partido_isquad';

    if (dateText) {
      return `${dateText} - ${titleText}`;
    }
    return titleText;
  } catch (err) {
    return document.title || 'partido_isquad';
  }
}

function scanPageMedia() {
  try {
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) return;

    const discoveredUrls = new Set();
    const fullMatchTitle = extractMatchTitleAndDate();

    if (fullMatchTitle) {
      safeSendMessage({
        action: 'SET_TAB_TITLE',
        title: fullMatchTitle
      });
    }

    const videoElements = document.querySelectorAll('video');
    videoElements.forEach((video) => {
      if (video.src && !video.src.startsWith('blob:')) {
        discoveredUrls.add(video.src);
      }
      const sources = video.querySelectorAll('source');
      sources.forEach((srcEl) => {
        if (srcEl.src) {
          discoveredUrls.add(srcEl.src);
        }
      });
    });

    const iframes = document.querySelectorAll('iframe');
    iframes.forEach((iframe) => {
      if (iframe.src && (iframe.src.includes('m3u8') || iframe.src.includes('embed') || iframe.src.includes('player'))) {
        discoveredUrls.add(iframe.src);
      }
    });

    discoveredUrls.forEach((url) => {
      safeSendMessage({
        action: 'ADD_DISCOVERED_MEDIA',
        url: url,
        pageTitle: fullMatchTitle,
        hostname: window.location.hostname
      });
    });
  } catch (e) {
    // Prevenir cualquier error no controlado si el contexto caduca
  }
}

try {
  scanPageMedia();

  const observer = new MutationObserver(() => {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
        scanPageMedia();
      }
    } catch (e) {}
  });

  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
} catch (e) {}
