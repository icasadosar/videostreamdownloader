// content.js - Content Script para escanear elementos multimedia en la página web

function scanPageMedia() {
  const discoveredUrls = new Set();

  // 1. Escanear elementos <video> y <source>
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

  // 2. Escanear iframes
  const iframes = document.querySelectorAll('iframe');
  iframes.forEach((iframe) => {
    if (iframe.src && (iframe.src.includes('m3u8') || iframe.src.includes('embed') || iframe.src.includes('player'))) {
      discoveredUrls.add(iframe.src);
    }
  });

  // Enviar hallazgos al background script
  discoveredUrls.forEach((url) => {
    chrome.runtime.sendMessage({
      action: 'ADD_DISCOVERED_MEDIA',
      url: url,
      pageTitle: document.title,
      hostname: window.location.hostname
    });
  });
}

// Ejecutar escaneo al cargar la página
scanPageMedia();

// Re-escaneo periódico para reproductores cargados dinámicamente mediante SPA / AJAX
const observer = new MutationObserver(() => {
  scanPageMedia();
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});
