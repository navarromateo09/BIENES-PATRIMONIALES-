/** Procesa datos de getDashboardData para el panel de inicio. */

function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function lastNDays(n) {
  const days = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    days.push({ key: dayKey(d.getTime()), label: d.toLocaleDateString('es-AR', { weekday: 'short' }) });
  }
  return days;
}

function sparkFromDaily(dailyMap, days, fallback = 0) {
  return days.map((d) => dailyMap[d.key] ?? fallback);
}

export function buildDashboardState(data) {
  const productos = data.productos || [];
  const movimientosRaw = data.movimientos || [];
  const provisiones = data.guardiaProvisiones || [];
  const dependencias = data.dependencias || [];
  const matafuegos = data.matafuegos || [];

  const entradas = movimientosRaw.filter((m) => m.tipo === 'entrada');
  const salidas = movimientosRaw.filter((m) => m.tipo === 'salida');
  const salidasPorMov = {};
  salidas.forEach((m) => {
    const eid = m.entradaId || m.movimientoEntradaId || m.entrada_id;
    if (eid) salidasPorMov[eid] = (salidasPorMov[eid] || 0) + (m.cantidad || 0);
  });
  const provistosPorMov = {};
  provisiones.forEach((p) => {
    if (p.movimiento_id) provistosPorMov[p.movimiento_id] = (provistosPorMov[p.movimiento_id] || 0) + (p.cantidad || 1);
  });

  let totalInventario = 0;
  let totalEntregado = 0;
  entradas.forEach((m) => {
    const salido = salidasPorMov[m.id] || 0;
    const provisto = provistosPorMov[m.id] || 0;
    const disp = (m.cantidad || 0) - salido - provisto;
    if (disp > 0) totalInventario += disp;
    totalEntregado += salido + provisto;
  });

  const ahora = new Date();
  const mes = ahora.getMonth();
  const anio = ahora.getFullYear();

  const recibidos = entradas
    .filter((m) => {
      const d = new Date(m.fecha);
      return d.getMonth() === mes && d.getFullYear() === anio;
    })
    .reduce((s, m) => s + (m.cantidad || 0), 0);

  const entregasMes = provisiones.filter((p) => {
    const d = new Date(p.fecha_asignacion);
    return d.getMonth() === mes && d.getFullYear() === anio;
  }).length;

  const getExp = (pid) => {
    const p = productos.find((x) => x.id === pid);
    return p ? (p.codigo || p.id || '—') : '—';
  };
  const getNom = (pid) => {
    const p = productos.find((x) => x.id === pid);
    return p ? (p.nombre || p.codigo || '—') : '—';
  };
  const getDep = (did) => {
    const d = dependencias.find((x) => x.id === did);
    return d ? (d.nombre || d.codigo || '—') : '—';
  };

  const movs = movimientosRaw.map((m) => ({
    fecha: m.fecha ? new Date(m.fecha).getTime() : 0,
    tipoRaw: m.tipo,
    tipo: m.tipo === 'entrada' ? 'Entrada' : m.tipo === 'salida' ? 'Salida' : 'Entrega',
    expediente: getExp(m.productoId),
    producto: m.nombre || m.numeroSerie || getNom(m.productoId),
    cantidad: m.cantidad,
    usuario: m.usuario || '—',
    dependencia: m.destino || '—'
  }));

  const provs = provisiones.map((p) => ({
    fecha: p.fecha_asignacion ? new Date(p.fecha_asignacion).getTime() : 0,
    tipoRaw: 'provision',
    tipo: 'Entrega',
    expediente: getExp(p.producto_id),
    producto: getNom(p.producto_id),
    cantidad: p.cantidad ?? 1,
    usuario: p.usuario || '—',
    dependencia: getDep(p.dependencia_id)
  }));

  const allEvents = movs.concat(provs).sort((a, b) => b.fecha - a.fecha);

  const days7 = lastNDays(7);
  const dailyInv = {};
  const dailyRec = {};
  const dailyEnt = {};
  const dailyExp = {};
  const barEntradas = {};
  const barEntregas = {};
  const barSalidas = {};
  const barOtros = {};

  days7.forEach((d) => {
    dailyInv[d.key] = 0;
    dailyRec[d.key] = 0;
    dailyEnt[d.key] = 0;
    dailyExp[d.key] = 0;
    barEntradas[d.key] = 0;
    barEntregas[d.key] = 0;
    barSalidas[d.key] = 0;
    barOtros[d.key] = 0;
  });

  entradas.forEach((m) => {
    if (!m.fecha) return;
    const k = dayKey(new Date(m.fecha).getTime());
    if (dailyRec[k] != null) dailyRec[k] += m.cantidad || 1;
    if (barEntradas[k] != null) barEntradas[k] += 1;
  });
  provisiones.forEach((p) => {
    if (!p.fecha_asignacion) return;
    const k = dayKey(new Date(p.fecha_asignacion).getTime());
    if (dailyEnt[k] != null) dailyEnt[k] += 1;
    if (barEntregas[k] != null) barEntregas[k] += 1;
  });
  salidas.forEach((m) => {
    if (!m.fecha) return;
    const k = dayKey(new Date(m.fecha).getTime());
    if (barSalidas[k] != null) barSalidas[k] += 1;
  });

  productos.forEach((p) => {
    if (p.createdAt) {
      const k = dayKey(new Date(p.createdAt).getTime());
      if (dailyExp[k] != null) dailyExp[k] += 1;
    }
  });

  const resumenSlices = [
    { label: 'Disponibles', value: totalInventario, color: '#1565a8' },
    { label: 'Entregados', value: totalEntregado, color: '#1a6b45' },
    { label: 'Expedientes', value: productos.length, color: '#7c5cbf' },
    { label: 'Provisiones', value: provisiones.length, color: '#c5a028' }
  ].filter((s) => s.value > 0);

  if (resumenSlices.length === 0) {
    resumenSlices.push({ label: 'Sin datos', value: 1, color: '#cbd5e1' });
  }

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const en30 = new Date(hoy);
  en30.setDate(en30.getDate() + 30);

  const alertas = [];
  let mfVenc = 0;
  matafuegos.forEach((mf) => {
    if (!mf.fechaVencimiento) return;
    const fv = new Date(mf.fechaVencimiento);
    if (fv >= hoy && fv <= en30) mfVenc += 1;
  });
  if (mfVenc > 0) {
    alertas.push({ tipo: 'warn', titulo: 'Matafuegos próximos a vencer', detalle: `${mfVenc} unidad(es) en los próximos 30 días`, count: mfVenc });
  }

  const stockBajo = productos.filter((p) => (p.stockActual ?? p.stock_actual ?? 99) <= 2).length;
  if (stockBajo > 0) {
    alertas.push({ tipo: 'danger', titulo: 'Stock bajo en inventario', detalle: `${stockBajo} producto(s) con stock ≤ 2`, count: stockBajo });
  }

  if (entregasMes > 0) {
    alertas.push({ tipo: 'info', titulo: 'Entregas este mes', detalle: `${entregasMes} entrega(s) registradas`, count: entregasMes });
  }

  if (alertas.length === 0) {
    alertas.push({ tipo: 'ok', titulo: 'Sin alertas pendientes', detalle: 'El sistema está al día', count: 0 });
  }

  return {
    metrics: {
      inventario: totalInventario,
      recibidos,
      entregas: entregasMes,
      expedientes: productos.length
    },
    sparklines: {
      inventario: sparkFromDaily(dailyInv, days7, totalInventario > 0 ? 1 : 0),
      recibidos: sparkFromDaily(dailyRec, days7),
      entregas: sparkFromDaily(dailyEnt, days7),
      expedientes: sparkFromDaily(dailyExp, days7, productos.length > 0 ? 1 : 0)
    },
    resumenSlices,
    resumenTotal: resumenSlices.reduce((s, x) => s + x.value, 0),
    barChart: {
      labels: days7.map((d) => d.label),
      series: [
        { name: 'Entradas', color: '#1565a8', values: days7.map((d) => barEntradas[d.key] || 0) },
        { name: 'Entregas', color: '#1a6b45', values: days7.map((d) => barEntregas[d.key] || 0) },
        { name: 'Salidas', color: '#c5a028', values: days7.map((d) => barSalidas[d.key] || 0) }
      ]
    },
    alertas,
    allEvents
  };
}

export function filterEventsByRange(events, range) {
  const desde = range === 'hoy'
    ? (() => { const h = new Date(); h.setHours(0, 0, 0, 0); return h.getTime(); })()
    : (() => {
      const d = new Date();
      d.setDate(d.getDate() - (parseInt(range, 10) - 1));
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    })();
  return events.filter((e) => e.fecha >= desde).slice(0, 20);
}
