(function () {
  'use strict';

  var lista = document.getElementById('audit-lista');
  var emptyMsg = document.getElementById('audit-empty');
  var filtroModulo = document.getElementById('audit-filtro-modulo');
  var filtroAccion = document.getElementById('audit-filtro-accion');
  var filtroUsuario = document.getElementById('audit-filtro-usuario');
  var filtroDependencia = document.getElementById('audit-filtro-dependencia');
  var filtroDesde = document.getElementById('audit-filtro-desde');
  var filtroHasta = document.getElementById('audit-filtro-hasta');
  var btnFiltrar = document.getElementById('btn-filtrar-audit');
  var btnRefrescar = document.getElementById('btn-refrescar-audit');
  var btnExportar = document.getElementById('btn-exportar-audit');
  var filtroQ = document.getElementById('audit-filtro-q');
  var pagAudit = 1;
  var PAG_SIZE = (window.Paginacion && window.Paginacion.DEFAULT_POR_PAGINA) || 50;
  var lastAuditEntries = [];

  function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatFecha(fechaStr) {
    if (!fechaStr) return '—';
    var d = new Date(fechaStr);
    if (isNaN(d.getTime())) return '—';
    var day = String(d.getDate()).padStart(2, '0');
    var month = String(d.getMonth() + 1).padStart(2, '0');
    var year = d.getFullYear();
    var h = String(d.getHours()).padStart(2, '0');
    var min = String(d.getMinutes()).padStart(2, '0');
    var sec = String(d.getSeconds()).padStart(2, '0');
    return day + '/' + month + '/' + year + ' ' + h + ':' + min + ':' + sec;
  }

  function getBadgeClass(accion) {
    switch (String(accion || '').toUpperCase()) {
      case 'CREAR': return 'badge-entrada';
      case 'EDITAR': return 'badge-editar';
      case 'ELIMINAR': return 'badge-salida';
      case 'ENTREGAR': return 'badge-entrada';
      case 'QUITAR': return 'badge-salida';
      case 'LOGIN': return 'badge-login';
      case 'LOGOUT': return 'badge-logout';
      default: return '';
    }
  }

  function buildFiltros() {
    var f = {};
    var modulo = filtroModulo ? filtroModulo.value : '';
    var accion = filtroAccion ? filtroAccion.value : '';
    var usuario = filtroUsuario ? filtroUsuario.value.trim() : '';
    var dependencia = filtroDependencia ? filtroDependencia.value.trim() : '';
    var desde = filtroDesde ? filtroDesde.value : '';
    var hasta = filtroHasta ? filtroHasta.value : '';
    var q = filtroQ ? filtroQ.value.trim() : '';
    if (modulo) f.modulo = modulo;
    if (accion) f.accion = accion;
    if (usuario) f.usuario = usuario;
    if (dependencia) f.dependencia = dependencia;
    if (desde) f.desde = new Date(desde + 'T00:00:00').toISOString();
    if (hasta) f.hasta = new Date(hasta + 'T23:59:59').toISOString();
    if (q) f.q = q;
    return f;
  }

  async function cargarAuditoria() {
    if (!window.stockAPI || !window.stockAPI.getAuditLog) {
      if (lista) lista.innerHTML = '<tr><td colspan="5" class="empty-state">API de auditoría no disponible.</td></tr>';
      return;
    }

    if (window.appLoading && window.appLoading.show) window.appLoading.show('Cargando historial…');
    try {
      var filtros = buildFiltros();
      var entries = await window.stockAPI.getAuditLog(filtros);

      if (!entries || !entries.length) {
        if (lista) lista.innerHTML = '';
        if (emptyMsg) emptyMsg.style.display = 'block';
        lastAuditEntries = [];
        var pcAE = document.getElementById('pag-auditoria');
        if (pcAE) pcAE.innerHTML = '';
        return;
      }

      if (emptyMsg) emptyMsg.style.display = 'none';
      lastAuditEntries = entries;

      renderAuditPage();
    } catch (err) {
      console.error('[Auditoría] Error:', err);
      if (lista) lista.innerHTML = '<tr><td colspan="5" class="empty-state">Error al cargar historial.</td></tr>';
    } finally {
      if (window.appLoading && window.appLoading.hide) window.appLoading.hide();
    }
  }

  function renderAuditPage() {
    if (!lista) return;
    var info = window.Paginacion ? window.Paginacion.paginar(lastAuditEntries, pagAudit, PAG_SIZE) : { items: lastAuditEntries, pagina: 1, totalPaginas: 1, total: lastAuditEntries.length, inicio: 1, fin: lastAuditEntries.length };
    pagAudit = info.pagina;
    lista.innerHTML = info.items.map(function (e) {
      var badgeClass = getBadgeClass(e.accion);
      var badge = '<span class="badge ' + badgeClass + '">' + escapeHtml(e.accion) + '</span>';
      return '<tr>' +
        '<td>' + escapeHtml(formatFecha(e.fecha)) + '</td>' +
        '<td><strong>' + escapeHtml(e.usuario) + '</strong></td>' +
        '<td>' + badge + '</td>' +
        '<td>' + escapeHtml(e.modulo) + '</td>' +
        '<td>' + escapeHtml(e.detalle) + '</td>' +
        '</tr>';
    }).join('');
    var pcAudit = document.getElementById('pag-auditoria');
    if (pcAudit && window.Paginacion) {
      window.Paginacion.renderControles(pcAudit, info, function (p) { pagAudit = p; renderAuditPage(); });
    }
  }

  if (btnFiltrar) btnFiltrar.addEventListener('click', function () { pagAudit = 1; cargarAuditoria(); });
  if (btnRefrescar) btnRefrescar.addEventListener('click', function () { pagAudit = 1; cargarAuditoria(); });
  if (btnExportar) btnExportar.addEventListener('click', function () {
    if (!lastAuditEntries || !lastAuditEntries.length) {
      showToast('No hay registros para exportar', 'error');
      return;
    }
    exportarCsv(lastAuditEntries);
  });

  window._realtimeRefresh = function (table) {
    if (!table || table === 'audit_log') cargarAuditoria();
  };

  cargarAuditoria();

  function showToast(message, type) {
    if (window.showToast) return window.showToast(message, type);
    // fallback mínimo
    try { alert(message); } catch (_) {}
  }

  function exportarCsv(entries) {
    var header = ['fecha', 'usuario', 'accion', 'modulo', 'detalle', 'entidadId'];
    var rows = entries.map(function (e) {
      return [
        e.fecha || '',
        e.usuario || '',
        e.accion || '',
        e.modulo || '',
        e.detalle || '',
        e.entidadId || ''
      ].map(csvCell).join(',');
    });
    var csv = header.join(',') + '\n' + rows.join('\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var stamp = new Date();
    var y = stamp.getFullYear();
    var m = String(stamp.getMonth() + 1).padStart(2, '0');
    var d = String(stamp.getDate()).padStart(2, '0');
    a.href = url;
    a.download = 'auditoria_' + y + '-' + m + '-' + d + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { try { URL.revokeObjectURL(url); } catch (_) {} }, 500);
  }

  function csvCell(v) {
    var s = (v == null) ? '' : String(v);
    // escape de comillas
    s = s.replace(/"/g, '""');
    // envolver si hay coma, comillas o saltos
    if (/[",\n\r]/.test(s)) return '"' + s + '"';
    return s;
  }
})();
