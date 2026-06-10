(function () {
  'use strict';
  var imgs = document.querySelectorAll('.sidebar-logo-img');
  function onError() {
    this.style.display = 'none';
    var wrap = this.closest('.sidebar-brand');
    if (wrap) {
      var fallback = wrap.querySelector('.sidebar-logo-fallback');
      if (fallback) fallback.style.display = 'inline';
    }
  }
  imgs.forEach(function (img) {
    img.onerror = onError;
  });
  if (window.stockAPI && typeof window.stockAPI.getAssetUrl === 'function') {
    window.stockAPI.getAssetUrl('logo-sidebar.png').then(function (url) {
      imgs.forEach(function (img) {
        var wrap = img.closest('.sidebar-brand');
        var fallback = wrap ? wrap.querySelector('.sidebar-logo-fallback') : null;
        img.style.display = '';
        if (fallback) fallback.style.display = 'none';
        img.src = url;
      });
    }).catch(function () {});
  }
})();
