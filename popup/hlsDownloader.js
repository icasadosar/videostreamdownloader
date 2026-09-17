// hlsDownloader.js - Módulo de descarga directa HLS compatible con Service Worker y Popup

class HlsDownloader {
  constructor(m3u8Url, filename, onProgress, onComplete, onError) {
    this.m3u8Url = m3u8Url;
    this.filename = filename || 'partido_isquad.ts';
    this.onProgress = onProgress || (() => {});
    this.onComplete = onComplete || (() => {});
    this.onError = onError || (() => {});
    this.isCancelled = false;
    this.abortController = new AbortController();
  }

  async start() {
    try {
      if (this.isCancelled) return;
      this.onProgress(0, 'Conectando con el servidor HLS...');

      const response = await fetch(this.m3u8Url, {
        method: 'GET',
        credentials: 'omit',
        mode: 'cors',
        signal: this.abortController ? this.abortController.signal : undefined
      });

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}`);
      }
      
      const playlistText = await response.text();
      if (this.isCancelled) return;

      if (playlistText.includes('#EXT-X-STREAM-INF')) {
        const lines = playlistText.split('\n');
        let subPlaylistUrl = null;
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line && !line.startsWith('#')) {
            subPlaylistUrl = new URL(line, this.m3u8Url).href;
            break;
          }
        }
        if (subPlaylistUrl) {
          if (this.isCancelled) return;
          this.onProgress(5, 'Cargando flujo de alta definición...');
          const subRes = await fetch(subPlaylistUrl, {
            method: 'GET',
            mode: 'cors',
            signal: this.abortController ? this.abortController.signal : undefined
          });
          if (!subRes.ok) throw new Error(`HTTP Error ${subRes.status}`);
          const subText = await subRes.text();
          if (this.isCancelled) return;
          return await this.downloadSegments(subText, subPlaylistUrl);
        }
      }

      return await this.downloadSegments(playlistText, this.m3u8Url);
    } catch (err) {
      if (this.isCancelled || (err && err.name === 'AbortError')) {
        return;
      }
      this.onError(err.message || 'Error al descargar la transmisión.');
    }
  }

  async downloadSegments(playlistText, baseUrl) {
    const lines = playlistText.split('\n');
    const segmentUrls = [];

    for (let line of lines) {
      line = line.trim();
      if (line && !line.startsWith('#')) {
        const fullSegmentUrl = new URL(line, baseUrl).href;
        segmentUrls.push(fullSegmentUrl);
      }
    }

    if (segmentUrls.length === 0) {
      throw new Error('No se encontraron segmentos de vídeo (.ts) en el manifiesto.');
    }

    const total = segmentUrls.length;
    const chunks = [];

    const concurrency = 4;
    let completed = 0;

    for (let i = 0; i < total; i += concurrency) {
      if (this.isCancelled) return;

      const batch = segmentUrls.slice(i, i + concurrency);
      const batchPromises = batch.map(async (url) => {
        const res = await fetch(url, {
          method: 'GET',
          mode: 'cors',
          signal: this.abortController ? this.abortController.signal : undefined
        });
        if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
        return await res.arrayBuffer();
      });

      const results = await Promise.all(batchPromises);
      if (this.isCancelled) return;

      for (const buffer of results) {
        chunks.push(new Uint8Array(buffer));
      }

      completed += batch.length;
      const percent = Math.min(99, Math.round((completed / total) * 100));
      this.onProgress(percent, `Descargando fragmento ${completed} de ${total} (${percent}%)`);
    }

    if (this.isCancelled) return;

    this.onProgress(99, 'Ensamblando archivo de vídeo...');
    const blob = new Blob(chunks, { type: 'video/mp2t' });

    if (this.isCancelled) return;
    
    // Generar Blob URL mediante Offscreen (Service Worker) o URL.createObjectURL (DOM)
    try {
      let blobUrl = null;
      if (typeof window !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        blobUrl = URL.createObjectURL(blob);
      } else {
        blobUrl = await this.createBlobUrlViaOffscreen(blob);
      }

      if (this.isCancelled || !blobUrl) return;

      const finalFilename = this.filename.endsWith('.mp4') || this.filename.endsWith('.ts') ? this.filename : `${this.filename}.mp4`;

      chrome.downloads.download({
        url: blobUrl,
        filename: finalFilename,
        saveAs: false
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          this.onError(`Error al guardar archivo: ${chrome.runtime.lastError.message}`);
          return;
        }
        this.chromeDownloadId = downloadId;
        if (this.isCancelled) {
          if (downloadId) {
            try { chrome.downloads.cancel(downloadId); } catch (e) {}
          }
          return;
        }
        this.onProgress(100, '¡Descarga completada!');
        this.onComplete();
      });
    } catch (err) {
      if (this.isCancelled) return;
      this.onError(`Error al ensamblar el vídeo: ${err.message || err}`);
    }
  }

  async createBlobUrlViaOffscreen(blob) {
    const offscreenUrl = chrome.runtime.getURL('offscreen/offscreen.html');

    let hasDoc = false;
    if (chrome.runtime.getContexts) {
      try {
        const contexts = await chrome.runtime.getContexts({
          contextTypes: ['OFFSCREEN_DOCUMENT'],
          documentUrls: [offscreenUrl]
        });
        hasDoc = contexts && contexts.length > 0;
      } catch (e) {}
    }

    if (!hasDoc) {
      try {
        await chrome.offscreen.createDocument({
          url: 'offscreen/offscreen.html',
          reasons: ['BLOBS'],
          justification: 'Generar URL de Blob para descargar el vídeo ensamblado'
        });
      } catch (e) {
        // Ignorar si ya existía
      }
    }

    let offscreenClient = null;
    if (typeof self !== 'undefined' && self.clients && self.clients.matchAll) {
      for (let i = 0; i < 15; i++) {
        const matched = await self.clients.matchAll({ includeUncontrolled: true });
        offscreenClient = matched.find(c => c.url && c.url.includes('offscreen.html'));
        if (offscreenClient) break;
        await new Promise(r => setTimeout(r, 100));
      }
    }

    if (!offscreenClient) {
      throw new Error('No se pudo comunicar con el entorno offscreen para procesar el vídeo');
    }

    return new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = (event) => {
        if (event.data && event.data.success && event.data.url) {
          resolve(event.data.url);
        } else {
          reject(new Error(event.data && event.data.error ? event.data.error : 'Fallo al obtener Blob URL desde offscreen'));
        }
      };

      offscreenClient.postMessage(blob, [channel.port2]);
    });
  }

  cancel() {
    this.isCancelled = true;
    try {
      if (this.abortController) {
        this.abortController.abort();
      }
    } catch (e) {}
    try {
      if (this.fileReader) {
        this.fileReader.abort();
      }
    } catch (e) {}
    if (this.chromeDownloadId) {
      try {
        chrome.downloads.cancel(this.chromeDownloadId);
      } catch (e) {}
    }
  }
}

if (typeof self !== 'undefined') {
  self.HlsDownloader = HlsDownloader;
}
if (typeof window !== 'undefined') {
  window.HlsDownloader = HlsDownloader;
}
