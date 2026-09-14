// hlsDownloader.js - Módulo de descarga directa HLS compatible con Service Worker y Popup

class HlsDownloader {
  constructor(m3u8Url, filename, onProgress, onComplete, onError) {
    this.m3u8Url = m3u8Url;
    this.filename = filename || 'partido_isquad.ts';
    this.onProgress = onProgress || (() => {});
    this.onComplete = onComplete || (() => {});
    this.onError = onError || (() => {});
    this.isCancelled = false;
  }

  async start() {
    try {
      this.onProgress(0, 'Conectando con el servidor HLS...');

      const response = await fetch(this.m3u8Url, {
        method: 'GET',
        credentials: 'omit',
        mode: 'cors'
      });

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}`);
      }
      
      const playlistText = await response.text();

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
          this.onProgress(5, 'Cargando flujo de alta definición...');
          const subRes = await fetch(subPlaylistUrl, { method: 'GET', mode: 'cors' });
          if (!subRes.ok) throw new Error(`HTTP Error ${subRes.status}`);
          const subText = await subRes.text();
          return await this.downloadSegments(subText, subPlaylistUrl);
        }
      }

      return await this.downloadSegments(playlistText, this.m3u8Url);
    } catch (err) {
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
        const res = await fetch(url, { method: 'GET', mode: 'cors' });
        if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
        return await res.arrayBuffer();
      });

      const results = await Promise.all(batchPromises);
      for (const buffer of results) {
        chunks.push(new Uint8Array(buffer));
      }

      completed += batch.length;
      const percent = Math.min(99, Math.round((completed / total) * 100));
      this.onProgress(percent, `Descargando fragmento ${completed} de ${total} (${percent}%)`);
    }

    this.onProgress(99, 'Ensamblando archivo de vídeo...');
    const blob = new Blob(chunks, { type: 'video/mp2t' });
    
    // Crear data URL / Blob en Service Worker o llamar a API de descargas
    if (typeof FileReader !== 'undefined') {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result;
        chrome.downloads.download({
          url: dataUrl,
          filename: this.filename.endsWith('.mp4') || this.filename.endsWith('.ts') ? this.filename : `${this.filename}.mp4`,
          saveAs: false
        }, () => {
          this.onProgress(100, '¡Descarga completada!');
          this.onComplete();
        });
      };
      reader.readAsDataURL(blob);
    } else {
      // Fallback
      const blobUrl = URL.createObjectURL(blob);
      chrome.downloads.download({
        url: blobUrl,
        filename: this.filename.endsWith('.mp4') || this.filename.endsWith('.ts') ? this.filename : `${this.filename}.mp4`,
        saveAs: false
      }, () => {
        this.onProgress(100, '¡Descarga completada!');
        this.onComplete();
      });
    }
  }

  cancel() {
    this.isCancelled = true;
  }
}

if (typeof self !== 'undefined') {
  self.HlsDownloader = HlsDownloader;
}
if (typeof window !== 'undefined') {
  window.HlsDownloader = HlsDownloader;
}
