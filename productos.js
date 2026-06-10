(function () {
  'use strict';

  var data = { productos: [], movimientos: [] };
  var selectedExpedienteProductId = null;
  var esAdmin = false;

  var pagInventario = 1;
  var pagExpedientes = 1;
  var pagMovimientos = 1;
  var PAG_SIZE = (window.Paginacion && window.Paginacion.DEFAULT_POR_PAGINA) || 50;

  var panels = {
    productos: document.getElementById('panel-productos'),
    salidas: document.getElementById('panel-salidas'),
    destinos: document.getElementById('panel-destinos'),
    historial: document.getElementById('panel-historial')
  };

  var tabButtons = document.querySelectorAll('.tab');
  var listaInventario = document.getElementById('lista-inventario');
  var listaExpedientes = document.getElementById('lista-expedientes');
  var listaMovimientos = document.getElementById('lista-movimientos');
  var selectDestino = document.getElementById('select-destino');
  var buscarDestino = document.getElementById('buscar-destino');
  var destinoResumen = document.getElementById('destino-resumen');
  var listaEnviosDestino = document.getElementById('lista-envios-destino');
  var modalProducto = document.getElementById('modal-producto');
  var formProducto = document.getElementById('form-producto');
  var formSalida = document.getElementById('form-salida');
  var selectSalida = document.getElementById('salida-producto');
  var selectSalidaItem = document.getElementById('salida-item');

  function setFormLoading(form, loadingText) {
    if (!form) return;
    if (form.dataset && form.dataset.submitting === '1') return;
    if (form.dataset) form.dataset.submitting = '1';

    var submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
    if (submitBtn) {
      // Guardamos el texto original una sola vez.
      if (submitBtn.dataset && !submitBtn.dataset.originalSubmitLabel) {
        submitBtn.dataset.originalSubmitLabel = submitBtn.tagName === 'INPUT' ? submitBtn.value : submitBtn.textContent;
      }
      if (submitBtn.tagName === 'INPUT') submitBtn.value = loadingText;
      else submitBtn.textContent = loadingText;
      submitBtn.disabled = true;
    }
  }

  function clearFormLoading(form) {
    if (!form) return;
    if (form.dataset) form.dataset.submitting = '0';

    var submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
    if (submitBtn && submitBtn.dataset && submitBtn.dataset.originalSubmitLabel != null) {
      var original = submitBtn.dataset.originalSubmitLabel;
      if (submitBtn.tagName === 'INPUT') submitBtn.value = original;
      else submitBtn.textContent = original;
      submitBtn.disabled = false;
    }
  }

  // Modal info entregas
  var modalInfoEntregas = document.getElementById('modal-info-entregas');
  var infoEntregasTbody = document.getElementById('info-entregas-tbody');
  var infoEntregasEmpty = document.getElementById('info-entregas-empty');
  var infoEntregasDesc = document.getElementById('info-entregas-desc');

  function showToast(message, type) {
    var existing = document.querySelector('.toast');
    if (existing) existing.remove();
    var toast = document.createElement('div');
    toast.className = 'toast ' + (type || 'success');
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function () { toast.remove(); }, 3500);
  }

  function debugLog(msg, isError) {
    if (isError) console.error('[Productos]', msg);
    else console.log('[Productos]', msg);
  }

  function openTab(tabName) {
    tabButtons.forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    Object.keys(panels).forEach(function (key) {
      if (panels[key]) panels[key].classList.toggle('active', key === tabName);
    });
    if (tabName === 'productos') renderInventario();
    if (tabName === 'historial') renderMovimientos();
  }

  function canDelete() {
    return esAdmin === true;
  }

  function canEdit() {
    return esAdmin === true;
  }

  var modalProductosExpediente = document.getElementById('modal-productos-expediente');
  var modalListaProductosExpediente = document.getElementById('modal-lista-productos-expediente');
  var modalProductosExpedienteTitulo = document.getElementById('modal-productos-expediente-titulo');
  var modalProductosExpedienteEmpty = document.getElementById('modal-productos-expediente-empty');

  function openModalProductosExpediente(productId) {
    selectedExpedienteProductId = productId;
    var producto = data.productos.find(function (p) { return p.id === productId; });
    if (!producto || !modalProductosExpediente) return;
    modalProductosExpedienteTitulo.textContent = 'Productos del expediente ' + escapeHtml(producto.codigo);
    var entradas = (data.movimientos || []).filter(function (m) { return m.tipo === 'entrada' && m.productoId === productId; });
    var salidas = (data.movimientos || []).filter(function (m) { return m.tipo === 'salida'; });
    var salidasPorEntrada = {};
    salidas.forEach(function (s) {
      var eid = s.entradaId || s.entrada;
      if (eid) salidasPorEntrada[eid] = (salidasPorEntrada[eid] || 0) + (parseInt(s.cantidad, 10) || 0);
    });
    var provistosGuardiaPorMov = {};
    (data.guardiaProvisiones || []).forEach(function (p) {
      if (p.movimiento_id) provistosGuardiaPorMov[p.movimiento_id] = (provistosGuardiaPorMov[p.movimiento_id] || 0) + (p.cantidad != null ? p.cantidad : 1);
    });
    var unidad = producto.unidad || 'unidades';
    if (modalProductosExpedienteEmpty) modalProductosExpedienteEmpty.style.display = entradas.length ? 'none' : 'block';
    if (!modalListaProductosExpediente) return;
    if (!entradas.length) {
      modalListaProductosExpediente.innerHTML = '';
    } else {
      var ordenadas = entradas.slice().sort(function (a, b) { return new Date(b.fecha || 0) - new Date(a.fecha || 0); });
      modalListaProductosExpediente.innerHTML = ordenadas.map(function (m) {
        var fecha = m.fecha ? new Date(m.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
        var recibido = parseInt(m.cantidad, 10) || 0;
        var entregado = salidasPorEntrada[m.id] || 0;
        var provistoGuardia = provistosGuardiaPorMov[m.id] || 0;
        var disponible = Math.max(0, recibido - entregado - provistoGuardia);
        var claseCelda = disponible === 0 ? 'stock-cell stock-cell-cero' : 'stock-cell';
        var dispLabel = (disponible === 0) ? 'AGOTADO' : String(disponible);
        var editBtn = canEdit() ? '<button type="button" class="btn btn-secondary btn-sm btn-editar-mov-modal" data-movimiento-id="' + m.id + '">Editar</button>' : '<span class="text-muted">—</span>';
        return '<tr><td>' + escapeHtml(fecha) + '</td><td>' + escapeHtml(m.numeroSerie || '-') + '</td><td>' + escapeHtml(m.nombre || '-') + '</td><td>' + escapeHtml(m.marca || '-') + '</td><td class="' + claseCelda + '">' + recibido + ' / ' + escapeHtml(dispLabel) + '</td><td>' + escapeHtml(unidad) + '</td><td>' + escapeHtml(m.concepto || '-') + '</td><td>' + editBtn + '</td></tr>';
      }).join('');
      modalListaProductosExpediente.querySelectorAll('.btn-editar-mov-modal').forEach(function (btn) {
        btn.addEventListener('click', function () {
          closeModalProductosExpediente();
          openModalEditarMovimiento(btn.dataset.movimientoId);
        });
      });
    }
    modalProductosExpediente.classList.add('open');
  }

  function closeModalProductosExpediente() {
    if (modalProductosExpediente) modalProductosExpediente.classList.remove('open');
  }

  var modalBuscarSerie = document.getElementById('modal-buscar-serie-expediente');
  var inputBuscarSerie = document.getElementById('buscar-serie-input');
  var resultadosBuscarSerie = document.getElementById('modal-buscar-serie-resultados');
  var emptyBuscarSerie = document.getElementById('modal-buscar-serie-empty');

  function openModalBuscarSerie() {
    if (!selectedExpedienteProductId) return;
    if (inputBuscarSerie) inputBuscarSerie.value = '';
    if (resultadosBuscarSerie) resultadosBuscarSerie.innerHTML = '';
    if (emptyBuscarSerie) emptyBuscarSerie.style.display = 'block';
    if (modalBuscarSerie) modalBuscarSerie.classList.add('open');
    if (inputBuscarSerie) inputBuscarSerie.focus();
  }

  function closeModalBuscarSerie() {
    if (modalBuscarSerie) modalBuscarSerie.classList.remove('open');
  }

  function buscarPorSerieYMostrar() {
    var busqueda = (inputBuscarSerie && inputBuscarSerie.value || '').trim();
    // Solo entradas sin asignar: si ya están en un expediente no se pueden agregar a otro
    var entradasOtros = (data.movimientos || []).filter(function (m) {
      return m.tipo === 'entrada' && m.productoId == null;
    });
    var filtradas = busqueda
      ? entradasOtros.filter(function (m) {
          return (m.numeroSerie || '').toLowerCase().indexOf(busqueda.toLowerCase()) >= 0;
        })
      : entradasOtros;
    if (!resultadosBuscarSerie) return;
    if (emptyBuscarSerie) emptyBuscarSerie.style.display = filtradas.length ? 'none' : 'block';
    if (!filtradas.length) {
      resultadosBuscarSerie.innerHTML = '';
      return;
    }
    var getCodigoOrSinAsignar = function (id) {
      if (id == null) return 'Sin asignar';
      var p = data.productos.find(function (x) { return x.id === id; });
      return p ? p.codigo : '-';
    };
    resultadosBuscarSerie.innerHTML = filtradas.map(function (m) {
      return '<tr><td>' + escapeHtml(m.numeroSerie || '-') + '</td><td>' + escapeHtml(m.nombre || '-') + '</td><td>' + escapeHtml(m.marca || '-') + '</td><td class="stock-cell">' + (m.cantidad || '') + '</td><td>' + escapeHtml(getCodigoOrSinAsignar(m.productoId)) + '</td><td><button type="button" class="btn btn-primary btn-sm btn-confirmar-agregar-exp" data-movimiento-id="' + m.id + '">Agregar a este expediente</button></td></tr>';
    }).join('');
    resultadosBuscarSerie.querySelectorAll('.btn-confirmar-agregar-exp').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var movId = btn.dataset.movimientoId;
        window.stockAPI.asignarEntradaAExpediente(movId, selectedExpedienteProductId).then(function (result) {
          if (result.ok) {
            showToast('Producto agregado al expediente');
            closeModalBuscarSerie();
            loadData().then(function () {
              openModalProductosExpediente(selectedExpedienteProductId);
            });
          } else showToast(result.error || 'Error', 'error');
        }).catch(function () { showToast('Error al asignar', 'error'); });
      });
    });
  }

  var modalAgregarProducto = document.getElementById('modal-agregar-producto');
  var selectExpedienteAgregar = document.getElementById('agregar-producto-expediente');

  var OPCION_NUEVO_EXPEDIENTE = '— Crear nuevo expediente (escribe abajo) —';

  function fillExpedientesModalAgregarProducto() {
    if (!selectExpedienteAgregar) return;
    var options = '<option value="">' + OPCION_NUEVO_EXPEDIENTE + '</option>';
    var productos = (data && data.productos) ? data.productos : [];
    productos.filter(function (p) { return p && p.id != null && String(p.id).trim() !== ''; }).forEach(function (p) {
      var label = [p.codigo, p.nombre].filter(Boolean).join(' - ') || (p.nombre || p.codigo || p.id) || 'Expediente';
      options += '<option value="' + escapeHtml(p.id) + '">' + escapeHtml(String(label)) + '</option>';
    });
    selectExpedienteAgregar.innerHTML = options;
    selectExpedienteAgregar.value = '';
    toggleNuevoExpedienteCampo();
  }

  function toggleNuevoExpedienteCampo() {
    var wrap = document.getElementById('wrap-nuevo-expediente-numero');
    var inputNuevoExp = document.getElementById('agregar-producto-nuevo-expediente-numero');
    if (!wrap || !selectExpedienteAgregar) return;
    var esNuevo = !selectExpedienteAgregar.value || selectExpedienteAgregar.value.trim() === '';
    wrap.style.display = esNuevo ? 'block' : 'none';
    if (inputNuevoExp) { inputNuevoExp.required = esNuevo; inputNuevoExp.disabled = !esNuevo; }
  }

  function renderSeriesInputsAgregarProducto() {
    var container = document.getElementById('agregar-producto-series-container');
    var inputCantidad = document.getElementById('agregar-producto-cantidad');
    if (!container || !inputCantidad) return;
    var n = parseInt(inputCantidad.value, 10) || 0;
    if (n < 1) n = 1;
    if (n > 100) n = 100;
    container.innerHTML = '';
    for (var i = 0; i < n; i++) {
      var num = i + 1;
      var div = document.createElement('div');
      div.className = 'form-group form-group-inline-serie';
      div.innerHTML = '<label for="agregar-producto-serie-' + i + '">Nº de serie ' + num + ':</label><input type="text" id="agregar-producto-serie-' + i + '" placeholder="Opcional" autocomplete="off">';
      container.appendChild(div);
    }
    aplicarGeneracionCodigosSerie(false);
  }

  function normalizarCodigoSerie(valor) {
    var raw = String(valor || '').toUpperCase();
    raw = raw.replace(/[^A-Z0-9\-\.\/ ]/g, '');
    raw = raw.replace(/\s+/g, '-').replace(/-+/g, '-').trim();
    return raw || '';
  }

  function generarCodigoSerieUnico() {
    var actuales = new Set((data.movimientos || []).map(function (m) {
      return String(m && m.numeroSerie ? m.numeroSerie : '').trim().toUpperCase();
    }).filter(Boolean));
    var fecha = new Date();
    var stamp = fecha.getFullYear().toString() +
      String(fecha.getMonth() + 1).padStart(2, '0') +
      String(fecha.getDate()).padStart(2, '0');
    var intentos = 0;
    while (intentos < 2000) {
      var sufijo = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
      var codigo = 'SR-' + stamp + '-' + sufijo;
      if (!actuales.has(codigo)) return codigo;
      intentos++;
    }
    return 'SR-' + Date.now();
  }

  function aplicarGeneracionCodigosSerie(force) {
    var generarChk = document.getElementById('agregar-producto-generar-codigo');
    if (!force && (!generarChk || !generarChk.checked)) return;
    var inputCantidad = document.getElementById('agregar-producto-cantidad');
    var n = parseInt(inputCantidad && inputCantidad.value ? inputCantidad.value : '0', 10) || 0;
    if (n < 1) return;
    var usados = new Set((data.movimientos || []).map(function (m) {
      return String(m && m.numeroSerie ? m.numeroSerie : '').trim().toUpperCase();
    }).filter(Boolean));
    for (var i = 0; i < n; i++) {
      var inp = document.getElementById('agregar-producto-serie-' + i);
      if (!inp) continue;
      var valorActual = String(inp.value || '').trim();
      if (valorActual && !force) continue;
      var codigo = '';
      var guard = 0;
      while (!codigo && guard < 500) {
        var candidato = normalizarCodigoSerie(generarCodigoSerieUnico());
        if (!candidato || usados.has(candidato)) {
          guard++;
          continue;
        }
        codigo = candidato;
      }
      if (!codigo) codigo = normalizarCodigoSerie('SR-' + Date.now() + '-' + i);
      inp.value = codigo;
      usados.add(codigo);
    }
  }

  function openModalAgregarProducto() {
    try {
      debugLog('Clic en + Agregar producto → abriendo modal...');
      fillExpedientesModalAgregarProducto();
      var inputNuevoExp = document.getElementById('agregar-producto-nuevo-expediente-numero');
      if (inputNuevoExp) inputNuevoExp.value = '';
      var inputCantidad = document.getElementById('agregar-producto-cantidad');
      if (inputCantidad && !inputCantidad.value) inputCantidad.value = '1';
      renderSeriesInputsAgregarProducto();
      var chkGenerar = document.getElementById('agregar-producto-generar-codigo');
      if (chkGenerar) chkGenerar.checked = true;
      var chkImprimir = document.getElementById('agregar-producto-imprimir-etiquetas');
      if (chkImprimir) chkImprimir.checked = true;
      aplicarGeneracionCodigosSerie(false);
      var fechaEl = document.getElementById('agregar-producto-fecha');
      if (fechaEl && !fechaEl.value) {
        var now = new Date();
        fechaEl.value = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0') + 'T' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
      }
      if (modalAgregarProducto) {
        modalAgregarProducto.classList.add('open');
        debugLog('Modal abierto correctamente.');
      } else {
        debugLog('ERROR: no se encontró #modal-agregar-producto', true);
        showToast('Error: no se pudo abrir el modal de agregar producto', 'error');
      }
      var firstInput = document.getElementById('agregar-producto-nombre');
      if (firstInput) {
        firstInput.removeAttribute('readonly');
        firstInput.disabled = false;
        setTimeout(function () { firstInput.focus(); }, 100);
      }
    } catch (err) {
      var errMsg = (err && err.message ? err.message : String(err));
      debugLog('ERROR al abrir modal: ' + errMsg, true);
      showToast('Error al abrir: ' + errMsg, 'error');
    }
  }

  function closeModalAgregarProducto() {
    if (modalAgregarProducto) modalAgregarProducto.classList.remove('open');
  }

  async function guardarAgregarProductoInventario(e) {
    e.preventDefault();
    var form = document.getElementById('form-agregar-producto-inventario');
    if (form && form.dataset && form.dataset.submitting === '1') return;
    var expedienteId = selectExpedienteAgregar ? (selectExpedienteAgregar.value || '').trim() : '';
    var cantidad = parseInt(document.getElementById('agregar-producto-cantidad').value, 10) || 0;
    var numerosSerie = [];
    for (var idx = 0; idx < cantidad; idx++) {
      var inp = document.getElementById('agregar-producto-serie-' + idx);
      numerosSerie.push(inp && inp.value ? inp.value.trim() : '');
    }
    var nombre = document.getElementById('agregar-producto-nombre').value.trim();
    var marca = document.getElementById('agregar-producto-marca').value.trim();
    var descripcion = document.getElementById('agregar-producto-descripcion').value.trim();
    var imprimirEtiquetas = !!(document.getElementById('agregar-producto-imprimir-etiquetas') || {}).checked;
    var generarAutomatico = !!(document.getElementById('agregar-producto-generar-codigo') || {}).checked;
    var fechaEl = document.getElementById('agregar-producto-fecha');
    var fechaInput = (fechaEl && fechaEl.value && fechaEl.value.trim()) ? fechaEl.value.trim() : '';
    if (!nombre) {
      showToast('El nombre es obligatorio', 'error');
      return;
    }
    if (!cantidad || cantidad < 1) {
      showToast('La cantidad debe ser al menos 1', 'error');
      return;
    }
    var nuevoExpNumeroEl = document.getElementById('agregar-producto-nuevo-expediente-numero');
    var nuevoExpNumero = (nuevoExpNumeroEl && nuevoExpNumeroEl.value) ? nuevoExpNumeroEl.value.trim() : '';
    if (!expedienteId && !nuevoExpNumero) {
      showToast('Indica el número o nombre del nuevo expediente', 'error');
      return;
    }
    try {
      setFormLoading(form, 'Guardando…');
      console.log('[Productos] guardarAgregarProductoInventario: guardando cantidad=', cantidad);
      if (generarAutomatico) {
        aplicarGeneracionCodigosSerie(false);
        numerosSerie = [];
        for (var idx2 = 0; idx2 < cantidad; idx2++) {
          var inp2 = document.getElementById('agregar-producto-serie-' + idx2);
          numerosSerie.push(inp2 && inp2.value ? inp2.value.trim() : '');
        }
      }
      var productoId;
      if (expedienteId) {
        productoId = expedienteId;
      } else {
        var producto = {
          codigo: nuevoExpNumero,
          nombre: nuevoExpNumero,
          marca: marca || undefined,
          descripcion: descripcion || undefined,
          stockActual: 0,
          unidad: 'unidades'
        };
        productoId = await window.stockAPI.saveProducto(producto);
      }
      var baseId = Date.now().toString();
      var fechaIso = fechaInput ? new Date(fechaInput).toISOString() : undefined;
      var etiquetasParaImprimir = [];
      var codigosSesion = new Set();
      for (var i = 0; i < cantidad; i++) {
        var numeroSerie = (numerosSerie[i] !== undefined && numerosSerie[i] !== '') ? numerosSerie[i] : generarCodigoSerieUnico();
        numeroSerie = normalizarCodigoSerie(numeroSerie);
        if (!numeroSerie) numeroSerie = normalizarCodigoSerie(generarCodigoSerieUnico());
        var reintentos = 0;
        while (codigosSesion.has(numeroSerie) && reintentos < 30) {
          numeroSerie = normalizarCodigoSerie(generarCodigoSerieUnico());
          reintentos++;
        }
        codigosSesion.add(numeroSerie);
        var movimiento = {
          id: baseId + '-' + i,
          tipo: 'entrada',
          productoId: productoId,
          cantidad: '1',
          nombre: nombre,
          marca: marca || undefined,
          numeroSerie: numeroSerie,
          concepto: descripcion || undefined,
          fecha: fechaIso
        };
        var result = await window.stockAPI.registrarMovimiento(movimiento);
        if (result && result.ok === false) {
          showToast(result.error || 'Error al registrar entrada', 'error');
          return;
        }
        etiquetasParaImprimir.push({
          numeroSerie: numeroSerie,
          nombre: nombre,
          marca: marca || '',
          expediente: (expedienteId || nuevoExpNumero || '').trim()
        });
      }
      if (imprimirEtiquetas && etiquetasParaImprimir.length && window.stockAPI.printEtiquetas) {
        try {
          var printResult = await window.stockAPI.printEtiquetas(etiquetasParaImprimir);
          if (printResult && printResult.ok === false) {
            showToast(printResult.error || 'Producto guardado, pero no se imprimieron las etiquetas', 'error');
          }
        } catch (eImp) {
          console.warn('[Productos] Error al imprimir etiquetas:', eImp);
          showToast('Producto guardado, pero falló la impresión de etiquetas', 'error');
        }
      }
      showToast('Producto guardado en inventario');
      document.getElementById('form-agregar-producto-inventario').reset();
      if (selectExpedienteAgregar) selectExpedienteAgregar.value = '';
      if (nuevoExpNumeroEl) nuevoExpNumeroEl.value = '';
      toggleNuevoExpedienteCampo();
      closeModalAgregarProducto();
      await loadData();
      renderInventario();
      fillProductSelects();
      renderExpedientes();
    } catch (err) {
      console.error('[Productos] guardarAgregarProductoInventario ERROR:', err);
      showToast(err.message || 'Error al guardar', 'error');
    } finally {
      clearFormLoading(form);
    }
  }

  function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function openModalEditarMovimiento(movimientoId) {
    if (!canEdit()) {
      showToast('Solo admin puede editar.', 'error');
      return;
    }
    var mov = data.movimientos.find(function (m) { return m.id === movimientoId; });
    if (!mov) return;
    document.getElementById('edit-mov-id').value = mov.id;
    document.getElementById('edit-mov-numero-serie').value = mov.numeroSerie || '';
    document.getElementById('edit-mov-nombre').value = mov.nombre || '';
    document.getElementById('edit-mov-marca').value = mov.marca || '';
    document.getElementById('edit-mov-cantidad').value = mov.cantidad || '';
    document.getElementById('edit-mov-descripcion').value = mov.concepto || '';
    var fechaEl = document.getElementById('edit-mov-fecha');
    if (mov.fecha) {
      var d = new Date(mov.fecha);
      fechaEl.value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + 'T' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    } else fechaEl.value = '';
    document.getElementById('modal-editar-movimiento').classList.add('open');
  }

  function closeModalEditarMovimiento() {
    document.getElementById('modal-editar-movimiento').classList.remove('open');
  }

  async function guardarEditarMovimiento(e) {
    e.preventDefault();
    if (!canEdit()) {
      showToast('Solo admin puede editar.', 'error');
      return;
    }
    var form = document.getElementById('form-editar-movimiento');
    if (form && form.dataset && form.dataset.submitting === '1') return;
    var id = document.getElementById('edit-mov-id').value;
    var fechaInput = document.getElementById('edit-mov-fecha').value;
    var updates = {
      numeroSerie: document.getElementById('edit-mov-numero-serie').value.trim() || undefined,
      nombre: document.getElementById('edit-mov-nombre').value.trim() || undefined,
      marca: document.getElementById('edit-mov-marca').value.trim() || undefined,
      cantidad: document.getElementById('edit-mov-cantidad').value,
      concepto: document.getElementById('edit-mov-descripcion').value.trim() || undefined,
      fecha: fechaInput ? new Date(fechaInput).toISOString() : undefined
    };
    try {
      setFormLoading(form, 'Guardando…');
      var result = await window.stockAPI.updateMovimiento(id, updates);
      if (result.ok) {
        showToast('Producto actualizado');
        closeModalEditarMovimiento();
        await loadData();
        fillProductSelects();
      } else showToast(result.error || 'Error', 'error');
    } catch (err) {
      showToast('Error al guardar', 'error');
    } finally {
      clearFormLoading(form);
    }
  }

  async function loadData() {
    try {
      console.log('[Productos] loadData: solicitando datos de inventario...');
      var raw = await (window.invokeStockLightOrFull
        ? window.invokeStockLightOrFull('getProductosData', function () { return window.stockAPI.getData(); })
        : window.stockAPI.getData());
      if (!raw || typeof raw !== 'object') {
        console.warn('[Productos] loadData: getData() no devolvió un objeto:', raw);
        raw = {};
      }
      data = {
        productos: Array.isArray(raw.productos) ? raw.productos : (data && data.productos) || [],
        movimientos: Array.isArray(raw.movimientos) ? raw.movimientos : (data && data.movimientos) || [],
        guardiaProvisiones: Array.isArray(raw.guardiaProvisiones) ? raw.guardiaProvisiones : (data && data.guardiaProvisiones) || [],
        dependencias: Array.isArray(raw.dependencias) ? raw.dependencias : (data && data.dependencias) || []
      };
      if (!data.dependencias.length && window.stockAPI.getDependencias) {
        try {
          data.dependencias = await window.stockAPI.getDependencias();
          if (!Array.isArray(data.dependencias)) data.dependencias = [];
        } catch (e2) { console.warn('[Productos] loadData: getDependencias falló', e2); }
      }
      console.log('[Productos] loadData: ok. productos=', data.productos.length, 'movimientos=', data.movimientos.length, 'guardiaProvisiones=', data.guardiaProvisiones.length);
    } catch (e) {
      console.error('[Productos] loadData ERROR:', e);
      showToast('Error al cargar datos: ' + (e && e.message ? e.message : 'Error desconocido'), 'error');
      if (!data || typeof data !== 'object') data = { productos: [], movimientos: [], guardiaProvisiones: [], dependencias: [] };
    }
  }

  function getDisplayLabelDep(dep, deps) {
    if (!dep) return '';
    var codigo = (dep.codigo || '').toString().trim();
    var nombre = (dep.nombre || '').toString().trim();
    var numero = (dep.numero || '').toString().trim();
    if (dep.parentId && deps && deps.length) {
      var parent = deps.find(function (d) { return d.id === dep.parentId; });
      if (parent) codigo = (parent.codigo || '').toString().trim();
    }
    if (dep.parentId && numero) return codigo + ' - ' + numero + ' - ' + nombre;
    if (codigo && nombre) return codigo + ' - ' + nombre;
    return nombre || codigo || (dep.nombre || '');
  }

  function openModalInfoEntregas(movId) {
    if (!modalInfoEntregas || !infoEntregasTbody) return;
    var provs = (data.guardiaProvisiones || []).filter(function (p) { return p && p.movimiento_id === movId; });
    provs.sort(function (a, b) { return new Date(b.fecha_asignacion || 0) - new Date(a.fecha_asignacion || 0); });
    if (infoEntregasEmpty) infoEntregasEmpty.style.display = provs.length ? 'none' : 'block';
    if (infoEntregasDesc) infoEntregasDesc.textContent = 'Entregas registradas para este producto (' + provs.length + ').';
    if (!provs.length) {
      infoEntregasTbody.innerHTML = '';
      modalInfoEntregas.classList.add('open');
      return;
    }
    var deps = data.dependencias || [];
    var getDepLabel = function (id) {
      var d = deps.find(function (x) { return x.id === id; });
      if (!d) return '—';
      return getDisplayLabelDep(d, deps) || d.nombre || d.codigo || '—';
    };
    // Si por algún motivo la provisión no trae `usuario`, lo tomamos del movimiento.
    var movUsuario = '';
    var mov = (data.movimientos || []).find(function (m) { return m && m.id === movId; });
    if (mov) movUsuario = (mov.usuario || mov.user || mov.username || mov.email || '').toString().trim() || '';
    infoEntregasTbody.innerHTML = provs.map(function (p) {
      var fecha = p.fecha_asignacion ? new Date(p.fecha_asignacion).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
      var dep = getDepLabel(p.dependencia_id);
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

  async function fillDestinosDatalist() {
    var list = document.getElementById('list-destinos');
    if (!list) return;
    try {
      var deps = await window.stockAPI.getDependencias();
      var destinos = (data.movimientos || []).filter(function (m) { return m.tipo === 'salida' && (m.destino || '').trim(); }).map(function (m) { return (m.destino || '').trim(); });
      var set = new Set();
      deps.forEach(function (d) {
        var label = getDisplayLabelDep(d, deps);
        if (label) set.add(label);
      });
      destinos.forEach(function (d) { set.add(d); });
      list.innerHTML = Array.from(set).map(function (n) { return '<option value="' + escapeHtml(n) + '">'; }).join('');
    } catch (e) {}
  }

  function fillProductSelects() {
    var options = data.productos.map(function (p) {
      return '<option value="' + p.id + '">' + escapeHtml(p.nombre) + ' (' + escapeHtml(p.codigo) + ') - Stock: ' + (p.stockActual ?? 0) + '</option>';
    }).join('');
    selectSalida.innerHTML = '<option value="">Seleccionar expediente</option>' + options;
    fillSalidaItems(selectSalida.value);
  }

  function renderInventario() {
    console.log('[Productos] renderInventario: listaInventario=', !!listaInventario, 'data.movimientos=', (data && data.movimientos) ? data.movimientos.length : 0);
    if (!listaInventario) {
      console.warn('[Productos] renderInventario: no existe lista-inventario en el DOM');
      return;
    }
    var movimientos = (data && data.movimientos) ? data.movimientos : [];
    var entradas = movimientos.filter(function (m) { return m && m.tipo === 'entrada'; });
    var salidas = movimientos.filter(function (m) { return m && m.tipo === 'salida'; });
    console.log('[Productos] renderInventario: entradas=', entradas.length, 'salidas=', salidas.length);
    var salidasPorEntrada = {};
    salidas.forEach(function (s) {
      var eid = s.entradaId || s.entrada;
      if (eid) salidasPorEntrada[eid] = (salidasPorEntrada[eid] || 0) + (parseInt(s.cantidad, 10) || 0);
    });
    var provistosGuardiaPorMov = {};
    (data.guardiaProvisiones || []).forEach(function (p) {
      if (p.movimiento_id) provistosGuardiaPorMov[p.movimiento_id] = (provistosGuardiaPorMov[p.movimiento_id] || 0) + (p.cantidad != null ? p.cantidad : 1);
    });
    entradas.sort(function (a, b) {
      var codA = (data.productos || []).find(function (p) { return p.id === a.productoId; });
      var codB = (data.productos || []).find(function (p) { return p.id === b.productoId; });
      var sA = (codA && codA.codigo ? codA.codigo : '') + (a.fecha || '');
      var sB = (codB && codB.codigo ? codB.codigo : '') + (b.fecha || '');
      return sB.localeCompare(sA);
    });
    var inputBuscarInv = document.getElementById('buscar-inventario');
    var busqueda = (inputBuscarInv && inputBuscarInv.value) ? inputBuscarInv.value.trim().toLowerCase() : '';
    var entradasFiltradas = entradas;
    if (busqueda) {
      entradasFiltradas = entradas.filter(function (m) {
        var producto = m.productoId ? (data.productos || []).find(function (p) { return p.id === m.productoId; }) : null;
        var codigoExp = producto ? ((producto.codigo || '').toString().trim() || '').toLowerCase() : '';
        var nombre = (m.nombre || '').toString().toLowerCase();
        var numeroSerie = (m.numeroSerie || '').toString().toLowerCase();
        var marca = (m.marca || '').toString().toLowerCase();
        var concepto = (m.concepto || '').toString().toLowerCase();
        return nombre.indexOf(busqueda) >= 0 || numeroSerie.indexOf(busqueda) >= 0 ||
          codigoExp.indexOf(busqueda) >= 0 || marca.indexOf(busqueda) >= 0 || concepto.indexOf(busqueda) >= 0;
      });
    }
    if (!entradas.length) {
      listaInventario.innerHTML = '<tr><td colspan="9" class="empty-state"><p>No hay productos en el inventario. Agrega productos desde Expedientes o usa "+ Agregar producto".</p></td></tr>';
      console.log('[Productos] renderInventario: sin entradas, mostrando mensaje vacío');
      return;
    }
    if (entradasFiltradas.length === 0) {
      listaInventario.innerHTML = '<tr><td colspan="9" class="empty-state"><p>Ningún producto coincide con &quot;' + escapeHtml(busqueda) + '&quot;. Prueba por nombre, nº de serie o expediente.</p></td></tr>';
      var pagContInvEmpty = document.getElementById('pag-inventario');
      if (pagContInvEmpty) pagContInvEmpty.innerHTML = '';
      return;
    }
    var infoInv = window.Paginacion ? window.Paginacion.paginar(entradasFiltradas, pagInventario, PAG_SIZE) : { items: entradasFiltradas, pagina: 1, totalPaginas: 1, total: entradasFiltradas.length, inicio: 1, fin: entradasFiltradas.length };
    pagInventario = infoInv.pagina;
    listaInventario.innerHTML = infoInv.items.map(function (m) {
      var producto = m.productoId ? (data.productos || []).find(function (p) { return p.id === m.productoId; }) : null;
      var codigoExp = producto ? ((producto.codigo || '').trim() || '-') : 'Sin asignar';
      var cantidad = parseInt(m.cantidad, 10) || 0;
      var entregado = salidasPorEntrada[m.id] || 0;
      var provistoGuardia = provistosGuardiaPorMov[m.id] || 0;
      var disponible = Math.max(0, cantidad - entregado - provistoGuardia);
      var fecha = m.fecha ? new Date(m.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
      var claseDisponible = disponible === 0 ? 'stock-cell stock-cell-cero' : 'stock-cell';
      var dispLabel = (disponible === 0) ? 'AGOTADO' : String(disponible);
      var extra = (provistoGuardia > 0)
        ? '<button type="button" class="inv-menu-entregas" data-mov-id="' + escapeHtml(m.id) + '">Ver entrega(s)</button>'
        : '';
      var deleteAction = canDelete()
        ? '<button type="button" class="inv-menu-eliminar" data-mov-id="' + escapeHtml(m.id) + '">Eliminar</button>'
        : '';
      var editAction = canEdit() ? '<button type="button" class="inv-menu-editar" data-mov-id="' + escapeHtml(m.id) + '">Editar</button>' : '';
      return '<tr><td>' + escapeHtml(codigoExp) + '</td><td>' + escapeHtml(m.nombre || '-') + '</td><td>' + escapeHtml(m.marca || '-') + '</td><td>' + escapeHtml(m.numeroSerie || '-') + '</td><td class="stock-cell num-col">' + cantidad + '</td><td class="' + claseDisponible + ' num-col">' + escapeHtml(dispLabel) + '</td><td>' + escapeHtml(fecha) + '</td><td>' + escapeHtml(m.concepto || '-') + '</td><td class="td-acciones-inv"><div class="inv-acciones-wrap"><button type="button" class="btn btn-icon btn-menu-inv" data-mov-id="' + escapeHtml(m.id) + '" aria-label="Más acciones" title="Acciones">&#8942;</button><div class="inv-menu-dropdown">' + extra + editAction + deleteAction + '</div></div></td></tr>';
    }).join('');

    listaInventario.querySelectorAll('.btn-menu-inv').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var wrap = btn.closest('.inv-acciones-wrap');
        var dropdown = wrap ? wrap.querySelector('.inv-menu-dropdown') : null;
        listaInventario.querySelectorAll('.inv-menu-dropdown').forEach(function (d) { d.classList.remove('open'); });
        if (dropdown) dropdown.classList.toggle('open');
      });
    });
    listaInventario.querySelectorAll('.inv-menu-editar').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var movId = btn.getAttribute('data-mov-id');
        listaInventario.querySelectorAll('.inv-menu-dropdown').forEach(function (d) { d.classList.remove('open'); });
        if (movId) openModalEditarMovimiento(movId);
      });
    });
    listaInventario.querySelectorAll('.inv-menu-eliminar').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (!canDelete()) {
          showToast('Solo admin puede eliminar.', 'error');
          return;
        }
        var movId = btn.getAttribute('data-mov-id');
        listaInventario.querySelectorAll('.inv-menu-dropdown').forEach(function (d) { d.classList.remove('open'); });
        if (!movId) return;
        if (!confirm('¿Seguro que quiere eliminar este producto?')) return;
        window.stockAPI.deleteMovimiento(movId).then(function () {
          showToast('Producto eliminado del inventario');
          loadData().then(function () {
            renderInventario();
            renderExpedientes();
            fillProductSelects();
            renderMovimientos();
          });
        }).catch(function () { showToast('Error al eliminar', 'error'); });
      });
    });

    listaInventario.querySelectorAll('.inv-menu-entregas').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var movId = btn.getAttribute('data-mov-id');
        listaInventario.querySelectorAll('.inv-menu-dropdown.open').forEach(function (d) { d.classList.remove('open'); });
        if (movId) openModalInfoEntregas(movId);
      });
    });

    var pagContInv = document.getElementById('pag-inventario');
    if (pagContInv && window.Paginacion) {
      window.Paginacion.renderControles(pagContInv, infoInv, function (p) { pagInventario = p; renderInventario(); });
    }
  }

  function fillSalidaItems(productoId) {
    if (!selectSalidaItem) return;
    selectSalidaItem.innerHTML = '<option value="">— Seleccionar producto del expediente —</option>';
    if (!productoId) { selectSalidaItem.disabled = true; return; }
    var entradas = (data.movimientos || []).filter(function (m) { return m.tipo === 'entrada' && m.productoId === productoId; });
    entradas.forEach(function (m) {
      var label = [m.nombre || 'Sin nombre', m.marca, m.numeroSerie ? 'Nº ' + m.numeroSerie : ''].filter(Boolean).join(' — ') || ('Entrada ' + (m.fecha ? new Date(m.fecha).toLocaleDateString('es') : m.id));
      selectSalidaItem.innerHTML += '<option value="' + m.id + '">' + escapeHtml(label) + '</option>';
    });
    selectSalidaItem.disabled = entradas.length === 0;
    if (entradas.length === 0) selectSalidaItem.innerHTML = '<option value="">— No hay productos en este expediente —</option>';
  }

  function renderExpedientes() {
    if (!listaExpedientes) return;
    if (!data.productos.length) {
      listaExpedientes.innerHTML = '<tr><td colspan="7" class="empty-state"><p>No hay expedientes. Crea uno con "Nuevo Expediente".</p></td></tr>';
      var pcExpE = document.getElementById('pag-expedientes-prod');
      if (pcExpE) pcExpE.innerHTML = '';
      return;
    }
    var infoExp = window.Paginacion ? window.Paginacion.paginar(data.productos, pagExpedientes, PAG_SIZE) : { items: data.productos, pagina: 1, totalPaginas: 1, total: data.productos.length, inicio: 1, fin: data.productos.length };
    pagExpedientes = infoExp.pagina;
    listaExpedientes.innerHTML = infoExp.items.map(function (p) {
      var deleteBtn = canDelete()
        ? ' <button type="button" class="btn btn-danger btn-sm btn-eliminar" data-id="' + p.id + '">Eliminar</button>'
        : '';
      var editarBtn = canEdit() ? '<button type="button" class="btn btn-secondary btn-sm btn-editar" data-id="' + p.id + '">Editar</button>' : '';
      return '<tr><td><button type="button" class="link-expediente" data-id="' + p.id + '" title="Ver productos recibidos">' + escapeHtml(p.codigo) + '</button></td><td>' + escapeHtml(p.numeroSerie || '-') + '</td><td>' + escapeHtml(p.nombre) + '</td><td>' + escapeHtml(p.descripcion || '-') + '</td><td class="stock-cell num-col">' + Number(p.stockActual ?? 0) + '</td><td>' + escapeHtml(p.unidad || 'unidades') + '</td><td>' + editarBtn + deleteBtn + '</td></tr>';
    }).join('');
    listaExpedientes.querySelectorAll('.link-expediente').forEach(function (btn) {
      btn.addEventListener('click', function () { openModalProductosExpediente(btn.dataset.id); });
    });
    listaExpedientes.querySelectorAll('.btn-editar').forEach(function (btn) {
      btn.addEventListener('click', function () { openModalProducto(btn.dataset.id); });
    });
    listaExpedientes.querySelectorAll('.btn-eliminar').forEach(function (btn) {
      btn.addEventListener('click', function () { eliminarProducto(btn.dataset.id); });
    });

    var pcExp = document.getElementById('pag-expedientes-prod');
    if (pcExp && window.Paginacion) {
      window.Paginacion.renderControles(pcExp, infoExp, function (p) { pagExpedientes = p; renderExpedientes(); });
    }
  }

  function renderMovimientos() {
    if (!listaMovimientos) return;
    var getNombreProducto = function (id) {
      var p = (data.productos || []).find(function (x) { return x.id === id; });
      if (!p) return '(eliminado)';
      var s = ((p.codigo || '') + ' ' + (p.nombre || '')).trim();
      return s || p.nombre || '(eliminado)';
    };
    var deps = data.dependencias || [];
    var getNombreDep = function (id) {
      var d = deps.find(function (x) { return x.id === id; });
      return d ? getDisplayLabelDep(d, deps) : '(dependencia eliminada)';
    };
    var getExpedienteNum = function (productoId) {
      var p = (data.productos || []).find(function (x) { return x.id === productoId; });
      return p ? ((p.codigo || p.id || '').toString().trim() || '—') : '—';
    };
    var movs = (data.movimientos || []).map(function (m) {
      var prod = (data.productos || []).find(function (x) { return x.id === m.productoId; });
      var nombreProducto = (m.nombre || m.numeroSerie || (prod && (prod.nombre || prod.codigo)) || '').toString().trim() || '—';
      var usuario = (m.usuario || m.user || m.username || m.userEmail || m.email || '').toString().trim() || '—';
      var destinoRaw = (m.destino || '').trim();
      return {
        fecha: m.fecha ? new Date(m.fecha).getTime() : 0,
        tipo: m.tipo,
        tipoLabel: m.tipo === 'entrada' ? 'Entrada' : 'Salida',
        tipoClass: m.tipo === 'entrada' ? 'badge-entrada' : 'badge-salida',
        expediente: getExpedienteNum(m.productoId),
        producto: nombreProducto,
        destino: m.tipo === 'salida' ? (destinoRaw ? 'Entregado a ' + destinoRaw : '—') : '—',
        cantidad: m.cantidad,
        concepto: (m.concepto || '').trim() || '—',
        usuario: usuario
      };
    });
    var provisiones = (data.guardiaProvisiones || []).map(function (p) {
      var prod = (data.productos || []).find(function (x) { return x.id === p.producto_id; });
      var nombreProducto = '';
      if (prod) {
        nombreProducto = ((prod.nombre || '') + ' ' + (prod.codigo || '')).toString().trim();
      }
      if (p.movimiento_id && (data.movimientos || []).length) {
        var mov = (data.movimientos || []).find(function (m) { return m.id === p.movimiento_id; });
        if (mov) nombreProducto = (mov.nombre || mov.numeroSerie || '').toString().trim() || nombreProducto || 'ítem';
      }
      var usuarioProv = (p.usuario || p.user || p.username || p.userEmail || p.email || '').toString().trim() || '—';
      if (!nombreProducto) nombreProducto = '—';
      var depLabel = getNombreDep(p.dependencia_id);
      return {
        fecha: p.fecha_asignacion ? new Date(p.fecha_asignacion).getTime() : 0,
        tipo: 'provision',
        tipoLabel: 'Provisión / Entrega',
        tipoClass: 'badge-provision',
        expediente: getExpedienteNum(p.producto_id),
        producto: nombreProducto,
        destino: depLabel ? 'Entregado a ' + depLabel : '—',
        cantidad: p.cantidad != null ? p.cantidad : 1,
        concepto: (p.concepto || '').trim() || '—',
        usuario: usuarioProv
      };
    });
    var todos = movs.concat(provisiones).sort(function (a, b) { return b.fecha - a.fecha; });

    // ── Filtros avanzados ──
    var fBuscar = document.getElementById('filtro-mov-buscar');
    var fTipo = document.getElementById('filtro-mov-tipo');
    var fDesde = document.getElementById('filtro-mov-desde');
    var fHasta = document.getElementById('filtro-mov-hasta');
    var fUsuario = document.getElementById('filtro-mov-usuario');

    var qBuscar = fBuscar ? fBuscar.value.trim().toLowerCase() : '';
    var qTipo = fTipo ? fTipo.value : '';
    var qDesde = fDesde && fDesde.value ? new Date(fDesde.value + 'T00:00:00').getTime() : 0;
    var qHasta = fHasta && fHasta.value ? new Date(fHasta.value + 'T23:59:59').getTime() : 0;
    var qUsuario = fUsuario ? fUsuario.value.trim().toLowerCase() : '';

    if (qBuscar || qTipo || qDesde || qHasta || qUsuario) {
      todos = todos.filter(function (e) {
        if (qTipo && e.tipo !== qTipo) return false;
        if (qDesde && e.fecha < qDesde) return false;
        if (qHasta && e.fecha > qHasta) return false;
        if (qUsuario && (e.usuario || '').toLowerCase().indexOf(qUsuario) === -1) return false;
        if (qBuscar) {
          var haystack = [e.producto, e.expediente, e.destino, e.concepto, e.tipoLabel].join(' ').toLowerCase();
          if (haystack.indexOf(qBuscar) === -1) return false;
        }
        return true;
      });
    }

    if (!todos.length) {
      listaMovimientos.innerHTML = '<tr><td colspan="8" class="empty-state"><p>No hay movimientos que coincidan con los filtros.</p></td></tr>';
      var pcMovE = document.getElementById('pag-movimientos');
      if (pcMovE) pcMovE.innerHTML = '';
      return;
    }
    var infoMov = window.Paginacion ? window.Paginacion.paginar(todos, pagMovimientos, PAG_SIZE) : { items: todos, pagina: 1, totalPaginas: 1, total: todos.length, inicio: 1, fin: todos.length };
    pagMovimientos = infoMov.pagina;
    listaMovimientos.innerHTML = infoMov.items.map(function (e) {
      var fechaStr = e.fecha ? new Date(e.fecha).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
      return '<tr><td>' + escapeHtml(fechaStr) + '</td><td><span class="badge ' + e.tipoClass + '">' + escapeHtml(e.tipoLabel) + '</span></td><td>' + escapeHtml(e.expediente) + '</td><td>' + escapeHtml(e.producto) + '</td><td>' + escapeHtml(e.destino) + '</td><td class="num-col">' + e.cantidad + '</td><td class="col-mov-usuario-td">' + escapeHtml(e.usuario || '—') + '</td><td>' + escapeHtml(e.concepto) + '</td></tr>';
    }).join('');

    var pcMov = document.getElementById('pag-movimientos');
    if (pcMov && window.Paginacion) {
      window.Paginacion.renderControles(pcMov, infoMov, function (p) { pagMovimientos = p; renderMovimientos(); });
    }
  }

  function getUniqueDestinos() {
    var salidas = (data.movimientos || []).filter(function (m) { return m.tipo === 'salida'; });
    var set = new Set();
    salidas.forEach(function (m) { set.add((m.destino || '').trim() || 'Sin destino'); });
    return Array.from(set).filter(Boolean).sort();
  }

  function renderDestinos() {
    var destinos = getUniqueDestinos();
    if (selectDestino) {
      var currentVal = selectDestino.value;
      selectDestino.innerHTML = '<option value="">-- Elige un destino --</option>' + destinos.map(function (d) { return '<option value="' + escapeHtml(d) + '">' + escapeHtml(d) + '</option>'; }).join('');
      if (currentVal && destinos.indexOf(currentVal) >= 0) selectDestino.value = currentVal;
    }
    updateEnviosPorDestino();
    var search = (buscarDestino && buscarDestino.value || '').trim().toLowerCase();
    if (selectDestino && search) {
      Array.from(selectDestino.options).forEach(function (opt, i) {
        if (i === 0) return;
        opt.hidden = !opt.textContent.toLowerCase().includes(search);
      });
    } else if (selectDestino) Array.from(selectDestino.options).forEach(function (opt) { opt.hidden = false; });
  }

  function updateEnviosPorDestino() {
    var destino = (selectDestino && selectDestino.value || '').trim();
    var getProducto = function (id) { return data.productos.find(function (p) { return p.id === id; }); };
    var salidas = (data.movimientos || []).filter(function (m) { return m.tipo === 'salida'; });
    var envios = destino ? salidas.filter(function (m) { return ((m.destino || '').trim() || 'Sin destino') === destino; }) : [];
    if (!destino) {
      if (destinoResumen) destinoResumen.innerHTML = '';
      if (listaEnviosDestino) listaEnviosDestino.innerHTML = '<tr><td colspan="5" class="empty-state"><p>Selecciona un destino.</p></td></tr>';
      return;
    }
    if (!envios.length) {
      if (destinoResumen) destinoResumen.innerHTML = '<p class="empty-state">No hay envíos para este destino.</p>';
      if (listaEnviosDestino) listaEnviosDestino.innerHTML = '';
      return;
    }
    var totalUnidades = envios.reduce(function (sum, m) { return sum + (parseInt(m.cantidad, 10) || 0); }, 0);
    if (destinoResumen) destinoResumen.innerHTML = '<p class="destino-resumen-texto">A <strong>' + escapeHtml(destino) + '</strong> enviaste <strong>' + totalUnidades + '</strong> unidades (' + envios.length + ' movimiento(s)).</p>';
    var ordenadas = envios.slice().sort(function (a, b) { return new Date(b.fecha || 0) - new Date(a.fecha || 0); });
    if (listaEnviosDestino) listaEnviosDestino.innerHTML = ordenadas.map(function (m) {
      var p = getProducto(m.productoId);
      var fecha = m.fecha ? new Date(m.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
      return '<tr><td>' + escapeHtml(fecha) + '</td><td>' + escapeHtml(p ? p.nombre : '(eliminado)') + '</td><td class="stock-cell">' + m.cantidad + '</td><td>' + escapeHtml(p ? (p.unidad || 'unidades') : 'unidades') + '</td><td>' + escapeHtml(m.concepto || '-') + '</td></tr>';
    }).join('');
  }

  function openModalProducto(id) {
    if (id && !canEdit()) {
      showToast('Solo admin puede editar.', 'error');
      return;
    }
    var titulo = document.getElementById('modal-producto-titulo');
    if (id) {
      var p = data.productos.find(function (x) { return x.id === id; });
      if (!p) return;
      titulo.textContent = 'Editar Expediente';
      document.getElementById('producto-id').value = p.id;
      document.getElementById('producto-codigo').value = p.codigo || '';
    } else {
      titulo.textContent = 'Nuevo Expediente';
      formProducto.reset();
      document.getElementById('producto-id').value = '';
    }
    modalProducto.classList.add('open');
  }

  function closeModalProducto() {
    modalProducto.classList.remove('open');
  }

  async function guardarProducto(e) {
    e.preventDefault();
    var form = formProducto || document.getElementById('form-producto');
    if (form && form.dataset && form.dataset.submitting === '1') return;
    var id = document.getElementById('producto-id').value.trim() || null;
    if (id && !canEdit()) {
      showToast('Solo admin puede editar.', 'error');
      return;
    }
    var codigo = document.getElementById('producto-codigo').value.trim();
    var producto;
    if (id) {
      var existente = data.productos.find(function (p) { return p.id === id; });
      producto = existente ? Object.assign({}, existente, { codigo: codigo }) : { id: id, codigo: codigo, nombre: codigo, descripcion: '', stockActual: 0, unidad: 'unidades' };
    } else {
      producto = { codigo: codigo, nombre: codigo, descripcion: '', stockActual: 0, unidad: 'unidades' };
    }
    try {
      setFormLoading(form, 'Guardando…');
      await window.stockAPI.saveProducto(producto);
      showToast(id ? 'Expediente actualizado' : 'Expediente creado');
      closeModalProducto();
      await loadData();
      renderExpedientes();
      fillProductSelects();
    } catch (err) {
      showToast(err && err.message ? err.message : 'Error al guardar', 'error');
    } finally {
      clearFormLoading(form);
    }
  }

  async function eliminarProducto(id) {
    if (!canDelete()) {
      showToast('Solo admin puede eliminar.', 'error');
      return;
    }
    if (!confirm('¿Eliminar este expediente?')) return;
    try {
      await window.stockAPI.deleteProducto(id);
      showToast('Expediente eliminado');
      await loadData();
      renderExpedientes();
      renderInventario();
      fillProductSelects();
    } catch (err) { showToast(err && err.message ? err.message : 'Error al eliminar', 'error'); }
  }

  async function registrarSalida(e) {
    e.preventDefault();
    var form = formSalida || document.getElementById('form-salida');
    if (form && form.dataset && form.dataset.submitting === '1') return;
    var productoId = selectSalida.value;
    var cantidad = document.getElementById('salida-cantidad').value;
    var concepto = document.getElementById('salida-concepto').value.trim();
    var destino = document.getElementById('salida-destino').value.trim();
    if (!productoId) { showToast('Selecciona un producto', 'error'); return; }
    if (!destino) { showToast('Indica el destino', 'error'); return; }
    var entradaId = selectSalidaItem && selectSalidaItem.value ? selectSalidaItem.value : undefined;
    try {
      setFormLoading(form, 'Guardando…');
      var result = await window.stockAPI.registrarMovimiento({ tipo: 'salida', productoId: productoId, cantidad: cantidad, concepto: concepto, destino: destino, entradaId: entradaId });
      if (result.ok) {
        showToast('Salida registrada');
        if (formSalida) formSalida.reset();
        await loadData();
        if (formSalida) fillProductSelects();
      } else showToast(result.error || 'Error', 'error');
    } catch (err) {
      showToast('Error al registrar salida', 'error');
    } finally {
      clearFormLoading(form);
    }
  }

  function init() {
    // Marcar en el body si el usuario NO es admin, para ocultar la columna "Usuario" en el historial
    if (window.stockAPI && window.stockAPI.getAuthStatus) {
      window.stockAPI.getAuthStatus().then(function (r) {
        var rol = (r && r.rol ? r.rol : 'usuario').toLowerCase();
        esAdmin = rol === 'admin';
        if (rol !== 'admin') {
          document.body.classList.add('rol-no-admin');
        }
        renderInventario();
        renderExpedientes();
      }).catch(function () {
        esAdmin = false;
        document.body.classList.add('rol-no-admin');
        renderInventario();
        renderExpedientes();
      });
    } else {
      esAdmin = false;
      document.body.classList.add('rol-no-admin');
    }

    window.stockAPI.getDataBackend().then(function (r) {
      var badge = document.getElementById('backend-badge');
      if (badge) {
        badge.textContent = r.backend === 'supabase' ? 'Guardando en Supabase' : 'Modo local (archivo)';
        badge.className = 'backend-badge ' + (r.backend === 'supabase' ? 'backend-supabase' : 'backend-local');
      }
    });
    tabButtons.forEach(function (btn) {
      btn.addEventListener('click', function () { openTab(btn.dataset.tab); });
    });
    var btnNuevoProducto = document.getElementById('btn-nuevo-producto');
    if (btnNuevoProducto) btnNuevoProducto.addEventListener('click', function () { openModalProducto(null); });
    var btnAgregarProductoInv = document.getElementById('btn-agregar-producto-inventario');
    if (btnAgregarProductoInv) {
      btnAgregarProductoInv.addEventListener('click', function () {
        debugLog('Botón + Agregar producto pulsado.');
        openModalAgregarProducto();
      });
    } else {
      debugLog('AVISO: no se encontró el botón #btn-agregar-producto-inventario', true);
    }
    var btnExportarInventario = document.getElementById('btn-exportar-inventario');
    if (btnExportarInventario) {
      btnExportarInventario.addEventListener('click', function () {
        if (window.appLoading && window.appLoading.show) window.appLoading.show('Exportando inventario…');
        window.stockAPI.exportInventario().then(function (r) {
          if (r && r.ok && r.path) {
            showToast('Inventario exportado en: ' + r.path);
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
    var btnExportarMovimientos = document.getElementById('btn-exportar-movimientos');
    if (btnExportarMovimientos) {
      btnExportarMovimientos.addEventListener('click', function () {
        if (window.appLoading && window.appLoading.show) window.appLoading.show('Exportando historial…');
        window.stockAPI.exportMovimientos().then(function (r) {
          if (r && r.ok && r.path) {
            showToast('Historial exportado en: ' + r.path);
          } else if (r && r.cancelled) {
            // usuario canceló
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
    // ── Listeners filtros avanzados del historial ──
    var filtroMovInputs = ['filtro-mov-buscar', 'filtro-mov-tipo', 'filtro-mov-desde', 'filtro-mov-hasta', 'filtro-mov-usuario'];
    filtroMovInputs.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      var ev = (el.tagName === 'SELECT' || el.type === 'date') ? 'change' : 'input';
      el.addEventListener(ev, function () { pagMovimientos = 1; renderMovimientos(); });
    });
    var btnLimpiarMov = document.getElementById('filtro-mov-limpiar');
    if (btnLimpiarMov) {
      btnLimpiarMov.addEventListener('click', function () {
        filtroMovInputs.forEach(function (id) {
          var el = document.getElementById(id);
          if (el) el.value = '';
        });
        pagMovimientos = 1;
        renderMovimientos();
      });
    }

    var inputBuscarInventario = document.getElementById('buscar-inventario');
    if (inputBuscarInventario) inputBuscarInventario.addEventListener('input', function () { pagInventario = 1; renderInventario(); });
    if (inputBuscarInventario) inputBuscarInventario.addEventListener('change', function () { pagInventario = 1; renderInventario(); });
    document.addEventListener('click', function (e) {
      if (e.target.closest('.inv-acciones-wrap')) return;
      document.querySelectorAll('.inv-menu-dropdown.open').forEach(function (d) { d.classList.remove('open'); });
    });

    document.querySelectorAll('.modal-info-entregas-close').forEach(function (btn) {
      if (btn) btn.addEventListener('click', closeModalInfoEntregas);
    });
    if (modalInfoEntregas) {
      modalInfoEntregas.addEventListener('click', function (e) {
        if (e.target === modalInfoEntregas) closeModalInfoEntregas();
      });
    }
    var formAgregarProductoInv = document.getElementById('form-agregar-producto-inventario');
    if (formAgregarProductoInv) formAgregarProductoInv.addEventListener('submit', guardarAgregarProductoInventario);
    if (selectExpedienteAgregar) selectExpedienteAgregar.addEventListener('change', toggleNuevoExpedienteCampo);
    var inputCantidadAgregar = document.getElementById('agregar-producto-cantidad');
    if (inputCantidadAgregar) inputCantidadAgregar.addEventListener('input', renderSeriesInputsAgregarProducto);
    if (inputCantidadAgregar) inputCantidadAgregar.addEventListener('change', renderSeriesInputsAgregarProducto);
    var chkGenerarCodigos = document.getElementById('agregar-producto-generar-codigo');
    if (chkGenerarCodigos) chkGenerarCodigos.addEventListener('change', function () {
      if (chkGenerarCodigos.checked) aplicarGeneracionCodigosSerie(false);
    });
    var btnGenerarCodigosSerie = document.getElementById('btn-generar-codigos-serie');
    if (btnGenerarCodigosSerie) btnGenerarCodigosSerie.addEventListener('click', function () {
      aplicarGeneracionCodigosSerie(true);
    });
    document.querySelectorAll('.modal-agregar-producto-close').forEach(function (btn) {
      btn.addEventListener('click', closeModalAgregarProducto);
    });
    if (modalAgregarProducto) {
      modalAgregarProducto.addEventListener('click', function (e) {
        if (e.target === modalAgregarProducto) closeModalAgregarProducto();
      });
    }
    modalProducto.querySelector('.modal-close').addEventListener('click', closeModalProducto);
    modalProducto.querySelector('.modal-cancel').addEventListener('click', closeModalProducto);
    modalProducto.addEventListener('click', function (e) { if (e.target === modalProducto) closeModalProducto(); });
    formProducto.addEventListener('submit', guardarProducto);
    if (formSalida) formSalida.addEventListener('submit', registrarSalida);
    document.getElementById('form-editar-movimiento').addEventListener('submit', guardarEditarMovimiento);
    document.querySelector('.modal-editar-mov-close').addEventListener('click', closeModalEditarMovimiento);
    document.querySelector('.modal-editar-mov-cancel').addEventListener('click', closeModalEditarMovimiento);
    document.getElementById('modal-editar-movimiento').addEventListener('click', function (ev) { if (ev.target.id === 'modal-editar-movimiento') closeModalEditarMovimiento(); });
    document.querySelectorAll('.modal-productos-expediente-close').forEach(function (btn) {
      btn.addEventListener('click', closeModalProductosExpediente);
    });
    if (modalProductosExpediente) {
      modalProductosExpediente.addEventListener('click', function (e) {
        if (e.target === modalProductosExpediente) closeModalProductosExpediente();
      });
    }
    var btnAbrirBuscarSerie = document.getElementById('modal-btn-abrir-buscar-serie');
    if (btnAbrirBuscarSerie) btnAbrirBuscarSerie.addEventListener('click', openModalBuscarSerie);
    var btnBuscarSerie = document.getElementById('btn-buscar-serie');
    if (btnBuscarSerie) btnBuscarSerie.addEventListener('click', buscarPorSerieYMostrar);
    if (inputBuscarSerie) inputBuscarSerie.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); buscarPorSerieYMostrar(); } });
    document.querySelectorAll('.modal-buscar-serie-close').forEach(function (btn) {
      btn.addEventListener('click', closeModalBuscarSerie);
    });
    if (modalBuscarSerie) {
      modalBuscarSerie.addEventListener('click', function (e) {
        if (e.target === modalBuscarSerie) closeModalBuscarSerie();
      });
    }
    if (selectSalida) selectSalida.addEventListener('change', function () { fillSalidaItems(selectSalida.value); });
    if (selectDestino) selectDestino.addEventListener('change', updateEnviosPorDestino);
    if (buscarDestino) buscarDestino.addEventListener('input', renderDestinos);

    loadData().then(function () {
      debugLog('Página cargada. Al pulsar "+ Agregar producto" aquí aparecerán los mensajes.');
      renderInventario();
      renderExpedientes();
      if (formSalida) fillProductSelects();
      renderMovimientos();
      if (selectDestino) fillDestinosDatalist();
      if (location.hash === '#historial') openTab('historial');
    }).catch(function (err) {
      debugLog('ERROR al cargar datos: ' + (err && err.message ? err.message : String(err)), true);
      showToast('Error al cargar: ' + (err && err.message ? err.message : String(err)), 'error');
      renderInventario();
    });
  }

  window._realtimeRefresh = function () {
    loadData().then(function () {
      renderInventario();
      renderExpedientes();
      fillProductSelects();
      renderMovimientos();
    }).catch(function () {});
  };

  init();
})();
