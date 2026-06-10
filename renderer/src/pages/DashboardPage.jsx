import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLoading } from '../contexts/LoadingContext';
import { getStockAPI } from '../hooks/useStockAPI';
import { buildDashboardState, filterEventsByRange } from '../utils/dashboardData';
import Sparkline from '../components/dashboard/Sparkline';
import DonutChart from '../components/dashboard/DonutChart';
import BarChart from '../components/dashboard/BarChart';
import '../theme/dashboard-pro.css';

const KPI_CONFIG = [
  { key: 'inventario', label: 'Inventario disponible', color: '#1565a8', icon: 'M4 9l8-5 8 5v10H4V9z' },
  { key: 'recibidos', label: 'Recibidos este mes', color: '#1a6b45', icon: 'M12 5v14M5 12h14' },
  { key: 'entregas', label: 'Entregas este mes', color: '#c5a028', icon: 'M4 7h9l3 3h4v7H4V7z' },
  { key: 'expedientes', label: 'Expedientes', color: '#7c5cbf', icon: 'M4 6h7l2 2h7v10H4V6z' }
];

function TipoBadge({ tipo }) {
  const cls = tipo === 'Entrada' ? 'dash-badge dash-badge--entrada'
    : tipo === 'Entrega' ? 'dash-badge dash-badge--entrega'
      : 'dash-badge dash-badge--salida';
  return <span className={cls}>{tipo}</span>;
}

export default function DashboardPage() {
  const { show, hide } = useLoading();
  const [dash, setDash] = useState(null);
  const [range, setRange] = useState('7');

  const loadDashboard = useCallback(async () => {
    const api = getStockAPI();
    if (!api?.getDashboardData) return;
    show('Cargando inicio…');
    try {
      const data = await api.getDashboardData();
      setDash(buildDashboardState(data));
    } finally {
      hide();
    }
  }, [hide, show]);

  useEffect(() => {
    loadDashboard();
    window._realtimeRefresh = () => { loadDashboard(); };
    return () => {
      if (window._realtimeRefresh) window._realtimeRefresh = undefined;
    };
  }, [loadDashboard]);

  const movimientos = useMemo(() => {
    if (!dash) return [];
    return filterEventsByRange(dash.allEvents, range);
  }, [dash, range]);

  if (!dash) return null;

  return (
      <div className="dash-pro">
        <section className="dash-pro-kpis">
          {KPI_CONFIG.map((k) => (
            <article key={k.key} className="dash-pro-kpi" style={{ '--kpi-color': k.color }}>
              <div className="dash-pro-kpi-top">
                <div className="dash-pro-kpi-icon" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d={k.icon} />
                  </svg>
                </div>
                <Sparkline data={dash.sparklines[k.key]} color={k.color} />
              </div>
              <p className="dash-pro-kpi-label">{k.label}</p>
              <p className="dash-pro-kpi-value">{dash.metrics[k.key]}</p>
            </article>
          ))}
        </section>

        <section className="dash-pro-middle">
          <article className="dash-pro-card">
            <h3 className="dash-pro-card-title">Resumen general</h3>
            <DonutChart slices={dash.resumenSlices} total={dash.resumenTotal} />
          </article>

          <article className="dash-pro-card">
            <h3 className="dash-pro-card-title">Movimientos por tipo</h3>
            <p className="dash-pro-card-sub">Últimos 7 días</p>
            <BarChart labels={dash.barChart.labels} series={dash.barChart.series} />
          </article>

          <article className="dash-pro-card dash-pro-alerts">
            <h3 className="dash-pro-card-title">Alertas y recordatorios</h3>
            <ul className="dash-alert-list">
              {dash.alertas.map((a, i) => (
                <li key={i} className={`dash-alert dash-alert--${a.tipo}`}>
                  <div className="dash-alert-icon" aria-hidden="true">
                    {a.tipo === 'danger' && '!'}
                    {a.tipo === 'warn' && '⚠'}
                    {a.tipo === 'info' && 'i'}
                    {a.tipo === 'ok' && '✓'}
                  </div>
                  <div className="dash-alert-body">
                    <strong>{a.titulo}</strong>
                    <span>{a.detalle}</span>
                  </div>
                  {a.count > 0 && <span className="dash-alert-count">{a.count}</span>}
                </li>
              ))}
            </ul>
          </article>
        </section>

        <section className="dash-pro-card dash-pro-movimientos">
          <div className="dash-pro-mov-header">
            <div>
              <h3 className="dash-pro-card-title">Movimientos recientes</h3>
              <p className="dash-pro-card-sub">Registro de entradas y entregas del sistema</p>
            </div>
            <div className="dash-pro-mov-tools">
              <div className="dash-pro-filters">
                {['hoy', '7', '30'].map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`dash-filter-btn${range === r ? ' active' : ''}`}
                    onClick={() => setRange(r)}
                  >
                    {r === 'hoy' ? 'Hoy' : `${r} días`}
                  </button>
                ))}
              </div>
              <Link to="/productos" className="dash-link-all">Ver todos →</Link>
            </div>
          </div>

          {movimientos.length === 0 ? (
            <div className="inst-empty-state">
              <p id="dashboard-movimientos-empty">No hay movimientos en el período seleccionado.</p>
              <p className="inst-empty-hint">Probá ampliar el rango con los filtros (7 o 30 días).</p>
            </div>
          ) : (
            <div className="inst-table-wrap table-wrap">
              <table className="data-table inst-movimientos-table dash-mov-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Expediente</th>
                    <th>Producto</th>
                    <th className="num-col">Cant.</th>
                    <th>Usuario</th>
                    <th>Dependencia</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.map((m, i) => (
                    <tr key={i}>
                      <td className="dash-mov-fecha">
                        {m.fecha ? new Date(m.fecha).toLocaleString('es-AR', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        }) : '—'}
                      </td>
                      <td><TipoBadge tipo={m.tipo} /></td>
                      <td>{m.expediente}</td>
                      <td className="dash-mov-prod" title={m.producto}>{m.producto}</td>
                      <td className="num-col">{m.cantidad ?? '—'}</td>
                      <td>{m.usuario}</td>
                      <td className="dash-mov-dep" title={m.dependencia}>{m.dependencia}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="dash-pro-footer">
          Policía de Tucumán · Sistema de Gestión de Bienes y Patrimoniales
        </footer>
      </div>
  );
}
