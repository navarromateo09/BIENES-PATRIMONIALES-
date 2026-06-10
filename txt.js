(function () {
  'use strict';

  if (!window.stockAPI) return;

  var contenidoEl = document.getElementById('txt-contenido');

  var buscarInput = document.getElementById('txt-buscar-dependencias');
  var limpiarBtn = document.getElementById('txt-limpiar-busqueda');
  var resultadosEl = document.getElementById('txt-resultados');
  var btnImportar = document.getElementById('txt-btn-importar');
  var inputImportar = document.getElementById('txt-input-importar');
  var btnTabBuscador = document.getElementById('txt-tab-buscador');
  var btnTabRealizados = document.getElementById('txt-tab-realizados');
  var btnTabNuevo = document.getElementById('txt-tab-nuevo');
  var seccionBuscador = document.getElementById('txt-seccion-buscador');
  var seccionRealizados = document.getElementById('txt-seccion-realizados');
  var seccionTxtNuevo = document.getElementById('txt-seccion-nuevo');
  var panelDescTxt = document.querySelector('.content-panel > .panel-desc');
  var btnNuevoTxt = document.getElementById('txt-btn-nuevo');
  var txtVistaAnterior = 'buscador';
  var txtOnOpenNuevoVista = null;
  var btnTxtNuevoGuardar = document.getElementById('txt-nuevo-guardar');
  var btnTxtNuevoAgregarRepetidas = document.getElementById('txt-nuevo-agregar-repetidas');
  var txtNuevoRepeticiones = document.getElementById('txt-nuevo-repeticiones');
  var btnTxtNuevoFinalizado = document.getElementById('txt-nuevo-finalizado');
  var txtNuevoTablaBody = document.getElementById('txt-nuevo-tabla-body');
  var txtModelosTablaBody = document.getElementById('txt-modelos-tabla-body');
  var txtRealizadosCountEl = document.getElementById('txt-realizados-count');
  var txtNuevoRegistros = [];
  var txtNuevoEditIndex = -1;
  var TXT_REPARTICION_DEFAULT_NUMERO = '250';
  var TXT_REPARTICION_DEFAULT_NOMBRE = 'DPTO GENERAL DE POLICIA';
  var txtRealizadosCache = [];

  /** Máximos por columna TXT (alineados con TXT_NUEVO_EXPORT_SPEC en main.js). Usado al guardar y al abrir modelos. */
  var TXT_NUEVO_FIELD_MAX = {
    reparticion: 3,
    reparticionDesc: 25,
    dependencia: 4,
    dependenciaDesc: 25,
    habitacion: 4,
    habitacionDesc: 25,
    cuenta: 3,
    especie: 4,
    motivo: 2,
    estado: 1,
    cantidad: 3,
    orden: 4,
    valorDigits: 10,
    mes: 2,
    anio: 2,
    descripcion: 46
  };

  function strSliceTxtNuevo(s, max) {
    s = String(s == null ? '' : s);
    return s.length <= max ? s : s.slice(0, max);
  }

  function onlyDigitsSliceTxtNuevo(s, max) {
    var d = String(s || '').replace(/[^\d]/g, '');
    return d.length <= max ? d : d.slice(0, max);
  }

  function normalizeTxtNuevoValorDigits(s) {
    return onlyDigitsSliceTxtNuevo(String(s || '').replace(/\./g, '').replace(/,/g, ''), TXT_NUEVO_FIELD_MAX.valorDigits);
  }

  function clampTxtNuevoItem(item) {
    var M = TXT_NUEVO_FIELD_MAX;
    var cantStr = onlyDigitsSliceTxtNuevo(String(item.cantidad || ''), M.cantidad);
    var cantOut = '';
    if (cantStr !== '') {
      var nq = parseInt(cantStr, 10);
      if (!isNaN(nq) && nq >= 0) {
        if (nq > 999) cantOut = '999';
        else cantOut = String(nq);
      }
    }
    var mesStr = onlyDigitsSliceTxtNuevo(String(item.mes || ''), M.mes);
    var mesOut = '';
    if (mesStr !== '') {
      var mm = parseInt(mesStr, 10);
      if (!isNaN(mm)) {
        if (mm > 12) mm = 12;
        if (mm < 0) mm = 0;
        mesOut = String(mm);
      }
    }
    return {
      reparticion: strSliceTxtNuevo(item.reparticion, M.reparticion),
      reparticionDesc: strSliceTxtNuevo(item.reparticionDesc, M.reparticionDesc),
      dependencia: onlyDigitsSliceTxtNuevo(item.dependencia, M.dependencia),
      dependenciaDesc: strSliceTxtNuevo(item.dependenciaDesc, M.dependenciaDesc),
      habitacion: onlyDigitsSliceTxtNuevo(item.habitacion, M.habitacion),
      habitacionDesc: strSliceTxtNuevo(item.habitacionDesc, M.habitacionDesc),
      cuenta: strSliceTxtNuevo(item.cuenta, M.cuenta),
      especie: onlyDigitsSliceTxtNuevo(item.especie, M.especie),
      motivo: onlyDigitsSliceTxtNuevo(item.motivo, M.motivo),
      estado: strSliceTxtNuevo(item.estado, M.estado),
      cantidad: cantOut,
      orden: onlyDigitsSliceTxtNuevo(item.orden, M.orden),
      valor: normalizeTxtNuevoValorDigits(item.valor),
      mes: mesOut,
      anio: onlyDigitsSliceTxtNuevo(String(item.anio || ''), M.anio),
      descripcion: strSliceTxtNuevo(String(item.descripcion || '').toUpperCase(), M.descripcion)
    };
  }

  var modalTxtOrden = document.getElementById('modal-txt-orden');
  var txtOrdenColOrden = document.getElementById('txt-orden-col-orden');
  var txtOrdenCantidad = document.getElementById('txt-orden-cantidad');
  var txtOrdenUltimaMod = document.getElementById('txt-orden-ultima-mod');
  var txtOrdenGuardarBtn = document.getElementById('txt-orden-guardar');
  var txtOrdenSelectedId = null;

  var btnAgregarTxt = document.getElementById('txt-btn-agregar');
  var modalTxtAgregar = document.getElementById('modal-txt-agregar');
  var agregarModoInput = document.getElementById('txt-agregar-modo');
  var agregarModoTabs = document.querySelectorAll('.txt-agregar-modo-tab[data-txt-modo]');
  var sectionNueva = document.getElementById('txt-agregar-section-nueva');
  var sectionExistente = document.getElementById('txt-agregar-section-existente');

  var inputCodigoTxt = document.getElementById('txt-agregar-codigo');
  var inputNombreDepTxt = document.getElementById('txt-agregar-nombre-dep');
  var inputDivNumeroTxt = document.getElementById('txt-agregar-div-num');
  var inputDivNombreTxt = document.getElementById('txt-agregar-div-nombre');
  var btnAgregarDivLista = document.getElementById('txt-agregar-div-btn');
  var ulDivLista = document.getElementById('txt-agregar-div-lista');

  var inputDepBuscarTxt = document.getElementById('txt-agregar-dep-buscar');
  var inputDepIdHidden = document.getElementById('txt-agregar-dep-id');
  var depSugerenciasAgregar = document.getElementById('txt-agregar-dep-sugerencias');
  var depSeleccionadaMsg = document.getElementById('txt-agregar-dep-seleccionada');
  var depExistenteVacioMsg = document.getElementById('txt-agregar-dep-existente-vacio');
  var txtAgregarMainDepsList = [];
  var txtAgregarDepSuggestIdx = -1;
  var inputDivNumeroExTxt = document.getElementById('txt-agregar-div-num-ex');
  var inputDivNombreExTxt = document.getElementById('txt-agregar-div-nombre-ex');

  var btnAgregarTxtGuardar = document.getElementById('txt-agregar-guardar');

  var divisionesNuevaTemp = [];

  function getAgregarModo() {
    return agregarModoInput && agregarModoInput.value ? agregarModoInput.value : 'existente';
  }

  function setAgregarModo(modo) {
    var m = modo === 'nueva' ? 'nueva' : 'existente';
    if (agregarModoInput) agregarModoInput.value = m;
    agregarModoTabs.forEach(function (btn) {
      var active = btn.getAttribute('data-txt-modo') === m;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function init() {
    bindTxtAgregarModalHandlers();

    function setTxtVista(view) {
      var isBuscador = view === 'buscador';
      var isRealizados = view === 'realizados';
      var isNuevo = view === 'nuevo';
      if (seccionBuscador) seccionBuscador.style.display = isBuscador ? 'block' : 'none';
      if (seccionRealizados) seccionRealizados.style.display = isRealizados ? 'block' : 'none';
      if (seccionTxtNuevo) {
        if (isNuevo) {
          seccionTxtNuevo.removeAttribute('hidden');
          seccionTxtNuevo.style.display = 'flex';
        } else {
          seccionTxtNuevo.setAttribute('hidden', '');
          seccionTxtNuevo.style.display = 'none';
        }
      }
      if (panelDescTxt) panelDescTxt.style.display = isNuevo ? 'none' : '';
      if (btnTabBuscador) {
        btnTabBuscador.classList.toggle('btn-primary', isBuscador);
        btnTabBuscador.classList.toggle('btn-secondary', !isBuscador);
      }
      if (btnTabRealizados) {
        btnTabRealizados.classList.toggle('btn-primary', isRealizados);
        btnTabRealizados.classList.toggle('btn-secondary', !isRealizados);
      }
      if (btnTabNuevo) {
        btnTabNuevo.classList.toggle('btn-primary', isNuevo);
        btnTabNuevo.classList.toggle('btn-secondary', !isNuevo);
      }
    }

    function openTxtNuevoVista(fromView) {
      if (fromView && fromView !== 'nuevo') txtVistaAnterior = fromView;
      if (txtOnOpenNuevoVista) txtOnOpenNuevoVista();
      setTxtVista('nuevo');
    }

    function closeTxtNuevoVista() {
      setTxtVista(txtVistaAnterior || 'buscador');
    }

    window.__txtOpenNuevo = openTxtNuevoVista;

    function formatFechaHoraIso(isoString) {
      if (!isoString) return '—';
      var date = new Date(isoString);
      if (isNaN(date.getTime())) return '—';
      return date.toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    function getTxtRealizados() {
      return Array.isArray(txtRealizadosCache) ? txtRealizadosCache : [];
    }

    async function refreshTxtRealizados() {
      try {
        if (window.stockAPI && window.stockAPI.getTxtRealizados) {
          var rows = await window.stockAPI.getTxtRealizados();
          txtRealizadosCache = Array.isArray(rows) ? rows : [];
        } else {
          txtRealizadosCache = [];
        }
      } catch (e) {
        console.error('[TXT] Error al cargar realizados:', e);
        txtRealizadosCache = [];
      }
    }

    async function registerTxtRealizado(registros, nombreBase) {
      if (!Array.isArray(registros) || !registros.length) return;
      var ahora = new Date().toISOString();
      var nombre = String(nombreBase || 'TXT EXPORTADO').trim() || 'TXT EXPORTADO';
      var payload = {
        id: 'txt-realizado-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
        nombre: nombre,
        registros: JSON.parse(JSON.stringify(registros)),
        createdAt: ahora,
        updatedAt: ahora
      };
      if (!window.stockAPI || !window.stockAPI.saveTxtRealizado) {
        throw new Error('La función saveTxtRealizado no está disponible. Reinicia la app para cargar la última versión.');
      }
      var res = await window.stockAPI.saveTxtRealizado(payload);
      await refreshTxtRealizados();
      renderTxtModelosGuardados();
      return res || { ok: true };
    }

    function isTxtRealizadosSchemaErrorMsg(msg) {
      var m = String(msg || '').toLowerCase();
      if (m.indexOf('no handler registered') >= 0) return false;
      if (m.indexOf('does not exist') >= 0 && m.indexOf('txt_realizados') >= 0) return true;
      if (m.indexOf('schema cache') >= 0 && m.indexOf('txt_realizados') >= 0) return true;
      if (m.indexOf('registros_json') >= 0 && m.indexOf('column') >= 0) return true;
      if (m.indexOf('row-level security') >= 0 || m.indexOf('row level security') >= 0) return true;
      if (m.indexOf('violates') >= 0 && m.indexOf('policy') >= 0) return true;
      return m.indexOf('relation') >= 0 && m.indexOf('txt_realizados') >= 0;
    }

    function renderTxtModelosGuardados() {
      if (!txtModelosTablaBody) return;
      var modelos = getTxtRealizados();
      if (txtRealizadosCountEl) txtRealizadosCountEl.textContent = String(modelos.length || 0);
      if (!modelos.length) {
        txtModelosTablaBody.innerHTML = '<tr><td colspan="4" class="txt-realizados-empty">Todavía no hay TXT realizados.</td></tr>';
        return;
      }
      txtModelosTablaBody.innerHTML = modelos.map(function (modelo) {
        var id = String(modelo.id || '');
        var nombre = String(modelo.nombre || 'SIN NOMBRE');
        var cantidad = Array.isArray(modelo.registros) ? modelo.registros.length : 0;
        var updatedAt = formatFechaHoraIso(modelo.updatedAt);
        return '<tr>' +
          '<td class="txt-realizados-name-cell">' + escapeHtml(nombre) + '</td>' +
          '<td><span class="txt-realizados-badge">' + escapeHtml(String(cantidad)) + '</span></td>' +
          '<td class="txt-realizados-date-cell">' + escapeHtml(updatedAt) + '</td>' +
          '<td class="txt-realizados-actions">' +
            '<button type="button" class="btn btn-secondary btn-sm txt-modelo-abrir" data-model-id="' + escapeAttr(id) + '">Ver</button>' +
            '<button type="button" class="btn btn-secondary btn-sm txt-modelo-exportar" data-model-id="' + escapeAttr(id) + '">TXT</button>' +
            '<button type="button" class="btn btn-secondary btn-sm txt-modelo-exportar-word" data-model-id="' + escapeAttr(id) + '">Word</button>' +
            '<button type="button" class="btn btn-danger btn-sm txt-modelo-eliminar" data-model-id="' + escapeAttr(id) + '">Borrar</button>' +
          '</td>' +
        '</tr>';
      }).join('');
    }
    window.__txtRefreshRealizados = refreshTxtRealizados;
    window.__txtRenderRealizados = renderTxtModelosGuardados;

    if (btnTabBuscador) {
      btnTabBuscador.addEventListener('click', function () {
        setTxtVista('buscador');
      });
    }
    if (btnTabRealizados) {
      btnTabRealizados.addEventListener('click', function () {
        refreshTxtRealizados().then(function () {
          renderTxtModelosGuardados();
          setTxtVista('realizados');
        });
      });
    }
    if (btnTabNuevo) {
      btnTabNuevo.addEventListener('click', function () {
        openTxtNuevoVista('buscador');
      });
    }
    setTxtVista('buscador');
    if (buscarInput) {
      buscarInput.addEventListener('input', debounce(function () {
        runTxtBusqueda();
      }, 250));
    }

    if (limpiarBtn) {
      limpiarBtn.addEventListener('click', function () {
        if (buscarInput) buscarInput.value = '';
        if (limpiarBtn) limpiarBtn.style.display = 'none';
        renderTxtResultadosBasico(cachedDeps || [], '');
      });
    }

    if (modalTxtOrden) {
      function closeModalTxtOrden() {
        modalTxtOrden.classList.remove('open');
      }

      if (txtOrdenGuardarBtn) {
        txtOrdenGuardarBtn.addEventListener('click', function () {
          if (!txtOrdenSelectedId) {
            showToast('Primero selecciona un resultado', 'error');
            return;
          }
          var v = txtOrdenCantidad ? txtOrdenCantidad.value : '0';
          var n = parseInt(v, 10);
          if (isNaN(n) || n < 0) n = 0;

          if (window.stockAPI && window.stockAPI.saveTxtOrdenCount) {
            window.stockAPI.saveTxtOrdenCount(txtOrdenSelectedId, n).then(function () {
              showToast('Conteo guardado: ' + n, 'success');
              closeModalTxtOrden();
          }).catch(function (err) {
            var msg = (err && err.message) ? err.message : 'Error desconocido';
            console.error('[TXT] saveTxtOrdenCount ERROR:', err);
            if ((msg || '').toLowerCase().indexOf('no handler registered') >= 0) {
              showToast('Error al guardar el conteo: falta handler en el backend. Cerrá y abrí el programa nuevamente (reinicio completo).', 'error');
            } else {
              showToast('Error al guardar el conteo: ' + msg, 'error');
            }
            });
          } else {
            showToast('Función de guardado no disponible', 'error');
          }
        });
      }

      document.querySelectorAll('.modal-txt-orden-close').forEach(function (btn) {
        btn.addEventListener('click', closeModalTxtOrden);
      });

      modalTxtOrden.addEventListener('click', function (e) {
        if (e && e.target === modalTxtOrden) closeModalTxtOrden();
      });
    }

    if (seccionTxtNuevo) {
      var txtNuevoCampos = {
        reparticion: document.getElementById('txt-nuevo-reparticion'),
        reparticionDesc: document.getElementById('txt-nuevo-reparticion-desc'),
        dependencia: document.getElementById('txt-nuevo-dependencia'),
        dependenciaDesc: document.getElementById('txt-nuevo-dependencia-desc'),
        habitacion: document.getElementById('txt-nuevo-habitacion'),
        habitacionDesc: document.getElementById('txt-nuevo-habitacion-desc'),
        cuenta: document.getElementById('txt-nuevo-cuenta'),
        especie: document.getElementById('txt-nuevo-especie'),
        motivo: document.getElementById('txt-nuevo-motivo'),
        estado: document.getElementById('txt-nuevo-estado'),
        cantidad: document.getElementById('txt-nuevo-cantidad'),
        orden: document.getElementById('txt-nuevo-orden'),
        valor: document.getElementById('txt-nuevo-valor'),
        mes: document.getElementById('txt-nuevo-mes'),
        anio: document.getElementById('txt-nuevo-anio'),
        descripcion: document.getElementById('txt-nuevo-descripcion')
      };

      function applyTxtNuevoReparticionDefaults(options) {
        options = options || {};
        var force = !!options.force;
        if (txtNuevoCampos.reparticion) {
          var rep = String(txtNuevoCampos.reparticion.value || '').trim();
          if (force || !rep) txtNuevoCampos.reparticion.value = TXT_REPARTICION_DEFAULT_NUMERO;
        }
        if (txtNuevoCampos.reparticionDesc) {
          var repActual = txtNuevoCampos.reparticion
            ? String(txtNuevoCampos.reparticion.value || '').trim()
            : '';
          var desc = String(txtNuevoCampos.reparticionDesc.value || '').trim();
          if (force || !desc || (repActual === TXT_REPARTICION_DEFAULT_NUMERO && !desc)) {
            txtNuevoCampos.reparticionDesc.value = TXT_REPARTICION_DEFAULT_NOMBRE;
          }
        }
      }

      function applyTxtNuevoInputMaxlengths() {
        var M = TXT_NUEVO_FIELD_MAX;
        var c = txtNuevoCampos;
        if (c.reparticion) c.reparticion.maxLength = M.reparticion;
        if (c.reparticionDesc) c.reparticionDesc.maxLength = M.reparticionDesc;
        if (c.dependencia) c.dependencia.maxLength = M.dependencia;
        if (c.dependenciaDesc) c.dependenciaDesc.maxLength = M.dependenciaDesc;
        if (c.habitacion) c.habitacion.maxLength = M.habitacion;
        if (c.habitacionDesc) c.habitacionDesc.maxLength = M.habitacionDesc;
        if (c.cuenta) c.cuenta.maxLength = M.cuenta;
        if (c.especie) c.especie.maxLength = M.especie;
        if (c.motivo) c.motivo.maxLength = M.motivo;
        if (c.estado) c.estado.maxLength = M.estado;
        if (c.cantidad) c.cantidad.maxLength = M.cantidad;
        if (c.orden) c.orden.maxLength = M.orden;
        if (c.mes) c.mes.maxLength = M.mes;
        if (c.anio) c.anio.maxLength = M.anio;
        if (c.valor) c.valor.maxLength = 14;
        if (c.descripcion) c.descripcion.maxLength = M.descripcion;
      }

      function normalizeTxtNuevoFormLengths() {
        var M = TXT_NUEVO_FIELD_MAX;
        var c = txtNuevoCampos;
        if (c.reparticion) c.reparticion.value = strSliceTxtNuevo(c.reparticion.value, M.reparticion);
        if (c.reparticionDesc) c.reparticionDesc.value = strSliceTxtNuevo(c.reparticionDesc.value, M.reparticionDesc);
        if (c.dependencia) c.dependencia.value = onlyDigitsSliceTxtNuevo(c.dependencia.value, M.dependencia);
        if (c.dependenciaDesc) c.dependenciaDesc.value = strSliceTxtNuevo(c.dependenciaDesc.value, M.dependenciaDesc);
        if (c.habitacion) c.habitacion.value = onlyDigitsSliceTxtNuevo(c.habitacion.value, M.habitacion);
        if (c.habitacionDesc) c.habitacionDesc.value = strSliceTxtNuevo(c.habitacionDesc.value, M.habitacionDesc);
        if (c.cuenta) c.cuenta.value = strSliceTxtNuevo(c.cuenta.value, M.cuenta);
        if (c.especie) c.especie.value = onlyDigitsSliceTxtNuevo(c.especie.value, M.especie);
        if (c.motivo) c.motivo.value = onlyDigitsSliceTxtNuevo(c.motivo.value, M.motivo);
        if (c.estado) c.estado.value = strSliceTxtNuevo(c.estado.value, M.estado);
        if (c.orden) c.orden.value = onlyDigitsSliceTxtNuevo(c.orden.value, M.orden);
        if (c.valor) c.valor.value = normalizeTxtNuevoValorDigits(c.valor.value);
        if (c.cantidad) {
          var cq = onlyDigitsSliceTxtNuevo(String(c.cantidad.value || ''), M.cantidad);
          if (cq === '') c.cantidad.value = '';
          else {
            var nq = parseInt(cq, 10);
            if (isNaN(nq) || nq < 0) c.cantidad.value = '';
            else if (nq > 999) c.cantidad.value = '999';
            else c.cantidad.value = String(nq);
          }
        }
        if (c.mes) {
          var mq = onlyDigitsSliceTxtNuevo(String(c.mes.value || ''), M.mes);
          if (mq === '') c.mes.value = '';
          else {
            var mm = parseInt(mq, 10);
            if (isNaN(mm)) c.mes.value = '';
            else {
              if (mm > 12) mm = 12;
              if (mm < 0) mm = 0;
              c.mes.value = String(mm);
            }
          }
        }
        if (c.anio) c.anio.value = onlyDigitsSliceTxtNuevo(String(c.anio.value || ''), M.anio);
        if (c.descripcion) {
          var du = String(c.descripcion.value || '').toUpperCase();
          c.descripcion.value = strSliceTxtNuevo(du, M.descripcion);
        }
      }

      applyTxtNuevoInputMaxlengths();

      var txtNuevoDepSugerencias = document.getElementById('txt-nuevo-dependencia-sugerencias');
      var txtNuevoHabSugerencias = document.getElementById('txt-nuevo-habitacion-sugerencias');
      var txtNuevoSyncing = false;
      var txtNuevoDepSuggestionIndex = -1;
      var txtNuevoHabSuggestionIndex = -1;
      var txtOrdenUltimoPorHabitacion = Object.create(null);
      var txtOrdenRemotoPorHabitacionId = Object.create(null);
      var txtOrdenFetchToken = 0;
      var txtOrdenManualEdit = false;

      function forceUppercaseField(field) {
        if (!field) return;
        field.addEventListener('input', function () {
          var value = String(field.value || '');
          var upper = value.toUpperCase();
          if (value !== upper) field.value = upper;
        });
      }

      function normalizeKey(s) {
        return String(s || '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
      }

      function onlyDigits(s) {
        return String(s || '').replace(/[^\d]/g, '');
      }

      function getMainTxtDeps() {
        return (cachedDeps || []).filter(function (d) { return d && !d.parentId; });
      }

      function getDivTxtByParent(parentId) {
        return (cachedDeps || []).filter(function (d) { return d && d.parentId === parentId; });
      }

      function toOrderNumber(value) {
        var n = parseInt(String(value || '').trim(), 10);
        if (isNaN(n) || n < 0) return null;
        return n;
      }

      function parseTxtNuevoRepeticiones(value) {
        var n = parseInt(String(value == null ? '' : value).replace(/[^\d]/g, ''), 10);
        if (isNaN(n) || n < 1) return 1;
        if (n > 999) return 999;
        return n;
      }

      /** N líneas iguales; en cada una se conserva cantidad y solo sube el orden (base, base+1, …). */
      function expandTxtItemPorRepeticiones(item, repeticiones) {
        if (!item) return [];
        var n = parseTxtNuevoRepeticiones(repeticiones);
        var baseOrden = parseInt(String(item.orden == null ? '' : item.orden).replace(/[^\d]/g, ''), 10);
        if (isNaN(baseOrden)) baseOrden = 0;
        var rows = [];
        for (var i = 0; i < n; i++) {
          var copia = Object.assign({}, item);
          copia.orden = String(baseOrden + i);
          rows.push(clampTxtNuevoItem(copia));
        }
        return rows;
      }

      function applyTxtNuevoRowsToOrdenCache(rows) {
        (rows || []).forEach(function (row) {
          takeMaxOrdenForScope(getOrdenScopeKeyFromValues(row.dependencia, row.habitacion, row.habitacionDesc), getEffectiveMaxOrdenFromItem(row));
          persistOrdenIfNeeded(row);
        });
      }

      function getEffectiveMaxOrdenFromItem(item) {
        if (!item) return null;
        return toOrderNumber(item.orden);
      }

      function buildTxtNuevoItemFromForm() {
        var item = {
          reparticion: txtNuevoCampos.reparticion ? String(txtNuevoCampos.reparticion.value || '').trim() : '',
          reparticionDesc: txtNuevoCampos.reparticionDesc ? String(txtNuevoCampos.reparticionDesc.value || '').trim() : '',
          dependencia: txtNuevoCampos.dependencia ? String(txtNuevoCampos.dependencia.value || '').trim() : '',
          dependenciaDesc: txtNuevoCampos.dependenciaDesc ? String(txtNuevoCampos.dependenciaDesc.value || '').trim() : '',
          habitacion: txtNuevoCampos.habitacion ? String(txtNuevoCampos.habitacion.value || '').trim() : '',
          habitacionDesc: txtNuevoCampos.habitacionDesc ? String(txtNuevoCampos.habitacionDesc.value || '').trim() : '',
          cuenta: txtNuevoCampos.cuenta ? String(txtNuevoCampos.cuenta.value || '').trim() : '',
          especie: txtNuevoCampos.especie ? String(txtNuevoCampos.especie.value || '').trim() : '',
          motivo: txtNuevoCampos.motivo ? String(txtNuevoCampos.motivo.value || '').trim() : '',
          estado: txtNuevoCampos.estado ? String(txtNuevoCampos.estado.value || '').trim() : '',
          cantidad: txtNuevoCampos.cantidad ? String(txtNuevoCampos.cantidad.value || '').trim() : '',
          orden: txtNuevoCampos.orden ? String(txtNuevoCampos.orden.value || '').trim() : '',
          valor: txtNuevoCampos.valor ? String(txtNuevoCampos.valor.value || '').trim() : '',
          mes: txtNuevoCampos.mes ? String(txtNuevoCampos.mes.value || '').trim() : '',
          anio: txtNuevoCampos.anio ? String(txtNuevoCampos.anio.value || '').trim() : '',
          descripcion: txtNuevoCampos.descripcion ? String(txtNuevoCampos.descripcion.value || '').trim().toUpperCase() : ''
        };
        return clampTxtNuevoItem(item);
      }

      function resetTxtNuevoRepeticionesField() {
        if (txtNuevoRepeticiones) txtNuevoRepeticiones.value = '1';
      }

      function getHabitacionIdFromRow(row) {
        if (!row) return '';
        var depNum = onlyDigits(row.dependencia || '');
        var habNum = onlyDigits(row.habitacion || '');
        var habName = normalizeKey(row.habitacionDesc || '');
        if (!depNum && !habNum && !habName) return '';
        var deps = getMainTxtDeps();
        var dep = depNum ? deps.find(function (d) { return onlyDigits(d.codigo || '') === depNum; }) : null;
        if (!dep) return '';
        var divisions = getDivTxtByParent(dep.id);
        var hab = habNum ? divisions.find(function (d) { return onlyDigits(d.numero || '') === habNum; }) : null;
        if (!hab && habName) {
          hab = divisions.find(function (d) { return normalizeKey(d.nombre || '') === habName; });
        }
        return hab && hab.id ? String(hab.id) : '';
      }

      function getSelectedHabitacionByForm() {
        var habNum = onlyDigits(txtNuevoCampos.habitacion ? txtNuevoCampos.habitacion.value : '');
        var habName = normalizeKey(txtNuevoCampos.habitacionDesc ? txtNuevoCampos.habitacionDesc.value : '');
        if (!habNum && !habName) return null;
        var dep = getSelectedDepByForm();
        var divisions = dep ? getDivTxtByParent(dep.id) : (cachedDeps || []).filter(function (d) { return d && d.parentId; });
        var byNum = habNum ? divisions.find(function (d) { return onlyDigits(d.numero || '') === habNum; }) : null;
        if (byNum) return byNum;
        var byName = habName ? divisions.find(function (d) { return normalizeKey(d.nombre || '') === habName; }) : null;
        return byName || null;
      }

      function getOrdenScopeKeyFromValues(depCodigo, habNumero, habNombre) {
        var depKey = onlyDigits(depCodigo || '') || normalizeKey(depCodigo || '');
        var habKey = onlyDigits(habNumero || '') || normalizeKey(habNumero || '') || normalizeKey(habNombre || '');
        if (!depKey && !habKey) return '';
        return depKey + '|' + habKey;
      }

      function getOrdenScopeKeyFromForm() {
        var hab = getSelectedHabitacionByForm();
        if (hab && hab.id) return 'id:' + String(hab.id);
        var depCodigo = txtNuevoCampos.dependencia ? txtNuevoCampos.dependencia.value : '';
        var habNumero = txtNuevoCampos.habitacion ? txtNuevoCampos.habitacion.value : '';
        var habNombre = txtNuevoCampos.habitacionDesc ? txtNuevoCampos.habitacionDesc.value : '';
        return getOrdenScopeKeyFromValues(depCodigo, habNumero, habNombre);
      }

      function getCurrentHabitacionId() {
        var hab = getSelectedHabitacionByForm();
        return hab && hab.id ? String(hab.id) : '';
      }

      function takeMaxOrdenForScope(scopeKey, ordenValue) {
        if (!scopeKey) return;
        var parsed = toOrderNumber(ordenValue);
        if (parsed == null) return;
        var current = txtOrdenUltimoPorHabitacion[scopeKey];
        if (current == null || parsed > current) {
          txtOrdenUltimoPorHabitacion[scopeKey] = parsed;
        }
      }

      function rebuildOrdenCache() {
        txtOrdenUltimoPorHabitacion = Object.create(null);

        (txtNuevoRegistros || []).forEach(function (r) {
          var scope = getOrdenScopeKeyFromValues(r && r.dependencia, r && r.habitacion, r && r.habitacionDesc);
          takeMaxOrdenForScope(scope, getEffectiveMaxOrdenFromItem(r));
        });

        (getTxtRealizados() || []).forEach(function (modelo) {
          var registros = Array.isArray(modelo && modelo.registros) ? modelo.registros : [];
          registros.forEach(function (r) {
            var scope = getOrdenScopeKeyFromValues(r && r.dependencia, r && r.habitacion, r && r.habitacionDesc);
            takeMaxOrdenForScope(scope, getEffectiveMaxOrdenFromItem(r));
          });
        });
      }

      function syncOrdenCountsFromRegistros(registros) {
        (registros || []).forEach(function (r) {
          var scope = getOrdenScopeKeyFromValues(r.dependencia, r.habitacion, r.habitacionDesc);
          takeMaxOrdenForScope(scope, getEffectiveMaxOrdenFromItem(r));
          persistOrdenIfNeeded(r);
        });
      }

      function suggestNextOrden(force) {
        if (!txtNuevoCampos.orden) return;
        if (txtNuevoEditIndex >= 0) return;
        var scopeKey = getOrdenScopeKeyFromForm();
        if (!scopeKey) return;
        var currentRaw = String(txtNuevoCampos.orden.value || '').trim();
        if (!force && txtOrdenManualEdit && currentRaw) return;
        var lastLocal = txtOrdenUltimoPorHabitacion[scopeKey];
        var lastRemote = null;
        if (scopeKey.indexOf('id:') === 0) {
          var habId = scopeKey.slice(3);
          if (habId && txtOrdenRemotoPorHabitacionId[habId] != null) {
            lastRemote = txtOrdenRemotoPorHabitacionId[habId];
          }
        }
        var last = lastLocal;
        if (lastRemote != null && (last == null || lastRemote > last)) last = lastRemote;
        var next = (last == null ? 1 : (last + 1));
        txtNuevoCampos.orden.value = String(next);
        txtOrdenManualEdit = false;
      }

      function refreshRemoteOrdenForCurrentHabitacion() {
        var habId = getCurrentHabitacionId();
        if (!habId || !window.stockAPI || !window.stockAPI.getTxtOrdenCount) {
          suggestNextOrden(false);
          return;
        }
        var token = ++txtOrdenFetchToken;
        window.stockAPI.getTxtOrdenCount(habId).then(function (n) {
          if (token !== txtOrdenFetchToken) return;
          var parsed = parseInt(n, 10);
          txtOrdenRemotoPorHabitacionId[habId] = isNaN(parsed) ? 0 : Math.max(0, parsed);
          suggestNextOrden(false);
        }).catch(function () {
          if (token !== txtOrdenFetchToken) return;
          suggestNextOrden(false);
        });
      }

      function persistOrdenIfNeeded(item) {
        if (!item) return;
        var habId = getHabitacionIdFromRow(item);
        if (!habId) {
          var hab = getSelectedHabitacionByForm();
          habId = hab && hab.id ? String(hab.id) : '';
        }
        if (!habId || !window.stockAPI || !window.stockAPI.saveTxtOrdenCount) return;
        var parsed = getEffectiveMaxOrdenFromItem(item);
        if (parsed == null) return;
        var knownRemote = txtOrdenRemotoPorHabitacionId[habId];
        if (knownRemote != null && parsed <= knownRemote) return;
        txtOrdenRemotoPorHabitacionId[habId] = parsed;
        window.stockAPI.saveTxtOrdenCount(habId, parsed).catch(function (err) {
          var msg = err && err.message ? err.message : '';
          console.warn('[TXT] No se pudo persistir ORDEN en backend:', msg || err);
        });
      }

      function getSelectedDepByForm() {
        var depNum = onlyDigits(txtNuevoCampos.dependencia ? txtNuevoCampos.dependencia.value : '');
        var depName = normalizeKey(txtNuevoCampos.dependenciaDesc ? txtNuevoCampos.dependenciaDesc.value : '');
        var deps = getMainTxtDeps();
        var byNum = depNum ? deps.find(function (d) { return onlyDigits(d.codigo || '') === depNum; }) : null;
        if (byNum) return byNum;
        var byName = depName ? deps.find(function (d) { return normalizeKey(d.nombre || '') === depName; }) : null;
        return byName || null;
      }

      function syncDependenciaFromNumero() {
        if (txtNuevoSyncing) return;
        txtNuevoSyncing = true;
        try {
          var depNum = onlyDigits(txtNuevoCampos.dependencia ? txtNuevoCampos.dependencia.value : '');
          if (!depNum) return;
          var deps = getMainTxtDeps();
          var dep = deps.find(function (d) { return onlyDigits(d.codigo || '') === depNum; });
          if (!dep) return;
          if (txtNuevoCampos.dependencia) txtNuevoCampos.dependencia.value = String(dep.codigo || '');
          if (txtNuevoCampos.dependenciaDesc) txtNuevoCampos.dependenciaDesc.value = String(dep.nombre || '');
        } finally {
          txtNuevoSyncing = false;
        }
        normalizeTxtNuevoFormLengths();
      }

      function syncDependenciaFromNombre() {
        if (txtNuevoSyncing) return;
        txtNuevoSyncing = true;
        try {
          var depName = normalizeKey(txtNuevoCampos.dependenciaDesc ? txtNuevoCampos.dependenciaDesc.value : '');
          if (!depName) return;
          var deps = getMainTxtDeps();
          var dep = deps.find(function (d) { return normalizeKey(d.nombre || '') === depName; });
          if (!dep) return;
          if (txtNuevoCampos.dependencia) txtNuevoCampos.dependencia.value = String(dep.codigo || '');
          if (txtNuevoCampos.dependenciaDesc) txtNuevoCampos.dependenciaDesc.value = String(dep.nombre || '');
        } finally {
          txtNuevoSyncing = false;
        }
        normalizeTxtNuevoFormLengths();
      }

      function hideDependenciaSuggestions() {
        if (!txtNuevoDepSugerencias) return;
        txtNuevoDepSugerencias.style.display = 'none';
        txtNuevoDepSugerencias.innerHTML = '';
        txtNuevoDepSuggestionIndex = -1;
      }

      function hideHabitacionSuggestions() {
        if (!txtNuevoHabSugerencias) return;
        txtNuevoHabSugerencias.style.display = 'none';
        txtNuevoHabSugerencias.innerHTML = '';
        txtNuevoHabSuggestionIndex = -1;
      }

      function getDependenciaSuggestionItems() {
        if (!txtNuevoDepSugerencias) return [];
        return Array.prototype.slice.call(txtNuevoDepSugerencias.querySelectorAll('.txt-nuevo-sug-item'));
      }

      function getHabitacionSuggestionItems() {
        if (!txtNuevoHabSugerencias) return [];
        return Array.prototype.slice.call(txtNuevoHabSugerencias.querySelectorAll('.txt-nuevo-sug-item'));
      }

      function setDependenciaSuggestionActive(index) {
        var items = getDependenciaSuggestionItems();
        if (!items.length) {
          txtNuevoDepSuggestionIndex = -1;
          return;
        }
        var next = index;
        if (next < 0) next = items.length - 1;
        if (next >= items.length) next = 0;
        txtNuevoDepSuggestionIndex = next;
        items.forEach(function (it, idx) {
          if (idx === next) it.classList.add('active');
          else it.classList.remove('active');
        });
        var active = items[next];
        if (active && active.scrollIntoView) {
          active.scrollIntoView({ block: 'nearest' });
        }
      }

      function applyDependenciaSuggestionByElement(btn) {
        if (!btn) return;
        var codigoSel = btn.getAttribute('data-codigo') || '';
        var nombreSel = btn.getAttribute('data-nombre') || '';
        if (txtNuevoCampos.dependencia) txtNuevoCampos.dependencia.value = codigoSel;
        if (txtNuevoCampos.dependenciaDesc) txtNuevoCampos.dependenciaDesc.value = nombreSel;
        hideDependenciaSuggestions();
        normalizeTxtNuevoFormLengths();
      }

      function setHabitacionSuggestionActive(index) {
        var items = getHabitacionSuggestionItems();
        if (!items.length) {
          txtNuevoHabSuggestionIndex = -1;
          return;
        }
        var next = index;
        if (next < 0) next = items.length - 1;
        if (next >= items.length) next = 0;
        txtNuevoHabSuggestionIndex = next;
        items.forEach(function (it, idx) {
          if (idx === next) it.classList.add('active');
          else it.classList.remove('active');
        });
        var active = items[next];
        if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest' });
      }

      function applyHabitacionSuggestionByElement(btn) {
        if (!btn) return;
        var numeroSel = btn.getAttribute('data-numero') || '';
        var nombreSel = btn.getAttribute('data-nombre') || '';
        var depCodigoSel = btn.getAttribute('data-dep-codigo') || '';
        var depNombreSel = btn.getAttribute('data-dep-nombre') || '';
        if (txtNuevoCampos.habitacion) txtNuevoCampos.habitacion.value = numeroSel;
        if (txtNuevoCampos.habitacionDesc) txtNuevoCampos.habitacionDesc.value = nombreSel;
        if (depCodigoSel && txtNuevoCampos.dependencia) txtNuevoCampos.dependencia.value = depCodigoSel;
        if (depNombreSel && txtNuevoCampos.dependenciaDesc) txtNuevoCampos.dependenciaDesc.value = depNombreSel;
        hideHabitacionSuggestions();
        refreshRemoteOrdenForCurrentHabitacion();
        normalizeTxtNuevoFormLengths();
      }

      function renderDependenciaSuggestions() {
        if (!txtNuevoDepSugerencias) return;
        var rawDep = txtNuevoCampos.dependencia ? String(txtNuevoCampos.dependencia.value || '').trim() : '';
        var rawDesc = txtNuevoCampos.dependenciaDesc ? String(txtNuevoCampos.dependenciaDesc.value || '').trim() : '';
        if (!rawDep && !rawDesc) {
          hideDependenciaSuggestions();
          return;
        }
        var qNormDep = normalizeKey(rawDep);
        var qNormDesc = normalizeKey(rawDesc);
        var deps = getMainTxtDeps();
        function matchesDependenciaNeedle(d, qNorm) {
          if (!qNorm) return true;
          var codigo = normalizeKey(d && d.codigo != null ? d.codigo : '');
          var nombre = normalizeKey(d && d.nombre != null ? d.nombre : '');
          var combo = normalizeKey((d && d.codigo != null ? d.codigo : '') + ' ' + (d && d.nombre != null ? d.nombre : ''));
          return codigo.indexOf(qNorm) >= 0 || nombre.indexOf(qNorm) >= 0 || combo.indexOf(qNorm) >= 0;
        }
        var matches = deps.filter(function (d) {
          var okDep = !rawDep || matchesDependenciaNeedle(d, qNormDep);
          var okDesc = !rawDesc || matchesDependenciaNeedle(d, qNormDesc);
          return okDep && okDesc;
        }).slice(0, 12);

        if (!matches.length) {
          txtNuevoDepSugerencias.style.display = 'none';
          txtNuevoDepSugerencias.innerHTML = '';
          txtNuevoDepSuggestionIndex = -1;
          return;
        }

        txtNuevoDepSugerencias.innerHTML = matches.map(function (d) {
          var codigo = d && d.codigo != null ? String(d.codigo) : '';
          var nombre = d && d.nombre != null ? String(d.nombre) : '';
          return '<button type="button" class="txt-nuevo-sug-item" data-codigo="' + escapeAttr(codigo) + '" data-nombre="' + escapeAttr(nombre) + '">' +
            '<span class="txt-nuevo-sug-codigo">' + escapeHtml(codigo) + '</span>' +
            '<span class="txt-nuevo-sug-sep"> - </span>' +
            '<span class="txt-nuevo-sug-nombre">' + escapeHtml(nombre) + '</span>' +
          '</button>';
        }).join('');
        txtNuevoDepSugerencias.style.display = 'block';
        txtNuevoDepSuggestionIndex = -1;

        txtNuevoDepSugerencias.querySelectorAll('.txt-nuevo-sug-item').forEach(function (btn) {
          btn.addEventListener('click', function () {
            applyDependenciaSuggestionByElement(btn);
          });
        });
      }

      function renderHabitacionSuggestions() {
        if (!txtNuevoHabSugerencias) return;
        var rawNum = txtNuevoCampos.habitacion ? String(txtNuevoCampos.habitacion.value || '').trim() : '';
        var rawDesc = txtNuevoCampos.habitacionDesc ? String(txtNuevoCampos.habitacionDesc.value || '').trim() : '';
        if (!rawNum && !rawDesc) {
          hideHabitacionSuggestions();
          return;
        }
        var qNormNum = normalizeKey(rawNum);
        var qNormDesc = normalizeKey(rawDesc);
        var selectedDep = getSelectedDepByForm();
        var divisions = selectedDep
          ? getDivTxtByParent(selectedDep.id)
          : (cachedDeps || []).filter(function (d) { return d && d.parentId; });

        function matchesHabitacionNeedle(d, qNorm) {
          if (!qNorm) return true;
          var numero = normalizeKey(d && d.numero != null ? d.numero : '');
          var nombre = normalizeKey(d && d.nombre != null ? d.nombre : '');
          var combo = normalizeKey((d && d.numero != null ? d.numero : '') + ' ' + (d && d.nombre != null ? d.nombre : ''));
          return numero.indexOf(qNorm) >= 0 || nombre.indexOf(qNorm) >= 0 || combo.indexOf(qNorm) >= 0;
        }
        var matches = divisions.filter(function (d) {
          var okNum = !rawNum || matchesHabitacionNeedle(d, qNormNum);
          var okDesc = !rawDesc || matchesHabitacionNeedle(d, qNormDesc);
          return okNum && okDesc;
        }).slice(0, 12);

        if (!matches.length) {
          txtNuevoHabSugerencias.style.display = 'none';
          txtNuevoHabSugerencias.innerHTML = '';
          txtNuevoHabSuggestionIndex = -1;
          return;
        }

        txtNuevoHabSugerencias.innerHTML = matches.map(function (d) {
          var numero = d && d.numero != null ? String(d.numero) : '';
          var nombre = d && d.nombre != null ? String(d.nombre) : '';
          var parent = (cachedDeps || []).find(function (p) { return p && p.id === d.parentId; }) || null;
          var depCodigo = parent && parent.codigo != null ? String(parent.codigo) : '';
          var depNombre = parent && parent.nombre != null ? String(parent.nombre) : '';
          return '<button type="button" class="txt-nuevo-sug-item" data-numero="' + escapeAttr(numero) + '" data-nombre="' + escapeAttr(nombre) + '" data-dep-codigo="' + escapeAttr(depCodigo) + '" data-dep-nombre="' + escapeAttr(depNombre) + '">' +
            '<span class="txt-nuevo-sug-codigo">' + escapeHtml(numero) + '</span>' +
            '<span class="txt-nuevo-sug-sep"> - </span>' +
            '<span class="txt-nuevo-sug-nombre">' + escapeHtml(nombre) + '</span>' +
          '</button>';
        }).join('');
        txtNuevoHabSugerencias.style.display = 'block';
        txtNuevoHabSuggestionIndex = -1;

        txtNuevoHabSugerencias.querySelectorAll('.txt-nuevo-sug-item').forEach(function (btn) {
          btn.addEventListener('click', function () {
            applyHabitacionSuggestionByElement(btn);
          });
        });
      }

      function syncHabitacionFromNumero() {
        if (txtNuevoSyncing) return;
        txtNuevoSyncing = true;
        try {
          var habNum = onlyDigits(txtNuevoCampos.habitacion ? txtNuevoCampos.habitacion.value : '');
          if (!habNum) return;
          var dep = getSelectedDepByForm();
          var divisions = dep ? getDivTxtByParent(dep.id) : (cachedDeps || []).filter(function (d) { return d && d.parentId; });
          var div = divisions.find(function (d) { return onlyDigits(d.numero || '') === habNum; });
          if (!div) return;
          if (txtNuevoCampos.habitacion) txtNuevoCampos.habitacion.value = String(div.numero || '');
          if (txtNuevoCampos.habitacionDesc) txtNuevoCampos.habitacionDesc.value = String(div.nombre || '');
          if (dep && txtNuevoCampos.dependencia) txtNuevoCampos.dependencia.value = String(dep.codigo || '');
          if (dep && txtNuevoCampos.dependenciaDesc) txtNuevoCampos.dependenciaDesc.value = String(dep.nombre || '');
          refreshRemoteOrdenForCurrentHabitacion();
        } finally {
          txtNuevoSyncing = false;
        }
        normalizeTxtNuevoFormLengths();
      }

      function syncHabitacionFromNombre() {
        if (txtNuevoSyncing) return;
        txtNuevoSyncing = true;
        try {
          var habName = normalizeKey(txtNuevoCampos.habitacionDesc ? txtNuevoCampos.habitacionDesc.value : '');
          if (!habName) return;
          var dep = getSelectedDepByForm();
          var divisions = dep ? getDivTxtByParent(dep.id) : (cachedDeps || []).filter(function (d) { return d && d.parentId; });
          var div = divisions.find(function (d) { return normalizeKey(d.nombre || '') === habName; });
          if (!div) return;
          if (txtNuevoCampos.habitacion) txtNuevoCampos.habitacion.value = String(div.numero || '');
          if (txtNuevoCampos.habitacionDesc) txtNuevoCampos.habitacionDesc.value = String(div.nombre || '');
          if (!dep) {
            var parent = (cachedDeps || []).find(function (d) { return d && d.id === div.parentId; });
            if (parent) {
              if (txtNuevoCampos.dependencia) txtNuevoCampos.dependencia.value = String(parent.codigo || '');
              if (txtNuevoCampos.dependenciaDesc) txtNuevoCampos.dependenciaDesc.value = String(parent.nombre || '');
            }
          }
          refreshRemoteOrdenForCurrentHabitacion();
        } finally {
          txtNuevoSyncing = false;
        }
        normalizeTxtNuevoFormLengths();
      }

      function renderTablaTxtNuevo() {
        if (!txtNuevoTablaBody) return;
        if (!txtNuevoRegistros.length) {
          txtNuevoTablaBody.innerHTML = '<tr class="txt-nuevo-empty-row"><td colspan="17">Todavía no hay registros cargados.</td></tr>';
          return;
        }
        txtNuevoTablaBody.innerHTML = txtNuevoRegistros.map(function (r, idx) {
          return '<tr>' +
            '<td>' + escapeHtml(r.reparticion) + '</td>' +
            '<td>' + escapeHtml(r.reparticionDesc) + '</td>' +
            '<td>' + escapeHtml(r.dependencia) + '</td>' +
            '<td>' + escapeHtml(r.dependenciaDesc) + '</td>' +
            '<td>' + escapeHtml(r.habitacion) + '</td>' +
            '<td>' + escapeHtml(r.habitacionDesc) + '</td>' +
            '<td>' + escapeHtml(r.cuenta) + '</td>' +
            '<td>' + escapeHtml(r.especie) + '</td>' +
            '<td>' + escapeHtml(r.motivo) + '</td>' +
            '<td>' + escapeHtml(r.estado) + '</td>' +
            '<td>' + escapeHtml(r.cantidad) + '</td>' +
            '<td>' + escapeHtml(r.orden) + '</td>' +
            '<td>' + escapeHtml(r.valor) + '</td>' +
            '<td>' + escapeHtml(r.mes) + '</td>' +
            '<td>' + escapeHtml(r.anio) + '</td>' +
            '<td>' + escapeHtml(r.descripcion) + '</td>' +
            '<td class="txt-nuevo-actions-col">' +
              '<button type="button" class="btn btn-secondary btn-sm txt-nuevo-btn-editar" data-index="' + escapeAttr(idx) + '">Editar</button>' +
              '<button type="button" class="btn btn-danger btn-sm txt-nuevo-btn-eliminar" data-index="' + escapeAttr(idx) + '">Eliminar</button>' +
            '</td>' +
          '</tr>';
        }).join('');
      }

      function limpiarCamposTxtNuevo() {
        Object.keys(txtNuevoCampos).forEach(function (k) {
          if (txtNuevoCampos[k]) txtNuevoCampos[k].value = '';
        });
        applyTxtNuevoReparticionDefaults({ force: true });
        resetTxtNuevoRepeticionesField();
        normalizeTxtNuevoFormLengths();
        txtOrdenManualEdit = false;
        txtNuevoEditIndex = -1;
        if (btnTxtNuevoGuardar) btnTxtNuevoGuardar.textContent = 'Guardar fila';
      }

      function resetModalTxtNuevo() {
        var fields = seccionTxtNuevo.querySelectorAll('input, textarea, select');
        fields.forEach(function (field) {
          if (!field) return;
          if (field.type === 'checkbox' || field.type === 'radio') {
            field.checked = false;
          } else {
            field.value = '';
          }
        });
        applyTxtNuevoReparticionDefaults({ force: true });
        resetTxtNuevoRepeticionesField();
        normalizeTxtNuevoFormLengths();
        txtNuevoRegistros = [];
        txtOrdenManualEdit = false;
        rebuildOrdenCache();
        txtNuevoEditIndex = -1;
        if (btnTxtNuevoGuardar) btnTxtNuevoGuardar.textContent = 'Guardar fila';
        renderTablaTxtNuevo();
      }

      function closeModalTxtNuevo() {
        closeTxtNuevoVista();
      }

      function afterOpenTxtNuevoVista() {
        Promise.all([
          loadTxtData().catch(function () {}),
          refreshTxtRealizados().catch(function () {})
        ]).then(function () {
          rebuildOrdenCache();
          txtOrdenRemotoPorHabitacionId = Object.create(null);
          refreshRemoteOrdenForCurrentHabitacion();
        });
      }

      if (btnNuevoTxt) {
        btnNuevoTxt.addEventListener('click', function () {
          resetModalTxtNuevo();
          openTxtNuevoVista('buscador');
          afterOpenTxtNuevoVista();
        });
      }

      document.querySelectorAll('.txt-nuevo-volver').forEach(function (btn) {
        btn.addEventListener('click', closeModalTxtNuevo);
      });

      function onDependenciaSuggestKeydown(ev) {
        if (!txtNuevoDepSugerencias || txtNuevoDepSugerencias.style.display === 'none') return;
        var items = getDependenciaSuggestionItems();
        if (!items.length) return;
        if (ev.key === 'ArrowDown') {
          ev.preventDefault();
          setDependenciaSuggestionActive(txtNuevoDepSuggestionIndex + 1);
          return;
        }
        if (ev.key === 'ArrowUp') {
          ev.preventDefault();
          setDependenciaSuggestionActive(txtNuevoDepSuggestionIndex - 1);
          return;
        }
        if (ev.key === 'Enter') {
          if (txtNuevoDepSuggestionIndex >= 0 && txtNuevoDepSuggestionIndex < items.length) {
            ev.preventDefault();
            applyDependenciaSuggestionByElement(items[txtNuevoDepSuggestionIndex]);
          }
          return;
        }
        if (ev.key === 'Escape') {
          hideDependenciaSuggestions();
        }
      }

      function onHabitacionSuggestKeydown(ev) {
        if (!txtNuevoHabSugerencias || txtNuevoHabSugerencias.style.display === 'none') return;
        var items = getHabitacionSuggestionItems();
        if (!items.length) return;
        if (ev.key === 'ArrowDown') {
          ev.preventDefault();
          setHabitacionSuggestionActive(txtNuevoHabSuggestionIndex + 1);
          return;
        }
        if (ev.key === 'ArrowUp') {
          ev.preventDefault();
          setHabitacionSuggestionActive(txtNuevoHabSuggestionIndex - 1);
          return;
        }
        if (ev.key === 'Enter') {
          if (txtNuevoHabSuggestionIndex >= 0 && txtNuevoHabSuggestionIndex < items.length) {
            ev.preventDefault();
            applyHabitacionSuggestionByElement(items[txtNuevoHabSuggestionIndex]);
          }
          return;
        }
        if (ev.key === 'Escape') {
          hideHabitacionSuggestions();
        }
      }

      if (txtNuevoCampos.dependencia) {
        txtNuevoCampos.dependencia.addEventListener('input', function () {
          syncDependenciaFromNumero();
          renderDependenciaSuggestions();
          refreshRemoteOrdenForCurrentHabitacion();
        });
        txtNuevoCampos.dependencia.addEventListener('focus', function () {
          renderDependenciaSuggestions();
        });
        txtNuevoCampos.dependencia.addEventListener('keydown', onDependenciaSuggestKeydown);
      }
      if (txtNuevoCampos.dependenciaDesc) {
        txtNuevoCampos.dependenciaDesc.addEventListener('input', function () {
          syncDependenciaFromNombre();
          renderDependenciaSuggestions();
          refreshRemoteOrdenForCurrentHabitacion();
        });
        txtNuevoCampos.dependenciaDesc.addEventListener('focus', function () {
          renderDependenciaSuggestions();
        });
        txtNuevoCampos.dependenciaDesc.addEventListener('keydown', onDependenciaSuggestKeydown);
      }
      if (txtNuevoCampos.habitacion) {
        txtNuevoCampos.habitacion.addEventListener('input', function () {
          syncHabitacionFromNumero();
          renderHabitacionSuggestions();
          refreshRemoteOrdenForCurrentHabitacion();
        });
        txtNuevoCampos.habitacion.addEventListener('focus', function () {
          renderHabitacionSuggestions();
        });
        txtNuevoCampos.habitacion.addEventListener('keydown', onHabitacionSuggestKeydown);
      }
      if (txtNuevoCampos.habitacionDesc) {
        txtNuevoCampos.habitacionDesc.addEventListener('input', function () {
          syncHabitacionFromNombre();
          renderHabitacionSuggestions();
          refreshRemoteOrdenForCurrentHabitacion();
        });
        txtNuevoCampos.habitacionDesc.addEventListener('focus', function () {
          renderHabitacionSuggestions();
        });
        txtNuevoCampos.habitacionDesc.addEventListener('keydown', onHabitacionSuggestKeydown);
      }

      // Mantiene el campo descripción siempre en mayúsculas mientras se escribe.
      if (txtNuevoCampos.descripcion) {
        txtNuevoCampos.descripcion.addEventListener('input', function () {
          var du = String(txtNuevoCampos.descripcion.value || '').toUpperCase();
          if (du.length > TXT_NUEVO_FIELD_MAX.descripcion) du = du.slice(0, TXT_NUEVO_FIELD_MAX.descripcion);
          if (du !== txtNuevoCampos.descripcion.value) txtNuevoCampos.descripcion.value = du;
        });
      }
      if (seccionTxtNuevo) {
        seccionTxtNuevo.addEventListener('paste', function () {
          setTimeout(normalizeTxtNuevoFormLengths, 0);
        });
      }
      ['valor', 'cantidad', 'mes', 'anio'].forEach(function (campoKey) {
        var el = txtNuevoCampos[campoKey];
        if (el) el.addEventListener('input', normalizeTxtNuevoFormLengths);
      });

      if (txtNuevoCampos.orden) {
        txtNuevoCampos.orden.addEventListener('input', function () {
          txtOrdenManualEdit = true;
        });
      }

      document.addEventListener('click', function (ev) {
        if (!txtNuevoDepSugerencias) return;
        var t = ev && ev.target;
        if (!t) return;
        if (txtNuevoDepSugerencias.contains(t)) return;
        if (t === txtNuevoCampos.dependenciaDesc || t === txtNuevoCampos.dependencia) return;
        hideDependenciaSuggestions();
      });
      document.addEventListener('click', function (ev) {
        if (!txtNuevoHabSugerencias) return;
        var t = ev && ev.target;
        if (!t) return;
        if (txtNuevoHabSugerencias.contains(t)) return;
        if (t === txtNuevoCampos.habitacionDesc || t === txtNuevoCampos.habitacion) return;
        hideHabitacionSuggestions();
      });

      function pushTxtNuevoRowsToGrilla(rows, opts) {
        opts = opts || {};
        if (!rows || !rows.length) return;
        if (txtNuevoEditIndex >= 0 && txtNuevoEditIndex < txtNuevoRegistros.length) {
          if (rows.length > 1) {
            showToast('Al editar solo se actualiza una fila. Usá «Agregar repetidas» para cargar varias.', 'error');
            return;
          }
          txtNuevoRegistros[txtNuevoEditIndex] = rows[0];
          applyTxtNuevoRowsToOrdenCache(rows);
          showToast('Registro actualizado.', 'success');
        } else {
          rows.forEach(function (row) { txtNuevoRegistros.push(row); });
          applyTxtNuevoRowsToOrdenCache(rows);
          if (opts.fromRepetidas) {
            showToast('Se agregaron ' + rows.length + ' filas repetidas a la grilla.', 'success');
          } else {
            showToast('Registro agregado a la grilla.', 'success');
          }
        }
        renderTablaTxtNuevo();
        limpiarCamposTxtNuevo();
        refreshRemoteOrdenForCurrentHabitacion();
      }

      if (btnTxtNuevoGuardar) {
        btnTxtNuevoGuardar.addEventListener('click', function () {
          normalizeTxtNuevoFormLengths();
          var item = buildTxtNuevoItemFromForm();
          var hasAnyValue = Object.keys(item).some(function (k) { return item[k] !== ''; });
          if (!hasAnyValue) {
            showToast('Completa al menos un campo para agregar el registro.', 'error');
            return;
          }
          pushTxtNuevoRowsToGrilla([item]);
        });
      }

      if (btnTxtNuevoAgregarRepetidas) {
        btnTxtNuevoAgregarRepetidas.addEventListener('click', function () {
          if (txtNuevoEditIndex >= 0) {
            showToast('Terminá la edición o cancelá antes de agregar repetidas.', 'error');
            return;
          }
          normalizeTxtNuevoFormLengths();
          var item = buildTxtNuevoItemFromForm();
          var hasAnyValue = Object.keys(item).some(function (k) { return item[k] !== ''; });
          if (!hasAnyValue) {
            showToast('Completá los datos del registro antes de agregar repetidas.', 'error');
            return;
          }
          var repeticiones = parseTxtNuevoRepeticiones(txtNuevoRepeticiones ? txtNuevoRepeticiones.value : '1');
          if (txtNuevoRepeticiones) txtNuevoRepeticiones.value = String(repeticiones);
          var rows = expandTxtItemPorRepeticiones(item, repeticiones);
          pushTxtNuevoRowsToGrilla(rows, { fromRepetidas: true });
        });
      }

      if (txtNuevoRepeticiones) {
        txtNuevoRepeticiones.addEventListener('input', function () {
          var raw = String(txtNuevoRepeticiones.value || '').replace(/[^\d]/g, '');
          if (raw.length > 3) raw = raw.slice(0, 3);
          if (txtNuevoRepeticiones.value !== raw) txtNuevoRepeticiones.value = raw;
        });
        txtNuevoRepeticiones.addEventListener('blur', function () {
          var trimmed = String(txtNuevoRepeticiones.value || '').trim();
          if (!trimmed) {
            txtNuevoRepeticiones.value = '1';
            return;
          }
          txtNuevoRepeticiones.value = String(parseTxtNuevoRepeticiones(trimmed));
        });
      }

      function getTxtNuevoDefaultNames() {
        var rep = txtNuevoRegistros[0] ? (txtNuevoRegistros[0].reparticion || '0') : '0';
        var dep = txtNuevoRegistros[0] ? (txtNuevoRegistros[0].dependencia || '0') : '0';
        var hab = txtNuevoRegistros[0] ? (txtNuevoRegistros[0].habitacion || '0') : '0';
        return {
          txt: rep + '-' + dep + '-' + hab + '-txt-export',
          word: rep + '-' + dep + '-' + hab + '-modelo'
        };
      }

      async function exportarTxtYWordSecuencial() {
        if (!txtNuevoRegistros || !txtNuevoRegistros.length) {
          showToast('No hay registros cargados para exportar.', 'error');
          return { ok: false };
        }
        if (!window.stockAPI || !window.stockAPI.exportTxtNuevo) {
          showToast('Función de exportación no disponible.', 'error');
          return { ok: false };
        }
        if (!window.stockAPI.exportTxtNuevoWord) {
          showToast('Función de exportación Word no disponible.', 'error');
          return { ok: false };
        }

        var names = getTxtNuevoDefaultNames();
        var resTxt = await window.stockAPI.exportTxtNuevo(txtNuevoRegistros, names.txt);
        if (resTxt && resTxt.cancelled) return { ok: false, cancelled: true };
        if (!resTxt || !resTxt.ok) {
          showToast('Error al exportar: ' + ((resTxt && resTxt.error) || 'desconocido'), 'error');
          return { ok: false };
        }

        var resWord = await window.stockAPI.exportTxtNuevoWord(txtNuevoRegistros, names.word);
        if (resWord && resWord.cancelled) return { ok: false, cancelled: true };
        if (!resWord || !resWord.ok) {
          showToast('Error al exportar Word: ' + ((resWord && resWord.error) || 'desconocido'), 'error');
          return { ok: false };
        }

        return { ok: true };
      }

      if (txtNuevoTablaBody) {
        txtNuevoTablaBody.addEventListener('click', function (ev) {
          var target = ev && ev.target ? ev.target : null;
          if (!target) return;

          var btnEdit = target.closest ? target.closest('.txt-nuevo-btn-editar') : null;
          if (btnEdit) {
            var idxEdit = parseInt(btnEdit.getAttribute('data-index') || '-1', 10);
            if (isNaN(idxEdit) || idxEdit < 0 || idxEdit >= txtNuevoRegistros.length) return;
            var row = txtNuevoRegistros[idxEdit];
            if (!row) return;
            txtNuevoEditIndex = idxEdit;
            if (txtNuevoCampos.reparticion) txtNuevoCampos.reparticion.value = row.reparticion || '';
            if (txtNuevoCampos.reparticionDesc) txtNuevoCampos.reparticionDesc.value = row.reparticionDesc || '';
            if (txtNuevoCampos.dependencia) txtNuevoCampos.dependencia.value = row.dependencia || '';
            if (txtNuevoCampos.dependenciaDesc) txtNuevoCampos.dependenciaDesc.value = row.dependenciaDesc || '';
            if (txtNuevoCampos.habitacion) txtNuevoCampos.habitacion.value = row.habitacion || '';
            if (txtNuevoCampos.habitacionDesc) txtNuevoCampos.habitacionDesc.value = row.habitacionDesc || '';
            if (txtNuevoCampos.cuenta) txtNuevoCampos.cuenta.value = row.cuenta || '';
            if (txtNuevoCampos.especie) txtNuevoCampos.especie.value = row.especie || '';
            if (txtNuevoCampos.motivo) txtNuevoCampos.motivo.value = row.motivo || '';
            if (txtNuevoCampos.estado) txtNuevoCampos.estado.value = row.estado || '';
            if (txtNuevoCampos.cantidad) txtNuevoCampos.cantidad.value = row.cantidad || '';
            if (txtNuevoCampos.orden) txtNuevoCampos.orden.value = row.orden || '';
            if (txtNuevoCampos.valor) txtNuevoCampos.valor.value = row.valor || '';
            if (txtNuevoCampos.mes) txtNuevoCampos.mes.value = row.mes || '';
            if (txtNuevoCampos.anio) txtNuevoCampos.anio.value = row.anio || '';
            if (txtNuevoCampos.descripcion) txtNuevoCampos.descripcion.value = row.descripcion || '';
            normalizeTxtNuevoFormLengths();
            txtOrdenManualEdit = false;
            if (btnTxtNuevoGuardar) btnTxtNuevoGuardar.textContent = 'Actualizar';
            showToast('Editando registro #' + (idxEdit + 1), 'success');
            return;
          }

          var btnDelete = target.closest ? target.closest('.txt-nuevo-btn-eliminar') : null;
          if (btnDelete) {
            var idxDelete = parseInt(btnDelete.getAttribute('data-index') || '-1', 10);
            if (isNaN(idxDelete) || idxDelete < 0 || idxDelete >= txtNuevoRegistros.length) return;
            if (!confirm('¿Eliminar este registro de la grilla?')) return;
            txtNuevoRegistros.splice(idxDelete, 1);
            if (txtNuevoEditIndex === idxDelete) {
              limpiarCamposTxtNuevo();
            } else if (txtNuevoEditIndex > idxDelete) {
              txtNuevoEditIndex = txtNuevoEditIndex - 1;
            }
            renderTablaTxtNuevo();
            showToast('Registro eliminado.', 'success');
          }
        });
      }

      if (btnTxtNuevoFinalizado) {
        btnTxtNuevoFinalizado.addEventListener('click', async function () {
          if (!txtNuevoRegistros || !txtNuevoRegistros.length) {
            showToast('No hay registros para guardar en Realizados.', 'error');
            return;
          }
          var exportRes = null;
          try {
            exportRes = await exportarTxtYWordSecuencial();
          } catch (exportErr) {
            showToast('Error al exportar: ' + ((exportErr && exportErr.message) || 'desconocido'), 'error');
            return;
          }
          if (!exportRes || !exportRes.ok) return;

          syncOrdenCountsFromRegistros(txtNuevoRegistros);

          var nombre = 'TXT-FINALIZADO';
          if (txtNuevoRegistros[0]) {
            var p = txtNuevoRegistros[0];
            var base = [p.reparticion || '0', p.dependencia || '0', p.habitacion || '0'].join('-');
            var now = new Date();
            var sello = String(now.getFullYear()) +
              String(now.getMonth() + 1).padStart(2, '0') +
              String(now.getDate()).padStart(2, '0') + '-' +
              String(now.getHours()).padStart(2, '0') +
              String(now.getMinutes()).padStart(2, '0');
            nombre = base + '-finalizado-' + sello;
          }
          registerTxtRealizado(txtNuevoRegistros, nombre).then(function (res) {
            if (res && res.storage === 'local') {
              showToast(res.warn || 'Guardado en Realizados en esta PC. Los archivos TXT/Word ya se exportaron.', 'success');
            } else {
              showToast('Guardado en Realizados. Los archivos TXT/Word ya se exportaron.', 'success');
            }
            closeModalTxtNuevo();
          }).catch(function (err) {
            var msg = (err && err.message) ? String(err.message) : 'desconocido';
            if (msg.toLowerCase().indexOf('no handler registered') >= 0) {
              showToast('Error al guardar: falta actualizar/reiniciar la app en esta PC.', 'error');
              return;
            }
            if (isTxtRealizadosSchemaErrorMsg(msg)) {
              showToast(
                'Los archivos TXT/Word se exportaron. No se pudo guardar en Realizados en la nube; ejecutá supabase-txt-realizados.sql en Supabase o reiniciá la app.',
                'error'
              );
              return;
            }
            showToast('Error al guardar en Realizados: ' + msg, 'error');
          });
        });
      }

      applyTxtNuevoInputMaxlengths();
      applyTxtNuevoReparticionDefaults({ force: true });
      txtOnOpenNuevoVista = function () {
        applyTxtNuevoReparticionDefaults({ force: false });
      };
    }

    if (txtModelosTablaBody) {
      txtModelosTablaBody.addEventListener('click', function (ev) {
        var target = ev && ev.target ? ev.target : null;
        if (!target) return;
        var modelId = target.getAttribute('data-model-id') || '';
        if (!modelId) return;
        var modelos = getTxtRealizados();
        var modelo = modelos.find(function (m) { return String(m.id) === String(modelId); });
        if (!modelo) {
          showToast('No se encontró el TXT realizado.', 'error');
          renderTxtModelosGuardados();
          return;
        }

        var btnAbrir = target.closest ? target.closest('.txt-modelo-abrir') : null;
        if (btnAbrir) {
          var rawRegs = Array.isArray(modelo.registros) ? JSON.parse(JSON.stringify(modelo.registros)) : [];
          txtNuevoRegistros = rawRegs.map(function (r) { return clampTxtNuevoItem(r); });
          txtNuevoEditIndex = -1;
          if (btnTxtNuevoGuardar) btnTxtNuevoGuardar.textContent = 'Guardar fila';
          openTxtNuevoVista('realizados');
          renderTablaTxtNuevo();
          showToast('TXT cargado: ' + (modelo.nombre || ''), 'success');
          return;
        }

        var btnExportar = target.closest ? target.closest('.txt-modelo-exportar') : null;
        if (btnExportar) {
          if (!window.stockAPI || !window.stockAPI.exportTxtNuevo) {
            showToast('Función de exportación no disponible.', 'error');
            return;
          }
          var registros = Array.isArray(modelo.registros)
            ? modelo.registros.map(function (r) { return clampTxtNuevoItem(r); })
            : [];
          if (!registros.length) {
            showToast('El TXT seleccionado no tiene registros.', 'error');
            return;
          }
          window.stockAPI.exportTxtNuevo(registros, modelo.nombre || 'txt-export').then(function (res) {
            if (res && res.ok) showToast('TXT exportado correctamente.', 'success');
            else if (!res || !res.cancelled) showToast('Error al exportar TXT.', 'error');
          }).catch(function () {
            showToast('Error al exportar TXT.', 'error');
          });
          return;
        }

        var btnExportarWord = target.closest ? target.closest('.txt-modelo-exportar-word') : null;
        if (btnExportarWord) {
          if (!window.stockAPI || !window.stockAPI.exportTxtNuevoWord) {
            showToast('Función de exportación Word no disponible.', 'error');
            return;
          }
          var registrosWord = Array.isArray(modelo.registros)
            ? modelo.registros.map(function (r) { return clampTxtNuevoItem(r); })
            : [];
          if (!registrosWord.length) {
            showToast('El TXT seleccionado no tiene registros.', 'error');
            return;
          }
          window.stockAPI.exportTxtNuevoWord(registrosWord, modelo.nombre || 'txt-modelo').then(function (res) {
            if (res && res.ok) showToast('Word exportado correctamente.', 'success');
            else if (!res || !res.cancelled) showToast('Error al exportar Word.', 'error');
          }).catch(function () {
            showToast('Error al exportar Word.', 'error');
          });
          return;
        }

        var btnEliminar = target.closest ? target.closest('.txt-modelo-eliminar') : null;
        if (btnEliminar) {
          if (!confirm('¿Eliminar este TXT realizado?')) return;
          if (window.stockAPI && window.stockAPI.deleteTxtRealizado) {
            window.stockAPI.deleteTxtRealizado(modelId).then(function () {
              return refreshTxtRealizados();
            }).then(function () {
              renderTxtModelosGuardados();
              showToast('TXT eliminado.', 'success');
            }).catch(function (err) {
              showToast('Error al eliminar: ' + ((err && err.message) || 'desconocido'), 'error');
            });
          }
        }
      });
    }

    if (!contenidoEl) return;

    if (btnImportar && inputImportar) {
      btnImportar.addEventListener('click', function () {
        try { inputImportar.value = ''; } catch (e) { /* ignore */ }
        inputImportar.click();
      });

      inputImportar.addEventListener('change', function () {
        var file = inputImportar && inputImportar.files ? inputImportar.files[0] : null;
        importTxtFile(file);
      });
    }

    Promise.all([loadTxtData(), refreshTxtRealizados()]).then(function () {
      renderTxtResultadosBasico(cachedDeps || [], '');
      renderTxtModelosGuardados();
    }).catch(function () {
      renderTxtResultadosVacio('Error al cargar datos para la búsqueda.');
      renderTxtModelosGuardados();
    });
  }

  // ===================== TXT search =====================
  var cachedDeps = [];
  var cachedLoaded = false;
  var txtLoadPromise = null;
  var txtBusquedaSeq = 0;

  // TXT usa la tabla EXCLUSIVA txt_dependencias (no la de Dependencias / entregas).
  // Compatibilidad: registros históricos pueden tener prefijo txt-dep- o dep- en el id.
  var TXT_ID_PREFIXES = ['txt-dep-', 'dep-'];

  function isTxtItem(dep) {
    if (!dep || dep.id == null) return false;
    var id = String(dep.id);
    return TXT_ID_PREFIXES.some(function (p) { return id.indexOf(p) === 0; });
  }

  function showToast(message, type) {
    var t = type || 'success';
    var existing = document.querySelector('.toast');
    if (existing) existing.remove();
    var toast = document.createElement('div');
    toast.className = 'toast ' + t;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function () { toast.remove(); }, 3500);
  }

  function detectDelimiter(sampleLines) {
    var delims = ['\t', ';', '|', ','];
    for (var di = 0; di < delims.length; di++) {
      var delim = delims[di];
      var good = 0;
      for (var i = 0; i < sampleLines.length && i < 25; i++) {
        var line = sampleLines[i];
        if (!line) continue;
        var parts = line.split(delim);
        if (parts && parts.length >= 4 && parts[0] && parts[2]) good++;
      }
      if (good >= 3) return delim;
    }
    return null;
  }

  function parseDependenciasTxt(text) {
    if (text == null) throw new Error('Archivo vacío.');
    var normalized = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    var lines = normalized.split('\n').map(function (l) { return (l || '').trim(); }).filter(Boolean);
    if (!lines.length) throw new Error('No encontré líneas con datos.');

    function extractDigits(token) {
      return String(token || '').replace(/[^\d]/g, '');
    }

    // Split robusto: separa columnas cuando vienen con TAB, ';', ',', '|' o "separador tipo Excel" (2+ espacios).
    // Evitamos dividir por 1 espacio porque los nombres tienen palabras.
    function splitColumns(line) {
      return String(line || '')
        .split(/[\t;|,]+| {2,}/g)
        .map(function (s) { return String(s || '').trim(); })
        .filter(Boolean);
    }

    var recordsById = new Map();
    var depCount = 0;
    var divCount = 0;
    var skipped = 0;
    var skippedExamples = [];

    lines.forEach(function (line, idx) {
      var codigo = '';
      var numero = '';
      var nombreDep = '';
      var nombreDiv = '';

      // Intento 1: split por columnas
      var tokens = splitColumns(line);
      if (tokens && tokens.length >= 3) {
        codigo = extractDigits(tokens[0]);
        if (codigo) {
          var numIdx = -1;
          for (var i = 1; i < tokens.length; i++) {
            var t = String(tokens[i] || '').trim();
            if (/^\d+$/.test(t)) { numIdx = i; break; }
          }
          if (numIdx !== -1) {
            numero = extractDigits(tokens[numIdx]);
            nombreDep = tokens.slice(1, numIdx).join(' ').trim();
            nombreDiv = tokens.slice(numIdx + 1).join(' ').trim();
          }
        }
      }

      // Intento 2 (fallback): regex robusta (depende menos del separador)
      // Formato esperado: <codigo> <nombreDep> <numeroDivision> <nombreDiv>
      if (!codigo || !numero || !nombreDep) {
        var m = String(line).match(/^\s*(\d+)\s+(.+?)\s+(\d+)(?:\s+(.+?))?\s*$/);
        if (m) {
          codigo = m[1] || '';
          nombreDep = (m[2] || '').trim();
          numero = extractDigits(m[3]);
          nombreDiv = (m[4] || '').trim();
        }
      }

      if (!codigo || !nombreDep || !numero) {
        skipped++;
        if (skippedExamples.length < 5) skippedExamples.push({ idx: idx + 1, line: line.slice(0, 120) });
        return;
      }

      // IDs determinísticos para evitar duplicados al re-importar
      codigo = codigo.replace(/\s+/g, '');
      numero = numero.replace(/\s+/g, '');
      var mainId = 'txt-dep-' + codigo;
      var divId = mainId + '-div-' + numero;

      // Normalizamos para que coincida con el estilo del resto de la app
      var mainNombreNorm = nombreDep.toUpperCase();
      var divNombreNorm = nombreDiv.toUpperCase();

      if (!recordsById.has(mainId)) {
        recordsById.set(mainId, {
          id: mainId,
          nombre: mainNombreNorm,
          codigo: codigo,
          parentId: null,
          numero: null
        });
        depCount++;
      }

      // Siempre actualizamos nombre/código del padre (por si el TXT trae variaciones)
      var existingMain = recordsById.get(mainId);
      existingMain.nombre = mainNombreNorm;
      existingMain.codigo = codigo;

      // Solo crear división si tenemos numero y nombre de división
      if (numero && nombreDiv) {
        if (!recordsById.has(divId)) {
          recordsById.set(divId, {
            id: divId,
            nombre: divNombreNorm,
            codigo: codigo,
            parentId: mainId,
            numero: numero
          });
          divCount++;
        } else {
          // Si existe, actualizamos nombre en caso de variaciones
          var existingDiv = recordsById.get(divId);
          existingDiv.nombre = divNombreNorm;
        }
      }
    });

    return {
      records: Array.from(recordsById.values()),
      depCount: depCount,
      divCount: divCount,
      skipped: skipped,
      skippedExamples: skippedExamples,
      total: lines.length
    };
  }

  function parseDependenciasCsv(text) {
    if (text == null) throw new Error('Archivo vacío.');
    var normalized = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    var lines = normalized.split('\n').filter(function (l) { return l != null && String(l).trim() !== ''; });
    if (!lines.length) throw new Error('No encontré líneas con datos.');

    function normalizeHeader(h) {
      return String(h || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '_');
    }

    // CSV simple con soporte de comillas dobles
    function splitCsvLine(line, delim) {
      var out = [];
      var cur = '';
      var inQuotes = false;
      for (var i = 0; i < line.length; i++) {
        var ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; continue; }
          inQuotes = !inQuotes;
          continue;
        }
        if (!inQuotes && ch === delim) {
          out.push(cur);
          cur = '';
          continue;
        }
        cur += ch;
      }
      out.push(cur);
      return out.map(function (s) { return String(s || '').trim(); });
    }

    // Detectar delimitador por header
    var headerLine = String(lines[0] || '');
    var delim = ',';
    if (headerLine.indexOf(';') >= 0 && headerLine.indexOf(',') === -1) delim = ';';
    else if (headerLine.indexOf('\t') >= 0) delim = '\t';

    var headersRaw = splitCsvLine(headerLine, delim);
    var headers = headersRaw.map(normalizeHeader);

    // Mapeo flexible de columnas
    var idxId = headers.indexOf('id');
    var idxNombre = headers.indexOf('nombre');
    var idxCodigo = headers.indexOf('codigo');
    var idxNumero = headers.indexOf('numero');
    var idxParent = headers.indexOf('parent_id');
    if (idxParent === -1) idxParent = headers.indexOf('id_padre');
    if (idxParent === -1) idxParent = headers.indexOf('parentid');
    var idxNombreDiv = headers.indexOf('nombre_division');
    if (idxNombreDiv === -1) idxNombreDiv = headers.indexOf('nombre_divisiones');
    if (idxNombreDiv === -1) idxNombreDiv = headers.indexOf('division');
    if (idxNombreDiv === -1) idxNombreDiv = headers.indexOf('divisiones');
    if (idxNombreDiv === -1) idxNombreDiv = headers.indexOf('nombrediv');

    console.log('[CSV PARSE] headers:', JSON.stringify(headers));
    console.log('[CSV PARSE] idxNombreDiv:', idxNombreDiv, '| idxNombre:', idxNombre, '| idxCodigo:', idxCodigo, '| idxParent:', idxParent, '| idxNumero:', idxNumero);

    var hasFormatoCompleto = idxId !== -1 && idxNombre !== -1 && idxCodigo !== -1 && idxParent !== -1 && idxNumero !== -1;
    var hasFormatoSimple = idxId !== -1 && idxNombre !== -1 && idxParent !== -1 && idxNombreDiv !== -1;
    if (!hasFormatoCompleto && !hasFormatoSimple) {
      throw new Error('CSV inválido: encabezados no reconocidos (' + JSON.stringify(headers) + '). Formatos aceptados: (1) id,nombre,codigo,parent_id,numero o (2) id,nombre,parent_id,nombre_division/nombre_divisiones.');
    }

    var recordsById = new Map();
    var depCount = 0;
    var divCount = 0;
    var skipped = 0;
    var skippedExamples = [];

    function parseFromId(id) {
      var s = String(id || '').trim();
      var mDiv = s.match(/^dep-(\d+)-div-(\d+)$/i);
      if (mDiv) return { codigo: mDiv[1], numero: mDiv[2], parentId: 'dep-' + mDiv[1], isDiv: true };
      var mDep = s.match(/^dep-(\d+)$/i);
      if (mDep) return { codigo: mDep[1], numero: null, parentId: null, isDiv: false };
      // Compatibilidad con ids viejos de TXT
      var mTxtDiv = s.match(/^txt-dep-(\d+)-div-(\d+)$/i);
      if (mTxtDiv) return { codigo: mTxtDiv[1], numero: mTxtDiv[2], parentId: 'txt-dep-' + mTxtDiv[1], isDiv: true, mainId: 'txt-dep-' + mTxtDiv[1] };
      var mTxtDep = s.match(/^txt-dep-(\d+)$/i);
      if (mTxtDep) return { codigo: mTxtDep[1], numero: null, parentId: null, isDiv: false };
      return { codigo: '', numero: null, parentId: null, isDiv: false };
    }

    // Para poder crear padres automáticamente cuando vienen solo hijos
    var inferredParents = new Map(); // id -> { id, nombre, codigo }

    for (var li = 1; li < lines.length; li++) {
      var line = String(lines[li] || '');
      if (!line.trim()) continue;
      var cols = splitCsvLine(line, delim);
      var id = (cols[idxId] != null ? String(cols[idxId]).trim() : '');
      var nombre = (cols[idxNombre] != null ? String(cols[idxNombre]).trim() : '');
      var codigo = hasFormatoCompleto ? (cols[idxCodigo] != null ? String(cols[idxCodigo]).trim() : '') : '';
      var parentId = (cols[idxParent] != null ? String(cols[idxParent]).trim() : '');
      var numero = hasFormatoCompleto ? (cols[idxNumero] != null ? String(cols[idxNumero]).trim() : '') : '';
      var nombreDiv = idxNombreDiv !== -1 ? (cols[idxNombreDiv] != null ? String(cols[idxNombreDiv]).trim() : '') : '';

      if (!id) {
        skipped++;
        if (skippedExamples.length < 5) skippedExamples.push({ idx: li + 1, line: line.slice(0, 120) });
        continue;
      }

      // Normalizar
      // Si viene formato simple, derivamos codigo/numero desde el id.
      if (!hasFormatoCompleto) {
        var parsed = parseFromId(id);
        if (!codigo) codigo = parsed.codigo || '';
        if (!numero) numero = parsed.numero || '';
        // Si el CSV trae parent_id, lo respetamos; si no, usamos el derivado.
        if (!parentId) parentId = parsed.parentId || '';
        // Para divisiones, usamos nombre_division como nombre real (siempre que haya parent_id).
        // No dependemos del formato del id: si parent_id viene cargado, es un "hijo".
        if (parentId && nombreDiv) nombre = nombreDiv;
      }

      if (codigo) codigo = codigo.replace(/\s+/g, '');
      if (numero) numero = String(numero).replace(/\s+/g, '');
      if (parentId === '') parentId = null;
      if (numero === '') numero = null;
      if (!nombre) nombre = '';

      if (parentId && nombreDiv) {
        nombre = nombreDiv;
      }

      if (li <= 3) console.log('[CSV PARSE] fila ' + li + ': id=' + id + ' nombre=' + nombre + ' nombreDiv=' + nombreDiv + ' parentId=' + parentId);

      if (!recordsById.has(id)) {
        recordsById.set(id, { id: id, nombre: nombre, codigo: codigo, parentId: parentId, numero: numero });
        if (parentId) divCount++; else depCount++;
      } else {
        // merge
        var prev = recordsById.get(id);
        recordsById.set(id, {
          id: id,
          nombre: nombre || prev.nombre,
          codigo: codigo || prev.codigo,
          parentId: parentId != null ? parentId : prev.parentId,
          numero: numero != null ? numero : prev.numero
        });
      }

      // Inferir padre si hace falta (solo para ids estilo dep-<codigo>-div-<numero>)
      if (parentId && codigo) {
        var pId = String(parentId);
        if (!inferredParents.has(pId)) {
          var parentNombre = (cols[idxNombre] != null ? String(cols[idxNombre]).trim() : '') || '';
          if (!parentNombre) parentNombre = 'DEP ' + codigo;
          inferredParents.set(pId, { id: pId, nombre: parentNombre, codigo: codigo });
        }
      }
    }

    // Agregar padres inferidos si no están presentes en el CSV
    inferredParents.forEach(function (p) {
      if (!p || !p.id) return;
      if (recordsById.has(p.id)) return;
      recordsById.set(p.id, { id: p.id, nombre: p.nombre || '', codigo: p.codigo || '', parentId: null, numero: null });
      depCount++;
    });

    return {
      records: Array.from(recordsById.values()),
      depCount: depCount,
      divCount: divCount,
      skipped: skipped,
      skippedExamples: skippedExamples,
      total: Math.max(0, lines.length - 1)
    };
  }

  function readFileAsText(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function (e) { reject(e); };
      reader.readAsText(file, 'utf-8');
    });
  }

  async function importTxtFile(file) {
    if (!file) return;

    var fileName = (file.name || '').toString();
    var sizeKb = Math.round((file.size || 0) / 1024);

    try {
      if (!confirm('Importar "' + fileName + '" (~' + sizeKb + ' KB)? Esto cargará dependencias y divisiones en el TXT.')) return;
      var text = await readFileAsText(file);
      var ext = (fileName.split('.').pop() || '').toLowerCase();
      var parsed = ext === 'csv' ? parseDependenciasCsv(text) : parseDependenciasTxt(text);
      if (!parsed.records || !parsed.records.length) {
        showToast('No hay registros para importar.', 'error');
        return;
      }

      var skippedTxt = parsed.skipped && parsed.skipped > 0
        ? (' Se saltearon ' + parsed.skipped + ' líneas. Ej: ' + (parsed.skippedExamples && parsed.skippedExamples[0] ? parsed.skippedExamples[0].idx + ':' + parsed.skippedExamples[0].line : 'N/A'))
        : '';
      if (!confirm('Se importarán ' + parsed.depCount + ' dependencias y ' + parsed.divCount + ' divisiones.' + skippedTxt + ' ¿Continuar?')) return;

      if (btnImportar) btnImportar.disabled = true;
      if (window.appLoading && window.appLoading.show) window.appLoading.show('Importando dependencias…');

      if (window.stockAPI && window.stockAPI.importTxtDependencias) {
        await window.stockAPI.importTxtDependencias(parsed.records);
      } else {
        // Fallback/compatibilidad: guardar uno por uno
        for (var i = 0; i < parsed.records.length; i++) {
          if (window.stockAPI.saveTxtDependencia) await window.stockAPI.saveTxtDependencia(parsed.records[i]);
          else await window.stockAPI.saveDependencia(parsed.records[i]);
        }
      }

      cachedDeps = [];
      cachedLoaded = false;
      await loadTxtData();

      if (window.appLoading && window.appLoading.hide) window.appLoading.hide();
      if (btnImportar) btnImportar.disabled = false;

      showToast('Importación finalizada: ' + parsed.depCount + ' dependencias / ' + parsed.divCount + ' divisiones.', 'success');
      try {
        if (buscarInput) {
          buscarInput.dispatchEvent(new Event('input'));
        } else {
          runTxtBusqueda();
        }
      } catch (e) {
        runTxtBusqueda();
      }
    } catch (err) {
      if (window.appLoading && window.appLoading.hide) window.appLoading.hide();
      if (btnImportar) btnImportar.disabled = false;
      showToast((err && err.message) ? err.message : 'Error al importar', 'error');
    }
  }

  function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    var div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }

  function normalizeString(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function escapeAttr(value) {
    // escapeHtml no sustituye comillas, así que las protegemos aparte.
    return escapeHtml(value).replace(/"/g, '&quot;');
  }

  function getDepCodigoNumero(dep) {
    // En tu modelo real, a veces aparece como `codigo`/`numero` y otras como `codigo` + `numero`.
    var codigo = (dep && dep.codigo != null) ? String(dep.codigo).trim() : '';
    var numero = (dep && dep.numero != null) ? String(dep.numero).trim() : '';
    if (codigo && numero) return codigo + ' ' + numero;
    return codigo || numero || '';
  }

  function getDepNombre(dep) {
    return (dep && dep.nombre != null) ? String(dep.nombre).trim() : '';
  }

  function getDepDisplayLabel(dep, deps) {
    if (!dep) return '—';
    var nombre = getDepNombre(dep);

    var codigo = (dep && dep.codigo != null) ? String(dep.codigo).trim() : '';
    var numero = (dep && dep.numero != null) ? String(dep.numero).trim() : '';

    // Para divisiones: "CODIGO-NUMERO - NOMBRE_DIVISION"
    // Ej: "1-2 - SECRETARIA PRIVADA"
    if (dep.parentId) {
      var parent = (deps || []).find(function (d) { return d.id === dep.parentId; });
      var parentCodigo = parent && parent.codigo != null ? String(parent.codigo).trim() : (codigo || '');
      var idCompuesto = parentCodigo && numero ? (parentCodigo + '-' + numero) : (parentCodigo || numero || '');
      var parts = [idCompuesto, nombre].filter(Boolean);
      return parts.length ? parts.join(' - ') : '—';
    }

    // Para dependencias principales: "CODIGO - NOMBRE"
    // Ej: "1 - JEFATURA DE POLICIA"
    var partsMain = [codigo, nombre].filter(Boolean);
    return partsMain.length ? partsMain.join(' - ') : (nombre || codigo || '—');
  }

  function mergeDependenciasParaTxt(lists) {
    var uniq = new Map();
    (lists || []).forEach(function (list) {
      (list || []).forEach(function (d) {
        if (!d || d.id == null) return;
        var k = String(d.id);
        if (!uniq.has(k)) {
          uniq.set(k, d);
          return;
        }
        var prev = uniq.get(k);
        uniq.set(k, Object.assign({}, prev, d));
      });
    });
    return Array.from(uniq.values());
  }

  async function loadTxtData(forceReload) {
    if (!forceReload && cachedLoaded) return;
    if (forceReload) {
      cachedLoaded = false;
      txtLoadPromise = null;
    }
    if (txtLoadPromise) return txtLoadPromise;
    txtLoadPromise = (async function () {
      var txtList = [];
      if (window.stockAPI.getTxtDependencias) {
        txtList = await window.stockAPI.getTxtDependencias();
      } else if (window.stockAPI.getData) {
        var data = await window.stockAPI.getData();
        txtList = data.txtDependencias || [];
      } else {
        txtList = [];
      }
      cachedDeps = mergeDependenciasParaTxt([txtList]);

      cachedLoaded = true;
    })();
    try {
      await txtLoadPromise;
    } finally {
      txtLoadPromise = null;
    }
  }

  function getMainDeps(deps) {
    return (deps || []).filter(function (d) {
      if (!d) return false;
      var pid = d.parentId;
      return pid == null || pid === '';
    });
  }

  function getSaveTxtDependenciaFn() {
    if (!window.stockAPI || !window.stockAPI.saveTxtDependencia) {
      return null;
    }
    return window.stockAPI.saveTxtDependencia;
  }

  function getDivisiones(deps, parentId) {
    return (deps || []).filter(function (d) { return d.parentId === parentId; });
  }

  function depMatchesQuery(dep, queryNorm, allDeps) {
    if (!queryNorm) return true;
    var codigo = (dep && dep.codigo != null) ? String(dep.codigo).trim() : '';
    var numero = (dep && dep.numero != null) ? String(dep.numero).trim() : '';
    var nombre = normalizeString(getDepNombre(dep));

    var parentCodigo = '';
    if (dep && dep.parentId && allDeps) {
      var parent = allDeps.find(function (d) { return d.id === dep.parentId; });
      if (parent && parent.codigo != null) parentCodigo = String(parent.codigo).trim();
    }

    var idCompuesto = parentCodigo && numero ? (parentCodigo + '-' + numero) : '';
    var combo = normalizeString([codigo, numero, nombre, idCompuesto, parentCodigo + ' ' + numero].filter(Boolean).join(' '));

    return normalizeString(codigo).indexOf(queryNorm) >= 0 ||
      normalizeString(numero).indexOf(queryNorm) >= 0 ||
      nombre.indexOf(queryNorm) >= 0 ||
      normalizeString(idCompuesto).indexOf(queryNorm) >= 0 ||
      combo.indexOf(queryNorm) >= 0;
  }

  function renderTxtResultadosVacio(text) {
    if (!resultadosEl) return;
    resultadosEl.innerHTML = '<p style="text-align:center; margin:0;">' + escapeHtml(text) + '</p>';
  }

  function renderTxtResultadosBasico(deps, query) {
    if (!resultadosEl) return;

    var queryNorm = normalizeString(query);
    var mainDeps = getMainDeps(deps);

    var depsById = new Map();
    (deps || []).forEach(function (d) { if (d && d.id) depsById.set(d.id, d); });

    var renderedDivIds = new Set();
    var rows = [];

    mainDeps.sort(function (a, b) {
      var ca = parseInt(String(a.codigo || '0').replace(/\D/g, ''), 10) || 0;
      var cb = parseInt(String(b.codigo || '0').replace(/\D/g, ''), 10) || 0;
      return ca - cb;
    });

    mainDeps.forEach(function (main) {
      var divisions = getDivisiones(deps, main.id);
      divisions.sort(function (a, b) {
        var na = parseInt(String(a.numero || '0').replace(/\D/g, ''), 10) || 0;
        var nb = parseInt(String(b.numero || '0').replace(/\D/g, ''), 10) || 0;
        return na - nb;
      });

      var mainOk = depMatchesQuery(main, queryNorm, deps);
      var divMatches = divisions.filter(function (div) { return depMatchesQuery(div, queryNorm, deps); });

      if (!mainOk && !divMatches.length) return;

      var mainLabel = getDepDisplayLabel(main, deps).trim();
      rows.push(
        '<div class="txt-result-line txt-result-main txt-result-main-row">' +
          '<div class="txt-result-selectable" role="button" tabindex="0" data-txt-type="dep" data-txt-id="' + escapeAttr(main.id) + '" data-txt-label="' + escapeAttr(mainLabel) + '">' +
            '<span class="txt-result-arrow" aria-hidden="true">▶</span><strong>' + escapeHtml(mainLabel) + '</strong>' +
          '</div>' +
          '<button type="button" class="btn btn-sm btn-primary txt-btn-add-habitacion" data-txt-dep-id="' + escapeAttr(main.id) + '" title="Agregar habitación a esta dependencia">+ Habitación</button>' +
        '</div>'
      );

      var renderDivs = mainOk ? divisions : divMatches;
      renderDivs.forEach(function (div) {
        renderedDivIds.add(div.id);
        var divLabel = getDepDisplayLabel(div, deps).trim();
        rows.push('<div class="txt-result-line txt-result-division txt-result-selectable" role="button" tabindex="0" data-txt-type="div" data-txt-id="' + escapeAttr(div.id) + '" data-txt-label="' + escapeAttr(divLabel) + '"><span class="txt-result-indent" aria-hidden="true"></span>' +
          '<span class="txt-result-dot" aria-hidden="true">•</span>' +
          '<span>' + escapeHtml(divLabel) + '</span></div>');
      });
    });

    var orphans = (deps || []).filter(function (d) {
      if (!d || !d.parentId) return false;
      if (renderedDivIds.has(d.id)) return false;
      if (!depsById.has(d.parentId)) return true;
      return false;
    }).filter(function (d) { return depMatchesQuery(d, queryNorm, deps); });

    if (orphans.length) {
      orphans.forEach(function (div) {
        var divLabel = getDepDisplayLabel(div, deps).trim();
        rows.push('<div class="txt-result-line txt-result-division txt-result-selectable" role="button" tabindex="0" data-txt-type="div" data-txt-id="' + escapeAttr(div.id) + '" data-txt-label="' + escapeAttr(divLabel) + '"><span class="txt-result-indent" aria-hidden="true"></span>' +
          '<span class="txt-result-dot" aria-hidden="true">•</span>' +
          '<span>' + escapeHtml(divLabel) + '</span></div>');
      });
    }

    if (!rows.length) {
      if (query) {
        renderTxtResultadosVacio('No se encontraron dependencias ni divisiones para "' + query + '".');
      } else {
        renderTxtResultadosVacio('No hay dependencias cargadas. Importá un archivo TXT/CSV o agregá manualmente.');
      }
      return 0;
    }

    var headerHtml = query
      ? '<div style="text-align:center; margin-bottom:0.75rem; color: var(--text-muted); font-size:0.9rem;">Coincidencias para: <strong>' + escapeHtml(query) + '</strong></div>'
      : '<div style="text-align:center; margin-bottom:0.75rem; color: var(--text-muted); font-size:0.9rem;">Mostrando todas las dependencias y divisiones (' + rows.length + ')</div>';

    resultadosEl.innerHTML = '<div class="txt-results-wrapper">' + headerHtml + rows.join('') + '</div>';

    attachTxtResultSelectionHandlers();
    return rows.length;
  }

  function openModalTxtOrden(ordenId, ordenLabel) {
    if (!modalTxtOrden) return;
    txtOrdenSelectedId = ordenId || txtOrdenSelectedId;
    if (txtOrdenColOrden) txtOrdenColOrden.textContent = (ordenLabel && String(ordenLabel).trim()) ? String(ordenLabel) : '—';
    if (txtOrdenCantidad) txtOrdenCantidad.value = '0';
    if (txtOrdenUltimaMod) txtOrdenUltimaMod.textContent = '—';
    modalTxtOrden.classList.add('open');

    // Cargar conteo guardado (si existe) + fecha última modificación
    try {
      if (window.stockAPI && ordenId) {
        if (window.stockAPI.getTxtOrdenInfo) {
          window.stockAPI.getTxtOrdenInfo(ordenId).then(function (info) {
            var n = info && info.count != null ? info.count : 0;
            if (txtOrdenCantidad) txtOrdenCantidad.value = String(n != null ? n : 0);
            var updatedAt = info && info.updatedAt ? String(info.updatedAt) : '';
            if (txtOrdenUltimaMod) {
              if (!updatedAt) {
                txtOrdenUltimaMod.textContent = '—';
              } else {
                var d = new Date(updatedAt);
                txtOrdenUltimaMod.textContent = isNaN(d.getTime())
                  ? updatedAt
                  : d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
              }
            }
          }).catch(function () {
            // fallback
          });
        } else if (window.stockAPI.getTxtOrdenCount) {
          window.stockAPI.getTxtOrdenCount(ordenId).then(function (n) {
            if (txtOrdenCantidad) txtOrdenCantidad.value = String(n != null ? n : 0);
            if (txtOrdenUltimaMod) txtOrdenUltimaMod.textContent = '—';
        }).catch(function () {
          // si falla, dejamos el 0
        });
        }
      }
    } catch (e) { /* ignore */ }
  }

  function attachTxtResultSelectionHandlers() {
    if (!resultadosEl) return;

    var habitacionBtns = resultadosEl.querySelectorAll('.txt-btn-add-habitacion');
    habitacionBtns.forEach(function (btn) {
      if (btn.__txtHabBound) return;
      btn.__txtHabBound = true;
      btn.addEventListener('click', function (ev) {
        if (ev) {
          ev.preventDefault();
          ev.stopPropagation();
        }
        var depId = btn.getAttribute('data-txt-dep-id') || '';
        if (window.__txtOpenAgregarHabitacion) {
          window.__txtOpenAgregarHabitacion(depId);
        } else if (btnAgregarTxt) {
          btnAgregarTxt.click();
          showToast('Abrí + Agregar: elegí la dependencia en el listado del modal.', 'error');
        }
      });
    });

    var nodes = resultadosEl.querySelectorAll('.txt-result-selectable');
    nodes.forEach(function (node) {
      if (node.__txtBound) return;
      node.__txtBound = true;

      function doSelect() {
        nodes.forEach(function (n) { n.classList.remove('txt-result-selected'); });
        node.classList.add('txt-result-selected');

        var label = (node.getAttribute('data-txt-label') || '').trim();
        var id = (node.getAttribute('data-txt-id') || '').trim();

        if (buscarInput && label) buscarInput.value = label;
        if (label) showToast('Seleccionado: ' + label, 'success');

        txtOrdenSelectedId = id;
        try { window.__txtSelected = { id: id, label: label }; } catch (e) { /* ignore */ }

        openModalTxtOrden(id, label);
      }

      node.addEventListener('click', function () { doSelect(); });
      node.addEventListener('keydown', function (e) {
        if (!e) return;
        if (e.key === 'Enter') {
          e.preventDefault();
          doSelect();
        }
      });
    });
  }

  function setTxtAgregarGuardarDisabled(disabled) {
    if (!btnAgregarTxtGuardar) return;
    btnAgregarTxtGuardar.disabled = !!disabled;
  }

  function bindTxtAgregarModalHandlers() {
    if (!btnAgregarTxt || !modalTxtAgregar || modalTxtAgregar.dataset.agregarBound) return;
    modalTxtAgregar.dataset.agregarBound = '1';

    function closeModalTxtAgregar() {
      modalTxtAgregar.classList.remove('open');
      divisionesNuevaTemp = [];
      if (ulDivLista) ulDivLista.innerHTML = '';
    }

    function setModo(modo) {
      if (!sectionNueva || !sectionExistente) return;
      if (modo === 'existente') {
        sectionNueva.style.display = 'none';
        sectionExistente.style.display = 'block';
      } else {
        sectionNueva.style.display = 'block';
        sectionExistente.style.display = 'none';
      }
    }

    function hideAgregarDepSugerencias() {
      if (depSugerenciasAgregar) depSugerenciasAgregar.style.display = 'none';
      txtAgregarDepSuggestIdx = -1;
    }

    function clearAgregarDepSelection() {
      if (inputDepIdHidden) inputDepIdHidden.value = '';
      if (depSeleccionadaMsg) {
        depSeleccionadaMsg.style.display = 'none';
        depSeleccionadaMsg.textContent = '';
      }
      setTxtAgregarGuardarDisabled(true);
    }

    function setAgregarDepSelection(dep) {
      if (!dep) {
        clearAgregarDepSelection();
        return;
      }
      var label = getDepDisplayLabel(dep, cachedDeps || []);
      if (inputDepIdHidden) inputDepIdHidden.value = String(dep.id);
      if (inputDepBuscarTxt) inputDepBuscarTxt.value = label;
      if (depSeleccionadaMsg) {
        depSeleccionadaMsg.textContent = 'Seleccionada: ' + label;
        depSeleccionadaMsg.style.display = 'block';
      }
      hideAgregarDepSugerencias();
      setTxtAgregarGuardarDisabled(false);
    }

    function getAgregarDepSelectedId() {
      return inputDepIdHidden && inputDepIdHidden.value ? String(inputDepIdHidden.value) : '';
    }

    function renderAgregarDepSugerencias(query) {
      if (!depSugerenciasAgregar) return;
      var q = normalizeString(query);
      var list = txtAgregarMainDepsList || [];
      var filtered = q
        ? list.filter(function (d) { return depMatchesQuery(d, q, cachedDeps || []); })
        : list.slice(0, 80);
      if (q) filtered = filtered.slice(0, 100);

      if (!filtered.length) {
        depSugerenciasAgregar.innerHTML = '<div class="txt-agregar-sug-empty" style="padding:0.65rem;color:#6b7280;font-size:0.88rem;">Sin coincidencias. Probá con el código (ej: 8) o parte del nombre.</div>';
        depSugerenciasAgregar.style.display = 'block';
        depSugerenciasAgregar.__filtered = [];
        return;
      }

      depSugerenciasAgregar.__filtered = filtered;
      depSugerenciasAgregar.innerHTML = filtered.map(function (d, i) {
        var label = getDepDisplayLabel(d, cachedDeps || []);
        return '<button type="button" class="txt-nuevo-sug-item" data-sug-idx="' + i + '" data-dep-id="' + escapeAttr(d.id) + '">' + escapeHtml(label) + '</button>';
      }).join('');
      depSugerenciasAgregar.style.display = 'block';
      txtAgregarDepSuggestIdx = -1;
    }

    function populateDepExistentePicker() {
      if (inputDepBuscarTxt) {
        inputDepBuscarTxt.disabled = true;
        inputDepBuscarTxt.value = '';
        inputDepBuscarTxt.placeholder = 'Cargando dependencias…';
      }
      clearAgregarDepSelection();
      hideAgregarDepSugerencias();
      if (depExistenteVacioMsg) depExistenteVacioMsg.style.display = 'none';

      return loadTxtData(true).then(function () {
        var mains = getMainDeps(cachedDeps || []);
        mains.sort(function (a, b) {
          var ca = parseInt(String(a.codigo || '0').replace(/\D/g, ''), 10) || 0;
          var cb = parseInt(String(b.codigo || '0').replace(/\D/g, ''), 10) || 0;
          if (ca !== cb) return ca - cb;
          return String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es');
        });

        txtAgregarMainDepsList = mains;

        if (!mains.length) {
          txtAgregarMainDepsList = [];
          if (inputDepBuscarTxt) {
            inputDepBuscarTxt.disabled = true;
            inputDepBuscarTxt.placeholder = 'Sin dependencias cargadas';
          }
          if (depExistenteVacioMsg) depExistenteVacioMsg.style.display = 'block';
          setTxtAgregarGuardarDisabled(true);
          return;
        }

        if (inputDepBuscarTxt) {
          inputDepBuscarTxt.disabled = false;
          inputDepBuscarTxt.placeholder = 'Escribí código o nombre (' + mains.length + ' dependencias)…';
        }
        if (depExistenteVacioMsg) depExistenteVacioMsg.style.display = 'none';
      }).catch(function () {
        txtAgregarMainDepsList = [];
        if (inputDepBuscarTxt) {
          inputDepBuscarTxt.disabled = false;
          inputDepBuscarTxt.placeholder = 'Error al cargar — reintentá';
        }
        showToast('No se pudieron cargar las dependencias', 'error');
      });
    }

    function renderDivList() {
      if (!ulDivLista) return;
      ulDivLista.innerHTML = '';
      (divisionesNuevaTemp || []).forEach(function (d, idx) {
        var li = document.createElement('li');
        li.textContent = (d.numero || '') + ' - ' + (d.nombre || '');
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-danger btn-sm';
        btn.style.marginLeft = '0.75rem';
        btn.textContent = 'Quitar';
        btn.addEventListener('click', function () {
          divisionesNuevaTemp.splice(idx, 1);
          renderDivList();
          if (getAgregarModo() === 'nueva') {
            setTxtAgregarGuardarDisabled(!(divisionesNuevaTemp && divisionesNuevaTemp.length));
          }
        });
        li.appendChild(btn);
        ulDivLista.appendChild(li);
      });
    }

    function applyAgregarModoUi() {
      var modo = getAgregarModo();
      setModo(modo);
      if (modo === 'existente') {
        populateDepExistentePicker();
        setTxtAgregarGuardarDisabled(true);
      } else {
        setTxtAgregarGuardarDisabled(!(divisionesNuevaTemp && divisionesNuevaTemp.length));
      }
    }

    btnAgregarTxt.addEventListener('click', function () {
      divisionesNuevaTemp = [];
      if (ulDivLista) ulDivLista.innerHTML = '';
      if (inputDivNumeroExTxt) inputDivNumeroExTxt.value = '';
      if (inputDivNombreExTxt) inputDivNombreExTxt.value = '';
      if (inputCodigoTxt) inputCodigoTxt.value = '';
      if (inputNombreDepTxt) inputNombreDepTxt.value = '';
      if (inputDepBuscarTxt) inputDepBuscarTxt.value = '';
      clearAgregarDepSelection();
      hideAgregarDepSugerencias();
      setAgregarModo('existente');
      applyAgregarModoUi();
      modalTxtAgregar.classList.add('open');
    });

    if (inputDepBuscarTxt) {
      inputDepBuscarTxt.addEventListener('input', function () {
        if (getAgregarModo() !== 'existente') return;
        if (inputDepIdHidden) inputDepIdHidden.value = '';
        if (depSeleccionadaMsg) depSeleccionadaMsg.style.display = 'none';
        setTxtAgregarGuardarDisabled(true);
        renderAgregarDepSugerencias(inputDepBuscarTxt.value || '');
      });
      inputDepBuscarTxt.addEventListener('focus', function () {
        if (getAgregarModo() !== 'existente') return;
        renderAgregarDepSugerencias(inputDepBuscarTxt.value || '');
      });
      inputDepBuscarTxt.addEventListener('keydown', function (e) {
        if (!depSugerenciasAgregar || depSugerenciasAgregar.style.display === 'none') return;
        var items = depSugerenciasAgregar.querySelectorAll('.txt-nuevo-sug-item');
        if (!items.length) return;
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          txtAgregarDepSuggestIdx = Math.min(txtAgregarDepSuggestIdx + 1, items.length - 1);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          txtAgregarDepSuggestIdx = Math.max(txtAgregarDepSuggestIdx - 1, 0);
        } else if (e.key === 'Enter' && txtAgregarDepSuggestIdx >= 0) {
          e.preventDefault();
          items[txtAgregarDepSuggestIdx].click();
          return;
        } else if (e.key === 'Escape') {
          hideAgregarDepSugerencias();
          return;
        } else {
          return;
        }
        items.forEach(function (el, i) {
          el.classList.toggle('active', i === txtAgregarDepSuggestIdx);
        });
        if (txtAgregarDepSuggestIdx >= 0 && items[txtAgregarDepSuggestIdx]) {
          items[txtAgregarDepSuggestIdx].scrollIntoView({ block: 'nearest' });
        }
      });
    }

    if (depSugerenciasAgregar) {
      depSugerenciasAgregar.addEventListener('click', function (ev) {
        var btn = ev.target && ev.target.closest ? ev.target.closest('.txt-nuevo-sug-item') : null;
        if (!btn) return;
        var depId = btn.getAttribute('data-dep-id') || '';
        var dep = (txtAgregarMainDepsList || []).find(function (d) { return String(d.id) === String(depId); });
        if (!dep && depSugerenciasAgregar.__filtered) {
          dep = depSugerenciasAgregar.__filtered.find(function (d) { return String(d.id) === String(depId); });
        }
        if (dep) setAgregarDepSelection(dep);
      });
    }

    if (!document.documentElement.dataset.txtAgregarDocClick) {
      document.documentElement.dataset.txtAgregarDocClick = '1';
      document.addEventListener('click', function (ev) {
        if (!modalTxtAgregar || !modalTxtAgregar.classList.contains('open')) return;
        var t = ev.target;
        if (!t || !t.closest) return;
        if (t.closest('.txt-agregar-dep-search-wrap')) return;
        hideAgregarDepSugerencias();
      });
    }

    agregarModoTabs.forEach(function (btn) {
      btn.addEventListener('click', function () {
        setAgregarModo(btn.getAttribute('data-txt-modo') || 'existente');
        applyAgregarModoUi();
      });
    });

    if (btnAgregarDivLista) {
      btnAgregarDivLista.addEventListener('click', function () {
        if (!inputDivNumeroTxt || !inputDivNombreTxt) return;
        var numero = (inputDivNumeroTxt.value || '').trim();
        var nombre = (inputDivNombreTxt.value || '').trim().toUpperCase();
        var numeroDigits = (numero || '').replace(/[^\d]/g, '');
        if (!numeroDigits) {
          showToast('Ingresá el nº de división', 'error');
          return;
        }
        if (!nombre) {
          showToast('Ingresá el nombre de la división', 'error');
          return;
        }
        var exists = (divisionesNuevaTemp || []).some(function (d) { return String(d.numero) === String(numeroDigits); });
        if (exists) {
          showToast('Ya existe esa división en la lista', 'error');
          return;
        }
        divisionesNuevaTemp.push({ numero: numeroDigits, nombre: nombre });
        inputDivNumeroTxt.value = '';
        inputDivNombreTxt.value = '';
        renderDivList();
        setTxtAgregarGuardarDisabled(false);
      });
    }

    if (btnAgregarTxtGuardar) {
      btnAgregarTxtGuardar.addEventListener('click', function () {
        var modo = getAgregarModo();
        if (modo === 'existente') {
          var depId = getAgregarDepSelectedId();
          var depObj = (cachedDeps || []).find(function (d) { return String(d.id) === String(depId); });
          var divNumero2 = inputDivNumeroExTxt ? (inputDivNumeroExTxt.value || '').trim() : '';
          var divNombre2 = inputDivNombreExTxt ? (inputDivNombreExTxt.value || '').trim().toUpperCase() : '';
          var divNumero2Digits = (divNumero2 || '').replace(/[^\d]/g, '');
          if (!depId || !depObj) {
            showToast('Selecciona una dependencia existente', 'error');
            return;
          }
          if (!divNumero2Digits) {
            showToast('Ingresá el nº de habitación', 'error');
            return;
          }
          if (!divNombre2) {
            showToast('Ingresá el nombre de la habitación', 'error');
            return;
          }
          var mainId = depObj.id;
          var divId = mainId + '-div-' + divNumero2Digits;
          var payloadDiv = { id: divId, nombre: divNombre2, codigo: depObj.codigo || '', parentId: mainId, numero: divNumero2Digits };
          var saveFn = getSaveTxtDependenciaFn();
          if (!saveFn) {
            showToast('No se puede guardar: falta conexión a tabla TXT', 'error');
            return;
          }
          saveFn(payloadDiv).then(function () {
            showToast('Habitación agregada', 'success');
            closeModalTxtAgregar();
            cachedLoaded = false;
            loadTxtData(true).then(function () {
              if (buscarInput) buscarInput.dispatchEvent(new Event('input'));
            });
          }).catch(function (err) {
            console.error('[TXT] saveDependencia div existente ERROR:', err);
            showToast('Error al guardar la habitación', 'error');
          });
        } else {
          var codigo = inputCodigoTxt ? (inputCodigoTxt.value || '').trim() : '';
          var nombreDep = inputNombreDepTxt ? (inputNombreDepTxt.value || '').trim().toUpperCase() : '';
          var codigoDigits = (codigo || '').replace(/[^\d]/g, '');
          if (!codigoDigits) {
            showToast('Ingresá el código/ID de dependencia', 'error');
            return;
          }
          if (!nombreDep) {
            showToast('Ingresá el nombre de dependencia', 'error');
            return;
          }
          if (!divisionesNuevaTemp || !divisionesNuevaTemp.length) {
            showToast('Agregá al menos una división', 'error');
            return;
          }
          var mainId2 = 'txt-dep-' + codigoDigits;
          var payloadMain = { id: mainId2, nombre: nombreDep, codigo: codigoDigits, parentId: null, numero: null };
          var promises = [];
          var saveFn2 = getSaveTxtDependenciaFn();
          if (!saveFn2) {
            showToast('No se puede guardar: falta conexión a tabla TXT', 'error');
            return;
          }
          promises.push(saveFn2(payloadMain));
          divisionesNuevaTemp.forEach(function (d) {
            var divId2 = mainId2 + '-div-' + d.numero;
            promises.push(saveFn2({ id: divId2, nombre: d.nombre, codigo: codigoDigits, parentId: mainId2, numero: d.numero }));
          });
          Promise.all(promises).then(function () {
            showToast('Dependencia y divisiones agregadas', 'success');
            closeModalTxtAgregar();
            cachedLoaded = false;
            loadTxtData(true).then(function () {
              if (buscarInput) buscarInput.dispatchEvent(new Event('input'));
            });
          }).catch(function (err) {
            console.error('[TXT] saveDependencia nueva ERROR:', err);
            showToast('Error al guardar la dependencia', 'error');
          });
        }
      });
    }

    document.querySelectorAll('.modal-txt-agregar-close').forEach(function (btn) {
      btn.addEventListener('click', closeModalTxtAgregar);
    });
    modalTxtAgregar.addEventListener('click', function (e) {
      if (e && e.target === modalTxtAgregar) closeModalTxtAgregar();
    });

    window.__txtOpenAgregarHabitacion = function (depId) {
      divisionesNuevaTemp = [];
      if (ulDivLista) ulDivLista.innerHTML = '';
      if (inputDivNumeroExTxt) inputDivNumeroExTxt.value = '';
      if (inputDivNombreExTxt) inputDivNombreExTxt.value = '';
      setAgregarModo('existente');
      applyAgregarModoUi();
      modalTxtAgregar.classList.add('open');
      var id = depId != null ? String(depId) : '';
      if (!id) return;
      populateDepExistentePicker().then(function () {
        var dep = (txtAgregarMainDepsList || []).find(function (d) { return String(d.id) === String(id); })
          || (cachedDeps || []).find(function (d) { return String(d.id) === String(id); });
        if (dep) setAgregarDepSelection(dep);
      });
    };
  }

  function runTxtBusqueda() {
    if (!buscarInput) return;
    try {
      var seq = ++txtBusquedaSeq;
      var query = (buscarInput.value || '').trim();

      if (limpiarBtn) limpiarBtn.style.display = query ? 'inline-flex' : 'none';

      loadTxtData().then(function () {
        // Evitar que una búsqueda vieja pise la búsqueda más nueva.
        if (seq !== txtBusquedaSeq) return;
        try {
          var count = renderTxtResultadosBasico(cachedDeps || [], query) || 0;
          if ((cachedDeps || []).length === 0) {
            showToast('TXT: no se cargaron dependencias (0). Revisar guardado/conexión.', 'error');
          } else if (count === 0 && query) {
            showToast('TXT: se cargaron ' + (cachedDeps || []).length + ' dependencias, pero ninguna coincide con "' + query + '".', 'error');
          }
        } catch (e2) { /* ignore */ }
      }).catch(function () {
        renderTxtResultadosVacio('Error al cargar dependencias para buscar. Probá reiniciar el programa.');
      });
    } catch (e) {
      console.error('[TXT] runTxtBusqueda ERROR:', e);
      renderTxtResultadosVacio('Error al buscar. Probá de nuevo.');
    }
  }

  function debounce(fn, waitMs) {
    var t;
    return function () {
      var args = arguments;
      if (t) clearTimeout(t);
      t = setTimeout(function () {
        fn.apply(null, args);
      }, waitMs);
    };
  }

  window._realtimeRefresh = function (table) {
    if (!table || table === 'txt_dependencias') {
      cachedLoaded = false;
      runTxtBusqueda();
    }
    if (!table || table === 'txt_realizados') {
      if (window.__txtRefreshRealizados) {
        window.__txtRefreshRealizados().then(function () {
          if (window.__txtRenderRealizados) window.__txtRenderRealizados();
        });
      }
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

