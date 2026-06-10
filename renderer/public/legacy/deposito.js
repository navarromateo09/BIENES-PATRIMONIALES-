(function () {
  'use strict';

  var data = { movimientos: [] };
  var esAdmin = false;
  var pagInventario = 1;
  var PAG_SIZE = (window.Paginacion && window.Paginacion.DEFAULT_POR_PAGINA) || 50;

  var lista = document.getElementById('lista-deposito-inventario');
  var tarjetasGrid = document.getElementById('deposito-tarjetas-grid');
  var btnVerTodos = document.getElementById('btn-deposito-ver-todos');
  var inputBuscar = document.getElementById('buscar-deposito-inventario');
  var btnAgregar = document.getElementById('btn-agregar-deposito');
  var filtroGrupoKey = null;
  var DEP_CARD_COLORS = ['mf-metric--green', 'mf-metric--blue', 'mf-metric--orange', 'mf-metric--violet', 'mf-metric--red'];
  var btnExportar = document.getElementById('btn-exportar-deposito');
  var modalAgregar = document.getElementById('modal-agregar-deposito');
  var formAgregar = document.getElementById('form-agregar-deposito');
  var modalEditar = document.getElementById('modal-editar-deposito');
  var formEditar = document.getElementById('form-editar-deposito');

  function escapeHtml(text) {
    if (text == null) return '';
    var div = document.createElement('div');
    div.textContent = String(text);
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

  function canEdit() { return esAdmin === true; }
  function canDelete() { return esAdmin === true; }

  function toLocalDatetimeValue(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      var pad = function (n) { return String(n).padStart(2, '0'); };
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    } catch (_) { return ''; }
  }

  function fromLocalDatetimeValue(val) {
    if (!val) return new Date().toISOString();
    try {
      return new Date(val).toISOString();
    } catch (_) {
      return new Date().toISOString();
    }
  }

  function grupoKey(m) {
    var nombre = (m.nombre || '').toString().trim().toLowerCase();
    var marca = (m.marca || '').toString().trim().toLowerCase();
    return nombre + '|' + marca;
  }

  function getEntradasConSalidas() {
    var movimientos = data.movimientos || [];
    var entradas = movimientos.filter(function (m) { return m && m.tipo === 'entrada'; });
    var salidas = movimientos.filter(function (m) { return m && m.tipo === 'salida'; });
    var salidasPorEntrada = {};
    salidas.forEach(function (s) {
      var eid = s.entradaId;
      if (eid) salidasPorEntrada[eid] = (salidasPorEntrada[eid] || 0) + (parseInt(s.cantidad, 10) || 0);
    });
    entradas.sort(function (a, b) {
      return String(b.fecha || '').localeCompare(String(a.fecha || ''));
    });
    return { entradas: entradas, salidasPorEntrada: salidasPorEntrada };
  }

  function agruparEntradas(entradas, salidasPorEntrada) {
    var map = {};
    entradas.forEach(function (m) {
      var key = grupoKey(m);
      if (!map[key]) {
        map[key] = {
          key: key,
          nombre: (m.nombre || '').toString().trim() || 'Sin nombre',
          marca: (m.marca || '').toString().trim(),
          total: 0,
          disponible: 0,
          agotados: 0
        };
      }
      var cantidad = parseInt(m.cantidad, 10) || 0;
      var entregado = salidasPorEntrada[m.id] || 0;
      var disponible = Math.max(0, cantidad - entregado);
      map[key].total += cantidad;
      map[key].disponible += disponible;
      if (disponible === 0) map[key].agotados += 1;
    });
    return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) {
      return a.nombre.localeCompare(b.nombre, 'es');
    });
  }

  function renderTarjetas(entradas, salidasPorEntrada) {
    if (!tarjetasGrid) return;
    var grupos = agruparEntradas(entradas, salidasPorEntrada);
    if (!grupos.length) {
      tarjetasGrid.innerHTML = '<p class="empty-state" style="grid-column:1/-1;margin:0;">No hay productos en el depósito.</p>';
      return;
    }
    tarjetasGrid.innerHTML = grupos.map(function (g, idx) {
      var colorCls = DEP_CARD_COLORS[idx % DEP_CARD_COLORS.length];
      var active = filtroGrupoKey === g.key ? ' deposito-tarjeta--active' : '';
      var marcaLine = g.marca ? '<span class="deposito-tarjeta-sub">' + escapeHtml(g.marca) + '</span>' : '';
      var hint = g.disponible + ' disponible' + (g.disponible === 1 ? '' : 's');
      if (g.agotados > 0) hint += ' · ' + g.agotados + ' agotado' + (g.agotados === 1 ? '' : 's');
      return '<div class="metric-card deposito-tarjeta mf-metric ' + colorCls + ' metric-card-clickable' + active + '" role="button" tabindex="0" data-grupo-key="' + escapeHtml(g.key) + '" title="Ver unidades en la tabla">' +
        '<span class="metric-icon metric-icon-svg" aria-hidden="true">' +
        '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M6 12h20v14H6z"></path><path d="M10 12V8h12v4"></path><path d="M6 18h20"></path></svg></span>' +
        '<div class="metric-content">' +
        '<p class="metric-label">' + escapeHtml(g.nombre) + '</p>' +
        marcaLine +
        '<p class="metric-value">' + g.total + '</p>' +
        '<p class="metric-hint">' + escapeHtml(hint) + '</p>' +
        '</div></div>';
    }).join('');

    tarjetasGrid.querySelectorAll('.deposito-tarjeta').forEach(function (card) {
      function activar() {
        var key = card.getAttribute('data-grupo-key');
        filtroGrupoKey = filtroGrupoKey === key ? null : key;
        pagInventario = 1;
        if (btnVerTodos) btnVerTodos.hidden = !filtroGrupoKey;
        renderInventario();
        if (filtroGrupoKey) {
          var detalle = document.querySelector('.deposito-detalle-title');
          if (detalle) detalle.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
      card.addEventListener('click', activar);
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activar();
        }
      });
    });
  }

  async function loadData() {
    if (!window.stockAPI || !window.stockAPI.getDepositoData) {
      data = { movimientos: [] };
      return;
    }
    if (window.appLoading && window.appLoading.show) window.appLoading.show('Cargando depósito…');
    try {
      var raw = await window.stockAPI.getDepositoData();
      data = { movimientos: Array.isArray(raw.movimientos) ? raw.movimientos : [] };
    } catch (e) {
      showToast('Error al cargar depósito', 'error');
      data = { movimientos: [] };
    } finally {
      if (window.appLoading && window.appLoading.hide) window.appLoading.hide();
    }
  }

  function renderInventario() {
    if (!lista) return;
    var pack = getEntradasConSalidas();
    var entradas = pack.entradas;
    var salidasPorEntrada = pack.salidasPorEntrada;

    renderTarjetas(entradas, salidasPorEntrada);
    if (btnVerTodos) btnVerTodos.hidden = !filtroGrupoKey;

    var busqueda = (inputBuscar && inputBuscar.value || '').trim().toLowerCase();
    var filtradas = entradas;
    if (filtroGrupoKey) {
      filtradas = filtradas.filter(function (m) { return grupoKey(m) === filtroGrupoKey; });
    }
    if (busqueda) {
      filtradas = filtradas.filter(function (m) {
        var blob = [
          m.expediente, m.nombre, m.marca, m.numeroSerie, m.concepto
        ].join(' ').toLowerCase();
        return blob.indexOf(busqueda) >= 0;
      });
    }

    if (!entradas.length) {
      lista.innerHTML = '<tr><td colspan="9" class="empty-state"><p>No hay productos en el depósito. Usá «+ Agregar producto».</p></td></tr>';
      var pag0 = document.getElementById('pag-deposito-inventario');
      if (pag0) pag0.innerHTML = '';
      return;
    }
    if (!filtradas.length) {
      var msgVacío = filtroGrupoKey
        ? 'No hay unidades de este tipo con ese criterio.'
        : 'Ningún producto coincide con la búsqueda.';
      lista.innerHTML = '<tr><td colspan="9" class="empty-state"><p>' + msgVacío + '</p></td></tr>';
      var pagE = document.getElementById('pag-deposito-inventario');
      if (pagE) pagE.innerHTML = '';
      return;
    }

    var info = window.Paginacion
      ? window.Paginacion.paginar(filtradas, pagInventario, PAG_SIZE)
      : { items: filtradas, pagina: 1, totalPaginas: 1, total: filtradas.length, inicio: 1, fin: filtradas.length };
    pagInventario = info.pagina;

    lista.innerHTML = info.items.map(function (m) {
      var cantidad = parseInt(m.cantidad, 10) || 0;
      var entregado = salidasPorEntrada[m.id] || 0;
      var disponible = Math.max(0, cantidad - entregado);
      var fecha = m.fecha
        ? new Date(m.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '—';
      var claseDisp = disponible === 0 ? 'stock-cell stock-cell-cero' : 'stock-cell';
      var dispLabel = disponible === 0 ? 'AGOTADO' : String(disponible);
      var editBtn = canEdit() ? '<button type="button" class="inv-menu-editar" data-mov-id="' + escapeHtml(m.id) + '">Editar</button>' : '';
      var deleteBtn = canDelete() ? '<button type="button" class="inv-menu-eliminar" data-mov-id="' + escapeHtml(m.id) + '">Eliminar</button>' : '';
      return '<tr><td>' + escapeHtml((m.expediente || 'DEPOSITO').trim() || 'DEPOSITO') + '</td>' +
        '<td>' + escapeHtml(m.nombre || '—') + '</td>' +
        '<td>' + escapeHtml(m.marca || '—') + '</td>' +
        '<td>' + escapeHtml(m.numeroSerie || '—') + '</td>' +
        '<td class="stock-cell num-col">' + cantidad + '</td>' +
        '<td class="' + claseDisp + ' num-col">' + escapeHtml(dispLabel) + '</td>' +
        '<td>' + escapeHtml(fecha) + '</td>' +
        '<td>' + escapeHtml(m.concepto || '—') + '</td>' +
        '<td class="td-acciones-inv"><div class="inv-acciones-wrap"><button type="button" class="btn btn-icon btn-menu-inv" data-mov-id="' + escapeHtml(m.id) + '" aria-label="Acciones">&#8942;</button>' +
        '<div class="inv-menu-dropdown">' + editBtn + deleteBtn + '</div></div></td></tr>';
    }).join('');

    lista.querySelectorAll('.btn-menu-inv').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var wrap = btn.closest('.inv-acciones-wrap');
        var dropdown = wrap ? wrap.querySelector('.inv-menu-dropdown') : null;
        lista.querySelectorAll('.inv-menu-dropdown').forEach(function (d) { d.classList.remove('open'); });
        if (dropdown) dropdown.classList.toggle('open');
      });
    });
    lista.querySelectorAll('.inv-menu-editar').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        lista.querySelectorAll('.inv-menu-dropdown').forEach(function (d) { d.classList.remove('open'); });
        openModalEditar(btn.getAttribute('data-mov-id'));
      });
    });
    lista.querySelectorAll('.inv-menu-eliminar').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (!canDelete()) { showToast('Solo admin puede eliminar.', 'error'); return; }
        var movId = btn.getAttribute('data-mov-id');
        lista.querySelectorAll('.inv-menu-dropdown').forEach(function (d) { d.classList.remove('open'); });
        if (!movId || !confirm('¿Eliminar este producto del depósito?')) return;
        window.stockAPI.deleteDepositoMovimiento(movId).then(function () {
          showToast('Producto eliminado');
          return loadData();
        }).then(renderInventario).catch(function (err) {
          showToast((err && err.message) || 'Error al eliminar', 'error');
        });
      });
    });

    var pagCont = document.getElementById('pag-deposito-inventario');
    if (pagCont && window.Paginacion) {
      window.Paginacion.renderControles(pagCont, info, function (p) { pagInventario = p; renderInventario(); });
    }
  }

  function openModalAgregar() {
    if (formAgregar) formAgregar.reset();
    var exp = document.getElementById('deposito-expediente');
    if (exp) exp.value = 'DEPOSITO';
    var cant = document.getElementById('deposito-cantidad');
    if (cant) cant.value = '1';
    var fecha = document.getElementById('deposito-fecha');
    if (fecha) fecha.value = toLocalDatetimeValue(new Date().toISOString());
    if (modalAgregar) modalAgregar.classList.add('open');
  }

  function closeModalAgregar() {
    if (modalAgregar) modalAgregar.classList.remove('open');
  }

  function openModalEditar(movId) {
    if (!canEdit()) { showToast('Solo admin puede editar.', 'error'); return; }
    var m = (data.movimientos || []).find(function (x) { return x.id === movId; });
    if (!m) return;
    document.getElementById('editar-deposito-id').value = m.id;
    document.getElementById('editar-deposito-expediente').value = m.expediente || 'DEPOSITO';
    document.getElementById('editar-deposito-nombre').value = m.nombre || '';
    document.getElementById('editar-deposito-marca').value = m.marca || '';
    document.getElementById('editar-deposito-serie').value = m.numeroSerie || '';
    document.getElementById('editar-deposito-cantidad').value = String(parseInt(m.cantidad, 10) || 1);
    document.getElementById('editar-deposito-fecha').value = toLocalDatetimeValue(m.fecha);
    document.getElementById('editar-deposito-concepto').value = m.concepto || '';
    if (modalEditar) modalEditar.classList.add('open');
  }

  function closeModalEditar() {
    if (modalEditar) modalEditar.classList.remove('open');
  }

  async function guardarAgregar(e) {
    e.preventDefault();
    var expediente = (document.getElementById('deposito-expediente').value || 'DEPOSITO').trim() || 'DEPOSITO';
    var nombre = (document.getElementById('deposito-nombre').value || '').trim();
    var marca = (document.getElementById('deposito-marca').value || '').trim();
    var cantidad = parseInt(document.getElementById('deposito-cantidad').value, 10) || 1;
    var serieBase = (document.getElementById('deposito-serie').value || '').trim();
    var fecha = fromLocalDatetimeValue(document.getElementById('deposito-fecha').value);
    var concepto = (document.getElementById('deposito-concepto').value || '').trim();
    if (!nombre) { showToast('Indicá el tipo de elemento', 'error'); return; }

    if (window.appLoading && window.appLoading.show) window.appLoading.show('Guardando…');
    try {
      var baseId = Date.now();
      for (var i = 0; i < cantidad; i++) {
        var serie = cantidad === 1 && serieBase ? serieBase : (serieBase ? serieBase + '-' + (i + 1) : String(i + 1));
        var payload = {
          id: baseId + '-' + i + '-dep',
          tipo: 'entrada',
          expediente: expediente,
          cantidad: 1,
          fecha: fecha,
          numeroSerie: serie,
          nombre: nombre,
          marca: marca || null,
          concepto: concepto || null
        };
        var result = await window.stockAPI.registrarDepositoMovimiento(payload);
        if (!result || !result.ok) throw new Error((result && result.error) || 'Error al guardar');
      }
      showToast(cantidad > 1 ? 'Se agregaron ' + cantidad + ' productos' : 'Producto agregado al depósito');
      closeModalAgregar();
      await loadData();
      renderInventario();
    } catch (err) {
      showToast((err && err.message) || 'Error al guardar', 'error');
    } finally {
      if (window.appLoading && window.appLoading.hide) window.appLoading.hide();
    }
  }

  async function guardarEditar(e) {
    e.preventDefault();
    if (!canEdit()) { showToast('Solo admin puede editar.', 'error'); return; }
    var id = document.getElementById('editar-deposito-id').value;
    var updates = {
      expediente: (document.getElementById('editar-deposito-expediente').value || 'DEPOSITO').trim() || 'DEPOSITO',
      nombre: (document.getElementById('editar-deposito-nombre').value || '').trim(),
      marca: (document.getElementById('editar-deposito-marca').value || '').trim(),
      numeroSerie: (document.getElementById('editar-deposito-serie').value || '').trim(),
      cantidad: document.getElementById('editar-deposito-cantidad').value,
      fecha: fromLocalDatetimeValue(document.getElementById('editar-deposito-fecha').value),
      concepto: (document.getElementById('editar-deposito-concepto').value || '').trim()
    };
    try {
      var result = await window.stockAPI.updateDepositoMovimiento(id, updates);
      if (!result || !result.ok) throw new Error((result && result.error) || 'Error al guardar');
      showToast('Producto actualizado');
      closeModalEditar();
      await loadData();
      renderInventario();
    } catch (err) {
      showToast((err && err.message) || 'Error al guardar', 'error');
    }
  }

  function init() {
    document.querySelectorAll('.modal-deposito-close').forEach(function (btn) {
      btn.addEventListener('click', closeModalAgregar);
    });
    document.querySelectorAll('.modal-editar-deposito-close').forEach(function (btn) {
      btn.addEventListener('click', closeModalEditar);
    });
    if (modalAgregar) {
      modalAgregar.addEventListener('click', function (e) {
        if (e.target === modalAgregar) closeModalAgregar();
      });
    }
    if (modalEditar) {
      modalEditar.addEventListener('click', function (e) {
        if (e.target === modalEditar) closeModalEditar();
      });
    }
    if (btnAgregar) btnAgregar.addEventListener('click', openModalAgregar);
    if (formAgregar) formAgregar.addEventListener('submit', guardarAgregar);
    if (formEditar) formEditar.addEventListener('submit', guardarEditar);
    if (inputBuscar) {
      inputBuscar.addEventListener('input', function () { pagInventario = 1; renderInventario(); });
    }
    if (btnVerTodos) {
      btnVerTodos.addEventListener('click', function () {
        filtroGrupoKey = null;
        pagInventario = 1;
        renderInventario();
      });
    }
    if (btnExportar) {
      btnExportar.addEventListener('click', function () {
        if (!window.stockAPI.exportDepositoInventario) return;
        window.stockAPI.exportDepositoInventario().then(function (r) {
          if (r && r.ok) showToast('Exportado correctamente');
          else if (r && !r.cancelled) showToast((r && r.error) || 'Error al exportar', 'error');
        });
      });
    }

    window._realtimeRefresh = function (table) {
      if (!table || table === 'deposito_movimientos') {
        loadData().then(renderInventario);
      }
    };

    var authPromise = window.stockAPI && window.stockAPI.getAuthStatus
      ? window.stockAPI.getAuthStatus()
      : Promise.resolve({ rol: 'usuario' });
    if (window.stockAPI.getDataBackend) {
      window.stockAPI.getDataBackend().then(function (r) {
        var badge = document.getElementById('backend-badge');
        if (badge) {
          badge.textContent = r.backend === 'supabase' ? 'Guardando en Supabase' : 'Modo local (archivo)';
          badge.className = 'backend-badge ' + (r.backend === 'supabase' ? 'backend-supabase' : 'backend-local');
        }
      });
    }

    authPromise.then(function (auth) {
      esAdmin = String((auth && auth.rol) || 'usuario').toLowerCase() === 'admin';
      if (!esAdmin) document.body.classList.add('rol-no-admin');
      return loadData();
    }).then(renderInventario).catch(function () {
      return loadData().then(renderInventario);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
