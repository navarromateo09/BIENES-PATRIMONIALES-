import { getDisplayLabel } from './dependenciasHelpers';
import { formatMovFecha, fromLocalDatetimeValue, toLocalDatetimeValue } from './depositoHelpers';

export { toLocalDatetimeValue, fromLocalDatetimeValue, formatMovFecha };

export function buildSalidasPorEntrada(movimientos) {
  const salidas = (movimientos || []).filter((m) => m?.tipo === 'salida');
  const map = {};
  salidas.forEach((s) => {
    const eid = s.entradaId || s.entrada;
    if (eid) map[eid] = (map[eid] || 0) + (parseInt(s.cantidad, 10) || 0);
  });
  return map;
}

export function buildProvistosGuardiaPorMov(guardiaProvisiones) {
  const map = {};
  (guardiaProvisiones || []).forEach((p) => {
    if (p.movimiento_id) {
      map[p.movimiento_id] = (map[p.movimiento_id] || 0) + (p.cantidad != null ? p.cantidad : 1);
    }
  });
  return map;
}

export function getCodigoExpediente(m, productos) {
  if (!m?.productoId) return 'Sin asignar';
  const producto = (productos || []).find((p) => p.id === m.productoId);
  return producto ? ((producto.codigo || '').trim() || '-') : 'Sin asignar';
}

export function sortEntradasInventario(entradas, productos) {
  return [...entradas].sort((a, b) => {
    const codA = (productos || []).find((p) => p.id === a.productoId);
    const codB = (productos || []).find((p) => p.id === b.productoId);
    const sA = `${codA?.codigo || ''}${a.fecha || ''}`;
    const sB = `${codB?.codigo || ''}${b.fecha || ''}`;
    return sB.localeCompare(sA);
  });
}

export function filterEntradasInventario(entradas, productos, busqueda) {
  const q = (busqueda || '').trim().toLowerCase();
  if (!q) return entradas;
  return entradas.filter((m) => {
    const producto = m.productoId ? (productos || []).find((p) => p.id === m.productoId) : null;
    const codigoExp = producto ? ((producto.codigo || '').toString().trim() || '').toLowerCase() : '';
    const nombre = (m.nombre || '').toString().toLowerCase();
    const numeroSerie = (m.numeroSerie || '').toString().toLowerCase();
    const marca = (m.marca || '').toString().toLowerCase();
    const concepto = (m.concepto || '').toString().toLowerCase();
    return nombre.includes(q) || numeroSerie.includes(q) || codigoExp.includes(q)
      || marca.includes(q) || concepto.includes(q);
  });
}

export function computeDisponible(m, salidasPorEntrada, provistosGuardiaPorMov) {
  const cantidad = parseInt(m.cantidad, 10) || 0;
  const entregado = salidasPorEntrada[m.id] || 0;
  const provistoGuardia = provistosGuardiaPorMov[m.id] || 0;
  return Math.max(0, cantidad - entregado - provistoGuardia);
}

export function normalizarCodigoSerie(valor) {
  let raw = String(valor || '').toUpperCase();
  raw = raw.replace(/[^A-Z0-9\-\.\/ ]/g, '');
  raw = raw.replace(/\s+/g, '-').replace(/-+/g, '-').trim();
  return raw || '';
}

export function generarCodigoSerieUnico(existingSeries = new Set()) {
  const fecha = new Date();
  const stamp = `${fecha.getFullYear()}${String(fecha.getMonth() + 1).padStart(2, '0')}${String(fecha.getDate()).padStart(2, '0')}`;
  for (let intentos = 0; intentos < 2000; intentos++) {
    const sufijo = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    const codigo = `SR-${stamp}-${sufijo}`;
    if (!existingSeries.has(codigo)) return codigo;
  }
  return `SR-${Date.now()}`;
}

export function collectExistingSeries(movimientos) {
  return new Set(
    (movimientos || [])
      .map((m) => String(m?.numeroSerie || '').trim().toUpperCase())
      .filter(Boolean)
  );
}

export function generarSeriesAutomaticas(cantidad, movimientos, force = false, currentSeries = []) {
  const usados = collectExistingSeries(movimientos);
  const result = [...currentSeries];
  while (result.length < cantidad) result.push('');

  for (let i = 0; i < cantidad; i++) {
    const valorActual = String(result[i] || '').trim();
    if (valorActual && !force) continue;
    let codigo = '';
    let guard = 0;
    while (!codigo && guard < 500) {
      const candidato = normalizarCodigoSerie(generarCodigoSerieUnico(usados));
      if (!candidato || usados.has(candidato)) {
        guard++;
        continue;
      }
      codigo = candidato;
    }
    if (!codigo) codigo = normalizarCodigoSerie(`SR-${Date.now()}-${i}`);
    result[i] = codigo;
    usados.add(codigo);
  }
  return result;
}

