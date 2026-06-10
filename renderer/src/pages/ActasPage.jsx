import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLoading } from '../contexts/LoadingContext';
import { useToast } from '../contexts/ToastContext';
import PaginationBar from '../components/PaginationBar';
import { getStockAPI } from '../hooks/useStockAPI';
import { paginar } from '../utils/pagination';
import {
  ACTA_PRINT_STYLES,
  PAG_CARPETAS_EXP,
  buildActaHtmlForReprint,
  fechaToDatetimeLocal,
  filtrarActas,
  formatFechaActa,
  getDepLabelActa,
  groupActasByExpediente,
  limpiarDepLabelViejo
} from '../utils/actasHelpers';

function ModalShell({ open, onClose, title, wide, children, actions }) {
  if (!open) return null;
  return createPortal(
    <div
      className="modal open modal-tema-clara"
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`modal-content${wide ? ' modal-content-wide' : ''}${title === 'Acta de entrega' ? ' modal-acta-content' : ''}`}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button type="button" className="modal-close" aria-label="Cerrar" onClick={onClose}>&times;</button>
        </div>
        {children}
        {actions}
      </div>
    </div>,
    document.body
  );
}

function ActaMenu({
  actaId,
  tieneAdjunto,
  open,
  onToggle,
  onVer,
  onVerAdjunto,
  onAdjuntar,
  onEditar,
  onEliminar
}) {
  return (
    <div className="exp-acciones-wrap">
      <button
        type="button"
        className="btn btn-icon btn-menu-exp btn-menu-acta"
        aria-label="Acciones"
        onClick={onToggle}
      >
        &#8942;
      </button>
      <div className={`exp-menu-dropdown exp-menu-acta${open ? ' exp-menu-open' : ''}`}>
        <button type="button" className="acta-menu-ver" onClick={onVer}>Ver</button>
        <button
          type="button"
          className="acta-menu-ver-adjunto"
          disabled={!tieneAdjunto}
          onClick={onVerAdjunto}
        >
          Ver adjunto
        </button>
        <button type="button" className="acta-menu-adjuntar" onClick={onAdjuntar}>
          {tieneAdjunto ? 'Reemplazar adjunto' : 'Adjuntar archivo'}
        </button>
        <button type="button" className="acta-menu-editar" onClick={onEditar}>Modificar</button>
        <button type="button" className="acta-menu-eliminar" onClick={onEliminar}>Eliminar</button>
      </div>
    </div>
  );
}

