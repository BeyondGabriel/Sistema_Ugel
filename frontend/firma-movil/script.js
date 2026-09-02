// ===========================================================
// Captura de firma en canvas con soporte táctil y de ratón.
// V1: convierte el canvas a PNG embebido en un SVG y ofrece
// la descarga directa. La integración completa con Supabase
// (subida del archivo y llamada al webhook del backend)
// está documentada al final del script pero deshabilitada
// hasta que se configure el proyecto de Supabase.
// ===========================================================

(function () {
  'use strict';

  const canvas    = document.getElementById('lienzo');
  const ctx       = canvas.getContext('2d');
  const btnGuardar  = document.getElementById('btn-guardar');
  const btnLimpiar  = document.getElementById('btn-limpiar');
  const btnDescargar = document.getElementById('btn-descargar');
  const estado    = document.getElementById('estado');
  const descargaWrap = document.getElementById('descarga-wrap');
  const previewSvg   = document.getElementById('preview-svg');

  // ─── Dimensionado adaptativo ──────────────────────────
  function redimensionar() {
    const ancho = canvas.parentElement.clientWidth;
    const alto  = Math.min(240, Math.round(ancho * 0.45));
    canvas.width  = ancho;
    canvas.height = alto;
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth   = 2.5;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
  }
  redimensionar();
  window.addEventListener('resize', redimensionar);

  // ─── Estado del dibujo ───────────────────────────────
  let dibujando = false;
  let hayTrazo  = false;

  function posDesde(e) {
    const rect  = canvas.getBoundingClientRect();
    const fuente = e.touches ? e.touches[0] : e;
    return {
      x: (fuente.clientX - rect.left) * (canvas.width  / rect.width),
      y: (fuente.clientY - rect.top)  * (canvas.height / rect.height),
    };
  }

  function iniciar(e) {
    e.preventDefault();
    dibujando = true;
    const { x, y } = posDesde(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function dibujar(e) {
    if (!dibujando) return;
    e.preventDefault();
    const { x, y } = posDesde(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hayTrazo) {
      hayTrazo = true;
      btnGuardar.disabled = false;
    }
  }

  function terminar(e) {
    if (!dibujando) return;
    e.preventDefault();
    dibujando = false;
  }

  // Eventos de ratón
  canvas.addEventListener('mousedown',  iniciar);
  canvas.addEventListener('mousemove',  dibujar);
  canvas.addEventListener('mouseup',    terminar);
  canvas.addEventListener('mouseleave', terminar);

  // Eventos táctiles
  canvas.addEventListener('touchstart',  iniciar,   { passive: false });
  canvas.addEventListener('touchmove',   dibujar,   { passive: false });
  canvas.addEventListener('touchend',    terminar,  { passive: false });
  canvas.addEventListener('touchcancel', terminar,  { passive: false });

  // ─── Limpiar ─────────────────────────────────────────
  btnLimpiar.addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hayTrazo = false;
    btnGuardar.disabled = true;
    descargaWrap.classList.remove('visible');
    mostrarEstado('', '');
  });

  // ─── Guardar / convertir a SVG ───────────────────────
  btnGuardar.addEventListener('click', async () => {
    if (!hayTrazo) return;

    btnGuardar.disabled = true;
    mostrarEstado('Procesando firma…', 'carga');

    try {
      const pngDataUrl = canvas.toDataURL('image/png');

      // Construye un SVG que embebe la imagen PNG como elemento <image>.
      // Esto garantiza que la firma se preserve exactamente como fue dibujada.
      const svgContent = `<svg xmlns="http://www.w3.org/2000/svg"
        xmlns:xlink="http://www.w3.org/1999/xlink"
        width="${canvas.width}" height="${canvas.height}"
        viewBox="0 0 ${canvas.width} ${canvas.height}">
        <rect width="100%" height="100%" fill="white"/>
        <image href="${pngDataUrl}" width="${canvas.width}" height="${canvas.height}"/>
      </svg>`;

      const blob = new Blob([svgContent], { type: 'image/svg+xml' });
      const url  = URL.createObjectURL(blob);

      // Vista previa
      previewSvg.src = url;
      descargaWrap.classList.add('visible');

      // Configurar descarga
      btnDescargar.onclick = () => {
        const a  = document.createElement('a');
        a.href   = url;
        a.download = `firma-${Date.now()}.svg`;
        a.click();
      };

      mostrarEstado('✓ Firma lista para descargar', 'exito');

      // ── INTEGRACIÓN SUPABASE (deshabilitada en V1) ──────
      // Para activar la subida a Supabase y notificar al backend:
      //
      // 1. Obtén los parámetros de la URL:
      //    const params = new URLSearchParams(window.location.search);
      //    const papeletaId = Number(params.get('papeletaId'));
      //
      // 2. Sube el blob al bucket de Supabase:
      //    const { data, error } = await supabase.storage
      //      .from('firmas')
      //      .upload(`firma-${papeletaId}-${Date.now()}.svg`, blob, { contentType: 'image/svg+xml' });
      //
      // 3. Obtén la URL pública:
      //    const { data: { publicUrl } } = supabase.storage.from('firmas').getPublicUrl(data.path);
      //
      // 4. Notifica al backend via el webhook:
      //    await fetch('/api/firmas/webhook', {
      //      method: 'POST',
      //      headers: { 'Content-Type': 'application/json', 'x-webhook-secret': WEBHOOK_SECRET },
      //      body: JSON.stringify({ papeletaId, svgUrl: publicUrl }),
      //    });
      // ────────────────────────────────────────────────────

    } catch (err) {
      mostrarEstado('Error al procesar la firma', 'error');
      console.error(err);
      btnGuardar.disabled = false;
    }
  });

  // ─── Helpers ─────────────────────────────────────────
  function mostrarEstado(msg, tipo) {
    estado.textContent = msg;
    estado.className   = tipo;
  }
})();
