/**
 * Overlay global de carga con spinner tipo anillo (trompa/cola).
 * Uso:
 *   window.appLoading.show('Cargando…');
 *   window.appLoading.hide();
 */
(function () {
  function ensureOverlay() {
    var existing = document.getElementById('app-loading-overlay');
    if (existing) return existing;

    var overlay = document.createElement('div');
    overlay.id = 'app-loading-overlay';
    overlay.className = 'app-loading-overlay';
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="app-loading-card" role="status" aria-live="polite" aria-busy="true">' +
        '<div class="app-loading-spinner" aria-hidden="true">' +
          '<svg viewBox="0 0 50 50">' +
            '<circle class="app-loading-circle" cx="25" cy="25" r="20"></circle>' +
          '</svg>' +
        '</div>' +
        '<div class="app-loading-text" id="app-loading-text">Cargando…</div>' +
      '</div>';
    document.body.appendChild(overlay);
    return overlay;
  }

  function setText(text) {
    var el = document.getElementById('app-loading-text');
    if (!el) return;
    el.textContent = (text && String(text).trim()) ? String(text) : 'Cargando…';
  }

  function show(text) {
    if (window.appLoading && window.appLoading.__reactBridge) {
      window.appLoading.show(text);
      return;
    }
    var overlay = ensureOverlay();
    setText(text);
    try { overlay.style.pointerEvents = ''; } catch (_) {}
    overlay.hidden = false;
    document.documentElement.classList.add('app-loading-open');
  }

  function hide() {
    if (window.appLoading && window.appLoading.__reactBridge) {
      window.appLoading.hide();
      return;
    }
    var overlay = ensureOverlay();
    overlay.hidden = true;
    try { overlay.style.pointerEvents = 'none'; } catch (_) {}
    document.documentElement.classList.remove('app-loading-open');
  }

  if (!window.appLoading || !window.appLoading.__reactBridge) {
    window.appLoading = { show: show, hide: hide };
  }

  /** Tras alert/confirm o al abrir modales: Electron en Windows a veces pierde foco de entrada. */
  function recoverWindowFocus() {
    function tick() {
      try {
        if (window.stockAPI && window.stockAPI.focusWindow) window.stockAPI.focusWindow();
        else window.focus();
      } catch (_) {}
    }
    tick();
    setTimeout(tick, 0);
    setTimeout(tick, 80);
    setTimeout(tick, 200);
  }

  function scheduleNativeDialogFocusRecovery() {
    recoverWindowFocus();
    setTimeout(recoverWindowFocus, 50);
    setTimeout(recoverWindowFocus, 220);
  }

  function focusSearchInput(input) {
    if (!input) return;
    ensureInputInteractive(input);
    recoverWindowFocus();
    setTimeout(function () { try { input.focus(); } catch (_) {} }, 0);
    setTimeout(function () { try { input.focus(); } catch (_) {} }, 100);
    setTimeout(function () { try { input.focus(); } catch (_) {} }, 280);
  }

  window.appUiFocus = {
    recover: recoverWindowFocus,
    focusSearchInput: focusSearchInput,
    ensureInputInteractive: ensureInputInteractive,
    beforeModal: function () {
      try {
        if (window.appLoading && window.appLoading.hide) window.appLoading.hide();
      } catch (_) {}
      recoverWindowFocus();
    }
  };

  (function patchNativeDialogsForElectronFocus() {
    if (window.__nativeDialogFocusPatch) return;
    window.__nativeDialogFocusPatch = true;
    var W = window;
    var oAlert = W.alert;
    var oConfirm = W.confirm;
    var oPrompt = W.prompt;
    if (typeof oAlert === 'function') {
      W.alert = function (msg) {
        try { oAlert.call(W, msg); } finally { scheduleNativeDialogFocusRecovery(); }
      };
    }
    if (typeof oConfirm === 'function') {
      W.confirm = function (msg) {
        var r;
        try { r = oConfirm.call(W, msg); } finally { scheduleNativeDialogFocusRecovery(); }
        return r;
      };
    }
    if (typeof oPrompt === 'function') {
      W.prompt = function (msg, def) {
        var r;
        try { r = oPrompt.call(W, msg, def); } finally { scheduleNativeDialogFocusRecovery(); }
        return r;
      };
    }
  })();

  function ensureInputInteractive(input) {
    if (!input) return;
    try { input.disabled = false; } catch (_) {}
    try { input.readOnly = false; } catch (_) {}
    try { input.style.pointerEvents = 'auto'; } catch (_) {}
  }

  // Fix global (Electron): si un confirm/alert nativo deja la ventana "sin foco"
  // hasta que el usuario hace alt-tab, lo recuperamos en el primer gesto.
  (function bindGlobalFocusRecovery() {
    var recovering = false;
    function isTextInput(el) {
      if (!el) return false;
      if (el.isContentEditable) return true;
      var tag = (el.tagName || '').toLowerCase();
      if (tag === 'textarea') return true;
      if (tag !== 'input') return false;
      var type = (el.getAttribute('type') || 'text').toLowerCase();
      return ['text', 'search', 'email', 'number', 'password', 'tel', 'url', 'date', 'datetime-local'].indexOf(type) >= 0;
    }

    function isSearchBarTarget(el) {
      if (!el || !el.closest) return false;
      if (isTextInput(el)) return true;
      return !!(el.closest('.search-bar') || el.closest('.mf-recarga-search') || el.closest('.txt-search-bar'));
    }

    function recover(e) {
      if (recovering) return;
      var inOpenModal = false;
      var t0 = e && e.target;
      var onSearch = isSearchBarTarget(t0);
      try {
        if (t0 && t0.closest) inOpenModal = !!t0.closest('.modal.open');
      } catch (_) {}
      // Tras alert/confirm nativo (Electron): hasFocus() puede ser true y aun así no escribir.
      // En buscadores siempre reforzar foco al hacer clic en la lupa o el campo.
      if (!inOpenModal && !onSearch) {
        try {
          if (document.hasFocus && document.hasFocus()) return;
        } catch (_) {}
      }
      recovering = true;
      try {
        if (window.stockAPI && window.stockAPI.focusWindow) window.stockAPI.focusWindow();
        else window.focus();
      } catch (_) {}
      try {
        var t = e && e.target ? e.target : null;
        var input = null;
        if (isTextInput(t)) input = t;
        else if (t && t.closest) {
          var modal = t.closest('.modal.open');
          if (modal) input = modal.querySelector('input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])');
          if (!input) {
            var bar = t.closest('.search-bar, .mf-recarga-search, .txt-search-bar');
            if (bar) input = bar.querySelector('input, textarea');
          }
        }
        if (input) {
          if ((inOpenModal || onSearch) && e && e.preventDefault) e.preventDefault();
          focusSearchInput(input);
        }
      } catch (_) {}
      setTimeout(function () { recovering = false; }, 150);
    }
    document.addEventListener('pointerdown', recover, true);
    document.addEventListener('mousedown', recover, true);
    window.addEventListener('focus', function () { /* noop: solo para asegurar binding */ });
  })();

  function focusById(id) {
    if (!id) return;
    var el = document.getElementById(id);
    if (!el) return;
    ensureInputInteractive(el);
    try { el.focus(); } catch (_) {}
  }

  // Fix global: al hacer click en la "lupa" enfocá el input correspondiente.
  function bindSearchLupaFocusFix() {
    try {
      // 1) Barras tipo TXT: icono + input en un contenedor
      document.querySelectorAll('.txt-search-bar').forEach(function (bar) {
        if (bar.__lupaFixBound) return;
        bar.__lupaFixBound = true;
        var input = bar.querySelector('input, textarea');
        if (!input) return;

        function focus() {
          if (window.appUiFocus && window.appUiFocus.focusSearchInput) window.appUiFocus.focusSearchInput(input);
          else {
            ensureInputInteractive(input);
            try { input.focus(); } catch (_) {}
          }
        }

        // Click en cualquier parte de la barra que no sea el botón limpiar.
        bar.addEventListener('mousedown', function (e) {
          if (!e) return;
          var t = e.target;
          if (t && t.classList && t.classList.contains('txt-search-clear')) return;
          // Evitar que el click "robe" el foco del input antes de enfocarlo.
          focus();
        });
        bar.addEventListener('click', function (e) {
          if (!e) return;
          var t = e.target;
          if (t && t.classList && t.classList.contains('txt-search-clear')) return;
          focus();
        });
      });

      // 1b) Barras modernas reutilizables: .search-bar (Dependencias, Guardia, etc.)
      document.querySelectorAll('.search-bar').forEach(function (bar) {
        if (bar.__searchBarFixBound) return;
        bar.__searchBarFixBound = true;
        var input = bar.querySelector('input, textarea');
        if (!input) return;

        function focus() {
          if (window.appUiFocus && window.appUiFocus.focusSearchInput) window.appUiFocus.focusSearchInput(input);
          else {
            ensureInputInteractive(input);
            try { input.focus(); } catch (_) {}
          }
        }

        // Click/mousedown en la barra (incluye la lupa) debe enfocar el input.
        bar.addEventListener('mousedown', function (e) {
          if (!e) return;
          var t = e.target;
          if (t && t.classList && t.classList.contains('search-clear')) return;
          focus();
        });
        bar.addEventListener('click', function (e) {
          if (!e) return;
          var t = e.target;
          if (t && t.classList && t.classList.contains('search-clear')) return;
          focus();
        });
      });

      // 2) Lupas dentro de labels: <label for="..."><span class="icono-lupa">🔍</span> ...
      document.querySelectorAll('.icono-lupa').forEach(function (icon) {
        if (icon.__lupaFixBound) return;
        icon.__lupaFixBound = true;
        icon.addEventListener('click', function (e) {
          // No bloquear comportamiento normal del label, solo reforzar el foco.
          try {
            var label = icon.closest && icon.closest('label');
            var forId = label ? (label.getAttribute('for') || '') : '';
            if (forId) {
              setTimeout(function () { focusById(forId); }, 0);
            }
          } catch (_) {}
        });
      });

      // 3) Buscador moderno reutilizable: botón limpiar + mostrar/ocultar
      document.querySelectorAll('button.search-clear[data-search-clear]').forEach(function (btn) {
        if (btn.__searchClearBound) return;
        btn.__searchClearBound = true;
        var targetId = btn.getAttribute('data-search-clear') || '';
        var input = targetId ? document.getElementById(targetId) : null;
        if (!input) return;

        function syncVisibility() {
          try {
            var has = !!(input.value && String(input.value).length);
            btn.style.display = has ? 'inline-flex' : 'none';
          } catch (_) {}
        }

        btn.addEventListener('click', function () {
          try {
            input.value = '';
            syncVisibility();
            // Disparar eventos para que el filtro existente se actualice
            try { input.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
            try { input.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {}
            ensureInputInteractive(input);
            try { input.focus(); } catch (_) {}
          } catch (_) {}
        });

        input.addEventListener('input', syncVisibility);
        input.addEventListener('change', syncVisibility);
        syncVisibility();
      });
    } catch (_) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (!window.appLoading || !window.appLoading.__reactBridge) ensureOverlay();
      bindSearchLupaFocusFix();
    });
  } else {
    if (!window.appLoading || !window.appLoading.__reactBridge) ensureOverlay();
    bindSearchLupaFocusFix();
  }
})();