export default function ActasPage() {
  const { isAdmin, user } = useAuth();
  const { show, hide } = useLoading();
  const { showToast } = useToast();

  const [todasLasActas, setTodasLasActas] = useState([]);
  const [dependencias, setDependencias] = useState([]);

  const [busqueda, setBusqueda] = useState('');
  const [filtroDep, setFiltroDep] = useState('');
  const [filtroDesde, setFiltroDesde] = useState('');
  const [filtroHasta, setFiltroHasta] = useState('');
  const [pagActas, setPagActas] = useState(1);
  const [openMenuActaId, setOpenMenuActaId] = useState(null);

  const [actaEnVista, setActaEnVista] = useState(null);
  const [actaEnEdicion, setActaEnEdicion] = useState(null);
  const [editForm, setEditForm] = useState({
    fecha: '', dependenciaId: '', producto: '', expediente: '', cantidad: '1'
  });
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [adjuntandoId, setAdjuntandoId] = useState(null);
  const [eliminandoId, setEliminandoId] = useState(null);

  const verActaRef = useRef(null);

  const loadActas = useCallback(async () => {
    const api = getStockAPI();
    if (!api?.getData) return;
    show('Cargando actas…');
    try {
      const [data, deps] = await Promise.all([
        api.getData(),
        api.getDependencias ? api.getDependencias() : Promise.resolve([])
      ]);
      setTodasLasActas(Array.isArray(data?.actas) ? data.actas : []);
      setDependencias(Array.isArray(deps) ? deps : []);
    } catch {
      setTodasLasActas([]);
      setDependencias([]);
      showToast('Error al cargar actas', 'error');
    } finally {
      hide();
    }
  }, [hide, show, showToast]);

  useEffect(() => {
    loadActas();
    window._realtimeRefresh = (table) => {
      if (!table || table === 'actas') loadActas();
    };
    return () => {
      if (window._realtimeRefresh) window._realtimeRefresh = undefined;
    };
  }, [loadActas]);

  useEffect(() => {
    const closeMenus = () => setOpenMenuActaId(null);
    document.addEventListener('click', closeMenus);
    return () => document.removeEventListener('click', closeMenus);
  }, []);

  const filtroOpts = useMemo(() => {
    const desdeVal = filtroDesde ? `${filtroDesde}T00:00:00` : '';
    const hastaVal = filtroHasta ? `${filtroHasta}T23:59:59` : '';
    return {
      busqueda,
      dependenciaId: filtroDep,
      desde: desdeVal ? new Date(desdeVal).getTime() : 0,
      hasta: hastaVal ? new Date(hastaVal).getTime() : 0,
      dependencias
    };
  }, [busqueda, filtroDep, filtroDesde, filtroHasta, dependencias]);

  const actasFiltradas = useMemo(
    () => filtrarActas(todasLasActas, filtroOpts),
    [todasLasActas, filtroOpts]
  );

  const grupos = useMemo(
    () => groupActasByExpediente(actasFiltradas),
    [actasFiltradas]
  );

  const pageGrupos = useMemo(
    () => paginar(grupos, pagActas, PAG_CARPETAS_EXP),
    [grupos, pagActas]
  );

  const actaHtmlVista = useMemo(() => {
    if (!actaEnVista) return '';
    return buildActaHtmlForReprint(actaEnVista, dependencias);
  }, [actaEnVista, dependencias]);

  function limpiarFiltros() {
    setBusqueda('');
    setFiltroDep('');
    setFiltroDesde('');
    setFiltroHasta('');
    setPagActas(1);
  }

  function abrirVer(acta) {
    setOpenMenuActaId(null);
    setActaEnVista(acta);
  }

  function abrirEditar(acta) {
    setOpenMenuActaId(null);
    setActaEnEdicion(acta);
    setEditForm({
      fecha: fechaToDatetimeLocal(acta.fecha),
      dependenciaId: acta.dependencia_id || '',
      producto: (acta.productLabel || '').toString().trim(),
      expediente: (acta.expediente || '').toString().trim(),
      cantidad: acta.cantidad != null ? String(acta.cantidad) : '1'
    });
  }

  function imprimirActaDesdeModal() {
    if (!actaEnVista) return;
    const contenido = verActaRef.current?.innerHTML || buildActaHtmlForReprint(actaEnVista, dependencias);
    const ventana = window.open('', '_blank');
    if (!ventana) {
      showToast('Permite ventanas emergentes para imprimir', 'error');
      return;
    }
    ventana.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Acta de entrega</title><style>${ACTA_PRINT_STYLES}</style></head><body>${contenido}</body></html>`);
    ventana.document.close();
    ventana.focus();
    setTimeout(() => {
      ventana.print();
      ventana.close();
    }, 300);
  }

  async function handleAdjuntar(actaId) {
    const api = getStockAPI();
    if (!api?.pickActaAdjunto || !actaId || adjuntandoId) return;
    setOpenMenuActaId(null);
    setAdjuntandoId(actaId);
    show('Adjuntando archivo…');
    try {
      const res = await api.pickActaAdjunto(actaId);
      if (!res?.canceled) await loadActas();
    } catch (err) {
      showToast(err?.message || 'No se pudo adjuntar el archivo', 'error');
    } finally {
      setAdjuntandoId(null);
      hide();
    }
  }

  async function handleVerAdjunto(actaId) {
    const api = getStockAPI();
    if (!api?.openActaAdjunto || !actaId) return;
    setOpenMenuActaId(null);
    try {
      await api.openActaAdjunto(actaId);
    } catch (err) {
      showToast(err?.message || 'No se pudo abrir el adjunto', 'error');
    }
  }

  async function handleEliminar(actaId) {
    const api = getStockAPI();
    if (!api?.deleteActa || !actaId || eliminandoId) return;
    if (!window.confirm('¿Seguro que querés eliminar esta acta?')) return;
    setOpenMenuActaId(null);
    setEliminandoId(actaId);
    show('Eliminando acta…');
    try {
      await api.deleteActa(actaId);
      setTodasLasActas((prev) => prev.filter((a) => (a.id || '') !== actaId));
      showToast('Acta eliminada', 'success');
    } catch (err) {
      showToast(err?.message || 'Error al eliminar', 'error');
    } finally {
      setEliminandoId(null);
      hide();
    }
  }

  async function handleGuardarEdicion(e) {
    e.preventDefault();
    if (!actaEnEdicion || submittingEdit) return;
    const api = getStockAPI();
    if (!api?.saveActa) {
      showToast('Función de guardado no disponible', 'error');
      return;
    }

    const fechaIso = editForm.fecha
      ? new Date(editForm.fecha).toISOString()
      : (actaEnEdicion.fecha || new Date().toISOString());
    const dep = dependencias.find((d) => d.id === editForm.dependenciaId);
    const depLabel = dep ? getDepLabelActa(dep.id, dependencias) : (actaEnEdicion.depLabel || '');
    const usuarioActual = user?.username || 'admin';

    const payload = {
      id: actaEnEdicion.id,
      fecha: fechaIso,
      dependencia_id: editForm.dependenciaId || null,
      depLabel,
      productLabel: editForm.producto.trim(),
      expediente: editForm.expediente.trim(),
      cantidad: parseInt(editForm.cantidad, 10) || 1,
      seriales: Array.isArray(actaEnEdicion.seriales) ? actaEnEdicion.seriales : [],
      concepto: actaEnEdicion.concepto || null,
      provision_id: actaEnEdicion.provision_id || null,
      modificadoPor: usuarioActual,
      modificadoEn: new Date().toISOString()
    };

    setSubmittingEdit(true);
    show('Guardando acta…');
    try {
      await api.saveActa(payload);
      setActaEnEdicion(null);
      showToast('Acta guardada', 'success');
      await loadActas();
    } catch (err) {
      showToast(err?.message || 'Error al guardar', 'error');
    } finally {
      setSubmittingEdit(false);
      hide();
    }
  }

  function getDepDisplay(acta) {
    let dep = getDepLabelActa(acta.dependencia_id, dependencias);
    if (dep === '—') dep = limpiarDepLabelViejo(acta.depLabel);
    return dep;
  }

  return (
    <div className="content-panel">
      <div className="panel-header">
        <h2 className="page-title">Actas</h2>
      </div>
      <p className="panel-desc">
        Actas de entrega generadas al imprimir desde Entregas. Cada vez que imprimes un acta, queda registrada aquí.
      </p>
      <p className="panel-desc actas-grupos-hint">
        Las actas están agrupadas por <strong>expediente</strong>. Abrí cada carpeta para ver las actas de ese expediente.
      </p>

      <div className="filtros-avanzados">
        <div className="filtros-row">
          <div className="filtro-grupo">
            <label htmlFor="buscar-actas">Buscar</label>
            <div className="search-bar" role="search">
              <span className="search-icon" aria-hidden="true">🔍</span>
              <input
                type="search"
                id="buscar-actas"
                placeholder="Nº de acta, producto, expediente…"
                autoComplete="off"
                value={busqueda}
                onChange={(e) => { setBusqueda(e.target.value); setPagActas(1); }}
              />
              {busqueda && (
                <button
                  type="button"
                  className="search-clear"
                  aria-label="Limpiar búsqueda"
                  onClick={() => { setBusqueda(''); setPagActas(1); }}
                >
                  &times;
                </button>
              )}
            </div>
          </div>
          <div className="filtro-grupo">
            <label htmlFor="filtro-actas-dependencia">Dependencia</label>
            <select
              id="filtro-actas-dependencia"
              value={filtroDep}
              onChange={(e) => { setFiltroDep(e.target.value); setPagActas(1); }}
            >
              <option value="">Todas</option>
              {dependencias.filter((d) => d?.id).map((d) => {
                const label = getDepLabelActa(d.id, dependencias);
                return (
                  <option key={d.id} value={d.id}>
                    {label !== '—' ? label : (d.nombre || d.codigo || d.id)}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="filtro-grupo">
            <label htmlFor="filtro-actas-desde">Desde</label>
            <input
              type="date"
              id="filtro-actas-desde"
              value={filtroDesde}
              onChange={(e) => { setFiltroDesde(e.target.value); setPagActas(1); }}
            />
          </div>
          <div className="filtro-grupo">
            <label htmlFor="filtro-actas-hasta">Hasta</label>
            <input
              type="date"
              id="filtro-actas-hasta"
              value={filtroHasta}
              onChange={(e) => { setFiltroHasta(e.target.value); setPagActas(1); }}
            />
          </div>
          <div className="filtro-grupo filtro-grupo-btn">
            <button type="button" className="btn btn-secondary btn-sm" onClick={limpiarFiltros}>
              Limpiar filtros
            </button>
          </div>
        </div>
      </div>

      <div className="table-wrap actas-grupos-wrap">
        {actasFiltradas.length > 0 ? (
          <>
            <div className="actas-grupos">
              {pageGrupos.items.map((g) => {
                const n = g.actas.length;
                const suf = n === 1 ? 'acta' : 'actas';
                return (
                  <details key={g.expediente} className="actas-carpeta">
                    <summary className="actas-carpeta-summary">
                      <span className="actas-carpeta-icon" aria-hidden="true">📁</span>
                      <span className="actas-carpeta-titulo">{g.expediente}</span>
                      <span className="actas-carpeta-badge">{n} {suf}</span>
                    </summary>
                    <div className="actas-carpeta-body">
                      <table className="data-table actas-carpeta-tabla">
                        <thead>
                          <tr>
                            <th>Nº ID</th>
                            <th>Fecha</th>
                            <th>Dependencia</th>
                            <th>Producto</th>
                            <th className="num-col">Cant.</th>
                            <th>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.actas.map((a) => {
                            const id = (a.id || '').toString().trim() || '—';
                            const prod = (a.productLabel || '').toString().trim() || '—';
                            const modPor = (a.modificadoPor || a.modificado_por || '').toString().trim();
                            const tieneAdjunto = !!(a.adjunto && a.adjunto.name);
                            const actaId = a.id || '';
                            return (
                              <tr key={actaId || id}>
                                <td>{id}</td>
                                <td>{formatFechaActa(a.fecha)}</td>
                                <td>{getDepDisplay(a)}</td>
                                <td>
                                  {prod}
                                  {isAdmin && modPor && (
                                    <div className="acta-modificada-note">
                                      Acta modificada por {modPor}
                                    </div>
                                  )}
                                  {tieneAdjunto && (
                                    <div className="acta-adjunto-note">
                                      Adjunto: {a.adjunto.name}
                                    </div>
                                  )}
                                </td>
                                <td className="num-col">{a.cantidad != null ? String(a.cantidad) : '1'}</td>
                                <td className="td-acciones-exp">
                                  <ActaMenu
                                    actaId={actaId}
                                    tieneAdjunto={tieneAdjunto}
                                    open={openMenuActaId === actaId}
                                    onToggle={(e) => {
                                      e.stopPropagation();
                                      setOpenMenuActaId(openMenuActaId === actaId ? null : actaId);
                                    }}
                                    onVer={() => abrirVer(a)}
                                    onVerAdjunto={() => handleVerAdjunto(actaId)}
                                    onAdjuntar={() => handleAdjuntar(actaId)}
                                    onEditar={() => abrirEditar(a)}
                                    onEliminar={() => handleEliminar(actaId)}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </details>
                );
              })}
            </div>
            <PaginationBar info={pageGrupos} onPageChange={setPagActas} />
          </>
        ) : (
          <p className="empty-state">
            No hay actas registradas. Las actas se guardan automáticamente al imprimir desde una entrega.
          </p>
        )}
      </div>

      <ModalShell
        open={!!actaEnVista}
        onClose={() => setActaEnVista(null)}
        title="Acta de entrega"
        wide
        actions={(
          <div className="modal-actions">
            <button type="button" className="btn btn-primary" onClick={imprimirActaDesdeModal}>
              Imprimir
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setActaEnVista(null)}>
              Cerrar
            </button>
          </div>
        )}
      >
        <div className="modal-body">
          <div
            ref={verActaRef}
            className="acta-entrega-print-area"
            dangerouslySetInnerHTML={{ __html: actaHtmlVista }}
          />
        </div>
      </ModalShell>

      <ModalShell
        open={!!actaEnEdicion}
        onClose={() => setActaEnEdicion(null)}
        title="Modificar acta"
        wide
        actions={null}
      >
        <form onSubmit={handleGuardarEdicion}>
          <div className="form-group">
            <label htmlFor="editar-acta-fecha">Fecha</label>
            <input
              type="datetime-local"
              id="editar-acta-fecha"
              required
              value={editForm.fecha}
              onChange={(e) => setEditForm((f) => ({ ...f, fecha: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label htmlFor="editar-acta-dependencia">Dependencia</label>
            <select
              id="editar-acta-dependencia"
              value={editForm.dependenciaId}
              onChange={(e) => setEditForm((f) => ({ ...f, dependenciaId: e.target.value }))}
            >
              <option value="">— Seleccionar dependencia —</option>
              {dependencias.filter((d) => d?.id).map((d) => {
                const label = getDepLabelActa(d.id, dependencias);
                return (
                  <option key={d.id} value={d.id}>
                    {label !== '—' ? label : (d.nombre || d.codigo || d.id)}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="editar-acta-producto">Producto</label>
            <input
              type="text"
              id="editar-acta-producto"
              required
              placeholder="Ej: L80 / 123 — PARLANTE (1)"
              value={editForm.producto}
              onChange={(e) => setEditForm((f) => ({ ...f, producto: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label htmlFor="editar-acta-expediente">Expediente</label>
            <input
              type="text"
              id="editar-acta-expediente"
              placeholder="Ej: 3794/208-ADM-2025"
              value={editForm.expediente}
              onChange={(e) => setEditForm((f) => ({ ...f, expediente: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label htmlFor="editar-acta-cantidad">Cantidad</label>
            <input
              type="number"
              id="editar-acta-cantidad"
              min="1"
              required
              value={editForm.cantidad}
              onChange={(e) => setEditForm((f) => ({ ...f, cantidad: e.target.value }))}
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setActaEnEdicion(null)}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={submittingEdit}>
              {submittingEdit ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </ModalShell>
    </div>
  );
}
