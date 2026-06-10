import {
  depMatchesBusqueda,
  getDisplayLabel,
  getDivisiones,
  getMainDeps,
  isTxtItem
} from './dependenciasHelpers';
import { toLocalDatetimeValue } from './depositoHelpers';

export { isTxtItem, getDisplayLabel, getMainDeps, getDivisiones, toLocalDatetimeValue };

export function getDepNombreSolo(dep) {
  if (!dep) return '—';
  const nombre = (dep.nombre || '').toString().trim();
  const codigo = (dep.codigo || '').toString().trim();
  return nombre || codigo || '—';
}

function branchMatches(dep, deps, busqueda, parent) {
  if (depMatchesBusqueda(dep, deps, busqueda, parent || null)) return true;
  const children = getDivisiones(deps, dep.id);
  return children.some((c) => branchMatches(c, deps, busqueda, dep));
}

/**
 * Filas planas para la tabla de dependencias del paso 1.
 */
export function buildGuardiaDepRows(deps, busqueda, expandedIds = {}) {
  const q = (busqueda || '').trim().toLowerCase();
  const rows = [];
  const mainDeps = getMainDeps(deps);

  function appendChildren(parent, rootId, level, isVisible, forceShowAllDescendants) {
    let children = getDivisiones(deps, parent.id);
    const parentSelfMatches = q
      ? depMatchesBusqueda(parent, deps, q, parent.parentId ? deps.find((d) => d.id === parent.parentId) : null)
      : false;
    const allowAll = !!forceShowAllDescendants || !!parentSelfMatches;
    if (q && !allowAll) {
      children = children.filter((c) => branchMatches(c, deps, q, parent));
    }
    children.forEach((child, idx) => {
      const childLabel = getDisplayLabel(child, deps);
      const childNombre = (child.nombre || '').trim() || '—';
      const hidden = isVisible ? false : true;
      const childSelfMatches = q ? depMatchesBusqueda(child, deps, q, parent) : false;
      rows.push({
        key: child.id,
        type: 'division',
        dep: child,
        label: childLabel,
        nombre: childNombre,
        level,
        hidden,
        rootId,
        isLast: idx === children.length - 1,
        labelPrefix: level === 1 ? '* ' : ''
      });
      appendChildren(child, rootId, level + 1, isVisible, allowAll || childSelfMatches);
    });
  }

  mainDeps.forEach((d) => {
    if (q && !branchMatches(d, deps, q, null)) return;
    const label = getDisplayLabel(d, deps);
    const nombre = (d.nombre || '').trim() || '—';
    const children = getDivisiones(deps, d.id);
    const isExpanded = !!expandedIds[d.id];
    rows.push({
      key: d.id,
      type: 'main',
      dep: d,
      label,
      nombre,
      hasChildren: children.length > 0,
      isExpanded
    });
    const rootSelfMatches = q ? depMatchesBusqueda(d, deps, q, null) : false;
    appendChildren(d, d.id, 1, isExpanded, !!rootSelfMatches);
  });

  return rows;
}

export function filterProvisionesEnriched({
  provisiones,
  dependenciaId,
  productos,
  movimientos,
  buscar,
  desde,
  hasta
}) {
  const list = (provisiones || []).filter((p) => p.dependencia_id === dependenciaId);
  list.sort((a, b) => new Date(b.fecha_asignacion || 0) - new Date(a.fecha_asignacion || 0));
  const prodById = new Map((productos || []).map((p) => [p.id, p]));
  const movById = new Map((movimientos || []).map((m) => [m.id, m]));

  const qBuscar = (buscar || '').trim().toLowerCase();
  const qDesde = desde ? new Date(`${desde}T00:00:00`).getTime() : 0;
  const qHasta = hasta ? new Date(`${hasta}T23:59:59`).getTime() : 0;

  const enriched = list.map((p) => {
    const prod = prodById.get(p.producto_id);
    let nombreProd = prod
      ? (`${prod.codigo || ''} - ${prod.nombre || ''}`).trim() || prod.nombre || p.producto_id
      : p.producto_id;
    if (p.movimiento_id && movimientos?.length) {
      const mov = movById.get(p.movimiento_id);
      if (mov) {
        nombreProd += ` · ${[mov.nombre, mov.numeroSerie].filter(Boolean).join(' · ') || 'Item'}`;
      }
    }
    const fechaTs = p.fecha_asignacion ? new Date(p.fecha_asignacion).getTime() : 0;
    const fecha = p.fecha_asignacion
      ? new Date(p.fecha_asignacion).toLocaleString('es-ES', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
      })
      : '—';
    return {
      id: p.id,
      nombreProd,
      fechaTs,
      fecha,
      cantidad: p.cantidad != null ? p.cantidad : 1,
      concepto: (p.concepto || '').trim() || '—'
    };
  });

  return enriched.filter((e) => {
    if (qDesde && e.fechaTs < qDesde) return false;
    if (qHasta && e.fechaTs > qHasta) return false;
    if (qBuscar) {
      const haystack = [e.nombreProd, e.concepto].join(' ').toLowerCase();
      if (!haystack.includes(qBuscar)) return false;
    }
    return true;
  });
}