export function buildHistorialRows(data) {
  const { productos = [], movimientos = [], guardiaProvisiones = [], dependencias = [] } = data;

  const getExpedienteNum = (productoId) => {
    const p = productos.find((x) => x.id === productoId);
    return p ? ((p.codigo || p.id || '').toString().trim() || '—') : '—';
  };

  const getNombreDep = (id) => {
    const d = dependencias.find((x) => x.id === id);
    return d ? getDisplayLabel(d, dependencias) : '(dependencia eliminada)';
  };

  const movs = movimientos.map((m) => {
    const prod = productos.find((x) => x.id === m.productoId);
    const nombreProducto = (m.nombre || m.numeroSerie || (prod && (prod.nombre || prod.codigo)) || '').toString().trim() || '—';
    const usuario = (m.usuario || m.user || m.username || m.userEmail || m.email || '').toString().trim() || '—';
    const destinoRaw = (m.destino || '').trim();
    return {
      fecha: m.fecha ? new Date(m.fecha).getTime() : 0,
      tipo: m.tipo,
      tipoLabel: m.tipo === 'entrada' ? 'Entrada' : 'Salida',
      tipoClass: m.tipo === 'entrada' ? 'badge-entrada' : 'badge-salida',
      expediente: getExpedienteNum(m.productoId),
      producto: nombreProducto,
      destino: m.tipo === 'salida' ? (destinoRaw ? `Entregado a ${destinoRaw}` : '—') : '—',
      cantidad: m.cantidad,
      concepto: (m.concepto || '').trim() || '—',
      usuario
    };
  });

  const provisiones = guardiaProvisiones.map((p) => {
    const prod = productos.find((x) => x.id === p.producto_id);
    let nombreProducto = '';
    if (prod) nombreProducto = `${prod.nombre || ''} ${prod.codigo || ''}`.trim();
    if (p.movimiento_id && movimientos.length) {
      const mov = movimientos.find((m) => m.id === p.movimiento_id);
      if (mov) nombreProducto = (mov.nombre || mov.numeroSerie || '').toString().trim() || nombreProducto || 'ítem';
    }
    const usuarioProv = (p.usuario || p.user || p.username || p.userEmail || p.email || '').toString().trim() || '—';
    const depLabel = getNombreDep(p.dependencia_id);
    return {
      fecha: p.fecha_asignacion ? new Date(p.fecha_asignacion).getTime() : 0,
      tipo: 'provision',
      tipoLabel: 'Provisión / Entrega',
      tipoClass: 'badge-provision',
      expediente: getExpedienteNum(p.producto_id),
      producto: nombreProducto || '—',
      destino: depLabel ? `Entregado a ${depLabel}` : '—',
      cantidad: p.cantidad != null ? p.cantidad : 1,
      concepto: (p.concepto || '').trim() || '—',
      usuario: usuarioProv
    };
  });

  return [...movs, ...provisiones].sort((a, b) => b.fecha - a.fecha);
}

export function filterHistorialRows(rows, filtros) {
  const qBuscar = (filtros.buscar || '').trim().toLowerCase();
  const qTipo = filtros.tipo || '';
  const qDesde = filtros.desde ? new Date(`${filtros.desde}T00:00:00`).getTime() : 0;
  const qHasta = filtros.hasta ? new Date(`${filtros.hasta}T23:59:59`).getTime() : 0;
  const qUsuario = (filtros.usuario || '').trim().toLowerCase();

  if (!qBuscar && !qTipo && !qDesde && !qHasta && !qUsuario) return rows;

  return rows.filter((e) => {
    if (qTipo && e.tipo !== qTipo) return false;
    if (qDesde && e.fecha < qDesde) return false;
    if (qHasta && e.fecha > qHasta) return false;
    if (qUsuario && !(e.usuario || '').toLowerCase().includes(qUsuario)) return false;
    if (qBuscar) {
      const haystack = [e.producto, e.expediente, e.destino, e.concepto, e.tipoLabel].join(' ').toLowerCase();
      if (!haystack.includes(qBuscar)) return false;
    }
    return true;
  });
}

export function buildEntregasInfo(movId, data) {
  const provs = (data.guardiaProvisiones || []).filter((p) => p?.movimiento_id === movId);
  provs.sort((a, b) => new Date(b.fecha_asignacion || 0) - new Date(a.fecha_asignacion || 0));
  const deps = data.dependencias || [];
  const mov = (data.movimientos || []).find((m) => m?.id === movId);
  const movUsuario = mov
    ? (mov.usuario || mov.user || mov.username || mov.email || '').toString().trim() || ''
    : '';

  const items = provs.map((p) => {
    const d = deps.find((x) => x.id === p.dependencia_id);
    const dep = d ? getDisplayLabel(d, deps) || d.nombre || d.codigo || '—' : '—';
    const usuario = (p.usuario || p.user || p.username || p.email || '').toString().trim() || movUsuario || '—';
    return {
      fecha: p.fecha_asignacion
        ? new Date(p.fecha_asignacion).toLocaleString('es-ES', {
          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        })
        : '—',
      dependencia: dep,
      cantidad: p.cantidad != null ? p.cantidad : 1,
      concepto: (p.concepto || '').toString().trim() || '—',
      usuario
    };
  });

  return { count: provs.length, items };
}
