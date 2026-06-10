/**
 * Reinicia el temporizador de sesión ante actividad del usuario.
 * Si pasan 10 min sin actividad, el proceso principal cierra sesión y emite session-expired.
 */
(function () {
  if (typeof window === 'undefined' || !window.stockAPI) return;

  var THROTTLE_MS = 20000;
  var lastSent = 0;

  function sendActivity() {
    var now = Date.now();
    if (now - lastSent < THROTTLE_MS) return;
    lastSent = now;
    if (window.stockAPI.sessionActivity) {
      window.stockAPI.sessionActivity().catch(function () {});
    }
  }

  function goLogin() {
    window.location.href = 'index.html';
  }

  window.stockAPI.getAuthStatus().then(function (s) {
    if (!s || !s.hasUser) return;

    sendActivity();

    ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel'].forEach(function (ev) {
      document.addEventListener(ev, sendActivity, { passive: true, capture: true });
    });

    if (window.stockAPI.onSessionExpired) {
      window.stockAPI.onSessionExpired(goLogin);
    }
  });

  /**
   * Forzar que los campos de texto dentro de modales se escriban siempre en mayúsculas.
   * Aplica a:
   *  - input[type="text"], input[type="search"], textarea
   *  - Solo cuando estén dentro de un contenedor con clase .modal
   *  - Se puede excluir añadiendo la clase .no-uppercase al campo.
   */
  function shouldForceUppercase(el) {
    if (!el) return false;
    if (!el.closest || !el.closest('.modal')) return false;

    // Permitir desactivar con una clase explícita
    if (el.classList && el.classList.contains('no-uppercase')) return false;

    var tag = el.tagName;
    if (tag === 'TEXTAREA') return true;
    if (tag !== 'INPUT') return false;

    var type = (el.type || 'text').toLowerCase();
    // Solo forzamos en campos de texto "libre"
    if (type !== 'text' && type !== 'search') return false;

    return true;
  }

  document.addEventListener('input', function (ev) {
    var el = ev.target;
    if (!shouldForceUppercase(el)) return;

    var value = el.value;
    var upper = value.toUpperCase();
    if (value === upper) return;

    var selStart = el.selectionStart;
    var selEnd = el.selectionEnd;
    el.value = upper;
    if (typeof selStart === 'number' && typeof selEnd === 'number') {
      try {
        el.setSelectionRange(selStart, selEnd);
      } catch (_) {
        // Algunos navegadores/inputs pueden no soportar setSelectionRange
      }
    }
  }, true);
})();
