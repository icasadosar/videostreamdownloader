// content.js - Escáner y Extracción del Título del Partido (Breadcrumbs & DOM)

function extractMatchTitle() {
  // 1. Selector prioritario: <li class="modern-breadcrumb-item active" aria-current="page">
  const activeBreadcrumb = document.querySelector('.modern-breadcrumb-item.active, [aria-current="page"], .modern-breadcrumb-item:last-child');
  if (activeBreadcrumb && activeBreadcrumb.textContent.trim()) {
    return activeBreadcrumb.textContent.trim();
  }

  // 2. Selectores secundarios de encabezados de partido
  const titleElements = document.querySelectorAll('h1, h2, .match-title, .video-title, .title');
  for (const el of titleElements) {
    const txt = el.textContent.trim();
    if (txt && txt.length > 5 && !txt.includes('Accede a todo') && !txt.includes('Suscripción')) {
      return txt;
    }
  }

  return document.title || 'partido_isquad';
}

function scanPageMedia() {
  const discoveredUrls = new Set();
  const matchTitle = extractMatchTitle();

  // Enviar el título extraído del partido al background script
  if (matchTitle) {
    chrome.runtime.sendMessage({
      action: 'SET_TAB_TITLE',
      title: matchTitle
    });
  }

  // Escanear elementos <video> y <source>
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

  // Escanear iframes
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
      pageTitle: matchTitle,
      hostname: window.location.hostname
    });
  });
}

// Ejecutar escaneo al cargar la página
scanPageMedia();

// Re-escaneo periódico ante cambios dinámicos en la SPA / DOM
const observer = new MutationObserver(() => {
  scanPageMedia();
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});
