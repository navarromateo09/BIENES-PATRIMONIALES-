import { useCallback, useEffect, useState } from 'react';
import { useLoading } from '../contexts/LoadingContext';
import { getStockAPI } from '../hooks/useStockAPI';

function formatFecha(fechaStr) {
  if (!fechaStr) return '—';
  const d = new Date(fechaStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-AR');
}

function badgeClass(accion) {
  switch (String(accion || '').toUpperCase()) {
    case 'CREAR': return 'badge-entrada';
    case 'EDITAR': return 'badge-editar';
    case 'ELIMINAR': return 'badge-salida';
    case 'LOGIN': return 'badge-login';
    case 'LOGOUT': return 'badge-logout';
    default: return '';
  }
}

export default function AuditoriaPage() {
  const { show, hide } = useLoading();
  const [entries, setEntries] = useState([]);
  const [filtros, setFiltros] = useState({
    modulo: '', accion: '', usuario: '', dependencia: '', desde: '', hasta: '', q: ''
  });

  const cargar = useCallback(async () => {
    const api = getStockAPI();
    if (!api?.getAuditLog) return;
    show('Cargando historial…');
    try {
      const f = {};
      if (filtros.modulo) f.modulo = filtros.modulo;
      if (filtros.accion) f.accion = filtros.accion;
      if (filtros.usuario.trim()) f.usuario = filtros.usuario.trim();
      if (filtros.dependencia.trim()) f.dependencia = filtros.dependencia.trim();
      if (filtros.desde) f.desde = new Date(`${filtros.desde}T00:00:00`).toISOString();
      if (filtros.hasta) f.hasta = new Date(`${filtros.hasta}T23:59:59`).toISOString();
      if (filtros.q.trim()) f.q = filtros.q.trim();
      const rows = await api.getAuditLog(f);
      setEntries(Array.isArray(rows) ? rows : []);
    } finally {
      hide();
    }
  }, [filtros, show, hide]);

  useEffect(() => { cargar(); }, []);

  return (
      <div className="content-panel">
        <div className="panel-header"><h2 className="page-title">Auditoría</h2></div>
        <p className="panel-desc">Historial de acciones en el sistema.</p>

        <div className="form-row" style={{ marginBottom: '1rem' }}>
          <div className="form-group">
            <label>Módulo</label>
            <input value={filtros.modulo} onChange={(e) => setFiltros({ ...filtros, modulo: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Acción</label>
            <input value={filtros.accion} onChange={(e) => setFiltros({ ...filtros, accion: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Usuario</label>
            <input value={filtros.usuario} onChange={(e) => setFiltros({ ...filtros, usuario: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Desde</label>
            <input type="date" value={filtros.desde} onChange={(e) => setFiltros({ ...filtros, desde: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Hasta</label>
            <input type="date" value={filtros.hasta} onChange={(e) => setFiltros({ ...filtros, hasta: e.target.value })} />
          </div>
        </div>
        <div className="form-group">
          <label>Búsqueda</label>
          <input value={filtros.q} onChange={(e) => setFiltros({ ...filtros, q: e.target.value })} placeholder="Texto en detalle…" />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <button type="button" className="btn btn-primary" onClick={cargar}>Filtrar</button>
          <button type="button" className="btn btn-secondary" style={{ marginLeft: '0.5rem' }} onClick={cargar}>Refrescar</button>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Módulo</th><th>Detalle</th></tr>
            </thead>
            <tbody id="audit-lista">
              {entries.length === 0 ? (
                <tr><td colSpan={5} className="empty-state">Sin registros.</td></tr>
              ) : entries.map((e, i) => (
                <tr key={i}>
                  <td>{formatFecha(e.fecha)}</td>
                  <td>{e.usuario || '—'}</td>
                  <td><span className={`badge ${badgeClass(e.accion)}`}>{e.accion || '—'}</span></td>
                  <td>{e.modulo || '—'}</td>
                  <td>{e.detalle || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
  );
}
