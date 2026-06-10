import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLoading } from '../contexts/LoadingContext';
import { useToast } from '../contexts/ToastContext';
import PaginationBar from '../components/PaginationBar';
import { getStockAPI } from '../hooks/useStockAPI';
import {
  DEP_CARD_COLORS,
  agruparEntradas,
  filterEntradas,
  formatMovFecha,
  fromLocalDatetimeValue,
  getEntradasConSalidas,
  toLocalDatetimeValue
} from '../utils/depositoHelpers';
import { DEFAULT_PAGE_SIZE, paginar } from '../utils/pagination';

function ModalShell({ open, onClose, title, wide, children }) {
  if (!open) return null;
  return createPortal(
    <div
      className="modal open modal-tema-clara"
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`modal-content${wide ? ' modal-content-wide' : ''}`}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button type="button" className="modal-close" aria-label="Cerrar" onClick={onClose}>&times;</button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

const emptyAgregar = () => ({
  expediente: 'DEPOSITO',
  nombre: '',
  marca: '',
  cantidad: '1',
  serie: '',
  fecha: toLocalDatetimeValue(new Date().toISOString()),
  concepto: ''
});

export default function DepositoPage() {
  const { isAdmin } = useAuth();
  const { show, hide } = useLoading();
  const { showToast } = useToast();

  const [movimientos, setMovimientos] = useState([]);
  const [backendLabel, setBackendLabel] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [filtroGrupoKey, setFiltroGrupoKey] = useState(null);
  const [pagina, setPagina] = useState(1);
  const [openMenuId, setOpenMenuId] = useState(null);

  const [modalAgregarOpen, setModalAgregarOpen] = useState(false);
  const [formAgregar, setFormAgregar] = useState(emptyAgregar);

  const [modalEditarOpen, setModalEditarOpen] = useState(false);
  const [formEditar, setFormEditar] = useState({
    id: '', expediente: 'DEPOSITO', nombre: '', marca: '', serie: '', cantidad: '1', fecha: '', concepto: ''
  });

  const { entradas, salidasPorEntrada } = useMemo(
    () => getEntradasConSalidas(movimientos),
    [movimientos]
  );
  const grupos = useMemo(
    () => agruparEntradas(entradas, salidasPorEntrada),
    [entradas, salidasPorEntrada]
  );
  const filtradas = useMemo(
    () => filterEntradas(entradas, { filtroGrupoKey, busqueda }),
    [entradas, filtroGrupoKey, busqueda]
  );
  const pageInfo = useMemo(
    () => paginar(filtradas, pagina, DEFAULT_PAGE_SIZE),
    [filtradas, pagina]
  );

  const loadData = useCallback(async () => {
    const api = getStockAPI();
    if (!api?.getDepositoData) {
      setMovimientos([]);
      return;
    }
    show('Cargando depósito…');
    try {
      const raw = await api.getDepositoData();
      setMovimientos(Array.isArray(raw?.movimientos) ? raw.movimientos : []);
    } catch {
      showToast('Error al cargar depósito', 'error');
      setMovimientos([]);
    } finally {
      hide();
    }
  }, [hide, show, showToast]);

  useEffect(() => {
    loadData();
    const api = getStockAPI();
    if (api?.getDataBackend) {
      api.getDataBackend().then((r) => {
        if (r?.backend === 'supabase') setBackendLabel('Guardando en Supabase');
        else setBackendLabel('Modo local (archivo)');
      }).catch(() => {});
    }
    window._realtimeRefresh = (table) => {
      if (!table || table === 'deposito_movimientos') loadData();
    };
    return () => {
      if (window._realtimeRefresh) window._realtimeRefresh = undefined;
    };
  }, [loadData]);

  useEffect(() => {
    if (!openMenuId) return undefined;
    const close = () => setOpenMenuId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openMenuId]);

  function toggleGrupo(key) {
    setFiltroGrupoKey((cur) => (cur === key ? null : key));
    setPagina(1);
  }

  function openAgregar() {
    setFormAgregar(emptyAgregar());
    setModalAgregarOpen(true);
  }

  function openEditar(movId) {
    if (!isAdmin) {
      showToast('Solo admin puede editar.', 'error');
      return;
    }
    const m = movimientos.find((x) => x.id === movId);
    if (!m) return;
    setFormEditar({
      id: m.id,
      expediente: m.expediente || 'DEPOSITO',
      nombre: m.nombre || '',
      marca: m.marca || '',
      serie: m.numeroSerie || '',
      cantidad: String(parseInt(m.cantidad, 10) || 1),
      fecha: toLocalDatetimeValue(m.fecha),
      concepto: m.concepto || ''
    });
    setModalEditarOpen(true);
    setOpenMenuId(null);
  }

  async function handleDelete(movId) {
    if (!isAdmin) {
      showToast('Solo admin puede eliminar.', 'error');
      return;
    }
    if (!confirm('¿Eliminar este producto del depósito?')) return;
    const api = getStockAPI();
    try {
      await api.deleteDepositoMovimiento(movId);
      showToast('Producto eliminado');
      await loadData();
    } catch (err) {
      showToast(err?.message || 'Error al eliminar', 'error');
    }
    setOpenMenuId(null);
  }

  async function handleAgregarSubmit(e) {
    e.preventDefault();
    const nombre = formAgregar.nombre.trim();
    const marca = formAgregar.marca.trim();
    const cantidad = parseInt(formAgregar.cantidad, 10) || 1;
    const serieBase = formAgregar.serie.trim();
    const expediente = (formAgregar.expediente || 'DEPOSITO').trim() || 'DEPOSITO';
    const fecha = fromLocalDatetimeValue(formAgregar.fecha);
    const concepto = formAgregar.concepto.trim();

    if (!nombre) {
      showToast('Indicá el tipo de elemento', 'error');
      return;
    }

    const api = getStockAPI();
    show('Guardando…');
    try {
      const baseId = Date.now();
      for (let i = 0; i < cantidad; i++) {
        const serie = cantidad === 1 && serieBase ? serieBase : (serieBase ? `${serieBase}-${i + 1}` : String(i + 1));
        const result = await api.registrarDepositoMovimiento({
          id: `${baseId}-${i}-dep`,
          tipo: 'entrada',
          expediente,
          cantidad: 1,
          fecha,
          numeroSerie: serie,
          nombre,
          marca: marca || null,
          concepto: concepto || null
        });
        if (!result?.ok) throw new Error(result?.error || 'Error al guardar');
      }
      showToast(cantidad > 1 ? `Se agregaron ${cantidad} productos` : 'Producto agregado al depósito');
      setModalAgregarOpen(false);
      await loadData();
    } catch (err) {
      showToast(err?.message || 'Error al guardar', 'error');
    } finally {
      hide();
    }
  }

  async function handleEditarSubmit(e) {
    e.preventDefault();
    if (!isAdmin) {
      showToast('Solo admin puede editar.', 'error');
      return;
    }
    const api = getStockAPI();
    try {
      const result = await api.updateDepositoMovimiento(formEditar.id, {
        expediente: (formEditar.expediente || 'DEPOSITO').trim() || 'DEPOSITO',
        nombre: formEditar.nombre.trim(),
        marca: formEditar.marca.trim(),
        numeroSerie: formEditar.serie.trim(),
        cantidad: formEditar.cantidad,
        fecha: fromLocalDatetimeValue(formEditar.fecha),
        concepto: formEditar.concepto.trim()
      });
      if (!result?.ok) throw new Error(result?.error || 'Error al guardar');
      showToast('Producto actualizado');
      setModalEditarOpen(false);
      await loadData();
    } catch (err) {
      showToast(err?.message || 'Error al guardar', 'error');
    }
  }

  async function handleExport() {
    const api = getStockAPI();
    if (!api?.exportDepositoInventario) return;
    const r = await api.exportDepositoInventario();
    if (r?.ok) showToast('Exportado correctamente');
    else if (r && !r.cancelled) showToast(r?.error || 'Error al exportar', 'error');
  }

  return (
    <div className="content-panel">
      {backendLabel && (
        <span
          className={`backend-badge ${backendLabel.includes('Supabase') ? 'backend-supabase' : 'backend-local'}`}
          title="Dónde se guardan los datos"
          style={{ marginBottom: '0.5rem', display: 'inline-block' }}
        >
          {backendLabel}
        </span>
      )}

      <div className="panel-header">
        <div>
          <h2 className="page-title" style={{ margin: 0 }}>DEPÓSITO</h2>
          <p className="panel-desc" style={{ margin: '0.35rem 0 0' }}>
            Inventario físico del depósito (independiente del inventario general).
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primary" onClick={openAgregar}>+ Agregar producto</button>
          <button type="button" className="btn btn-secondary" title="Exportar listado a Excel" onClick={handleExport}>
            📥 Exportar a Excel
          </button>
        </div>
      </div>

      <section className="deposito-resumen-section" aria-label="Resumen por tipo de elemento">
        <div className="deposito-resumen-header">
          <h3 className="deposito-resumen-title">Resumen por tipo</h3>
          {filtroGrupoKey && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setFiltroGrupoKey(null); setPagina(1); }}>
              Ver todos
            </button>
          )}
        </div>
        <div className="deposito-tarjetas-grid dashboard-metrics">
          {!grupos.length && (
            <p className="empty-state" style={{ gridColumn: '1 / -1', margin: 0 }}>No hay productos en el depósito.</p>
          )}
          {grupos.map((g, idx) => {
            const colorCls = DEP_CARD_COLORS[idx % DEP_CARD_COLORS.length];
            const active = filtroGrupoKey === g.key ? ' deposito-tarjeta--active' : '';
            const hint = `${g.disponible} disponible${g.disponible === 1 ? '' : 's'}${g.agotados > 0 ? ` · ${g.agotados} agotado${g.agotados === 1 ? '' : 's'}` : ''}`;
            return (
              <div
                key={g.key}
                className={`metric-card deposito-tarjeta mf-metric ${colorCls} metric-card-clickable${active}`}
                role="button"
                tabIndex={0}
                title="Ver unidades en la tabla"
                onClick={() => toggleGrupo(g.key)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleGrupo(g.key);
                  }
                }}
              >
                <span className="metric-icon metric-icon-svg" aria-hidden="true">
                  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 12h20v14H6z" />
                    <path d="M10 12V8h12v4" />
                    <path d="M6 18h20" />
                  </svg>
                </span>
                <div className="metric-content">
                  <p className="metric-label">{g.nombre}</p>
                  {g.marca && <span className="deposito-tarjeta-sub">{g.marca}</span>}
                  <p className="metric-value">{g.total}</p>
                  <p className="metric-hint">{hint}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <h3 className="deposito-detalle-title">Detalle por unidad</h3>
      <div className="form-group deposito-buscar-wrap">
        <div className="search-bar" role="search">
          <span className="search-icon" aria-hidden="true">🔍</span>
          <input
            type="search"
            placeholder="Buscar por serie, nombre, marca…"
            autoComplete="off"
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }}
          />
          {busqueda && (
            <button type="button" className="search-clear" aria-label="Limpiar búsqueda" onClick={() => setBusqueda('')}>&times;</button>
          )}
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Expediente</th>
              <th>Tipo de elemento</th>
              <th>Marca</th>
              <th>Nº de serie</th>
              <th className="num-col">Cantidad</th>
              <th className="num-col">Disponible</th>
              <th>Fecha</th>
              <th>Concepto</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {!entradas.length && (
              <tr>
                <td colSpan={9} className="empty-state">
                  <p>No hay productos en el depósito. Usá «+ Agregar producto».</p>
                </td>
              </tr>
            )}
            {entradas.length > 0 && !filtradas.length && (
              <tr>
                <td colSpan={9} className="empty-state">
                  <p>{filtroGrupoKey ? 'No hay unidades de este tipo con ese criterio.' : 'Ningún producto coincide con la búsqueda.'}</p>
                </td>
              </tr>
            )}
            {pageInfo.items.map((m) => {
              const cantidad = parseInt(m.cantidad, 10) || 0;
              const entregado = salidasPorEntrada[m.id] || 0;
              const disponible = Math.max(0, cantidad - entregado);
              const dispLabel = disponible === 0 ? 'AGOTADO' : String(disponible);
              const claseDisp = disponible === 0 ? 'stock-cell stock-cell-cero' : 'stock-cell';
              return (
                <tr key={m.id}>
                  <td>{(m.expediente || 'DEPOSITO').trim() || 'DEPOSITO'}</td>
                  <td>{m.nombre || '—'}</td>
                  <td>{m.marca || '—'}</td>
                  <td>{m.numeroSerie || '—'}</td>
                  <td className="stock-cell num-col">{cantidad}</td>
                  <td className={`${claseDisp} num-col`}>{dispLabel}</td>
                  <td>{formatMovFecha(m.fecha)}</td>
                  <td>{m.concepto || '—'}</td>
                  <td className="td-acciones-inv">
                    {isAdmin ? (
                      <div className="inv-acciones-wrap">
                        <button
                          type="button"
                          className="btn btn-icon btn-menu-inv"
                          aria-label="Acciones"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId((cur) => (cur === m.id ? null : m.id));
                          }}
                        >
                          &#8942;
                        </button>
                        <div className={`inv-menu-dropdown${openMenuId === m.id ? ' open' : ''}`}>
                          <button type="button" className="inv-menu-editar" onClick={() => openEditar(m.id)}>Editar</button>
                          <button type="button" className="inv-menu-eliminar" onClick={() => handleDelete(m.id)}>Eliminar</button>
                        </div>
                      </div>
                    ) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <PaginationBar info={pageInfo} onPageChange={setPagina} />
      </div>

      <ModalShell open={modalAgregarOpen} onClose={() => setModalAgregarOpen(false)} title="Agregar producto al depósito" wide>
        <form onSubmit={handleAgregarSubmit}>
          <div className="form-group">
            <label htmlFor="deposito-expediente">Expediente</label>
            <input
              id="deposito-expediente"
              type="text"
              value={formAgregar.expediente}
              onChange={(e) => setFormAgregar((f) => ({ ...f, expediente: e.target.value }))}
              placeholder="Ej: DEPOSITO"
            />
          </div>
          <div className="form-row form-row-3">
            <div className="form-group">
              <label htmlFor="deposito-nombre">Nombre / Tipo de elemento</label>
              <input
                id="deposito-nombre"
                type="text"
                required
                placeholder="Ej: MONITOR"
                value={formAgregar.nombre}
                onChange={(e) => setFormAgregar((f) => ({ ...f, nombre: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label htmlFor="deposito-marca">Marca</label>
              <input
                id="deposito-marca"
                type="text"
                placeholder="Marca"
                value={formAgregar.marca}
                onChange={(e) => setFormAgregar((f) => ({ ...f, marca: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label htmlFor="deposito-cantidad">Cantidad</label>
              <input
                id="deposito-cantidad"
                type="number"
                min={1}
                required
                value={formAgregar.cantidad}
                onChange={(e) => setFormAgregar((f) => ({ ...f, cantidad: e.target.value }))}
              />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="deposito-serie">Nº de serie <span className="text-muted">(opcional)</span></label>
            <input
              id="deposito-serie"
              type="text"
              placeholder="Opcional"
              value={formAgregar.serie}
              onChange={(e) => setFormAgregar((f) => ({ ...f, serie: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label htmlFor="deposito-fecha">Fecha</label>
            <input
              id="deposito-fecha"
              type="datetime-local"
              value={formAgregar.fecha}
              onChange={(e) => setFormAgregar((f) => ({ ...f, fecha: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label htmlFor="deposito-concepto">Concepto</label>
            <input
              id="deposito-concepto"
              type="text"
              placeholder="Ej: Ingreso a depósito"
              value={formAgregar.concepto}
              onChange={(e) => setFormAgregar((f) => ({ ...f, concepto: e.target.value }))}
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setModalAgregarOpen(false)}>Cancelar</button>
            <button type="submit" className="btn btn-primary">Guardar</button>
          </div>
        </form>
      </ModalShell>

      <ModalShell open={modalEditarOpen} onClose={() => setModalEditarOpen(false)} title="Editar producto en depósito">
        <form onSubmit={handleEditarSubmit}>
          <input type="hidden" value={formEditar.id} readOnly />
          <div className="form-group">
            <label htmlFor="editar-deposito-expediente">Expediente</label>
            <input
              id="editar-deposito-expediente"
              type="text"
              value={formEditar.expediente}
              onChange={(e) => setFormEditar((f) => ({ ...f, expediente: e.target.value }))}
            />
          </div>
          <div className="form-row form-row-2">
            <div className="form-group">
              <label htmlFor="editar-deposito-nombre">Tipo de elemento</label>
              <input
                id="editar-deposito-nombre"
                type="text"
                required
                value={formEditar.nombre}
                onChange={(e) => setFormEditar((f) => ({ ...f, nombre: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label htmlFor="editar-deposito-marca">Marca</label>
              <input
                id="editar-deposito-marca"
                type="text"
                value={formEditar.marca}
                onChange={(e) => setFormEditar((f) => ({ ...f, marca: e.target.value }))}
              />
            </div>
          </div>
          <div className="form-row form-row-2">
            <div className="form-group">
              <label htmlFor="editar-deposito-serie">Nº de serie</label>
              <input
                id="editar-deposito-serie"
                type="text"
                value={formEditar.serie}
                onChange={(e) => setFormEditar((f) => ({ ...f, serie: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label htmlFor="editar-deposito-cantidad">Cantidad</label>
              <input
                id="editar-deposito-cantidad"
                type="number"
                min={1}
                required
                value={formEditar.cantidad}
                onChange={(e) => setFormEditar((f) => ({ ...f, cantidad: e.target.value }))}
              />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="editar-deposito-fecha">Fecha</label>
            <input
              id="editar-deposito-fecha"
              type="datetime-local"
              value={formEditar.fecha}
              onChange={(e) => setFormEditar((f) => ({ ...f, fecha: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label htmlFor="editar-deposito-concepto">Concepto</label>
            <input
              id="editar-deposito-concepto"
              type="text"
              value={formEditar.concepto}
              onChange={(e) => setFormEditar((f) => ({ ...f, concepto: e.target.value }))}
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setModalEditarOpen(false)}>Cancelar</button>
            <button type="submit" className="btn btn-primary">Guardar cambios</button>
          </div>
        </form>
      </ModalShell>
    </div>
  );
}
