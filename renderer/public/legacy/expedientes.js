(function () {
  'use strict';

  var selectedExpedienteId = null;
  var editingExpedienteId = null;
  var cachedData = { productos: [], movimientos: [], dependencias: [], guardiaProvisiones: [] };

  var pagExpLista = 1;
  var pagExpDetalle = 1;
  var PAG_SIZE = (window.Paginacion && window.Paginacion.DEFAULT_POR_PAGINA) || 50;

  const lista = document.getElementById('lista-expedientes-page');
  const btnAgregar = document.getElementById('btn-agregar-expediente');
  const modal = document.getElementById('modal-expediente');
  const form = document.getElementById('form-expediente');
  const inputNumero = document.getElementById('expediente-numero');
  const inputAnio = document.getElementById('expediente-anio');
  const inputSolicitadoPor = document.getElementById('expediente-solicitado-por');

  var panels = {
    'lista-expedientes': document.getElementById('panel-lista-expedientes'),
    'detalle-expediente': document.getElementById('panel-detalle-expediente')
  };
  var tabButtons = document.querySelectorAll('.tab');
  var tabDetalle = document.getElementById('tab-detalle-expediente');

  var detalleTitulo = document.getElementById('detalle-expediente-titulo');
  var detalleDesc = document.getElementById('detalle-expediente-desc');
  var listaProductosExp = document.getElementById('lista-productos-expediente');
  var btnVolverLista = document.getElementById('btn-volver-lista');
  var btnAgregarProductoExp = document.getElementById('btn-agregar-producto-expediente');
  var btnExportarDetalleExp = document.getElementById('btn-exportar-expediente-detalle');
  var inputBuscarDetalleExp = document.getElementById('buscar-productos-expediente');

  // Modal info entregas
  var modalInfoEntregas = document.getElementById('modal-info-entregas');
  var infoEntregasTbody = document.getElementById('info-entregas-tbody');
  var infoEntregasEmpty = document.getElementById('info-entregas-empty');
  var infoEntregasDesc = document.getElementById('info-entregas-desc');

  var modalProductoExp = document.getElementById('modal-producto-expediente');
  var formProductoExp = document.getElementById('form-producto-expediente');
  var modalEditarMovExp = document.getElementById('modal-editar-mov-expediente');
  var formEditarMovExp = document.getElementById('form-editar-mov-expediente');

  // Wizard de series por unidad (cantidad > 1)
  var modalSeriesExp = document.getElementById('modal-series-expediente');
  var seriesStepModo = document.getElementById('series-exp-step-modo');
  var seriesStepWizard = document.getElementById('series-exp-step-wizard');
  var seriesCantEl = document.getElementById('series-exp-cant');
  var seriesProgresoEl = document.getElementById('series-exp-progreso');
  var seriesContadorEl = document.getElementById('series-exp-contador');
  var seriesInputEl = document.getElementById('series-exp-input');
  var seriesErrorEl = document.getElementById('series-exp-error');
  var seriesPasteEl = document.getElementById('series-exp-paste');
  var btnSeriesSin = document.getElementById('series-exp-btn-sin');
  var btnSeriesSi = document.getElementById('series-exp-btn-si');
  var btnSeriesPrev = document.getElementById('series-exp-btn-prev');
  var btnSeriesNext = document.getElementById('series-exp-btn-next');
  var btnSeriesAplicarPaste = document.getElementById('series-exp-btn-aplicar-paste');
  var btnSeriesLimpiar = document.getElementById('series-exp-btn-limpiar');

  var pendingMovimientoBase = null;
  var pendingCantidad = 0;
  var seriesList = [];
  var seriesIdx = 0;
  var pendingReplaceMovimientoId = null;

  // Inline wizard en modal "Editar producto" (botón ✓ junto al Nº de serie)
  var editSeriesActive = false;
  var editSeriesList = [];
  var editSeriesIdx = 0;
  var editSeriesCantidad = 0;
  var editSeriesBaseMovimiento = null;
  var editSeriesReplaceMovimientoId = null;

  // Inline wizard en modal "Agregar producto" (botón ✓ junto al Nº de serie)
  var addSeriesActive = false;
  var addSeriesList = [];
  var addSeriesIdx = 0;
  var addSeriesCantidad = 0;
  var addSeriesBaseMovimiento = null;

  // Modal minimalista: eliminar expediente
  var modalConfirmEliminarExp = document.getElementById('modal-confirm-eliminar-expediente');
  var confirmEliminarExpTitulo = document.getElementById('confirm-eliminar-expediente-titulo');
  var confirmEliminarExpTexto = document.getElementById('confirm-eliminar-expediente-texto');
  var confirmEliminarExpCascadeWrap = document.getElementById('confirm-eliminar-expediente-cascade-wrap');
  var confirmEliminarExpCascade = document.getElementById('confirm-eliminar-expediente-cascade');
  var btnConfirmEliminarExp = document.getElementById('btn-confirm-eliminar-expediente');
  var pendingDeleteExpedienteId = null;
  var esAdmin = false;

  function showToast(message, type) {
    var existing = document.querySelector('.toast');
    if (existing) existing.remove();
    var toast = document.createElement('div');
    toast.className = 'toast ' + (type || 'success');
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function () { toast.remove(); }, 3500);
  }

  function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function setFormSubmitLoading(form, loadingText) {
    if (!form) return false;
    var submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
    if (!submitBtn) return false;
    if (submitBtn.dataset && submitBtn.dataset.submitting === '1') return false;

    if (submitBtn.dataset) submitBtn.dataset.submitting = '1';
    if (submitBtn.dataset && !submitBtn.dataset.originalSubmitLabel) {
      submitBtn.dataset.originalSubmitLabel = submitBtn.tagName === 'INPUT' ? submitBtn.value : submitBtn.textContent;
    }
    if (submitBtn.tagName === 'INPUT') submitBtn.value = loadingText;
    else submitBtn.textContent = loadingText;
    submitBtn.disabled = true;
    return true;
  }

  function clearFormSubmitLoading(form) {
    if (!form) return;
    var submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
    if (!submitBtn) return;
    if (submitBtn.dataset && submitBtn.dataset.submitting) submitBtn.dataset.submitting = '0';
    if (submitBtn.dataset && submitBtn.dataset.originalSubmitLabel != null) {
      var original = submitBtn.dataset.originalSubmitLabel;
      if (submitBtn.tagName === 'INPUT') submitBtn.value = original;
      else submitBtn.textContent = original;
    }
    submitBtn.disabled = false;
  }

  function getDepLabelFromList(depId) {
    if (!depId) return '—';
    var deps = cachedData.dependencias || [];
    var d = deps.find(function (x) { return x.id === depId; });
    if (!d) return '—';
    var codigo = (d.codigo || '').toString().trim();
    var nombre = (d.nombre || '').toString().trim();
    var numero = (d.numero || '').toString().trim();
    if (d.parentId) {
      var parent = deps.find(function (p) { return p.id === d.parentId; });
      if (parent && (parent.codigo || '')) codigo = (parent.codigo || '').toString().trim();
    }
    if (d.parentId && numero) return [codigo, numero, nombre].filter(Boolean).join(' - ') || nombre || codigo || '—';
    if (codigo && nombre) return codigo + ' - ' + nombre;
    if (numero && nombre) return numero + ' - ' + nombre;
    return nombre || codigo || '—';
  }

  async function ensureDepsLoaded() {
    if (cachedData.dependencias && Array.isArray(cachedData.dependencias) && cachedData.dependencias.length) return;
    if (!window.stockAPI || !window.stockAPI.getDependencias) { cachedData.dependencias = cachedData.dependencias || []; return; }
    try {
      var deps = await window.stockAPI.getDependencias();
      cachedData.dependencias = Array.isArray(deps) ? deps : [];
    } catch (_) {
      cachedData.dependencias = cachedData.dependencias || [];
    }
  }

  async function openModalInfoEntregas(movId) {
    if (!modalInfoEntregas || !infoEntregasTbody) return;
    await ensureDepsLoaded();
    var provs = (cachedData.guardiaProvisiones || []).filter(function (p) { return p && p.movimiento_id === movId; });
    provs.sort(function (a, b) { return new Date(b.fecha_asignacion || 0) - new Date(a.fecha_asignacion || 0); });
    if (infoEntregasEmpty) infoEntregasEmpty.style.display = provs.length ? 'none' : 'block';
    if (infoEntregasDesc) infoEntregasDesc.textContent = 'Entregas registradas para este producto (' + provs.length + ').';
    if (!provs.length) {
      infoEntregasTbody.innerHTML = '';
      modalInfoEntregas.classList.add('open');
      return;
    }
    // Si por algún motivo la provisión no trae `usuario`, lo tomamos del movimiento.
    var movUsuario = '';
    var mov = (cachedData.movimientos || []).find(function (m) { return m && m.id === movId; });
    if (mov) movUsuario = (mov.usuario || mov.user || mov.username || mov.email || '').toString().trim() || '';
    infoEntregasTbody.innerHTML = provs.map(function (p) {
      var fecha = p.fecha_asignacion ? new Date(p.fecha_asignacion).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
      var dep = getDepLabelFromList(p.dependencia_id);
      var cant = p.cantidad != null ? p.cantidad : 1;
      var conc = (p.concepto || '').toString().trim() || '—';
      var usuario = (p.usuario || p.user || p.username || p.email || '').toString().trim() || movUsuario || '—';
      return '<tr><td>' + escapeHtml(fecha) + '</td><td>' + escapeHtml(dep) + '</td><td class="num-col">' + escapeHtml(String(cant)) + '</td><td>' + escapeHtml(conc) + '</td><td>' + escapeHtml(usuario) + '</td></tr>';
    }).join('');
    modalInfoEntregas.classList.add('open');
  }

  function closeModalInfoEntregas() {
    if (modalInfoEntregas) modalInfoEntregas.classList.remove('open');
  }

  async function ensureAuth() {
    if (!window.stockAPI) return false;
    try {
      var status = await window.stockAPI.getAuthStatus();
      if (!status || !status.hasUser) {
        window.location.href = 'index.html';
        return false;
      }
      esAdmin = ((status.rol || 'usuario').toString().toLowerCase() === 'admin');
      return true;
    } catch (e) {
      return true;
    }
  }

  function openModalConfirmEliminarExpediente(expId) {
    if (!esAdmin) {
      showToast('Solo admin puede eliminar expedientes.', 'error');
      return;
    }
    pendingDeleteExpedienteId = expId || null;
    if (!modalConfirmEliminarExp) return;

    var exp = (cachedData.productos || []).find(function (p) { return p.id === expId; });
    var codigo = exp ? ((exp.codigo || exp.id || '').toString().trim() || '—') : '—';
    var tieneMovs = (cachedData.movimientos || []).some(function (m) { return m.productoId === expId; });

    if (confirmEliminarExpTitulo) confirmEliminarExpTitulo.textContent = 'Eliminar expediente';
    if (confirmEliminarExpTexto) {
      confirmEliminarExpTexto.innerHTML = '¿Seguro que querés eliminar el expediente <strong>' + escapeHtml(codigo) + '</strong>?';
      if (tieneMovs) {
        confirmEliminarExpTexto.innerHTML += '<br><span class="text-muted">Este expediente tiene movimientos registrados.</span>';
      }
    }

    if (confirmEliminarExpCascade) confirmEliminarExpCascade.checked = false;
    if (confirmEliminarExpCascadeWrap) {
      confirmEliminarExpCascadeWrap.style.display = (tieneMovs && esAdmin) ? 'block' : 'none';
    }

    modalConfirmEliminarExp.classList.add('open');
  }

  function closeModalConfirmEliminarExpediente() {
    pendingDeleteExpedienteId = null;
    if (modalConfirmEliminarExp) modalConfirmEliminarExp.classList.remove('open');
    if (confirmEliminarExpCascade) confirmEliminarExpCascade.checked = false;
  }

  async function loadData() {
    if (!window.stockAPI) return { productos: [], movimientos: [], guardiaProvisiones: [] };
    try {
      var data = await window.stockAPI.getData();
      if (!data || !Array.isArray(data.productos)) data = { productos: [] };
      if (!Array.isArray(data.movimientos)) data.movimientos = [];
      if (!Array.isArray(data.guardiaProvisiones)) data.guardiaProvisiones = [];
      return data;
    } catch (e) {
      showToast('Error al cargar expedientes', 'error');
      return { productos: [], movimientos: [], guardiaProvisiones: [] };
    }
  }

  function openTab(tabName) {
    tabButtons.forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    Object.keys(panels).forEach(function (key) {
      if (panels[key]) panels[key].classList.toggle('active', key === tabName);
    });
  }

  var inputBuscarExp = document.getElementById('buscar-expedientes');
  var selectOrdenarExp = document.getElementById('ordenar-expedientes');

  function getAnioParaOrden(p) {
    var anioVal = (p.anio || '').toString().trim();
    if (!anioVal && (p.codigo || '')) {
      var match = (p.codigo || '').toString().match(/\b(19|20)\d{2}\b/);
      if (match) anioVal = match[0];
    }
    return anioVal ? parseInt(anioVal, 10) : 0;
  }

  function renderExpedientes(productos) {
    if (!lista) return;
    var movimientos = cachedData.movimientos || [];
    var guardiaProvisiones = cachedData.guardiaProvisiones || [];
    var provistosPorMov = {};
    guardiaProvisiones.forEach(function (p) {
      if (p.movimiento_id) provistosPorMov[p.movimiento_id] = (provistosPorMov[p.movimiento_id] || 0) + (p.cantidad != null ? p.cantidad : 1);
    });
    function tieneStockDisponible(expId) {
      var entradas = movimientos.filter(function (m) { return m.tipo === 'entrada' && m.productoId === expId; });
      if (!entradas.length) return false;
      for (var i = 0; i < entradas.length; i++) {
        var cant = parseInt(entradas[i].cantidad, 10) || 0;
        var prov = provistosPorMov[entradas[i].id] || 0;
        if (cant - prov > 0) return true;
      }
      return false;
    }
    function tieneAlgunaEntrada(expId) {
      return (movimientos || []).some(function (m) { return m && m.tipo === 'entrada' && m.productoId === expId; });
    }
    var busqueda = (inputBuscarExp && inputBuscarExp.value || '').trim().toLowerCase();
    var orden = (selectOrdenarExp && selectOrdenarExp.value) || 'numero-asc';
    var filtrados = (productos || []).filter(function (p) {
      if (!busqueda) return true;
      var codigo = ((p.codigo || '') + ' ' + (p.nombre || '')).trim().toLowerCase();
      var anio = ((p.anio || '') + '').toLowerCase();
      if (!anio && (p.codigo || '')) {
        var m = (p.codigo || '').toString().match(/\b(19|20)\d{2}\b/);
        if (m) anio = m[0];
      }
      var solicitado = (p.solicitadoPor || '').toString().trim().toLowerCase();
      var esVacio = !tieneAlgunaEntrada(p.id);
      var esActivo = !esVacio && tieneStockDisponible(p.id);
      var estadoStr = esVacio ? 'vacio' : (esActivo ? 'activo' : 'entregado');
      return codigo.indexOf(busqueda) >= 0 || anio.indexOf(busqueda) >= 0 || solicitado.indexOf(busqueda) >= 0 || estadoStr.indexOf(busqueda) >= 0;
    });
    if (!filtrados.length) {
      lista.innerHTML = '<tr><td colspan="5" class="empty-state"><p>' + (busqueda ? 'Ningún expediente coincide con &quot;' + escapeHtml(busqueda) + '&quot;.' : 'No hay expedientes. Usa "Agregar expediente".') + '</p></td></tr>';
      var pcEmpty = document.getElementById('pag-expedientes');
      if (pcEmpty) pcEmpty.innerHTML = '';
      return;
    }
    var ordenados = filtrados.slice().sort(function (a, b) {
      if (orden === 'numero-asc') {
        var ca = (a.codigo || '').toString().toLowerCase();
        var cb = (b.codigo || '').toString().toLowerCase();
        return ca.localeCompare(cb, 'es');
      }
      if (orden === 'numero-desc') {
        var ca = (a.codigo || '').toString().toLowerCase();
        var cb = (b.codigo || '').toString().toLowerCase();
        return cb.localeCompare(ca, 'es');
      }
      var aa = getAnioParaOrden(a);
      var bb = getAnioParaOrden(b);
      if (orden === 'anio-desc') return bb - aa;
      if (orden === 'anio-asc') return aa - bb;
      return 0;
    });
    var infoExpList = window.Paginacion ? window.Paginacion.paginar(ordenados, pagExpLista, PAG_SIZE) : { items: ordenados, pagina: 1, totalPaginas: 1, total: ordenados.length, inicio: 1, fin: ordenados.length };
    pagExpLista = infoExpList.pagina;
    lista.innerHTML = infoExpList.items.map(function (p) {
      var codigo = (p.codigo || '').toString().trim() || '-';
      var anioVal = (p.anio || '').toString().trim();
      if (!anioVal && codigo !== '-') {
        var match = codigo.match(/\b(19|20)\d{2}\b/);
        if (match) anioVal = match[0];
      }
      var anio = anioVal || '—';
      var solicitadoPor = (p.solicitadoPor || '').toString().trim() || '—';
      var vacio = !tieneAlgunaEntrada(p.id);
      var activo = !vacio && tieneStockDisponible(p.id);
      var estadoClase = vacio ? 'estado-exp-vacio' : (activo ? 'estado-exp-activo' : 'estado-exp-entregado');
      var estadoTexto = vacio ? 'VACÍO' : (activo ? 'ACTIVO' : 'ENTREGADO');
      var acciones = '<div class="exp-acciones-wrap"><button type="button" class="btn btn-icon btn-menu-exp" data-exp-id="' + escapeHtml(p.id) + '" aria-label="Acciones">&#8942;</button><div class="exp-menu-dropdown">' + (esAdmin ? '<button type="button" class="exp-list-editar" data-exp-id="' + escapeHtml(p.id) + '">Editar</button>' : '') + (esAdmin ? '<button type="button" class="exp-list-eliminar" data-exp-id="' + escapeHtml(p.id) + '">Eliminar</button>' : '') + '</div></div>';
      return '<tr><td><button type="button" class="link-expediente numero-expediente-badge" data-id="' + escapeHtml(p.id) + '" title="Ver productos del expediente">' + escapeHtml(codigo) + '</button></td><td>' + escapeHtml(anio) + '</td><td>' + escapeHtml(solicitadoPor) + '</td><td><span class="estado-exp-badge ' + estadoClase + '">' + escapeHtml(estadoTexto) + '</span></td><td class="td-acciones-exp">' + acciones + '</td></tr>';
    }).join('');

    lista.querySelectorAll('.link-expediente').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openDetalleExpediente(btn.getAttribute('data-id'));
      });
    });

    lista.querySelectorAll('.btn-menu-exp').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var wrap = btn.closest('.exp-acciones-wrap');
        var dropdown = wrap ? wrap.querySelector('.exp-menu-dropdown') : null;
        lista.querySelectorAll('.exp-menu-dropdown').forEach(function (d) {
          if (d !== dropdown) d.classList.remove('exp-menu-open');
        });
        if (dropdown) dropdown.classList.toggle('exp-menu-open');
      });
    });
    lista.querySelectorAll('.exp-list-editar').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!esAdmin) {
          showToast('Solo admin puede editar expedientes.', 'error');
          return;
        }
        var expId = btn.getAttribute('data-exp-id');
        var wrap = btn.closest('.exp-acciones-wrap');
        if (wrap) { var d = wrap.querySelector('.exp-menu-dropdown'); if (d) d.classList.remove('exp-menu-open'); }
        var exp = (cachedData.productos || []).find(function (p) { return p.id === expId; });
        if (exp) openModalEditarExpediente(exp);
      });
    });
    lista.querySelectorAll('.exp-list-eliminar').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-exp-id');
        var wrap = btn.closest('.exp-acciones-wrap');
        if (wrap) { var d = wrap.querySelector('.exp-menu-dropdown'); if (d) d.classList.remove('exp-menu-open'); }
        if (!id) return;
        openModalConfirmEliminarExpediente(id);
      });
    });

    var pcExp = document.getElementById('pag-expedientes');
    if (pcExp && window.Paginacion) {
      window.Paginacion.renderControles(pcExp, infoExpList, function (p) { pagExpLista = p; renderExpedientes(productos); });
    }
  }

  async function confirmarEliminarExpedienteDesdeModal() {
    if (!esAdmin) {
      showToast('Solo admin puede eliminar expedientes.', 'error');
      closeModalConfirmEliminarExpediente();
      return;
    }
    var id = pendingDeleteExpedienteId;
    if (!id || !window.stockAPI) return;
    var doCascade = !!(confirmEliminarExpCascadeWrap && confirmEliminarExpCascadeWrap.style.display !== 'none' && confirmEliminarExpCascade && confirmEliminarExpCascade.checked);

    if (window.appLoading && window.appLoading.show) window.appLoading.show(doCascade ? 'Eliminando en cascada…' : 'Eliminando expediente…');
    try {
      if (doCascade && window.stockAPI.deleteExpedienteCascade) {
        await window.stockAPI.deleteExpedienteCascade(id);
      } else {
        await window.stockAPI.deleteProducto(id);
      }

      closeModalConfirmEliminarExpediente();
      showToast(doCascade ? 'Expediente eliminado (con movimientos)' : 'Expediente eliminado');

      // Actualización optimista inmediata
      if (cachedData && Array.isArray(cachedData.productos)) {
        cachedData.productos = cachedData.productos.filter(function (p) { return p.id !== id; });
      }
      if (selectedExpedienteId === id) {
        selectedExpedienteId = null;
        if (tabDetalle) tabDetalle.disabled = true;
        openTab('lista-expedientes');
      }
      renderExpedientes(cachedData.productos || []);
      run();
    } catch (err) {
      var msg = (err && err.message) ? err.message : 'Error al eliminar';
      showToast(msg, 'error');
    } finally {
      if (window.appLoading && window.appLoading.hide) window.appLoading.hide();
    }
  }

  function renderDetalleExpediente() {
    if (!listaProductosExp) return;
    if (!selectedExpedienteId) {
      listaProductosExp.innerHTML = '<tr><td colspan="7" class="empty-state"><p>Selecciona un expediente.</p></td></tr>';
      return;
    }

    var exp = (cachedData.productos || []).find(function (p) { return p.id === selectedExpedienteId; });
    var codigo = exp ? ((exp.codigo || '').toString().trim() || '—') : '—';
    var solicitadoPor = exp && (exp.solicitadoPor || '').toString().trim() ? exp.solicitadoPor : '';
    if (detalleTitulo) detalleTitulo.textContent = 'Expediente ' + codigo;
    if (detalleDesc) detalleDesc.textContent = 'Productos cargados dentro del expediente ' + codigo + (solicitadoPor ? '. Solicitado por: ' + solicitadoPor : '.');

    var entradas = (cachedData.movimientos || []).filter(function (m) {
      return m.tipo === 'entrada' && m.productoId === selectedExpedienteId;
    });

    var provistosGuardiaPorMov = {};
    (cachedData.guardiaProvisiones || []).forEach(function (p) {
      if (p.movimiento_id) provistosGuardiaPorMov[p.movimiento_id] = (provistosGuardiaPorMov[p.movimiento_id] || 0) + (p.cantidad != null ? p.cantidad : 1);
    });

    if (!entradas.length) {
      listaProductosExp.innerHTML = '<tr><td colspan="7" class="empty-state"><p>No hay productos en este expediente. Usa "Agregar producto".</p></td></tr>';
      return;
    }

    var busqueda = (inputBuscarDetalleExp && inputBuscarDetalleExp.value || '').trim().toLowerCase();
    var filtradas = entradas;
    if (busqueda) {
      filtradas = entradas.filter(function (m) {
        var parts = [
          m.nombre,
          m.marca,
          m.concepto,
          m.numeroSerie,
          m.fecha ? new Date(m.fecha).toLocaleString('es-ES') : ''
        ].map(function (x) { return (x == null ? '' : String(x)); }).join(' ').toLowerCase();
        return parts.indexOf(busqueda) >= 0;
      });
    }

    if (busqueda && filtradas.length === 0) {
      listaProductosExp.innerHTML = '<tr><td colspan="7" class="empty-state"><p>No hay resultados para &quot;' + escapeHtml(busqueda) + '&quot;.</p></td></tr>';
      var pcDetE = document.getElementById('pag-expediente-detalle');
      if (pcDetE) pcDetE.innerHTML = '';
      return;
    }

    var ordenadas = filtradas.slice().sort(function (a, b) {
      return new Date(b.fecha || 0) - new Date(a.fecha || 0);
    });

    var infoExpDet = window.Paginacion ? window.Paginacion.paginar(ordenadas, pagExpDetalle, PAG_SIZE) : { items: ordenadas, pagina: 1, totalPaginas: 1, total: ordenadas.length, inicio: 1, fin: ordenadas.length };
    pagExpDetalle = infoExpDet.pagina;
    listaProductosExp.innerHTML = infoExpDet.items.map(function (m) {
      var fecha = m.fecha ? new Date(m.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
      var recibido = parseInt(m.cantidad, 10) || 0;
      var provistoGuardia = provistosGuardiaPorMov[m.id] || 0;
      var disponible = Math.max(0, recibido - provistoGuardia);
      var claseCelda = disponible === 0 ? 'stock-cell stock-cell-cero' : 'stock-cell';
      var extra = (provistoGuardia > 0)
        ? '<button type="button" class="exp-menu-entregas" data-mov-id="' + escapeHtml(m.id) + '">Ver entrega(s)</button>'
        : '';
      var acciones = '<div class="exp-acciones-wrap"><button type="button" class="btn btn-icon btn-menu-exp" data-mov-id="' + escapeHtml(m.id) + '" aria-label="Acciones">&#8942;</button><div class="exp-menu-dropdown">' + extra + (esAdmin ? '<button type="button" class="exp-menu-editar" data-mov-id="' + escapeHtml(m.id) + '">Editar</button>' : '') + (esAdmin ? '<button type="button" class="exp-menu-eliminar" data-mov-id="' + escapeHtml(m.id) + '">Eliminar</button>' : '') + '</div></div>';
      var dispLabel = (disponible === 0) ? 'AGOTADO' : String(disponible);
      return '<tr><td class="' + claseCelda + ' num-col">' + recibido + ' / ' + escapeHtml(dispLabel) + '</td><td>' + escapeHtml(m.nombre || '-') + '</td><td>' + escapeHtml(m.marca || '-') + '</td><td>' + escapeHtml(m.concepto || '-') + '</td><td>' + escapeHtml(m.numeroSerie || '-') + '</td><td>' + escapeHtml(fecha) + '</td><td class="td-acciones-exp">' + acciones + '</td></tr>';
    }).join('');

    listaProductosExp.querySelectorAll('.btn-menu-exp').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var wrap = btn.closest('.exp-acciones-wrap');
        var dropdown = wrap ? wrap.querySelector('.exp-menu-dropdown') : null;
        listaProductosExp.querySelectorAll('.exp-menu-dropdown').forEach(function (d) {
          if (d !== dropdown) d.classList.remove('exp-menu-open');
        });
        if (dropdown) dropdown.classList.toggle('exp-menu-open');
      });
    });
    listaProductosExp.querySelectorAll('.exp-menu-editar').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!esAdmin) {
          showToast('Solo admin puede editar productos del expediente.', 'error');
          return;
        }
        var movId = btn.getAttribute('data-mov-id');
        var wrap = btn.closest('.exp-acciones-wrap');
        if (wrap) { var d = wrap.querySelector('.exp-menu-dropdown'); if (d) d.classList.remove('exp-menu-open'); }
        var mov = (cachedData.movimientos || []).find(function (x) { return x.id === movId; });
        if (mov) openModalEditarMovExp(mov);
      });
    });
    listaProductosExp.querySelectorAll('.exp-menu-eliminar').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var movId = btn.getAttribute('data-mov-id');
        var wrap = btn.closest('.exp-acciones-wrap');
        if (wrap) { var d = wrap.querySelector('.exp-menu-dropdown'); if (d) d.classList.remove('exp-menu-open'); }
        openModalConfirmEliminarMovimientoExp(movId);
      });
    });

    // Modal propio para confirmar eliminación (evita confirm() nativo y el bug de foco)
    function openModalConfirmEliminarMovimientoExp(movId) {
      if (!esAdmin) {
        showToast('Solo admin puede eliminar productos del expediente.', 'error');
        return;
      }
      var modal = document.getElementById('modal-confirm-eliminar-mov-exp');
      var btnNo = document.getElementById('btn-confirm-eliminar-mov-exp-no');
      var btnSi = document.getElementById('btn-confirm-eliminar-mov-exp-si');
      var texto = document.getElementById('confirm-eliminar-mov-exp-texto');
      if (!modal || !btnNo || !btnSi) {
        // Fallback ultra defensivo
        if (!movId) return;
        window.stockAPI.deleteMovimiento(movId).then(function () {
          showToast('Producto eliminado');
          refresh().then(function () { renderDetalleExpediente(); });
        }).catch(function (err) {
          showToast(err && err.message ? err.message : 'Error al eliminar', 'error');
        });
        return;
      }

      if (texto) texto.textContent = '¿Seguro que quiere eliminar este producto del expediente?';
      modal.classList.add('open');

      function close() {
        modal.classList.remove('open');
        cleanup();
      }
      function cleanup() {
        btnNo.removeEventListener('click', onNo);
        btnSi.removeEventListener('click', onSi);
        document.querySelectorAll('.modal-confirm-eliminar-mov-exp-close').forEach(function (b) {
          if (b) b.removeEventListener('click', close);
        });
        modal.removeEventListener('click', onBackdrop);
      }
      function onBackdrop(e) {
        if (e && e.target === modal) close();
      }
      function onNo() { close(); }
      function onSi() {
        if (!movId) { close(); return; }
        close();
        window.stockAPI.deleteMovimiento(movId).then(function () {
          showToast('Producto eliminado');
          refresh().then(function () { renderDetalleExpediente(); });
        }).catch(function (err) {
          showToast(err && err.message ? err.message : 'Error al eliminar', 'error');
        });
      }

      btnNo.addEventListener('click', onNo);
      btnSi.addEventListener('click', onSi);
      document.querySelectorAll('.modal-confirm-eliminar-mov-exp-close').forEach(function (b) {
        if (b) b.addEventListener('click', close);
      });
      modal.addEventListener('click', onBackdrop);
      // Enfocar el botón "Eliminar" para que teclado/Enter funcione
      setTimeout(function () { try { btnSi.focus(); } catch (_) {} }, 0);
    }

    listaProductosExp.querySelectorAll('.exp-menu-entregas').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var movId = btn.getAttribute('data-mov-id');
        if (!movId) return;
        var wrap = btn.closest('.exp-acciones-wrap');
        if (wrap) { var d = wrap.querySelector('.exp-menu-dropdown'); if (d) d.classList.remove('exp-menu-open'); }
        openModalInfoEntregas(movId);
      });
    });

    var pcDet = document.getElementById('pag-expediente-detalle');
    if (pcDet && window.Paginacion) {
      window.Paginacion.renderControles(pcDet, infoExpDet, function (p) { pagExpDetalle = p; renderDetalleExpediente(); });
    }
  }

  async function openDetalleExpediente(expedienteId) {
    selectedExpedienteId = expedienteId;
    if (tabDetalle) tabDetalle.disabled = false;
    openTab('detalle-expediente');
    await refresh();
    renderDetalleExpediente();
  }

  function openModal() {
    if (!modal || !inputNumero) return;
    editingExpedienteId = null;
    form.reset();
    if (inputAnio) inputAnio.value = '';
    if (inputSolicitadoPor) inputSolicitadoPor.value = '';
    modal.classList.add('open');
    inputNumero.removeAttribute('readonly');
    inputNumero.disabled = false;
    setTimeout(function () {
      inputNumero.focus();
    }, 100);
  }

  function openModalEditarExpediente(exp) {
    if (!esAdmin) {
      showToast('Solo admin puede editar expedientes.', 'error');
      return;
    }
    if (!modal || !inputNumero) return;
    editingExpedienteId = exp.id;
    inputNumero.value = (exp.codigo || '').toString().trim();
    if (inputAnio) inputAnio.value = (exp.anio || '').toString().trim();
    if (inputSolicitadoPor) inputSolicitadoPor.value = (exp.solicitadoPor || '').toString().trim();
    modal.classList.add('open');
    inputNumero.removeAttribute('readonly');
    inputNumero.disabled = false;
    setTimeout(function () { inputNumero.focus(); }, 100);
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('open');
    editingExpedienteId = null;
  }

  function openModalProductoExpediente() {
    if (!selectedExpedienteId) {
      showToast('Primero selecciona un expediente', 'error');
      return;
    }
    if (!modalProductoExp || !formProductoExp) return;
    formProductoExp.reset();
    stopAddSeriesMode();
    var fechaEl = document.getElementById('producto-exp-fecha');
    if (fechaEl && !fechaEl.value) {
      var now = new Date();
      fechaEl.value = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0') + 'T' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    }
    modalProductoExp.classList.add('open');
    updateBtnCargarSeriesAgregar();
    var inputNombre = document.getElementById('producto-exp-nombre');
    if (inputNombre) {
      inputNombre.disabled = false;
      inputNombre.removeAttribute('readonly');
      // En algunos casos (Electron/overlay) el focus inmediato falla: forzamos foco después del paint
      setTimeout(function () {
        try { inputNombre.focus(); } catch (e) {}
      }, 50);
    }
  }

  function closeModalProductoExpediente() {
    if (!modalProductoExp) return;
    modalProductoExp.classList.remove('open');
    stopAddSeriesMode();
  }

  function hideSeriesError() {
    if (!seriesErrorEl) return;
    seriesErrorEl.style.display = 'none';
    seriesErrorEl.textContent = '';
  }

  function showSeriesError(msg) {
    if (!seriesErrorEl) return;
    seriesErrorEl.style.display = 'block';
    seriesErrorEl.textContent = msg || 'Error';
  }

  function normalizeSerie(s) {
    return String(s || '').trim();
  }

  function validateSerieInList(list, idx, val) {
    var v = normalizeSerie(val);
    if (!v) return 'Escribe un número de serie';
    for (var i = 0; i < (list || []).length; i++) {
      if (i === idx) continue;
      if (normalizeSerie(list[i]).toLowerCase() === v.toLowerCase()) return 'Número de serie repetido';
    }
    return '';
  }

  function setAddSeriesError(msg) {
    var el = document.getElementById('add-mov-exp-series-error');
    if (!el) return;
    if (!msg) {
      el.style.display = 'none';
      el.textContent = '';
      return;
    }
    el.style.display = 'block';
    el.textContent = msg;
  }

  function setAddSeriesUI() {
    var progreso = document.getElementById('add-mov-exp-series-progreso');
    var btnTilde = document.getElementById('btn-add-mov-exp-serie-tilde');
    var btnAuto = document.getElementById('btn-add-mov-exp-serie-auto');
    if (progreso) {
      progreso.style.display = addSeriesActive ? '' : 'none';
      progreso.textContent = '(Serie ' + (addSeriesIdx + 1) + ' de ' + addSeriesCantidad + ')';
    }
    if (btnTilde) btnTilde.style.display = addSeriesActive ? '' : 'none';
    if (btnAuto) btnAuto.style.display = addSeriesActive ? '' : 'none';
  }

  function stopAddSeriesMode() {
    addSeriesActive = false;
    addSeriesList = [];
    addSeriesIdx = 0;
    addSeriesCantidad = 0;
    addSeriesBaseMovimiento = null;
    setAddSeriesError('');
    setAddSeriesUI();
  }

  function updateBtnCargarSeriesAgregar() {
    var btn = document.getElementById('btn-add-mov-exp-cargar-series');
    var cantEl = document.getElementById('producto-exp-cantidad');
    if (!btn || !cantEl) return;
    var cant = parseInt(cantEl.value, 10) || 0;
    btn.style.display = (cant > 1) ? '' : 'none';
  }

  function startAddSeriesMode() {
    if (!selectedExpedienteId) return;
    var cantidad = parseInt(document.getElementById('producto-exp-cantidad').value, 10) || 0;
    if (cantidad <= 1) {
      showToast('La cantidad debe ser mayor a 1 para cargar series por unidad', 'error');
      return;
    }
    var numeroSerie = (document.getElementById('producto-exp-numero-serie').value || '').trim();
    var nombre = (document.getElementById('producto-exp-nombre').value || '').trim();
    var marca = (document.getElementById('producto-exp-marca').value || '').trim();
    var concepto = (document.getElementById('producto-exp-concepto').value || '').trim();
    var fechaInput = (document.getElementById('producto-exp-fecha').value || '').trim();

    addSeriesActive = true;
    addSeriesCantidad = cantidad;
    addSeriesList = new Array(cantidad).fill('');
    addSeriesIdx = 0;
    addSeriesBaseMovimiento = {
      tipo: 'entrada',
      productoId: selectedExpedienteId,
      cantidad: String(cantidad),
      concepto: concepto || undefined,
      numeroSerie: numeroSerie || undefined,
      nombre: nombre || undefined,
      marca: marca || undefined,
      fecha: fechaInput ? new Date(fechaInput).toISOString() : undefined
    };
    if (numeroSerie) addSeriesList[0] = normalizeSerie(numeroSerie);
    setAddSeriesError('');
    setAddSeriesUI();
    var inputSerie = document.getElementById('producto-exp-numero-serie');
    if (inputSerie) {
      inputSerie.value = addSeriesList[0] || '';
      setTimeout(function () { try { inputSerie.focus(); } catch (e) {} }, 30);
    }
  }

  function openSeriesWizard(movBase, cantidad, firstSeriePrefill) {
    pendingMovimientoBase = movBase || null;
    pendingCantidad = cantidad || 0;
    seriesList = new Array(pendingCantidad).fill('');
    seriesIdx = 0;
    if (firstSeriePrefill) seriesList[0] = normalizeSerie(firstSeriePrefill);

    if (seriesCantEl) seriesCantEl.textContent = String(pendingCantidad);
    if (seriesStepModo) seriesStepModo.style.display = 'block';
    if (seriesStepWizard) seriesStepWizard.style.display = 'none';
    if (btnSeriesPrev) btnSeriesPrev.style.display = 'none';
    if (btnSeriesNext) btnSeriesNext.style.display = 'none';
    if (seriesPasteEl) seriesPasteEl.value = '';
    hideSeriesError();

    if (modalSeriesExp) modalSeriesExp.classList.add('open');
  }

  function closeSeriesWizard() {
    pendingMovimientoBase = null;
    pendingCantidad = 0;
    seriesList = [];
    seriesIdx = 0;
    pendingReplaceMovimientoId = null;
    if (modalSeriesExp) modalSeriesExp.classList.remove('open');
    if (seriesPasteEl) seriesPasteEl.value = '';
    hideSeriesError();
  }

  function updateSeriesUI() {
    if (seriesProgresoEl) seriesProgresoEl.textContent = 'Serie ' + (seriesIdx + 1) + ' de ' + pendingCantidad;
    var cargadas = seriesList.filter(function (x) { return normalizeSerie(x) !== ''; }).length;
    if (seriesContadorEl) seriesContadorEl.textContent = cargadas + '/' + pendingCantidad + ' cargadas';
    if (seriesInputEl) {
      seriesInputEl.value = seriesList[seriesIdx] || '';
      setTimeout(function () { try { seriesInputEl.focus(); } catch (e) {} }, 30);
    }
    if (btnSeriesPrev) btnSeriesPrev.style.display = seriesIdx > 0 ? '' : 'none';
    if (btnSeriesNext) btnSeriesNext.textContent = (seriesIdx === pendingCantidad - 1) ? 'Guardar' : 'Listo';
  }

  function validateCurrentSerie(val) {
    return validateSerieInList(seriesList, seriesIdx, val);
  }

  async function guardarSeriesComoUnidadesGeneric(movBase, list, replaceMovimientoId) {
    if (!movBase || !window.stockAPI) return;
    var faltan = (list || []).filter(function (x) { return normalizeSerie(x) === ''; }).length;
    if (faltan > 0) {
      showToast('Faltan ' + faltan + ' número(s) de serie', 'error');
      return;
    }
    var seen = {};
    for (var i = 0; i < list.length; i++) {
      var n = normalizeSerie(list[i]).toLowerCase();
      if (seen[n]) {
        showToast('Hay números de serie repetidos', 'error');
        return;
      }
      seen[n] = true;
    }

    if (window.appLoading && window.appLoading.show) window.appLoading.show('Guardando ' + list.length + ' unidades…');
    try {
      var baseId = Date.now().toString();
      for (var k = 0; k < list.length; k++) {
        var mov = Object.assign({}, movBase, {
          id: baseId + '-' + k,
          cantidad: '1',
          numeroSerie: normalizeSerie(list[k])
        });
        var r = await window.stockAPI.registrarMovimiento(mov);
        if (r && r.ok === false) {
          showToast(r.error || 'Error al guardar', 'error');
          return;
        }
      }
      if (replaceMovimientoId) {
        try { await window.stockAPI.deleteMovimiento(replaceMovimientoId); } catch (eDel) {}
      }
      showToast('Unidades agregadas con sus series');
      if (inputBuscarDetalleExp) inputBuscarDetalleExp.value = '';
      await refresh();
      renderDetalleExpediente();
    } catch (e2) {
      showToast('Error al guardar', 'error');
    } finally {
      if (window.appLoading && window.appLoading.hide) window.appLoading.hide();
    }
  }

  async function guardarComoLote() {
    if (!pendingMovimientoBase || !window.stockAPI) return;
    if (window.appLoading && window.appLoading.show) window.appLoading.show('Guardando…');
    try {
      var result = await window.stockAPI.registrarMovimiento(pendingMovimientoBase);
      if (result && result.ok === false) {
        showToast(result.error || 'Error al guardar', 'error');
        return;
      }
      closeSeriesWizard();
      closeModalProductoExpediente();
      showToast('Producto agregado al expediente');
      await refresh();
      renderDetalleExpediente();
    } catch (e) {
      showToast('Error al guardar', 'error');
    } finally {
      if (window.appLoading && window.appLoading.hide) window.appLoading.hide();
    }
  }

  async function guardarSeriesComoUnidades() {
    if (!pendingMovimientoBase || !window.stockAPI) return;
    try {
      await guardarSeriesComoUnidadesGeneric(pendingMovimientoBase, seriesList, pendingReplaceMovimientoId);
      closeSeriesWizard();
      closeModalProductoExpediente();
      closeModalEditarMovExp();
    } catch (e2) {
      showToast('Error al guardar', 'error');
    } finally {
      if (window.appLoading && window.appLoading.hide) window.appLoading.hide();
    }
  }

  function movimientoTieneProvisiones(movId) {
    if (!movId) return false;
    return (cachedData.guardiaProvisiones || []).some(function (p) { return p.movimiento_id === movId; });
  }

  function setEditSeriesError(msg) {
    var el = document.getElementById('edit-mov-exp-series-error');
    if (!el) return;
    if (!msg) {
      el.style.display = 'none';
      el.textContent = '';
      return;
    }
    el.style.display = 'block';
    el.textContent = msg;
  }

  function setEditSeriesUI() {
    var progreso = document.getElementById('edit-mov-exp-series-progreso');
    var btnTilde = document.getElementById('btn-edit-mov-exp-serie-tilde');
    var btnAuto = document.getElementById('btn-edit-mov-exp-serie-auto');
    if (progreso) {
      progreso.style.display = editSeriesActive ? '' : 'none';
      progreso.textContent = '(Serie ' + (editSeriesIdx + 1) + ' de ' + editSeriesCantidad + ')';
    }
    if (btnTilde) btnTilde.style.display = editSeriesActive ? '' : 'none';
    if (btnAuto) btnAuto.style.display = editSeriesActive ? '' : 'none';
  }

  function stopEditSeriesMode() {
    editSeriesActive = false;
    editSeriesList = [];
    editSeriesIdx = 0;
    editSeriesCantidad = 0;
    editSeriesBaseMovimiento = null;
    editSeriesReplaceMovimientoId = null;
    setEditSeriesError('');
    setEditSeriesUI();
  }

  function openModalEditarMovExp(mov) {
    if (!esAdmin) {
      showToast('Solo admin puede editar productos del expediente.', 'error');
      return;
    }
    if (!modalEditarMovExp || !mov) return;
    stopEditSeriesMode();
    document.getElementById('edit-mov-exp-id').value = mov.id;
    document.getElementById('edit-mov-exp-numero-serie').value = mov.numeroSerie || '';
    document.getElementById('edit-mov-exp-nombre').value = mov.nombre || '';
    document.getElementById('edit-mov-exp-marca').value = mov.marca || '';
    document.getElementById('edit-mov-exp-cantidad').value = mov.cantidad || '';
    document.getElementById('edit-mov-exp-descripcion').value = mov.concepto || '';
    var fechaEl = document.getElementById('edit-mov-exp-fecha');
    if (mov.fecha && fechaEl) {
      var d = new Date(mov.fecha);
      var y = d.getFullYear();
      var mo = String(d.getMonth() + 1).padStart(2, '0');
      var day = String(d.getDate()).padStart(2, '0');
      var h = String(d.getHours()).padStart(2, '0');
      var min = String(d.getMinutes()).padStart(2, '0');
      fechaEl.value = y + '-' + mo + '-' + day + 'T' + h + ':' + min;
    } else if (fechaEl) fechaEl.value = '';

    // Si cantidad > 1, ofrecer cargar series por unidad (divide el lote en unidades).
    var btnCargarSeries = document.getElementById('btn-edit-mov-exp-cargar-series');
    var inputCantEditar = document.getElementById('edit-mov-exp-cantidad');
    if (btnCargarSeries) {
      var bloqueado = movimientoTieneProvisiones(mov.id);
      var applyVis = function () {
        var cantNow = parseInt((inputCantEditar && inputCantEditar.value) ? inputCantEditar.value : mov.cantidad, 10) || 0;
        btnCargarSeries.style.display = (cantNow > 1 && !bloqueado) ? '' : 'none';
      };
      applyVis();
      if (inputCantEditar) {
        inputCantEditar.oninput = function () {
          if (editSeriesActive) stopEditSeriesMode();
          applyVis();
        };
        inputCantEditar.onchange = inputCantEditar.oninput;
      }
      if (!bloqueado) {
        btnCargarSeries.onclick = function () {
          var cantidad = parseInt((inputCantEditar && inputCantEditar.value) ? inputCantEditar.value : mov.cantidad, 10) || 0;
          if (cantidad <= 1) return showToast('La cantidad debe ser mayor a 1 para cargar series por unidad', 'error');
          if (movimientoTieneProvisiones(mov.id)) return showToast('No se puede dividir: ya tiene entregas registradas', 'error');
          var fechaInput = document.getElementById('edit-mov-exp-fecha').value;
          var base = {
            tipo: 'entrada',
            productoId: mov.productoId,
            cantidad: String(cantidad),
            concepto: (document.getElementById('edit-mov-exp-descripcion').value || '').trim() || undefined,
            numeroSerie: (document.getElementById('edit-mov-exp-numero-serie').value || '').trim() || undefined,
            nombre: (document.getElementById('edit-mov-exp-nombre').value || '').trim() || undefined,
            marca: (document.getElementById('edit-mov-exp-marca').value || '').trim() || undefined,
            fecha: fechaInput ? new Date(fechaInput).toISOString() : (mov.fecha || undefined)
          };

          // Activar modo inline con ✓ al lado del input
          editSeriesActive = true;
          editSeriesCantidad = cantidad;
          editSeriesList = new Array(cantidad).fill('');
          editSeriesIdx = 0;
          editSeriesBaseMovimiento = base;
          editSeriesReplaceMovimientoId = mov.id;
          if (base.numeroSerie) editSeriesList[0] = normalizeSerie(base.numeroSerie);
          setEditSeriesError('');
          setEditSeriesUI();
          var inputSerie = document.getElementById('edit-mov-exp-numero-serie');
          if (inputSerie) {
            inputSerie.value = editSeriesList[0] || '';
            setTimeout(function () { try { inputSerie.focus(); } catch (e) {} }, 30);
          }
        };
      } else {
        btnCargarSeries.style.display = 'none';
        btnCargarSeries.onclick = null;
      }
    }
    modalEditarMovExp.classList.add('open');
  }

  function closeModalEditarMovExp() {
    if (!modalEditarMovExp) return;
    modalEditarMovExp.classList.remove('open');
    stopEditSeriesMode();
  }

  async function guardarEditarMovExp(e) {
    e.preventDefault();
    if (!esAdmin) {
      showToast('Solo admin puede editar productos del expediente.', 'error');
      return;
    }
    if (!window.stockAPI) return;
    if (editSeriesActive) {
      showToast('Terminá de cargar las series con el botón ✓ antes de guardar', 'error');
      return;
    }
    var id = document.getElementById('edit-mov-exp-id').value;
    var fechaInput = document.getElementById('edit-mov-exp-fecha').value;
    var updates = {
      numeroSerie: (document.getElementById('edit-mov-exp-numero-serie').value || '').trim() || undefined,
      nombre: (document.getElementById('edit-mov-exp-nombre').value || '').trim() || undefined,
      marca: (document.getElementById('edit-mov-exp-marca').value || '').trim() || undefined,
      cantidad: document.getElementById('edit-mov-exp-cantidad').value,
      concepto: (document.getElementById('edit-mov-exp-descripcion').value || '').trim() || undefined,
      fecha: fechaInput ? new Date(fechaInput).toISOString() : undefined
    };
    var loadingSet = false;
    try {
      loadingSet = setFormSubmitLoading(formEditarMovExp, 'Guardando…');
      if (!loadingSet) return;
      await window.stockAPI.updateMovimiento(id, updates);
      showToast('Producto actualizado');
      closeModalEditarMovExp();
      await refresh();
      renderDetalleExpediente();
    } catch (err) {
      showToast('Error al guardar', 'error');
    } finally {
      if (loadingSet) clearFormSubmitLoading(formEditarMovExp);
    }
  }

  async function guardarProductoEnExpediente(e) {
    e.preventDefault();
    if (!window.stockAPI) {
      showToast('No se encontró el backend', 'error');
      return;
    }
    if (!selectedExpedienteId) {
      showToast('Primero selecciona un expediente', 'error');
      return;
    }
    var numeroSerie = (document.getElementById('producto-exp-numero-serie').value || '').trim();
    var nombre = (document.getElementById('producto-exp-nombre').value || '').trim();
    var marca = (document.getElementById('producto-exp-marca').value || '').trim();
    var cantidad = parseInt(document.getElementById('producto-exp-cantidad').value, 10) || 0;
    var concepto = (document.getElementById('producto-exp-concepto').value || '').trim();
    var fechaInput = (document.getElementById('producto-exp-fecha').value || '').trim();

    if (!nombre) {
      showToast('El nombre es obligatorio', 'error');
      return;
    }
    if (!cantidad || cantidad <= 0) {
      showToast('Cantidad inválida', 'error');
      return;
    }

    var loadingSet = false;
    try {
      var movimiento = {
        tipo: 'entrada',
        productoId: selectedExpedienteId,
        cantidad: String(cantidad),
        concepto: concepto || undefined,
        numeroSerie: numeroSerie || undefined,
        nombre: nombre || undefined,
        marca: marca || undefined,
        fecha: fechaInput ? new Date(fechaInput).toISOString() : undefined
      };

      if (cantidad > 1) {
        if (addSeriesActive) {
          showToast('Terminá de cargar las series con el botón ✓', 'error');
          return;
        }
        // Mismo flujo que en "Editar": cargar serie por unidad con ✓ dentro del modal
        startAddSeriesMode();
        return;
      }

      loadingSet = setFormSubmitLoading(formProductoExp, 'Guardando…');
      if (!loadingSet) return;

      var result = await window.stockAPI.registrarMovimiento(movimiento);
      if (result && result.ok === false) {
        showToast(result.error || 'Error al guardar', 'error');
        return;
      }
      showToast('Producto agregado al expediente');
      closeModalProductoExpediente();
      await refresh();
      renderDetalleExpediente();
    } catch (err) {
      showToast('Error al guardar', 'error');
    } finally {
      if (loadingSet) clearFormSubmitLoading(formProductoExp);
    }
  }

  async function guardarExpediente(e) {
    e.preventDefault();
    if (!window.stockAPI) {
      showToast('No se encontró el backend', 'error');
      return;
    }
    var numero = (inputNumero.value || '').trim();
    if (!numero) {
      showToast('Escribe el número de expediente', 'error');
      return;
    }

    var data = await loadData();
    var existe = (data.productos || []).some(function (p) {
      if (editingExpedienteId && p.id === editingExpedienteId) return false;
      return ((p.codigo || '').toString().trim().toLowerCase() === numero.toLowerCase());
    });
    if (existe) {
      showToast('Ese expediente ya existe', 'error');
      return;
    }

    var anio = (inputAnio && inputAnio.value || '').trim() || undefined;
    var solicitadoPor = (inputSolicitadoPor && inputSolicitadoPor.value || '').trim() || undefined;
    var loadingSet = false;
    try {
      var payload = {
        codigo: numero,
        nombre: numero,
        descripcion: '',
        stockActual: 0,
        unidad: 'unidades',
        solicitadoPor: solicitadoPor,
        anio: anio
      };
      if (editingExpedienteId) payload.id = editingExpedienteId;

      loadingSet = setFormSubmitLoading(form, 'Guardando…');
      if (!loadingSet) return;

      await window.stockAPI.saveProducto(payload);
      showToast(editingExpedienteId ? 'Expediente actualizado' : 'Expediente agregado');
      closeModal();
      await refresh();
      renderExpedientes(cachedData.productos || []);
    } catch (err) {
      showToast(err && err.message ? err.message : 'Error al guardar', 'error');
    } finally {
      if (loadingSet) clearFormSubmitLoading(form);
    }
  }

  async function refresh() {
    cachedData = await loadData();
    if (!cachedData.productos) cachedData.productos = [];
    if (!cachedData.movimientos) cachedData.movimientos = [];
    if (!cachedData.guardiaProvisiones) cachedData.guardiaProvisiones = [];
  }

  async function run() {
    var ok = await ensureAuth();
    if (!ok) return;
    if (window.appLoading && window.appLoading.show) window.appLoading.show('Cargando expedientes…');
    try {
      await refresh();
      renderExpedientes(cachedData.productos || []);
      // Deep-link desde Dashboard: abrir expediente y opcionalmente editar un movimiento
      try {
        var params = new URLSearchParams(window.location.search || '');
        var openExp = params.get('openExp');
        var openMov = params.get('openMov');
        if (openExp && !selectedExpedienteId) {
          await openDetalleExpediente(openExp);
          if (openMov) {
            // esperar a que quede renderizado
            setTimeout(function () {
              var mov = (cachedData.movimientos || []).find(function (x) { return x.id === openMov; });
              if (mov) openModalEditarMovExp(mov);
            }, 120);
          }
        } else if (selectedExpedienteId) {
          renderDetalleExpediente();
        }
      } catch (_) {
        if (selectedExpedienteId) renderDetalleExpediente();
      }
    } finally {
      if (window.appLoading && window.appLoading.hide) window.appLoading.hide();
    }
  }

  if (btnAgregar) btnAgregar.addEventListener('click', openModal);
  if (form) form.addEventListener('submit', guardarExpediente);
  if (inputBuscarExp) {
    inputBuscarExp.addEventListener('input', function () { pagExpLista = 1; renderExpedientes(cachedData.productos || []); });
    inputBuscarExp.addEventListener('change', function () { pagExpLista = 1; renderExpedientes(cachedData.productos || []); });
  }
  if (selectOrdenarExp) {
    selectOrdenarExp.addEventListener('change', function () { pagExpLista = 1; renderExpedientes(cachedData.productos || []); });
  }

  tabButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var tab = btn.dataset.tab;
      if (tab === 'detalle-expediente' && (!selectedExpedienteId || (tabDetalle && tabDetalle.disabled))) return;
      openTab(tab);
      if (tab === 'detalle-expediente') renderDetalleExpediente();
    });
  });

  if (btnVolverLista) btnVolverLista.addEventListener('click', function () {
    openTab('lista-expedientes');
  });

  if (btnExportarDetalleExp) {
    btnExportarDetalleExp.addEventListener('click', function () {
      if (!selectedExpedienteId) {
        showToast('Selecciona un expediente primero', 'error');
        return;
      }
      if (!window.stockAPI || !window.stockAPI.exportExpedienteDetalle) {
        showToast('Exportación no disponible', 'error');
        return;
      }
      var q = inputBuscarDetalleExp ? inputBuscarDetalleExp.value : '';
      if (window.appLoading && window.appLoading.show) window.appLoading.show('Exportando detalle del expediente…');
      window.stockAPI.exportExpedienteDetalle(selectedExpedienteId, q).then(function (r) {
        if (r && r.ok && r.path) {
          showToast('Detalle exportado en: ' + r.path);
        } else if (r && r.cancelled) {
          // usuario canceló el diálogo
        } else {
          showToast((r && r.error) || 'Error al exportar', 'error');
        }
      }).catch(function (err) {
        showToast('Error al exportar: ' + (err && err.message ? err.message : 'Error'), 'error');
      }).finally(function () {
        if (window.appLoading && window.appLoading.hide) window.appLoading.hide();
      });
    });
  }

  if (btnAgregarProductoExp) btnAgregarProductoExp.addEventListener('click', openModalProductoExpediente);
  if (formProductoExp) formProductoExp.addEventListener('submit', guardarProductoEnExpediente);
  if (formEditarMovExp) formEditarMovExp.addEventListener('submit', guardarEditarMovExp);
  if (inputBuscarDetalleExp) {
    inputBuscarDetalleExp.addEventListener('input', function () { pagExpDetalle = 1; renderDetalleExpediente(); });
    inputBuscarDetalleExp.addEventListener('change', function () { pagExpDetalle = 1; renderDetalleExpediente(); });
  }

  // Agregar producto: mostrar botón "cargar series" cuando cantidad > 1
  var btnAddCargarSeries = document.getElementById('btn-add-mov-exp-cargar-series');
  if (btnAddCargarSeries) btnAddCargarSeries.addEventListener('click', startAddSeriesMode);
  var addCantidadEl = document.getElementById('producto-exp-cantidad');
  if (addCantidadEl) {
    addCantidadEl.addEventListener('input', function () {
      updateBtnCargarSeriesAgregar();
      if (addSeriesActive) stopAddSeriesMode();
    });
    addCantidadEl.addEventListener('change', function () {
      updateBtnCargarSeriesAgregar();
      if (addSeriesActive) stopAddSeriesMode();
    });
  }

  // Agregar producto: botón ✓ para avanzar serie 1..N
  var btnAddSerieTilde = document.getElementById('btn-add-mov-exp-serie-tilde');
  if (btnAddSerieTilde) {
    btnAddSerieTilde.addEventListener('click', async function () {
      if (!addSeriesActive) return;
      var inputSerie = document.getElementById('producto-exp-numero-serie');
      var val = inputSerie ? inputSerie.value : '';
      var err = validateSerieInList(addSeriesList, addSeriesIdx, val);
      if (err) {
        setAddSeriesError(err);
        return;
      }
      setAddSeriesError('');
      addSeriesList[addSeriesIdx] = normalizeSerie(val);
      if (addSeriesIdx < addSeriesCantidad - 1) {
        addSeriesIdx += 1;
        if (inputSerie) inputSerie.value = addSeriesList[addSeriesIdx] || '';
        setAddSeriesUI();
        if (inputSerie) setTimeout(function () { try { inputSerie.focus(); } catch (e) {} }, 30);
        return;
      }
      await guardarSeriesComoUnidadesGeneric(addSeriesBaseMovimiento, addSeriesList, null);
      closeModalProductoExpediente();
    });
  }
  var addSerieInputEl = document.getElementById('producto-exp-numero-serie');
  if (addSerieInputEl) {
    addSerieInputEl.addEventListener('keydown', function (e) {
      if (!addSeriesActive) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        if (btnAddSerieTilde) btnAddSerieTilde.click();
      }
    });
  }
  document.querySelectorAll('.modal-editar-mov-exp-close').forEach(function (btn) {
    btn.addEventListener('click', closeModalEditarMovExp);
  });
  if (modalEditarMovExp) {
    modalEditarMovExp.addEventListener('click', function (e) {
      if (e.target === modalEditarMovExp) closeModalEditarMovExp();
    });
  }

  // Botón ✓ en "Editar producto" para avanzar serie 1..N
  var btnEditSerieTilde = document.getElementById('btn-edit-mov-exp-serie-tilde');
  if (btnEditSerieTilde) {
    btnEditSerieTilde.addEventListener('click', async function () {
      if (!editSeriesActive) return;
      var inputSerie = document.getElementById('edit-mov-exp-numero-serie');
      var val = inputSerie ? inputSerie.value : '';
      var err = validateSerieInList(editSeriesList, editSeriesIdx, val);
      if (err) {
        setEditSeriesError(err);
        return;
      }
      setEditSeriesError('');
      editSeriesList[editSeriesIdx] = normalizeSerie(val);
      if (editSeriesIdx < editSeriesCantidad - 1) {
        editSeriesIdx += 1;
        if (inputSerie) inputSerie.value = editSeriesList[editSeriesIdx] || '';
        setEditSeriesUI();
        if (inputSerie) setTimeout(function () { try { inputSerie.focus(); } catch (e) {} }, 30);
        return;
      }
      // Última serie: guardar unidades y cerrar modal
      await guardarSeriesComoUnidadesGeneric(editSeriesBaseMovimiento, editSeriesList, editSeriesReplaceMovimientoId);
      closeModalEditarMovExp();
    });
  }

  // Auto-series en Editar: 1..N
  var btnEditSerieAuto = document.getElementById('btn-edit-mov-exp-serie-auto');
  if (btnEditSerieAuto) {
    btnEditSerieAuto.addEventListener('click', function () {
      if (!editSeriesActive) return;
      for (var i = 0; i < editSeriesCantidad; i++) editSeriesList[i] = String(i + 1);
      setEditSeriesError('');
      setEditSeriesUI();
      var inputSerie = document.getElementById('edit-mov-exp-numero-serie');
      if (inputSerie) {
        inputSerie.value = editSeriesList[editSeriesIdx] || '';
        setTimeout(function () { try { inputSerie.focus(); } catch (e) {} }, 30);
      }
    });
  }

  var editSerieInput = document.getElementById('edit-mov-exp-numero-serie');
  if (editSerieInput) {
    editSerieInput.addEventListener('keydown', function (e) {
      if (!editSeriesActive) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        if (btnEditSerieTilde) btnEditSerieTilde.click();
      }
    });
  }

  // Auto-series en Agregar: 1..N
  var btnAddSerieAuto = document.getElementById('btn-add-mov-exp-serie-auto');
  if (btnAddSerieAuto) {
    btnAddSerieAuto.addEventListener('click', function () {
      if (!addSeriesActive) return;
      for (var i = 0; i < addSeriesCantidad; i++) addSeriesList[i] = String(i + 1);
      setAddSeriesError('');
      setAddSeriesUI();
      var inputSerie = document.getElementById('producto-exp-numero-serie');
      if (inputSerie) {
        inputSerie.value = addSeriesList[addSeriesIdx] || '';
        setTimeout(function () { try { inputSerie.focus(); } catch (e) {} }, 30);
      }
    });
  }
  document.querySelectorAll('.modal-confirm-eliminar-expediente-close').forEach(function (btn) {
    if (btn) btn.addEventListener('click', closeModalConfirmEliminarExpediente);
  });
  if (modalConfirmEliminarExp) {
    modalConfirmEliminarExp.addEventListener('click', function (e) {
      if (e.target === modalConfirmEliminarExp) closeModalConfirmEliminarExpediente();
    });
  }
  if (btnConfirmEliminarExp) btnConfirmEliminarExp.addEventListener('click', confirmarEliminarExpedienteDesdeModal);
  document.addEventListener('click', function () {
    if (listaProductosExp) listaProductosExp.querySelectorAll('.exp-menu-dropdown').forEach(function (d) { d.classList.remove('exp-menu-open'); });
    if (lista) lista.querySelectorAll('.exp-menu-dropdown').forEach(function (d) { d.classList.remove('exp-menu-open'); });
  });

  document.querySelectorAll('.modal-info-entregas-close').forEach(function (btn) {
    if (btn) btn.addEventListener('click', closeModalInfoEntregas);
  });
  if (modalInfoEntregas) {
    modalInfoEntregas.addEventListener('click', function (e) {
      if (e.target === modalInfoEntregas) closeModalInfoEntregas();
    });
  }

  document.querySelectorAll('.modal-expediente-close').forEach(function (btn) {
    btn.addEventListener('click', closeModal);
  });
  if (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeModal();
    });
  }

  document.querySelectorAll('.modal-producto-expediente-close').forEach(function (btn) {
    btn.addEventListener('click', closeModalProductoExpediente);
  });
  if (modalProductoExp) {
    modalProductoExp.addEventListener('click', function (e) {
      if (e.target === modalProductoExp) closeModalProductoExpediente();
    });
  }

  // Series wizard handlers
  document.querySelectorAll('.modal-series-exp-close').forEach(function (btn) {
    if (btn) btn.addEventListener('click', closeSeriesWizard);
  });
  if (modalSeriesExp) {
    modalSeriesExp.addEventListener('click', function (e) {
      if (e.target === modalSeriesExp) closeSeriesWizard();
    });
  }
  if (btnSeriesSin) btnSeriesSin.addEventListener('click', guardarComoLote);
  if (btnSeriesSi) btnSeriesSi.addEventListener('click', function () {
    if (seriesStepModo) seriesStepModo.style.display = 'none';
    if (seriesStepWizard) seriesStepWizard.style.display = 'block';
    if (btnSeriesPrev) btnSeriesPrev.style.display = seriesIdx > 0 ? '' : 'none';
    if (btnSeriesNext) btnSeriesNext.style.display = '';
    updateSeriesUI();
  });
  if (btnSeriesPrev) btnSeriesPrev.addEventListener('click', function () {
    hideSeriesError();
    if (seriesInputEl) seriesList[seriesIdx] = normalizeSerie(seriesInputEl.value);
    seriesIdx = Math.max(0, seriesIdx - 1);
    updateSeriesUI();
  });
  if (btnSeriesNext) btnSeriesNext.addEventListener('click', function () {
    hideSeriesError();
    var val = seriesInputEl ? seriesInputEl.value : '';
    var errMsg = validateCurrentSerie(val);
    if (errMsg) {
      showSeriesError(errMsg);
      return;
    }
    seriesList[seriesIdx] = normalizeSerie(val);
    if (seriesIdx < pendingCantidad - 1) {
      seriesIdx += 1;
      updateSeriesUI();
    } else {
      guardarSeriesComoUnidades();
    }
  });
  if (seriesInputEl) {
    seriesInputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (btnSeriesNext) btnSeriesNext.click();
      }
    });
  }
  if (btnSeriesAplicarPaste) btnSeriesAplicarPaste.addEventListener('click', function () {
    hideSeriesError();
    var raw = (seriesPasteEl && seriesPasteEl.value) ? String(seriesPasteEl.value) : '';
    var lines = raw.split(/\r?\n/).map(function (l) { return normalizeSerie(l); }).filter(function (l) { return l !== ''; });
    if (!lines.length) {
      showSeriesError('Pegá al menos 1 número de serie');
      return;
    }
    if (lines.length > pendingCantidad) {
      showSeriesError('Pegaste ' + lines.length + ' series, pero la cantidad es ' + pendingCantidad);
      return;
    }
    for (var i = 0; i < lines.length; i++) seriesList[i] = lines[i];
    seriesIdx = Math.min(seriesIdx, pendingCantidad - 1);
    updateSeriesUI();
  });
  if (btnSeriesLimpiar) btnSeriesLimpiar.addEventListener('click', function () {
    hideSeriesError();
    seriesList = new Array(pendingCantidad).fill('');
    seriesIdx = 0;
    if (seriesPasteEl) seriesPasteEl.value = '';
    updateSeriesUI();
  });

  window._realtimeRefresh = function () {
    refresh().then(function () {
      renderExpedientes(cachedData ? cachedData.productos || [] : []);
      if (selectedExpedienteId) renderDetalleExpediente();
    }).catch(function () {});
  };

  run();
})();
