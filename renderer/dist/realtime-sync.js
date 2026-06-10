/**
 * Actualizaciones (GitHub / electron-updater) + sincronización Supabase Realtime.
 * Incluir al final del body. En index.html solo corre la parte de updates (sin onDataChanged).
 */
(function () {
  if (!window.stockAPI) return;

  // ── Banner de actualización (todas las páginas con preload) ──
  var updateBanner = null;
  var updateState = { status: 'idle', info: null, progress: null, error: null };

  function ensureUpdateBanner() {
    if (updateBanner) return updateBanner;
    var b = document.createElement('div');
    b.id = 'update-banner';
    b.className = 'update-banner';
    b.style.display = 'none';
    b.innerHTML =
      '<div class="update-banner-inner">' +
      '  <div class="update-banner-text">' +
      '    <strong id="update-banner-title">Actualización</strong>' +
      '    <span id="update-banner-msg">—</span>' +
      '  </div>' +
      '  <div class="update-banner-actions">' +
      '    <button type="button" id="update-banner-btn-accion" class="btn btn-primary btn-sm">Actualizar</button>' +
      '    <button type="button" id="update-banner-btn-cerrar" class="btn btn-secondary btn-sm">Cerrar</button>' +
      '  </div>' +
      '</div>';
    document.body.appendChild(b);
    updateBanner = b;

    var btnAccion = document.getElementById('update-banner-btn-accion');
    var btnCerrar = document.getElementById('update-banner-btn-cerrar');

    if (btnCerrar) {
      btnCerrar.addEventListener('click', function () {
        if (updateBanner) updateBanner.style.display = 'none';
      });
    }
    if (btnAccion) {
      btnAccion.addEventListener('click', function () {
        if (!window.stockAPI) return;
        if (updateState.status === 'available') {
          btnAccion.disabled = true;
          window.stockAPI.downloadUpdate && window.stockAPI.downloadUpdate().catch(function () { /* errores por evento */ });
        } else if (updateState.status === 'downloaded') {
          btnAccion.disabled = true;
          window.stockAPI.installUpdate && window.stockAPI.installUpdate().catch(function () { /* ignore */ });
        } else if (updateState.status === 'error') {
          btnAccion.disabled = true;
          window.stockAPI.checkForUpdates && window.stockAPI.checkForUpdates().catch(function () { /* ignore */ });
        }
      });
    }
    return b;
  }

  function setUpdateBanner(visible, title, msg, actionLabel, actionDisabled) {
    var b = ensureUpdateBanner();
    var t = document.getElementById('update-banner-title');
    var m = document.getElementById('update-banner-msg');
    var a = document.getElementById('update-banner-btn-accion');
    if (t) t.textContent = title || 'Actualización';
    if (m) m.textContent = msg || '—';
    if (a) {
      a.textContent = actionLabel || 'Actualizar';
      a.disabled = !!actionDisabled;
    }
    b.style.display = visible ? 'block' : 'none';
  }

  function formatPercent(p) {
    if (p == null || isNaN(p)) return '';
    var n = Math.max(0, Math.min(100, Math.round(p)));
    return n + '%';
  }

  function handleUpdateStatus(payload) {
    if (!payload || !payload.status) return;
    updateState.status = payload.status;
    updateState.info = payload.info || null;
    updateState.progress = payload.progress != null ? payload.progress : null;
    updateState.error = payload.error || null;

    try {
      window.dispatchEvent(new CustomEvent('app-update-status', { detail: payload }));
    } catch (_) {}

    if (payload.status === 'checking') {
      setUpdateBanner(true, 'Buscando actualización…', 'Verificando si hay una versión nueva', 'Esperar', true);
      return;
    }
    if (payload.status === 'available') {
      var ver = (payload.info && (payload.info.version || payload.info.releaseName)) ? String(payload.info.version || payload.info.releaseName) : '';
      setUpdateBanner(true, 'Actualización disponible', ver ? ('Nueva versión: ' + ver) : 'Hay una versión nueva para instalar', 'Actualizar', false);
      return;
    }
    if (payload.status === 'not-available') {
      setUpdateBanner(false);
      return;
    }
    if (payload.status === 'progress') {
      setUpdateBanner(true, 'Descargando actualización…', 'Progreso: ' + formatPercent(payload.progress), 'Descargando…', true);
      return;
    }
    if (payload.status === 'downloaded') {
      setUpdateBanner(true, 'Actualización lista', 'Se descargó la actualización. Presiona Instalar.', 'Instalar', false);
      return;
    }
    if (payload.status === 'error') {
      var err = payload.error ? String(payload.error) : 'Error desconocido';
      setUpdateBanner(true, 'No se pudo actualizar', err, 'Reintentar', false);
      return;
    }
  }

  function requestUpdateCheck() {
    if (!window.stockAPI || !window.stockAPI.checkForUpdates) return;
    window.stockAPI.checkForUpdates().catch(function () { /* errores por evento */ });
  }

  try {
    if (window.stockAPI.onUpdateStatus) {
      window.stockAPI.onUpdateStatus(handleUpdateStatus);
    }
    if (window.stockAPI.getLastUpdateStatus) {
      window.stockAPI.getLastUpdateStatus().then(function (snap) {
        var payload = snap && snap.status;
        if (payload && payload.status) {
          handleUpdateStatus(payload);
        }
      }).catch(function () { /* ignore */ });
    }
    window.addEventListener('app-request-update-check', requestUpdateCheck);
    setTimeout(requestUpdateCheck, 1200);
  } catch (_) {}

  // ── Realtime (solo páginas con API de cambios) ──
  if (!window.stockAPI.onDataChanged) return;

  var DEBOUNCE_MS = 1500;
  var _timer = null;
  var _lastReload = 0;
  var MIN_INTERVAL_MS = 3000;

  function showRealtimeToast() {
    var existing = document.querySelector('.toast-realtime');
    if (existing) existing.remove();
    var t = document.createElement('div');
    t.className = 'toast toast-realtime success';
    t.textContent = 'Datos actualizados en tiempo real';
    document.body.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.remove(); }, 3000);
  }

  window.stockAPI.onDataChanged(function (payload) {
    var table = payload && payload.table ? payload.table : '';
    console.log('[Realtime-Sync] Cambio detectado en:', table, payload && payload.event);

    if (_timer) clearTimeout(_timer);
    _timer = setTimeout(function () {
      _timer = null;
      var now = Date.now();
      if (now - _lastReload < MIN_INTERVAL_MS) return;
      _lastReload = now;

      showRealtimeToast();

      if (typeof window._realtimeRefresh === 'function') {
        window._realtimeRefresh(table);
      } else {
        location.reload();
      }
    }, DEBOUNCE_MS);
  });
})();