function itemMatchesBusquedaGuardia(m, exp, busquedaLower) {
  if (!busquedaLower) return true;
  const codExp = exp ? String(exp.codigo != null ? exp.codigo : '').trim().toLowerCase() : '';
  const nomExp = exp ? String(exp.nombre != null ? exp.nombre : '').trim().toLowerCase() : '';
  const idExp = exp && exp.id != null ? String(exp.id).trim().toLowerCase() : '';
  const nomItem = String(m.nombre != null ? m.nombre : '').trim().toLowerCase();
  const serie = String(m.numeroSerie != null ? m.numeroSerie : '').trim().toLowerCase();
  return codExp.includes(busquedaLower) || nomExp.includes(busquedaLower) || idExp.includes(busquedaLower)
    || nomItem.includes(busquedaLower) || serie.includes(busquedaLower);
}

export function buildProductosDisponibles({ productos, movimientos, provisiones, busqueda }) {
  const busquedaLower = (busqueda || '').trim().toLowerCase();
  const hayBusqueda = !!busquedaLower;
  const prodById = new Map((productos || []).map((p) => [p.id, p]));
  const provistosGuardiaPorMov = {};
  (provisiones || []).forEach((pr) => {
    if (pr.movimiento_id) {
      provistosGuardiaPorMov[pr.movimiento_id] = (provistosGuardiaPorMov[pr.movimiento_id] || 0)
        + (pr.cantidad != null ? pr.cantidad : 1);
    }
  });

  const entradas = (movimientos || []).filter((m) => m.tipo === 'entrada' && m.productoId != null);
  const candidatos = [];

  entradas.forEach((m) => {
    const exp = prodById.get(m.productoId);
    if (hayBusqueda && !itemMatchesBusquedaGuardia(m, exp, busquedaLower)) return;
    const codExp = exp ? ((exp.codigo != null ? String(exp.codigo) : '').trim() || '—') : '—';
    const codProducto = (m.numeroSerie != null ? String(m.numeroSerie) : '').trim() || '—';
    const nomProducto = (m.nombre != null ? String(m.nombre) : '').trim() || '—';
    const label = `${codProducto} / ${codExp} — ${nomProducto}`;
    const cantMov = parseInt(m.cantidad, 10) || 0;
    const provMov = provistosGuardiaPorMov[m.id] || 0;
    const disponibleMov = Math.max(0, cantMov - provMov);
    candidatos.push({
      movimientoId: m.id,
      productoId: m.productoId,
      codProducto,
      codExp,
      nomProducto,
      label,
      disponibleMov,
      agotado: disponibleMov === 0
    });
  });

  const conStock = candidatos.filter((c) => c.disponibleMov > 0);
  const agotados = candidatos.filter((c) => c.disponibleMov === 0);
  const itemsToShow = (hayBusqueda ? conStock.concat(agotados) : conStock).slice(0, 40);

  let agotadoMsg = '';
  if (hayBusqueda && agotados.length && !conStock.length) {
    agotadoMsg = `Producto agotado: «${busqueda.trim()}» no tiene unidades disponibles.`;
  } else if (hayBusqueda && agotados.length && conStock.length) {
    agotadoMsg = 'Hay coincidencias agotadas en la búsqueda (marcadas abajo).';
  }

  let emptyMsg = '';
  if (!itemsToShow.length) {
    if (hayBusqueda && !candidatos.length) {
      emptyMsg = `No hay productos que coincidan con «${busqueda.trim()}».`;
    } else if (!(hayBusqueda && agotados.length && !conStock.length)) {
      emptyMsg = 'No hay productos con stock disponible. Usá el buscador para consultar agotados.';
    }
  }

  return { items: itemsToShow, agotadoMsg, emptyMsg, candidatos, conStock, agotados };
}

