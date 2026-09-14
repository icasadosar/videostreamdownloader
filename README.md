# VideoStreamDownloader (Chrome Extension Manifest V3)

Extensión de navegador ligera, moderna y universal diseñada para la **descarga directa de emisiones de vídeo HLS (`.m3u8`)** y vídeos MP4 en plataformas deportivas (como `isquad.tv`) y sitios web de streaming.

---

## ⚡ Características principales

1. **📥 Descarga Directa en el Navegador**:
   - Descarga y ensambla automáticamente todos los segmentos `.ts` del flujo HLS directamente desde la interfaz de la extensión sin instalar nada más.
   - **Barra de progreso en tiempo real** con el porcentaje y el contador de segmentos.
2. **🛡️ Inyección Automática de Referer Anti-401**:
   - Bypass automático de restricciones de seguridad y hotlinking en servidores CDN mediante `declarativeNetRequest`.
3. **⚡ Generador de Comandos para Consola**:
   - Copia rápida con un solo clic de comandos optimizados para **FFmpeg** y **yt-dlp**.

---

## 🚀 Guía de Instalación

1. Ve a `chrome://extensions` (o `edge://extensions` en Microsoft Edge).
2. Activa el **Modo de desarrollador** (arriba a la derecha).
3. Haz clic en **Cargar descomprimida** y selecciona la carpeta:
   ```
   /Users/ics/Repos/icasadosar/isquad-video-downloader-extension
   ```

---

## 🎬 Instrucciones de Descarga

1. Abre cualquier emisión o vídeo en el navegador y haz clic en **Play**.
2. Abre la extensión **VideoStreamDownloader**.
3. Haz clic en el botón verde **📥 Descargar Vídeo Directo (.mp4 / .ts)**.
4. El archivo se guardará automáticamente en tu carpeta de **Descargas**.
