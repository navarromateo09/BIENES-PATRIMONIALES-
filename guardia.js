(function () {
  'use strict';

  var dependencias = [];
  var productos = [];
  var movimientos = [];
  var provisiones = [];
  var selectedDependenciaId = null;
  var expandedDepIds = {};

  var inputBuscarDep = document.getElementById('guardia-buscar-dependencia');
  var listaDeps = document.getElementById('guardia-lista-dependencias');
  var tablaWrap = document.getElementById('guardia-tabla-wrap');
  var pasoInicial = document.getElementById('guardia-modal-paso-inicial');
  var pasoProductos = document.getElementById('guardia-modal-paso-productos');
  var listaProvisiones = document.getElementById('guardia-lista-provisiones');

  var modalProducto = document.getElementById('modal-guardia-producto');
  var inputBuscarProducto = document.getElementById('guardia-buscar-producto');
  var inputFecha = document.getElementById('guardia-provision-fecha');
  var inputConcepto = document.getElementById('guardia-provision-concepto');
  var modalListaProductos = document.getElementById('guardia-modal-lista-productos');
  var modalEmpty = document.getElementById('guardia-modal-empty');
  var btnAsignar = document.getElementById('guardia-btn-asignar');

  var modalActa = document.getElementById('modal-acta-entrega');
  var actaContenido = document.getElementById('acta-entrega-contenido');
  var btnImprimirActa = document.getElementById('guardia-btn-imprimir-acta');

  var modalConfirmarProvision = document.getElementById('modal-confirmar-provision');
  var confirmarProvisionTbody = document.getElementById('confirmar-provision-tbody');
  var btnConfirmarSi = document.getElementById('guardia-btn-confirmar-si');
  var btnConfirmarNo = document.getElementById('guardia-btn-confirmar-no');
  var modalConfirmarEliminarDep = document.getElementById('modal-confirmar-eliminar-dep');
  var confirmarEliminarDepTexto = document.getElementById('confirmar-eliminar-dep-texto');
  var btnEliminarDepAceptar = document.getElementById('guardia-btn-eliminar-dep-aceptar');
  var btnEliminarDepCancelar = document.getElementById('guardia-btn-eliminar-dep-cancelar');
  var modalEditarDep = document.getElementById('modal-editar-dep-guardia');
  var editarDepTitulo = document.getElementById('editar-dep-guardia-titulo');
  var editarDepNombre = document.getElementById('editar-dep-guardia-nombre');
  var editarDepNumero = document.getElementById('editar-dep-guardia-numero');
  var editarDepCodigo = document.getElementById('editar-dep-guardia-codigo');
  var btnEditarDepGuardar = document.getElementById('guardia-btn-editar-dep-guardar');
  var editarDepChildLabel = document.getElementById('editar-dep-guardia-child-label');
  var editarDepChildNombre = document.getElementById('editar-dep-guardia-child-nombre');
  var editarDepChildNumero = document.getElementById('editar-dep-guardia-child-numero');
  var btnEditarDepAgregar = document.getElementById('guardia-btn-editar-dep-agregar');
  var editarDepHijosTbody = document.getElementById('editar-dep-guardia-hijos-tbody');

  var carritoEntrega = [];
  var actaDatosActuales = null;
  var pendingProvisionData = null;
  var pendingDeleteDependencia = null;
  var pendingEditDependenciaId = null;
  var actasCola = []; // actas pendientes al elegir "una por expediente"
  var datosActaOpciones = null; // datos para abrir acta tras elegir tipo (una vs por expediente)
  var currentUserRole = 'usuario';

  var panelCarrito = document.getElementById('guardia-panel-carrito');
  var carritoTbody = document.getElementById('guardia-carrito-tbody');
  var carritoVacioMsg = document.getElementById('guardia-carrito-vacio');
  var btnVaciarCarrito = document.getElementById('guardia-btn-vaciar-carrito');
  var modalElegirTipoActa = document.getElementById('modal-elegir-tipo-acta');
  var btnActaUna = document.getElementById('guardia-btn-acta-una');
  var btnActaPorExpediente = document.getElementById('guardia-btn-acta-por-expediente');
  var wizardRoot = document.getElementById('guardia-wizard-root');
  var wizardToolbar = document.getElementById('guardia-wizard-toolbar');
  var wizardDepChip = document.getElementById('guardia-wizard-dep-chip');
  var btnWizardAtras = document.getElementById('guardia-wizard-atras');
  var btnWizardNueva = document.getElementById('guardia-wizard-nueva');
  var btnFinalizarEntrega = document.getElementById('guardia-btn-finalizar-entrega');
  var wizardStep = 1;
  var wizardActive = false;

  // IDs reservados históricamente para importaciones de TXT.
  // En Entregas deben mostrarse solo las dependencias "reales" del módulo Dependencias.
  var TXT_ID_PREFIXES_EXCLUIR = ['txt-dep-'];

  function isTxtItem(dep) {
    if (!dep || dep.id == null) return false;
    var id = String(dep.id);
    return TXT_ID_PREFIXES_EXCLUIR.some(function (p) { return id.indexOf(p) === 0; });
  }

  function getDisplayLabelDep(dep, deps) {
    var list = deps != null ? deps : dependencias;
    if (!dep) return '';
    var codigo = (dep.codigo || '').toString().trim();
    var nombre = (dep.nombre || '').toString().trim();
    var numero = (dep.numero || '').toString().trim();
    if (dep.parentId && list.length) {
      var parent = list.find(function (d) { return d.id === dep.parentId; });
      if (parent) codigo = (parent.codigo || '').toString().trim();
    }
    if (dep.parentId && numero) return codigo + ' - ' + numero + ' - ' + nombre;
    if (codigo && nombre) return codigo + ' - ' + nombre;
    return nombre || codigo || '—';
  }

  function getDepNombreSolo(dep) {
    if (!dep) return '—';
    var nombre = (dep.nombre || '').toString().trim();
    var codigo = (dep.codigo || '').toString().trim();
    return nombre || codigo || '—';
  }

  function getMainDeps(deps) {
    return (deps || []).filter(function (d) { return !d.parentId; });
  }

  function getDivisiones(deps, parentId) {
    return (deps || []).filter(function (d) { return d.parentId === parentId; });
  }

  function depMatchesBusqueda(dep, deps, busqueda, parent) {
    if (!busqueda) return true;
    var label = getDisplayLabelDep(dep, deps).toLowerCase();
    var nombre = (dep.nombre || '').toLowerCase();
    var codigo = (dep.codigo != null ? String(dep.codigo) : '').toLowerCase().trim();
    var numero = (dep.numero != null ? String(dep.numero) : '').toLowerCase().trim();
    var idCorto = dep.parentId && parent
      ? (parent.codigo != null ? String(parent.codigo) : '').trim().toLowerCase() + '-' + numero
      : codigo;
    var busquedaNorm = busqueda.replace(/\s/g, '').toLowerCase();
    var labelNorm = label.replace(/\s/g, '');
    var idCortoNorm = idCorto.replace(/\s/g, '');
    return label.indexOf(busqueda) >= 0 || nombre.indexOf(busqueda) >= 0 ||
      codigo.indexOf(busqueda) >= 0 || numero.indexOf(busqueda) >= 0 ||
      idCortoNorm.indexOf(busquedaNorm) >= 0 || labelNorm.indexOf(busquedaNorm) >= 0;
  }

  function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function showToast(message, type) {
    var existing = document.querySelector('.toast');
    if (existing) existing.remove();
    var toast = document.createElement('div');
    toast.className = 'toast ' + (type || 'success');
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function () { toast.remove(); }, 3500);
  }

  function isAdminUser() {
    return String(currentUserRole || 'usuario').toLowerCase() === 'admin';
  }

  async function loadAll() {
    try {
      if (window.appLoading && window.appLoading.show) window.appLoading.show('Cargando entregas…');
      if (window.stockAPI && window.stockAPI.getAuthStatus) {
        var auth = await window.stockAPI.getAuthStatus();
        currentUserRole = auth && auth.rol ? String(auth.rol).toLowerCase() : 'usuario';
      } else {
        currentUserRole = 'usuario';
      }
      if (window.stockAPI.getDependencias) dependencias = await window.stockAPI.getDependencias();
      else dependencias = [];
      dependencias = (dependencias || []).filter(function (d) { return !isTxtItem(d); });
      var data = await (window.invokeStockLightOrFull
        ? window.invokeStockLightOrFull('getGuardiaData', function () { return window.stockAPI.getData(); })
        : window.stockAPI.getData());
      productos = data.productos || [];
      movimientos = data.movimientos || [];
      provisiones = data.guardiaProvisiones || (await window.stockAPI.getGuardiaProvisiones()) || [];
    } catch (e) {
      showToast('Error al cargar datos', 'error');
      dependencias = [];
      productos = [];
      movimientos = [];
      provisiones = [];
    } finally {
      if (window.appLoading && window.appLoading.hide) window.appLoading.hide();
    }
  }

  function renderBusquedaDependencias() {
    if (!listaDeps) return;
    var deps = dependencias;
    var busqueda = (inputBuscarDep && inputBuscarDep.value || '').trim().toLowerCase();

    if (!deps.length) {
      listaDeps.innerHTML = '<tr><td colspan="3" class="empty-state"><p>No hay dependencias. Crea dependencias en Gestión de dependencias.</p></td></tr>';
      return;
    }

    var rows = [];
    var mainDeps = getMainDeps(deps);
    var canEdit = true;
    var canDelete = isAdminUser();
    var algunaFila = false;

    function branchMatches(dep, parent) {
      if (depMatchesBusqueda(dep, deps, busqueda, parent || null)) return true;
      var children = getDivisiones(deps, dep.id);
      for (var i = 0; i < children.length; i++) {
        if (branchMatches(children[i], dep)) return true;
      }
      return false;
    }

    function buildAcciones(depId, depLabel) {
      var acciones = '<div class="dep-acciones-inline"><button type="button" class="btn btn-primary btn-sm btn-dep-guardia" data-id="' + escapeHtml(depId) + '" data-label="' + escapeHtml(depLabel) + '">Seleccionar</button>';
      if (canEdit) {
        acciones += ' <div class="dep-menu-dots-wrap"><button type="button" class="dep-menu-dots-btn" data-id="' + escapeHtml(depId) + '" title="Más opciones">⋮</button><div class="dep-menu-dots-dropdown"><button type="button" class="dep-menu-dots-item dep-menu-dots-editar" data-id="' + escapeHtml(depId) + '" data-label="' + escapeHtml(depLabel) + '">Editar</button>' + (canDelete ? '<button type="button" class="dep-menu-dots-item dep-menu-dots-eliminar" data-id="' + escapeHtml(depId) + '" data-label="' + escapeHtml(depLabel) + '">Eliminar</button>' : '') + '</div></div>';
      }
      acciones += '</div>';
      return acciones;
    }

    function appendChildren(parent, rootId, level, isVisible, forceShowAllDescendants) {
      var children = getDivisiones(deps, parent.id);
      var parentSelfMatches = busqueda ? depMatchesBusqueda(parent, deps, busqueda, (parent.parentId ? (deps || []).find(function (d) { return d.id === parent.parentId; }) : null)) : false;
      var allowAll = !!forceShowAllDescendants || !!parentSelfMatches;
      if (busqueda && !allowAll) {
        children = children.filter(function (c) { return branchMatches(c, parent); });
      }
      children.forEach(function (child, idx) {
        var childLabel = getDisplayLabelDep(child, deps);
        var childNombre = (child.nombre || '').trim() || '—';
        var hiddenClass = isVisible ? '' : ' row-division-hidden';
        var levelClass = level === 1 ? ' row-nivel-1' : ' row-nivel-2';
        var lastClass = idx === children.length - 1 ? ' row-division-last' : '';
        var indent = 8 + (level * 22);
        var labelTexto = level === 1 ? ('* ' + childLabel) : childLabel;
        rows.push('<tr class="row-division' + levelClass + hiddenClass + lastClass + '" data-parent-id="' + escapeHtml(parent.id) + '" data-root-id="' + escapeHtml(rootId) + '"><td style="padding-left:' + indent + 'px;"><span class="link-dependencia">' + escapeHtml(labelTexto) + '</span></td><td>' + escapeHtml(childNombre) + '</td><td>' + buildAcciones(child.id, childLabel) + '</td></tr>');
        var childSelfMatches = busqueda ? depMatchesBusqueda(child, deps, busqueda, parent || null) : false;
        appendChildren(child, rootId, level + 1, isVisible, allowAll || childSelfMatches);
      });
    }

    mainDeps.forEach(function (d) {
      if (busqueda && !branchMatches(d, null)) return;
      algunaFila = true;
      var label = getDisplayLabelDep(d, deps);
      var nombre = (d.nombre || '').trim() || '—';
      var children = getDivisiones(deps, d.id);
      if (expandedDepIds[d.id] == null) expandedDepIds[d.id] = false;
      var isExpanded = !!expandedDepIds[d.id];
      var arrowClass = isExpanded ? 'arrow-expanded' : 'arrow-collapsed';
      var arrowLabel = isExpanded ? '▼' : '▶';
      var celdaIdentificador = children.length
        ? '<button type="button" class="btn-flecha-dep ' + arrowClass + '" data-id="' + escapeHtml(d.id) + '" aria-label="Ver subdivisiones" title="Ver subdivisiones">' + arrowLabel + '</button> <span class="link-dependencia">' + escapeHtml(label) + '</span>'
        : '<span class="btn-flecha-dep-placeholder"></span> <span class="link-dependencia">' + escapeHtml(label) + '</span>';
      rows.push('<tr class="main-dep-row" data-dep-id="' + escapeHtml(d.id) + '"><td>' + celdaIdentificador + '</td><td>' + escapeHtml(nombre) + '</td><td>' + buildAcciones(d.id, label) + '</td></tr>');
      var rootSelfMatches = busqueda ? depMatchesBusqueda(d, deps, busqueda, null) : false;
      appendChildren(d, d.id, 1, isExpanded, !!rootSelfMatches);
    });
    if (busqueda && !algunaFila) {
      rows.push('<tr><td colspan="3" class="empty-state"><p>Ninguna dependencia coincide con &quot;' + escapeHtml((inputBuscarDep && inputBuscarDep.value) || '') + '&quot;. Prueba con otro nombre o número (ej. D4, 144, 144-1).</p></td></tr>');
    }
    listaDeps.innerHTML = rows.join('');

    listaDeps.querySelectorAll('.btn-flecha-dep').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = btn.getAttribute('data-id');
        if (!id) return;
        expandedDepIds[id] = !expandedDepIds[id];
        var divisionRows = listaDeps.querySelectorAll('tr.row-division[data-root-id="' + id + '"]');
        divisionRows.forEach(function (tr) {
          tr.classList.toggle('row-division-hidden', !expandedDepIds[id]);
        });
        var parentRow = btn.closest('tr.main-dep-row');
        if (parentRow) {
          var arrowBtn = parentRow.querySelector('.btn-flecha-dep');
          if (arrowBtn) {
            arrowBtn.textContent = expandedDepIds[id] ? '▼' : '▶';
            arrowBtn.classList.toggle('arrow-expanded', expandedDepIds[id]);
            arrowBtn.classList.toggle('arrow-collapsed', !expandedDepIds[id]);
          }
        }
      });
    });

    listaDeps.querySelectorAll('.btn-dep-guardia').forEach(function (btn) {
      btn.addEventListener('click', function () {
        selectedDependenciaId = btn.getAttribute('data-id');
        if (tablaWrap) tablaWrap.style.display = 'block';
        renderProvisiones();
        openModalProducto();
      });
    });

    listaDeps.querySelectorAll('.dep-menu-dots-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var wrap = btn.closest('.dep-menu-dots-wrap');
        if (!wrap) return;
        var dd = wrap.querySelector('.dep-menu-dots-dropdown');
        if (!dd) return;
        var isOpen = dd.classList.contains('dep-menu-dots-open');
        listaDeps.querySelectorAll('.dep-menu-dots-dropdown').forEach(function (d) { d.classList.remove('dep-menu-dots-open'); });
        if (!isOpen) dd.classList.add('dep-menu-dots-open');
      });
    });

    listaDeps.querySelectorAll('.dep-menu-dots-eliminar').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        listaDeps.querySelectorAll('.dep-menu-dots-dropdown').forEach(function (d) { d.classList.remove('dep-menu-dots-open'); });
        if (!isAdminUser()) {
          showToast('Solo admin puede eliminar dependencias', 'error');
          return;
        }
        var depId = btn.getAttribute('data-id');
        var depLabel = btn.getAttribute('data-label') || 'esta dependencia';
        if (!depId) return;
        openModalConfirmarEliminarDep(depId, depLabel);
      });
    });

    listaDeps.querySelectorAll('.dep-menu-dots-editar').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        listaDeps.querySelectorAll('.dep-menu-dots-dropdown').forEach(function (d) { d.classList.remove('dep-menu-dots-open'); });
        var depId = btn.getAttribute('data-id');
        if (!depId) return;
        openModalEditarDependencia(depId);
      });
    });
  }

  function renderProvisiones() {
    if (!listaProvisiones || !selectedDependenciaId) return;
    var list = provisiones.filter(function (p) { return p.dependencia_id === selectedDependenciaId; });
    list.sort(function (a, b) { return new Date(b.fecha_asignacion || 0) - new Date(a.fecha_asignacion || 0); });
    var prodById = new Map((productos || []).map(function (p) { return [p.id, p]; }));
    var movById = new Map((movimientos || []).map(function (m) { return [m.id, m]; }));

    // ── Filtros avanzados ──
    var fBuscar = document.getElementById('filtro-guardia-buscar');
    var fDesde = document.getElementById('filtro-guardia-desde');
    var fHasta = document.getElementById('filtro-guardia-hasta');

    var qBuscar = fBuscar ? fBuscar.value.trim().toLowerCase() : '';
    var qDesde = fDesde && fDesde.value ? new Date(fDesde.value + 'T00:00:00').getTime() : 0;
    var qHasta = fHasta && fHasta.value ? new Date(fHasta.value + 'T23:59:59').getTime() : 0;

    var enriched = list.map(function (p) {
      var prod = prodById.get(p.producto_id);
      var nombreProd = prod ? ((prod.codigo || '') + ' - ' + (prod.nombre || '')).trim() || prod.nombre || p.producto_id : p.producto_id;
      if (p.movimiento_id && movimientos.length) {
        var mov = movById.get(p.movimiento_id);
        if (mov) nombreProd = nombreProd + ' · ' + ([mov.nombre, mov.numeroSerie].filter(Boolean).join(' · ') || 'Item');
      }
      var fechaTs = p.fecha_asignacion ? new Date(p.fecha_asignacion).getTime() : 0;
      var fecha = p.fecha_asignacion ? new Date(p.fecha_asignacion).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
      var cantidad = p.cantidad != null ? p.cantidad : 1;
      var concepto = (p.concepto || '').trim() || '—';
      return { id: p.id, nombreProd: nombreProd, fechaTs: fechaTs, fecha: fecha, cantidad: cantidad, concepto: concepto };
    });

    if (qBuscar || qDesde || qHasta) {
      enriched = enriched.filter(function (e) {
        if (qDesde && e.fechaTs < qDesde) return false;
        if (qHasta && e.fechaTs > qHasta) return false;
        if (qBuscar) {
          var haystack = [e.nombreProd, e.concepto].join(' ').toLowerCase();
          if (haystack.indexOf(qBuscar) === -1) return false;
        }
        return true;
      });
    }

    if (!enriched.length) {
      listaProvisiones.innerHTML = '<tr><td colspan="5" class="empty-state">No hay productos provistos que coincidan con los filtros.</td></tr>';
      return;
    }
    listaProvisiones.innerHTML = enriched.map(function (e) {
      return '<tr><td>' + escapeHtml(e.nombreProd) + '</td><td>' + escapeHtml(e.fecha) + '</td><td class="num-col">' + e.cantidad + '</td><td>' + escapeHtml(e.concepto) + '</td><td><button type="button" class="btn btn-danger btn-sm btn-quitar-provision" data-id="' + escapeHtml(e.id) + '">Quitar</button></td></tr>';
    }).join('');

    listaProvisiones.querySelectorAll('.btn-quitar-provision').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        if (!confirm('¿Quitar esta provisión?')) return;
        if (window.appLoading && window.appLoading.show) window.appLoading.show('Quitando provisión…');
        window.stockAPI.deleteGuardiaProvision(id).then(function () {
          showToast('Provisión quitada');
          loadAll().then(renderProvisiones);
        }).catch(function () { showToast('Error al quitar', 'error'); })
          .finally(function () { if (window.appLoading && window.appLoading.hide) window.appLoading.hide(); });
      });
    });
  }

  function mountWizardPanels() {
    var step2 = document.getElementById('guardia-wizard-step-2');
    var step3 = document.getElementById('guardia-wizard-step-3');
    var step4 = document.getElementById('guardia-wizard-step-4');
    if (modalProducto && step2 && !step2.contains(modalProducto)) {
      modalProducto.classList.add('guardia-wizard-panel');
      step2.appendChild(modalProducto);
    }
    if (modalConfirmarProvision && step3 && !step3.contains(modalConfirmarProvision)) {
      modalConfirmarProvision.classList.add('guardia-wizard-panel');
      step3.appendChild(modalConfirmarProvision);
    }
    if (modalActa && step4 && !step4.contains(modalActa)) {
      modalActa.classList.add('guardia-wizard-panel');
      step4.appendChild(modalActa);
    }
  }

  function updateDepChip(label) {
    if (!wizardDepChip) return;
    if (label) {
      wizardDepChip.textContent = 'Destino: ' + label;
      wizardDepChip.hidden = false;
    } else {
      wizardDepChip.textContent = '';
      wizardDepChip.hidden = true;
    }
  }

  function setWizardStep(step) {
    wizardStep = step;
    wizardActive = step > 1;
    if (wizardRoot) wizardRoot.classList.toggle('guardia-wizard-active', wizardActive);
    document.querySelectorAll('.guardia-stepper-item').forEach(function (el) {
      var n = parseInt(el.getAttribute('data-step'), 10);
      el.classList.toggle('active', n === step);
      el.classList.toggle('done', n < step);
    });
    document.querySelectorAll('.guardia-wizard-step').forEach(function (el) {
      var n = parseInt(String(el.id || '').replace('guardia-wizard-step-', ''), 10);
      var on = n === step;
      el.hidden = !on;
      el.classList.toggle('is-active', on);
    });
    if (wizardToolbar) wizardToolbar.hidden = step < 2;
    if (btnWizardAtras) btnWizardAtras.disabled = step <= 1;
    if (btnWizardNueva) btnWizardNueva.style.display = step >= 2 ? 'inline-flex' : 'none';
    if (tablaWrap) tablaWrap.style.display = (step === 1 && selectedDependenciaId) ? 'block' : (step === 1 ? 'none' : 'none');
  }

  function resetWizardEntrega() {
    wizardActive = false;
    selectedDependenciaId = null;
    if (modalProducto) modalProducto.classList.remove('open');
    if (modalConfirmarProvision) modalConfirmarProvision.classList.remove('open');
    if (modalActa) modalActa.classList.remove('open');
    if (pasoInicial) pasoInicial.style.display = 'none';
    if (pasoProductos) pasoProductos.style.display = 'flex';
    vaciarCarrito();
    pendingProvisionData = null;
    actaDatosActuales = null;
    updateDepChip('');
    if (tablaWrap) tablaWrap.style.display = 'none';
    setWizardStep(1);
    renderBusquedaDependencias();
  }

  function openModalProducto() {
    if (!selectedDependenciaId) {
      showToast('Primero selecciona una dependencia', 'error');
      return;
    }
    var dep = dependencias.find(function (d) { return d.id === selectedDependenciaId; });
    var labelDep = getDisplayLabelDep(dep, dependencias);
    var elLabel = document.getElementById('guardia-modal-dep-label');
    if (elLabel) elLabel.textContent = labelDep || '—';
    updateDepChip(labelDep || '');
    carritoEntrega = [];
    if (inputBuscarProducto) inputBuscarProducto.value = '';
    if (panelCarrito) panelCarrito.style.display = 'flex';
    if (carritoVacioMsg) carritoVacioMsg.style.display = 'block';
    if (btnVaciarCarrito) btnVaciarCarrito.style.display = 'none';
    if (btnAsignar) btnAsignar.style.display = 'none';
    if (pasoInicial) pasoInicial.style.display = 'none';
    if (pasoProductos) pasoProductos.style.display = 'flex';
    if (modalProducto) modalProducto.classList.remove('open');
    setWizardStep(2);
    loadAll().then(function () {
      renderModalProductos();
      if (inputBuscarProducto) {
        try { inputBuscarProducto.focus(); } catch (_) {}
      }
    });
  }

  function addToCarrito(productoId, movimientoId, label, disponible) {
    var cant = Math.min(1, Math.max(0, parseInt(disponible, 10) || 0));
    if (cant < 1) return;
    carritoEntrega.push({
      productoId: productoId,
      movimientoId: movimientoId || null,
      label: label,
      cantidad: 1,
      disponible: parseInt(disponible, 10) || 1
    });
    renderCarrito();
    if (panelCarrito) panelCarrito.style.display = 'flex';
    if (carritoVacioMsg) carritoVacioMsg.style.display = 'none';
    if (btnVaciarCarrito) btnVaciarCarrito.style.display = 'inline-block';
    if (btnAsignar) btnAsignar.style.display = 'inline-block';
  }

  function renderCarrito() {
    if (!carritoTbody) return;
    if (!carritoEntrega.length) {
      carritoTbody.innerHTML = '';
      return;
    }
    var now = new Date();
    if (inputFecha && !inputFecha.value) {
      inputFecha.value = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0') + 'T' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    }
    carritoTbody.innerHTML = carritoEntrega.map(function (item, idx) {
      var maxAttr = item.disponible != null ? ' max="' + item.disponible + '"' : '';
      return '<tr data-carrito-index="' + idx + '"><td class="guardia-carrito-label">' + escapeHtml(item.label) + '</td><td class="num-col"><input type="number" class="guardia-carrito-cantidad" min="1" value="' + (item.cantidad || 1) + '"' + maxAttr + '></td><td><button type="button" class="btn btn-danger btn-sm btn-quitar-carrito" data-index="' + idx + '">Quitar</button></td></tr>';
    }).join('');
    carritoTbody.querySelectorAll('.guardia-carrito-cantidad').forEach(function (input) {
      input.addEventListener('change', function () {
        var row = input.closest('tr');
        var idx = row ? parseInt(row.getAttribute('data-carrito-index'), 10) : -1;
        if (idx >= 0 && carritoEntrega[idx]) {
          var val = parseInt(input.value, 10);
          var max = carritoEntrega[idx].disponible;
          carritoEntrega[idx].cantidad = Math.min(Math.max(1, isNaN(val) ? 1 : val), max != null ? max : 999999);
          input.value = carritoEntrega[idx].cantidad;
        }
      });
    });
    carritoTbody.querySelectorAll('.btn-quitar-carrito').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-index'), 10);
        if (isNaN(idx) || idx < 0) return;
        carritoEntrega.splice(idx, 1);
        renderCarrito();
        if (carritoEntrega.length === 0) {
          if (panelCarrito) panelCarrito.style.display = wizardStep === 2 ? 'flex' : 'none';
          if (carritoVacioMsg) carritoVacioMsg.style.display = wizardStep === 2 ? 'block' : 'none';
          if (btnVaciarCarrito) btnVaciarCarrito.style.display = 'none';
          if (btnAsignar) btnAsignar.style.display = 'none';
        }
      });
    });
  }

  function vaciarCarrito() {
    carritoEntrega = [];
    if (panelCarrito) panelCarrito.style.display = wizardStep === 2 ? 'flex' : 'none';
    if (carritoVacioMsg) carritoVacioMsg.style.display = wizardStep === 2 ? 'block' : 'none';
    if (btnVaciarCarrito) btnVaciarCarrito.style.display = 'none';
    if (btnAsignar) btnAsignar.style.display = 'none';
    if (carritoTbody) carritoTbody.innerHTML = '';
    if (modalListaProductos) modalListaProductos.querySelectorAll('tr.row-seleccionado').forEach(function (tr) { tr.classList.remove('row-seleccionado'); });
  }

  function closeModalProducto(skipWizardReset) {
    if (modalProducto) modalProducto.classList.remove('open');
    if (pasoInicial) pasoInicial.style.display = 'none';
    if (pasoProductos) pasoProductos.style.display = 'flex';
    vaciarCarrito();
    if (wizardActive && !skipWizardReset) setWizardStep(1);
  }

  var MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  var DIAS_PALABRAS = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE', 'TREINTA', 'TREINTA Y UNO'];
  var CANT_PALABRAS = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE', 'TREINTA'];
  var HORAS_PALABRAS = ['CERO', 'UNA', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO'];

  function numeroACapitalizar(n) {
    if (n < 1 || n > 31) return String(n);
    return DIAS_PALABRAS[n];
  }
  function cantidadEnPalabras(n) {
    if (n < 1 || n > 30) return String(n);
    return CANT_PALABRAS[n];
  }
  function yearEnPalabras(y) {
    if (y === 2025) return 'dos mil Veinticinco';
    if (y === 2026) return 'dos mil Veintiséis';
    if (y === 2027) return 'dos mil Veintisiete';
    if (y >= 2020 && y <= 2030) return 'dos mil ' + (y === 2020 ? 'Veinte' : y === 2021 ? 'Veintiuno' : y === 2022 ? 'Veintidós' : y === 2023 ? 'Veintitrés' : y === 2024 ? 'Veinticuatro' : String(y));
    return 'dos mil ' + String(y).slice(-2);
  }

  function buildActaHtml(datos) {
    var dep = (datos.depLabel || '').toString().trim() || '—';
    var fechaStr = (datos.fechaStr || '').toString().trim();
    var funcionarioEntrega = (datos.funcionarioEntrega || '').toString().trim() || '—';
    var asistente = (datos.asistente || '').toString().trim() || '—';
    var destinatario = (datos.destinatario || '').toString().trim() || '—';
    var items = Array.isArray(datos.items) && datos.items.length > 0
      ? datos.items
      : [{
          productLabel: (datos.productLabel || '').toString().trim() || '—',
          cantidad: datos.cantidad != null ? parseInt(datos.cantidad, 10) : 0,
          expediente: (datos.expediente || '').toString().trim() || '—',
          seriales: datos.seriales || []
        }];

    var d = datos.fecha ? new Date(datos.fecha) : (fechaStr ? new Date(fechaStr) : new Date());
    var diaNum = d.getDate();
    var mesIdx = d.getMonth();
    var anio = d.getFullYear();
    var horaNum = d.getHours();
    var diaPalabra = numeroACapitalizar(diaNum);
    var mesNombre = MESES[mesIdx] || '—';
    var anioPalabra = yearEnPalabras(anio);
    var horaPalabra = (horaNum >= 0 && horaNum < 24) ? HORAS_PALABRAS[horaNum] : String(horaNum);

    var bloquesProducto = [];
    items.forEach(function (it) {
      var cantidad = it.cantidad != null ? parseInt(it.cantidad, 10) : 0;
      var productLabel = (it.productLabel || '').toString().trim() || '—';
      var caracteristicas = (it.caracteristicas || '').toString().trim();
      var cantPalabra = cantidadEnPalabras(cantidad);
      var desc = cantidad >= 1 && cantidad <= 30
        ? '(' + (cantidad < 10 ? '0' + cantidad : String(cantidad)) + ') ' + cantPalabra + ' ' + productLabel.toUpperCase()
        : '(' + cantidad + ') ' + productLabel.toUpperCase();
      var bloque = '<span class="acta-editable" contenteditable="true">' + desc + '</span>';
      if (caracteristicas) {
        bloque += ' <span class="acta-editable" contenteditable="true">' + escapeHtml(caracteristicas) + '</span>';
      }
      var seriales = it.seriales || [];
      if (seriales.length > 0) {
        var partesSerie = [];
        seriales.forEach(function (s) {
          var texto = (s.num || '—');
          partesSerie.push('<span class="acta-editable" contenteditable="true">' + escapeHtml(texto) + '</span>');
        });
        bloque += ' con sus respectivos <strong>NROS DE SERIE</strong>: ' + partesSerie.join('; ') + '.';
      } else {
        bloque += ' con sus respectivos <strong>NROS DE SERIE</strong>: <span class="acta-editable" contenteditable="true">—</span>.';
      }
      bloquesProducto.push(bloque);
    });
    var descripcionCompleta = bloquesProducto.join('<br><br>');
    var expedientesUnicos = [];
    items.forEach(function (it) {
      var expTxt = (it && it.expediente != null ? String(it.expediente) : '').trim();
      if (expTxt && expedientesUnicos.indexOf(expTxt) === -1) expedientesUnicos.push(expTxt);
    });
    if (!expedientesUnicos.length && datos && datos.expediente) {
      var expDato = String(datos.expediente).trim();
      if (expDato) expedientesUnicos.push(expDato);
    }
    var textoExpedientes = '—';
    if (expedientesUnicos.length === 1) {
      textoExpedientes = 'Los mismos fueron adquiridos mediante el EXP. ' + expedientesUnicos[0] + '.';
    } else if (expedientesUnicos.length > 1) {
      textoExpedientes = 'Los mismos fueron adquiridos mediante los EXP. ' + expedientesUnicos.join(', ') + '.';
    }

    return '<div class="acta-documento">' +
      '<div class="acta-logo-wrap"><img src="logito.jpeg" alt="" class="acta-logo"></div>' +
      '<p class="acta-parrafo"><strong>ACTA DE ENTREGA:</strong> En la Ciudad de San Miguel de Tucumán, Departamento Capital, a los <strong><span class="acta-editable" contenteditable="true">' + diaPalabra + ' días del mes de ' + mesNombre + ' del año ' + anioPalabra + '</span></strong>, siendo horas <strong><span class="acta-editable" contenteditable="true">' + horaPalabra + '</span></strong>, el funcionario de Policía que suscribe por <span class="acta-editable" contenteditable="true">' + escapeHtml(funcionarioEntrega) + '</span>, con prestación de servicio en División Control Bienes Patrimoniales (D-4); asistido en éste acto por el <span class="acta-editable" contenteditable="true">' + escapeHtml(asistente) + '</span>, redacto la presente a los fines y efectos legales de dejar debidamente documentado lo siguiente:</p>' +
      '<p class="acta-parrafo">Que en la fecha y hora indicada, se hace comparecer a <span class="acta-editable" contenteditable="true">' + escapeHtml(destinatario) + '</span>, perteneciente a <span class="acta-editable">' + escapeHtml(dep) + '</span>, a quien se le procede hacer entrega en calidad de <strong>PROVISIÓN</strong>:</p>' +
      '<p class="acta-parrafo">' + descripcionCompleta + '</p>' +
      '<p class="acta-parrafo"><span class="acta-editable" contenteditable="true">' + escapeHtml(textoExpedientes) + '</span></p>' +
      '<p class="acta-parrafo acta-parrafo-final">Así mismo, se le hace conocer que se deberá poner el mayor celo en el cuidado y mantenimiento de dichos elementos a fin que no sufra mayores deterioros más que los causados por el normal. No siendo para más se da por finalizado el acto previa lectura y ratificación de su contenido por parte de los intervinientes lo firman por ante mí en conformidad lo que CERTIFICO.</p>' +
      '<div class="acta-espacio-firmas" aria-label="Espacio reservado para firmas y sellos (completar en forma manual)"></div>' +
      '</div>';
  }

  function openModalActa(datos) {
    if (!actaContenido) return;
    actaDatosActuales = datos || null;
    actaContenido.innerHTML = buildActaHtml(datos);
    if (modalActa) modalActa.classList.remove('open');
    setWizardStep(4);
  }

  function closeModalActa() {
    if (modalActa) modalActa.classList.remove('open');
    actaDatosActuales = null;
    if (actasCola.length > 0) {
      openModalActa(actasCola.shift());
      return;
    }
  }

  function openModalConfirmarProvision() {
    if (modalConfirmarProvision) modalConfirmarProvision.classList.remove('open');
    setWizardStep(3);
  }

  function openModalElegirTipoActa(datos) {
    datosActaOpciones = datos || null;
    if (modalElegirTipoActa) modalElegirTipoActa.classList.add('open');
  }

  function closeModalElegirTipoActa() {
    if (modalElegirTipoActa) modalElegirTipoActa.classList.remove('open');
    datosActaOpciones = null;
  }

  function closeModalConfirmarProvision() {
    if (modalConfirmarProvision) modalConfirmarProvision.classList.remove('open');
    pendingProvisionData = null;
    if (wizardActive && wizardStep === 3) setWizardStep(2);
  }

  function openModalConfirmarEliminarDep(depId, depLabel) {
    if (!isAdminUser()) {
      showToast('Solo admin puede eliminar dependencias', 'error');
      return;
    }
    pendingDeleteDependencia = {
      id: depId,
      label: depLabel || 'esta dependencia'
    };
    if (confirmarEliminarDepTexto) {
      confirmarEliminarDepTexto.textContent = '¿Seguro que desea eliminar "' + pendingDeleteDependencia.label + '"?';
    }
    if (modalConfirmarEliminarDep) modalConfirmarEliminarDep.classList.add('open');
  }

  function closeModalConfirmarEliminarDep() {
    if (modalConfirmarEliminarDep) modalConfirmarEliminarDep.classList.remove('open');
    pendingDeleteDependencia = null;
  }

  function getDependenciaById(id) {
    return (dependencias || []).find(function (d) { return d.id === id; }) || null;
  }

  function renderEditarDepHijos() {
    if (!editarDepHijosTbody) return;
    var canDelete = isAdminUser();
    var dep = getDependenciaById(pendingEditDependenciaId);
    if (!dep) {
      editarDepHijosTbody.innerHTML = '<tr><td colspan="3" class="empty-state"><p>No se encontró la dependencia.</p></td></tr>';
      return;
    }
    var hijos = (dependencias || []).filter(function (d) { return d.parentId === dep.id; });
    if (!hijos.length) {
      editarDepHijosTbody.innerHTML = '<tr><td colspan="3" class="empty-state"><p>No hay elementos cargados.</p></td></tr>';
      return;
    }
    editarDepHijosTbody.innerHTML = hijos.map(function (h) {
      var tipo = dep.parentId ? 'Sub-división' : 'División';
      var num = (h.numero != null ? String(h.numero) : '').trim() || '—';
      var nom = (h.nombre || '').toString().trim() || '—';
      var accionHtml = canDelete
        ? '<button type="button" class="btn btn-danger btn-sm btn-editar-dep-eliminar-hijo" data-id="' + escapeHtml(h.id) + '" data-label="' + escapeHtml(getDisplayLabelDep(h, dependencias)) + '">Eliminar</button>'
        : '<span class="text-muted">—</span>';
      return '<tr><td>' + escapeHtml(tipo) + '</td><td>' + escapeHtml(num + ' - ' + nom) + '</td><td>' + accionHtml + '</td></tr>';
    }).join('');

    editarDepHijosTbody.querySelectorAll('.btn-editar-dep-eliminar-hijo').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        var label = btn.getAttribute('data-label') || 'este elemento';
        if (!id) return;
        openModalConfirmarEliminarDep(id, label);
      });
    });
  }

  function openModalEditarDependencia(depId) {
    var dep = getDependenciaById(depId);
    if (!dep || !modalEditarDep) return;
    pendingEditDependenciaId = dep.id;
    if (editarDepTitulo) editarDepTitulo.textContent = 'Editar: ' + getDisplayLabelDep(dep, dependencias);
    if (editarDepNombre) editarDepNombre.value = (dep.nombre || '').toString();
    if (editarDepNumero) editarDepNumero.value = (dep.numero != null ? String(dep.numero) : '').toString();
    if (editarDepCodigo) editarDepCodigo.value = (dep.codigo != null ? String(dep.codigo) : '').toString();
    if (editarDepChildLabel) editarDepChildLabel.textContent = dep.parentId ? 'Agregar sub-división' : 'Agregar división';
    if (editarDepChildNombre) editarDepChildNombre.value = '';
    if (editarDepChildNumero) editarDepChildNumero.value = '';
    renderEditarDepHijos();
    modalEditarDep.classList.add('open');
  }

  function closeModalEditarDependencia() {
    if (modalEditarDep) modalEditarDep.classList.remove('open');
    pendingEditDependenciaId = null;
  }

  function itemMatchesBusquedaGuardia(m, exp, busquedaLower) {
    if (!busquedaLower) return true;
    var codExp = exp ? String(exp.codigo != null ? exp.codigo : '').trim().toLowerCase() : '';
    var nomExp = exp ? String(exp.nombre != null ? exp.nombre : '').trim().toLowerCase() : '';
    var idExp = exp && exp.id != null ? String(exp.id).trim().toLowerCase() : '';
    var nomItem = String(m.nombre != null ? m.nombre : '').trim().toLowerCase();
    var serie = String(m.numeroSerie != null ? m.numeroSerie : '').trim().toLowerCase();
    return codExp.indexOf(busquedaLower) >= 0 || nomExp.indexOf(busquedaLower) >= 0 || idExp.indexOf(busquedaLower) >= 0 ||
      nomItem.indexOf(busquedaLower) >= 0 || serie.indexOf(busquedaLower) >= 0;
  }

  function renderModalProductos() {
    var busqueda = (inputBuscarProducto && inputBuscarProducto.value || '').trim();
    var busquedaLower = busqueda.toLowerCase();
    var hayBusqueda = !!busqueda;
    var msgEmptyDefault = (modalEmpty && modalEmpty.getAttribute('data-msg-empty')) || 'No hay productos con stock disponible. Usá el buscador para consultar agotados.';
    var agotadoEl = document.getElementById('guardia-modal-agotado');
    var prodById = new Map((productos || []).map(function (p) { return [p.id, p]; }));
    var entradas = (movimientos || []).filter(function (m) { return m.tipo === 'entrada' && m.productoId != null; });

    var provistosGuardiaPorMov = {};
    (provisiones || []).forEach(function (pr) {
      if (pr.movimiento_id) {
        provistosGuardiaPorMov[pr.movimiento_id] = (provistosGuardiaPorMov[pr.movimiento_id] || 0) + (pr.cantidad != null ? pr.cantidad : 1);
      }
    });

    var candidatos = [];
    entradas.forEach(function (m) {
      var exp = prodById.get(m.productoId);
      if (hayBusqueda && !itemMatchesBusquedaGuardia(m, exp, busquedaLower)) return;
      var codExp = exp ? ((exp.codigo != null ? String(exp.codigo) : '').trim() || '—') : '—';
      var codProducto = (m.numeroSerie != null ? String(m.numeroSerie) : '').trim() || '—';
      var nomProducto = (m.nombre != null ? String(m.nombre) : '').trim() || '—';
      var label = codProducto + ' / ' + codExp + ' — ' + nomProducto;
      var cantMov = parseInt(m.cantidad, 10) || 0;
      var provMov = provistosGuardiaPorMov[m.id] || 0;
      var disponibleMov = Math.max(0, cantMov - provMov);
      candidatos.push({ m: m, codProducto: codProducto, codExp: codExp, nomProducto: nomProducto, label: label, disponibleMov: disponibleMov });
    });

    var conStock = candidatos.filter(function (c) { return c.disponibleMov > 0; });
    var agotados = candidatos.filter(function (c) { return c.disponibleMov === 0; });
    var itemsToShow = hayBusqueda ? conStock.concat(agotados) : conStock;

    if (agotadoEl) {
      if (hayBusqueda && agotados.length && !conStock.length) {
        agotadoEl.hidden = false;
        agotadoEl.textContent = 'Producto agotado: «' + busqueda + '» no tiene unidades disponibles.';
      } else if (hayBusqueda && agotados.length && conStock.length) {
        agotadoEl.hidden = false;
        agotadoEl.textContent = 'Hay coincidencias agotadas en la búsqueda (marcadas abajo).';
      } else {
        agotadoEl.hidden = true;
        agotadoEl.textContent = '';
      }
    }

    if (modalEmpty) {
      if (!itemsToShow.length) {
        modalEmpty.style.display = 'block';
        if (hayBusqueda && !candidatos.length) {
          modalEmpty.textContent = 'No hay productos que coincidan con «' + busqueda + '».';
        } else if (hayBusqueda && agotados.length && !conStock.length) {
          modalEmpty.style.display = 'none';
        } else {
          modalEmpty.textContent = msgEmptyDefault;
        }
      } else {
        modalEmpty.style.display = 'none';
        modalEmpty.textContent = '';
      }
    }

    if (!modalListaProductos) return;
    if (!itemsToShow.length) {
      modalListaProductos.innerHTML = '';
      return;
    }

    var filas = [];
    itemsToShow.slice(0, 40).forEach(function (item) {
      var m = item.m;
      var disponibleMov = item.disponibleMov;
      var agotado = disponibleMov === 0;
      var claseDispMov = agotado ? 'stock-cell stock-cell-cero' : 'stock-cell';
      var accion = agotado
        ? '<span class="guardia-badge-agotado" title="Sin stock">Agotado</span>'
        : '<button type="button" class="btn btn-primary btn-sm btn-seleccionar-producto" data-id="' + escapeHtml(m.productoId) + '" data-movimiento-id="' + escapeHtml(m.id || '') + '" data-label="' + escapeHtml(item.label) + '" data-disponible="' + disponibleMov + '">Seleccionar</button>';
      var rowCls = agotado ? ' guardia-fila-agotada' : '';
      filas.push('<tr class="guardia-modal-fila' + rowCls + '" data-producto-id="' + escapeHtml(m.productoId) + '" data-movimiento-id="' + escapeHtml(m.id || '') + '"><td title="' + escapeHtml(item.label) + '">' + escapeHtml(item.codProducto) + '</td><td>' + escapeHtml(item.codExp) + '</td><td>' + escapeHtml(item.nomProducto) + '</td><td class="' + claseDispMov + ' num-col">' + disponibleMov + '</td><td class="guardia-col-accion">' + accion + '</td></tr>');
    });
    modalListaProductos.innerHTML = filas.join('');

    modalListaProductos.querySelectorAll('.btn-seleccionar-producto').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var disponible = parseInt(btn.getAttribute('data-disponible'), 10);
        if (disponible === 0) {
          showToast('Producto agotado: no hay unidades disponibles.', 'error');
          return;
        }
        var productoId = btn.getAttribute('data-id');
        var movimientoId = (btn.getAttribute('data-movimiento-id') || '').trim() || null;
        if (!movimientoId) {
          showToast('No se puede proveer un expediente completo. Seleccioná un ítem dentro del expediente.', 'error');
          return;
        }
        var label = btn.getAttribute('data-label') || (productoId + (movimientoId ? ' / ' + movimientoId : ''));
        addToCarrito(productoId, movimientoId, label, disponible);
      });
    });
  }

  if (inputBuscarDep) inputBuscarDep.addEventListener('input', renderBusquedaDependencias);
  if (inputBuscarProducto) inputBuscarProducto.addEventListener('input', renderModalProductos);

  // ── Listeners filtros avanzados de provisiones ──
  var filtroGuardiaIds = ['filtro-guardia-buscar', 'filtro-guardia-desde', 'filtro-guardia-hasta'];
  filtroGuardiaIds.forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    var ev = el.type === 'date' ? 'change' : 'input';
    el.addEventListener(ev, function () { renderProvisiones(); });
  });
  var btnLimpiarGuardia = document.getElementById('filtro-guardia-limpiar');
  if (btnLimpiarGuardia) {
    btnLimpiarGuardia.addEventListener('click', function () {
      filtroGuardiaIds.forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.value = '';
      });
      renderProvisiones();
    });
  }

  var btnAbrirProveer = document.getElementById('guardia-btn-abrir-proveer');
  if (btnAbrirProveer) {
    btnAbrirProveer.addEventListener('click', function () {
      if (pasoInicial) pasoInicial.style.display = 'none';
      if (pasoProductos) pasoProductos.style.display = 'flex';
      loadAll().then(function () {
        renderModalProductos();
        if (inputBuscarProducto) inputBuscarProducto.focus();
      });
    });
  }

  if (btnWizardAtras) {
    btnWizardAtras.addEventListener('click', function () {
      if (wizardStep === 4) setWizardStep(3);
      else if (wizardStep === 3) closeModalConfirmarProvision();
      else if (wizardStep === 2) {
        selectedDependenciaId = null;
        updateDepChip('');
        closeModalProducto();
      }
    });
  }
  if (btnWizardNueva) btnWizardNueva.addEventListener('click', resetWizardEntrega);
  if (btnFinalizarEntrega) btnFinalizarEntrega.addEventListener('click', resetWizardEntrega);

  document.querySelectorAll('.modal-guardia-producto-close').forEach(function (btn) {
    if (btn) btn.addEventListener('click', closeModalProducto);
  });
  if (modalProducto) {
    modalProducto.addEventListener('click', function (e) {
      if (e.target === modalProducto) closeModalProducto();
    });
  }
  if (btnVaciarCarrito) {
    btnVaciarCarrito.addEventListener('click', vaciarCarrito);
  }
  if (btnAsignar) {
    btnAsignar.addEventListener('click', function () {
      if (!carritoEntrega.length || !selectedDependenciaId) return;
      var fechaInput = inputFecha && inputFecha.value;
      var fecha = fechaInput ? new Date(fechaInput).toISOString() : new Date().toISOString();
      var concepto = (inputConcepto && inputConcepto.value || '').trim() || null;
      var dep = dependencias.find(function (d) { return d.id === selectedDependenciaId; });
      var depLabel = getDepNombreSolo(dep);
      var fechaStr = fechaInput ? new Date(fechaInput).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      var provisions = [];
      var itemsForActa = [];
      var confirmRows = [];
      if (carritoTbody) {
        carritoTbody.querySelectorAll('tr').forEach(function (tr, i) {
          var inputCant = tr.querySelector('.guardia-carrito-cantidad');
          var cant = inputCant ? (parseInt(inputCant.value, 10) || 1) : (carritoEntrega[i] && carritoEntrega[i].cantidad) || 1;
          if (carritoEntrega[i]) carritoEntrega[i].cantidad = Math.min(Math.max(1, cant), carritoEntrega[i].disponible != null ? carritoEntrega[i].disponible : 999999);
        });
      }
      carritoEntrega.forEach(function (item) {
        var provision = {
          dependencia_id: selectedDependenciaId,
          producto_id: item.productoId,
          fecha_asignacion: fecha,
          cantidad: item.cantidad,
          concepto: concepto
        };
        if (item.movimientoId) provision.movimiento_id = item.movimientoId;
        provisions.push(provision);
        var prod = (productos || []).find(function (p) { return p.id === item.productoId; });
        var expediente = prod ? ((prod.codigo != null ? String(prod.codigo) : '').trim() || '—') : '—';
        var productLabelActa = '';
        var caracteristicasActa = '';
        if (item.movimientoId && (movimientos || []).length) {
          var movActa = movimientos.find(function (m) { return m.id === item.movimientoId; });
          if (movActa) {
            var movNombre = (movActa.nombre != null ? String(movActa.nombre) : '').trim();
            var movConcepto = (movActa.concepto != null ? String(movActa.concepto) : '').trim();
            var movMarca = (movActa.marca != null ? String(movActa.marca) : '').trim();
            if (movNombre && movConcepto && movNombre.toLowerCase().indexOf(movConcepto.toLowerCase()) === -1) {
              productLabelActa = movNombre + ' - ' + movConcepto;
            } else {
              productLabelActa = movNombre || movConcepto || '';
            }
            if (movMarca) caracteristicasActa = movMarca;
          }
        }
        if (!productLabelActa) {
          var prodNombre = prod ? ((prod.nombre != null ? String(prod.nombre) : '').trim()) : '';
          productLabelActa = prodNombre || (item.label || '').toString().trim() || '—';
        }
        var seriales = [];
        if (item.movimientoId && (movimientos || []).length) {
          var mov = movimientos.find(function (m) { return m.id === item.movimientoId; });
          if (mov && (mov.numeroSerie || '').toString().trim()) seriales.push({ ext: true, num: (mov.numeroSerie || '').toString().trim() });
        }
        itemsForActa.push({
          productLabel: productLabelActa,
          cantidad: item.cantidad,
          expediente: expediente,
          seriales: seriales,
          caracteristicas: caracteristicasActa
        });
        confirmRows.push('<tr><td class="modal-confirmar-label">Producto</td><td class="modal-confirmar-valor">' + escapeHtml(item.label) + ' — Cantidad: ' + escapeHtml(String(item.cantidad)) + '</td></tr>');
      });
      confirmRows.push('<tr><td class="modal-confirmar-label">Destino</td><td class="modal-confirmar-valor">' + escapeHtml(depLabel || '—') + '</td></tr>');
      var tituloConfirm = document.querySelector('#modal-confirmar-provision .modal-confirmar-titulo');
      if (tituloConfirm) tituloConfirm.textContent = provisions.length > 1 ? '¿Seguro que desea proveer los productos?' : '¿Seguro que desea proveer el producto?';
      if (confirmarProvisionTbody) confirmarProvisionTbody.innerHTML = confirmRows.join('');
      pendingProvisionData = {
        provisions: provisions,
        depLabel: depLabel,
        itemsForActa: itemsForActa,
        fechaStr: fechaStr,
        fecha: fechaInput || new Date().toISOString(),
        conceptoVal: (inputConcepto && inputConcepto.value || '').trim() || '—',
        destinatario: depLabel
      };
      openModalConfirmarProvision();
    });
  }

  if (btnConfirmarNo) btnConfirmarNo.addEventListener('click', closeModalConfirmarProvision);
  document.querySelectorAll('.modal-confirmar-provision-close').forEach(function (btn) {
    if (btn) btn.addEventListener('click', closeModalConfirmarProvision);
  });
  if (modalConfirmarProvision) {
    modalConfirmarProvision.addEventListener('click', function (e) {
      if (e.target === modalConfirmarProvision) closeModalConfirmarProvision();
    });
  }

  if (btnEliminarDepCancelar) btnEliminarDepCancelar.addEventListener('click', closeModalConfirmarEliminarDep);
  document.querySelectorAll('.modal-confirmar-eliminar-dep-close').forEach(function (btn) {
    if (btn) btn.addEventListener('click', closeModalConfirmarEliminarDep);
  });
  if (modalConfirmarEliminarDep) {
    modalConfirmarEliminarDep.addEventListener('click', function (e) {
      if (e.target === modalConfirmarEliminarDep) closeModalConfirmarEliminarDep();
    });
  }
  if (btnEliminarDepAceptar) {
    btnEliminarDepAceptar.addEventListener('click', function () {
      if (!pendingDeleteDependencia || !pendingDeleteDependencia.id) return;
      var depId = pendingDeleteDependencia.id;
      closeModalConfirmarEliminarDep();
      if (window.appLoading && window.appLoading.show) window.appLoading.show('Eliminando dependencia…');
      window.stockAPI.deleteDependencia(depId).then(function () {
        showToast('Dependencia eliminada');
        if (selectedDependenciaId === depId) {
          selectedDependenciaId = null;
          if (tablaWrap) tablaWrap.style.display = 'none';
        }
        return loadAll();
      }).then(function () {
        renderBusquedaDependencias();
        if (selectedDependenciaId) renderProvisiones();
        if (pendingEditDependenciaId) openModalEditarDependencia(pendingEditDependenciaId);
      }).catch(function (err) {
        var msg = (err && err.message) ? err.message : 'Error al eliminar dependencia';
        showToast(msg, 'error');
      }).finally(function () {
        if (window.appLoading && window.appLoading.hide) window.appLoading.hide();
      });
    });
  }

  document.querySelectorAll('.modal-editar-dep-guardia-close').forEach(function (btn) {
    if (btn) btn.addEventListener('click', closeModalEditarDependencia);
  });
  if (modalEditarDep) {
    modalEditarDep.addEventListener('click', function (e) {
      if (e.target === modalEditarDep) closeModalEditarDependencia();
    });
  }
  if (btnEditarDepGuardar) {
    btnEditarDepGuardar.addEventListener('click', function () {
      var dep = getDependenciaById(pendingEditDependenciaId);
      if (!dep) return;
      var nombre = (editarDepNombre && editarDepNombre.value || '').trim().toUpperCase();
      var numero = (editarDepNumero && editarDepNumero.value || '').trim();
      if (!nombre) {
        showToast('El nombre es obligatorio', 'error');
        return;
      }
      var payload = {
        id: dep.id,
        nombre: nombre,
        codigo: dep.codigo || '',
        parentId: dep.parentId || null,
        numero: numero
      };
      if (window.appLoading && window.appLoading.show) window.appLoading.show('Guardando cambios…');
      window.stockAPI.saveDependencia(payload).then(function () {
        showToast('Dependencia actualizada');
        return loadAll();
      }).then(function () {
        renderBusquedaDependencias();
        openModalEditarDependencia(payload.id);
      }).catch(function (err) {
        var msg = (err && err.message) ? err.message : 'Error al guardar';
        showToast(msg, 'error');
      }).finally(function () {
        if (window.appLoading && window.appLoading.hide) window.appLoading.hide();
      });
    });
  }
  if (btnEditarDepAgregar) {
    btnEditarDepAgregar.addEventListener('click', function () {
      var dep = getDependenciaById(pendingEditDependenciaId);
      if (!dep) return;
      var nombre = (editarDepChildNombre && editarDepChildNombre.value || '').trim().toUpperCase();
      var numero = (editarDepChildNumero && editarDepChildNumero.value || '').trim();
      if (!nombre) {
        showToast('Debe ingresar un nombre', 'error');
        return;
      }
      var sufijo = dep.parentId ? 'sd' : 'div';
      var newId = dep.id + '-' + sufijo + '-' + Date.now();
      var payload = {
        id: newId,
        nombre: nombre,
        codigo: dep.codigo || '',
        parentId: dep.id,
        numero: numero
      };
      if (window.appLoading && window.appLoading.show) window.appLoading.show('Agregando…');
      window.stockAPI.saveDependencia(payload).then(function () {
        showToast(dep.parentId ? 'Sub-división agregada' : 'División agregada');
        if (editarDepChildNombre) editarDepChildNombre.value = '';
        if (editarDepChildNumero) editarDepChildNumero.value = '';
        return loadAll();
      }).then(function () {
        renderBusquedaDependencias();
        openModalEditarDependencia(dep.id);
      }).catch(function (err) {
        var msg = (err && err.message) ? err.message : 'Error al agregar';
        showToast(msg, 'error');
      }).finally(function () {
        if (window.appLoading && window.appLoading.hide) window.appLoading.hide();
      });
    });
  }

  document.querySelectorAll('.modal-elegir-acta-close').forEach(function (btn) {
    if (btn) btn.addEventListener('click', closeModalElegirTipoActa);
  });
  if (modalElegirTipoActa) {
    modalElegirTipoActa.addEventListener('click', function (e) {
      if (e.target === modalElegirTipoActa) closeModalElegirTipoActa();
    });
  }
  if (btnActaUna) {
    btnActaUna.addEventListener('click', function () {
      if (!datosActaOpciones) return;
      var datos = datosActaOpciones;
      closeModalElegirTipoActa();
      openModalActa(datos);
    });
  }
  if (btnActaPorExpediente) {
    btnActaPorExpediente.addEventListener('click', function () {
      if (!datosActaOpciones || !Array.isArray(datosActaOpciones.items) || !datosActaOpciones.items.length) return;
      var items = datosActaOpciones.items;
      var porExp = {};
      items.forEach(function (it) {
        var exp = (it.expediente || '').toString().trim() || '—';
        if (!porExp[exp]) porExp[exp] = [];
        porExp[exp].push(it);
      });
      actasCola = Object.keys(porExp).map(function (exp) {
        return {
          dependencia_id: datosActaOpciones.dependencia_id,
          depLabel: datosActaOpciones.depLabel,
          fechaStr: datosActaOpciones.fechaStr,
          fecha: datosActaOpciones.fecha,
          concepto: datosActaOpciones.concepto,
          destinatario: datosActaOpciones.destinatario,
          items: porExp[exp]
        };
      });
      closeModalElegirTipoActa();
      if (actasCola.length > 0) openModalActa(actasCola.shift());
    });
  }

  if (btnConfirmarSi) {
    btnConfirmarSi.addEventListener('click', function () {
      if (!pendingProvisionData) return;
      var data = pendingProvisionData;
      var provisions = data.provisions || [];
      closeModalConfirmarProvision();
      if (!provisions.length) return;
      var depLabel = data.depLabel;
      var itemsForActa = data.itemsForActa || [];
      var fechaStr = data.fechaStr;
      var fechaActa = data.fecha;
      var conceptoVal = data.conceptoVal;
      var destinatario = data.destinatario || depLabel;
      var saveNext = function (idx) {
        if (idx >= provisions.length) {
          showToast(provisions.length > 1 ? 'Productos provistos' : 'Producto provisto');
          closeModalProducto(true);
          vaciarCarrito();
          loadAll().then(function () {
            renderProvisiones();
            var items = itemsForActa.length ? itemsForActa : [{ productLabel: '—', cantidad: 1, expediente: '—', seriales: [] }];
            var expedientesUnicos = {};
            items.forEach(function (it) {
              var exp = (it.expediente || '').toString().trim() || '—';
              expedientesUnicos[exp] = true;
            });
            var numExpedientes = Object.keys(expedientesUnicos).length;
            var datosActa = {
              dependencia_id: selectedDependenciaId,
              depLabel: depLabel,
              fechaStr: fechaStr,
              fecha: fechaActa,
              concepto: conceptoVal,
              destinatario: destinatario,
              items: items
            };
            if (numExpedientes >= 2) {
              openModalElegirTipoActa(datosActa);
            } else {
              openModalActa(datosActa);
            }
          });
          return;
        }
        window.stockAPI.saveGuardiaProvision(provisions[idx]).then(function () {
          saveNext(idx + 1);
        }).catch(function (err) {
          showToast(err && err.message ? err.message : 'Error al guardar', 'error');
        });
      };
      saveNext(0);
    });
  }

  if (btnImprimirActa) {
    btnImprimirActa.addEventListener('click', function () {
      if (!actaContenido) return;
      var d = actaDatosActuales;
      if (d && window.stockAPI && window.stockAPI.saveActa) {
        var items = Array.isArray(d.items) && d.items.length > 0 ? d.items : null;
        var productLabel = (d.productLabel || '').toString().trim();
        var expediente = (d.expediente || '').toString().trim();
        var cantidad = d.cantidad != null ? parseInt(d.cantidad, 10) : 1;
        var seriales = Array.isArray(d.seriales) ? d.seriales.slice() : [];
        if (items && items.length > 0) {
          productLabel = items.map(function (it) {
            return (it.productLabel || '—') + ' (' + (it.cantidad != null ? it.cantidad : 1) + ')';
          }).join(', ');
          var expsUnicos = [];
          items.forEach(function (it) {
            var expTxt = (it && it.expediente != null ? String(it.expediente) : '').trim() || '—';
            if (expsUnicos.indexOf(expTxt) === -1) expsUnicos.push(expTxt);
          });
          expediente = expsUnicos.join(', ');
          cantidad = items.reduce(function (sum, it) { return sum + (it.cantidad != null ? parseInt(it.cantidad, 10) : 1); }, 0);
          items.forEach(function (it) { (it.seriales || []).forEach(function (s) { seriales.push(s); }); });
        }
        var acta = {
          id: (Date.now()).toString(),
          fecha: d.fecha || new Date().toISOString(),
          dependencia_id: d.dependencia_id || null,
          provision_id: d.provision_id || null,
          depLabel: (d.depLabel || '').toString().trim(),
          productLabel: productLabel || '—',
          expediente: expediente || '—',
          cantidad: cantidad,
          seriales: seriales,
          concepto: (d.concepto || '').toString().trim() || null
        };
        if (window.appLoading && window.appLoading.show) window.appLoading.show('Registrando acta…');
        window.stockAPI.saveActa(acta).then(function () {
          showToast('Acta registrada en el apartado Actas');
        }).catch(function () {
          showToast('Error al registrar acta', 'error');
        }).finally(function () {
          if (window.appLoading && window.appLoading.hide) window.appLoading.hide();
        });
      }
      var contenido = actaContenido.innerHTML;
      var baseUrl = (window.location.href || '').replace(/[^/]*$/, '');
      // Usamos src="logito.jpeg" relativo a la carpeta de la app, sin reemplazos especiales
      var ventana = window.open('', '_blank');
      if (!ventana) { showToast('Permite ventanas emergentes para imprimir', 'error'); return; }
      var estilosActa = '@page{size:21.49cm 31.5cm;margin:1.8cm;} ' +
        'body{font-family:\'Times New Roman\',Times,serif;margin:0;padding:0;color:#111;font-size:16pt;line-height:1.5;box-sizing:border-box;width:21.49cm;min-height:31.5cm;padding:0.5cm 1.8cm 1.8cm 1.8cm;} ' +
        '.acta-documento{font-family:inherit;width:100%;max-width:17.89cm;font-size:16pt;} ' +
        '.acta-logo-wrap{text-align:center;margin-bottom:0.95em;background:#fff;padding:0.05cm 0;} .acta-logo{width:6.1cm;height:auto;max-height:8.8cm;object-fit:contain;display:block;margin:0 auto;background:#fff;} ' +
        '.acta-parrafo{margin:0 0 0.5em;text-align:justify;font-size:16pt;} ' +
        '.acta-parrafo strong{font-weight:700;} ' +
        '.acta-parrafo-final{margin-bottom:1em;} ' +
        '.acta-editable{background:rgba(255,255,0,0.25);padding:0 1px;} ' +
        '.acta-espacio-firmas{min-height:4.2cm;margin-top:1.2em;} ' +
        '@media print{body{width:21.49cm;min-height:31.5cm;padding:0.5cm 1.8cm 1.8cm 1.8cm;font-size:16pt;} .acta-documento{font-size:16pt;} .acta-parrafo{font-size:16pt;} .acta-editable{background:transparent;} .acta-espacio-firmas{min-height:4.2cm;}}';
      ventana.document.write('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Acta de entrega</title><style>' + estilosActa + '</style></head><body>' + contenido + '</body></html>');
      ventana.document.close();
      ventana.focus();
      setTimeout(function () { ventana.print(); ventana.close(); }, 300);
    });
  }
  document.querySelectorAll('.modal-acta-close').forEach(function (btn) {
    if (btn) btn.addEventListener('click', closeModalActa);
  });
  if (modalActa) {
    modalActa.addEventListener('click', function (e) {
      if (e.target === modalActa) closeModalActa();
    });
  }

  document.addEventListener('click', function () {
    var allDd = document.querySelectorAll('.dep-menu-dots-dropdown');
    allDd.forEach(function (d) { d.classList.remove('dep-menu-dots-open'); });
  });

  window._realtimeRefresh = function () {
    loadAll().then(function () {
      renderBusquedaDependencias();
      if (selectedDependenciaId) renderProvisiones();
    });
  };

  (async function init() {
    mountWizardPanels();
    setWizardStep(1);
    await loadAll();
    renderBusquedaDependencias();
    if (selectedDependenciaId && tablaWrap) {
      tablaWrap.style.display = 'block';
      renderProvisiones();
    }
  })();
})();
