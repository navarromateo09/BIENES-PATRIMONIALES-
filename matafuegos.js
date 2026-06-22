(function () {
  'use strict';

  function mfAlert(msg, title) {
    if (window.appDialog && window.appDialog.alert) return window.appDialog.mfAlert(msg, title);
    mfAlert(msg);
    return Promise.resolve();
  }

  function mfConfirm(msg, title) {
    if (window.appDialog && window.appDialog.confirm) return window.appDialog.confirm(msg, title);
    return Promise.resolve(window.confirm(msg));
  }

  var card = document.getElementById('card-matafuegos-disponible');
  var panel = document.getElementById('panel-matafuegos-disponible');
  var cardRecarga = document.getElementById('card-matafuegos-recarga');
  var cardEntregados = document.getElementById('card-matafuegos-entregados');
  var cardInservibles = document.getElementById('card-matafuegos-inservibles');
  var cardHistorial = document.getElementById('card-matafuegos-historial');
  var panelRecarga = document.getElementById('panel-matafuegos-recarga');
  var panelEntregar = document.getElementById('panel-matafuegos-entregar');
  var panelEntregados = document.getElementById('panel-matafuegos-entregados');
  var panelInservibles = document.getElementById('panel-matafuegos-inservibles');
  var panelHistorial = document.getElementById('panel-matafuegos-historial');
  var mainTabsWrap = document.getElementById('matafuegos-main-tabs');
  var btnEntregarHeader = document.getElementById('btn-entregar-matafuego-header');
  var btnCerrarEntregar = document.querySelector('.cerrar-panel-entregar');
  var btnAgregar = document.getElementById('btn-agregar-matafuego');
  var btnAgregarInservible = document.getElementById('btn-agregar-inservible');
  var modalAgregar = document.getElementById('modal-agregar-matafuego');
  var modalAgregarInservible = document.getElementById('modal-agregar-inservible');
  var modalEditarVencimiento = document.getElementById('modal-editar-vencimiento-matafuego');
  var modalRecargaListoVenc = document.getElementById('modal-recarga-listo-vencimiento');
  var modalSerieDuplicada = document.getElementById('modal-matafuego-serie-duplicada');
  var mfSerieDuplicadaList = document.getElementById('mf-serie-duplicada-list');
  var formRecargaListoVenc = document.getElementById('form-recarga-listo-vencimiento');
  var inputRecargaListoVenc = document.getElementById('recarga-listo-vencimiento-fecha');
  var recargaListoResumenEl = document.getElementById('recarga-listo-resumen');
  var formAgregar = document.getElementById('form-agregar-matafuego');
  var formAgregarInservible = document.getElementById('form-agregar-inservible');
  var formEditarVencimiento = document.getElementById('form-editar-vencimiento-matafuego');
  var formEntregar = document.getElementById('form-entregar-matafuego');
  var listaDisponible = document.getElementById('lista-matafuegos-disponible');
  var listaRecarga = document.getElementById('lista-matafuegos-recarga');
  var listaEntregados = document.getElementById('lista-matafuegos-entregados');
  var listaInservibles = document.getElementById('lista-matafuegos-inservibles');
  var listaHistorial = document.getElementById('lista-matafuegos-historial');
  var contadorDisponible = document.getElementById('matafuegos-disponible');
  var contadorRecarga = document.getElementById('matafuegos-recarga');
  var contadorEntregados = document.getElementById('matafuegos-entregados');
  var contadorInservibles = document.getElementById('matafuegos-inservibles');
  var contadorHistorial = document.getElementById('matafuegos-historial-count');
  var selectEntregaDep = document.getElementById('entrega-dependencia');
  var selectEntregaMatafuego = document.getElementById('entrega-matafuego');
  var inputRecargaSearch = document.getElementById('recarga-search');
  var inputDisponiblesPanelSearch = document.getElementById('disponibles-panel-search');
  var inputInserviblesPanelSearch = document.getElementById('inservibles-panel-search');
  var inputEntregadosPanelSearch = document.getElementById('entregados-panel-search');
  var inputHistorialPanelSearch = document.getElementById('historial-panel-search');
  var inputEntregaBuscarDep = document.getElementById('entrega-buscar-dependencia');
  var tbodyEntregaDeps = document.getElementById('entrega-tabla-dependencias');
  var entregaDepSeleccionResumen = document.getElementById('entrega-dep-seleccion-resumen');
  var expandedDepIdsEntrega = {};
  var inputEntregarMfBuscar = document.getElementById('entrega-buscar-matafuego');
  var tbodyEntregaMf = document.getElementById('entrega-tabla-matafuegos');
  var entregaMfSeleccionResumen = document.getElementById('entrega-mf-seleccion-resumen');
  var inputSearch = document.getElementById('matafuegos-search');
  var btnSearchClear = document.getElementById('matafuegos-search-clear');
  var searchCombo = inputSearch ? inputSearch.closest('.matafuegos-search-combo') : null;
  var searchDropdown = document.getElementById('matafuegos-search-suggestions');
  var wrapGlobalMatafuegosSearch = document.getElementById('matafuegos-global-search-wrap');
  var matafuegosContentEl = document.querySelector('.matafuegos-content');
  var btnVolverResumen = document.getElementById('mf-btn-volver-resumen');
  var btnVolverEntrega = document.getElementById('mf-btn-volver-entrega');

  var matafuegosDisponibles = [];
  var matafuegosRecarga = [];
  var matafuegosEntregados = [];
  var matafuegosInservibles = [];
  var historialMatafuegos = [];
  var esAdmin = false;
  var dependencias = [];
  /** IDs de txt_dependencias (misma convención que Entregas / guardia). */
  var txtDependenciaIdSet = {};
  /** Prefijo de filas duplicadas históricas en tabla dependencias (convención TXT). */
  var TXT_DEP_ID_PREFIXES_EXCLUIR = ['txt-dep-'];

  function rebuildTxtDependenciaIdSet(txtList) {
    txtDependenciaIdSet = {};
    (txtList || []).forEach(function (d) {
      if (d && d.id != null) txtDependenciaIdSet[String(d.id)] = true;
    });
  }

  function isDependenciaIdImportadaTxt(id) {
    if (id == null) return false;
    var s = String(id);
    if (TXT_DEP_ID_PREFIXES_EXCLUIR.some(function (p) { return s.indexOf(p) === 0; })) return true;
    return !!txtDependenciaIdSet[s];
  }

  function isDependenciaRegistroTxt(dep) {
    if (!dep) return false;
    return isDependenciaIdImportadaTxt(dep.id);
  }

  function dependenciaExcluidaDeFormulariosStock(dep, allDeps) {
    if (!dep) return true;
    var list = allDeps != null ? allDeps : dependencias;
    if (isDependenciaRegistroTxt(dep.id)) return true;
    var parId = dep.parentId;
    if (!parId) return false;
    var parent = (list || []).find(function (x) { return String(x.id) === String(parId); });
    return parent ? dependenciaExcluidaDeFormulariosStock(parent, list) : false;
  }

  function dependenciasParaFormulariosStock() {
    return (dependencias || []).filter(function (d) { return !dependenciaExcluidaDeFormulariosStock(d, dependencias); });
  }

  var pagDisponible = 1;
  var pagRecarga = 1;
  var pagEntregados = 1;
  var pagInservibles = 1;
  var pagHistorial = 1;
  var PAG_SIZE = 10;
  var VENCIDO_SIN_FECHA_SENTINEL = '1900-01-01';
  var editMatafuegoId = null;
  var matafuegosSearchTerm = '';
  var recargaSearchTerm = '';
  var disponiblesPanelSearchTerm = '';
  var MF_FILTER_TAB_KEYS = ['disponibles', 'recarga', 'inservibles', 'entregados'];

  function createEmptyMfFiltros() {
    return { marca: '', vencimiento: '', vencimientoDesde: '', vencimientoHasta: '', orden: '' };
  }

  var mfTabFiltros = {
    disponibles: createEmptyMfFiltros(),
    recarga: createEmptyMfFiltros(),
    inservibles: createEmptyMfFiltros(),
    entregados: createEmptyMfFiltros()
  };
  var inserviblesPanelSearchTerm = '';
  var entregadosPanelSearchTerm = '';
  var historialPanelSearchTerm = '';
  var searchSuggestIndex = -1;
  var RECARGANDO_STORAGE_KEY = 'matafuegos-recargando-ids';
  var recargandoIds = {};
  var activeTabKey = 'disponibles';
  var recargaListoPendienteId = null;
  /** ids de matafuegos disponibles marcados para la misma entrega */
  var entregaMfIdsSeleccionados = {};
  var matafuegoSeriesRenderCount = 1;

  function escapeAttrMf(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  }

  function escapeHtmlMf(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  function loadRecargandoIds() {
    recargandoIds = {};
  }

  function saveRecargandoIds() {
    // Estado "recargando" sincronizado por backend (audit_log de Supabase).
  }

  function isRecargandoId(id) {
    var k = String(id || '').trim();
    return !!(k && recargandoIds[k]);
  }

  function toggleRecargandoIdLocal(id) {
    var k = String(id || '').trim();
    if (!k) return false;
    if (recargandoIds[k]) delete recargandoIds[k];
    else recargandoIds[k] = true;
    return !!recargandoIds[k];
  }

  function setRecargandoIdLocal(id, recargando) {
    var k = String(id || '').trim();
    if (!k) return;
    if (recargando) recargandoIds[k] = true;
    else delete recargandoIds[k];
  }

  function isVencidoSinFecha(fecha) {
    return !!fecha && String(fecha).slice(0, 10) === VENCIDO_SIN_FECHA_SENTINEL;
  }

  /** Fechas YYYY-MM-DD como string: día calendario local (evita un día menos con new Date('YYYY-MM-DD') en UTC). */
  function formatFechaCampoLocal(val) {
    if (val == null || val === '') return '—';
    var s = String(val).trim();
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      var y = parseInt(m[1], 10);
      var mo = parseInt(m[2], 10) - 1;
      var d = parseInt(m[3], 10);
      if (!isNaN(y) && !isNaN(mo) && !isNaN(d)) {
        return new Date(y, mo, d).toLocaleDateString('es-AR');
      }
    }
    var dt = new Date(s);
    return !isNaN(dt.getTime()) ? dt.toLocaleDateString('es-AR') : '—';
  }

  function formatFechaVencimiento(fecha) {
    if (isVencidoSinFecha(fecha)) return 'Vencido (sin fecha)';
    return formatFechaCampoLocal(fecha);
  }

  /** Fecha corta tipo 4/5/2027 (sin ceros a la izquierda), calendario local para YYYY-MM-DD. */
  function formatFechaCortaLocal(val) {
    if (val == null || val === '') return '—';
    if (isVencidoSinFecha(val)) return 'Vencido';
    var s = String(val).trim();
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      var y = parseInt(m[1], 10);
      var mo = parseInt(m[2], 10);
      var d = parseInt(m[3], 10);
      if (!isNaN(y) && !isNaN(mo) && !isNaN(d)) return d + '/' + mo + '/' + y;
    }
    var dt = new Date(s);
    if (!isNaN(dt.getTime())) return dt.getDate() + '/' + (dt.getMonth() + 1) + '/' + dt.getFullYear();
    return '—';
  }

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function toIsoDateLocal(d) {
    if (!d || isNaN(d.getTime())) return '';
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function parseIsoYmdLocalDate(iso) {
    var m = String(iso || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    var dt = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
    return isNaN(dt.getTime()) ? null : dt;
  }

  function minFechaMananaIso() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 1);
    return toIsoDateLocal(d);
  }

  /** Sugerencia para el date picker: un año si el vencimiento actual no sirve para disponible. */
  function defaultVencimientoPostRecarga(m) {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setFullYear(d.getFullYear() + 1);
    var suggested = toIsoDateLocal(d);
    if (!m || !m.fechaVencimiento || isVencidoSinFecha(m.fechaVencimiento)) return suggested;
    var fv = String(m.fechaVencimiento).slice(0, 10);
    var v = parseIsoYmdLocalDate(fv);
    if (!v) return suggested;
    var hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    if (v <= hoy) return suggested;
    if (m.fechaIngreso) {
      var ing = parseIsoYmdLocalDate(String(m.fechaIngreso).slice(0, 10));
      if (ing && v < ing) return suggested;
    }
    return fv;
  }

  function inferCapacidadTipo(car) {
    var c = String(car || '').trim();
    if (!c) return { capacidad: '—', tipo: '' };
    var cap = '—';
    var kgMatch = c.match(/(\d+(?:[.,]\d+)?)\s*(kg)\b/i);
    if (kgMatch) cap = kgMatch[1].replace(',', '.') + ' KG';
    else {
      var lMatch = c.match(/(\d+(?:[.,]\d+)?)\s*(l|lt|litros?)\b/i);
      if (lMatch) cap = lMatch[1].replace(',', '.') + ' L';
    }
    var tipo = '';
    var tipoM = c.match(/\b(ABC|BC|CO2|HALON|ESPUMA|POLVO\s*QU[ií]MICO|H\.?\s*O\.?\s*O\.?|AGUA)\b/i);
    if (tipoM) tipo = tipoM[1].toUpperCase().replace(/\s+/g, ' ');
    else if (/abc/i.test(c) && /polvo/i.test(c)) tipo = 'ABC';
    return { capacidad: cap, tipo: tipo };
  }

  function normalizeText(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  /** Solo letras y números (para comparar series con guiones/espacios de más o de menos). */
  function normalizeAlnum(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  function levenshtein(a, b) {
    var s = a || '';
    var t = b || '';
    if (s === t) return 0;
    if (!s.length) return t.length;
    if (!t.length) return s.length;
    var prev = [];
    var i;
    var j;
    for (j = 0; j <= t.length; j++) prev[j] = j;
    for (i = 1; i <= s.length; i++) {
      var cur = [i];
      for (j = 1; j <= t.length; j++) {
        var cost = s.charAt(i - 1) === t.charAt(j - 1) ? 0 : 1;
        cur[j] = Math.min(
          cur[j - 1] + 1,
          prev[j] + 1,
          prev[j - 1] + cost
        );
      }
      prev = cur;
    }
    return prev[t.length];
  }

  function isSubsequence(needle, haystack) {
    if (!needle) return true;
    if (!haystack) return false;
    var i = 0;
    for (var j = 0; j < haystack.length && i < needle.length; j++) {
      if (haystack.charAt(j) === needle.charAt(i)) i++;
    }
    return i === needle.length;
  }

  function matafuegoSerieCompareKey(serie) {
    var alnum = normalizeAlnum(serie);
    if (!alnum) return '';
    if (/^\d+$/.test(alnum)) return alnum.replace(/^0+/, '') || '0';
    return alnum;
  }

  function isExactSerieSearchMatch(serie, termRaw) {
    var t = matafuegoSerieCompareKey(termRaw);
    if (!t) return false;
    return matafuegoSerieCompareKey(serie) === t;
  }

  function matafuegoTrClassAttr(m, termRaw) {
    if (!normalizeText(termRaw) || !isExactSerieSearchMatch(m.numeroSerie, termRaw)) return '';
    return ' class="mf-row-search-exact" title="Coincidencia exacta con la búsqueda"';
  }

  /** Puntaje menor = mejor coincidencia (para ordenar sugerencias). */
  function serialMatchScore(serie, termRaw) {
    var s = matafuegoSerieCompareKey(serie);
    var t = matafuegoSerieCompareKey(termRaw);
    if (!t) return 0;
    if (!s) return 999;
    if (s === t) return 0;
    if (s.indexOf(t) >= 0) return 1;
    if (t.indexOf(s) >= 0) return 2;
    if (isSubsequence(t, s)) return 3;
    if (isSubsequence(s, t)) return 4;
    return 10 + levenshtein(s, t);
  }

  /**
   * Serie similar aunque falte un dígito, haya typo o formato distinto.
   */
  function serialFuzzyMatch(serie, termRaw) {
    var s = normalizeAlnum(serie);
    var t = normalizeAlnum(termRaw);
    if (!t || t.length < 2) return false;
    if (!s) return false;
    if (s === t) return true;
    if (s.indexOf(t) >= 0 || t.indexOf(s) >= 0) return true;
    if (isSubsequence(t, s) || isSubsequence(s, t)) return true;
    var maxLen = Math.max(s.length, t.length);
    var minLen = Math.min(s.length, t.length);
    if (minLen <= 4) return false;
    if (maxLen - minLen > 4) return false;
    var dist = levenshtein(s, t);
    var allowed = Math.max(1, Math.floor(maxLen * 0.22));
    if (minLen >= 5 && dist <= allowed) return true;
    if (minLen >= 3 && dist <= 2) return true;
    if (minLen >= 2 && dist <= 1) return true;
    return false;
  }

  function matafuegoMatchesTerm(m, estadoKey, termRaw) {
    var term = normalizeText(termRaw || '');
    if (!term) return true;
    var blob = getMatafuegoSearchText(m, estadoKey);
    if (blob.indexOf(term) >= 0) return true;

    var serie = (m.numeroSerie || '').trim();
    var termTrim = String(termRaw || '').trim();
    if (serie && termTrim && serialFuzzyMatch(serie, termTrim)) return true;

    var tokens = term.split(/\s+/).filter(function (x) { return x.length >= 2; });
    if (tokens.length > 1) {
      return tokens.every(function (tok) {
        if (blob.indexOf(tok) >= 0) return true;
        if (serie && serialFuzzyMatch(serie, tok)) return true;
        return false;
      });
    }
    if (tokens.length === 1) {
      var tok = tokens[0];
      if (blob.indexOf(tok) >= 0) return true;
      if (serie && serialFuzzyMatch(serie, tok)) return true;
      var marca = normalizeText(m.marca);
      if (marca && tok.length >= 3) {
        if (marca.indexOf(tok) >= 0) return true;
        if (levenshtein(marca, tok) <= 1) return true;
      }
    }
    return false;
  }

  function sortMatafuegosBySearchRelevance(items, termRaw) {
    var t = normalizeAlnum(termRaw);
    if (!t || t.length < 2) return items.slice();
    return items.slice().sort(function (a, b) {
      return serialMatchScore(a.numeroSerie, termRaw) - serialMatchScore(b.numeroSerie, termRaw);
    });
  }

  function getMatafuegoSearchText(m, estadoKey) {
    var inf = inferCapacidadTipo(m.caracteristicas);
    var parts = [
      m.id || '',
      m.marca || '',
      m.numeroSerie || '',
      m.caracteristicas || '',
      inf.capacidad,
      inf.tipo,
      formatFechaVencimiento(m.fechaVencimiento),
      m.fechaVencimiento || '',
      m.estado || estadoKey || ''
    ];
    if (estadoKey === 'recarga') {
      parts.push(m.fechaIngreso || '');
      parts.push(m.fechaIngreso ? formatFechaCampoLocal(m.fechaIngreso) : '');
      parts.push(getDepLabel(m.dependenciaId));
      parts.push(m.dependenciaId || '');
    } else if (estadoKey === 'entregado') {
      parts.push(m.fechaIngreso || '');
      parts.push(m.fechaIngreso ? formatFechaCampoLocal(m.fechaIngreso) : '');
      parts.push(getDepLabel(m.dependenciaId));
      parts.push(m.dependenciaId || '');
    } else if (estadoKey === 'disponible' || estadoKey === 'inservible') {
      parts.push(getDepLabel(m.dependenciaId));
      parts.push(m.dependenciaId || '');
    }
    return normalizeText(parts.join(' '));
  }

  function filterMatafuegosByTerm(items, estadoKey, term) {
    if (!normalizeText(term || '')) return items.slice();
    return items.filter(function (m) { return matafuegoMatchesTerm(m, estadoKey, term); });
  }

  function filterMatafuegos(items, estadoKey) {
    return filterMatafuegosByTerm(items, estadoKey, matafuegosSearchTerm);
  }

  /**
   * Búsqueda de pestaña: si hay texto en la lupa local, solo usa ese término.
   * Si no, hereda la búsqueda global (evita exigir coincidir con ambas a la vez).
   */
  function getEffectiveMatafuegoSearchTerm(panelTerm) {
    if (normalizeText(panelTerm || '')) return String(panelTerm || '').trim();
    return String(matafuegosSearchTerm || '').trim();
  }

  function hasMatafuegoListSearchFilter(panelTerm) {
    return !!normalizeText(getEffectiveMatafuegoSearchTerm(panelTerm));
  }

  function filterRecargaByPanelSearch(items) {
    var term = getEffectiveMatafuegoSearchTerm(recargaSearchTerm);
    if (!normalizeText(term)) return items.slice();
    return items.filter(function (m) { return matafuegoMatchesTerm(m, 'recarga', term); });
  }

  function dispatchPanelSearchInput(inputEl) {
    if (!inputEl) return;
    try { inputEl.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
    try { inputEl.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {}
  }

  function clearPanelSearchForTab(tabKey) {
    if (tabKey === 'recarga') {
      recargaSearchTerm = '';
      if (inputRecargaSearch) {
        inputRecargaSearch.value = '';
        dispatchPanelSearchInput(inputRecargaSearch);
      }
    } else if (tabKey === 'disponibles') {
      disponiblesPanelSearchTerm = '';
      if (inputDisponiblesPanelSearch) {
        inputDisponiblesPanelSearch.value = '';
        dispatchPanelSearchInput(inputDisponiblesPanelSearch);
      }
    } else if (tabKey === 'inservibles') {
      inserviblesPanelSearchTerm = '';
      if (inputInserviblesPanelSearch) {
        inputInserviblesPanelSearch.value = '';
        dispatchPanelSearchInput(inputInserviblesPanelSearch);
      }
    } else if (tabKey === 'entregados') {
      entregadosPanelSearchTerm = '';
      if (inputEntregadosPanelSearch) {
        inputEntregadosPanelSearch.value = '';
        dispatchPanelSearchInput(inputEntregadosPanelSearch);
      }
    } else if (tabKey === 'historial') {
      historialPanelSearchTerm = '';
      if (inputHistorialPanelSearch) {
        inputHistorialPanelSearch.value = '';
        dispatchPanelSearchInput(inputHistorialPanelSearch);
      }
    }
  }

  function setPanelSearchForTab(tabKey, term) {
    var t = String(term == null ? '' : term).trim();
    if (tabKey === 'recarga') {
      recargaSearchTerm = t;
      if (inputRecargaSearch) {
        inputRecargaSearch.value = t;
        dispatchPanelSearchInput(inputRecargaSearch);
      }
    } else if (tabKey === 'disponibles') {
      disponiblesPanelSearchTerm = t;
      if (inputDisponiblesPanelSearch) {
        inputDisponiblesPanelSearch.value = t;
        dispatchPanelSearchInput(inputDisponiblesPanelSearch);
      }
    } else if (tabKey === 'inservibles') {
      inserviblesPanelSearchTerm = t;
      if (inputInserviblesPanelSearch) {
        inputInserviblesPanelSearch.value = t;
        dispatchPanelSearchInput(inputInserviblesPanelSearch);
      }
    } else if (tabKey === 'entregados') {
      entregadosPanelSearchTerm = t;
      if (inputEntregadosPanelSearch) {
        inputEntregadosPanelSearch.value = t;
        dispatchPanelSearchInput(inputEntregadosPanelSearch);
      }
    } else if (tabKey === 'historial') {
      historialPanelSearchTerm = t;
      if (inputHistorialPanelSearch) {
        inputHistorialPanelSearch.value = t;
        dispatchPanelSearchInput(inputHistorialPanelSearch);
      }
    }
  }

  function clearAllPanelSearches() {
    clearPanelSearchForTab('disponibles');
    clearPanelSearchForTab('recarga');
    clearPanelSearchForTab('inservibles');
    clearPanelSearchForTab('entregados');
    clearPanelSearchForTab('historial');
  }

  function getMatafuegoFechaAlta(m) {
    if (!m) return null;
    if (m.createdAt) {
      var dc = new Date(m.createdAt);
      if (!isNaN(dc.getTime())) return dc;
    }
    if (m.fechaIngreso) return parseIsoYmdLocalDate(String(m.fechaIngreso).slice(0, 10));
    var idn = parseInt(String(m.id || ''), 10);
    if (!isNaN(idn) && idn > 1e11) return new Date(idn);
    return null;
  }

  function getMatafuegoFechaVencimientoDate(m) {
    if (!m || !m.fechaVencimiento || isVencidoSinFecha(m.fechaVencimiento)) return null;
    return parseIsoYmdLocalDate(String(m.fechaVencimiento).slice(0, 10));
  }

  function getMfFiltros(tab) {
    if (!mfTabFiltros[tab]) mfTabFiltros[tab] = createEmptyMfFiltros();
    return mfTabFiltros[tab];
  }

  function hasMfFiltrosActivos(tab) {
    var f = getMfFiltros(tab);
    return !!(f.marca || f.vencimiento || f.orden);
  }

  function hasDisponiblesFiltrosActivos() {
    return hasMfFiltrosActivos('disponibles');
  }

  function getUniqueMarcasFromList(items) {
    var seen = {};
    var out = [];
    (items || []).forEach(function (m) {
      var marca = String(m.marca || '').trim();
      if (!marca) return;
      var key = normalizeText(marca);
      if (seen[key]) return;
      seen[key] = true;
      out.push(marca);
    });
    out.sort(function (a, b) { return a.localeCompare(b, 'es', { sensitivity: 'base' }); });
    return out;
  }

  function applyMfAdvancedFiltros(items, filtros) {
    var f = filtros || createEmptyMfFiltros();
    var out = items.slice();
    if (f.marca) {
      var mk = normalizeText(f.marca);
      out = out.filter(function (m) { return normalizeText(m.marca) === mk; });
    }
    var vf = f.vencimiento;
    if (vf) {
      var hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      out = out.filter(function (m) {
        if (vf === 'sin_fecha') {
          return !m.fechaVencimiento || isVencidoSinFecha(m.fechaVencimiento);
        }
        var fv = getMatafuegoFechaVencimientoDate(m);
        if (!fv) return false;
        if (vf === 'prox30') {
          var lim = new Date(hoy);
          lim.setDate(lim.getDate() + 30);
          return fv >= hoy && fv <= lim;
        }
        if (vf === 'vencidos') return fv < hoy;
        if (vf === 'rango') {
          var desde = f.vencimientoDesde ? parseIsoYmdLocalDate(f.vencimientoDesde) : null;
          var hasta = f.vencimientoHasta ? parseIsoYmdLocalDate(f.vencimientoHasta) : null;
          if (desde && fv < desde) return false;
          if (hasta && fv > hasta) return false;
          return true;
        }
        return true;
      });
    }
    return out;
  }

  function applyDisponiblesAdvancedFiltros(items) {
    return applyMfAdvancedFiltros(items, getMfFiltros('disponibles'));
  }

  function getMfSourceListForTab(tab) {
    if (tab === 'recarga') return matafuegosRecarga;
    if (tab === 'entregados') return matafuegosEntregados;
    if (tab === 'inservibles') return matafuegosInservibles;
    return matafuegosDisponibles;
  }

  function getMfPanelSearchTermForTab(tab) {
    if (tab === 'recarga') return recargaSearchTerm;
    if (tab === 'entregados') return entregadosPanelSearchTerm;
    if (tab === 'inservibles') return inserviblesPanelSearchTerm;
    return disponiblesPanelSearchTerm;
  }

  function sortMfFilteredList(list, panelTerm, filtros) {
    var sortTerm = getEffectiveMatafuegoSearchTerm(panelTerm);
    if (normalizeText(sortTerm)) return sortMatafuegosBySearchRelevance(list, sortTerm);
    var ord = (filtros || createEmptyMfFiltros()).orden;
    var out = list.slice();
    if (!ord) return out;
    if (ord === 'ultimos_agregados') {
      out.sort(function (a, b) {
        var da = getMatafuegoFechaAlta(a);
        var db = getMatafuegoFechaAlta(b);
        var ta = da ? da.getTime() : 0;
        var tb = db ? db.getTime() : 0;
        if (tb !== ta) return tb - ta;
        return String(b.id || '').localeCompare(String(a.id || ''));
      });
    } else if (ord === 'vencimiento_asc') {
      out.sort(function (a, b) {
        var fa = getMatafuegoFechaVencimientoDate(a);
        var fb = getMatafuegoFechaVencimientoDate(b);
        if (!fa && !fb) return 0;
        if (!fa) return 1;
        if (!fb) return -1;
        return fa - fb;
      });
    } else if (ord === 'vencimiento_desc') {
      out.sort(function (a, b) {
        var fa = getMatafuegoFechaVencimientoDate(a);
        var fb = getMatafuegoFechaVencimientoDate(b);
        if (!fa && !fb) return 0;
        if (!fa) return 1;
        if (!fb) return -1;
        return fb - fa;
      });
    } else if (ord === 'marca_asc') {
      out.sort(function (a, b) {
        var ma = String(a.marca || '').toLowerCase();
        var mb = String(b.marca || '').toLowerCase();
        if (ma !== mb) return ma.localeCompare(mb, 'es');
        return String(a.numeroSerie || '').localeCompare(String(b.numeroSerie || ''), 'es', { numeric: true });
      });
    }
    return out;
  }

  function sortDisponiblesList(list) {
    return sortMfFilteredList(list, disponiblesPanelSearchTerm, getMfFiltros('disponibles'));
  }

  function describeMfFiltrosActivos(tab) {
    var f = getMfFiltros(tab);
    var parts = [];
    if (f.marca) parts.push('Marca: ' + f.marca);
    if (f.vencimiento === 'prox30') parts.push('Vence en 30 días');
    else if (f.vencimiento === 'vencidos') parts.push('Ya vencidos');
    else if (f.vencimiento === 'sin_fecha') parts.push('Sin fecha de vencimiento');
    else if (f.vencimiento === 'rango') {
      var r = 'Vencimiento';
      if (f.vencimientoDesde) r += ' desde ' + formatFechaCampoLocal(f.vencimientoDesde);
      if (f.vencimientoHasta) r += ' hasta ' + formatFechaCampoLocal(f.vencimientoHasta);
      parts.push(r);
    }
    if (f.orden === 'ultimos_agregados') parts.push('Últimos agregados');
    else if (f.orden === 'vencimiento_asc') parts.push('Vencimiento ↑');
    else if (f.orden === 'vencimiento_desc') parts.push('Vencimiento ↓');
    else if (f.orden === 'marca_asc') parts.push('Marca A→Z');
    return parts.join(' · ');
  }

  function describeDisponiblesFiltrosActivos() {
    return describeMfFiltrosActivos('disponibles');
  }

  function hideSearchSuggestions() {
    if (!searchDropdown) return;
    searchDropdown.hidden = true;
    searchDropdown.innerHTML = '';
    searchSuggestIndex = -1;
    if (inputSearch) inputSearch.setAttribute('aria-expanded', 'false');
  }

  /** Con el panel Entregar abierto solo debe verse el buscador estilo Dependencias (no el global de matafuegos). */
  function syncGlobalSearchWrapForEntregaPanel() {
    var open = !!(panelEntregar && panelEntregar.classList.contains('open'));
    if (wrapGlobalMatafuegosSearch) wrapGlobalMatafuegosSearch.style.display = open ? 'none' : '';
    if (open) hideSearchSuggestions();
  }

  function mapEstadoKeyToTab(estadoKey) {
    if (estadoKey === 'recarga') return 'recarga';
    if (estadoKey === 'entregado') return 'entregados';
    if (estadoKey === 'inservible') return 'inservibles';
    if (estadoKey === 'historial') return 'historial';
    return 'disponibles';
  }

  function scrollMfPageTop() {
    try {
      window.scrollTo(0, 0);
    } catch (_) { /* IE / entornos raros */ }
    var dm = document.querySelector('.dashboard-main');
    if (dm) dm.scrollTop = 0;
  }

  function enterMfDetalleListas(opts) {
    if (!matafuegosContentEl) return;
    var was = matafuegosContentEl.classList.contains('mf-detalle-listas');
    matafuegosContentEl.classList.add('mf-detalle-listas');
    if (!was && !(opts && opts.noScroll)) scrollMfPageTop();
  }

  function exitMfDetalleListas() {
    if (!matafuegosContentEl) return;
    clearPanelSearchForTab(activeTabKey);
    matafuegosContentEl.classList.remove('mf-detalle-listas');
    scrollMfPageTop();
  }

  function setActiveTab(tabKey, opts) {
    opts = opts || {};
    var prevTab = activeTabKey;
    var nextTab = tabKey || 'disponibles';
    if (!opts.keepPanelSearch && prevTab !== nextTab) {
      clearPanelSearchForTab(prevTab);
    }
    activeTabKey = nextTab;
    if (panelEntregar) panelEntregar.classList.remove('open');
    if (matafuegosContentEl) matafuegosContentEl.classList.remove('mf-vista-entrega');
    if (mainTabsWrap) mainTabsWrap.style.display = '';
    syncGlobalSearchWrapForEntregaPanel();
    document.querySelectorAll('.matafuegos-tab').forEach(function (btn) {
      var k = btn.getAttribute('data-tab');
      var on = k === activeTabKey;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    [panel, panelRecarga, panelInservibles, panelEntregados, panelHistorial].forEach(function (p) {
      if (!p) return;
      var k = p.getAttribute('data-panel');
      if (k) p.classList.toggle('is-active', k === activeTabKey);
    });
    if (!opts.skipEnterDetail) enterMfDetalleListas();
    renderLista();
    renderListaRecarga();
    renderListaEntregados();
    renderListaInservibles();
    renderHistorialMatafuegos();
  }

  function countProximosVencimientoDisponibles(dias) {
    var list = filterMatafuegos(matafuegosDisponibles, 'disponible');
    var hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    var lim = new Date(hoy);
    lim.setDate(lim.getDate() + (dias || 30));
    var n = 0;
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (!m || !m.fechaVencimiento || isVencidoSinFecha(m.fechaVencimiento)) continue;
      var mmt = String(m.fechaVencimiento).match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (!mmt) continue;
      var fv = new Date(parseInt(mmt[1], 10), parseInt(mmt[2], 10) - 1, parseInt(mmt[3], 10));
      fv.setHours(0, 0, 0, 0);
      if (fv >= hoy && fv <= lim) n++;
    }
    return n;
  }

  function updateMatafuegosAlerts() {
    var elProx = document.getElementById('mf-alert-proximos-text');
    var nProx = countProximosVencimientoDisponibles(30);
    if (elProx) {
      elProx.textContent = nProx === 1
        ? 'Próximo vencimiento: 1 matafuego disponible vence en los próximos 30 días.'
        : 'Próximo vencimiento: ' + nProx + ' matafuegos disponibles vencen en los próximos 30 días.';
    }
  }

  function getPanelSearchTermForEstado(estadoKey) {
    if (estadoKey === 'recarga') return recargaSearchTerm;
    if (estadoKey === 'entregado') return entregadosPanelSearchTerm;
    if (estadoKey === 'inservible') return inserviblesPanelSearchTerm;
    return disponiblesPanelSearchTerm;
  }

  function findIndexInMatafuegoList(items, estadoKey, idStr) {
    var term = getEffectiveMatafuegoSearchTerm(getPanelSearchTermForEstado(estadoKey));
    var list = filterMatafuegosByTerm(items, estadoKey, term);
    for (var i = 0; i < list.length; i++) {
      if ((list[i].id || '') === idStr) return i;
    }
    return -1;
  }

  function ensurePaginationForMatafuegoId(idStr, estadoKey) {
    if (!idStr) return;
    var idx;
    if (estadoKey === 'recarga') {
      idx = findIndexInMatafuegoList(matafuegosRecarga, 'recarga', idStr);
      if (idx >= 0) pagRecarga = Math.floor(idx / PAG_SIZE) + 1;
    } else if (estadoKey === 'entregado') {
      idx = findIndexInMatafuegoList(matafuegosEntregados, 'entregado', idStr);
      if (idx >= 0) pagEntregados = Math.floor(idx / PAG_SIZE) + 1;
    } else if (estadoKey === 'inservible') {
      idx = findIndexInMatafuegoList(matafuegosInservibles, 'inservible', idStr);
      if (idx >= 0) pagInservibles = Math.floor(idx / PAG_SIZE) + 1;
    } else {
      idx = findIndexInMatafuegoList(matafuegosDisponibles, 'disponible', idStr);
      if (idx >= 0) pagDisponible = Math.floor(idx / PAG_SIZE) + 1;
    }
  }

  function syncMfPagSizeSelects() {
    document.querySelectorAll('.mf-pag-size').forEach(function (sel) {
      sel.value = String(PAG_SIZE);
    });
  }

  function buildSearchSuggestionValue(m) {
    if (!m) return '';
    var serie = (m.numeroSerie || '').trim();
    if (serie) return serie;
    var marca = (m.marca || '').trim();
    var car = (m.caracteristicas || '').trim();
    if (marca && car) return (marca + ' ' + car).trim();
    if (marca) return marca;
    return String(m.id || '').trim();
  }

  function estadoSugerenciaLabel(key) {
    if (key === 'recarga') return 'Recarga';
    if (key === 'entregado') return 'Entregado';
    if (key === 'inservible') return 'Inservible';
    return 'Disponible';
  }

  function estadoBadgeClass(key) {
    if (key === 'recarga') return 'matafuegos-sug-badge matafuegos-sug-badge-recarga';
    if (key === 'entregado') return 'matafuegos-sug-badge matafuegos-sug-badge-disponible';
    if (key === 'inservible') return 'matafuegos-sug-badge matafuegos-sug-badge-inservible';
    return 'matafuegos-sug-badge matafuegos-sug-badge-disponible';
  }

  function secondaryLineSug(m, estadoKey) {
    if (estadoKey === 'recarga') {
      var fi = m.fechaIngreso ? formatFechaCampoLocal(m.fechaIngreso) : '—';
      return 'Ingreso: ' + fi + ' · ' + getDepLabel(m.dependenciaId);
    }
    if (estadoKey === 'entregado') {
      var fe = m.fechaIngreso ? formatFechaCampoLocal(m.fechaIngreso) : '—';
      return 'Entrega: ' + fe + ' · ' + getDepLabel(m.dependenciaId);
    }
    return 'Venc.: ' + formatFechaVencimiento(m.fechaVencimiento);
  }

  function collectSearchMatches(limit) {
    var termRaw = matafuegosSearchTerm;
    var term = normalizeText(termRaw);
    if (!term) return [];
    limit = limit || 12;
    var pools = [
      { items: matafuegosDisponibles, estadoKey: 'disponible' },
      { items: matafuegosRecarga, estadoKey: 'recarga' },
      { items: matafuegosEntregados, estadoKey: 'entregado' },
      { items: matafuegosInservibles, estadoKey: 'inservible' }
    ];
    var all = [];
    pools.forEach(function (pool) {
      filterMatafuegos(pool.items, pool.estadoKey).forEach(function (m) {
        all.push({
          m: m,
          estadoKey: pool.estadoKey,
          score: serialMatchScore(m.numeroSerie, termRaw)
        });
      });
    });
    all.sort(function (a, b) {
      if (a.score !== b.score) return a.score - b.score;
      return String(a.m.numeroSerie || '').localeCompare(String(b.m.numeroSerie || ''), 'es', { numeric: true });
    });
    return all.slice(0, limit).map(function (row) {
      return {
        m: row.m,
        estadoKey: row.estadoKey,
        exact: row.score === 0
      };
    });
  }

  function buildMatafuegoSugItemHtml(m, estadoKey, termRaw, extraAttrs) {
    extraAttrs = extraAttrs || '';
    var fill = buildSearchSuggestionValue(m);
    var marca = (m.marca || '—').trim() || '—';
    var serie = (m.numeroSerie || '').trim();
    var exact = isExactSerieSearchMatch(serie, termRaw);
    var cls = 'matafuegos-sug-item' + (exact ? ' matafuegos-sug-exact' : '');
    var line1 = escapeHtmlMf(marca) + ' · Nº ' + escapeHtmlMf(serie || '—');
    if (exact) {
      line1 += ' <span class="matafuegos-sug-exact-tag" aria-label="Coincidencia exacta">✓ Exacto</span>';
    }
    return '<button type="button" class="' + cls + '" role="option" data-fill="' + escapeAttrMf(fill) + '"' + extraAttrs + '>' +
      '<span class="matafuegos-sug-icon" aria-hidden="true">' + (exact ? '✓' : '⏱') + '</span>' +
      '<span class="matafuegos-sug-body">' +
        '<span class="matafuegos-sug-line1">' +
          '<span class="' + estadoBadgeClass(estadoKey) + '">' + escapeHtmlMf(estadoSugerenciaLabel(estadoKey)) + '</span>' +
          '<span>' + line1 + '</span>' +
        '</span>' +
        '<span class="matafuegos-sug-line2">' + escapeHtmlMf(secondaryLineSug(m, estadoKey)) + '</span>' +
      '</span>' +
    '</button>';
  }

  function getSugButtons() {
    if (!searchDropdown) return [];
    return Array.prototype.slice.call(searchDropdown.querySelectorAll('.matafuegos-sug-item'));
  }

  function setSearchSuggestActive(idx) {
    var items = getSugButtons();
    if (!items.length) {
      searchSuggestIndex = -1;
      return;
    }
    var n = idx;
    if (n < 0) n = items.length - 1;
    if (n >= items.length) n = 0;
    searchSuggestIndex = n;
    items.forEach(function (el, i) {
      if (i === n) el.classList.add('matafuegos-sug-active');
      else el.classList.remove('matafuegos-sug-active');
    });
    if (items[n] && items[n].scrollIntoView) items[n].scrollIntoView({ block: 'nearest' });
  }

  function applySearchSuggestion(fill, navegar) {
    if (fill == null || !inputSearch) return;
    var s = String(fill);
    inputSearch.value = s;
    matafuegosSearchTerm = s;
    hideSearchSuggestions();
    pagDisponible = 1;
    pagRecarga = 1;
    pagEntregados = 1;
    pagInservibles = 1;
    var destTab = mapEstadoKeyToTab(navegar && navegar.estadoKey ? navegar.estadoKey : activeTabKey);
    if (navegar && navegar.matafuegoId) {
      clearAllPanelSearches();
      setPanelSearchForTab(destTab, s);
      ensurePaginationForMatafuegoId(String(navegar.matafuegoId), navegar.estadoKey || 'disponible');
    }
    renderLista();
    renderListaRecarga();
    renderListaEntregados();
    renderListaInservibles();
    renderHistorialMatafuegos();
    if (navegar && navegar.matafuegoId) {
      setActiveTab(destTab, { skipEnterDetail: false, keepPanelSearch: true });
      scrollToMatafuegoEnPanel(navegar.matafuegoId, navegar.estadoKey || 'disponible');
    } else {
      try { inputSearch.focus(); } catch (_) {}
    }
  }

  function renderSearchSuggestions() {
    if (!searchDropdown) return;
    var term = normalizeText(matafuegosSearchTerm);
    if (!term) {
      hideSearchSuggestions();
      return;
    }
    var rows = collectSearchMatches(12);
    if (!rows.length) {
      searchDropdown.innerHTML = '<div class="matafuegos-sug-empty" role="option">Sin coincidencias en ningún listado.</div>';
      searchDropdown.hidden = false;
      searchSuggestIndex = -1;
      if (inputSearch) inputSearch.setAttribute('aria-expanded', 'true');
      return;
    }
    searchDropdown.innerHTML = rows.map(function (row) {
      return buildMatafuegoSugItemHtml(row.m, row.estadoKey, matafuegosSearchTerm,
        ' data-id="' + escapeAttrMf(row.m.id || '') + '" data-estado="' + escapeAttrMf(row.estadoKey) + '"');
    }).join('');
    searchDropdown.hidden = false;
    searchSuggestIndex = -1;
    if (inputSearch) inputSearch.setAttribute('aria-expanded', 'true');
    searchDropdown.querySelectorAll('.matafuegos-sug-item').forEach(function (btn) {
      btn.addEventListener('mousedown', function (e) {
        if (e) e.preventDefault();
      });
      btn.addEventListener('click', function () {
        applySearchSuggestion(btn.getAttribute('data-fill') || '', {
          matafuegoId: btn.getAttribute('data-id') || '',
          estadoKey: btn.getAttribute('data-estado') || 'disponible'
        });
      });
    });
  }

  /** Sugerencias inteligentes bajo cada buscador de panel (disponibles, recarga, etc.). */
  function setupPanelMfSearch(inputEl, config) {
    if (!inputEl || inputEl._mfPanelSearchReady) return;
    inputEl._mfPanelSearchReady = true;
    config = config || {};
    var wrap = inputEl.closest('.search-bar');
    var host = wrap ? wrap.parentElement : inputEl.parentElement;
    if (!host) return;
    if (!host.classList.contains('matafuegos-panel-search-host')) {
      host.classList.add('matafuegos-panel-search-host');
      var pos = window.getComputedStyle(host).position;
      if (pos === 'static') host.style.position = 'relative';
    }
    var dd = document.createElement('div');
    dd.className = 'matafuegos-search-suggestions matafuegos-panel-suggestions';
    dd.setAttribute('role', 'listbox');
    dd.setAttribute('aria-label', 'Coincidencias similares');
    dd.hidden = true;
    host.appendChild(dd);

    function hidePanelSug() {
      dd.hidden = true;
      dd.innerHTML = '';
    }

    function renderPanelSug() {
      var term = inputEl.value || '';
      if (!normalizeText(term) || normalizeText(term).length < 2) {
        hidePanelSug();
        return;
      }
      var estadoKey = config.estadoKey || 'disponible';
      var items = typeof config.getItems === 'function' ? config.getItems() : [];
      var matches = sortMatafuegosBySearchRelevance(
        items.filter(function (m) { return matafuegoMatchesTerm(m, estadoKey, term); }),
        term
      ).slice(0, 8);
      if (!matches.length) {
        dd.innerHTML = '<div class="matafuegos-sug-empty" role="option">Sin coincidencias similares.</div>';
        dd.hidden = false;
        return;
      }
      dd.innerHTML = matches.map(function (m) {
        return buildMatafuegoSugItemHtml(m, estadoKey, term, ' data-fill="' + escapeAttrMf(buildSearchSuggestionValue(m)) + '"');
      }).join('');
      dd.hidden = false;
      dd.querySelectorAll('.matafuegos-sug-item').forEach(function (btn) {
        btn.addEventListener('mousedown', function (e) { if (e) e.preventDefault(); });
        btn.addEventListener('click', function () {
          var fill = btn.getAttribute('data-fill') || '';
          inputEl.value = fill;
          hidePanelSug();
          if (typeof config.onPick === 'function') config.onPick(fill);
          else if (typeof config.onInput === 'function') config.onInput();
        });
      });
    }

    inputEl.addEventListener('input', function () {
      if (typeof config.onInput === 'function') config.onInput();
      renderPanelSug();
    });
    inputEl.addEventListener('focus', renderPanelSug);
    inputEl.addEventListener('pointerdown', function () {
      if (window.appUiFocus && window.appUiFocus.focusSearchInput) {
        window.appUiFocus.focusSearchInput(inputEl);
      }
    });
    document.addEventListener('click', function (ev) {
      if (!host.contains(ev.target)) hidePanelSug();
    });
  }

  function setupVencidoSinFechaToggle(inputFecha, checkbox) {
    if (!inputFecha || !checkbox) return;
    function sync() {
      if (checkbox.checked) {
        inputFecha.value = '';
        inputFecha.required = false;
        inputFecha.disabled = true;
      } else {
        inputFecha.disabled = false;
        inputFecha.required = true;
      }
    }
    checkbox.addEventListener('change', sync);
    sync();
  }

  function closeAccionesMenu(container) {
    if (!container) return;
    var dd = container.querySelector('.inv-menu-dropdown');
    if (dd) dd.classList.remove('open');
  }

  function closeAllAccionesMenus() {
    document.querySelectorAll('.inv-acciones-wrap .inv-menu-dropdown.open').forEach(function (dd) {
      dd.classList.remove('open');
    });
  }

  /** Icono de recarga (flechas circulares), coherente con la acción de marcar en recarga. */
  function svgIconoRecargaMf() {
    return (
      '<svg class="mf-btn-recarga-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>' +
      '<path d="M21 3v5h-5"></path>' +
      '<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>' +
      '<path d="M3 21v-5h5"></path>' +
      '</svg>'
    );
  }

  function svgIconoListoRecargaMf() {
    return (
      '<svg class="mf-btn-recarga-listo-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      '<path d="M20 6L9 17l-5-5"></path>' +
      '</svg>'
    );
  }

  function getAccionHtml(matafuegoId) {
    var btnEditar = '<button type="button" class="inv-menu-item btn-editar-matafuego" data-id="' + (matafuegoId || '') + '">Editar</button>';
    var btnEliminar = esAdmin
      ? '<button type="button" class="inv-menu-item inv-menu-eliminar btn-eliminar-matafuego" data-id="' + (matafuegoId || '') + '">Eliminar</button>'
      : '';
    return '' +
      '<div class="inv-acciones-wrap">' +
        '<button type="button" class="btn-menu-inv btn-acciones-matafuego" aria-label="Más acciones" title="Más acciones">⋯</button>' +
        '<div class="inv-menu-dropdown">' + btnEditar + btnEliminar + '</div>' +
      '</div>';
  }

  function findMatafuegoById(id) {
    if (!id) return null;
    var all = (matafuegosDisponibles || []).concat(matafuegosRecarga || [], matafuegosInservibles || []);
    return all.find(function (m) { return (m.id || '') === id; }) || null;
  }

  function editarMatafuego(id) {
    var m = findMatafuegoById(id);
    if (!m) return;
    editMatafuegoId = m.id || null;
    var inputFecha = document.getElementById('editar-vencimiento-matafuego');
    var checkSinFecha = document.getElementById('editar-vencido-sin-fecha-matafuego');
    if (!inputFecha || !checkSinFecha || !modalEditarVencimiento) return;
    var sinFecha = isVencidoSinFecha(m.fechaVencimiento);
    checkSinFecha.checked = sinFecha;
    inputFecha.value = sinFecha ? '' : (m.fechaVencimiento ? String(m.fechaVencimiento).slice(0, 10) : '');
    setupVencidoSinFechaToggle(inputFecha, checkSinFecha);
    prepareAndOpenModal(modalEditarVencimiento);
  }

  function closeModalEditarVencimiento() {
    if (modalEditarVencimiento) modalEditarVencimiento.classList.remove('open');
    if (formEditarVencimiento) formEditarVencimiento.reset();
    editMatafuegoId = null;
    setupVencidoSinFechaToggle(
      document.getElementById('editar-vencimiento-matafuego'),
      document.getElementById('editar-vencido-sin-fecha-matafuego')
    );
  }

  function bindAccionesLista(listaEl, fallbackRenderFn, fallbackArrayName) {
    if (!listaEl) return;
    listaEl.querySelectorAll('.btn-acciones-matafuego').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var wrap = btn.closest('.inv-acciones-wrap');
        if (!wrap) return;
        var dd = wrap.querySelector('.inv-menu-dropdown');
        if (!dd) return;
        var wasOpen = dd.classList.contains('open');
        closeAllAccionesMenus();
        if (!wasOpen) dd.classList.add('open');
      });
    });
    listaEl.querySelectorAll('.btn-eliminar-matafuego').forEach(function (btn) {
      btn.addEventListener('click', function () {
        closeAccionesMenu(btn.closest('.inv-acciones-wrap'));
        var id = btn.getAttribute('data-id');
        if (!id) return;
        if (!esAdmin) {
          mfAlert('Solo un administrador puede eliminar matafuegos.');
          return;
        }
        mfConfirm('¿Estás seguro de que querés eliminar este matafuego? Esta acción no se puede deshacer.', 'Eliminar matafuego').then(function (confirmar) {
          if (!confirmar) return;
          if (typeof window.stockAPI !== 'undefined' && window.stockAPI.deleteMatafuego) {
            if (window.appLoading && window.appLoading.show) window.appLoading.show('Eliminando…');
            window.stockAPI.deleteMatafuego(id).then(loadMatafuegos).catch(function (err) {
              mfAlert(err && err.message ? err.message : 'Error al eliminar');
            }).finally(function () {
              if (window.appLoading && window.appLoading.hide) window.appLoading.hide();
            });
          } else {
            if (fallbackArrayName === 'inservibles') matafuegosInservibles = matafuegosInservibles.filter(function (m) { return m.id !== id; });
            if (fallbackArrayName === 'recarga') matafuegosRecarga = matafuegosRecarga.filter(function (m) { return m.id !== id; });
            if (fallbackArrayName === 'entregados') matafuegosEntregados = matafuegosEntregados.filter(function (m) { return m.id !== id; });
            if (fallbackArrayName === 'disponibles') matafuegosDisponibles = matafuegosDisponibles.filter(function (m) { return m.id !== id; });
            if (fallbackRenderFn) fallbackRenderFn();
          }
        });
      });
    });
    listaEl.querySelectorAll('.btn-editar-matafuego').forEach(function (btn) {
      btn.addEventListener('click', function () {
        closeAccionesMenu(btn.closest('.inv-acciones-wrap'));
        var id = btn.getAttribute('data-id');
        if (!id) return;
        editarMatafuego(id);
      });
    });
  }

  function togglePanelEntregar() {
    if (!panelEntregar) return;
    panelEntregar.classList.toggle('open');
    var open = panelEntregar.classList.contains('open');
    if (matafuegosContentEl) {
      if (open) matafuegosContentEl.classList.add('mf-vista-entrega');
      else matafuegosContentEl.classList.remove('mf-vista-entrega');
    }
    if (open) {
      if (mainTabsWrap) mainTabsWrap.style.display = 'none';
      scrollMfPageTop();
    } else if (mainTabsWrap) {
      mainTabsWrap.style.display = '';
    }
    syncGlobalSearchWrapForEntregaPanel();
  }

  function cerrarPanelEntregar() {
    if (panelEntregar) panelEntregar.classList.remove('open');
    if (matafuegosContentEl) matafuegosContentEl.classList.remove('mf-vista-entrega');
    if (mainTabsWrap) mainTabsWrap.style.display = '';
    clearEntregaMfSeleccion();
    setActiveTab(activeTabKey, { skipEnterDetail: true });
    syncGlobalSearchWrapForEntregaPanel();
  }

  function focusEntregadosPanelSearch() {
    if (!inputEntregadosPanelSearch) return;
    try {
      inputEntregadosPanelSearch.disabled = false;
      inputEntregadosPanelSearch.readOnly = false;
      inputEntregadosPanelSearch.removeAttribute('disabled');
      inputEntregadosPanelSearch.removeAttribute('readonly');
      inputEntregadosPanelSearch.style.pointerEvents = 'auto';
    } catch (_) {}
    if (window.appUiFocus && window.appUiFocus.focusSearchInput) {
      window.appUiFocus.focusSearchInput(inputEntregadosPanelSearch);
    } else if (window.appUiFocus && window.appUiFocus.recover) {
      window.appUiFocus.recover();
      try { inputEntregadosPanelSearch.focus(); } catch (_) {}
    }
  }

  function getEntregaMfSeleccionadosIds() {
    return Object.keys(entregaMfIdsSeleccionados).filter(function (k) { return entregaMfIdsSeleccionados[k]; });
  }

  function isEntregaMfPicked(id) {
    return !!entregaMfIdsSeleccionados[String(id || '')];
  }

  function clearEntregaMfSeleccion() {
    entregaMfIdsSeleccionados = {};
    if (selectEntregaMatafuego) selectEntregaMatafuego.value = '';
    updateEntregaConfirmButtonLabel();
  }

  function pruneEntregaMfSeleccion() {
    if (!matafuegosDisponibles || !matafuegosDisponibles.length) {
      clearEntregaMfSeleccion();
      return;
    }
    Object.keys(entregaMfIdsSeleccionados).forEach(function (id) {
      if (!matafuegosDisponibles.some(function (m) { return String(m.id || '') === id; })) {
        delete entregaMfIdsSeleccionados[id];
      }
    });
  }

  function toggleEntregaMfPicked(id, add) {
    var k = String(id || '');
    if (!k) return;
    if (add === false || (add === undefined && entregaMfIdsSeleccionados[k])) {
      delete entregaMfIdsSeleccionados[k];
    } else {
      entregaMfIdsSeleccionados[k] = true;
    }
    updateEntregaConfirmButtonLabel();
    renderEntregaMatafuegosSeleccion();
  }

  function formatEntregaMfSeleccionResumen() {
    var ids = getEntregaMfSeleccionadosIds();
    if (!ids.length) return { text: '', hidden: true };
    var labels = ids.map(function (id) {
      var mm = (matafuegosDisponibles || []).find(function (x) { return String(x.id || '') === id; });
      return mm ? ((mm.marca || 'Sin marca') + ' — Nº ' + (mm.numeroSerie || '—')) : id;
    });
    if (labels.length === 1) {
      return { text: 'Matafuego elegido: ' + labels[0], hidden: false };
    }
    return { text: labels.length + ' matafuegos elegidos: ' + labels.join(' · '), hidden: false };
  }

  function updateEntregaMfSeleccionResumen(extraSuffix) {
    if (!entregaMfSeleccionResumen) return;
    var info = formatEntregaMfSeleccionResumen();
    if (extraSuffix) info.text = info.text ? info.text + extraSuffix : extraSuffix;
    entregaMfSeleccionResumen.textContent = info.text;
    entregaMfSeleccionResumen.hidden = info.hidden;
  }

  function updateEntregaConfirmButtonLabel() {
    var btn = document.getElementById('btn-confirmar-entrega');
    if (!btn) return;
    var n = getEntregaMfSeleccionadosIds().length;
    btn.textContent = n > 0 ? ('Confirmar entrega (' + n + ')') : 'Confirmar entrega';
  }

  function openPanelMatafuegoEstado(estadoKey) {
    setActiveTab(mapEstadoKeyToTab(estadoKey));
  }

  function scrollToMatafuegoEnPanel(matafuegoId, estadoKey) {
    if (!matafuegoId) return;
    var panelEl = panel;
    if (estadoKey === 'recarga') panelEl = panelRecarga;
    else if (estadoKey === 'entregado') panelEl = panelEntregados;
    else if (estadoKey === 'inservible') panelEl = panelInservibles;
    else panelEl = panel;
    if (!panelEl) return;
    var idStr = String(matafuegoId);
    function run() {
      var tbody = panelEl.querySelector('tbody');
      if (!tbody) return;
      var trs = tbody.querySelectorAll('tr[data-id]');
      var row = null;
      for (var i = 0; i < trs.length; i++) {
        if (trs[i].getAttribute('data-id') === idStr) {
          row = trs[i];
          break;
        }
      }
      if (!row) return;
      if (panelEl.scrollIntoView) panelEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      if (row.scrollIntoView) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      row.classList.add('matafuegos-row-highlight');
      setTimeout(function () {
        row.classList.remove('matafuegos-row-highlight');
      }, 2400);
    }
    setTimeout(run, 400);
  }

  function prepareAndOpenModal(modalEl) {
    if (!modalEl) return;
    if (panelEntregar && panelEntregar.classList.contains('open')) cerrarPanelEntregar();
    if (window.appUiFocus && window.appUiFocus.beforeModal) window.appUiFocus.beforeModal();
    else {
      if (window.appLoading && window.appLoading.hide) window.appLoading.hide();
      if (window.stockAPI && window.stockAPI.focusWindow) window.stockAPI.focusWindow();
    }
    modalEl.classList.add('open');
    focusFirstInputInModal(modalEl);
  }

  function clampMatafuegoCantidad(n) {
    if (n == null || isNaN(n)) return 1;
    if (n < 1) return 1;
    if (n > 100) return 100;
    return n;
  }

  function parseMatafuegoCantidadInput() {
    var inputCantidad = document.getElementById('matafuego-cantidad');
    if (!inputCantidad) return { raw: '', n: null };
    var raw = String(inputCantidad.value || '').trim();
    if (raw === '') return { raw: '', n: null };
    var n = parseInt(raw, 10);
    if (isNaN(n)) return { raw: raw, n: null };
    return { raw: raw, n: n };
  }

  function normalizeMatafuegoCantidadInput() {
    var inputCantidad = document.getElementById('matafuego-cantidad');
    if (!inputCantidad) return 1;
    var n = clampMatafuegoCantidad(parseMatafuegoCantidadInput().n);
    inputCantidad.value = String(n);
    return n;
  }

  function snapshotMatafuegoSeriesValues() {
    var existing = {};
    var container = document.getElementById('matafuego-series-container');
    if (!container) return existing;
    container.querySelectorAll('input[id^="matafuego-serie-"]').forEach(function (inp) {
      var m = /^matafuego-serie-(\d+)$/.exec(inp.id || '');
      if (m) existing[m[1]] = inp.value;
    });
    return existing;
  }

  function renderMatafuegoSeriesInputs(opts) {
    opts = opts || {};
    var container = document.getElementById('matafuego-series-container');
    var inputCantidad = document.getElementById('matafuego-cantidad');
    var hint = document.getElementById('matafuego-series-hint');
    if (!container || !inputCantidad) return;

    var parsed = parseMatafuegoCantidadInput();
    if (parsed.n == null && opts.allowEmptyCantidad) return;

    var n = clampMatafuegoCantidad(parsed.n != null ? parsed.n : matafuegoSeriesRenderCount);
    if (opts.syncCantidadValue) inputCantidad.value = String(n);
    matafuegoSeriesRenderCount = n;

    if (hint) {
      hint.textContent = n === 1
        ? 'Ingresá el número de serie del matafuego.'
        : 'Completá el número de serie de cada unidad (' + n + ' campos).';
    }
    var prevSeries = snapshotMatafuegoSeriesValues();
    container.innerHTML = '';
    for (var i = 0; i < n; i++) {
      var num = i + 1;
      var div = document.createElement('div');
      div.className = 'form-group form-group-inline-serie';
      var val = prevSeries[String(i)] != null ? String(prevSeries[String(i)]) : '';
      var lbl = document.createElement('label');
      lbl.setAttribute('for', 'matafuego-serie-' + i);
      lbl.textContent = 'Nº de serie ' + num;
      var inp = document.createElement('input');
      inp.type = 'text';
      inp.id = 'matafuego-serie-' + i;
      inp.required = true;
      inp.placeholder = 'Ej: ' + num;
      inp.autocomplete = 'off';
      inp.value = val;
      var serieDuplicadaTimer = null;
      function scheduleSerieDuplicadaCheck() {
        if (serieDuplicadaTimer) clearTimeout(serieDuplicadaTimer);
        serieDuplicadaTimer = setTimeout(function () {
          var v = inp.value ? String(inp.value).trim() : '';
          if (v) checkAndShowSerieDuplicada(v);
        }, 450);
      }
      inp.addEventListener('blur', function () {
        var v = inp.value ? String(inp.value).trim() : '';
        if (v) checkAndShowSerieDuplicada(v);
      });
      inp.addEventListener('input', scheduleSerieDuplicadaCheck);
      div.appendChild(lbl);
      div.appendChild(inp);
      container.appendChild(div);
    }
    var btnGuardar = formAgregar ? formAgregar.querySelector('button[type="submit"]') : null;
    if (btnGuardar) {
      btnGuardar.textContent = n > 1 ? ('Guardar ' + n + ' matafuegos') : 'Guardar Matafuego';
    }
  }

  function collectMatafuegoSeriesFromForm() {
    var n = normalizeMatafuegoCantidadInput();
    var series = [];
    for (var i = 0; i < n; i++) {
      var inp = document.getElementById('matafuego-serie-' + i);
      series.push(inp && inp.value ? String(inp.value).trim() : '');
    }
    return series;
  }

  function serieMatchesMatafuego(serie, m) {
    var s = matafuegoSerieCompareKey(serie);
    if (!s || !m) return false;
    return matafuegoSerieCompareKey(m.numeroSerie) === s;
  }

  function findMatafuegoByNumeroSerie(serie) {
    var s = String(serie || '').trim().toLowerCase();
    if (!s) return null;
    var lists = [
      { items: matafuegosDisponibles, estadoKey: 'disponible' },
      { items: matafuegosRecarga, estadoKey: 'recarga' },
      { items: matafuegosEntregados, estadoKey: 'entregado' },
      { items: matafuegosInservibles, estadoKey: 'inservible' }
    ];
    for (var i = 0; i < lists.length; i++) {
      var items = lists[i].items || [];
      for (var j = 0; j < items.length; j++) {
        if (serieMatchesMatafuego(serie, items[j])) {
          return { m: items[j], estadoKey: lists[i].estadoKey };
        }
      }
    }
    return null;
  }

  function getMatafuegoUbicacionTexto(ctx) {
    if (!ctx || !ctx.m) return '—';
    var m = ctx.m;
    var estadoKey = ctx.estadoKey || m.estado || 'disponible';
    if (estadoKey === 'disponible') return 'Disponibles';
    if (estadoKey === 'recarga') {
      return isRecargandoId(m.id) ? 'Para recarga · Recargando' : 'Para recarga · Pendiente';
    }
    if (estadoKey === 'entregado') {
      var dep = getDepLabel(m.dependenciaId);
      return dep && dep !== '—' ? ('Entregados · ' + dep) : 'Entregados';
    }
    if (estadoKey === 'inservible') return 'Inservibles';
    return estadoSugerenciaLabel(estadoKey);
  }

  function buildDuplicadoSerieEntries(series) {
    var entries = [];
    var seen = {};
    for (var i = 0; i < series.length; i++) {
      var serie = String(series[i] || '').trim();
      if (!serie) continue;
      var key = matafuegoSerieCompareKey(serie);
      if (!key || seen[key]) continue;
      var ctx = findMatafuegoByNumeroSerie(serie);
      if (ctx) {
        seen[key] = true;
        entries.push({ serie: serie, m: ctx.m, estadoKey: ctx.estadoKey });
      }
    }
    return entries;
  }

  function renderMfSerieDuplicadaList(entries) {
    if (!mfSerieDuplicadaList) return;
    if (!entries || !entries.length) {
      mfSerieDuplicadaList.innerHTML = '';
      return;
    }
    mfSerieDuplicadaList.innerHTML = entries.map(function (entry) {
      var marca = (entry.m && entry.m.marca) ? String(entry.m.marca).trim() : '—';
      var ubicacion = getMatafuegoUbicacionTexto(entry);
      return '<article class="mf-duplicado-item">' +
        '<p><strong>Nº de serie:</strong> ' + escapeHtmlMf(entry.serie) + '</p>' +
        '<p><strong>Marca registrada:</strong> ' + escapeHtmlMf(marca) + '</p>' +
        '<p><strong>Ubicación actual:</strong> ' + escapeHtmlMf(ubicacion) + '</p>' +
        '</article>';
    }).join('');
  }

  function openModalSerieDuplicada(entries) {
    if (!modalSerieDuplicada || !entries || !entries.length) return;
    renderMfSerieDuplicadaList(entries);
    if (window.appUiFocus && window.appUiFocus.beforeModal) window.appUiFocus.beforeModal();
    modalSerieDuplicada.classList.add('open');
    var btn = modalSerieDuplicada.querySelector('.modal-serie-duplicada-close');
    if (btn && btn.focus) btn.focus();
  }

  function closeModalSerieDuplicada() {
    if (!modalSerieDuplicada) return;
    modalSerieDuplicada.classList.remove('open');
    if (window.appUiFocus && window.appUiFocus.recover) window.appUiFocus.recover();
  }

  function checkAndShowSerieDuplicada(serie) {
    var s = String(serie || '').trim();
    if (!s) return false;
    var ctx = findMatafuegoByNumeroSerie(s);
    if (!ctx) return false;
    openModalSerieDuplicada([{ serie: s, m: ctx.m, estadoKey: ctx.estadoKey }]);
    return true;
  }

  function validateMatafuegoSeriesForAlta(series) {
    if (!series || !series.length) return 'Indicá al menos un número de serie.';
    for (var i = 0; i < series.length; i++) {
      if (!series[i]) return 'Completá el número de serie ' + (i + 1) + '.';
    }
    var seen = {};
    for (var j = 0; j < series.length; j++) {
      var key = matafuegoSerieCompareKey(series[j]);
      if (!key) continue;
      if (seen[key]) return 'El número de serie "' + series[j] + '" está repetido en el formulario.';
      seen[key] = true;
    }
    var duplicados = buildDuplicadoSerieEntries(series);
    if (duplicados.length) return { duplicados: duplicados };
    return null;
  }

  function openModal() {
    var inputCantidad = document.getElementById('matafuego-cantidad');
    matafuegoSeriesRenderCount = 1;
    if (inputCantidad) inputCantidad.value = '1';
    renderMatafuegoSeriesInputs({ syncCantidadValue: true });
    prepareAndOpenModal(modalAgregar);
  }
  function closeModal() {
    if (modalAgregar) modalAgregar.classList.remove('open');
    if (formAgregar) formAgregar.reset();
    var inputCantidad = document.getElementById('matafuego-cantidad');
    matafuegoSeriesRenderCount = 1;
    if (inputCantidad) inputCantidad.value = '1';
    renderMatafuegoSeriesInputs({ syncCantidadValue: true });
    setupVencidoSinFechaToggle(
      document.getElementById('matafuego-vencimiento'),
      document.getElementById('matafuego-vencido-sin-fecha')
    );
  }

  function openModalInservible() {
    prepareAndOpenModal(modalAgregarInservible);
  }
  function closeModalInservible() {
    if (modalAgregarInservible) modalAgregarInservible.classList.remove('open');
    if (formAgregarInservible) formAgregarInservible.reset();
    setupVencidoSinFechaToggle(
      document.getElementById('inservible-vencimiento'),
      document.getElementById('inservible-vencido-sin-fecha')
    );
  }

  /** Igual que Dependencias / Entregas (getDisplayLabel). `depsList` opcional para el árbol filtrado. */
  function getDepDisplayLabelEntrega(dep, depsList) {
    if (!dep) return '';
    var deps = depsList != null ? depsList : (dependencias || []);
    var codigo = (dep.codigo || '').toString().trim();
    var nombre = (dep.nombre || '').toString().trim();
    var numero = (dep.numero || '').toString().trim();
    if (dep.parentId && deps.length) {
      var parent = deps.find(function (d) { return d.id === dep.parentId; });
      if (parent) codigo = (parent.codigo || '').toString().trim();
    }
    if (dep.parentId && numero) return codigo + ' - ' + numero + ' - ' + nombre;
    if (codigo && nombre) return codigo + ' - ' + nombre;
    return nombre || codigo || '—';
  }

  /** Igual que Entregas (depMatchesBusqueda). */
  function depMatchesBusquedaEntrega(dep, busqueda, depsList) {
    if (!busqueda) return true;
    var deps = depsList != null ? depsList : (dependencias || []);
    var parent = dep.parentId ? deps.find(function (d) { return d.id === dep.parentId; }) : null;
    var label = getDepDisplayLabelEntrega(dep, deps).toLowerCase();
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

  /** Coincidencia inteligente para dependencias: exacta, por tokens y con tolerancia a typos. */
  function depSearchScoreEntrega(dep, busquedaRaw, depsList) {
    var qRaw = String(busquedaRaw || '').trim();
    if (!qRaw) return 0;
    var q = normalizeText(qRaw);
    var qCompact = q.replace(/\s+/g, '');
    if (!q) return 0;
    var deps = depsList != null ? depsList : (dependencias || []);
    var parent = dep && dep.parentId ? deps.find(function (d) { return d.id === dep.parentId; }) : null;

    var nombre = normalizeText(dep && dep.nombre);
    var codigo = normalizeText(dep && dep.codigo);
    var numero = normalizeText(dep && dep.numero);
    var label = normalizeText(getDepDisplayLabelEntrega(dep, deps));
    var parentNombre = normalizeText(parent && parent.nombre);
    var parentCodigo = normalizeText(parent && parent.codigo);
    var alias = (codigo && numero) ? (codigo + '-' + numero) : (codigo || numero || '');
    var aliasNorm = alias.replace(/\s+/g, '');

    var fields = [label, nombre, codigo, numero, aliasNorm, parentNombre, parentCodigo];
    for (var i = 0; i < fields.length; i++) {
      if (fields[i] && fields[i] === q) return 0;
    }

    if (label.indexOf(q) >= 0) return dep.parentId ? 1 : 2;
    if (nombre.indexOf(q) >= 0) return dep.parentId ? 2 : 3;
    if (aliasNorm && aliasNorm.indexOf(qCompact) >= 0) return 3;
    if (codigo.indexOf(q) >= 0 || numero.indexOf(q) >= 0) return 4;

    var tokens = q.split(/\s+/).filter(function (t) { return t.length >= 2; });
    if (tokens.length > 1) {
      var allTok = tokens.every(function (tok) {
        return label.indexOf(tok) >= 0 || nombre.indexOf(tok) >= 0 || parentNombre.indexOf(tok) >= 0;
      });
      if (allTok) return dep.parentId ? 5 : 6;
    }

    if (q.length >= 4) {
      var best = 999;
      [label, nombre, parentNombre].forEach(function (f) {
        if (!f) return;
        var d = levenshtein(f, q);
        if (d < best) best = d;
      });
      if (best <= 2) return 10 + best + (dep.parentId ? 0 : 2);
    }
    return 999;
  }

  function escapeRegExpMf(text) {
    return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function highlightEntregaMatch(text, busquedaRaw) {
    var raw = String(text == null ? '' : text);
    var q = String(busquedaRaw || '').trim();
    if (!q) return escapeHtmlMf(raw);
    var tokens = normalizeText(q).split(/\s+/).filter(function (t) { return t.length >= 2; });
    if (!tokens.length) return escapeHtmlMf(raw);
    var html = escapeHtmlMf(raw);
    tokens.sort(function (a, b) { return b.length - a.length; });
    tokens.forEach(function (tok) {
      var rx = new RegExp('(' + escapeRegExpMf(tok) + ')', 'ig');
      html = html.replace(rx, '<span class="dep-match-mark">$1</span>');
    });
    return html;
  }

  function getMainDepsEntregaList(deps) {
    return (deps || []).filter(function (d) { return !d.parentId; });
  }

  function getDivisionesEntregaList(deps, parentId) {
    return (deps || []).filter(function (d) { return d.parentId === parentId; });
  }

  function getDepLabel(depId) {
    if (!depId) return '—';
    var d = dependencias.find(function (x) { return x.id === depId; });
    if (!d) return '—';
    var s = getDepDisplayLabelEntrega(d);
    return s && s !== '' ? s : '—';
  }

  /** Misma UI de árbol que Entregas (guardia.js renderBusquedaDependencias), solo botón Seleccionar. */
  function renderEntregaBusquedaDependenciasGuardia() {
    if (!tbodyEntregaDeps) return;
    var deps = dependenciasParaFormulariosStock();
    var busqueda = (inputEntregaBuscarDep && inputEntregaBuscarDep.value || '').trim().toLowerCase();
    var selId = selectEntregaDep ? String(selectEntregaDep.value || '') : '';

    if (!deps.length) {
      tbodyEntregaDeps.innerHTML = '<tr><td colspan="3" class="empty-state"><p>No hay dependencias. Creá dependencias en Gestión de dependencias.</p></td></tr>';
      return;
    }

    var rows = [];

    function buildAcciones(depId, depLabel) {
      var idStr = depId != null ? String(depId) : '';
      var picked = !!(selId && idStr === selId);
      if (picked) {
        return '<div class="dep-acciones-inline"><span class="matafuegos-entrega-dep-elegida-badge" aria-hidden="true">✓</span><button type="button" class="btn btn-secondary btn-sm matafuegos-entrega-dep-elegida-btn" disabled aria-current="true">Elegida</button></div>';
      }
      return '<div class="dep-acciones-inline"><button type="button" class="btn btn-primary btn-sm btn-matafuegos-entrega-seleccionar" data-id="' + escapeAttrMf(idStr) + '" data-label="' + escapeAttrMf(depLabel) + '">Seleccionar</button></div>';
    }

    function branchMatches(dep) {
      if (depMatchesBusquedaEntrega(dep, busqueda, deps)) return true;
      var children = getDivisionesEntregaList(deps, dep.id);
      for (var i = 0; i < children.length; i++) {
        if (branchMatches(children[i])) return true;
      }
      return false;
    }

    function appendChildren(parent, rootId, level, isVisible, forceShowAllDescendants) {
      var children = getDivisionesEntregaList(deps, parent.id);
      var parentSelfMatches = busqueda ? depMatchesBusquedaEntrega(parent, busqueda, deps) : false;
      var allowAll = !!forceShowAllDescendants || !!parentSelfMatches;
      if (busqueda && !allowAll) {
        children = children.filter(function (c) { return branchMatches(c); });
      }
      children.forEach(function (child, idx) {
        var childLabel = getDepDisplayLabelEntrega(child, deps);
        var childNombre = (child.nombre || '').trim() || '—';
        var hiddenClass = isVisible ? '' : ' row-division-hidden';
        var levelClass = level === 1 ? ' row-nivel-1' : ' row-nivel-2';
        var lastClass = idx === children.length - 1 ? ' row-division-last' : '';
        var indent = 8 + (level * 22);
        var labelTexto = level === 1 ? ('* ' + childLabel) : childLabel;
        var childId = child.id != null ? String(child.id) : '';
        var selClass = (selId && childId === selId) ? ' entrega-dep-row-selected' : '';
        rows.push('<tr class="row-division' + levelClass + hiddenClass + lastClass + selClass + '" data-dep-id="' + escapeAttrMf(childId) + '" data-parent-id="' + escapeAttrMf(parent.id) + '" data-root-id="' + escapeAttrMf(rootId) + '"><td style="padding-left:' + indent + 'px;"><span class="link-dependencia">' + escapeHtmlMf(labelTexto) + '</span></td><td>' + escapeHtmlMf(childNombre) + '</td><td>' + buildAcciones(child.id, childLabel) + '</td></tr>');
        var childSelfMatches = busqueda ? depMatchesBusquedaEntrega(child, busqueda, deps) : false;
        appendChildren(child, rootId, level + 1, isVisible, allowAll || childSelfMatches);
      });
    }

    if (busqueda) {
      var ranked = deps.map(function (d) {
        return { dep: d, score: depSearchScoreEntrega(d, busqueda, deps) };
      }).filter(function (x) { return x.score < 999; });

      ranked.sort(function (a, b) {
        if (a.score !== b.score) return a.score - b.score;
        var al = normalizeText(getDepDisplayLabelEntrega(a.dep, deps));
        var bl = normalizeText(getDepDisplayLabelEntrega(b.dep, deps));
        if (al !== bl) return al.localeCompare(bl, 'es');
        return String(a.dep.id || '').localeCompare(String(b.dep.id || ''));
      });

      if (!ranked.length) {
        rows.push('<tr><td colspan="3" class="empty-state"><p>Ninguna dependencia coincide con &quot;' + escapeHtmlMf((inputEntregaBuscarDep && inputEntregaBuscarDep.value) || '') + '&quot;. Probá con otro nombre o número (ej. D4, 144, 144-1).</p></td></tr>');
      } else {
        var topId = ranked[0] && ranked[0].dep ? String(ranked[0].dep.id || '') : '';
        ranked.slice(0, 40).forEach(function (it) {
          var d = it.dep;
          var depId = d.id != null ? String(d.id) : '';
          var selected = (selId && depId === selId) ? ' entrega-dep-row-selected' : '';
          var topCls = (!selected && topId && depId === topId) ? ' entrega-dep-row-topmatch' : '';
          var label = getDepDisplayLabelEntrega(d, deps);
          var nombre = (d.nombre || '').trim() || '—';
          if (d.parentId) {
            var p = deps.find(function (x) { return String(x.id) === String(d.parentId); });
            if (p) nombre += ' · ' + ((p.nombre || p.codigo || '').toString().trim());
          }
          rows.push('<tr class="main-dep-row' + selected + topCls + '" data-dep-id="' + escapeAttrMf(depId) + '"><td><span class="btn-flecha-dep-placeholder"></span> <span class="link-dependencia">' + highlightEntregaMatch(label, busqueda) + '</span></td><td>' + highlightEntregaMatch(nombre, busqueda) + '</td><td>' + buildAcciones(d.id, label) + '</td></tr>');
        });
      }

      tbodyEntregaDeps.innerHTML = rows.join('');
      tbodyEntregaDeps.querySelectorAll('.btn-matafuegos-entrega-seleccionar').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var id = btn.getAttribute('data-id');
          if (!selectEntregaDep || !id) return;
          selectEntregaDep.value = id;
          expandAncestorsEntregaParaId(id, deps);
          renderEntregaBusquedaDependenciasGuardia();
        });
      });
      if (entregaDepSeleccionResumen) {
        if (selId) {
          var depSel2 = deps.find(function (x) { return String(x.id) === selId; });
          var lab2 = depSel2 ? getDepDisplayLabelEntrega(depSel2, deps) : selId;
          entregaDepSeleccionResumen.textContent = 'Dependencia elegida: ' + lab2;
          entregaDepSeleccionResumen.hidden = false;
        } else {
          entregaDepSeleccionResumen.textContent = '';
          entregaDepSeleccionResumen.hidden = true;
        }
      }
      return;
    }

    var mainDeps = getMainDepsEntregaList(deps);
    var algunaFila = false;

    mainDeps.forEach(function (d) {
      if (busqueda && !branchMatches(d)) return;
      algunaFila = true;
      var label = getDepDisplayLabelEntrega(d, deps);
      var nombre = (d.nombre || '').trim() || '—';
      var children = getDivisionesEntregaList(deps, d.id);
      if (expandedDepIdsEntrega[d.id] == null) expandedDepIdsEntrega[d.id] = false;
      var isExpanded = !!expandedDepIdsEntrega[d.id];
      var arrowClass = isExpanded ? 'arrow-expanded' : 'arrow-collapsed';
      var arrowLabel = isExpanded ? '▼' : '▶';
      var mainId = d.id != null ? String(d.id) : '';
      var selMain = (selId && mainId === selId) ? ' entrega-dep-row-selected' : '';
      var celdaIdentificador = children.length
        ? '<button type="button" class="btn-flecha-dep ' + arrowClass + '" data-id="' + escapeAttrMf(mainId) + '" aria-label="Ver subdivisiones" title="Ver subdivisiones">' + arrowLabel + '</button> <span class="link-dependencia">' + escapeHtmlMf(label) + '</span>'
        : '<span class="btn-flecha-dep-placeholder"></span> <span class="link-dependencia">' + escapeHtmlMf(label) + '</span>';
      rows.push('<tr class="main-dep-row' + selMain + '" data-dep-id="' + escapeAttrMf(mainId) + '"><td>' + celdaIdentificador + '</td><td>' + escapeHtmlMf(nombre) + '</td><td>' + buildAcciones(d.id, label) + '</td></tr>');
      var rootSelfMatches = busqueda ? depMatchesBusquedaEntrega(d, busqueda, deps) : false;
      appendChildren(d, d.id, 1, isExpanded, !!rootSelfMatches);
    });

    if (busqueda && !algunaFila) {
      rows.push('<tr><td colspan="3" class="empty-state"><p>Ninguna dependencia coincide con &quot;' + escapeHtmlMf((inputEntregaBuscarDep && inputEntregaBuscarDep.value) || '') + '&quot;. Probá con otro nombre o número (ej. D4, 144, 144-1).</p></td></tr>');
    }

    tbodyEntregaDeps.innerHTML = rows.join('');

    tbodyEntregaDeps.querySelectorAll('.btn-flecha-dep').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = btn.getAttribute('data-id');
        if (!id) return;
        expandedDepIdsEntrega[id] = !expandedDepIdsEntrega[id];
        var divisionRows = tbodyEntregaDeps.querySelectorAll('tr.row-division[data-root-id="' + id + '"]');
        divisionRows.forEach(function (tr) {
          tr.classList.toggle('row-division-hidden', !expandedDepIdsEntrega[id]);
        });
        var parentRow = btn.closest('tr.main-dep-row');
        if (parentRow) {
          var arrowBtn = parentRow.querySelector('.btn-flecha-dep');
          if (arrowBtn) {
            arrowBtn.textContent = expandedDepIdsEntrega[id] ? '▼' : '▶';
            arrowBtn.classList.toggle('arrow-expanded', expandedDepIdsEntrega[id]);
            arrowBtn.classList.toggle('arrow-collapsed', !expandedDepIdsEntrega[id]);
          }
        }
      });
    });

    tbodyEntregaDeps.querySelectorAll('.btn-matafuegos-entrega-seleccionar').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = btn.getAttribute('data-id');
        if (!selectEntregaDep || !id) return;
        selectEntregaDep.value = id;
        expandAncestorsEntregaParaId(id, deps);
        renderEntregaBusquedaDependenciasGuardia();
        setTimeout(function () {
          var row = tbodyEntregaDeps && tbodyEntregaDeps.querySelector('tr.entrega-dep-row-selected');
          if (row && row.scrollIntoView) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }, 0);
      });
    });

    if (entregaDepSeleccionResumen) {
      if (selId) {
        var depSel = deps.find(function (x) { return String(x.id) === selId; });
        var lab = depSel ? getDepDisplayLabelEntrega(depSel, deps) : selId;
        entregaDepSeleccionResumen.textContent = 'Dependencia elegida: ' + lab;
        entregaDepSeleccionResumen.hidden = false;
      } else {
        entregaDepSeleccionResumen.textContent = '';
        entregaDepSeleccionResumen.hidden = true;
      }
    }
  }

  function expandAncestorsEntregaParaId(depId, deps) {
    if (!depId || !deps || !deps.length) return;
    var idStr = String(depId);
    var d = deps.find(function (x) { return String(x.id) === idStr; });
    while (d && d.parentId) {
      expandedDepIdsEntrega[String(d.parentId)] = true;
      d = deps.find(function (x) { return String(x.id) === String(d.parentId); });
    }
  }

  function formatHistorialUsuario(usuario) {
    var u = String(usuario || '').trim();
    if (!u) return '—';
    if (u.toLowerCase() === 'sistema') return 'Sistema';
    return u;
  }

  function inferHistorialMovimientoFromDetalle(detalle, accion) {
    var d = String(detalle || '').toLowerCase();
    if (d.indexOf('movimiento automático') >= 0 && d.indexOf('recarga') >= 0) return 'Cambio de estado';
    if (d.indexOf('eliminó matafuego') >= 0 || String(accion || '').toUpperCase() === 'ELIMINAR') return 'Eliminación';
    return 'Editado';
  }

  function parseHistorialDetalle(row) {
    var detalle = String((row && row.detalle) || '');
    var fallbackFecha = row && row.fecha;
    var fallbackEntidadId = row && row.entidadId;
    var usuario = formatHistorialUsuario(row && row.usuario);
    if (detalle.indexOf('MATAFUEGO_HIST|') === 0) {
      try {
        var obj = JSON.parse(detalle.slice('MATAFUEGO_HIST|'.length));
        return {
          fecha: obj.fecha || fallbackFecha || '',
          movimiento: String(obj.movimiento || 'editado'),
          marca: obj.marca || '—',
          numeroSerie: obj.numeroSerie || (obj.id || fallbackEntidadId || '—'),
          usuario: usuario
        };
      } catch (_) {}
    }
    return {
      fecha: fallbackFecha || '',
      movimiento: inferHistorialMovimientoFromDetalle(detalle, row && row.accion),
      marca: '—',
      numeroSerie: fallbackEntidadId || '—',
      usuario: usuario
    };
  }

  function labelMovimientoHistorial(key) {
    var k = String(key || '').toLowerCase();
    if (k === 'ingreso') return 'Ingreso';
    if (k === 'egreso') return 'Egreso';
    if (k === 'cambio_estado') return 'Cambio de estado';
    if (k === 'entrega') return 'Entrega';
    if (k === 'actualizacion' || k === 'editado') return 'Editado';
    if (k === 'eliminacion') return 'Eliminación';
    return 'Editado';
  }

  function filterHistorialByPanelSearch(items, term) {
    var t = normalizeText(term || '');
    if (!t) return items.slice();
    return items.filter(function (h) {
      var fechaStr = '';
      try {
        if (h.fecha) fechaStr = new Date(h.fecha).toLocaleString('es-AR');
      } catch (_) {}
      var txt = normalizeText([
        h.fecha || '',
        fechaStr,
        h.movimiento || '',
        labelMovimientoHistorial(h.movimiento),
        h.marca || '',
        h.numeroSerie || '',
        h.usuario || ''
      ].join(' '));
      if (txt.indexOf(t) >= 0) return true;
      if (h.numeroSerie && serialFuzzyMatch(h.numeroSerie, term)) return true;
      return false;
    });
  }

  function renderHistorialMatafuegos() {
    if (!listaHistorial) return;
    var baseHist = historialMatafuegos || [];
    var termHist = normalizeText(historialPanelSearchTerm)
      ? historialPanelSearchTerm
      : (normalizeText(matafuegosSearchTerm) ? matafuegosSearchTerm : '');
    var listHist = filterHistorialByPanelSearch(baseHist, termHist);
    if (contadorHistorial) {
      contadorHistorial.textContent = normalizeText(termHist) ? String(listHist.length) : String(baseHist.length);
    }
    if (!baseHist.length) {
      listaHistorial.innerHTML = '<tr><td colspan="5" class="empty-state">No hay movimientos de matafuegos registrados.</td></tr>';
      var pcHist0 = document.getElementById('pag-matafuegos-historial');
      if (pcHist0) pcHist0.innerHTML = '';
      syncMfPagSizeSelects();
      return;
    }
    if (!listHist.length) {
      listaHistorial.innerHTML = '<tr><td colspan="5" class="empty-state">Sin resultados en el historial.</td></tr>';
      var pcHist1 = document.getElementById('pag-matafuegos-historial');
      if (pcHist1) pcHist1.innerHTML = '';
      syncMfPagSizeSelects();
      return;
    }
    var infoHist = window.Paginacion ? window.Paginacion.paginar(listHist, pagHistorial, PAG_SIZE) : { items: listHist, pagina: 1, totalPaginas: 1, total: listHist.length, inicio: 1, fin: listHist.length };
    pagHistorial = infoHist.pagina;
    listaHistorial.innerHTML = infoHist.items.map(function (h) {
      var fecha = h.fecha ? new Date(h.fecha).toLocaleString('es-AR') : '—';
      return '<tr>' +
        '<td>' + fecha + '</td>' +
        '<td>' + labelMovimientoHistorial(h.movimiento) + '</td>' +
        '<td>' + (h.usuario || '—') + '</td>' +
        '<td>' + (h.marca || '—') + '</td>' +
        '<td>' + (h.numeroSerie || '—') + '</td>' +
        '</tr>';
    }).join('');
    var pcHist = document.getElementById('pag-matafuegos-historial');
    if (pcHist && window.Paginacion) {
      window.Paginacion.renderControles(pcHist, infoHist, function (p) { pagHistorial = p; renderHistorialMatafuegos(); });
    }
    syncMfPagSizeSelects();
  }

  function loadMatafuegos(opts) {
    opts = opts || {};
    var silent = !!opts.silent;
    function fetchAndRender() {
      var loadPromiseFallback = function () {
        return Promise.all([
          window.stockAPI.getData(),
          window.stockAPI.getDependencias ? window.stockAPI.getDependencias() : Promise.resolve([]),
          window.stockAPI.getTxtDependencias ? window.stockAPI.getTxtDependencias() : Promise.resolve([]),
          window.stockAPI.getAuditLog ? window.stockAPI.getAuditLog({ modulo: 'Matafuegos' }) : Promise.resolve([]),
          window.stockAPI.getMatafuegosRecargandoMap ? window.stockAPI.getMatafuegosRecargandoMap() : Promise.resolve({})
        ]).then(function (results) {
          return {
            matafuegos: (results[0] || {}).matafuegos || [],
            dependencias: results[1] || [],
            txtDependencias: results[2] || [],
            auditLog: results[3] || [],
            recargandoMap: results[4] || {}
          };
        });
      };
      var loadPromise = window.invokeStockLightOrFull
        ? window.invokeStockLightOrFull('getMatafuegosData', loadPromiseFallback)
        : loadPromiseFallback();
      loadPromise.then(function (bundle) {
        bundle = bundle || {};
        rebuildTxtDependenciaIdSet(bundle.txtDependencias || []);
        var depsRaw = bundle.dependencias || [];
        dependencias = depsRaw.filter(function (d) { return !dependenciaExcluidaDeFormulariosStock(d, depsRaw); });
        var auditRows = bundle.auditLog || [];
        var recargandoMap = bundle.recargandoMap || {};
        var allMf = bundle.matafuegos || [];
        matafuegosDisponibles = allMf.filter(function (m) { return (m.estado || 'disponible') === 'disponible'; });
        matafuegosRecarga = allMf.filter(function (m) { return (m.estado || '') === 'recarga'; });
        matafuegosEntregados = allMf.filter(function (m) { return (m.estado || '') === 'entregado'; });
        matafuegosInservibles = allMf.filter(function (m) { return (m.estado || '') === 'inservible'; });
        historialMatafuegos = (auditRows || []).map(function (row) {
          return parseHistorialDetalle(row);
        }).filter(function (x) { return !!x; });
        recargandoIds = {};
        Object.keys(recargandoMap || {}).forEach(function (id) {
          if (recargandoMap[id]) recargandoIds[String(id)] = true;
        });
        var recargaIds = {};
        matafuegosRecarga.forEach(function (m) {
          var k = String((m && m.id) || '').trim();
          if (k) recargaIds[k] = true;
        });
        Object.keys(recargandoIds).forEach(function (k) {
          if (!recargaIds[k]) delete recargandoIds[k];
        });
        saveRecargandoIds();
        renderLista();
        renderListaRecarga();
        renderListaEntregados();
        renderListaInservibles();
        renderHistorialMatafuegos();
        renderSearchSuggestions();
        fillDependenciasEntrega();
        fillMatafuegosEntrega();
        updateMatafuegosAlerts();
        MF_FILTER_TAB_KEYS.forEach(function (t) { populateMarcasFiltroSelect(t); });
        updateAllMfFiltrosBtnStates();
        applyMfUrlParams();
      }).catch(function () {
        renderLista();
        renderListaRecarga();
        renderListaEntregados();
        renderListaInservibles();
        renderHistorialMatafuegos();
        renderSearchSuggestions();
        updateMatafuegosAlerts();
        MF_FILTER_TAB_KEYS.forEach(function (t) { populateMarcasFiltroSelect(t); });
        updateAllMfFiltrosBtnStates();
      }).finally(function () {
        if (window.appLoading && window.appLoading.hide) window.appLoading.hide();
      });
    }

    if (typeof window.stockAPI === 'undefined' || !window.stockAPI.getData) {
      renderLista();
      renderListaRecarga();
      renderListaEntregados();
      renderListaInservibles();
      renderHistorialMatafuegos();
      renderSearchSuggestions();
      fillDependenciasEntrega();
      fillMatafuegosEntrega();
      updateMatafuegosAlerts();
      return;
    }
    if (!silent && window.appLoading && window.appLoading.show) window.appLoading.show('Cargando matafuegos…');
    var syncPromise = (window.stockAPI.syncExpiredMatafuegos)
      ? window.stockAPI.syncExpiredMatafuegos().catch(function () { /* no-op */ })
      : Promise.resolve();
    syncPromise.finally(fetchAndRender);
  }

  function renderListaInservibles() {
    if (!listaInservibles) return;
    var termIns = getEffectiveMatafuegoSearchTerm(inserviblesPanelSearchTerm);
    var listInservibles = filterMatafuegosByTerm(matafuegosInservibles, 'inservible', termIns);
    listInservibles = applyMfAdvancedFiltros(listInservibles, getMfFiltros('inservibles'));
    listInservibles = sortMfFilteredList(listInservibles, inserviblesPanelSearchTerm, getMfFiltros('inservibles'));
    if (contadorInservibles) {
      contadorInservibles.textContent = (hasMatafuegoListSearchFilter(inserviblesPanelSearchTerm) || hasMfFiltrosActivos('inservibles'))
        ? listInservibles.length : matafuegosInservibles.length;
    }
    if (listInservibles.length === 0) {
      var insFiltrado = hasMatafuegoListSearchFilter(inserviblesPanelSearchTerm) || hasMfFiltrosActivos('inservibles');
      var insEmpty = !matafuegosInservibles.length
        ? 'No hay matafuegos inservibles registrados.'
        : (insFiltrado ? 'Sin resultados con la búsqueda o filtros aplicados.' : 'No hay matafuegos inservibles registrados.');
      listaInservibles.innerHTML = '<tr><td colspan="5" class="empty-state">' + insEmpty + '</td></tr>';
      var pcIns0 = document.getElementById('pag-matafuegos-inservibles');
      if (pcIns0) pcIns0.innerHTML = '';
      syncMfPagSizeSelects();
      return;
    }
    var infoIns = window.Paginacion ? window.Paginacion.paginar(listInservibles, pagInservibles, PAG_SIZE) : { items: listInservibles, pagina: 1, totalPaginas: 1, total: listInservibles.length, inicio: 1, fin: listInservibles.length };
    pagInservibles = infoIns.pagina;
    listaInservibles.innerHTML = infoIns.items.map(function (m) {
      var venc = formatFechaVencimiento(m.fechaVencimiento);
      return '<tr data-id="' + (m.id || '') + '"' + matafuegoTrClassAttr(m, termIns) + '>' +
        '<td>' + (m.marca || '—') + '</td>' +
        '<td>' + (m.numeroSerie || '—') + '</td>' +
        '<td>' + (m.caracteristicas || '—') + '</td>' +
        '<td>' + venc + '</td>' +
        '<td>' + getAccionHtml(m.id || '') + '</td>' +
        '</tr>';
    }).join('');
    bindAccionesLista(listaInservibles, renderListaInservibles, 'inservibles');

    var pcIns = document.getElementById('pag-matafuegos-inservibles');
    if (pcIns && window.Paginacion) {
      window.Paginacion.renderControles(pcIns, infoIns, function (p) { pagInservibles = p; renderListaInservibles(); });
    }
    syncMfPagSizeSelects();
  }

  function fillDependenciasEntrega() {
    if (!selectEntregaDep) return;
    var current = selectEntregaDep.value;
    var list = dependenciasParaFormulariosStock();
    selectEntregaDep.innerHTML = '<option value="">— Seleccionar dependencia —</option>' + list.map(function (d) {
      var label = getDepLabel(d.id);
      return '<option value="' + (d.id || '') + '">' + (label !== '—' ? label : d.nombre || d.codigo || d.id) + '</option>';
    }).join('');
    if (current && list.some(function (x) { return x.id === current; })) selectEntregaDep.value = current;
    else selectEntregaDep.value = '';
    renderEntregaBusquedaDependenciasGuardia();
  }

  function fillMatafuegosEntrega() {
    pruneEntregaMfSeleccion();
    if (!selectEntregaMatafuego) {
      renderEntregaMatafuegosSeleccion();
      return;
    }
    if (!matafuegosDisponibles || matafuegosDisponibles.length === 0) {
      selectEntregaMatafuego.innerHTML = '<option value="">— No hay matafuegos disponibles —</option>';
      renderEntregaMatafuegosSeleccion();
      return;
    }
    selectEntregaMatafuego.innerHTML = '<option value="">— Seleccionar matafuego disponible —</option>' + matafuegosDisponibles.map(function (m) {
      var label = (m.marca || 'Sin marca') + ' - Nº ' + (m.numeroSerie || '—');
      return '<option value="' + (m.id || '') + '">' + label + '</option>';
    }).join('');
    renderEntregaMatafuegosSeleccion();
  }

  function matafuegoMatchesEntregaBusqueda(m, busquedaRaw) {
    return matafuegoMatchesTerm(m, 'disponible', busquedaRaw);
  }

  function renderEntregaMatafuegosSeleccion() {
    if (!tbodyEntregaMf) return;
    var busqueda = (inputEntregarMfBuscar && inputEntregarMfBuscar.value || '').trim();
    var selIds = getEntregaMfSeleccionadosIds();
    if (!matafuegosDisponibles || !matafuegosDisponibles.length) {
      tbodyEntregaMf.innerHTML = '<tr><td colspan="4" class="empty-state">No hay matafuegos disponibles.</td></tr>';
      updateEntregaMfSeleccionResumen();
      return;
    }
    var list = matafuegosDisponibles.filter(function (m) { return matafuegoMatchesEntregaBusqueda(m, busqueda); });
    if (normalizeText(busqueda)) list = sortMatafuegosBySearchRelevance(list, busqueda);
    if (!list.length) {
      tbodyEntregaMf.innerHTML = '<tr><td colspan="4" class="empty-state">Ningún matafuego coincide con &quot;' + escapeHtmlMf(busqueda) + '&quot;.</td></tr>';
      var fueraFiltro = selIds.length && !selIds.some(function (id) {
        return list.some(function (m) { return String(m.id || '') === id; });
      });
      if (fueraFiltro) {
        updateEntregaMfSeleccionResumen(' (algunos elegidos no aparecen con este filtro; limpiá la búsqueda).');
      } else {
        updateEntregaMfSeleccionResumen();
      }
      return;
    }
    var topMfId = normalizeText(busqueda) && list.length ? String(list[0].id || '') : '';
    tbodyEntregaMf.innerHTML = list.map(function (m) {
      var idStr = String(m.id || '');
      var picked = isEntregaMfPicked(idStr);
      var topCls = (!picked && topMfId && idStr === topMfId) ? ' entrega-mf-row-topmatch' : '';
      var acciones = picked
        ? '<div class="dep-acciones-inline"><span class="matafuegos-entrega-dep-elegida-badge" aria-hidden="true">✓</span><button type="button" class="btn btn-secondary btn-sm btn-matafuegos-entrega-unpick-mf" data-id="' + escapeAttrMf(idStr) + '" aria-current="true">Quitar</button></div>'
        : '<div class="dep-acciones-inline"><button type="button" class="btn btn-primary btn-sm btn-matafuegos-entrega-pick-mf" data-id="' + escapeAttrMf(idStr) + '">Seleccionar</button></div>';
      var rowClass = (picked ? 'entrega-mf-row-selected' : '') + topCls;
      rowClass = rowClass.trim();
      return '<tr' + (rowClass ? (' class="' + rowClass + '"') : '') + ' data-mf-id="' + escapeAttrMf(idStr) + '">' +
        '<td>' + highlightEntregaMatch(m.marca || '—', busqueda) + '</td>' +
        '<td>' + highlightEntregaMatch(m.numeroSerie || '—', busqueda) + '</td>' +
        '<td>' + highlightEntregaMatch(m.caracteristicas || '—', busqueda) + '</td>' +
        '<td>' + acciones + '</td></tr>';
    }).join('');
    tbodyEntregaMf.querySelectorAll('.btn-matafuegos-entrega-pick-mf').forEach(function (btn) {
      btn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        var id = btn.getAttribute('data-id');
        if (!id) return;
        toggleEntregaMfPicked(id, true);
      });
    });
    tbodyEntregaMf.querySelectorAll('.btn-matafuegos-entrega-unpick-mf').forEach(function (btn) {
      btn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        var id = btn.getAttribute('data-id');
        if (!id) return;
        toggleEntregaMfPicked(id, false);
      });
    });
    updateEntregaMfSeleccionResumen();
  }

  function renderListaEntregados() {
    if (!listaEntregados) return;
    var termEnt = getEffectiveMatafuegoSearchTerm(entregadosPanelSearchTerm);
    var listEntregados = filterMatafuegosByTerm(matafuegosEntregados, 'entregado', termEnt);
    listEntregados = applyMfAdvancedFiltros(listEntregados, getMfFiltros('entregados'));
    listEntregados = sortMfFilteredList(listEntregados, entregadosPanelSearchTerm, getMfFiltros('entregados'));
    if (contadorEntregados) {
      contadorEntregados.textContent = (hasMatafuegoListSearchFilter(entregadosPanelSearchTerm) || hasMfFiltrosActivos('entregados'))
        ? listEntregados.length : matafuegosEntregados.length;
    }
    if (listEntregados.length === 0) {
      var entFiltrado = hasMatafuegoListSearchFilter(entregadosPanelSearchTerm) || hasMfFiltrosActivos('entregados');
      var entEmpty = !matafuegosEntregados.length
        ? 'No hay matafuegos entregados registrados.'
        : (entFiltrado ? 'Sin resultados con la búsqueda o filtros aplicados.' : 'No hay matafuegos entregados registrados.');
      listaEntregados.innerHTML = '<tr><td colspan="6" class="empty-state">' + entEmpty + '</td></tr>';
      var pcEnt0 = document.getElementById('pag-matafuegos-entregados');
      if (pcEnt0) pcEnt0.innerHTML = '';
      syncMfPagSizeSelects();
      return;
    }
    var infoEnt = window.Paginacion ? window.Paginacion.paginar(listEntregados, pagEntregados, PAG_SIZE) : { items: listEntregados, pagina: 1, totalPaginas: 1, total: listEntregados.length, inicio: 1, fin: listEntregados.length };
    pagEntregados = infoEnt.pagina;
    listaEntregados.innerHTML = infoEnt.items.map(function (m) {
      var fechaEntrega = m.fechaIngreso ? formatFechaCampoLocal(m.fechaIngreso) : '—';
      return '<tr data-id="' + (m.id || '') + '"' + matafuegoTrClassAttr(m, termEnt) + '>' +
        '<td>' + fechaEntrega + '</td>' +
        '<td>' + getDepLabel(m.dependenciaId) + '</td>' +
        '<td>' + (m.marca || '—') + '</td>' +
        '<td>' + (m.numeroSerie || '—') + '</td>' +
        '<td>' + (m.caracteristicas || '—') + '</td>' +
        '<td>' + getAccionHtml(m.id || '') + '</td>' +
        '</tr>';
    }).join('');
    bindAccionesLista(listaEntregados, renderListaEntregados, 'entregados');

    var pcEnt = document.getElementById('pag-matafuegos-entregados');
    if (pcEnt && window.Paginacion) {
      window.Paginacion.renderControles(pcEnt, infoEnt, function (p) { pagEntregados = p; renderListaEntregados(); });
    }
    syncMfPagSizeSelects();
  }

  function renderListaRecarga() {
    if (!listaRecarga) return;
    var termRec = getEffectiveMatafuegoSearchTerm(recargaSearchTerm);
    var listRecarga = filterMatafuegosByTerm(matafuegosRecarga, 'recarga', termRec);
    listRecarga = applyMfAdvancedFiltros(listRecarga, getMfFiltros('recarga'));
    listRecarga = sortMfFilteredList(listRecarga, recargaSearchTerm, getMfFiltros('recarga'));
    if (contadorRecarga) {
      contadorRecarga.textContent = (hasMatafuegoListSearchFilter(recargaSearchTerm) || hasMfFiltrosActivos('recarga'))
        ? listRecarga.length : matafuegosRecarga.length;
    }
    if (listRecarga.length === 0) {
      var recFiltrado = hasMatafuegoListSearchFilter(recargaSearchTerm) || hasMfFiltrosActivos('recarga');
      var recEmpty = !matafuegosRecarga.length
        ? 'No hay ingresos a recarga registrados.'
        : (recFiltrado ? 'Sin resultados con la búsqueda o filtros aplicados.' : 'No hay ingresos a recarga registrados.');
      listaRecarga.innerHTML = '<tr><td colspan="7" class="empty-state">' + recEmpty + '</td></tr>';
      var pcRec0 = document.getElementById('pag-matafuegos-recarga');
      if (pcRec0) pcRec0.innerHTML = '';
      syncMfPagSizeSelects();
      return;
    }
    var infoRec = window.Paginacion ? window.Paginacion.paginar(listRecarga, pagRecarga, PAG_SIZE) : { items: listRecarga, pagina: 1, totalPaginas: 1, total: listRecarga.length, inicio: 1, fin: listRecarga.length };
    pagRecarga = infoRec.pagina;
    listaRecarga.innerHTML = infoRec.items.map(function (m) {
      var fechaIng = m.fechaIngreso ? formatFechaCampoLocal(m.fechaIngreso) : '—';
      var fechaVenc = formatFechaVencimiento(m.fechaVencimiento);
      var recargando = isRecargandoId(m.id);
      var estadoLabel = recargando ? 'Recargando' : 'Pendiente';
      var btnClass = recargando ? 'mf-btn-recarga-toggle active' : 'mf-btn-recarga-toggle';
      var btnTitle = recargando ? 'Quitar estado recargando' : 'Marcar como en recarga (taller)';
      var btnListo = recargando
        ? '<button type="button" class="mf-btn-recarga-listo btn-recarga-listo" data-id="' + (m.id || '') + '" title="Recarga terminada: pasar a disponible">' +
          svgIconoListoRecargaMf() +
          '<span class="mf-btn-recarga-listo-text">Listo</span>' +
          '</button>'
        : '';
      return '<tr data-id="' + (m.id || '') + '"' + matafuegoTrClassAttr(m, termRec) + '>' +
        '<td>' + (fechaIng) + '</td>' +
        '<td>' + (m.marca || '—') + '</td>' +
        '<td>' + (m.numeroSerie || '—') + '</td>' +
        '<td>' + (m.caracteristicas || '—') + '</td>' +
        '<td>' + fechaVenc + '</td>' +
        '<td><span>' + estadoLabel + '</span></td>' +
        '<td><div class="mf-acciones-recarga-cell">' + btnListo + '<button type="button" class="' + btnClass + '" data-id="' + (m.id || '') + '" title="' + escapeAttrMf(btnTitle) + '" aria-label="' + escapeAttrMf(btnTitle) + '">' + svgIconoRecargaMf() + '</button>' + getAccionHtml(m.id || '') + '</div></td>' +
        '</tr>';
    }).join('');
    listaRecarga.querySelectorAll('.mf-btn-recarga-toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        if (!id) return;
        var nuevo = toggleRecargandoIdLocal(id);
        renderListaRecarga();
        if (window.stockAPI && window.stockAPI.setMatafuegoRecargando) {
          window.stockAPI.setMatafuegoRecargando(id, nuevo).catch(function () {
            setRecargandoIdLocal(id, !nuevo);
            renderListaRecarga();
            mfAlert('No se pudo sincronizar el estado "recargando".');
          });
        }
      });
    });
    listaRecarga.querySelectorAll('.btn-recarga-listo').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        if (!id) return;
        openModalRecargaListoVencimiento(id);
      });
    });
    bindAccionesLista(listaRecarga, renderListaRecarga, 'recarga');

    var pcRec = document.getElementById('pag-matafuegos-recarga');
    if (pcRec && window.Paginacion) {
      window.Paginacion.renderControles(pcRec, infoRec, function (p) { pagRecarga = p; renderListaRecarga(); });
    }
    syncMfPagSizeSelects();
  }

  function openModalRecargaListoVencimiento(id) {
    var m = (matafuegosRecarga || []).find(function (x) { return String((x && x.id) || '') === String(id || ''); });
    if (!m) {
      mfAlert('No se encontró el matafuego en recarga.');
      return;
    }
    recargaListoPendienteId = m.id;
    if (recargaListoResumenEl) {
      recargaListoResumenEl.textContent =
        'Tras la recarga, indicá la nueva fecha de vencimiento. ' +
        (m.marca || 'Sin marca') +
        ' — Nº serie ' +
        (m.numeroSerie || '—') +
        '. El matafuego pasará a disponible.';
    }
    if (inputRecargaListoVenc) {
      inputRecargaListoVenc.min = minFechaMananaIso();
      inputRecargaListoVenc.value = defaultVencimientoPostRecarga(m);
    }
    prepareAndOpenModal(modalRecargaListoVenc);
  }

  function closeModalRecargaListoVencimiento() {
    if (modalRecargaListoVenc) modalRecargaListoVenc.classList.remove('open');
    recargaListoPendienteId = null;
    if (formRecargaListoVenc) formRecargaListoVenc.reset();
  }

  function marcarRecargaComoDisponible(id, opts) {
    opts = opts || {};
    var m = (matafuegosRecarga || []).find(function (x) { return String((x && x.id) || '') === String(id || ''); });
    if (!m) {
      mfAlert('No se encontró el matafuego en recarga.');
      return;
    }
    var fvRaw = opts.fechaVencimiento != null ? String(opts.fechaVencimiento).trim() : '';
    var fechaVencimiento = fvRaw ? fvRaw.slice(0, 10) : (m.fechaVencimiento || null);
    var d = new Date();
    var fechaUltimaRecarga = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    var payload = {
      id: m.id,
      marca: m.marca || null,
      numeroSerie: m.numeroSerie || '',
      caracteristicas: m.caracteristicas || null,
      fechaVencimiento: fechaVencimiento,
      estado: 'disponible',
      fechaIngreso: fechaUltimaRecarga,
      dependenciaId: null
    };
    if (typeof window.stockAPI !== 'undefined' && window.stockAPI.saveMatafuego) {
      if (window.appLoading && window.appLoading.show) window.appLoading.show('Pasando a disponible…');
      window.stockAPI.saveMatafuego(payload).then(function () {
        var k = String(id || '').trim();
        if (k && recargandoIds[k]) {
          delete recargandoIds[k];
          if (window.stockAPI && window.stockAPI.setMatafuegoRecargando) {
            window.stockAPI.setMatafuegoRecargando(k, false).catch(function () {});
          }
        }
        loadMatafuegos();
      }).catch(function (err) {
        mfAlert(err && err.message ? err.message : 'Error al pasar a disponible');
      }).finally(function () {
        if (window.appLoading && window.appLoading.hide) window.appLoading.hide();
      });
    }
  }

  function focusFirstInputInModal(modalEl) {
    if (!modalEl) return;
    function tick() {
      try {
        if (window.stockAPI && window.stockAPI.focusWindow) window.stockAPI.focusWindow();
        else window.focus();
      } catch (_) {}
      var target = modalEl.querySelector('input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])');
      if (target) {
        try { target.disabled = false; } catch (_) {}
        try { target.readOnly = false; } catch (_) {}
        try { target.style.pointerEvents = 'auto'; } catch (_) {}
        if (target.focus) target.focus();
      }
    }
    setTimeout(tick, 0);
    setTimeout(tick, 120);
    setTimeout(tick, 320);
  }
  function renderLista() {
    if (!listaDisponible) return;
    var termDisp = getEffectiveMatafuegoSearchTerm(disponiblesPanelSearchTerm);
    var listDisponibles = filterMatafuegosByTerm(matafuegosDisponibles, 'disponible', termDisp);
    listDisponibles = applyDisponiblesAdvancedFiltros(listDisponibles);
    listDisponibles = sortDisponiblesList(listDisponibles);
    var infoDisp;
    if (listDisponibles.length === 0) {
      var hayBusquedaOFiltro = hasMatafuegoListSearchFilter(disponiblesPanelSearchTerm) || hasDisponiblesFiltrosActivos();
      var dispEmpty = !matafuegosDisponibles.length
        ? 'No hay matafuegos disponibles registrados.'
        : (hayBusquedaOFiltro ? 'Sin resultados con la búsqueda o filtros aplicados.' : 'No hay matafuegos disponibles registrados.');
      listaDisponible.innerHTML = '<tr><td colspan="7" class="empty-state">' + dispEmpty + '</td></tr>';
      var pcDisp0 = document.getElementById('pag-matafuegos-disponible');
      if (pcDisp0) pcDisp0.innerHTML = '';
      syncMfPagSizeSelects();
    } else {
      infoDisp = window.Paginacion ? window.Paginacion.paginar(listDisponibles, pagDisponible, PAG_SIZE) : { items: listDisponibles, pagina: 1, totalPaginas: 1, total: listDisponibles.length, inicio: 1, fin: listDisponibles.length };
      pagDisponible = infoDisp.pagina;
      listaDisponible.innerHTML = infoDisp.items.map(function (m) {
        var inf = inferCapacidadTipo(m.caracteristicas);
        var ultima = m.fechaIngreso ? formatFechaCortaLocal(m.fechaIngreso) : '—';
        var vencTxt = formatFechaCortaLocal(m.fechaVencimiento);
        var vencCell = '<span class="mf-text-venc">' + escapeHtmlMf(vencTxt) + '</span>';
        var tipoHtml = inf.tipo
          ? '<span class="mf-badge-tipo">' + escapeHtmlMf(inf.tipo) + '</span>'
          : '<span class="mf-muted">—</span>';
        return '<tr data-id="' + (m.id || '') + '"' + matafuegoTrClassAttr(m, termDisp) + '>' +
          '<td>' + escapeHtmlMf(m.marca || '—') + '</td>' +
          '<td>' + escapeHtmlMf(m.numeroSerie || '—') + '</td>' +
          '<td>' + escapeHtmlMf(inf.capacidad) + '</td>' +
          '<td>' + tipoHtml + '</td>' +
          '<td>' + escapeHtmlMf(ultima) + '</td>' +
          '<td>' + vencCell + '</td>' +
          '<td>' + getAccionHtml(m.id || '') + '</td>' +
          '</tr>';
      }).join('');
    }
    if (contadorDisponible) {
      var filtrandoDisp = hasMatafuegoListSearchFilter(disponiblesPanelSearchTerm) || hasDisponiblesFiltrosActivos();
      contadorDisponible.textContent = filtrandoDisp ? listDisponibles.length : matafuegosDisponibles.length;
    }
    bindAccionesLista(listaDisponible, renderLista, 'disponibles');

    var pcDisp = document.getElementById('pag-matafuegos-disponible');
    if (pcDisp && window.Paginacion && infoDisp) {
      window.Paginacion.renderControles(pcDisp, infoDisp, function (p) { pagDisponible = p; renderLista(); });
    } else if (pcDisp && !infoDisp) {
      pcDisp.innerHTML = '';
    }
    syncMfPagSizeSelects();
  }

  if (card) {
    card.addEventListener('click', function () { setActiveTab('disponibles'); });
    card.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveTab('disponibles'); } });
  }
  if (cardRecarga) {
    cardRecarga.addEventListener('click', function () { setActiveTab('recarga'); });
    cardRecarga.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveTab('recarga'); } });
  }
  if (cardEntregados) {
    cardEntregados.addEventListener('click', function () { setActiveTab('entregados'); });
    cardEntregados.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveTab('entregados'); } });
  }
  if (cardInservibles) {
    cardInservibles.addEventListener('click', function () { setActiveTab('inservibles'); });
    cardInservibles.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveTab('inservibles'); } });
  }
  if (cardHistorial) {
    cardHistorial.addEventListener('click', function () { setActiveTab('historial'); });
    cardHistorial.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveTab('historial'); } });
  }
  if (btnEntregarHeader) {
    btnEntregarHeader.addEventListener('click', togglePanelEntregar);
    btnEntregarHeader.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePanelEntregar(); }
    });
  }
  document.querySelectorAll('.matafuegos-tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var k = btn.getAttribute('data-tab');
      if (k) setActiveTab(k);
    });
  });
  var alertBtnProx = document.getElementById('mf-alert-btn-proximos');
  if (alertBtnProx) {
    alertBtnProx.addEventListener('click', function () {
      setActiveTab('disponibles');
      var fDisp = getMfFiltros('disponibles');
      fDisp.vencimiento = 'prox30';
      fDisp.marca = '';
      fDisp.orden = '';
      fDisp.vencimientoDesde = '';
      fDisp.vencimientoHasta = '';
      syncMfFiltrosUI('disponibles');
      var drawerDisp = document.querySelector('.mf-filtros-drawer[data-mf-filtros-tab="disponibles"]');
      var btnDisp = document.querySelector('.mf-btn-filtros-tab[data-mf-filtros-tab="disponibles"]');
      if (drawerDisp) {
        drawerDisp.hidden = false;
        if (btnDisp) btnDisp.setAttribute('aria-expanded', 'true');
        populateMarcasFiltroSelect('disponibles');
      }
      pagDisponible = 1;
      renderLista();
    });
  }

  if (btnVolverResumen) {
    btnVolverResumen.addEventListener('click', function () {
      exitMfDetalleListas();
    });
  }
  if (btnVolverEntrega) {
    btnVolverEntrega.addEventListener('click', function () {
      cerrarPanelEntregar();
    });
  }

  var contentPanelEl = document.querySelector('.content-panel');
  if (contentPanelEl) {
    contentPanelEl.addEventListener('change', function (e) {
      var t = e.target;
      if (!t || !t.classList || !t.classList.contains('mf-pag-size')) return;
      var v = parseInt(t.value, 10);
      if (!v || v < 1) return;
      PAG_SIZE = v;
      pagDisponible = 1;
      pagRecarga = 1;
      pagEntregados = 1;
      pagInservibles = 1;
      pagHistorial = 1;
      syncMfPagSizeSelects();
      renderLista();
      renderListaRecarga();
      renderListaEntregados();
      renderListaInservibles();
      renderHistorialMatafuegos();
    });
  }

  function mfFiltroSelectOptionsHtml() {
    return '<option value="">Todos</option>' +
      '<option value="prox30">Próximos 30 días</option>' +
      '<option value="vencidos">Ya vencidos</option>' +
      '<option value="sin_fecha">Sin fecha / vencido sin fecha</option>' +
      '<option value="rango">Rango de fechas…</option>';
  }

  function mfFiltroOrdenOptionsHtml() {
    return '<option value="">Por defecto</option>' +
      '<option value="ultimos_agregados">Últimos agregados</option>' +
      '<option value="vencimiento_asc">Vencimiento más próximo</option>' +
      '<option value="vencimiento_desc">Vencimiento más lejano</option>' +
      '<option value="marca_asc">Marca (A → Z)</option>';
  }

  function buildMfFiltrosDrawerMarkup(tab) {
    return '<div class="matafuegos-toolbar-row mf-filtros-toolbar-injected">' +
      '<button type="button" class="btn btn-secondary btn-sm mf-btn-filtros-tab" data-mf-filtros-tab="' + tab + '" aria-expanded="false">Filtros</button>' +
      '</div>' +
      '<div class="mf-filtros-drawer" data-mf-filtros-tab="' + tab + '" hidden>' +
      '<div class="mf-filtros-grid">' +
      '<div class="mf-filtro-field"><label>Marca</label>' +
      '<select data-mf-filtro="marca" data-mf-filtros-tab="' + tab + '" class="input-select-sm mf-filtro-select"><option value="">Todas las marcas</option></select></div>' +
      '<div class="mf-filtro-field"><label>Vencimiento</label>' +
      '<select data-mf-filtro="vencimiento" data-mf-filtros-tab="' + tab + '" class="input-select-sm mf-filtro-select">' + mfFiltroSelectOptionsHtml() + '</select></div>' +
      '<div class="mf-filtro-field mf-filtro-rango mf-filtro-rango-wrap" data-mf-filtros-tab="' + tab + '" hidden><label>Desde</label>' +
      '<input type="date" data-mf-filtro="vencimientoDesde" data-mf-filtros-tab="' + tab + '" class="input-select-sm mf-filtro-date"></div>' +
      '<div class="mf-filtro-field mf-filtro-rango mf-filtro-rango-hasta-wrap" data-mf-filtros-tab="' + tab + '" hidden><label>Hasta</label>' +
      '<input type="date" data-mf-filtro="vencimientoHasta" data-mf-filtros-tab="' + tab + '" class="input-select-sm mf-filtro-date"></div>' +
      '<div class="mf-filtro-field"><label>Ordenar por</label>' +
      '<select data-mf-filtro="orden" data-mf-filtros-tab="' + tab + '" class="input-select-sm mf-filtro-select">' + mfFiltroOrdenOptionsHtml() + '</select></div>' +
      '</div>' +
      '<div class="mf-filtros-actions">' +
      '<button type="button" class="btn btn-primary btn-sm mf-filtro-aplicar-tab" data-mf-filtros-tab="' + tab + '">Aplicar filtros</button>' +
      '<button type="button" class="btn btn-secondary btn-sm mf-filtro-limpiar-tab" data-mf-filtros-tab="' + tab + '">Limpiar</button>' +
      '<span class="mf-filtros-resumen mf-muted" data-mf-filtros-tab="' + tab + '" aria-live="polite"></span>' +
      '</div></div>';
  }

  function injectMfFiltrosUiForTabs() {
    ['recarga', 'inservibles', 'entregados'].forEach(function (tab) {
      var panel = document.querySelector('.matafuegos-tab-panel[data-panel="' + tab + '"]');
      if (!panel) return;
      var head = panel.querySelector('.matafuegos-tab-head');
      if (!head || head.querySelector('.mf-filtros-drawer[data-mf-filtros-tab="' + tab + '"]')) return;
      var sub = head.querySelector('.matafuegos-tab-sub');
      var wrap = document.createElement('div');
      wrap.className = 'mf-filtros-injected-wrap';
      wrap.innerHTML = buildMfFiltrosDrawerMarkup(tab);
      if (sub && sub.nextSibling) head.insertBefore(wrap, sub.nextSibling);
      else head.appendChild(wrap);
    });
  }

  function mfQueryFiltro(tab, field) {
    return document.querySelector('[data-mf-filtros-tab="' + tab + '"][data-mf-filtro="' + field + '"]');
  }

  function syncMfFiltrosRangoVisibility(tab) {
    var vencEl = mfQueryFiltro(tab, 'vencimiento');
    var show = vencEl && vencEl.value === 'rango';
    document.querySelectorAll('.mf-filtro-rango-wrap[data-mf-filtros-tab="' + tab + '"], .mf-filtro-rango-hasta-wrap[data-mf-filtros-tab="' + tab + '"]').forEach(function (el) {
      el.hidden = !show;
    });
  }

  function populateMarcasFiltroSelect(tab) {
    var sel = mfQueryFiltro(tab, 'marca');
    if (!sel) return;
    var prev = sel.value || '';
    var marcas = getUniqueMarcasFromList(getMfSourceListForTab(tab));
    sel.innerHTML = '<option value="">Todas las marcas</option>' +
      marcas.map(function (marca) {
        return '<option value="' + escapeAttrMf(marca) + '">' + escapeHtmlMf(marca) + '</option>';
      }).join('');
    if (prev && marcas.some(function (m) { return normalizeText(m) === normalizeText(prev); })) {
      sel.value = prev;
    }
  }

  function readMfFiltrosFromUI(tab) {
    var f = getMfFiltros(tab);
    f.marca = (mfQueryFiltro(tab, 'marca') && mfQueryFiltro(tab, 'marca').value || '').trim();
    f.vencimiento = (mfQueryFiltro(tab, 'vencimiento') && mfQueryFiltro(tab, 'vencimiento').value || '').trim();
    f.vencimientoDesde = (mfQueryFiltro(tab, 'vencimientoDesde') && mfQueryFiltro(tab, 'vencimientoDesde').value || '').trim();
    f.vencimientoHasta = (mfQueryFiltro(tab, 'vencimientoHasta') && mfQueryFiltro(tab, 'vencimientoHasta').value || '').trim();
    f.orden = (mfQueryFiltro(tab, 'orden') && mfQueryFiltro(tab, 'orden').value || '').trim();
  }

  function syncMfFiltrosUI(tab) {
    var f = getMfFiltros(tab);
    var marcaEl = mfQueryFiltro(tab, 'marca');
    var vencEl = mfQueryFiltro(tab, 'vencimiento');
    var desdeEl = mfQueryFiltro(tab, 'vencimientoDesde');
    var hastaEl = mfQueryFiltro(tab, 'vencimientoHasta');
    var ordenEl = mfQueryFiltro(tab, 'orden');
    if (marcaEl) marcaEl.value = f.marca || '';
    if (vencEl) vencEl.value = f.vencimiento || '';
    if (desdeEl) desdeEl.value = f.vencimientoDesde || '';
    if (hastaEl) hastaEl.value = f.vencimientoHasta || '';
    if (ordenEl) ordenEl.value = f.orden || '';
    syncMfFiltrosRangoVisibility(tab);
    updateMfFiltrosBtnState(tab);
  }

  function syncDisponiblesFiltrosUI() {
    syncMfFiltrosUI('disponibles');
  }

  function updateMfFiltrosBtnState(tab) {
    var activo = hasMfFiltrosActivos(tab);
    var btn = document.querySelector('.mf-btn-filtros-tab[data-mf-filtros-tab="' + tab + '"]');
    var resumen = document.querySelector('.mf-filtros-resumen[data-mf-filtros-tab="' + tab + '"]');
    if (btn) {
      btn.classList.toggle('has-active-filters', activo);
      btn.textContent = activo ? 'Filtros activos' : 'Filtros';
    }
    if (resumen) resumen.textContent = activo ? describeMfFiltrosActivos(tab) : '';
  }

  function updateDisponiblesFiltrosBtnState() {
    updateMfFiltrosBtnState('disponibles');
  }

  function updateAllMfFiltrosBtnStates() {
    MF_FILTER_TAB_KEYS.forEach(updateMfFiltrosBtnState);
  }

  function resetMfPaginaForTab(tab) {
    if (tab === 'recarga') pagRecarga = 1;
    else if (tab === 'entregados') pagEntregados = 1;
    else if (tab === 'inservibles') pagInservibles = 1;
    else pagDisponible = 1;
  }

  function renderMfTabAfterFiltros(tab) {
    if (tab === 'recarga') renderListaRecarga();
    else if (tab === 'entregados') renderListaEntregados();
    else if (tab === 'inservibles') renderListaInservibles();
    else renderLista();
  }

  function aplicarMfFiltros(tab) {
    readMfFiltrosFromUI(tab);
    resetMfPaginaForTab(tab);
    updateMfFiltrosBtnState(tab);
    renderMfTabAfterFiltros(tab);
  }

  function limpiarMfFiltros(tab) {
    mfTabFiltros[tab] = createEmptyMfFiltros();
    syncMfFiltrosUI(tab);
    resetMfPaginaForTab(tab);
    renderMfTabAfterFiltros(tab);
  }

  function setupMfTabFiltros() {
    injectMfFiltrosUiForTabs();
    document.querySelectorAll('.mf-btn-filtros-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tab = btn.getAttribute('data-mf-filtros-tab');
        if (!tab) return;
        var drawer = document.querySelector('.mf-filtros-drawer[data-mf-filtros-tab="' + tab + '"]');
        if (!drawer) return;
        var abrir = drawer.hidden;
        drawer.hidden = !abrir;
        btn.setAttribute('aria-expanded', abrir ? 'true' : 'false');
        if (abrir) populateMarcasFiltroSelect(tab);
      });
    });
    document.querySelectorAll('[data-mf-filtro="vencimiento"]').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var tab = sel.getAttribute('data-mf-filtros-tab');
        if (tab) syncMfFiltrosRangoVisibility(tab);
      });
    });
    document.querySelectorAll('.mf-filtro-aplicar-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tab = btn.getAttribute('data-mf-filtros-tab');
        if (tab) aplicarMfFiltros(tab);
      });
    });
    document.querySelectorAll('.mf-filtro-limpiar-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tab = btn.getAttribute('data-mf-filtros-tab');
        if (tab) limpiarMfFiltros(tab);
      });
    });
  }

  setupMfTabFiltros();

  function getMatafuegosListForExportTab(tab) {
    if (tab === 'historial') return [];
    var estadoKey = tab === 'recarga' ? 'recarga' : tab === 'entregados' ? 'entregado' : tab === 'inservibles' ? 'inservible' : 'disponible';
    var base = getMfSourceListForTab(tab);
    var term = getMfPanelSearchTermForTab(tab);
    var list = filterMatafuegosByTerm(base, estadoKey, getEffectiveMatafuegoSearchTerm(term));
    list = applyMfAdvancedFiltros(list, getMfFiltros(tab));
    return sortMfFilteredList(list, term, getMfFiltros(tab));
  }

  function buildMatafuegosExportRows(tab, list) {
    return (list || []).map(function (m) {
      var row = {
        Marca: m.marca || '',
        'Nº de serie': m.numeroSerie || '',
        Características: m.caracteristicas || '',
        Vencimiento: m.fechaVencimiento ? formatFechaCampoLocal(m.fechaVencimiento) : '',
        Estado: m.estado || ''
      };
      if (tab === 'entregados') {
        row['Fecha entrega'] = m.fechaIngreso ? formatFechaCampoLocal(m.fechaIngreso) : '';
        row.Dependencia = getDepLabel(m.dependenciaId);
      }
      if (tab === 'recarga') {
        row['Fecha ingreso'] = m.fechaIngreso ? formatFechaCampoLocal(m.fechaIngreso) : '';
      }
      return row;
    });
  }

  function applyMfUrlParams() {
    try {
      var p = new URLSearchParams(window.location.search);
      var mf = p.get('mf');
      if (mf === 'prox30') {
        var f = getMfFiltros('disponibles');
        f.vencimiento = 'prox30';
        f.marca = '';
        f.orden = '';
        f.vencimientoDesde = '';
        f.vencimientoHasta = '';
        setActiveTab('disponibles', { keepPanelSearch: true, skipEnterDetail: false });
        syncMfFiltrosUI('disponibles');
        var drawer = document.querySelector('.mf-filtros-drawer[data-mf-filtros-tab="disponibles"]');
        var btn = document.querySelector('.mf-btn-filtros-tab[data-mf-filtros-tab="disponibles"]');
        if (drawer) drawer.hidden = false;
        if (btn) btn.setAttribute('aria-expanded', 'true');
        renderLista();
      } else if (mf === 'recarga') {
        setActiveTab('recarga', { keepPanelSearch: true });
      }
    } catch (_) {}
  }

  var mfBtnExportExcel = document.getElementById('mf-btn-exportar-excel');
  if (mfBtnExportExcel) {
    mfBtnExportExcel.addEventListener('click', function () {
      var tab = activeTabKey || 'disponibles';
      if (tab === 'historial') {
        mfAlert('El historial no se exporta desde aquí. Usá la pestaña Disponibles, Recarga, Entregados o Inservibles.');
        return;
      }
      var list = getMatafuegosListForExportTab(tab);
      if (!list.length) {
        mfAlert('No hay filas para exportar con la búsqueda y filtros actuales.');
        return;
      }
      var rows = buildMatafuegosExportRows(tab, list);
      var nombres = { disponibles: 'Disponibles', recarga: 'Recarga', entregados: 'Entregados', inservibles: 'Inservibles' };
      var sheetName = nombres[tab] || 'Matafuegos';
      if (!window.stockAPI || !window.stockAPI.exportMatafuegosExcel) {
        mfAlert('Exportación no disponible.');
        return;
      }
      if (window.appLoading && window.appLoading.show) window.appLoading.show('Generando Excel…');
      window.stockAPI.exportMatafuegosExcel({
        rows: rows,
        sheetName: sheetName,
        defaultPath: 'matafuegos-' + tab + '.xlsx'
      }).then(function (r) {
        if (r && r.ok) mfAlert('Archivo guardado correctamente.');
        else if (r && !r.cancelled && r.error) mfAlert(r.error);
      }).catch(function (err) {
        mfAlert(err && err.message ? err.message : 'Error al exportar');
      }).finally(function () {
        if (window.appLoading && window.appLoading.hide) window.appLoading.hide();
      });
    });
  }

  if (btnCerrarEntregar) btnCerrarEntregar.addEventListener('click', cerrarPanelEntregar);
  if (btnAgregar) btnAgregar.addEventListener('click', openModal);
  if (btnAgregarInservible) btnAgregarInservible.addEventListener('click', openModalInservible);
  if (inputSearch) {
    inputSearch.addEventListener('input', function () {
      matafuegosSearchTerm = inputSearch.value || '';
      pagDisponible = 1;
      pagRecarga = 1;
      pagEntregados = 1;
      pagInservibles = 1;
      renderLista();
      renderListaRecarga();
      renderListaEntregados();
      renderListaInservibles();
      renderSearchSuggestions();
    });
    inputSearch.addEventListener('focus', function () {
      renderSearchSuggestions();
    });
    inputSearch.addEventListener('keydown', function (ev) {
      if (!searchDropdown || searchDropdown.hidden) return;
      if (ev.key === 'Escape') {
        hideSearchSuggestions();
        return;
      }
      var items = getSugButtons();
      if (!items.length) return;
      if (ev.key === 'ArrowDown') {
        ev.preventDefault();
        setSearchSuggestActive(searchSuggestIndex < 0 ? 0 : searchSuggestIndex + 1);
      } else if (ev.key === 'ArrowUp') {
        ev.preventDefault();
        setSearchSuggestActive(searchSuggestIndex < 0 ? items.length - 1 : searchSuggestIndex - 1);
      } else if (ev.key === 'Enter' && searchSuggestIndex >= 0 && searchSuggestIndex < items.length) {
        ev.preventDefault();
        var activeBtn = items[searchSuggestIndex];
        applySearchSuggestion(activeBtn.getAttribute('data-fill') || '', {
          matafuegoId: activeBtn.getAttribute('data-id') || '',
          estadoKey: activeBtn.getAttribute('data-estado') || 'disponible'
        });
      }
    });
  }
  setupPanelMfSearch(inputRecargaSearch, {
    estadoKey: 'recarga',
    getItems: function () { return matafuegosRecarga; },
    onInput: function () {
      recargaSearchTerm = inputRecargaSearch.value || '';
      pagRecarga = 1;
      renderListaRecarga();
    },
    onPick: function (fill) {
      recargaSearchTerm = fill;
      pagRecarga = 1;
      renderListaRecarga();
    }
  });
  setupPanelMfSearch(inputDisponiblesPanelSearch, {
    estadoKey: 'disponible',
    getItems: function () { return matafuegosDisponibles; },
    onInput: function () {
      disponiblesPanelSearchTerm = inputDisponiblesPanelSearch.value || '';
      pagDisponible = 1;
      renderLista();
    },
    onPick: function (fill) {
      disponiblesPanelSearchTerm = fill;
      pagDisponible = 1;
      renderLista();
    }
  });
  setupPanelMfSearch(inputInserviblesPanelSearch, {
    estadoKey: 'inservible',
    getItems: function () { return matafuegosInservibles; },
    onInput: function () {
      inserviblesPanelSearchTerm = inputInserviblesPanelSearch.value || '';
      pagInservibles = 1;
      renderListaInservibles();
    },
    onPick: function (fill) {
      inserviblesPanelSearchTerm = fill;
      pagInservibles = 1;
      renderListaInservibles();
    }
  });
  setupPanelMfSearch(inputEntregadosPanelSearch, {
    estadoKey: 'entregado',
    getItems: function () { return matafuegosEntregados; },
    onInput: function () {
      entregadosPanelSearchTerm = inputEntregadosPanelSearch.value || '';
      pagEntregados = 1;
      renderListaEntregados();
    },
    onPick: function (fill) {
      entregadosPanelSearchTerm = fill;
      pagEntregados = 1;
      renderListaEntregados();
    }
  });
  setupPanelMfSearch(inputHistorialPanelSearch, {
    estadoKey: 'disponible',
    getItems: function () {
      return (historialMatafuegos || []).map(function (h) {
        return {
          id: h.numeroSerie || h.fecha,
          marca: h.marca,
          numeroSerie: h.numeroSerie,
          caracteristicas: labelMovimientoHistorial(h.movimiento)
        };
      });
    },
    onInput: function () {
      historialPanelSearchTerm = inputHistorialPanelSearch.value || '';
      pagHistorial = 1;
      renderHistorialMatafuegos();
    },
    onPick: function (fill) {
      historialPanelSearchTerm = fill;
      pagHistorial = 1;
      renderHistorialMatafuegos();
    }
  });
  if (inputEntregarMfBuscar) {
    inputEntregarMfBuscar.addEventListener('input', function () {
      renderEntregaMatafuegosSeleccion();
    });
    inputEntregarMfBuscar.addEventListener('change', function () {
      renderEntregaMatafuegosSeleccion();
    });
  }
  if (btnSearchClear) {
    btnSearchClear.addEventListener('click', function () {
      matafuegosSearchTerm = '';
      if (inputSearch) {
        inputSearch.value = '';
        inputSearch.focus();
      }
      pagDisponible = 1;
      pagRecarga = 1;
      pagEntregados = 1;
      pagInservibles = 1;
      renderLista();
      renderListaRecarga();
      renderListaEntregados();
      renderListaInservibles();
      hideSearchSuggestions();
    });
  }

  document.addEventListener('click', function (ev) {
    if (!searchCombo || !searchDropdown) return;
    if (searchDropdown.hidden) return;
    var t = ev.target;
    if (!t || searchCombo.contains(t)) return;
    hideSearchSuggestions();
  });

  if (inputEntregaBuscarDep) {
    inputEntregaBuscarDep.addEventListener('input', renderEntregaBusquedaDependenciasGuardia);
    inputEntregaBuscarDep.addEventListener('change', renderEntregaBusquedaDependenciasGuardia);
  }
  document.querySelectorAll('.modal-agregar-inservible-close').forEach(function (el) {
    el.addEventListener('click', closeModalInservible);
  });
  if (modalAgregarInservible) {
    modalAgregarInservible.addEventListener('click', function (e) { if (e.target === modalAgregarInservible) closeModalInservible(); });
  }
  document.querySelectorAll('.modal-editar-vencimiento-close').forEach(function (el) {
    el.addEventListener('click', closeModalEditarVencimiento);
  });
  if (modalEditarVencimiento) {
    modalEditarVencimiento.addEventListener('click', function (e) { if (e.target === modalEditarVencimiento) closeModalEditarVencimiento(); });
  }
  document.querySelectorAll('.modal-recarga-listo-close').forEach(function (el) {
    el.addEventListener('click', closeModalRecargaListoVencimiento);
  });
  if (modalRecargaListoVenc) {
    modalRecargaListoVenc.addEventListener('click', function (e) {
      if (e.target === modalRecargaListoVenc) closeModalRecargaListoVencimiento();
    });
  }
  if (formRecargaListoVenc) {
    formRecargaListoVenc.addEventListener('submit', function (e) {
      e.preventDefault();
      var idToSave = recargaListoPendienteId;
      if (!idToSave) return;
      var val = inputRecargaListoVenc ? inputRecargaListoVenc.value.trim() : '';
      if (!val) {
        mfAlert('Elegí una fecha de vencimiento.');
        return;
      }
      var v = parseIsoYmdLocalDate(val);
      if (!v) {
        mfAlert('La fecha no es válida.');
        return;
      }
      var hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      if (v.getTime() <= hoy.getTime()) {
        mfAlert('La fecha de vencimiento debe ser posterior a hoy.');
        return;
      }
      closeModalRecargaListoVencimiento();
      marcarRecargaComoDisponible(idToSave, { fechaVencimiento: val.slice(0, 10) });
    });
  }
  document.addEventListener('click', closeAllAccionesMenus);

  document.querySelectorAll('.modal-agregar-matafuego-close').forEach(function (el) {
    el.addEventListener('click', closeModal);
  });
  document.querySelectorAll('.modal-serie-duplicada-close').forEach(function (el) {
    el.addEventListener('click', closeModalSerieDuplicada);
  });
  if (modalSerieDuplicada) {
    modalSerieDuplicada.addEventListener('click', function (e) {
      if (e.target === modalSerieDuplicada) closeModalSerieDuplicada();
    });
  }
  var inservibleSerieInput = document.getElementById('inservible-serie');
  if (inservibleSerieInput) {
    inservibleSerieInput.addEventListener('blur', function () {
      var v = inservibleSerieInput.value ? String(inservibleSerieInput.value).trim() : '';
      if (v) checkAndShowSerieDuplicada(v);
    });
  }

  if (formEntregar) {
    formEntregar.addEventListener('submit', function (e) {
      e.preventDefault();
      var depId = selectEntregaDep ? selectEntregaDep.value : '';
      var mfIds = getEntregaMfSeleccionadosIds();
      if (!depId || !mfIds.length) {
        mfAlert('Seleccioná una dependencia y al menos un matafuego disponible.');
        return;
      }
      var hoy = new Date().toISOString().slice(0, 10);
      var depLabel = getDepLabel(depId);
      var pendientes = mfIds.map(function (mfId) {
        var m = matafuegosDisponibles.find(function (x) { return String(x.id || '') === String(mfId || ''); });
        if (!m) return null;
        return {
          id: m.id,
          marca: m.marca || null,
          numeroSerie: m.numeroSerie || '',
          caracteristicas: m.caracteristicas || null,
          fechaVencimiento: m.fechaVencimiento || null,
          estado: 'entregado',
          fechaIngreso: hoy,
          dependenciaId: depId || null
        };
      }).filter(Boolean);
      if (!pendientes.length) {
        mfAlert('No se encontraron los matafuegos seleccionados.');
        return;
      }
      if (typeof window.stockAPI === 'undefined' || !window.stockAPI.saveMatafuego) return;

      if (window.appLoading && window.appLoading.show) {
        window.appLoading.show('Registrando ' + pendientes.length + ' entrega(s)…');
      }
      var ok = 0;
      var errores = [];
      var chain = Promise.resolve();
      pendientes.forEach(function (payload) {
        chain = chain.then(function () {
          return window.stockAPI.saveMatafuego(payload).then(function () {
            ok++;
          }).catch(function (err) {
            var serie = payload.numeroSerie || payload.id || '?';
            errores.push('Nº ' + serie + ': ' + (err && err.message ? err.message : 'Error'));
          });
        });
      });
      chain.then(function () {
        clearEntregaMfSeleccion();
        if (formEntregar) formEntregar.reset();
        fillMatafuegosEntrega();
        renderEntregaBusquedaDependenciasGuardia();
        if (window.appLoading && window.appLoading.hide) window.appLoading.hide();
        if (ok > 0) cerrarPanelEntregar();
        if (errores.length) {
          mfAlert('Entregas registradas: ' + ok + ' de ' + pendientes.length + '.\n\nErrores:\n' + errores.join('\n'));
        } else if (ok > 0) {
          mfAlert('Se registraron ' + ok + ' entrega(s) a ' + depLabel + '.');
        }
        if (window.appLoading && window.appLoading.hide) window.appLoading.hide();
        if (ok > 0) {
          loadMatafuegos({ silent: true });
          setTimeout(function () {
            openPanelMatafuegoEstado('entregado');
            syncGlobalSearchWrapForEntregaPanel();
            focusEntregadosPanelSearch();
          }, 250);
          setTimeout(focusEntregadosPanelSearch, 500);
        } else if (window.appUiFocus && window.appUiFocus.recover) {
          window.appUiFocus.recover();
        }
      }).finally(function () {
        if (window.appLoading && window.appLoading.hide) window.appLoading.hide();
      });
    });
  }

  var inputMatafuegoCantidad = document.getElementById('matafuego-cantidad');
  if (inputMatafuegoCantidad) {
    inputMatafuegoCantidad.addEventListener('input', function () {
      renderMatafuegoSeriesInputs({ allowEmptyCantidad: true });
    });
    inputMatafuegoCantidad.addEventListener('change', function () {
      normalizeMatafuegoCantidadInput();
      renderMatafuegoSeriesInputs({ syncCantidadValue: true });
    });
    inputMatafuegoCantidad.addEventListener('blur', function () {
      normalizeMatafuegoCantidadInput();
      renderMatafuegoSeriesInputs({ syncCantidadValue: true });
    });
  }

  if (formAgregar) {
    formAgregar.addEventListener('submit', function (e) {
      e.preventDefault();
      var marca = document.getElementById('matafuego-marca').value.trim();
      var series = collectMatafuegoSeriesFromForm();
      var caracteristicas = document.getElementById('matafuego-caracteristicas').value.trim();
      var fechaVencimientoInput = document.getElementById('matafuego-vencimiento');
      var checkVencidoSinFecha = document.getElementById('matafuego-vencido-sin-fecha');
      var vencidoSinFecha = !!(checkVencidoSinFecha && checkVencidoSinFecha.checked);
      var fechaVencimiento = vencidoSinFecha ? VENCIDO_SIN_FECHA_SENTINEL : ((fechaVencimientoInput && fechaVencimientoInput.value) || null);
      if (!marca) return;
      var errSeries = validateMatafuegoSeriesForAlta(series);
      if (typeof errSeries === 'string') {
        mfAlert(errSeries);
        return;
      }
      if (errSeries && errSeries.duplicados && errSeries.duplicados.length) {
        openModalSerieDuplicada(errSeries.duplicados);
        return;
      }
      var baseId = Date.now();
      var payloads = series.map(function (numeroSerie, idx) {
        return {
          id: String(baseId) + '-' + idx,
          marca: marca,
          numeroSerie: numeroSerie,
          caracteristicas: caracteristicas || null,
          fechaVencimiento: fechaVencimiento || null,
          estado: 'disponible'
        };
      });
      if (typeof window.stockAPI !== 'undefined' && window.stockAPI.saveMatafuego) {
        if (window.appLoading && window.appLoading.show) {
          window.appLoading.show(payloads.length > 1 ? ('Guardando ' + payloads.length + ' matafuegos…') : 'Guardando matafuego…');
        }
        var ok = 0;
        var errores = [];
        var chain = Promise.resolve();
        payloads.forEach(function (payload) {
          chain = chain.then(function () {
            return window.stockAPI.saveMatafuego(payload).then(function () {
              ok++;
            }).catch(function (err) {
              var serie = payload.numeroSerie || payload.id || '?';
              var msg = err && err.message ? String(err.message) : '';
              if (msg.indexOf('número de serie ya está') >= 0) {
                checkAndShowSerieDuplicada(serie);
                errores.push('Nº ' + serie + ': ya está registrado');
              } else {
                errores.push('Nº ' + serie + ': ' + (msg || 'Error'));
              }
            });
          });
        });
        chain.then(function () {
          if (errores.length) {
            mfAlert('Guardados: ' + ok + ' de ' + payloads.length + '.\n\nErrores:\n' + errores.join('\n'));
          }
          if (ok > 0) {
            closeModal();
            loadMatafuegos();
          }
          if (window.appUiFocus && window.appUiFocus.recover) window.appUiFocus.recover();
        }).finally(function () {
          if (window.appLoading && window.appLoading.hide) window.appLoading.hide();
        });
      } else {
        for (var pi = 0; pi < payloads.length; pi++) {
          if (checkAndShowSerieDuplicada(payloads[pi].numeroSerie)) return;
        }
        payloads.forEach(function (payload) {
          matafuegosDisponibles.unshift(payload);
        });
        renderLista();
        closeModal();
      }
    });
  }

  if (formAgregarInservible) {
    formAgregarInservible.addEventListener('submit', function (e) {
      e.preventDefault();
      var marca = document.getElementById('inservible-marca').value.trim();
      var numeroSerie = document.getElementById('inservible-serie').value.trim();
      var caracteristicas = document.getElementById('inservible-caracteristicas').value.trim();
      var fechaVencimientoInput = document.getElementById('inservible-vencimiento');
      var checkVencidoSinFecha = document.getElementById('inservible-vencido-sin-fecha');
      var vencidoSinFecha = !!(checkVencidoSinFecha && checkVencidoSinFecha.checked);
      var fechaVencimiento = vencidoSinFecha ? VENCIDO_SIN_FECHA_SENTINEL : ((fechaVencimientoInput && fechaVencimientoInput.value) || null);
      if (!marca || !numeroSerie) return;
      if (checkAndShowSerieDuplicada(numeroSerie)) return;
      var payload = {
        marca: marca,
        numeroSerie: numeroSerie,
        caracteristicas: caracteristicas || null,
        fechaVencimiento: fechaVencimiento || null,
        estado: 'inservible'
      };
      if (typeof window.stockAPI !== 'undefined' && window.stockAPI.saveMatafuego) {
        if (window.appLoading && window.appLoading.show) window.appLoading.show('Guardando matafuego inservible…');
        window.stockAPI.saveMatafuego(payload).then(function () {
          closeModalInservible();
          loadMatafuegos();
        }).catch(function (err) {
          var msg = err && err.message ? String(err.message) : '';
          if (msg.indexOf('número de serie ya está') >= 0 && checkAndShowSerieDuplicada(numeroSerie)) return;
          mfAlert(msg || 'Error al guardar');
        }).finally(function () {
          if (window.appLoading && window.appLoading.hide) window.appLoading.hide();
        });
      } else {
        if (checkAndShowSerieDuplicada(numeroSerie)) return;
        payload.id = Date.now().toString();
        matafuegosInservibles.unshift(payload);
        renderListaInservibles();
        closeModalInservible();
      }
    });
  }

  if (formEditarVencimiento) {
    formEditarVencimiento.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!editMatafuegoId) return;
      var m = findMatafuegoById(editMatafuegoId);
      if (!m) return;
      var inputFecha = document.getElementById('editar-vencimiento-matafuego');
      var checkSinFecha = document.getElementById('editar-vencido-sin-fecha-matafuego');
      var sinFecha = !!(checkSinFecha && checkSinFecha.checked);
      var fechaVencimiento = sinFecha ? VENCIDO_SIN_FECHA_SENTINEL : ((inputFecha && inputFecha.value) || null);
      var payload = {
        id: m.id,
        marca: m.marca || null,
        numeroSerie: m.numeroSerie || '',
        caracteristicas: m.caracteristicas || null,
        fechaVencimiento: fechaVencimiento || null,
        estado: m.estado || 'disponible',
        fechaIngreso: m.fechaIngreso || null,
        dependenciaId: m.dependenciaId || null
      };
      if (typeof window.stockAPI !== 'undefined' && window.stockAPI.saveMatafuego) {
        if (window.appLoading && window.appLoading.show) window.appLoading.show('Guardando cambios…');
        window.stockAPI.saveMatafuego(payload).then(function () {
          closeModalEditarVencimiento();
          loadMatafuegos();
        }).catch(function (err) {
          mfAlert(err && err.message ? err.message : 'Error al guardar cambios');
        }).finally(function () {
          if (window.appLoading && window.appLoading.hide) window.appLoading.hide();
        });
      } else {
        closeModalEditarVencimiento();
        loadMatafuegos();
      }
    });
  }

  window._realtimeRefresh = function (table) {
    if (!table || table === 'matafuegos') loadMatafuegos();
  };

  setupVencidoSinFechaToggle(
    document.getElementById('matafuego-vencimiento'),
    document.getElementById('matafuego-vencido-sin-fecha')
  );
  renderMatafuegoSeriesInputs({ syncCantidadValue: true });
  setupVencidoSinFechaToggle(
    document.getElementById('inservible-vencimiento'),
    document.getElementById('inservible-vencido-sin-fecha')
  );
  setupVencidoSinFechaToggle(
    document.getElementById('editar-vencimiento-matafuego'),
    document.getElementById('editar-vencido-sin-fecha-matafuego')
  );
  loadRecargandoIds();
  setActiveTab('disponibles', { skipEnterDetail: true });

  if (window.stockAPI && window.stockAPI.getAuthStatus) {
    window.stockAPI.getAuthStatus().then(function (r) {
      esAdmin = ((r && r.rol ? r.rol : 'usuario').toString().toLowerCase() === 'admin');
      loadMatafuegos();
    }).catch(function () {
      esAdmin = false;
      loadMatafuegos();
    });
  } else {
    loadMatafuegos();
  }
})();
