// content.js - Escáner y Extracción de Fecha y Título del Partido

function extractMatchTitleAndDate() {
  // 1. Extraer fecha desde el elemento <div class="date-over">
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

  // 2. Extraer el título del partido (prioridad en .modern-breadcrumb-item.active)
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

  // 3. Combinar Fecha + Título (Ejemplo: "14-09-2026 - U.D. Santa Marta vs U.D. Santa Marta")
  if (dateText) {
    return `${dateText} - ${titleText}`;
  }
  return titleText;
}

function scanPageMedia() {
  const discoveredUrls = new Set();
  const fullMatchTitle = extractMatchTitleAndDate();

  if (fullMatchTitle) {
    chrome.runtime.sendMessage({
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
    chrome.runtime.sendMessage({
      action: 'ADD_DISCOVERED_MEDIA',
      url: url,
      pageTitle: fullMatchTitle,
      hostname: window.location.hostname
    });
  });
}

scanPageMedia();

const observer = new MutationObserver(() => {
  scanPageMedia();
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});
