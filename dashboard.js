(function () {
  if (!window.stockAPI) return;

  var usernameEl = document.getElementById('dashboard-username');
  var dateEl = document.getElementById('dashboard-date');
  var metricInventario = document.getElementById('metric-inventario');
  var metricRecibidos = document.getElementById('metric-recibidos');
  var metricEntregas = document.getElementById('metric-entregas');
  var metricExpedientes = document.getElementById('metric-expedientes');
  var tbodyMovimientos = document.getElementById('dashboard-movimientos');
  var emptyMovimientos = document.getElementById('dashboard-movimientos-empty');
  var notifContainer = document.getElementById('dashboard-notificaciones');
  var notifEmpty = document.getElementById('dashboard-notificaciones-empty');
  var notifBadge = document.getElementById('notificaciones-badge');

  // Notificación de actualización (se alimenta desde realtime-sync.js vía evento)
  var updateNotif = { status: 'idle', info: null, progress: null, error: null };

  // Filtro de movimientos recientes: hoy / 7 / 30 (coincide con el botón activo en dashboard.html)
  var movRange = 'hoy';
  var movFilterButtons = document.querySelectorAll('.dashboard-mov-filtro');

  function escapeHtml(str) {
    if (str == null || str === '') return '';
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function escapeAttrSimple(str) {
    if (str == null || str === '') return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/'/g, '&#39;');
  }

  function setFechaHoy() {
    if (!dateEl) return;
    var now = new Date();
    dateEl.textContent = now.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function setFormSubmitLoading(form, submitBtn, loadingText) {
    if (!form || !submitBtn) return;
    if (form.dataset && form.dataset.submitting === '1') return;
    if (form.dataset) form.dataset.submitting = '1';
    if (submitBtn.dataset && !submitBtn.dataset.originalLabel) {
      submitBtn.dataset.originalLabel = submitBtn.textContent;
    }
    submitBtn.textContent = loadingText;
    submitBtn.disabled = true;
  }

  function clearFormSubmitLoading(form, submitBtn) {
    if (!form || !submitBtn) return;
    if (form.dataset) form.dataset.submitting = '0';
    if (submitBtn.dataset && submitBtn.dataset.originalLabel != null) {
      submitBtn.textContent = submitBtn.dataset.originalLabel;
    }
    submitBtn.disabled = false;
  }

  function renderMetricas(data) {
    var movimientos = data.movimientos || [];
    var provisiones = data.guardiaProvisiones || [];
    var productos = data.productos || [];

    var entradas = movimientos.filter(function (m) { return m.tipo === 'entrada'; });
    var salidasPorMov = {};
    movimientos.filter(function (m) { return m.tipo === 'salida'; }).forEach(function (m) {
      var id = m.entradaId || m.id;
      salidasPorMov[id] = (salidasPorMov[id] || 0) + (m.cantidad || 0);
    });
    var provistosPorMov = {};
    provisiones.forEach(function (p) {
      var id = p.movimiento_id;
      if (id) provistosPorMov[id] = (provistosPorMov[id] || 0) + (p.cantidad != null ? p.cantidad : 1);
    });

    var totalInventario = 0;
    entradas.forEach(function (m) {
      var salido = salidasPorMov[m.id] || 0;
      var provisto = provistosPorMov[m.id] || 0;
      var disponible = (m.cantidad || 0) - salido - provisto;
      if (disponible > 0) totalInventario += disponible;
    });

    var ahora = new Date();
    var mesActual = ahora.getMonth();
    var anioActual = ahora.getFullYear();
    var recibidosEsteMes = entradas.filter(function (m) {
      if (!m.fecha) return false;
      var d = new Date(m.fecha);
      return d.getMonth() === mesActual && d.getFullYear() === anioActual;
    }).reduce(function (sum, m) { return sum + (m.cantidad || 0); }, 0);

    var entregasEsteMes = provisiones.filter(function (p) {
      if (!p.fecha_asignacion) return false;
      var d = new Date(p.fecha_asignacion);
      return d.getMonth() === mesActual && d.getFullYear() === anioActual;
    }).length;

    if (metricInventario) metricInventario.textContent = totalInventario;
    if (metricRecibidos) metricRecibidos.textContent = recibidosEsteMes;
    if (metricEntregas) metricEntregas.textContent = entregasEsteMes;
    if (metricExpedientes) metricExpedientes.textContent = productos.length;
  }

  function getExpedienteNum(productos, productoId) {
    var p = (productos || []).find(function (x) { return x.id === productoId; });
    return p ? ((p.codigo || p.id || '').toString().trim() || '—') : '—';
  }

  function getNombreProducto(productos, productoId) {
    var p = (productos || []).find(function (x) { return x.id === productoId; });
    return p ? (p.nombre || p.codigo || '').toString().trim() || '—' : '—';
  }

  function nombreDependencia(dependencias, dependenciaId) {
    if (!dependenciaId) return '—';
    var d = (dependencias || []).find(function (x) { return x.id === dependenciaId; });
    if (!d) return '—';
    var n = (d.nombre || '').toString().trim();
    if (n) return n;
    var c = (d.codigo || '').toString().trim();
    return c || '—';
  }

  /** Flecha abajo (entrada) / arriba (entrega), estilo línea fina como el mockup. */
  var DASH_MOV_SVG_ENTRADA =
    '<svg class="dash-mov-tipo-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M8 3v10M5 10l3 3 3-3"></path></svg>';
  var DASH_MOV_SVG_ENTREGA =
    '<svg class="dash-mov-tipo-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M8 13V3M5 6l3-3 3 3"></path></svg>';

  function htmlTipoMovimientoDash(e) {
    var esEntrada = e.eventoTipo === 'entrada';
    var clase = esEntrada ? 'dash-mov-tipo dash-mov-tipo--entrada' : 'dash-mov-tipo dash-mov-tipo--entrega';
    var ico = esEntrada ? DASH_MOV_SVG_ENTRADA : DASH_MOV_SVG_ENTREGA;
    return '<span class="' + clase + '">' + ico + '<span class="dash-mov-tipo-label">' + escapeHtml(e.tipoLabel) + '</span></span>';
  }

  function renderMovimientosRecientes(data) {
    var movimientos = data.movimientos || [];
    var provisiones = data.guardiaProvisiones || [];
    var productos = data.productos || [];
    var dependencias = data.dependencias || [];

    var movs = movimientos.map(function (m) {
      var prod = productos.find(function (x) { return x.id === m.productoId; });
      var nombreProducto = (m.nombre || m.numeroSerie || (prod && prod.nombre) || '').toString().trim() || '—';
      var usuario = (m.usuario || m.user || m.username || m.userEmail || m.email || '').toString().trim() || '—';
      var destinoTxt = (m.destino || '').toString().trim();
      return {
        fecha: m.fecha ? new Date(m.fecha).getTime() : 0,
        tipoLabel: m.tipo === 'entrada' ? 'Entrada' : 'Entrega',
        expediente: getExpedienteNum(productos, m.productoId),
        producto: nombreProducto,
        cantidad: m.cantidad,
        usuario: usuario,
        dependencia: destinoTxt || '—',
        productoId: m.productoId || null,
        movimientoId: m.id || null,
        eventoTipo: m.tipo || ''
      };
    });
    var provList = provisiones.map(function (p) {
      var prod = productos.find(function (x) { return x.id === p.producto_id; });
      var nombreProducto = (prod && prod.nombre) ? (prod.nombre || '').toString().trim() : '—';
      if (p.movimiento_id && movimientos.length) {
        var mov = movimientos.find(function (m) { return m.id === p.movimiento_id; });
        if (mov) nombreProducto = (mov.nombre || mov.numeroSerie || '').toString().trim() || nombreProducto;
      }
      var usuarioProv = (p.usuario || p.user || p.username || p.userEmail || p.email || '').toString().trim() || '—';
      return {
        fecha: p.fecha_asignacion ? new Date(p.fecha_asignacion).getTime() : 0,
        tipoLabel: 'Entrega',
        expediente: getExpedienteNum(productos, p.producto_id),
        producto: nombreProducto,
        cantidad: p.cantidad != null ? p.cantidad : 1,
        usuario: usuarioProv,
        dependencia: nombreDependencia(dependencias, p.dependencia_id),
        productoId: p.producto_id || null,
        movimientoId: p.movimiento_id || null,
        eventoTipo: 'provision'
      };
    });
    var todos = movs.concat(provList).sort(function (a, b) { return b.fecha - a.fecha; });

    // Aplicar filtro por rango
    var ahora = new Date();
    ahora.setSeconds(0, 0);
    var desdeMs = 0;
    if (movRange === 'hoy') {
      var h = new Date();
      h.setHours(0, 0, 0, 0);
      desdeMs = h.getTime();
    } else {
      var dias = parseInt(movRange, 10) || 7;
      var d = new Date();
      d.setDate(d.getDate() - (dias - 1));
      d.setHours(0, 0, 0, 0);
      desdeMs = d.getTime();
    }
    todos = todos.filter(function (e) { return e.fecha >= desdeMs; }).slice(0, 20);

    if (emptyMovimientos) emptyMovimientos.style.display = todos.length ? 'none' : 'block';
    var movTableWrap = document.querySelector('.dashboard-movimientos-table-wrap');
    var hasRows = todos.length > 0;
    if (movTableWrap) movTableWrap.style.display = hasRows ? 'block' : 'none';
    if (!tbodyMovimientos) return;

    if (todos.length === 0) {
      tbodyMovimientos.innerHTML = '';
      return;
    }
    tbodyMovimientos.innerHTML = todos.map(function (e) {
      var fechaStr = e.fecha ? new Date(e.fecha).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
      var usuarioCell = escapeHtml(e.usuario || '—');
      var titleProd = escapeAttrSimple(e.producto);
      var titleDep = escapeAttrSimple(e.dependencia);
      return '<tr class="dashboard-mov-row" role="button" tabindex="0" ' +
        'data-producto-id="' + escapeHtml(e.productoId || '') + '" ' +
        'data-movimiento-id="' + escapeHtml(e.movimientoId || '') + '" ' +
        'data-evento-tipo="' + escapeHtml(e.eventoTipo || '') + '">' +
        '<td class="dash-mov-td-fecha">' + escapeHtml(fechaStr) + '</td>' +
        '<td class="dash-mov-td-tipo">' + htmlTipoMovimientoDash(e) + '</td>' +
        '<td class="dash-mov-td-exp">' + escapeHtml(e.expediente) + '</td>' +
        '<td class="dash-mov-td-prod"><span class="dash-mov-prod-text" title="' + titleProd + '">' + escapeHtml(e.producto) + '</span></td>' +
        '<td class="col-mov-usuario-td dash-mov-td-user">' + usuarioCell + '</td>' +
        '<td class="num-col dash-mov-td-cant">' + e.cantidad + '</td>' +
        '<td class="dash-mov-td-dep"><span class="dash-mov-dep-text" title="' + titleDep + '">' + escapeHtml(e.dependencia) + '</span></td>' +
      '</tr>';
    }).join('');

    // Click en fila → Inventario, pestaña Historial de movimientos
    tbodyMovimientos.querySelectorAll('.dashboard-mov-row').forEach(function (tr) {
      function go() {
        window.location.href = 'productos.html#historial';
      }
      tr.addEventListener('click', function (ev) { ev.preventDefault(); go(); });
      tr.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); }
      });
    });
  }

  // Días antes del vencimiento para considerar "por vencer"
  var DIAS_ALERTA_VENCIMIENTO = 60;
  var NOTIF_LEIDO_KEY = 'dashboard_notif_leido_count';
  var ultimaCantidadNotif = 0;

  function getNotifLeidoCount() {
    var n = 0;
    try {
      n = parseInt(localStorage.getItem(NOTIF_LEIDO_KEY), 10);
      if (isNaN(n)) n = 0;
    } catch (e) {}
    return n;
  }

  function marcarNotificacionesLeidas(cantidad) {
    try {
      localStorage.setItem(NOTIF_LEIDO_KEY, String(cantidad));
    } catch (e) {}
  }

  function fetchDashboardData() {
    if (window.invokeStockLightOrFull) {
      return window.invokeStockLightOrFull('getDashboardData', function () {
        return window.stockAPI.getData();
      });
    }
    return window.stockAPI.getData();
  }

  function renderNotificaciones(data) {
    var matafuegos = data.matafuegos || [];
    var enRecarga = matafuegos.filter(function (m) { return (m.estado || '') === 'recarga'; }).length;
    var hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    var limite = new Date(hoy);
    limite.setDate(limite.getDate() + DIAS_ALERTA_VENCIMIENTO);

    var porVencer = matafuegos.filter(function (m) {
      if ((m.estado || 'disponible') !== 'disponible') return false;
      if (!m.fechaVencimiento) return false;
      var venc = new Date(m.fechaVencimiento);
      venc.setHours(0, 0, 0, 0);
      return venc <= limite;
    });

    if (!notifContainer) return;
    // Armar lista final: primero actualización (si aplica), luego matafuegos
    var updateAplica = updateNotif && (updateNotif.status === 'available' || updateNotif.status === 'downloaded' || updateNotif.status === 'error');
    var totalItems = porVencer.length + (updateAplica ? 1 : 0);
    if (notifEmpty) notifEmpty.style.display = totalItems ? 'none' : 'block';
    ultimaCantidadNotif = totalItems;
    var leidoCount = getNotifLeidoCount();
    var sinLeer = Math.max(0, porVencer.length - leidoCount);
    if (updateAplica) {
      // Si aparece el update, lo contamos como 1 notificación más "sin leer" hasta que el usuario abra la campanita.
      var leidoUpdate = leidoCount >= totalItems;
      if (!leidoUpdate) sinLeer += 1;
    }
    if (notifBadge) {
      notifBadge.textContent = sinLeer;
      notifBadge.style.display = sinLeer > 0 ? 'flex' : 'none';
    }

    // Notificación de actualización
    var iconUpdate =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M21 12a9 9 0 1 1-3-6.7"></path>' +
      '<path d="M21 3v7h-7"></path>' +
      '</svg>';

    var updateHtml = '';
    if (updateAplica) {
      var ver = (updateNotif.info && (updateNotif.info.version || updateNotif.info.releaseName)) ? String(updateNotif.info.version || updateNotif.info.releaseName) : '';
      var title = updateNotif.status === 'downloaded' ? 'Actualización lista' : (updateNotif.status === 'error' ? 'No se pudo actualizar' : 'Actualización disponible');
      var msg = updateNotif.status === 'downloaded'
        ? 'La actualización se descargó. Presioná Instalar.'
        : updateNotif.status === 'error'
          ? (updateNotif.error ? String(updateNotif.error) : 'Error al buscar/descargar actualización')
          : (ver ? ('Nueva versión: ' + ver) : 'Hay una versión nueva para instalar');
      var accion = updateNotif.status === 'downloaded' ? 'Instalar' : (updateNotif.status === 'error' ? 'Reintentar' : 'Actualizar');
      var accionData = updateNotif.status === 'downloaded' ? 'install' : (updateNotif.status === 'error' ? 'retry' : 'download');
      updateHtml =
        '<div class="notificacion-item notificacion-warning" data-update-notif="1">' +
        '<div class="notificacion-icono" aria-hidden="true">' + iconUpdate + '</div>' +
        '<div class="notificacion-body">' +
        '  <div class="notificacion-titulo">' + escapeHtml(title) + '</div>' +
        '  <div class="notificacion-texto">' + escapeHtml(msg) + '</div>' +
        '  <div class="notificacion-meta">' +
        '    <button type="button" class="btn btn-primary btn-sm" data-update-action="' + escapeHtml(accionData) + '">' + escapeHtml(accion) + '</button>' +
        '  </div>' +
        '</div>' +
        '</div>';
    }

    var iconWarn =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M12 3l10 18H2L12 3z"></path>' +
      '<path d="M12 9v4"></path>' +
      '<path d="M12 17h.01"></path>' +
      '</svg>';
    var iconFire =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M14 3h4l3-2"></path>' +
      '<path d="M14 3v4"></path>' +
      '<rect x="9" y="7" width="6" height="13" rx="2"></rect>' +
      '<path d="M12 11v3"></path>' +
      '</svg>';

    var vencidosCount = 0;
    var porVencerCount = 0;
    var itemsHtml = porVencer.map(function (m) {
      var vencStr = m.fechaVencimiento ? new Date(m.fechaVencimiento).toLocaleDateString('es-AR') : '—';
      var yaVencido = m.fechaVencimiento && new Date(m.fechaVencimiento) < hoy;
      if (yaVencido) vencidosCount += 1;
      else porVencerCount += 1;
      var marca = escapeHtml(m.marca || 'Sin marca');
      var nro = escapeHtml(m.numeroSerie || '—');
      var titulo = yaVencido ? 'Matafuego vencido' : 'Matafuego por vencer';
      var dias = 0;
      try {
        var dV = new Date(m.fechaVencimiento);
        dV.setHours(0, 0, 0, 0);
        dias = Math.round((dV.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
      } catch (_) { dias = 0; }
      var meta = yaVencido
        ? ('Venció: ' + vencStr + (dias ? ' (' + Math.abs(dias) + ' día(s) atrasado)' : ''))
        : ('Vence: ' + vencStr + (dias ? ' (en ' + dias + ' día(s))' : ''));
      var sevClass = yaVencido ? ' notificacion-danger' : ' notificacion-warning';
      return '<div class="notificacion-item notificacion-matafuego' + sevClass + '">' +
        '<div class="notificacion-icono" aria-hidden="true">' + (yaVencido ? iconWarn : iconFire) + '</div>' +
        '<div class="notificacion-body">' +
          '<div class="notificacion-titulo">' + titulo + '</div>' +
          '<div class="notificacion-texto">' + marca + ' — Nº ' + nro + '</div>' +
          '<div class="notificacion-meta">' + escapeHtml(meta) + '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    var metaEl = document.getElementById('dashboard-notificaciones-meta');
    if (metaEl) {
      if (!porVencer.length) metaEl.textContent = 'Sin alertas por vencimiento';
      else metaEl.textContent = vencidosCount + ' vencido(s) · ' + porVencerCount + ' por vencer (≤ ' + DIAS_ALERTA_VENCIMIENTO + ' días)';
    }

    var resumenHtml = '';
    if (porVencer.length || enRecarga > 0) {
      var links = '';
      if (porVencer.length) {
        links += '<a href="matafuegos.html?mf=prox30" class="btn btn-secondary btn-sm notif-dash-mf-link">Ver por vencer (' + porVencer.length + ')</a> ';
      }
      if (enRecarga > 0) {
        links += '<a href="matafuegos.html?mf=recarga" class="btn btn-secondary btn-sm notif-dash-mf-link">Ver en recarga (' + enRecarga + ')</a>';
      }
      resumenHtml =
        '<div class="notificacion-item notificacion-info notificacion-resumen-mf">' +
        '<div class="notificacion-body">' +
        '<div class="notificacion-titulo">Matafuegos</div>' +
        '<div class="notificacion-texto">Revisá vencimientos y unidades pendientes de recarga.</div>' +
        '<div class="notificacion-meta notificacion-meta-links">' + links + '</div>' +
        '</div></div>';
      totalItems += 1;
    }

    var listEl = notifContainer.querySelector('.notificaciones-items');
    if (totalItems > 0) {
      if (!listEl) {
        listEl = document.createElement('div');
        listEl.className = 'notificaciones-items';
        notifContainer.appendChild(listEl);
      }
      listEl.innerHTML = (updateHtml ? (updateHtml + resumenHtml + itemsHtml) : (resumenHtml + itemsHtml));
      listEl.style.display = 'block';
    } else if (listEl) {
      listEl.innerHTML = '';
      listEl.style.display = 'none';
    }
  }

  function run(data) {
    setFechaHoy();
    renderMetricas(data);
    renderMovimientosRecientes(data);
    renderNotificaciones(data);
  }

  window.stockAPI.getAuthStatus().then(function (r) {
    if (!r.hasUser) {
      window.location.href = 'index.html';
      return;
    }
    console.log('[dashboard] getAuthStatus result:', r);
    var name = (r.username || 'Usuario').trim();
    var rol = (r.rol || 'usuario').toLowerCase();
    var rolLabel = rol === 'admin' ? 'Admin' : rol === 'oficina' ? 'Oficina' : 'Usuario';
    if (usernameEl) {
      usernameEl.textContent = name;
    } else {
      console.warn('[dashboard] No se encontró #dashboard-username');
    }
    var headerLabel = document.getElementById('header-user-label');
    if (headerLabel) {
      headerLabel.textContent = name + ' (' + rolLabel + ')';
    } else {
      console.warn('[dashboard] No se encontró #header-user-label');
    }
    var linkGestionUsuarios = document.getElementById('header-dropdown-gestion-usuarios');
    if (linkGestionUsuarios) linkGestionUsuarios.style.display = rol === 'admin' ? '' : 'none';
    // Ocultar botones de backup para no-admin
    var btnExpBk = document.getElementById('btn-exportar-backup');
    var btnResBk = document.getElementById('btn-restaurar-backup');
    if (btnExpBk) btnExpBk.style.display = rol === 'admin' ? '' : 'none';
    if (btnResBk) btnResBk.style.display = rol === 'admin' ? '' : 'none';

    // Botón de cerrar sesión del sidebar (puede no existir en algunas pantallas)
    var btn = document.getElementById('btn-cerrar-sesion');
    if (btn) {
      console.log('[dashboard] Registrando handler de cerrar sesión (sidebar)');
      btn.addEventListener('click', function () {
        console.log('[dashboard] Click en cerrar sesión (sidebar)');
        window.stockAPI.logout().then(function () {
          window.location.href = 'index.html';
        });
      });
    } else {
      console.log('[dashboard] No hay botón #btn-cerrar-sesion en esta página (ok si solo se usa el menú de usuario del header)');
    }

    // Menú de usuario y notificaciones (mutuamente excluyentes)
    var btnUsuario = document.getElementById('header-btn-usuario');
    var dropdownUsuario = document.getElementById('header-usuario-dropdown');
    var btnNotifGlobal = document.getElementById('header-btn-notificaciones');
    var dropdownNotifGlobal = document.getElementById('header-notificaciones-dropdown');

    function closeUsuario() {
      if (!btnUsuario || !dropdownUsuario) return;
      if (dropdownUsuario.hidden === false) {
        dropdownUsuario.hidden = true;
        btnUsuario.setAttribute('aria-expanded', 'false');
      }
    }

    function closeNotif() {
      if (!btnNotifGlobal || !dropdownNotifGlobal) return;
      if (dropdownNotifGlobal.hidden === false) {
        dropdownNotifGlobal.hidden = true;
        btnNotifGlobal.setAttribute('aria-expanded', 'false');
      }
    }

    // Click fuera: cerrar ambos
    document.addEventListener('click', function () {
      closeUsuario();
      closeNotif();
    });

    if (btnUsuario && dropdownUsuario) {
      console.log('[dashboard] Menú de usuario encontrado, agregando listeners');
      btnUsuario.addEventListener('click', function (e) {
        e.stopPropagation();
        // Si abro Usuario, cierro Notificaciones
        closeNotif();
        var isOpen = dropdownUsuario.hidden === false;
        console.log('[dashboard] Click en header-btn-usuario. isOpen antes =', isOpen);
        dropdownUsuario.hidden = isOpen;
        btnUsuario.setAttribute('aria-expanded', String(!isOpen));
      });
      // Evitar que clicks dentro cierren el menú
      dropdownUsuario.addEventListener('click', function (e) {
        e.stopPropagation();
      });

      // Botón de cerrar sesión dentro del menú de usuario
      var headerBtnCerrar = document.getElementById('header-btn-cerrar-sesion');
      if (headerBtnCerrar) {
        console.log('[dashboard] Registrando handler de cerrar sesión (header)');
        headerBtnCerrar.addEventListener('click', function () {
          console.log('[dashboard] Click en cerrar sesión (header)');
          window.stockAPI.logout().then(function () {
            window.location.href = 'index.html';
          });
        });
      } else {
        console.warn('[dashboard] No se encontró #header-btn-cerrar-sesion dentro del menú de usuario');
      }

      var btnConfig = document.getElementById('header-dropdown-config');
      var modalConfig = document.getElementById('modal-configuracion');
      var formConfig = document.getElementById('form-configuracion-password');
      var btnGuardarConfig = document.getElementById('config-pass-guardar');
      var inputActual = document.getElementById('config-pass-actual');
      var inputNueva = document.getElementById('config-pass-nueva');
      var inputNueva2 = document.getElementById('config-pass-nueva2');

      function closeModalConfig() {
        if (!modalConfig) return;
        modalConfig.classList.remove('open');
        modalConfig.setAttribute('aria-hidden', 'true');
        if (formConfig) formConfig.reset();
      }

      function openModalConfig() {
        if (!modalConfig) return;
        modalConfig.classList.add('open');
        modalConfig.setAttribute('aria-hidden', 'false');
        setTimeout(function () {
          if (inputActual && inputActual.focus) inputActual.focus();
        }, 30);
      }

      function bindPasswordToggles() {
        document.querySelectorAll('.config-pass-toggle').forEach(function (btnToggle) {
          if (btnToggle.dataset.bound === '1') return;
          btnToggle.dataset.bound = '1';
          btnToggle.addEventListener('click', function () {
            var targetId = btnToggle.getAttribute('data-target') || '';
            if (!targetId) return;
            var input = document.getElementById(targetId);
            if (!input) return;
            var showing = input.type === 'text';
            input.type = showing ? 'password' : 'text';
            btnToggle.textContent = showing ? 'Mostrar' : 'Ocultar';
            btnToggle.setAttribute('aria-label', showing ? 'Mostrar contraseña' : 'Ocultar contraseña');
          });
        });
      }

      if (btnConfig) {
        btnConfig.addEventListener('click', function () {
          closeUsuario();
          bindPasswordToggles();
          openModalConfig();
        });
      }

      if (modalConfig) {
        modalConfig.addEventListener('click', function (ev) {
          if (ev && ev.target === modalConfig) closeModalConfig();
        });
      }
      document.querySelectorAll('.modal-configuracion-close').forEach(function (btnClose) {
        btnClose.addEventListener('click', closeModalConfig);
      });

      if (formConfig && btnGuardarConfig) {
        formConfig.addEventListener('submit', function (ev) {
          ev.preventDefault();
          var actual = inputActual ? inputActual.value : '';
          var nueva = inputNueva ? inputNueva.value : '';
          var nueva2 = inputNueva2 ? inputNueva2.value : '';
          if (!actual || !nueva || !nueva2) {
            showToastDash('Completá todos los campos.', 'error');
            return;
          }
          if (nueva.length < 4) {
            showToastDash('La nueva contraseña debe tener al menos 4 caracteres.', 'error');
            return;
          }
          if (nueva !== nueva2) {
            showToastDash('Las contraseñas nuevas no coinciden.', 'error');
            return;
          }
          if (actual === nueva) {
            showToastDash('La nueva contraseña debe ser distinta a la actual.', 'error');
            return;
          }

          setFormSubmitLoading(formConfig, btnGuardarConfig, 'Guardando...');
          window.stockAPI.changePassword(actual, nueva).then(function (res) {
            if (res && res.ok) {
              showToastDash('Contraseña actualizada correctamente.', 'success');
              closeModalConfig();
              return;
            }
            showToastDash((res && res.error) || 'No se pudo actualizar la contraseña.', 'error');
          }).catch(function () {
            showToastDash('Error al actualizar la contraseña.', 'error');
          }).finally(function () {
            clearFormSubmitLoading(formConfig, btnGuardarConfig);
          });
        });
      }
    } else {
      console.warn('[dashboard] No se encontró header-btn-usuario o header-usuario-dropdown. btnUsuario =', !!btnUsuario, 'dropdownUsuario =', !!dropdownUsuario);
    }

    if (window.appLoading && window.appLoading.show) window.appLoading.show('Cargando dashboard…');
    fetchDashboardData().then(function (data) {
      run(data || {});

      // --- Interacciones de la cabecera que dependen de los datos cargados ---
      // Notificaciones (campana en el header)
      var btnNotif = btnNotifGlobal || document.getElementById('header-btn-notificaciones');
      var dropdownNotif = dropdownNotifGlobal || document.getElementById('header-notificaciones-dropdown');
      if (btnNotif && dropdownNotif) {
        console.log('[dashboard] Menú de notificaciones encontrado, agregando listeners');
        btnNotif.addEventListener('click', function (e) {
          e.stopPropagation();
          // Si abro Notificaciones, cierro Usuario
          closeUsuario();
          var isOpen = dropdownNotif.hidden === false;
          console.log('[dashboard] Click en header-btn-notificaciones. isOpen antes =', isOpen);
          dropdownNotif.hidden = isOpen;
          btnNotif.setAttribute('aria-expanded', String(!isOpen));

          // Al abrir el panel, marcar todas como leídas
          if (!isOpen) {
            marcarNotificacionesLeidas(ultimaCantidadNotif);
            var leidoCount = getNotifLeidoCount();
            var sinLeer = Math.max(0, ultimaCantidadNotif - leidoCount);
            if (notifBadge) {
              notifBadge.textContent = sinLeer;
              notifBadge.style.display = sinLeer > 0 ? 'flex' : 'none';
            }
          }
        });

        // Evitar que clicks dentro cierren el menú
        dropdownNotif.addEventListener('click', function (e) {
          e.stopPropagation();

          // Acciones para la notificación de actualización
          var t = e.target;
          if (!t) return;
          var act = t.getAttribute && t.getAttribute('data-update-action');
          if (!act) return;
          e.preventDefault();
          if (!window.stockAPI) return;
          if (act === 'download' && window.stockAPI.downloadUpdate) {
            window.stockAPI.downloadUpdate().catch(function () { /* se reporta por evento */ });
          } else if (act === 'install' && window.stockAPI.installUpdate) {
            window.stockAPI.installUpdate().catch(function () { /* ignore */ });
          } else if (act === 'retry' && window.stockAPI.checkForUpdates) {
            window.stockAPI.checkForUpdates().catch(function () { /* ignore */ });
          }
        });

        // Botón cerrar (×) dentro del panel
        var btnCerrarNotif = document.getElementById('header-btn-notificaciones-cerrar');
        if (btnCerrarNotif) {
          btnCerrarNotif.addEventListener('click', function (e) {
            e.stopPropagation();
            dropdownNotif.hidden = true;
            btnNotif.setAttribute('aria-expanded', 'false');
          });
        }
      } else {
        console.warn('[dashboard] No se encontró header-btn-notificaciones o header-notificaciones-dropdown. btnNotif =', !!btnNotif, 'dropdownNotif =', !!dropdownNotif);
      }
    }).catch(function () {
      run({});
    }).finally(function () {
      if (window.appLoading && window.appLoading.hide) window.appLoading.hide();
    });
  });

  // Escuchar eventos del updater y re-renderizar la campanita
  try {
    window.addEventListener('app-update-status', function (ev) {
      var p = ev && ev.detail ? ev.detail : null;
      if (!p || !p.status) return;
      updateNotif.status = p.status;
      updateNotif.info = p.info || null;
      updateNotif.progress = p.progress != null ? p.progress : null;
      updateNotif.error = p.error || null;
      fetchDashboardData().then(function (d) { renderNotificaciones(d || {}); });
    });
  } catch (_) {}

  // Filtros (hoy / 7 / 30)
  if (movFilterButtons && movFilterButtons.length) {
    movFilterButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        movFilterButtons.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        movRange = btn.getAttribute('data-range') || 'hoy';
        fetchDashboardData().then(function (data) { renderMovimientosRecientes(data || {}); });
      });
    });
  }

  // --- Backup (botones en menú de usuario) ---
  var btnExportar = document.getElementById('btn-exportar-backup');
  var btnRestaurar = document.getElementById('btn-restaurar-backup');

  function showToastDash(msg, type) {
    var existing = document.querySelector('.toast');
    if (existing) existing.remove();
    var t = document.createElement('div');
    t.className = 'toast ' + (type || 'success');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 4000);
  }

  if (btnExportar) {
    btnExportar.addEventListener('click', function () {
      if (!window.stockAPI || !window.stockAPI.exportBackupFile) return;
      window.stockAPI.exportBackupFile().then(function (r) {
        if (r && r.ok) {
          showToastDash('Backup exportado correctamente');
        } else if (r && r.error && r.error !== 'Cancelado') {
          showToastDash(r.error || 'Error al exportar', 'error');
        }
      }).catch(function () {
        showToastDash('Error al exportar backup', 'error');
      });
    });
  }

  if (btnRestaurar) {
    btnRestaurar.addEventListener('click', function () {
      if (!window.stockAPI || !window.stockAPI.restoreBackup) return;
      if (!confirm('¿Restaurar datos desde un backup? Se creará un respaldo automático del estado actual antes de restaurar.')) return;
      window.stockAPI.restoreBackup().then(function (r) {
        if (r && r.ok) {
          showToastDash('Backup restaurado: ' + (r.filename || ''));
          setTimeout(function () { location.reload(); }, 1500);
        } else if (r && r.error && r.error !== 'Cancelado') {
          showToastDash(r.error || 'Error al restaurar', 'error');
        }
      }).catch(function () {
        showToastDash('Error al restaurar backup', 'error');
      });
    });
  }

  window._realtimeRefresh = function () {
    fetchDashboardData().then(function (d) { run(d || {}); });
  };
})();
