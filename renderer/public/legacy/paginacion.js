/**
 * Utilidad de paginación reutilizable.
 * Uso:
 *   var info = Paginacion.paginar(items, paginaActual, porPagina);
 *   // info.items => slice para renderizar
 *   Paginacion.renderControles(containerEl, info, function(nuevaPag) { ... });
 */
window.Paginacion = (function () {
  var DEFAULT_POR_PAGINA = 50;

  function paginar(items, pagina, porPagina) {
    porPagina = porPagina || DEFAULT_POR_PAGINA;
    pagina = pagina || 1;
    var total = (items || []).length;
    var totalPaginas = Math.max(1, Math.ceil(total / porPagina));
    if (pagina > totalPaginas) pagina = totalPaginas;
    if (pagina < 1) pagina = 1;
    var inicio = (pagina - 1) * porPagina;
    var fin = Math.min(inicio + porPagina, total);
    return {
      items: (items || []).slice(inicio, fin),
      pagina: pagina,
      totalPaginas: totalPaginas,
      total: total,
      inicio: total > 0 ? inicio + 1 : 0,
      fin: fin,
      porPagina: porPagina
    };
  }

  function renderControles(container, info, onPageChange) {
    if (typeof container === 'string') container = document.getElementById(container);
    if (!container) return;
    if (!info || info.total === 0) { container.innerHTML = ''; return; }
    if (info.totalPaginas <= 1) {
      container.innerHTML = '<div class="paginacion-wrap">' +
        '<span class="pag-info">Mostrando ' + info.inicio + '–' + info.fin + ' de ' + info.total + '</span>' +
        '<div class="pag-botones">' +
        '<button type="button" class="pag-btn pag-prev" disabled title="Anterior">\u00AB</button>' +
        '<button type="button" class="pag-btn pag-num pag-active" data-page="1">1</button>' +
        '<button type="button" class="pag-btn pag-next" disabled title="Siguiente">\u00BB</button>' +
        '</div></div>';
      var onlyNum = container.querySelector('.pag-num');
      if (onlyNum) onlyNum.addEventListener('click', function () { onPageChange(1); });
      return;
    }

    var html = '<div class="paginacion-wrap">';
    html += '<span class="pag-info">Mostrando ' + info.inicio + '–' + info.fin + ' de ' + info.total + '</span>';
    html += '<div class="pag-botones">';
    html += '<button type="button" class="pag-btn pag-prev"' + (info.pagina <= 1 ? ' disabled' : '') + ' title="Anterior">\u00AB</button>';

    var maxVisible = 5;
    var startPage = Math.max(1, info.pagina - Math.floor(maxVisible / 2));
    var endPage = Math.min(info.totalPaginas, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) startPage = Math.max(1, endPage - maxVisible + 1);

    if (startPage > 1) {
      html += '<button type="button" class="pag-btn pag-num" data-page="1">1</button>';
      if (startPage > 2) html += '<span class="pag-ellipsis">\u2026</span>';
    }
    for (var i = startPage; i <= endPage; i++) {
      html += '<button type="button" class="pag-btn pag-num' + (i === info.pagina ? ' pag-active' : '') + '" data-page="' + i + '">' + i + '</button>';
    }
    if (endPage < info.totalPaginas) {
      if (endPage < info.totalPaginas - 1) html += '<span class="pag-ellipsis">\u2026</span>';
      html += '<button type="button" class="pag-btn pag-num" data-page="' + info.totalPaginas + '">' + info.totalPaginas + '</button>';
    }

    html += '<button type="button" class="pag-btn pag-next"' + (info.pagina >= info.totalPaginas ? ' disabled' : '') + ' title="Siguiente">\u00BB</button>';
    html += '</div></div>';

    container.innerHTML = html;

    var nums = container.querySelectorAll('.pag-num');
    for (var j = 0; j < nums.length; j++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          onPageChange(parseInt(btn.getAttribute('data-page'), 10));
        });
      })(nums[j]);
    }
    var prevBtn = container.querySelector('.pag-prev');
    if (prevBtn) prevBtn.addEventListener('click', function () {
      if (info.pagina > 1) onPageChange(info.pagina - 1);
    });
    var nextBtn = container.querySelector('.pag-next');
    if (nextBtn) nextBtn.addEventListener('click', function () {
      if (info.pagina < info.totalPaginas) onPageChange(info.pagina + 1);
    });
  }

  return { DEFAULT_POR_PAGINA: DEFAULT_POR_PAGINA, paginar: paginar, renderControles: renderControles };
})();
