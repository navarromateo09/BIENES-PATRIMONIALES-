(function () {
  'use strict';

  const listaDependencias = document.getElementById('lista-dependencias');
  const formDependencia = document.getElementById('form-dependencia');
  const inputId = document.getElementById('dependencia-id');
  const inputNombre = document.getElementById('dependencia-nombre');
  const inputCodigo = document.getElementById('dependencia-codigo');
  const inputParent = document.getElementById('dependencia-parent');
  const wrapCodigo = document.getElementById('wrap-dependencia-codigo');
  const inputNumeroDiv = document.getElementById('dependencia-numero-div');
  const wrapNumeroDiv = document.getElementById('wrap-dependencia-numero-div');
  const btnCancelar = document.getElementById('btn-cancelar-dependencia');
  const inputBuscarDeps = document.getElementById('buscar-dependencias');
  const btnImportarDependencias = document.getElementById('btn-importar-dependencias');
  const inputImportarDependencias = document.getElementById('input-importar-dependencias');

  var modalEnvios = document.getElementById('modal-envios-dependencia');
  var modalEnviosTitulo = document.getElementById('modal-envios-dependencia-titulo');
  var listaEnviosDep = document.getElementById('lista-envios-dependencia');
  var modalEnviosEmpty = document.getElementById('modal-envios-dependencia-empty');

  var modalAgregarDep = document.getElementById('modal-agregar-dependencia');
  var formAgregarDep = document.getElementById('form-agregar-dependencia');
  var inputNuevaDepNombre = document.getElementById('nueva-dep-nombre');
  var inputNuevaDepCodigo = document.getElementById('nueva-dep-codigo');
  var modalAgregarDepParentId = document.getElementById('modal-agregar-dep-parent-id');
  var inputDivisionNumero = document.getElementById('nueva-division-numero');
  var inputDivisionNombre = document.getElementById('nueva-division-nombre');
  var listaDivisionesNueva = document.getElementById('lista-divisiones-nueva');

  var cachedData = { productos: [], movimientos: [], dependencias: [] };
  var divisionesNuevaTemp = [];
  var expandedDepIds = {};
  var esAdmin = false;

  var btnGuardarDependencia = document.getElementById('btn-guardar-dependencia');

  // Excluir solo filas cuyo id sea de la convención TXT (tabla dependencias con duplicados históricos).
  // Las dependencias nuevas desde este módulo usan id estable "dep-{codigo}" y NO deben ocultarse.
  var TXT_ID_PREFIXES_EXCLUIR = ['txt-dep-'];

  function isTxtItem(dep) {
    if (!dep || dep.id == null) return false;
    var id = String(dep.id);
    return TXT_ID_PREFIXES_EXCLUIR.some(function (p) { return id.indexOf(p) === 0; });
  }

  function setGuardarDependenciaEnabled(enabled) {
    if (!btnGuardarDependencia) return;
    btnGuardarDependencia.disabled = !enabled;
  }

  function getDisplayLabel(dep, deps) {
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
    var label = getDisplayLabel(dep, deps).toLowerCase();
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

  function showToast(message, type) {
    var existing = document.querySelector('.toast');
    if (existing) existing.remove();
    var toast = document.createElement('div');
    toast.className = 'toast ' + (type || 'success');
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function () { toast.remove(); }, 3500);
  }

  function canManageDependencias() {
    return esAdmin === true;
  }

  function requireAdminAction(message) {
    if (canManageDependencias()) return true;
    showToast(message || 'Solo admin puede editar o eliminar dependencias.', 'error');
    return false;
  }

  function slugify(text) {
    return String(text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .trim();
  }

  function splitCsvLine(line) {
    var out = [];
    var current = '';
    var inQuotes = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        out.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    out.push(current);
    return out.map(function (x) { return String(x || '').trim(); });
  }

  function safeRead(record, keys) {
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (record[k] != null && String(record[k]).trim() !== '') return String(record[k]).trim();
    }
    return '';
  }

  function parseDependenciasCsvImport(text) {
    var lines = String(text || '').replace(/\r/g, '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    if (lines.length < 2) return [];
    var headers = splitCsvLine(lines[0]).map(function (h) { return h.toLowerCase(); });
    var records = [];
    for (var i = 1; i < lines.length; i++) {
      var cols = splitCsvLine(lines[i]);
      if (!cols.length) continue;
      var row = {};
      headers.forEach(function (h, idx) { row[h] = cols[idx] != null ? cols[idx] : ''; });
      records.push(row);
    }

    var ts = Date.now().toString();
    var parsed = [];
    records.forEach(function (r, idx) {
      var nombre = safeRead(r, ['nombre', 'name']).toUpperCase();
      var codigo = safeRead(r, ['codigo', 'cod', 'id_principal', 'codigo_principal']);
      var parentId = safeRead(r, ['parentid', 'parent_id', 'padre', 'dependencia_padre']) || null;
      var numero = safeRead(r, ['numero', 'num', 'nro', 'n']);
      var id = safeRead(r, ['id']);
      if (!nombre) return;
      if (!id) {
        var base = slugify((codigo ? codigo + '-' : '') + nombre) || ('fila-' + idx);
        id = 'impdep-' + ts + '-' + base;
      }
      parsed.push({
        id: id,
        nombre: nombre,
        codigo: codigo || '',
        parentId: parentId,
        numero: numero || ''
      });
    });
    return parsed;
  }

  function parseDependenciasTxtImport(text) {
    var lines = String(text || '').replace(/\r/g, '').split('\n');
    var ts = Date.now().toString();
    var records = [];
    var stack = []; // [{ level, id }]
    var rowIdx = 0;

    lines.forEach(function (rawLine) {
      if (!rawLine || !rawLine.trim()) return;
      if (rawLine.trim().indexOf('#') === 0) return;

      var indentMatch = rawLine.match(/^\s*/);
      var indent = indentMatch ? indentMatch[0] : '';
      var level = Math.floor(indent.replace(/\t/g, '  ').length / 2);

      var line = rawLine.trim().replace(/^[-*]\s*/, '');
      if (!line) return;

      // Formato recomendado: NOMBRE|CODIGO|NUMERO
      var parts = line.split('|').map(function (x) { return String(x || '').trim(); });
      var nombre = (parts[0] || '').toUpperCase();
      var codigo = parts[1] || '';
      var numero = parts[2] || '';
      if (!nombre) return;

      while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
      var parentId = stack.length ? stack[stack.length - 1].id : null;
      var base = slugify((codigo ? codigo + '-' : '') + nombre) || ('fila-' + rowIdx);
      var id = 'impdep-' + ts + '-' + rowIdx + '-' + base;
      rowIdx++;

      records.push({
        id: id,
        nombre: nombre,
        codigo: codigo,
        parentId: parentId,
        numero: numero
      });

      stack.push({ level: level, id: id });
    });

    return records;
  }

  function readFileAsText(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '')); };
      reader.onerror = function (e) { reject(e); };
      reader.readAsText(file, 'utf-8');
    });
  }

  async function importarDependenciasDesdeArchivo(file) {
    if (!file) return;
    var fileName = (file.name || '').toString();
    var ext = (fileName.split('.').pop() || '').toLowerCase();
    if (ext !== 'csv' && ext !== 'txt') {
      showToast('Formato no soportado. Usa .csv o .txt', 'error');
      return;
    }

    try {
      if (!confirm('Importar "' + fileName + '" en la pestaña Dependencias? Esto NO afecta la pestaña TXT.')) return;
      if (window.appLoading && window.appLoading.show) window.appLoading.show('Leyendo archivo…');
      var text = await readFileAsText(file);
      var rows = ext === 'csv' ? parseDependenciasCsvImport(text) : parseDependenciasTxtImport(text);
      if (!rows.length) {
        showToast('No se encontraron registros para importar.', 'error');
        return;
      }

      // Si un ítem tiene parentId vacío y parece división con número, lo dejamos igual.
      // El importador respeta parentId explícito (CSV) o jerarquía por indentación (TXT).
      if (!confirm('Se importarán ' + rows.length + ' registros en Dependencias. ¿Continuar?')) return;
      if (window.appLoading && window.appLoading.show) window.appLoading.show('Importando dependencias…');
      if (window.stockAPI && window.stockAPI.importDependencias) {
        await window.stockAPI.importDependencias(rows);
      } else {
        for (var i = 0; i < rows.length; i++) {
          await window.stockAPI.saveDependencia(rows[i]);
        }
      }
      showToast('Importación completada: ' + rows.length + ' registros.');
      run();
    } catch (e) {
      console.error('[Dependencias] importación ERROR:', e);
      showToast('Error al importar estructura', 'error');
    } finally {
      if (window.appLoading && window.appLoading.hide) window.appLoading.hide();
    }
  }

  function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async function loadDependencias() {
    try {
      console.log('[Dependencias] loadDependencias: llamando getDependencias...');
      var deps = await window.stockAPI.getDependencias();
      console.log('[Dependencias] loadDependencias: ok, cantidad:', deps && deps.length);
      return deps;
    } catch (e) {
      console.error('[Dependencias] loadDependencias ERROR:', e);
      console.error('[Dependencias] loadDependencias ERROR message:', e && e.message);
      console.error('[Dependencias] loadDependencias ERROR stack:', e && e.stack);
      showToast('Error al cargar dependencias', 'error');
      return [];
    }
  }

  async function loadFullData() {
    try {
      console.log('[Dependencias] loadFullData: llamando datos de envíos...');
      var data;
      if (window.invokeStockLightOrFull) {
        data = await window.invokeStockLightOrFull('getDependenciasStatsData', function () {
          return window.stockAPI.getData().then(function (d) {
            return {
              productos: (d && d.productos) || [],
              movimientos: (d && d.movimientos) || [],
              guardiaProvisiones: (d && d.guardiaProvisiones) || []
            };
          });
        });
      } else if (window.stockAPI.getData) {
        data = await window.stockAPI.getData();
      }
      if (data) {
        cachedData.productos = data.productos || [];
        cachedData.movimientos = data.movimientos || [];
        cachedData.guardiaProvisiones = data.guardiaProvisiones || [];
        console.log('[Dependencias] loadFullData: ok, productos:', cachedData.productos.length, 'movimientos:', cachedData.movimientos.length, 'guardia:', cachedData.guardiaProvisiones.length);
      }
    } catch (e) {
      console.error('[Dependencias] loadFullData ERROR:', e);
      console.error('[Dependencias] loadFullData ERROR message:', e && e.message);
    }
  }

  function formatFechaEnvios(fechaStr) {
    if (!fechaStr) return '—';
    var d = new Date(fechaStr);
    if (isNaN(d.getTime())) return '—';
    var day = d.getDate();
    var month = d.getMonth() + 1;
    var year = String(d.getFullYear()).slice(-2);
    return day + '/' + month + '/' + year;
  }

  function formatFechaYHora(fechaStr) {
    if (!fechaStr) return '—';
    var d = new Date(fechaStr);
    if (isNaN(d.getTime())) return '—';
    var day = String(d.getDate()).padStart(2, '0');
    var month = String(d.getMonth() + 1).padStart(2, '0');
    var year = String(d.getFullYear()).slice(-2);
    var h = String(d.getHours()).padStart(2, '0');
    var min = String(d.getMinutes()).padStart(2, '0');
    return day + '/' + month + '/' + year + ' ' + h + ':' + min;
  }

  async function openModalEnvios(dep, deps) {
    if (window.appLoading && window.appLoading.show) window.appLoading.show('Cargando envíos…');
    try {
      await loadFullData();
    } finally {
      if (window.appLoading && window.appLoading.hide) window.appLoading.hide();
    }
    console.log('[Dependencias] openModalEnvios, dep:', dep && dep.id, dep && dep.nombre);
    var label = getDisplayLabel(dep, deps || cachedData.dependencias);
    if (modalEnviosTitulo) modalEnviosTitulo.textContent = 'Envíos a ' + label;

    var salidas = (cachedData.movimientos || []).filter(function (m) {
      return m.tipo === 'salida' && ((m.destino || '').trim() === label);
    });
    salidas.sort(function (a, b) { return new Date(b.fecha || 0) - new Date(a.fecha || 0); });

    var provisionesGuardia = (cachedData.guardiaProvisiones || []).filter(function (p) {
      return p.dependencia_id === dep.id;
    });
    provisionesGuardia.sort(function (a, b) { return new Date(b.fecha_asignacion || 0) - new Date(a.fecha_asignacion || 0); });

    function getProductoNombre(productoId) {
      if (!productoId) return 'producto';
      var p = (cachedData.productos || []).find(function (x) { return x.id === productoId; });
      return (p && (p.nombre || p.codigo)) ? (p.nombre || p.codigo) : 'producto';
    }

    function getProductoLabel(prod) {
      if (!prod) return '';
      var parts = [(prod.codigo || '').trim(), (prod.nombre || '').trim()].filter(Boolean);
      return parts.join(' - ') || prod.nombre || prod.codigo || '';
    }

    var totalItems = salidas.length + provisionesGuardia.length;
    if (modalEnviosEmpty) modalEnviosEmpty.style.display = totalItems ? 'none' : 'block';
    if (!listaEnviosDep) return;

    var html = '';
    if (salidas.length) {
      html += '<li class="item-envio-dep item-envio-dep-titulo"><strong>Entregas (salidas)</strong></li>';
      html += salidas.map(function (m) {
        var cantidad = m.cantidad != null ? String(m.cantidad) : '—';
        var producto = getProductoNombre(m.productoId);
        var fecha = formatFechaEnvios(m.fecha);
        var texto = 'Le entregué ' + escapeHtml(cantidad) + ' ' + escapeHtml(producto) + ' el día ' + escapeHtml(fecha);
        return '<li class="item-envio-dep">' + texto + '</li>';
      }).join('');
    }
    if (provisionesGuardia.length) {
      html += '<li class="item-envio-dep item-envio-dep-titulo"><strong>Productos provistos (guardia)</strong></li>';
      html += '<li class="item-envio-dep item-envio-dep-table-wrap"><table class="data-table tabla-provisiones-guardia"><thead><tr><th>Nombre</th><th>Código</th><th>Expediente</th><th>Características</th><th>Cantidad</th><th>Día de entrega y horario</th></tr></thead><tbody>';
      html += provisionesGuardia.map(function (p) {
        var prod = (cachedData.productos || []).find(function (x) { return x.id === p.producto_id; });
        var nombre = '—';
        var codigo = '—';
        var caracteristicas = '—';
        var expediente = prod ? ((prod.codigo != null ? String(prod.codigo) : '').trim() || '—') : '—';
        if (p.movimiento_id && (cachedData.movimientos || []).length) {
          var mov = (cachedData.movimientos || []).find(function (x) { return x.id === p.movimiento_id; });
          if (mov) {
            nombre = (mov.nombre != null ? String(mov.nombre).trim() : '') || '—';
            codigo = (mov.numeroSerie != null ? String(mov.numeroSerie).trim() : '') || '—';
            var carParts = [];
            var marca = (mov.marca != null ? String(mov.marca) : '').trim();
            var serie = (mov.numeroSerie != null ? String(mov.numeroSerie) : '').trim();
            var concepto = (mov.concepto != null ? String(mov.concepto) : '').trim();
            if (marca) carParts.push('Marca: ' + marca);
            if (serie) carParts.push('Serie: ' + serie);
            if (concepto) carParts.push(concepto);
            caracteristicas = carParts.join(' · ') || '—';
          }
        } else {
          nombre = prod ? ((prod.nombre != null ? String(prod.nombre).trim() : '') || 'Expediente completo') : '—';
          codigo = expediente;
          caracteristicas = prod ? ((prod.descripcion != null ? String(prod.descripcion).trim() : '') || '—') : '—';
        }
        var cantidad = p.cantidad != null ? p.cantidad : 1;
        var diaEntrega = formatFechaYHora(p.fecha_asignacion);
        return '<tr><td>' + escapeHtml(nombre) + '</td><td>' + escapeHtml(codigo) + '</td><td>' + escapeHtml(expediente) + '</td><td>' + escapeHtml(caracteristicas) + '</td><td>' + cantidad + '</td><td>' + escapeHtml(diaEntrega) + '</td></tr>';
      }).join('');
      html += '</tbody></table></li>';
    }
    listaEnviosDep.innerHTML = html || '';

    if (modalEnvios) modalEnvios.classList.add('open');
  }

  function closeModalEnvios() {
    if (modalEnvios) modalEnvios.classList.remove('open');
  }

  function renderLista(deps) {
    if (!listaDependencias) return;

    if (inputParent) {
      var mainDeps = getMainDeps(deps);
      inputParent.innerHTML = '<option value="">— Dependencia principal —</option>' + mainDeps.map(function (d) {
        return '<option value="' + escapeHtml(d.id) + '">' + escapeHtml(getDisplayLabel(d, deps)) + '</option>';
      }).join('');
    }

    var busqueda = (inputBuscarDeps && inputBuscarDeps.value || '').trim().toLowerCase();

    if (!deps.length) {
      listaDependencias.innerHTML = '<tr><td colspan="3" class="empty-state"><p>No hay dependencias. Agrega una con el formulario de arriba.</p></td></tr>';
      return;
    }

    var rows = [];
    var mainDeps = getMainDeps(deps);
    var algunaFila = false;
    mainDeps.forEach(function (d) {
      var divisiones = getDivisiones(deps, d.id);
      var mainMatch = depMatchesBusqueda(d, deps, busqueda, null);
      var divisionesFiltradas = busqueda
        ? divisiones.filter(function (div) {
          // Si la división principal no matchea, igual la mostramos si tiene sub-divisiones que matchean.
          var matchDivision = depMatchesBusqueda(div, deps, busqueda, d);
          if (matchDivision) return true;
          var subDivs = getDivisiones(deps, div.id);
          return (subDivs || []).some(function (sub) { return depMatchesBusqueda(sub, deps, busqueda, div); });
        })
        : divisiones;
      var algunaDivisionMatch = divisionesFiltradas.length > 0;
      if (busqueda && !mainMatch && !algunaDivisionMatch) return;
      algunaFila = true;

      var label = getDisplayLabel(d, deps);
      var nombre = (d.nombre || '').trim() || '—';
      var divisionesARenderizar = busqueda && !mainMatch ? divisionesFiltradas : divisiones;
      var isExpanded = !!expandedDepIds[d.id];
      var arrowClass = isExpanded ? 'arrow-expanded' : 'arrow-collapsed';
      var arrowLabel = isExpanded ? '▼' : '▶';
      var acciones = '<button type="button" class="btn btn-secondary btn-sm btn-ver-envios-dep" data-id="' + escapeHtml(d.id) + '" data-nombre="' + escapeHtml(nombre) + '" data-label="' + escapeHtml(label) + '">Ver envíos</button>';
      if (canManageDependencias()) {
        acciones += ' <button type="button" class="btn btn-secondary btn-sm btn-agregar-division" data-id="' + escapeHtml(d.id) + '">+ División</button> <div class="dep-acciones-wrap"><button type="button" class="btn btn-icon btn-menu-dep" data-id="' + escapeHtml(d.id) + '" aria-label="Más acciones" title="Acciones">&#8942;</button><div class="dep-menu-dropdown"><button type="button" class="dep-menu-editar" data-id="' + escapeHtml(d.id) + '">Editar</button><button type="button" class="dep-menu-eliminar" data-id="' + escapeHtml(d.id) + '">Eliminar</button></div></div>';
      }
      var celdaIdentificador = '';
      if (divisiones.length > 0) {
        celdaIdentificador = '<button type="button" class="btn-flecha-dep ' + arrowClass + '" data-id="' + escapeHtml(d.id) + '" aria-label="Ver subdivisiones" title="Ver subdivisiones">' + arrowLabel + '</button> <button type="button" class="link-dependencia" data-id="' + escapeHtml(d.id) + '" data-label="' + escapeHtml(label) + '" title="Ver envíos">' + escapeHtml(label) + '</button>';
      } else {
        celdaIdentificador = '<span class="btn-flecha-dep-placeholder"></span> <button type="button" class="link-dependencia" data-id="' + escapeHtml(d.id) + '" data-label="' + escapeHtml(label) + '" title="Ver envíos">' + escapeHtml(label) + '</button>';
      }
      rows.push('<tr class="main-dep-row" data-dep-id="' + escapeHtml(d.id) + '"><td>' + celdaIdentificador + '</td><td>' + escapeHtml(nombre) + '</td><td>' + acciones + '</td></tr>');
      var hasSomeSubDivs = divisionesARenderizar.some(function (div) {
        return getDivisiones(deps, div.id).length > 0;
      });
      divisionesARenderizar.forEach(function (div, idx) {
        var isLast = idx === divisionesARenderizar.length - 1;
        var divLabel = getDisplayLabel(div, deps);
        var divNombre = (div.nombre || '').trim() || '—';
        var subDivs = getDivisiones(deps, div.id);
        var subDivsARenderizar = busqueda
          ? (subDivs || []).filter(function (sub) { return depMatchesBusqueda(sub, deps, busqueda, div); })
          : (subDivs || []);
        var divAcciones = '<button type="button" class="btn btn-secondary btn-sm btn-ver-envios-dep" data-id="' + escapeHtml(div.id) + '" data-label="' + escapeHtml(divLabel) + '">Ver envíos</button>';
        if (canManageDependencias()) {
          divAcciones += ' <button type="button" class="btn btn-secondary btn-sm btn-agregar-division" data-id="' + escapeHtml(div.id) + '">+ División</button> <div class="dep-acciones-wrap"><button type="button" class="btn btn-icon btn-menu-dep" data-id="' + escapeHtml(div.id) + '" aria-label="Más acciones" title="Acciones">&#8942;</button><div class="dep-menu-dropdown"><button type="button" class="dep-menu-editar" data-id="' + escapeHtml(div.id) + '">Editar</button><button type="button" class="dep-menu-eliminar" data-id="' + escapeHtml(div.id) + '">Eliminar</button></div></div>';
        }
        var divHiddenClass = isExpanded ? '' : ' row-division-hidden';
        var hasSubDivs = subDivsARenderizar.length > 0;
        var isLastDiv = isLast && !hasSubDivs;
        var segConn = '<span class="dep-tree-seg seg-connector ' + (isLast ? 'seg-last' : 'seg-mid') + '"></span>';
        var divExpandClass = hasSubDivs ? ' row-division-parent' : '';
        rows.push('<tr class="row-division row-nivel-1' + divExpandClass + divHiddenClass + '" data-parent-id="' + escapeHtml(d.id) + '" data-div-id="' + escapeHtml(div.id) + '"><td>' + segConn + '<button type="button" class="link-dependencia" data-id="' + escapeHtml(div.id) + '" data-label="' + escapeHtml(divLabel) + '" title="Ver envíos">' + escapeHtml(divLabel) + '</button></td><td>' + escapeHtml(divNombre) + '</td><td>' + divAcciones + '</td></tr>');

        subDivsARenderizar.forEach(function (subDiv, subIdx) {
          var isLastSub = subIdx === subDivsARenderizar.length - 1;
          var subLabel = getDisplayLabel(subDiv, deps);
          var subNombre = (subDiv.nombre || '').trim() || '—';
          var subAcciones = '<button type="button" class="btn btn-secondary btn-sm btn-ver-envios-dep" data-id="' + escapeHtml(subDiv.id) + '" data-label="' + escapeHtml(subLabel) + '">Ver envíos</button>';
          if (canManageDependencias()) {
            subAcciones += ' <button type="button" class="btn btn-secondary btn-sm btn-agregar-division" data-id="' + escapeHtml(subDiv.id) + '">+ División</button> <div class="dep-acciones-wrap"><button type="button" class="btn btn-icon btn-menu-dep" data-id="' + escapeHtml(subDiv.id) + '" aria-label="Más acciones" title="Acciones">&#8942;</button><div class="dep-menu-dropdown"><button type="button" class="dep-menu-editar" data-id="' + escapeHtml(subDiv.id) + '">Editar</button><button type="button" class="dep-menu-eliminar" data-id="' + escapeHtml(subDiv.id) + '">Eliminar</button></div></div>';
          }
          var segAnc = '<span class="dep-tree-seg ' + (isLast ? '' : 'seg-mid') + '"></span>';
          var segSubConn = '<span class="dep-tree-seg seg-connector ' + (isLastSub ? 'seg-last' : 'seg-mid') + '"></span>';
          rows.push('<tr class="row-division row-nivel-2' + divHiddenClass + '" data-parent-id="' + escapeHtml(div.id) + '"><td>' + segAnc + segSubConn + '<button type="button" class="link-dependencia" data-id="' + escapeHtml(subDiv.id) + '" data-label="' + escapeHtml(subLabel) + '" title="Ver envíos">' + escapeHtml(subLabel) + '</button></td><td>' + escapeHtml(subNombre) + '</td><td>' + subAcciones + '</td></tr>');
        });
      });
    });
    if (busqueda && !algunaFila) {
      rows.push('<tr><td colspan="3" class="empty-state"><p>Ninguna dependencia coincide con &quot;' + escapeHtml((inputBuscarDeps && inputBuscarDeps.value) || '') + '&quot;. Prueba con otro nombre o número (ej. D4, 144, 144-1).</p></td></tr>');
    }
    listaDependencias.innerHTML = rows.join('');

    listaDependencias.querySelectorAll('.btn-flecha-dep').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = btn.getAttribute('data-id');
        if (!id) return;
        expandedDepIds[id] = !expandedDepIds[id];
        var parentRow = btn.closest('tr.main-dep-row');
        var divisionRows = listaDependencias.querySelectorAll('tr.row-division[data-parent-id="' + id + '"]');
        var allRows = Array.from(divisionRows);
        // También ocultar/mostrar sub-divisiones (2do nivel) que cuelgan de las divisiones del departamento.
        var childDivisionIds = (deps || []).filter(function (x) { return x && x.parentId === id; }).map(function (x) { return x.id; });
        childDivisionIds.forEach(function (childId) {
          Array.from(listaDependencias.querySelectorAll('tr.row-division[data-parent-id="' + childId + '"]')).forEach(function (tr) {
            allRows.push(tr);
          });
        });
        allRows.forEach(function (tr) {
          tr.classList.toggle('row-division-hidden', !expandedDepIds[id]);
        });
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

    listaDependencias.querySelectorAll('.link-dependencia, .btn-ver-envios-dep').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        var label = btn.getAttribute('data-label') || '';
        var dep = deps.find(function (d) { return d.id === id; }) || { id: id, nombre: label };
        openModalEnvios(dep, deps);
      });
    });

    listaDependencias.querySelectorAll('.btn-agregar-division').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!requireAdminAction('Solo admin puede editar dependencias.')) return;
        var parentId = btn.getAttribute('data-id');
        // Abrimos el modal donde se listan divisiones para poder seguir sumando.
        openModalAgregarDivisionesExistente(parentId);
      });
    });

    listaDependencias.querySelectorAll('.btn-menu-dep').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var wrap = btn.closest('.dep-acciones-wrap');
        var dropdown = wrap ? wrap.querySelector('.dep-menu-dropdown') : null;
        listaDependencias.querySelectorAll('.dep-menu-dropdown').forEach(function (d) {
          if (d !== dropdown) d.classList.remove('dep-menu-open');
        });
        if (dropdown) dropdown.classList.toggle('dep-menu-open');
      });
    });
    listaDependencias.querySelectorAll('.dep-menu-editar').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!requireAdminAction('Solo admin puede editar dependencias.')) return;
        var id = btn.getAttribute('data-id');
        var dep = deps.find(function (d) { return d.id === id; });
        if (dep) {
          var wrap = btn.closest('.dep-acciones-wrap');
          if (wrap) { var d = wrap.querySelector('.dep-menu-dropdown'); if (d) d.classList.remove('dep-menu-open'); }
          if (formDependencia) formDependencia.style.display = 'block';
          inputId.value = dep.id;
          inputNombre.value = dep.nombre || '';
          inputCodigo.value = (dep.codigo || '').toString();
          if (inputNumeroDiv) inputNumeroDiv.value = (dep.numero || '').toString();
          if (inputParent) inputParent.value = dep.parentId || '';
          toggleCodigoVisibility();
          if (btnCancelar) btnCancelar.style.display = 'inline-block';
          inputNombre.focus();
        }
      });
    });
    listaDependencias.querySelectorAll('.dep-menu-eliminar').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!requireAdminAction('Solo admin puede eliminar dependencias.')) return;
        var id = btn.getAttribute('data-id');
        var wrap = btn.closest('.dep-acciones-wrap');
        if (wrap) { var d = wrap.querySelector('.dep-menu-dropdown'); if (d) d.classList.remove('dep-menu-open'); }
        if (!confirm('¿Seguro que quiere eliminar esta dependencia?')) return;
        if (window.appLoading && window.appLoading.show) window.appLoading.show('Eliminando…');
        window.stockAPI.deleteDependencia(id).then(function () {
          showToast('Dependencia eliminada');
          run();
        }).catch(function () {
          showToast('Error al eliminar', 'error');
        }).finally(function () {
          if (window.appLoading && window.appLoading.hide) window.appLoading.hide();
        });
      });
    });
  }

  function toggleCodigoVisibility() {
    var isDivision = inputParent && inputParent.value;
    if (wrapCodigo) wrapCodigo.style.display = isDivision ? 'none' : '';
    if (wrapNumeroDiv) wrapNumeroDiv.style.display = isDivision ? '' : 'none';
  }

  function openModalAgregarDependencia() {
    if (!requireAdminAction('Solo admin puede editar dependencias.')) return;
    console.log('[Dependencias] openModalAgregarDependencia');
    if (modalAgregarDepParentId) modalAgregarDepParentId.value = '';
    divisionesNuevaTemp = [];
    if (formAgregarDep) formAgregarDep.reset();
    // En modo "Agregar dependencia" (nueva), permitimos guardar aunque no cargue divisiones.
    setGuardarDependenciaEnabled(true);
    if (inputNuevaDepNombre) inputNuevaDepNombre.focus();
    renderListaDivisionesNueva();
    if (modalAgregarDep) modalAgregarDep.classList.add('open');
  }

  function closeModalAgregarDependencia() {
    if (modalAgregarDep) modalAgregarDep.classList.remove('open');
    if (modalAgregarDepParentId) modalAgregarDepParentId.value = '';
  }

  function openModalAgregarDivisionesExistente(parentId) {
    if (!requireAdminAction('Solo admin puede editar dependencias.')) return;
    if (!parentId) return;
    var parent = (cachedData.dependencias || []).find(function (d) { return d.id === parentId; });
    if (!parent) {
      showToast('No se encontró la dependencia seleccionada', 'error');
      return;
    }
    divisionesNuevaTemp = [];
    if (formAgregarDep) formAgregarDep.reset();
    if (modalAgregarDepParentId) modalAgregarDepParentId.value = String(parentId);
    // El botón puede quedar habilitado; la validación real se hace al enviar.
    setGuardarDependenciaEnabled(true);

    // Rellenamos los campos requeridos del modal para que valide sin bloquear.
    if (inputNuevaDepNombre) inputNuevaDepNombre.value = parent.nombre || '';
    if (inputNuevaDepCodigo) inputNuevaDepCodigo.value = (parent.codigo || '').toString();

    renderListaDivisionesNueva();
    if (modalAgregarDep) modalAgregarDep.classList.add('open');

    // Enfocamos el campo para agregar la primera división al instante.
    if (inputDivisionNumero) inputDivisionNumero.focus();
  }

  function renderListaDivisionesNueva() {
    if (!listaDivisionesNueva) return;
    if (!divisionesNuevaTemp.length) {
      listaDivisionesNueva.innerHTML = '';
      // Dejamos el botón habilitado y validamos al enviar.
      setGuardarDependenciaEnabled(true);
      return;
    }
    listaDivisionesNueva.innerHTML = divisionesNuevaTemp.map(function (item, idx) {
      var num = (item.numero || '').toString().trim();
      var nom = (item.nombre || '').toString().trim();
      var texto = num ? (num + ' - ' + nom) : nom;
      var subDivs = item.subDivisiones || [];

      var subList = (subDivs || []).map(function (sd, sidx) {
        var sn = (sd.numero || '').toString().trim();
        var sNombre = (sd.nombre || '').toString().trim();
        var sTexto = sn ? (sn + ' - ' + sNombre) : sNombre;
        return '<li class="subdiv-nueva-item">' +
          '<span>' + escapeHtml(sTexto) + '</span>' +
          '<button type="button" class="btn btn-danger btn-sm btn-quitar-subdivision" data-div-idx="' + idx + '" data-sub-idx="' + sidx + '">Quitar</button>' +
          '</li>';
      }).join('');

      return '<li class="division-nueva-item">' +
        '<div class="division-nueva-top">' +
          '<span class="division-nueva-text">' + escapeHtml(texto) + '</span>' +
          '<button type="button" class="btn btn-danger btn-sm btn-quitar-division" data-idx="' + idx + '">Quitar</button>' +
        '</div>' +
        '<div class="subdiv-nueva-form">' +
          '<div class="subdiv-nueva-row">' +
          '<input type="text" class="subdiv-nueva-nombre" placeholder="Nombre sub-división">' +
          '<input type="text" class="subdiv-nueva-numero" placeholder="1" inputmode="numeric">' +
          '<button type="button" class="btn btn-secondary btn-sm btn-agregar-subdivision" data-div-idx="' + idx + '">+ Agregar sub división</button>' +
          '</div>' +
        '</div>' +
        '<ul class="lista-subdivisiones-nueva">' +
          (subList || '') +
        '</ul>' +
      '</li>';
    }).join('');
  }

  function agregarDivisionALista() {
    if (!requireAdminAction('Solo admin puede editar dependencias.')) return;
    var numero = (inputDivisionNumero && inputDivisionNumero.value || '').trim();
    var nombre = (inputDivisionNombre && inputDivisionNombre.value || '').trim().toUpperCase();
    if (!nombre) {
      showToast('Escribe el nombre de la división', 'error');
      return;
    }
    divisionesNuevaTemp.push({ numero: numero || '', nombre: nombre, subDivisiones: [] });
    if (inputDivisionNumero) inputDivisionNumero.value = '';
    if (inputDivisionNombre) inputDivisionNombre.value = '';
    renderListaDivisionesNueva();
    setGuardarDependenciaEnabled(true);
    if (inputDivisionNumero) inputDivisionNumero.focus();
  }

  async function run() {
    console.log('[Dependencias] run: iniciando...');
    if (window.appLoading && window.appLoading.show) window.appLoading.show('Cargando dependencias…');
    try {
      await loadFullData();
      try {
        var auth = await window.stockAPI.getAuthStatus();
        var rol = (auth && auth.rol ? String(auth.rol) : 'usuario').toLowerCase();
        esAdmin = rol === 'admin';
      } catch (_) {
        esAdmin = false;
      }
      var btnAgregarDep = document.getElementById('btn-agregar-dependencia');
      if (btnAgregarDep) btnAgregarDep.style.display = canManageDependencias() ? '' : 'none';
      if (btnImportarDependencias) btnImportarDependencias.style.display = canManageDependencias() ? '' : 'none';
      var deps = await loadDependencias();

        // Filtrar exclusiones TXT
        deps = (deps || []).filter(function (d) { return !isTxtItem(d); });

      // Arreglo histórico: si hay nombres en minúscula, los normalizamos a MAYUSCULAS (solo una vez por sesión)
      if (!window.__depsNombresNormalizedOnce) {
        window.__depsNombresNormalizedOnce = true;
        var needs = (deps || []).some(function (d) {
          return d && typeof d.nombre === 'string' && d.nombre && d.nombre !== d.nombre.toUpperCase();
        });
        if (needs && window.stockAPI && window.stockAPI.normalizeDependenciasNombres) {
          try {
            await window.stockAPI.normalizeDependenciasNombres();
            deps = await loadDependencias();
          } catch (e) {
            console.warn('[Dependencias] normalizeDependenciasNombres falló:', e && e.message ? e.message : e);
          }
        }
      }

      cachedData.dependencias = deps;
      console.log('[Dependencias] run: renderLista con', deps.length, 'dependencias');
      renderLista(deps);
      console.log('[Dependencias] run: listo');
    } finally {
      if (window.appLoading && window.appLoading.hide) window.appLoading.hide();
    }
  }

  formDependencia.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!requireAdminAction('Solo admin puede editar dependencias.')) return;
    var id = inputId.value.trim() || null;
    var nombre = inputNombre.value.trim().toUpperCase();
    var parentId = (inputParent && inputParent.value) || null;
    var codigo = (inputCodigo && inputCodigo.value) ? String(inputCodigo.value).trim() : '';

    if (!nombre) {
      showToast('Escribe un nombre', 'error');
      return;
    }

    if (!parentId && !codigo) {
      showToast('Las dependencias principales deben tener un código (ej. 144)', 'error');
      return;
    }

    var payload = { id: id || undefined, nombre: nombre, parentId: parentId || null };
    if (parentId) {
      var parent = (cachedData.dependencias || []).find(function (d) { return d.id === parentId; });
      payload.codigo = parent ? (parent.codigo || '').toString() : '';
      payload.numero = (inputNumeroDiv && inputNumeroDiv.value) ? String(inputNumeroDiv.value).trim() : '';
    } else {
      payload.codigo = codigo;
      payload.numero = '';
    }

    try {
      console.log('[Dependencias] formDependencia submit, payload:', JSON.stringify(payload));
      if (window.appLoading && window.appLoading.show) window.appLoading.show('Guardando…');
      await window.stockAPI.saveDependencia(payload);
      console.log('[Dependencias] formDependencia: guardado ok');
      showToast(id ? 'Dependencia actualizada' : 'Dependencia creada');
      if (formDependencia) formDependencia.style.display = 'none';
      inputId.value = '';
      inputNombre.value = '';
      if (inputCodigo) inputCodigo.value = '';
      if (inputNumeroDiv) inputNumeroDiv.value = '';
      if (inputParent) inputParent.value = '';
      if (btnCancelar) btnCancelar.style.display = 'none';
      toggleCodigoVisibility();
      run();
    } catch (err) {
      console.error('[Dependencias] formDependencia submit ERROR:', err);
      console.error('[Dependencias] formDependencia ERROR message:', err && err.message);
      console.error('[Dependencias] formDependencia ERROR stack:', err && err.stack);
      showToast('Error al guardar', 'error');
    } finally {
      if (window.appLoading && window.appLoading.hide) window.appLoading.hide();
    }
  });

  if (inputParent) inputParent.addEventListener('change', toggleCodigoVisibility);

  if (inputBuscarDeps) {
    inputBuscarDeps.addEventListener('input', function () {
      renderLista(cachedData.dependencias || []);
    });
    // Fix intermitente: después de refrescar, asegurar que el buscador
    // siempre quede interactivo y que la lupa/label enfoquen el input.
    var ensureBuscarDepsInteraccion = function () {
      try {
        inputBuscarDeps.disabled = false;
        inputBuscarDeps.readOnly = false;
        inputBuscarDeps.style.pointerEvents = 'auto';
      } catch (_) {}
    };
    ensureBuscarDepsInteraccion();
    window.addEventListener('focus', ensureBuscarDepsInteraccion);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) ensureBuscarDepsInteraccion();
    });

    // Al entrar a la pantalla, forzar foco de ventana + input (equivalente a alt-tab).
    setTimeout(function () {
      try {
        if (window.stockAPI && window.stockAPI.focusWindow) window.stockAPI.focusWindow();
      } catch (_) {}
      ensureBuscarDepsInteraccion();
      try { inputBuscarDeps.focus(); } catch (_) {}
    }, 0);

    // Fix extra (Electron): luego de un confirm()/alert() (por ej. al eliminar),
    // a veces el webview queda sin foco hasta hacer alt-tab.
    // En el primer click dentro de la barra de búsqueda, re-enfocamos ventana + input.
    var searchBar = inputBuscarDeps.closest ? inputBuscarDeps.closest('.search-bar') : null;
    if (searchBar) {
      var refocus = function () {
        ensureBuscarDepsInteraccion();
        try {
          if (window.stockAPI && window.stockAPI.focusWindow) window.stockAPI.focusWindow();
          else window.focus();
        } catch (_) {}
        setTimeout(function () { try { inputBuscarDeps.focus(); } catch (_) {} }, 0);
      };
      searchBar.addEventListener('pointerdown', refocus, { capture: true });
      searchBar.addEventListener('mousedown', refocus, { capture: true });
      searchBar.addEventListener('click', refocus, { capture: true });
    }

    var labelBuscarDeps = document.querySelector('label[for="buscar-dependencias"]');
    if (labelBuscarDeps) {
      labelBuscarDeps.addEventListener('click', function () {
        ensureBuscarDepsInteraccion();
        setTimeout(function () {
          try { inputBuscarDeps.focus(); } catch (_) {}
        }, 0);
      });
    }
  }

  // Normalizar a mayúsculas en vivo mientras tipeás
  // (así no aparece mixto como en la captura).
  if (inputNombre) {
    inputNombre.addEventListener('input', function (e) {
      e.target.value = (e.target.value || '').toUpperCase();
    });
  }
  if (inputNuevaDepNombre) {
    inputNuevaDepNombre.addEventListener('input', function (e) {
      e.target.value = (e.target.value || '').toUpperCase();
    });
  }
  if (inputDivisionNombre) {
    inputDivisionNombre.addEventListener('input', function (e) {
      e.target.value = (e.target.value || '').toUpperCase();
    });
  }
  if (listaDivisionesNueva) {
    // inputs de sub-divisiones se renderizan dinámicamente
    listaDivisionesNueva.addEventListener('input', function (e) {
      if (!e.target) return;
      if (e.target.classList && e.target.classList.contains('subdiv-nueva-nombre')) {
        e.target.value = (e.target.value || '').toUpperCase();
      }
    });
  }

  var btnAgregarDep = document.getElementById('btn-agregar-dependencia');
  if (btnAgregarDep) btnAgregarDep.addEventListener('click', openModalAgregarDependencia);

  if (btnImportarDependencias && inputImportarDependencias) {
    btnImportarDependencias.addEventListener('click', function () {
      if (!requireAdminAction('Solo admin puede editar dependencias.')) return;
      try { inputImportarDependencias.value = ''; } catch (e) { /* ignore */ }
      inputImportarDependencias.click();
    });
    inputImportarDependencias.addEventListener('change', function () {
      var file = inputImportarDependencias.files && inputImportarDependencias.files[0]
        ? inputImportarDependencias.files[0]
        : null;
      importarDependenciasDesdeArchivo(file);
    });
  }

  var btnAgregarDivisionLista = document.getElementById('btn-agregar-division-lista');
  if (btnAgregarDivisionLista) btnAgregarDivisionLista.addEventListener('click', function () {
    if (!requireAdminAction('Solo admin puede editar dependencias.')) return;
    agregarDivisionALista();
  });

  // Delegación de eventos para manejar:
  // - quitar división
  // - agregar sub-división dentro de una división
  // - quitar sub-división
  if (listaDivisionesNueva) {
    listaDivisionesNueva.addEventListener('click', function (e) {
      var quitarDivBtn = e.target && e.target.closest ? e.target.closest('.btn-quitar-division') : null;
      if (quitarDivBtn) {
        if (!requireAdminAction('Solo admin puede editar dependencias.')) return;
        var idx = parseInt(quitarDivBtn.getAttribute('data-idx'), 10);
        if (!isNaN(idx) && idx >= 0 && idx < divisionesNuevaTemp.length) {
          divisionesNuevaTemp.splice(idx, 1);
          renderListaDivisionesNueva();
          setGuardarDependenciaEnabled(true);
        }
        return;
      }

      var agregarSubBtn = e.target && e.target.closest ? e.target.closest('.btn-agregar-subdivision') : null;
      if (agregarSubBtn) {
        if (!requireAdminAction('Solo admin puede editar dependencias.')) return;
        var divIdx = parseInt(agregarSubBtn.getAttribute('data-div-idx'), 10);
        if (isNaN(divIdx) || divIdx < 0 || divIdx >= divisionesNuevaTemp.length) return;

        var li = agregarSubBtn.closest('.division-nueva-item');
        if (!li) return;

        var numInput = li.querySelector('.subdiv-nueva-numero');
        var nameInput = li.querySelector('.subdiv-nueva-nombre');
        var subNumero = (numInput && numInput.value || '').trim();
        var subNombre = (nameInput && nameInput.value || '').trim().toUpperCase();

        if (!subNombre) {
          showToast('Escribe el nombre de la sub-división', 'error');
          return;
        }

        if (!divisionesNuevaTemp[divIdx].subDivisiones) divisionesNuevaTemp[divIdx].subDivisiones = [];
        divisionesNuevaTemp[divIdx].subDivisiones.push({ numero: subNumero || '', nombre: subNombre });

        if (numInput) numInput.value = '';
        if (nameInput) nameInput.value = '';

        renderListaDivisionesNueva();
        return;
      }

      var quitarSubBtn = e.target && e.target.closest ? e.target.closest('.btn-quitar-subdivision') : null;
      if (quitarSubBtn) {
        if (!requireAdminAction('Solo admin puede editar dependencias.')) return;
        var divIdx2 = parseInt(quitarSubBtn.getAttribute('data-div-idx'), 10);
        var subIdx = parseInt(quitarSubBtn.getAttribute('data-sub-idx'), 10);
        if (isNaN(divIdx2) || divIdx2 < 0 || divIdx2 >= divisionesNuevaTemp.length) return;
        if (isNaN(subIdx) || subIdx < 0) return;
        var subs = divisionesNuevaTemp[divIdx2].subDivisiones || [];
        if (subIdx >= subs.length) return;
        subs.splice(subIdx, 1);
        divisionesNuevaTemp[divIdx2].subDivisiones = subs;
        renderListaDivisionesNueva();
        return;
      }
    });
  }

  if (inputDivisionNombre) {
    inputDivisionNombre.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        agregarDivisionALista();
      }
    });
  }

  if (formAgregarDep) {
    formAgregarDep.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!requireAdminAction('Solo admin puede editar dependencias.')) return;
      var nombre = (inputNuevaDepNombre && inputNuevaDepNombre.value || '').trim().toUpperCase();
      var codigo = (inputNuevaDepCodigo && inputNuevaDepCodigo.value || '').trim();
      var parentIdForMode = (modalAgregarDepParentId && modalAgregarDepParentId.value) ? String(modalAgregarDepParentId.value).trim() : '';
      // Normalizar el código/ID a solo dígitos para evitar que "455", "455 " o "455-" se guarden distinto
      // y después no se encuentren al buscar.
      var codigoDigits = (codigo || '').replace(/[^\d]/g, '');
      if (!nombre) {
        showToast('Escribe el nombre de la dependencia', 'error');
        return;
      }
      try {
        console.log('[Dependencias] formAgregarDep submit, modoParentId:', parentIdForMode, 'nombre:', nombre, 'codigo:', codigoDigits, 'divisiones:', divisionesNuevaTemp.length);
        var modoAgregarDivisiones = !!parentIdForMode;
        if ((!divisionesNuevaTemp || !divisionesNuevaTemp.length) && modoAgregarDivisiones) {
          showToast('Primero agregá al menos una división a la lista', 'error');
          return;
        }

        if (parentIdForMode) {
          // Modo: agregar divisiones a una dependencia existente
          var parent = (cachedData.dependencias || []).find(function (d) { return d.id === parentIdForMode; });
          if (!parent) {
            showToast('No se encontró la dependencia seleccionada', 'error');
            return;
          }
          var parentCodigo = (parent.codigo || '').toString().trim();

          if (window.appLoading && window.appLoading.show) window.appLoading.show('Guardando divisiones…');
          var baseTs = Date.now().toString();
          for (var i = 0; i < divisionesNuevaTemp.length; i++) {
            var div = divisionesNuevaTemp[i];
            var divNombre = (div && div.nombre ? div.nombre : (div || '')).toString().trim().toUpperCase();
            if (divNombre) {
              var divNumero = (div && div.numero != null) ? String(div.numero).trim() : '';
              var divId = parentIdForMode + '-d' + baseTs + '-' + i;
              var divPayload = {
                id: divId,
                nombre: divNombre,
                codigo: parentCodigo,
                parentId: parentIdForMode,
                numero: divNumero
              };
              await window.stockAPI.saveDependencia(divPayload);

              // Guardar sub-divisiones dentro de esta división
              var subDivs = (div && div.subDivisiones) ? div.subDivisiones : [];
              for (var j = 0; j < subDivs.length; j++) {
                var sd = subDivs[j];
                var sdNombre = (sd && sd.nombre ? sd.nombre : (sd || '')).toString().trim().toUpperCase();
                if (!sdNombre) continue;
                var sdNumero = (sd && sd.numero != null) ? String(sd.numero).trim() : '';
                await window.stockAPI.saveDependencia({
                  id: divId + '-sd' + j,
                  nombre: sdNombre,
                  codigo: parentCodigo,
                  parentId: divId,
                  numero: sdNumero
                });
              }
            }
          }
          if (divisionesNuevaTemp && divisionesNuevaTemp.length) {
            showToast('Divisiones agregadas correctamente');
          } else {
            showToast('No se agregaron divisiones (lista vacía)');
          }
          closeModalAgregarDependencia();
          run();
        } else {
          // Modo: crear dependencia principal + sus divisiones (flujo original)
          if (window.appLoading && window.appLoading.show) window.appLoading.show('Guardando dependencia…');
          // Si no hay código/ID, generamos un id estable por nombre + timestamp.
          var slugNombre = slugify(nombre) || 'dependencia';
          var mainId = codigoDigits ? ('dep-' + codigoDigits) : ('dep-' + slugNombre + '-' + Date.now());
          await window.stockAPI.saveDependencia({ id: mainId, nombre: nombre, codigo: codigoDigits || '', parentId: null });
          for (var i = 0; i < divisionesNuevaTemp.length; i++) {
            var div = divisionesNuevaTemp[i];
            var divNombre = (div && div.nombre ? div.nombre : (div || '')).toString().trim().toUpperCase();
            if (divNombre) {
              var divNumero = (div && div.numero != null) ? String(div.numero).trim() : '';
              var divIdx = divNumero ? String(divNumero).replace(/[^\d]/g, '') : String(i + 1);
              var divId2 = mainId + '-div-' + divIdx;
              var divPayload = { id: divId2, nombre: divNombre, codigo: codigoDigits || '', parentId: mainId, numero: divNumero };
              await window.stockAPI.saveDependencia(divPayload);

              // Guardar sub-divisiones dentro de esta división
              var subDivs2 = (div && div.subDivisiones) ? div.subDivisiones : [];
              for (var j = 0; j < subDivs2.length; j++) {
                var sd2 = subDivs2[j];
                var sdNombre2 = (sd2 && sd2.nombre ? sd2.nombre : (sd2 || '')).toString().trim().toUpperCase();
                if (!sdNombre2) continue;
                var sdNumero2 = (sd2 && sd2.numero != null) ? String(sd2.numero).trim() : '';
                await window.stockAPI.saveDependencia({
                  id: divId2 + '-sd' + j,
                  nombre: sdNombre2,
                  codigo: codigoDigits || '',
                  parentId: divId2,
                  numero: sdNumero2
                });
              }
            }
          }
          if (divisionesNuevaTemp && divisionesNuevaTemp.length) {
            showToast('Dependencia creada con ' + divisionesNuevaTemp.length + ' división(es)');
          } else {
            showToast('Dependencia creada (sin divisiones)');
          }
          closeModalAgregarDependencia();
          run();
        }
      } catch (err) {
        console.error('[Dependencias] formAgregarDep submit ERROR:', err);
        console.error('[Dependencias] formAgregarDep ERROR message:', err && err.message);
        console.error('[Dependencias] formAgregarDep ERROR stack:', err && err.stack);
        showToast('Error al guardar', 'error');
      } finally {
        if (window.appLoading && window.appLoading.hide) window.appLoading.hide();
      }
    });
  }

  document.querySelectorAll('.modal-agregar-dep-close').forEach(function (btn) {
    if (btn) btn.addEventListener('click', closeModalAgregarDependencia);
  });
  if (modalAgregarDep) {
    modalAgregarDep.addEventListener('click', function (e) {
      if (e.target === modalAgregarDep) closeModalAgregarDependencia();
    });
  }

  if (btnCancelar) {
    btnCancelar.addEventListener('click', function () {
      if (formDependencia) formDependencia.style.display = 'none';
      inputId.value = '';
      inputNombre.value = '';
      if (inputCodigo) inputCodigo.value = '';
      if (inputNumeroDiv) inputNumeroDiv.value = '';
      if (inputParent) inputParent.value = '';
      btnCancelar.style.display = 'none';
      toggleCodigoVisibility();
    });
  }

  document.querySelectorAll('.modal-envios-dep-close').forEach(function (btn) {
    if (btn) btn.addEventListener('click', closeModalEnvios);
  });
  if (modalEnvios) {
    modalEnvios.addEventListener('click', function (e) {
      if (e.target === modalEnvios) closeModalEnvios();
    });
  }

  document.addEventListener('click', function () {
    listaDependencias.querySelectorAll('.dep-menu-dropdown').forEach(function (d) { d.classList.remove('dep-menu-open'); });
  });
  window._realtimeRefresh = function (table) {
    if (!table || table === 'dependencias') run();
  };

  console.log('[Dependencias] script cargado, ejecutando run()');
  run();
})();
