# 🎥 VideoStreamDownloader

> Extensión de navegador web (Manifest V3) rápida, moderna y ligera para la **detección y descarga directa de emisiones de vídeo HLS (`.m3u8`)** y vídeos MP4 en plataformas deportivas (como `isquad.tv`) y portales de streaming en directo o bajo demanda.

![Versión](https://img.shields.io/badge/versión-1.2.0-3df59e?style=flat-square)
![Manifest](https://img.shields.io/badge/Chrome_Extension-Manifest_V3-blue?style=flat-square)
![Compatibilidad](https://img.shields.io/badge/compatibilidad-Chrome_%7C_Edge_%7C_Brave_%7C_Opera-green?style=flat-square)
![Licencia](https://img.shields.io/badge/licencia-MIT-orange?style=flat-square)

---

## 📋 Tabla de Contenidos

1. [¿Por qué VideoStreamDownloader?](#-por-qué-videostreamdownloader)
2. [Características Principales](#-características-principales)
3. [Guía de Instalación Rápida](#-guía-de-instalación-rápida)
4. [Manual de Usuario (Paso a Paso)](#-manual-de-usuario-paso-a-paso)
5. [Opciones Avanzadas (FFmpeg y yt-dlp)](#-opciones-avanzadas-ffmpeg-y-yt-dlp)
6. [Preguntas Frecuentes y Solución de Problemas](#-preguntas-frecuentes-y-solución-de-problemas)
7. [Arquitectura del Proyecto](#-arquitectura-del-proyecto)
8. [Privacidad y Seguridad](#-privacidad-y-seguridad)

---

## 💡 ¿Por qué VideoStreamDownloader?

Muchos portales de emisión en directo o retransmisiones deportivas sirven los contenidos mediante protocolos HLS fragmentados en decenas o cientos de archivos `.ts`. Además, suelen aplicar protecciones de enlace como la validación de cabeceras `Referer` y `Origin` (HTTP 401/403).

**VideoStreamDownloader** soluciona esto automáticamente:
- Captura la emisión de mayor calidad.
- Ensambla todos los fragmentos en un único archivo de vídeo `.mp4`.
- Ejecuta todo el proceso en segundo plano en el navegador, sin necesidad de mantener abierta la ventana emergente de la extensión ni instalar programas adicionales.

---

## ✨ Características Principales

- **📥 Descarga Directa en 1 Clic**: Descarga y concatena automáticamente los segmentos HLS directamente en tu carpeta de descargas del navegador.
- **🔄 Motor Persistente en Segundo Plano**: La descarga continúa sin interrupción aunque cambies de pestaña, minimices el navegador o cierres el menú de la extensión.
- **🛑 Cancelación Inmediata**: Botón para abortar la descarga en curso en cualquier instante, liberando memoria y cancelando las peticiones de red activas.
- **🏷️ Detección Inteligente y Limpia**:
  - Filtra archivos estáticos irrelevantes (imágenes, fuentes, estilos).
  - Prioriza automáticamente el **Master Playlist** con la mejor resolución disponible.
  - Mantiene siempre activo el token de sesión más reciente.
- **📛 Nombres de Archivo Automáticos**: Extrae el nombre del partido/evento y la fecha directamente del contenido de la página para que tus descargas queden perfectamente identificadas (por ejemplo: `2026-09-15_EquipoA_vs_EquipoB.mp4`).
- **🛡️ Inyección Automática de Referer**: Supera los bloqueos por hotlinking y errores HTTP 401 mediante reglas dinámicas seguras con la API `declarativeNetRequest`.
- **⚡ Generador de Comandos Avanzados**: Interruptor deslizante para copiar comandos listos para ejecutar en consola con **FFmpeg** o **yt-dlp**.

---

## 🚀 Guía de Instalación Rápida

La extensión es compatible con cualquier navegador basado en Chromium (**Google Chrome**, **Microsoft Edge**, **Brave**, **Opera**, **Vivaldi**, etc.).

### Paso 1: Descargar la extensión

<p align="left">
  <a href="https://github.com/icasadosar/videostreamdownloader/releases/latest">
    <img src="https://img.shields.io/badge/📥_Descargar_Última_Versión-(.zip)-3df59e?style=for-the-badge&logo=github" alt="Descargar última versión" />
  </a>
</p>

- **Opción A (Recomendada para usuarios):**
  1. Haz clic en el botón superior o entra en [Última Release](https://github.com/icasadosar/videostreamdownloader/releases/latest) y descarga el archivo `videostreamdownloader-vX.X.X.zip`.
  2. Descomprime el archivo `.zip` en la carpeta que prefieras de tu ordenador (por ejemplo, en `Documentos` o `Descargas`).

- **Opción B (Para desarrolladores con Git):**
  ```bash
  git clone https://github.com/icasadosar/videostreamdownloader.git
  ```

### Paso 2: Cargar la extensión en el navegador

1. Abre tu navegador y accede a la página de extensiones:
   - En **Chrome / Brave**: escribe `chrome://extensions` en la barra de direcciones.
   - En **Microsoft Edge**: escribe `edge://extensions`.
2. Activa el interruptor **Modo de desarrollador** (suele estar en la esquina superior derecha).
3. Haz clic en el botón **Cargar descomprimida** (o *Cargar extensión sin empaquetar*).
4. En el explorador de archivos, **selecciona la carpeta descomprimida** (la carpeta que contiene directamente el archivo `manifest.json`).
5. ¡Listo! Verás el icono de **VideoStreamDownloader** instalado y listo para usar.

> 💡 **Consejo:** Haz clic en el icono del puzzle de la barra superior de tu navegador y pulsa el pin 📌 junto a **VideoStreamDownloader** para tenerla siempre visible.

---

## 📖 Manual de Usuario (Paso a Paso)

### 1. Iniciar la reproducción del vídeo
1. Entra en la página donde se encuentre el partido o emisión (por ejemplo, `isquad.tv`).
2. Pulsa **Play** en el reproductor web para que comience a emitir el vídeo.
3. Observarás que en el icono de la extensión aparece un indicador numérico verde con el stream detectado.

### 2. Descargar el vídeo
1. Haz clic en el icono de la extensión **VideoStreamDownloader**.
2. Verás la tarjeta con el título del evento detectado, la fecha y el tipo de emisión (`⭐ HLS Master Playlist`).
3. Pulsa el botón verde **📥 Descargar Vídeo Directo (.mp4 / .ts)**.
4. Se mostrará una barra de progreso indicando el porcentaje y el número de fragmentos descargados.
5. Puedes cerrar la ventana de la extensión o navegar a otra pestaña; la descarga seguirá trabajando en segundo plano (verás el porcentaje en el propio icono de la extensión).
6. Al finalizar, el archivo se guardará automáticamente en tu carpeta habitual de **Descargas**.

### 3. Cancelar una descarga en curso
Si deseas detener una descarga:
1. Abre la extensión.
2. Pulsa el botón **✕ Cancelar Descarga** situado justo debajo de la barra de progreso.
3. El proceso se detendrá al instante, se cancelarán las descargas en red y la tarjeta volverá a su estado original lista por si deseas reiniciarla más tarde.

---

## 🛠️ Opciones Avanzadas (FFmpeg y yt-dlp)

Si eres un usuario avanzado o prefieres descargar y procesar los streams directamente desde tu terminal:

1. En la parte superior de la ventana emergente de la extensión, activa el interruptor deslizante **Avanzado**.
2. Aparecerán botones secundarios en cada tarjeta de vídeo:
   - **⚡ FFmpeg**: Copia al portapapeles el comando con las cabeceras `Referer` adecuadas y el nombre de salida limpio:
     ```bash
     ffmpeg -headers "Referer: https://..." -i "https://..." -c copy "partido.mp4"
     ```
   - **🔻 yt-dlp**: Copia el comando optimizado para la herramienta de consola `yt-dlp`:
     ```bash
     yt-dlp --referer "https://..." "https://..." -o "partido.mp4"
     ```
   - **📋 URL**: Copia la URL directa del manifiesto HLS para reproductores como VLC.

---

## ❓ Preguntas Frecuentes y Solución de Problemas

#### ¿Por qué la extensión dice "No se detectaron vídeos aún"?
Asegúrate de haber iniciado la reproducción del vídeo (pulsar Play). La extensión captura la transmisión en el momento en que el reproductor web solicita el manifiesto `.m3u8` a los servidores de streaming.

#### He actualizado los archivos de la extensión y no veo los cambios, ¿qué hago?
Cuando modifiques o descargues una nueva versión del repositorio:
1. Ve a `chrome://extensions`.
2. Busca **VideoStreamDownloader**.
3. Haz clic en el icono circular de **Recargar** 🔄 para actualizar el Service Worker en memoria.

#### ¿Dónde se guardan los vídeos descargados?
Los vídeos se guardan en la carpeta predeterminada de **Descargas** de tu sistema operativo, con extensión `.mp4`.

---

## 📂 Arquitectura del Proyecto

```text
videostreamdownloader/
├── manifest.json            # Configuración de la extensión (Manifest V3)
├── background.js            # Service Worker: detección de red, reglas anti-401 y motor en 2º plano
├── content.js               # Content script: extracción del título y fecha del partido
├── generate_icons.py        # Script auxiliar para generar los iconos de la extensión
├── icons/                   # Iconos en resoluciones 16x16, 48x48 y 128x128
├── offscreen/               # Documento offscreen para generación de Blob URLs de archivos grandes
│   ├── offscreen.html
│   └── offscreen.js
├── popup/
│   ├── hlsDownloader.js     # Módulo de descarga y ensamblado HLS compatible con Service Worker
│   ├── popup.html           # Interfaz gráfica de la extensión
│   ├── popup.css            # Estilos modernos en modo oscuro y componentes visuales
│   └── popup.js             # Lógica de la interfaz y comunicación con el Service Worker
├── README.md                # Manual y documentación general
└── .gitignore               # Archivos excluidos del control de versiones
```

---

## 🔒 Privacidad y Seguridad

- **100% Local**: La extensión no envía información a servidores externos ni recopila estadísticas de navegación.
- **Sin cuentas**: No requiere registros ni inicio de sesión externo.
- **Permisos mínimos**: Utiliza exclusivamente los permisos necesarios de la API de Chrome (`declarativeNetRequest`, `downloads`, `webRequest`) para capturar la emisión que tú decidas descargar.

---

## 📄 Licencia

Este proyecto está bajo licencia de código abierto [MIT](LICENSE). Siéntete libre de utilizarlo, mejorarlo y adaptarlo a tus necesidades.
