import { getDisplayLabel } from './dependenciasHelpers';
import { buildProvistosGuardiaPorMov } from './productosHelpers';

export { buildProvistosGuardiaPorMov };

export function getAnioParaOrden(p) {
  let anioVal = (p.anio || '').toString().trim();
  if (!anioVal && (p.codigo || '')) {
    const match = (p.codigo || '').toString().match(/\b(19|20)\d{2}\b/);
    if (match) anioVal = match[0];
  }
  return anioVal ? parseInt(anioVal, 10) : 0;
}

export function getAnioDisplay(p) {
  let anioVal = (p.anio || '').toString().trim();
  const codigo = (p.codigo || '').toString().trim();
  if (!anioVal && codigo) {
    const match = codigo.match(/\b(19|20)\d{2}\b/);
    if (match) anioVal = match[0];
  }
  return anioVal || '—';
}

export function tieneAlgunaEntrada(expId, movimientos) {
  return (movimientos || []).some((m) => m?.tipo === 'entrada' && m.productoId === expId);
}

export function tieneStockDisponible(expId, movimientos, provistosPorMov) {
  const entradas = (movimientos || []).filter((m) => m.tipo === 'entrada' && m.productoId === expId);
  if (!entradas.length) return false;
  return entradas.some((m) => {
    const cant = parseInt(m.cantidad, 10) || 0;
    const prov = provistosPorMov[m.id] || 0;
    return cant - prov > 0;
  });
}

export function getExpedienteEstado(expId, movimientos, provistosPorMov) {
  const vacio = !tieneAlgunaEntrada(expId, movimientos);
  if (vacio) return { clase: 'estado-exp-vacio', texto: 'VACÍO' };
  const activo = tieneStockDisponible(expId, movimientos, provistosPorMov);
  if (activo) return { clase: 'estado-exp-activo', texto: 'ACTIVO' };
  return { clase: 'estado-exp-entregado', texto: 'ENTREGADO' };
}

export function filterExpedientes(productos, { busqueda, movimientos, provistosPorMov }) {
  const q = (busqueda || '').trim().toLowerCase();
  if (!q) return productos || [];
  return (productos || []).filter((p) => {
    const codigo = `${p.codigo || ''} ${p.nombre || ''}`.trim().toLowerCase();
    let anio = `${p.anio || ''}`.toLowerCase();
    if (!anio && (p.codigo || '')) {
      const m = (p.codigo || '').toString().match(/\b(19|20)\d{2}\b/);
      if (m) anio = m[0];
    }
    const solicitado = (p.solicitadoPor || '').toString().trim().toLowerCase();
    const esVacio = !tieneAlgunaEntrada(p.id, movimientos);
    const esActivo = !esVacio && tieneStockDisponible(p.id, movimientos, provistosPorMov);
    const estadoStr = esVacio ? 'vacio' : (esActivo ? 'activo' : 'entregado');
    return codigo.includes(q) || anio.includes(q) || solicitado.includes(q) || estadoStr.includes(q);
  });
}

export function sortExpedientes(items, orden) {
  const list = [...(items || [])];
  return list.sort((a, b) => {
    if (orden === 'numero-asc') {
      return (a.codigo || '').toString().toLowerCase().localeCompare((b.codigo || '').toString().toLowerCase(), 'es');
    }
    if (orden === 'numero-desc') {
      return (b.codigo || '').toString().toLowerCase().localeCompare((a.codigo || '').toString().toLowerCase(), 'es');
    }
    const aa = getAnioParaOrden(a);
    const bb = getAnioParaOrden(b);
    if (orden === 'anio-desc') return bb - aa;
    if (orden === 'anio-asc') return aa - bb;
    return 0;
  });
}

export function filterDetalleEntradas(entradas, busqueda) {
  const q = (busqueda || '').trim().toLowerCase();
  if (!q) return entradas || [];
  return (entradas || []).filter((m) => {
    const parts = [
      m.nombre,
      m.marca,
      m.concepto,
      m.numeroSerie,
      m.fecha ? new Date(m.fecha).toLocaleString('es-ES') : ''
    ].map((x) => (x == null ? '' : String(x))).join(' ').toLowerCase();
    return parts.includes(q);
  });
}

export function enrichDetalleMovimiento(m, provistosPorMov) {
  const fecha = m.fecha
    ? new Date(m.fecha).toLocaleDateString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    })
    : '-';
  const recibido = parseInt(m.cantidad, 10) || 0;
  const provistoGuardia = provistosPorMov[m.id] || 0;
  const disponible = Math.max(0, recibido - provistoGuardia);
  return {
    mov: m,
    fecha,
    recibido,
    provistoGuardia,
    disponible,
    dispLabel: disponible === 0 ? 'AGOTADO' : String(disponible),
    agotado: disponible === 0,
    tieneEntregas: provistoGuardia > 0
  };
}

export function getDepLabel(depId, dependencias) {
  if (!depId) return '—';
  const d = (dependencias || []).find((x) => x.id === depId);
  return d ? getDisplayLabel(d, dependencias) : '—';
}

export function buildEntregasRows(movId, { guardiaProvisiones, movimientos, dependencias }) {
  const provs = (guardiaProvisiones || []).filter((p) => p?.movimiento_id === movId);
  provs.sort((a, b) => new Date(b.fecha_asignacion || 0) - new Date(a.fecha_asignacion || 0));
  const mov = (movimientos || []).find((m) => m?.id === movId);
  const movUsuario = mov
    ? (mov.usuario || mov.user || mov.username || mov.email || '').toString().trim()
    : '';
  return provs.map((p) => ({
    id: p.id,
    fecha: p.fecha_asignacion
      ? new Date(p.fecha_asignacion).toLocaleString('es-ES', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
      })
      : '—',
    dep: getDepLabel(p.dependencia_id, dependencias),
    cantidad: p.cantidad != null ? p.cantidad : 1,
    concepto: (p.concepto || '').toString().trim() || '—',
    usuario: (p.usuario || p.user || p.username || p.email || '').toString().trim() || movUsuario || '—'
  }));
}

export function normalizeSerie(s) {
  return String(s || '').trim();
}

export function validateSerieInList(list, idx, val) {
  const v = normalizeSerie(val);
  if (!v) return 'Escribe un número de serie';
  for (let i = 0; i < (list || []).length; i++) {
    if (i === idx) continue;
    if (normalizeSerie(list[i]).toLowerCase() === v.toLowerCase()) return 'Número de serie repetido';
  }
  return '';
}

export function movimientoTieneProvisiones(movId, guardiaProvisiones) {
  if (!movId) return false;
  return (guardiaProvisiones || []).some((p) => p.movimiento_id === movId);
}
