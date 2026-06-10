(function () {
  if (!window.stockAPI || !window.stockAPI.getAppVersion) return;

  function renderVersion(version) {
    var sidebar = document.querySelector('.dashboard-sidebar');
    if (!sidebar) return;

    var footer = sidebar.querySelector('.sidebar-footer');
    if (!footer) {
      footer = document.createElement('div');
      footer.className = 'sidebar-footer';
      sidebar.appendChild(footer);
    }

    var badge = footer.querySelector('.sidebar-version');
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'sidebar-version';
      footer.appendChild(badge);
    }

    badge.innerHTML = '<strong>Versión</strong> v' + String(version || '0.0.0');
  }

  window.stockAPI.getAppVersion().then(function (v) {
    renderVersion(v);
  }).catch(function () {
    renderVersion('0.0.0');
  });
})();