export function buildProvisionPayload({
  carrito,
  selectedDependenciaId,
  fechaInput,
  concepto,
  productos,
  movimientos,
  dependencias
}) {
  const fecha = fechaInput ? new Date(fechaInput).toISOString() : new Date().toISOString();
  const conceptoVal = (concepto || '').trim() || null;
  const dep = (dependencias || []).find((d) => d.id === selectedDependenciaId);
  const depLabel = getDepNombreSolo(dep);
  const fechaStr = fechaInput
    ? new Date(fechaInput).toLocaleString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    })
    : new Date().toLocaleString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

  const provisions = [];
  const itemsForActa = [];
  const confirmRows = [];

  carrito.forEach((item) => {
    const provision = {
      dependencia_id: selectedDependenciaId,
      producto_id: item.productoId,
      fecha_asignacion: fecha,
      cantidad: item.cantidad,
      concepto: conceptoVal
    };
    if (item.movimientoId) provision.movimiento_id = item.movimientoId;
    provisions.push(provision);

    const prod = (productos || []).find((p) => p.id === item.productoId);
    const expediente = prod ? ((prod.codigo != null ? String(prod.codigo) : '').trim() || '—') : '—';
    let productLabelActa = '';
    let caracteristicasActa = '';
    if (item.movimientoId && (movimientos || []).length) {
      const movActa = movimientos.find((m) => m.id === item.movimientoId);
      if (movActa) {
        const movNombre = (movActa.nombre != null ? String(movActa.nombre) : '').trim();
        const movConcepto = (movActa.concepto != null ? String(movActa.concepto) : '').trim();
        const movMarca = (movActa.marca != null ? String(movActa.marca) : '').trim();
        if (movNombre && movConcepto && movNombre.toLowerCase().indexOf(movConcepto.toLowerCase()) === -1) {
          productLabelActa = `${movNombre} - ${movConcepto}`;
        } else {
          productLabelActa = movNombre || movConcepto || '';
        }
        if (movMarca) caracteristicasActa = movMarca;
      }
    }
    if (!productLabelActa) {
      const prodNombre = prod ? ((prod.nombre != null ? String(prod.nombre) : '').trim()) : '';
      productLabelActa = prodNombre || (item.label || '').toString().trim() || '—';
    }
    const seriales = [];
    if (item.movimientoId && (movimientos || []).length) {
      const mov = movimientos.find((m) => m.id === item.movimientoId);
      if (mov && (mov.numeroSerie || '').toString().trim()) {
        seriales.push({ ext: true, num: (mov.numeroSerie || '').toString().trim() });
      }
    }
    itemsForActa.push({
      productLabel: productLabelActa,
      cantidad: item.cantidad,
      expediente,
      seriales,
      caracteristicas: caracteristicasActa
    });
    confirmRows.push({ label: item.label, cantidad: item.cantidad });
  });

  return {
    provisions,
    depLabel,
    itemsForActa,
    fechaStr,
    fecha: fechaInput || new Date().toISOString(),
    conceptoVal: (concepto || '').trim() || '—',
    destinatario: depLabel,
    confirmRows
  };
}

