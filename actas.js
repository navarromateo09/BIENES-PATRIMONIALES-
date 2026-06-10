(function () {
  'use strict';
  if (!window.stockAPI) return;

  var contenedorActas = document.getElementById('lista-actas-grupos');
  var emptyActas = document.getElementById('actas-empty');
  var inputBuscarActas = document.getElementById('buscar-actas');
  var modalVerActa = document.getElementById('modal-ver-acta');
  var verActaContenido = document.getElementById('ver-acta-contenido');
  var btnImprimirActaVista = document.getElementById('btn-imprimir-acta-vista');
  var modalEditarActa = document.getElementById('modal-editar-acta');
  var formEditarActa = document.getElementById('form-editar-acta');
  var selectEditarDep = document.getElementById('editar-acta-dependencia');
  var todasLasActas = [];
  var actaEnVista = null;
  var actaEnEdicion = null;
  var dependencias = [];
  var esAdmin = false;
  var usuarioActual = '';
  var pagActas = 1;
  /** Paginación por carpeta de expediente (cada carpeta puede incluir varias actas). */
  var PAG_CARPETAS_EXP = 12;

  var MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  var DIAS_PALABRAS = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE', 'TREINTA', 'TREINTA Y UNO'];
  var CANT_PALABRAS = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE', 'TREINTA'];
  var HORAS_PALABRAS = ['CERO', 'UNA', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO'];

  function escapeHtml(str) {
    if (str == null || str === '') return '';
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function formatFecha(isoStr) {
    if (!isoStr) return '—';
    var d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function numeroACapitalizar(n) { return n >= 1 && n <= 31 ? DIAS_PALABRAS[n] : String(n); }
  function cantidadEnPalabras(n) { return n >= 1 && n <= 30 ? CANT_PALABRAS[n] : String(n); }
  function limpiarDepLabelViejo(label) {
    var txt = (label || '').toString().trim();
    if (!txt) return '—';
    // Ej: "144 - D4" o "120 - 1 - D-1" => "D4" / "D-1"
    txt = txt.replace(/^\s*(?:\d+\s*-\s*)+/, '').trim();
    return txt || '—';
  }
  function yearEnPalabras(y) {
    if (y === 2025) return 'dos mil Veinticinco';
    if (y === 2026) return 'dos mil Veintiséis';
    if (y === 2027) return 'dos mil Veintisiete';
    if (y >= 2020 && y <= 2030) return 'dos mil ' + (y === 2020 ? 'Veinte' : y === 2021 ? 'Veintiuno' : y === 2022 ? 'Veintidós' : y === 2023 ? 'Veintitrés' : y === 2024 ? 'Veinticuatro' : String(y));
    return 'dos mil ' + String(y).slice(-2);
  }

  function buildActaHtmlForReprint(acta) {
    var dep = getDepLabel(acta.dependencia_id);
    if (dep === '—') dep = limpiarDepLabelViejo(acta.depLabel);
    var compareciente = (acta.destinatario || '').toString().trim() || '—';
    var productLabel = (acta.productLabel || '').toString().trim() || '—';
    var cantidad = acta.cantidad != null ? parseInt(acta.cantidad, 10) : 0;
    var expediente = (acta.expediente || '').toString().trim() || '—';
    var seriales = Array.isArray(acta.seriales) ? acta.seriales : [];
    var d = acta.fecha ? new Date(acta.fecha) : new Date();
    var diaNum = d.getDate();
    var mesIdx = d.getMonth();
    var anio = d.getFullYear();
    var horaNum = d.getHours();
    var diaPalabra = numeroACapitalizar(diaNum);
    var mesNombre = MESES[mesIdx] || '—';
    var anioPalabra = yearEnPalabras(anio);
    var horaPalabra = (horaNum >= 0 && horaNum < 24) ? HORAS_PALABRAS[horaNum] : String(horaNum);
    var cantPalabra = cantidadEnPalabras(cantidad);
    var descripcionProducto = cantidad >= 1 && cantidad <= 30
      ? '(' + (cantidad < 10 ? '0' + cantidad : String(cantidad)) + ') ' + cantPalabra + ' ' + productLabel.toUpperCase()
      : '(' + cantidad + ') ' + productLabel.toUpperCase();
    var lineasSerie = [];
    if (seriales.length > 0) {
      seriales.forEach(function (s, i) {
        var texto = (s.num || '—');
        lineasSerie.push('<span class="acta-editable">' + escapeHtml(texto) + '</span>' + (i < seriales.length - 1 ? '; ' : '.'));
      });
    } else {
      lineasSerie.push('<span class="acta-editable">—</span>');
    }
    return '<div class="acta-documento">' +
      '<div class="acta-logo-wrap"><img src="logito.jpeg" alt="" class="acta-logo"></div>' +
      '<p class="acta-parrafo"><strong>ACTA DE ENTREGA:</strong> En la Ciudad de San Miguel de Tucumán, Departamento Capital, a los <strong><span class="acta-editable">' + diaPalabra + ' días del mes de ' + mesNombre + ' del año ' + anioPalabra + '</span></strong>, siendo horas <strong><span class="acta-editable">' + horaPalabra + '</span></strong>, el funcionario de Policía que suscribe por <span class="acta-editable">—</span>, con prestación de servicio en División Control Bienes Patrimoniales (D-4); asistido en éste acto por el <span class="acta-editable">—</span>, redacto la presente a los fines y efectos legales de dejar debidamente documentado lo siguiente:</p>' +
      '<p class="acta-parrafo">Que en la fecha y hora indicada, se hace comparecer a <span class="acta-editable" contenteditable="true">' + escapeHtml(compareciente) + '</span>, perteneciente a <span class="acta-editable">' + escapeHtml(dep) + '</span>, cumpliendo función de <span class="acta-editable" contenteditable="true">—</span>, a quien se le procede hacer entrega en calidad de <strong>PROVISIÓN</strong>:</p>' +
      '<p class="acta-parrafo"><span class="acta-editable" contenteditable="true">' + escapeHtml(descripcionProducto) + '</span> con sus respectivos <strong>NROS DE SERIE</strong>: ' + lineasSerie.join('') + '</p>' +
      '<p class="acta-parrafo">Bien adquirido mediante EXP. <span class="acta-editable">' + escapeHtml(expediente) + '</span>.</p>' +
      '<p class="acta-parrafo acta-parrafo-final">Así mismo, se le hace conocer que se deberá poner el mayor celo en el cuidado y mantenimiento de dichos elementos a fin que no sufra mayores deterioros más que los causados por el normal. No siendo para más se da por finalizado el acto previa lectura y ratificación de su contenido por parte de los intervinientes lo firman por ante mí en conformidad lo que CERTIFICO.</p>' +
      '<div class="acta-espacio-firmas" aria-label="Espacio reservado para firmas y sellos"></div></div>';
  }

  // Para impresión usamos directamente src="logito.jpeg" relativo a la misma carpeta de actas.html,
  // no hace falta hacer reemplazos ni rutas absolutas.
  function contenidoConLogo(html) {
    return html;
  }

  function abrirModalVerActa(acta) {
    if (!verActaContenido || !modalVerActa) return;
    actaEnVista = acta;
    var html = buildActaHtmlForReprint(acta);
    verActaContenido.innerHTML = contenidoConLogo(html);
    modalVerActa.classList.add('open');
  }

  function cerrarModalVerActa() {
    if (modalVerActa) modalVerActa.classList.remove('open');
    actaEnVista = null;
  }

  function fechaToDatetimeLocal(isoStr) {
    if (!isoStr) return '';
    var d = new Date(isoStr);
    if (isNaN(d.getTime())) return '';
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    var h = String(d.getHours()).padStart(2, '0');
    var min = String(d.getMinutes()).padStart(2, '0');
    return y + '-' + m + '-' + day + 'T' + h + ':' + min;
  }

  function getDepLabel(depId) {
    if (!depId) return '—';
    var d = dependencias.find(function (x) { return x.id === depId; });
    if (!d) return '—';
    var nom = (d.nombre || '').toString().trim();
    var cod = (d.codigo || '').toString().trim();
    return nom || cod || '—';
  }

  function fillDependenciasEditar() {
    if (!selectEditarDep) return;
    var current = selectEditarDep.value;
    selectEditarDep.innerHTML = '<option value="">— Seleccionar dependencia —</option>' + dependencias.map(function (d) {
      var label = getDepLabel(d.id);
      return '<option value="' + (d.id || '') + '">' + (label !== '—' ? label : d.nombre || d.codigo || d.id) + '</option>';
    }).join('');
    if (current && dependencias.some(function (x) { return x.id === current; })) selectEditarDep.value = current;
  }

  function abrirModalEditarActa(acta) {
    actaEnEdicion = acta;
    if (!modalEditarActa || !formEditarActa) return;
    document.getElementById('editar-acta-fecha').value = fechaToDatetimeLocal(acta.fecha);
    document.getElementById('editar-acta-producto').value = (acta.productLabel || '').toString().trim();
    document.getElementById('editar-acta-expediente').value = (acta.expediente || '').toString().trim();
    document.getElementById('editar-acta-cantidad').value = acta.cantidad != null ? String(acta.cantidad) : '1';
    if (selectEditarDep) {
      fillDependenciasEditar();
      selectEditarDep.value = acta.dependencia_id || '';
    }
    modalEditarActa.classList.add('open');
  }

  function cerrarModalEditarActa() {
    if (modalEditarActa) modalEditarActa.classList.remove('open');
    actaEnEdicion = null;
    if (formEditarActa) formEditarActa.reset();
  }

  function imprimirActaDesdeModal() {
    if (!actaEnVista) return;
    var contenido = buildActaHtmlForReprint(actaEnVista);
    contenido = contenidoConLogo(contenido);
    var ventana = window.open('', '_blank');
    if (!ventana) return;
    var estilosActa = '@page{size:21.49cm 31.5cm;margin:1.8cm;} ' +
      'body{font-family:\'Times New Roman\',Times,serif;margin:0;padding:0;color:#111;font-size:16pt;line-height:1.5;box-sizing:border-box;width:21.49cm;min-height:31.5cm;padding:0.5cm 1.8cm 1.8cm 1.8cm;} ' +
      '.acta-documento{font-family:inherit;width:100%;max-width:17.89cm;font-size:16pt;} ' +
      '.acta-logo-wrap{text-align:center;margin-bottom:0.95em;background:#fff;padding:0.05cm 0;} .acta-logo{width:6.1cm;height:auto;max-height:8.8cm;object-fit:contain;display:block;margin:0 auto;background:#fff;} ' +
      '.acta-parrafo{margin:0 0 0.5em;text-align:justify;font-size:16pt;} .acta-parrafo strong{font-weight:700;} .acta-parrafo-final{margin-bottom:1em;} ' +
      '.acta-editable{background:transparent;} ' +
      '.acta-espacio-firmas{min-height:4.2cm;margin-top:1.2em;} ' +
      '@media print{body{width:21.49cm;min-height:31.5cm;padding:0.5cm 1.8cm 1.8cm 1.8cm;font-size:16pt;} .acta-documento{font-size:16pt;} .acta-parrafo{font-size:16pt;} .acta-espacio-firmas{min-height:4.2cm;}}';
    ventana.document.write('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Acta de entrega</title><style>' + estilosActa + '</style></head><body>' + contenido + '</body></html>');
    ventana.document.close();
    ventana.focus();
    setTimeout(function () { ventana.print(); ventana.close(); }, 300);
  }

  function filtrarActas(actas, opciones) {
    opciones = opciones || {};
    var busqueda = opciones.busqueda || '';
    var depId = opciones.dependenciaId || '';
    var desde = opciones.desde || 0;
    var hasta = opciones.hasta || 0;

    var q = busqueda.trim().toLowerCase();
    return (actas || []).filter(function (a) {
      // Filtro por dependencia
      if (depId) {
        var actaDepId = (a.dependencia_id || '').toString();
        if (actaDepId !== depId) return false;
      }

      // Filtro por rango de fechas
      if (desde || hasta) {
        var t = a.fecha ? new Date(a.fecha).getTime() : 0;
        if (desde && t < desde) return false;
        if (hasta && t > hasta) return false;
      }

      // Filtro de texto libre
      if (q) {
        var id = (a.id || '').toString().toLowerCase();
        var fecha = formatFecha(a.fecha).toLowerCase();
        var exp = (a.expediente || '').toString().trim().toLowerCase();
        var depLabel = (getDepLabel(a.dependencia_id) || limpiarDepLabelViejo(a.depLabel) || '').toString().toLowerCase();
        var prod = (a.productLabel || '').toString().trim().toLowerCase();
        var haystack = [id, fecha, exp, depLabel, prod].join(' ');
        if (haystack.indexOf(q) === -1) return false;
      }

      return true;
    });
  }

  function expedienteGrupoKey(a) {
    var s = (a && a.expediente != null) ? String(a.expediente).trim() : '';
    return s ? s : 'Sin expediente';
  }

  function groupActasByExpediente(actas) {
    var map = {};
    (actas || []).forEach(function (a) {
      var key = expedienteGrupoKey(a);
      if (!map[key]) map[key] = [];
      map[key].push(a);
    });
    var grupos = Object.keys(map).map(function (key) {
      var items = map[key].slice().sort(function (a, b) {
        var ta = a.fecha ? new Date(a.fecha).getTime() : 0;
        var tb = b.fecha ? new Date(b.fecha).getTime() : 0;
        return tb - ta;
      });
      return { expediente: key, actas: items };
    });
    grupos.sort(function (g1, g2) {
      var t1 = g1.actas[0] && g1.actas[0].fecha ? new Date(g1.actas[0].fecha).getTime() : 0;
      var t2 = g2.actas[0] && g2.actas[0].fecha ? new Date(g2.actas[0].fecha).getTime() : 0;
      if (t2 !== t1) return t2 - t1;
      return g1.expediente.localeCompare(g2.expediente, 'es', { sensitivity: 'base' });
    });
    return grupos;
  }

  function buildFilaActaHtml(a) {
    var id = (a.id || '').toString().trim() || '—';
    var fecha = formatFecha(a.fecha);
    var dep = getDepLabel(a.dependencia_id);
    if (dep === '—') dep = limpiarDepLabelViejo(a.depLabel);
    var prod = (a.productLabel || '').toString().trim() || '—';
    var modPor = (a.modificadoPor || a.modificado_por || '').toString().trim();
    var notaMod = (esAdmin && modPor)
      ? '<div class="acta-modificada-note">Acta modificada por ' + escapeHtml(modPor) + '</div>'
      : '';
    var tieneAdjunto = !!(a.adjunto && a.adjunto.name);
    var notaAdjunto = tieneAdjunto
      ? '<div class="acta-adjunto-note">Adjunto: ' + escapeHtml(a.adjunto.name) + '</div>'
      : '';
    var cant = a.cantidad != null ? String(a.cantidad) : '1';
    var acciones =
      '<div class="exp-acciones-wrap">' +
        '<button type="button" class="btn btn-icon btn-menu-exp btn-menu-acta" data-acta-id="' + escapeHtml(a.id || '') + '" aria-label="Acciones">&#8942;</button>' +
        '<div class="exp-menu-dropdown exp-menu-acta">' +
          '<button type="button" class="acta-menu-ver" data-acta-id="' + escapeHtml(a.id || '') + '">Ver</button>' +
          '<button type="button" class="acta-menu-ver-adjunto" data-acta-id="' + escapeHtml(a.id || '') + '"' + (tieneAdjunto ? '' : ' disabled') + '>Ver adjunto</button>' +
          '<button type="button" class="acta-menu-adjuntar" data-acta-id="' + escapeHtml(a.id || '') + '">' + (tieneAdjunto ? 'Reemplazar adjunto' : 'Adjuntar archivo') + '</button>' +
          '<button type="button" class="acta-menu-editar" data-acta-id="' + escapeHtml(a.id || '') + '">Modificar</button>' +
          '<button type="button" class="acta-menu-eliminar" data-acta-id="' + escapeHtml(a.id || '') + '">Eliminar</button>' +
        '</div>' +
      '</div>';
    return '<tr><td>' + escapeHtml(id) + '</td><td>' + escapeHtml(fecha) + '</td><td>' + escapeHtml(dep) + '</td><td>' + escapeHtml(prod) + notaMod + notaAdjunto + '</td><td class="num-col">' + escapeHtml(cant) + '</td><td class="td-acciones-exp">' + acciones + '</td></tr>';
  }

  function closeActaExpMenu(btn, dropdown) {
    if (!dropdown) return;
    dropdown.classList.remove('exp-menu-open', 'exp-menu-fixed', 'exp-menu-flip-up');
    dropdown.style.position = '';
    dropdown.style.top = '';
    dropdown.style.right = '';
    dropdown.style.left = '';
    dropdown.style.bottom = '';
    dropdown.style.visibility = '';
    dropdown.style.display = '';
    var carpeta = btn ? btn.closest('.actas-carpeta') : dropdown.closest('.actas-carpeta');
    if (carpeta) carpeta.classList.remove('actas-carpeta-menu-open');
  }

  function closeAllActaExpMenus(rootEl) {
    var scope = rootEl || document;
    scope.querySelectorAll('.btn-menu-acta').forEach(function (btn) {
      var wrap = btn.closest('.exp-acciones-wrap');
      var dropdown = wrap ? wrap.querySelector('.exp-menu-acta') : null;
      if (dropdown && dropdown.classList.contains('exp-menu-open')) closeActaExpMenu(btn, dropdown);
    });
  }

  function openActaExpMenu(btn, dropdown) {
    if (!btn || !dropdown) return;
    dropdown.classList.add('exp-menu-open', 'exp-menu-fixed');
    var carpeta = btn.closest('.actas-carpeta');
    if (carpeta) carpeta.classList.add('actas-carpeta-menu-open');

    dropdown.style.visibility = 'hidden';
    dropdown.style.display = 'block';
    var ddH = dropdown.offsetHeight;
    dropdown.style.visibility = '';
    dropdown.style.display = '';

    var rect = btn.getBoundingClientRect();
    var gap = 6;
    var spaceBelow = window.innerHeight - rect.bottom - gap;
    var spaceAbove = rect.top - gap;
    var flipUp = spaceBelow < ddH && spaceAbove >= spaceBelow;

    dropdown.style.left = 'auto';
    dropdown.style.bottom = 'auto';
    dropdown.style.right = Math.max(gap, window.innerWidth - rect.right) + 'px';
    if (flipUp) {
      dropdown.classList.add('exp-menu-flip-up');
      dropdown.style.top = Math.max(gap, rect.top - ddH - gap) + 'px';
    } else {
      dropdown.classList.remove('exp-menu-flip-up');
      dropdown.style.top = Math.min(window.innerHeight - ddH - gap, rect.bottom + gap) + 'px';
    }
  }

  function bindActasRowMenus(rootEl) {
    if (!rootEl) return;
    rootEl.querySelectorAll('.btn-menu-acta').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var wrap = btn.closest('.exp-acciones-wrap');
        var dropdown = wrap ? wrap.querySelector('.exp-menu-acta') : null;
        if (!dropdown) return;
        var wasOpen = dropdown.classList.contains('exp-menu-open');
        closeAllActaExpMenus(rootEl);
        if (!wasOpen) openActaExpMenu(btn, dropdown);
      });
    });

    rootEl.querySelectorAll('.acta-menu-ver, .acta-menu-ver-adjunto, .acta-menu-adjuntar, .acta-menu-editar, .acta-menu-eliminar').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        closeAllActaExpMenus(rootEl);
      });
    });

    rootEl.querySelectorAll('.acta-menu-ver').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var actaId = btn.getAttribute('data-acta-id');
        var acta = todasLasActas.find(function (a) { return (a.id || '') === actaId; });
        if (acta) abrirModalVerActa(acta);
      });
    });
    rootEl.querySelectorAll('.acta-menu-editar').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var actaId = btn.getAttribute('data-acta-id');
        var acta = todasLasActas.find(function (a) { return (a.id || '') === actaId; });
        if (acta) abrirModalEditarActa(acta);
      });
    });
    rootEl.querySelectorAll('.acta-menu-adjuntar').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var actaId = btn.getAttribute('data-acta-id');
        if (!actaId || !window.stockAPI.pickActaAdjunto) return;
        if (btn.dataset && btn.dataset.submitting === '1') return;
        if (btn.dataset) btn.dataset.submitting = '1';
        btn.disabled = true;
        if (window.appLoading && window.appLoading.show) window.appLoading.show('Adjuntando archivo…');
        window.stockAPI.pickActaAdjunto(actaId).then(function (res) {
          if (!res || res.canceled) return;
          loadActas();
        }).catch(function (err) {
          alert(err && err.message ? err.message : 'No se pudo adjuntar el archivo');
        }).finally(function () {
          if (window.appLoading && window.appLoading.hide) window.appLoading.hide();
          if (btn.dataset) btn.dataset.submitting = '0';
          btn.disabled = false;
        });
      });
    });
    rootEl.querySelectorAll('.acta-menu-ver-adjunto').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var actaId = btn.getAttribute('data-acta-id');
        if (!actaId || !window.stockAPI.openActaAdjunto) return;
        window.stockAPI.openActaAdjunto(actaId).catch(function (err) {
          alert(err && err.message ? err.message : 'No se pudo abrir el adjunto');
        });
      });
    });
    rootEl.querySelectorAll('.acta-menu-eliminar').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var actaId = btn.getAttribute('data-acta-id');
        if (!actaId) return;
        if (btn.dataset && btn.dataset.deleting === '1') return;
        if (!confirm('¿Seguro que querés eliminar esta acta?')) return;
        if (btn.dataset) {
          btn.dataset.deleting = '1';
          btn.disabled = true;
        }
        if (window.appLoading && window.appLoading.show) window.appLoading.show('Eliminando acta…');
        window.stockAPI.deleteActa(actaId).then(function () {
          todasLasActas = (todasLasActas || []).filter(function (a) { return (a.id || '') !== actaId; });
          aplicarFiltro();
        }).catch(function (err) {
          alert(err && err.message ? err.message : 'Error al eliminar');
        }).finally(function () {
          if (window.appLoading && window.appLoading.hide) window.appLoading.hide();
          if (btn.dataset) {
            btn.dataset.deleting = '0';
            btn.disabled = false;
          }
        });
      });
    });
  }

  function renderActas(actas) {
    if (!contenedorActas) return;
    actas = actas || [];
    if (emptyActas) emptyActas.style.display = actas.length ? 'none' : 'block';
    if (!actas.length) {
      contenedorActas.innerHTML = '';
      var pcActE = document.getElementById('pag-actas');
      if (pcActE) pcActE.innerHTML = '';
      return;
    }
    var grupos = groupActasByExpediente(actas);
    if (!grupos.length) {
      contenedorActas.innerHTML = '';
      var pcActE2 = document.getElementById('pag-actas');
      if (pcActE2) pcActE2.innerHTML = '';
      return;
    }

    var infoGrupos = window.Paginacion
      ? window.Paginacion.paginar(grupos, pagActas, PAG_CARPETAS_EXP)
      : { items: grupos, pagina: 1, totalPaginas: 1, total: grupos.length, inicio: 1, fin: grupos.length };
    pagActas = infoGrupos.pagina;

    var theadInner =
      '<thead><tr>' +
      '<th>Nº ID</th><th>Fecha</th><th>Dependencia</th><th>Producto</th><th class="num-col">Cant.</th><th>Acciones</th>' +
      '</tr></thead>';

    contenedorActas.innerHTML = infoGrupos.items.map(function (g) {
      var n = g.actas.length;
      var suf = n === 1 ? 'acta' : 'actas';
      var filas = g.actas.map(buildFilaActaHtml).join('');
      return (
        '<details class="actas-carpeta">' +
          '<summary class="actas-carpeta-summary">' +
            '<span class="actas-carpeta-icon" aria-hidden="true">📁</span>' +
            '<span class="actas-carpeta-titulo">' + escapeHtml(g.expediente) + '</span>' +
            '<span class="actas-carpeta-badge">' + n + ' ' + suf + '</span>' +
          '</summary>' +
          '<div class="actas-carpeta-body">' +
            '<table class="data-table actas-carpeta-tabla">' + theadInner + '<tbody>' + filas + '</tbody></table>' +
          '</div>' +
        '</details>'
      );
    }).join('');

    bindActasRowMenus(contenedorActas);

    var pcAct = document.getElementById('pag-actas');
    if (pcAct && window.Paginacion) {
      window.Paginacion.renderControles(pcAct, infoGrupos, function (p) {
        pagActas = p;
        renderActas(actas);
      });
    }
  }

  if (btnImprimirActaVista) btnImprimirActaVista.addEventListener('click', imprimirActaDesdeModal);
  document.querySelectorAll('.modal-ver-acta-close').forEach(function (btn) {
    if (btn) btn.addEventListener('click', cerrarModalVerActa);
  });
  if (modalVerActa) {
    modalVerActa.addEventListener('click', function (e) {
      if (e.target === modalVerActa) cerrarModalVerActa();
    });
  }

  function fillFiltroDependencias() {
    var selectFiltro = document.getElementById('filtro-actas-dependencia');
    if (!selectFiltro) return;
    var current = selectFiltro.value;
    var opciones = ['<option value="">Todas</option>'];
    dependencias.forEach(function (d) {
      if (!d || !d.id) return;
      var label = getDepLabel(d.id);
      opciones.push('<option value="' + String(d.id) + '">' + escapeHtml(label !== '—' ? label : (d.nombre || d.codigo || d.id)) + '</option>');
    });
    selectFiltro.innerHTML = opciones.join('');
    if (current && dependencias.some(function (d) { return d && String(d.id) === current; })) {
      selectFiltro.value = current;
    }
  }

  function aplicarFiltro() {
    var busqueda = inputBuscarActas ? inputBuscarActas.value : '';
    var selectFiltroDep = document.getElementById('filtro-actas-dependencia');
    var inputDesde = document.getElementById('filtro-actas-desde');
    var inputHasta = document.getElementById('filtro-actas-hasta');

    var depId = selectFiltroDep ? (selectFiltroDep.value || '') : '';
    var desdeVal = inputDesde && inputDesde.value ? inputDesde.value + 'T00:00:00' : '';
    var hastaVal = inputHasta && inputHasta.value ? inputHasta.value + 'T23:59:59' : '';
    var desde = desdeVal ? new Date(desdeVal).getTime() : 0;
    var hasta = hastaVal ? new Date(hastaVal).getTime() : 0;

    var filtradas = filtrarActas(todasLasActas, {
      busqueda: busqueda,
      dependenciaId: depId,
      desde: desde,
      hasta: hasta
    });
    renderActas(filtradas);
  }

  function loadActas() {
    if (window.appLoading && window.appLoading.show) window.appLoading.show('Cargando actas…');
    var getDataPromise = window.stockAPI.getData();
    var getDepsPromise = window.stockAPI.getDependencias ? window.stockAPI.getDependencias() : Promise.resolve([]);
    Promise.all([getDataPromise, getDepsPromise]).then(function (results) {
      var data = results[0] || {};
      dependencias = results[1] || [];
      fillFiltroDependencias();
      todasLasActas = (data && data.actas) ? data.actas : [];
      aplicarFiltro();
    }).catch(function () {
      todasLasActas = [];
      dependencias = [];
      renderActas([]);
    }).finally(function () {
      if (window.appLoading && window.appLoading.hide) window.appLoading.hide();
    });
  }

  if (formEditarActa) {
    formEditarActa.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!actaEnEdicion) return;
      var submitBtn = formEditarActa.querySelector('button[type="submit"]');
      if (submitBtn && submitBtn.dataset && submitBtn.dataset.submitting === '1') return;
      if (submitBtn && submitBtn.dataset) submitBtn.dataset.submitting = '1';
      if (submitBtn) {
        if (submitBtn.dataset && !submitBtn.dataset.originalSubmitLabel) {
          submitBtn.dataset.originalSubmitLabel = submitBtn.textContent;
        }
        submitBtn.textContent = 'Guardando…';
        submitBtn.disabled = true;
      }
      var fechaInput = document.getElementById('editar-acta-fecha').value;
      var fechaIso = fechaInput ? new Date(fechaInput).toISOString() : (actaEnEdicion.fecha || new Date().toISOString());
      var dependenciaId = selectEditarDep ? selectEditarDep.value : '';
      var dep = dependencias.find(function (d) { return d.id === dependenciaId; });
      var depLabel = dep ? getDepLabel(dep.id) : (actaEnEdicion.depLabel || '');
      var payload = {
        id: actaEnEdicion.id,
        fecha: fechaIso,
        dependencia_id: dependenciaId || null,
        depLabel: depLabel,
        productLabel: document.getElementById('editar-acta-producto').value.trim(),
        expediente: document.getElementById('editar-acta-expediente').value.trim(),
        cantidad: parseInt(document.getElementById('editar-acta-cantidad').value, 10) || 1,
        seriales: Array.isArray(actaEnEdicion.seriales) ? actaEnEdicion.seriales : [],
        concepto: actaEnEdicion.concepto || null,
        provision_id: actaEnEdicion.provision_id || null,
        modificadoPor: usuarioActual || 'admin',
        modificadoEn: new Date().toISOString()
      };
      if (window.appLoading && window.appLoading.show) window.appLoading.show('Guardando acta…');
      window.stockAPI.saveActa(payload).then(function () {
        cerrarModalEditarActa();
        loadActas();
      }).catch(function (err) {
        alert(err && err.message ? err.message : 'Error al guardar');
      }).finally(function () {
        if (window.appLoading && window.appLoading.hide) window.appLoading.hide();
        if (submitBtn) {
          if (submitBtn.dataset) submitBtn.dataset.submitting = '0';
          if (submitBtn.dataset && submitBtn.dataset.originalSubmitLabel != null) {
            submitBtn.textContent = submitBtn.dataset.originalSubmitLabel;
          }
          submitBtn.disabled = false;
        }
      });
    });
  }

  document.querySelectorAll('.modal-editar-acta-close').forEach(function (el) {
    if (el) el.addEventListener('click', cerrarModalEditarActa);
  });
  if (modalEditarActa) {
    modalEditarActa.addEventListener('click', function (e) {
      if (e.target === modalEditarActa) cerrarModalEditarActa();
    });
  }

  if (inputBuscarActas) inputBuscarActas.addEventListener('input', function () { pagActas = 1; aplicarFiltro(); });

  // Listeners filtros avanzados
  var filtroDep = document.getElementById('filtro-actas-dependencia');
  var filtroDesde = document.getElementById('filtro-actas-desde');
  var filtroHasta = document.getElementById('filtro-actas-hasta');
  var btnLimpiar = document.getElementById('filtro-actas-limpiar');

  if (filtroDep) filtroDep.addEventListener('change', function () { pagActas = 1; aplicarFiltro(); });
  if (filtroDesde) filtroDesde.addEventListener('change', function () { pagActas = 1; aplicarFiltro(); });
  if (filtroHasta) filtroHasta.addEventListener('change', function () { pagActas = 1; aplicarFiltro(); });
  if (btnLimpiar) {
    btnLimpiar.addEventListener('click', function () {
      if (inputBuscarActas) inputBuscarActas.value = '';
      if (filtroDep) filtroDep.value = '';
      if (filtroDesde) filtroDesde.value = '';
      if (filtroHasta) filtroHasta.value = '';
      pagActas = 1;
      aplicarFiltro();
    });
  }

  document.addEventListener('click', function () {
    closeAllActaExpMenus(contenedorActas);
  });
  window.addEventListener('resize', function () {
    closeAllActaExpMenus(contenedorActas);
  });
  window.addEventListener('scroll', function () {
    closeAllActaExpMenus(contenedorActas);
  }, true);

  // Cargamos primero el rol/usuario para saber si mostramos la nota de "acta modificada"
  if (window.stockAPI.getAuthStatus) {
    window.stockAPI.getAuthStatus().then(function (r) {
      var rol = (r && r.rol ? r.rol : 'usuario').toLowerCase();
      esAdmin = rol === 'admin';
      usuarioActual = (r && (r.username || r.email || '')) || '';
      loadActas();
    }).catch(function () {
      loadActas();
    });
  } else {
    loadActas();
  }

  window._realtimeRefresh = function (table) {
    if (!table || table === 'actas') loadActas();
  };
})();
