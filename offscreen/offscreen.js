// offscreen.js - Generador de Blob URLs para descargas grandes en Manifest V3

function handleIncomingBlob(event) {
  try {
    const blob = event.data;
    if (blob instanceof Blob) {
      const blobUrl = URL.createObjectURL(blob);
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: true, url: blobUrl });
      }

      // Revocar la URL tras 5 minutos para liberar memoria
      setTimeout(() => {
        try {
          URL.revokeObjectURL(blobUrl);
        } catch (e) {}
      }, 300000);
    } else {
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: false, error: 'El objeto recibido no es un Blob válido' });
      }
    }
  } catch (err) {
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ success: false, error: err.message || 'Error al generar Blob URL' });
    }
  }
}

if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
  navigator.serviceWorker.addEventListener('message', handleIncomingBlob);
}

window.addEventListener('message', handleIncomingBlob);