/**
 * Diálogos modales (reemplazo de alert/confirm nativos en Electron/Windows).
 */
(function () {
  var dialogEl = null;

  function escapeHtmlDialog(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function ensureDialog() {
    if (dialogEl) return dialogEl;
    dialogEl = document.createElement('div');
    dialogEl.id = 'app-dialog-modal';
    dialogEl.className = 'modal app-dialog-modal';
    dialogEl.setAttribute('role', 'alertdialog');
    dialogEl.setAttribute('aria-modal', 'true');
    dialogEl.hidden = true;
    dialogEl.innerHTML =
      '<div class="modal-content app-dialog-content">' +
      '<div class="modal-header">' +
      '<h3 id="app-dialog-title" class="app-dialog-title">Aviso</h3>' +
      '</div>' +
      '<div class="modal-body"><p id="app-dialog-message" class="app-dialog-message"></p></div>' +
      '<div class="modal-actions app-dialog-actions">' +
      '<button type="button" id="app-dialog-cancel" class="btn btn-secondary btn-sm" hidden>Cancelar</button>' +
      '<button type="button" id="app-dialog-ok" class="btn btn-primary btn-sm">Aceptar</button>' +
      '</div></div>';
    document.body.appendChild(dialogEl);
    return dialogEl;
  }

  function closeDialog() {
    if (!dialogEl) return;
    dialogEl.classList.remove('open');
    dialogEl.hidden = true;
    if (window.appUiFocus && window.appUiFocus.recover) window.appUiFocus.recover();
  }

  function openDialog(opts) {
    var el = ensureDialog();
    var titleEl = document.getElementById('app-dialog-title');
    var msgEl = document.getElementById('app-dialog-message');
    var btnOk = document.getElementById('app-dialog-ok');
    var btnCancel = document.getElementById('app-dialog-cancel');
    if (titleEl) titleEl.textContent = opts.title || 'Aviso';
    if (msgEl) msgEl.textContent = opts.message || '';
    var isConfirm = !!opts.confirm;
    if (btnCancel) btnCancel.hidden = !isConfirm;
    if (btnOk) btnOk.textContent = opts.okLabel || (isConfirm ? 'Aceptar' : 'Entendido');
    if (btnCancel) btnCancel.textContent = opts.cancelLabel || 'Cancelar';
    if (window.appUiFocus && window.appUiFocus.beforeModal) window.appUiFocus.beforeModal();
    el.hidden = false;
    el.classList.add('open');
    return new Promise(function (resolve) {
      function done(value) {
        btnOk.removeEventListener('click', onOk);
        if (btnCancel) btnCancel.removeEventListener('click', onCancel);
        document.removeEventListener('keydown', onKey);
        closeDialog();
        resolve(value);
      }
      function onOk() { done(isConfirm ? true : undefined); }
      function onCancel() { done(false); }
      function onKey(ev) {
        if (ev.key === 'Escape' && isConfirm) { ev.preventDefault(); done(false); }
        if (ev.key === 'Enter') { ev.preventDefault(); onOk(); }
      }
      btnOk.addEventListener('click', onOk);
      if (btnCancel && isConfirm) btnCancel.addEventListener('click', onCancel);
      document.addEventListener('keydown', onKey);
      setTimeout(function () { try { btnOk.focus(); } catch (_) {} }, 50);
    });
  }

  window.appDialog = {
    alert: function (message, title) {
      return openDialog({ title: title || 'Aviso', message: message || '', confirm: false });
    },
    confirm: function (message, title) {
      return openDialog({
        title: title || 'Confirmar',
        message: message || '',
        confirm: true,
        okLabel: 'Aceptar',
        cancelLabel: 'Cancelar'
      });
    }
  };
})();

/**
 * IPC “ligero” (get-productos-data, etc.): si la app instalada es anterior al main,
 * preload expone el método pero el handler no existe → fallback a getData().
 */
(function () {
  function isMissingIpcHandlerError(err) {
    return String((err && err.message) || err || '').indexOf('No handler registered') >= 0;
  }

  window.invokeStockLightOrFull = async function (lightMethodName, fullLoader) {
    if (!window.stockAPI || typeof fullLoader !== 'function') return null;
    var lightFn = lightMethodName && window.stockAPI[lightMethodName];
    if (typeof lightFn !== 'function') return fullLoader();
    try {
      return await lightFn();
    } catch (e) {
      if (isMissingIpcHandlerError(e)) {
        console.warn('[stockAPI] ' + lightMethodName + ' no disponible en main, usando carga completa.');
        return fullLoader();
      }
      throw e;
    }
  };
})();