export function buildActasPorExpediente(datosActa) {
  const items = datosActa.items || [];
  const porExp = {};
  items.forEach((it) => {
    const exp = (it.expediente || '').toString().trim() || '—';
    if (!porExp[exp]) porExp[exp] = [];
    porExp[exp].push(it);
  });
  return Object.keys(porExp).map((exp) => ({
    dependencia_id: datosActa.dependencia_id,
    depLabel: datosActa.depLabel,
    fechaStr: datosActa.fechaStr,
    fecha: datosActa.fecha,
    concepto: datosActa.concepto,
    destinatario: datosActa.destinatario,
    items: porExp[exp]
  }));
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS_PALABRAS = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE', 'TREINTA', 'TREINTA Y UNO'];
const CANT_PALABRAS = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE', 'TREINTA'];
const HORAS_PALABRAS = ['CERO', 'UNA', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO'];

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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
  if (y >= 2020 && y <= 2030) {
    const map = { 2020: 'Veinte', 2021: 'Veintiuno', 2022: 'Veintidós', 2023: 'Veintitrés', 2024: 'Veinticuatro' };
    return `dos mil ${map[y] || String(y)}`;
  }
  return `dos mil ${String(y).slice(-2)}`;
}

export function buildActaHtml(datos) {
  const dep = (datos.depLabel || '').toString().trim() || '—';
  const fechaStr = (datos.fechaStr || '').toString().trim();
  const funcionarioEntrega = (datos.funcionarioEntrega || '').toString().trim() || '—';
  const asistente = (datos.asistente || '').toString().trim() || '—';
  const destinatario = (datos.destinatario || '').toString().trim() || '—';
  const items = Array.isArray(datos.items) && datos.items.length > 0
    ? datos.items
    : [{
      productLabel: (datos.productLabel || '').toString().trim() || '—',
      cantidad: datos.cantidad != null ? parseInt(datos.cantidad, 10) : 0,
      expediente: (datos.expediente || '').toString().trim() || '—',
      seriales: datos.seriales || []
    }];

  const d = datos.fecha ? new Date(datos.fecha) : (fechaStr ? new Date(fechaStr) : new Date());
  const diaNum = d.getDate();
  const mesIdx = d.getMonth();
  const anio = d.getFullYear();
  const horaNum = d.getHours();
  const diaPalabra = numeroACapitalizar(diaNum);
  const mesNombre = MESES[mesIdx] || '—';
  const anioPalabra = yearEnPalabras(anio);
  const horaPalabra = (horaNum >= 0 && horaNum < 24) ? HORAS_PALABRAS[horaNum] : String(horaNum);

  const bloquesProducto = items.map((it) => {
    const cantidad = it.cantidad != null ? parseInt(it.cantidad, 10) : 0;
    const productLabel = (it.productLabel || '').toString().trim() || '—';
    const caracteristicas = (it.caracteristicas || '').toString().trim();
    const cantPalabra = cantidadEnPalabras(cantidad);
    const desc = cantidad >= 1 && cantidad <= 30
      ? `(${cantidad < 10 ? `0${cantidad}` : String(cantidad)}) ${cantPalabra} ${productLabel.toUpperCase()}`
      : `(${cantidad}) ${productLabel.toUpperCase()}`;
    let bloque = `<span class="acta-editable" contenteditable="true">${desc}</span>`;
    if (caracteristicas) {
      bloque += ` <span class="acta-editable" contenteditable="true">${escapeHtml(caracteristicas)}</span>`;
    }
    const seriales = it.seriales || [];
    if (seriales.length > 0) {
      const partesSerie = seriales.map((s) => {
        const texto = (s.num || '—');
        return `<span class="acta-editable" contenteditable="true">${escapeHtml(texto)}</span>`;
      });
      bloque += ` con sus respectivos <strong>NROS DE SERIE</strong>: ${partesSerie.join('; ')}.`;
    } else {
      bloque += ' con sus respectivos <strong>NROS DE SERIE</strong>: <span class="acta-editable" contenteditable="true">—</span>.';
    }
    return bloque;
  });

  const descripcionCompleta = bloquesProducto.join('<br><br>');
  const expedientesUnicos = [];
  items.forEach((it) => {
    const expTxt = (it && it.expediente != null ? String(it.expediente) : '').trim();
    if (expTxt && !expedientesUnicos.includes(expTxt)) expedientesUnicos.push(expTxt);
  });
  if (!expedientesUnicos.length && datos?.expediente) {
    const expDato = String(datos.expediente).trim();
    if (expDato) expedientesUnicos.push(expDato);
  }
  let textoExpedientes = '—';
  if (expedientesUnicos.length === 1) {
    textoExpedientes = `Los mismos fueron adquiridos mediante el EXP. ${expedientesUnicos[0]}.`;
  } else if (expedientesUnicos.length > 1) {
    textoExpedientes = `Los mismos fueron adquiridos mediante los EXP. ${expedientesUnicos.join(', ')}.`;
  }

  return `<div class="acta-documento">`
    + '<div class="acta-logo-wrap"><img src="logito.jpeg" alt="" class="acta-logo"></div>'
    + `<p class="acta-parrafo"><strong>ACTA DE ENTREGA:</strong> En la Ciudad de San Miguel de Tucumán, Departamento Capital, a los <strong><span class="acta-editable" contenteditable="true">${diaPalabra} días del mes de ${mesNombre} del año ${anioPalabra}</span></strong>, siendo horas <strong><span class="acta-editable" contenteditable="true">${horaPalabra}</span></strong>, el funcionario de Policía que suscribe por <span class="acta-editable" contenteditable="true">${escapeHtml(funcionarioEntrega)}</span>, con prestación de servicio en División Control Bienes Patrimoniales (D-4); asistido en éste acto por el <span class="acta-editable" contenteditable="true">${escapeHtml(asistente)}</span>, redacto la presente a los fines y efectos legales de dejar debidamente documentado lo siguiente:</p>`
    + `<p class="acta-parrafo">Que en la fecha y hora indicada, se hace comparecer a <span class="acta-editable" contenteditable="true">${escapeHtml(destinatario)}</span>, perteneciente a <span class="acta-editable">${escapeHtml(dep)}</span>, a quien se le procede hacer entrega en calidad de <strong>PROVISIÓN</strong>:</p>`
    + `<p class="acta-parrafo">${descripcionCompleta}</p>`
    + `<p class="acta-parrafo"><span class="acta-editable" contenteditable="true">${escapeHtml(textoExpedientes)}</span></p>`
    + '<p class="acta-parrafo acta-parrafo-final">Así mismo, se le hace conocer que se deberá poner el mayor celo en el cuidado y mantenimiento de dichos elementos a fin que no sufra mayores deterioros más que los causados por el normal. No siendo para más se da por finalizado el acto previa lectura y ratificación de su contenido por parte de los intervinientes lo firman por ante mí en conformidad lo que CERTIFICO.</p>'
    + '<div class="acta-espacio-firmas" aria-label="Espacio reservado para firmas y sellos (completar en forma manual)"></div>'
    + '</div>';
}

export const ACTA_PRINT_STYLES = '@page{size:21.49cm 31.5cm;margin:1.8cm;} '
  + 'body{font-family:\'Times New Roman\',Times,serif;margin:0;padding:0;color:#111;font-size:16pt;line-height:1.5;box-sizing:border-box;width:21.49cm;min-height:31.5cm;padding:0.5cm 1.8cm 1.8cm 1.8cm;} '
  + '.acta-documento{font-family:inherit;width:100%;max-width:17.89cm;font-size:16pt;} '
  + '.acta-logo-wrap{text-align:center;margin-bottom:0.95em;background:#fff;padding:0.05cm 0;} .acta-logo{width:6.1cm;height:auto;max-height:8.8cm;object-fit:contain;display:block;margin:0 auto;background:#fff;} '
  + '.acta-parrafo{margin:0 0 0.5em;text-align:justify;font-size:16pt;} '
  + '.acta-parrafo strong{font-weight:700;} '
  + '.acta-parrafo-final{margin-bottom:1em;} '
  + '.acta-editable{background:rgba(255,255,0,0.25);padding:0 1px;} '
  + '.acta-espacio-firmas{min-height:4.2cm;margin-top:1.2em;} '
  + '@media print{body{width:21.49cm;min-height:31.5cm;padding:0.5cm 1.8cm 1.8cm 1.8cm;font-size:16pt;} .acta-documento{font-size:16pt;} .acta-parrafo{font-size:16pt;} .acta-editable{background:transparent;} .acta-espacio-firmas{min-height:4.2cm;}}';

export function buildActaSavePayload(d) {
  const items = Array.isArray(d.items) && d.items.length > 0 ? d.items : null;
  let productLabel = (d.productLabel || '').toString().trim();
  let expediente = (d.expediente || '').toString().trim();
  let cantidad = d.cantidad != null ? parseInt(d.cantidad, 10) : 1;
  const seriales = Array.isArray(d.seriales) ? d.seriales.slice() : [];
  if (items && items.length > 0) {
    productLabel = items.map((it) => `${it.productLabel || '—'} (${it.cantidad != null ? it.cantidad : 1})`).join(', ');
    const expsUnicos = [];
    items.forEach((it) => {
      const expTxt = (it && it.expediente != null ? String(it.expediente) : '').trim() || '—';
      if (!expsUnicos.includes(expTxt)) expsUnicos.push(expTxt);
    });
    expediente = expsUnicos.join(', ');
    cantidad = items.reduce((sum, it) => sum + (it.cantidad != null ? parseInt(it.cantidad, 10) : 1), 0);
    items.forEach((it) => { (it.seriales || []).forEach((s) => { seriales.push(s); }); });
  }
  return {
    id: String(Date.now()),
    fecha: d.fecha || new Date().toISOString(),
    dependencia_id: d.dependencia_id || null,
    provision_id: d.provision_id || null,
    depLabel: (d.depLabel || '').toString().trim(),
    productLabel: productLabel || '—',
    expediente: expediente || '—',
    cantidad,
    seriales,
    concepto: (d.concepto || '').toString().trim() || null
  };
}
