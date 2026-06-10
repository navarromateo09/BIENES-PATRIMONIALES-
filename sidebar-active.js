/**
 * Marca automáticamente el link activo del sidebar según la página actual.
 * - Agrega/remueve clase "active"
 * - Setea aria-current="page"
 */
(function () {
  function getCurrentFileName() {
    try {
      var path = (window.location && window.location.pathname) ? window.location.pathname : '';
      if (!path) return '';
      var parts = path.split('/');
      var last = parts[parts.length - 1] || '';
      return last.toLowerCase();
    } catch (e) {
      return '';
    }
  }

  function normalizeHref(href) {
    if (!href) return '';
    var h = String(href).split('#')[0].split('?')[0].trim();
    return h.toLowerCase();
  }

  function markActive() {
    var current = getCurrentFileName();
    if (!current) return;

    var links = document.querySelectorAll('.sidebar-nav a.sidebar-link[href]');
    if (!links || !links.length) return;

    var matched = null;
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      var href = normalizeHref(a.getAttribute('href'));
      if (!href) continue;
      if (href === current || href.endsWith('/' + current) || href.endsWith(current)) {
        matched = a;
        break;
      }
    }

    for (var j = 0; j < links.length; j++) {
      links[j].classList.remove('active');
      links[j].removeAttribute('aria-current');
    }

    if (matched) {
      matched.classList.add('active');
      matched.setAttribute('aria-current', 'page');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', markActive);
  } else {
    markActive();
  }
})();

