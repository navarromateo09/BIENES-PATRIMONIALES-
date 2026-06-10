export const DEP_CARD_COLORS = [
  'mf-metric--green',
  'mf-metric--blue',
  'mf-metric--orange',
  'mf-metric--violet',
  'mf-metric--red'
];

export function grupoKey(m) {
  const nombre = (m.nombre || '').toString().trim().toLowerCase();
  const marca = (m.marca || '').toString().trim().toLowerCase();
  return `${nombre}|${marca}`;
}

export function getEntradasConSalidas(movimientos) {
  const movs = movimientos || [];
  const entradas = movs.filter((m) => m && m.tipo === 'entrada');
  const salidas = movs.filter((m) => m && m.tipo === 'salida');
  const salidasPorEntrada = {};
  salidas.forEach((s) => {
    const eid = s.entradaId;
    if (eid) salidasPorEntrada[eid] = (salidasPorEntrada[eid] || 0) + (parseInt(s.cantidad, 10) || 0);
  });
  entradas.sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));
  return { entradas, salidasPorEntrada };
}

export function agruparEntradas(entradas, salidasPorEntrada) {
  const map = {};
  entradas.forEach((m) => {
    const key = grupoKey(m);
    if (!map[key]) {
      map[key] = {
        key,
        nombre: (m.nombre || '').toString().trim() || 'Sin nombre',
        marca: (m.marca || '').toString().trim(),
        total: 0,
        disponible: 0,
        agotados: 0
      };
    }
    const cantidad = parseInt(m.cantidad, 10) || 0;
    const entregado = salidasPorEntrada[m.id] || 0;
    const disponible = Math.max(0, cantidad - entregado);
    map[key].total += cantidad;
    map[key].disponible += disponible;
    if (disponible === 0) map[key].agotados += 1;
  });
  return Object.values(map).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export function toLocalDatetimeValue(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
}

export function fromLocalDatetimeValue(val) {
  if (!val) return new Date().toISOString();
  try {
    return new Date(val).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

export function formatMovFecha(fecha) {
  if (!fecha) return '—';
  return new Date(fecha).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function filterEntradas(entradas, { filtroGrupoKey, busqueda }) {
  let filtradas = entradas;
  if (filtroGrupoKey) {
    filtradas = filtradas.filter((m) => grupoKey(m) === filtroGrupoKey);
  }
  const q = (busqueda || '').trim().toLowerCase();
  if (q) {
    filtradas = filtradas.filter((m) => {
      const blob = [m.expediente, m.nombre, m.marca, m.numeroSerie, m.concepto].join(' ').toLowerCase();
      return blob.indexOf(q) >= 0;
    });
  }
  return filtradas;
}
