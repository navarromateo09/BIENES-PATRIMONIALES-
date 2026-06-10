/**
 * Comprueba sesión y oculta el enlace "Configuración" (usuarios.html) para roles que no son admin.
 * Incluir en todas las páginas con sidebar (excepto dashboard, que ya lo hace en dashboard.js).
 */
(function () {
  if (!window.stockAPI || !window.stockAPI.getAuthStatus) return;
  window.stockAPI.getAuthStatus().then(function (r) {
    if (!r.hasUser) {
      window.location.href = 'index.html';
      return;
    }
    var rol = (r.rol || 'usuario').toLowerCase();
    var configLinks = document.querySelectorAll('a[href="usuarios.html"]');
    for (var i = 0; i < configLinks.length; i++) {
      configLinks[i].style.display = rol === 'admin' ? '' : 'none';
    }
  });
})();
