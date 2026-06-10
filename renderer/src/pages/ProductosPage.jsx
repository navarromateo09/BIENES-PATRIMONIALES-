import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLoading } from '../contexts/LoadingContext';
import { useToast } from '../contexts/ToastContext';
import ModalAgregarProducto from '../components/productos/ModalAgregarProducto';
import PaginationBar from '../components/PaginationBar';
import { getStockAPI } from '../hooks/useStockAPI';
import { paginar, DEFAULT_PAGE_SIZE } from '../utils/pagination';
import {
  buildEntregasInfo,
  buildHistorialRows,
  buildProvistosGuardiaPorMov,
  buildSalidasPorEntrada,
  computeDisponible,
  filterEntradasInventario,
  filterHistorialRows,
  formatMovFecha,
  fromLocalDatetimeValue,
  generarCodigoSerieUnico,
  getCodigoExpediente,
  normalizarCodigoSerie,
  sortEntradasInventario,
  toLocalDatetimeValue
} from '../utils/productosHelpers';

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

export default function ProductosPage() {
  const { isAdmin } = useAuth();
  const { show, hide } = useLoading();
  const { showToast } = useToast();
  const location = useLocation();

  const [tab, setTab] = useState('productos');
  const [data, setData] = useState({
    productos: [], movimientos: [], guardiaProvisiones: [], dependencias: []
  });
  const [backendLabel, setBackendLabel] = useState('');

  const [busquedaInv, setBusquedaInv] = useState('');
  const [pagInv, setPagInv] = useState(1);
  const [openMenuId, setOpenMenuId] = useState(null);

  const [filtrosHist, setFiltrosHist] = useState({
    buscar: '', tipo: '', desde: '', hasta: '', usuario: ''
  });
  const [pagHist, setPagHist] = useState(1);

  const [modalAgregarOpen, setModalAgregarOpen] = useState(false);
  const [submittingAgregar, setSubmittingAgregar] = useState(false);
  const [modalEditarOpen, setModalEditarOpen] = useState(false);
  const [formEditar, setFormEditar] = useState({
    id: '', serie: '', nombre: '', marca: '', cantidad: '1', fecha: '', concepto: ''
  });
  const [modalEntregasOpen, setModalEntregasOpen] = useState(false);
  const [entregasInfo, setEntregasInfo] = useState(null);

  const salidasPorEntrada = useMemo(() => buildSalidasPorEntrada(data.movimientos), [data.movimientos]);
  const provistosPorMov = useMemo(() => buildProvistosGuardiaPorMov(data.guardiaProvisiones), [data.guardiaProvisiones]);

  const entradas = useMemo(
    () => sortEntradasInventario(
      (data.movimientos || []).filter((m) => m?.tipo === 'entrada'),
      data.productos
    ),
    [data.movimientos, data.productos]
  );

  const entradasFiltradas = useMemo(
    () => filterEntradasInventario(entradas, data.productos, busquedaInv),
    [entradas, data.productos, busquedaInv]
  );

  const pageInv = useMemo(
    () => paginar(entradasFiltradas, pagInv, DEFAULT_PAGE_SIZE),
    [entradasFiltradas, pagInv]
  );

  const historialRows = useMemo(() => buildHistorialRows(data), [data]);
  const historialFiltrado = useMemo(
    () => filterHistorialRows(historialRows, filtrosHist),
    [historialRows, filtrosHist]
  );
  const pageHist = useMemo(
    () => paginar(historialFiltrado, pagHist, DEFAULT_PAGE_SIZE),
    [historialFiltrado, pagHist]
  );

  const loadData = useCallback(async () => {
    const api = getStockAPI();
    if (!api) return;
    show('Cargando inventario…');
    try {
      let raw;
      if (api.getProductosData) {
        raw = await api.getProductosData();
      } else if (api.getData) {
        raw = await api.getData();
      } else {
        raw = {};
      }
      let dependencias = Array.isArray(raw?.dependencias) ? raw.dependencias : [];
      if (!dependencias.length && api.getDependencias) {
        try {
          dependencias = await api.getDependencias();
          if (!Array.isArray(dependencias)) dependencias = [];
        } catch { /* ignore */ }
      }
      setData({
        productos: Array.isArray(raw?.productos) ? raw.productos : [],
        movimientos: Array.isArray(raw?.movimientos) ? raw.movimientos : [],
        guardiaProvisiones: Array.isArray(raw?.guardiaProvisiones) ? raw.guardiaProvisiones : [],
        dependencias
      });
    } catch (e) {
      showToast(`Error al cargar datos: ${e?.message || 'Error'}`, 'error');
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
    if (location.hash === '#historial') setTab('historial');
    window._realtimeRefresh = () => { loadData(); };
    return () => {
      if (window._realtimeRefresh) window._realtimeRefresh = undefined;
    };
  }, [loadData, location.hash]);

  useEffect(() => {
    if (!openMenuId) return undefined;
    const close = () => setOpenMenuId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openMenuId]);

  async function handleAgregarProducto(payload) {
    const {
      expedienteId, nuevoExpediente, nombre, marca, cantidad, series,
      descripcion, fecha, imprimirEtiquetas
    } = payload;

    if (!nombre) {
      showToast('El nombre es obligatorio', 'error');
      return;
    }
    if (!expedienteId && !nuevoExpediente) {
      showToast('Indica el número o nombre del nuevo expediente', 'error');
      return;
    }

    const api = getStockAPI();
    setSubmittingAgregar(true);
    show('Guardando…');
    try {
      let productoId = expedienteId;
      if (!productoId) {
        productoId = await api.saveProducto({
          codigo: nuevoExpediente,
          nombre: nuevoExpediente,
          marca: marca || undefined,
          descripcion: descripcion || undefined,
          stockActual: 0,
          unidad: 'unidades'
        });
      }

      const baseId = Date.now().toString();
      const fechaIso = fecha ? fromLocalDatetimeValue(fecha) : undefined;
      const etiquetas = [];
      const codigosSesion = new Set();
      const existing = new Set(
        (data.movimientos || []).map((m) => String(m?.numeroSerie || '').trim().toUpperCase()).filter(Boolean)
      );

      for (let i = 0; i < cantidad; i++) {
        let numeroSerie = (series[i] !== undefined && series[i] !== '') ? series[i] : generarCodigoSerieUnico(existing);
        numeroSerie = normalizarCodigoSerie(numeroSerie);
        if (!numeroSerie) numeroSerie = normalizarCodigoSerie(generarCodigoSerieUnico(existing));
        let reintentos = 0;
        while (codigosSesion.has(numeroSerie) && reintentos < 30) {
          numeroSerie = normalizarCodigoSerie(generarCodigoSerieUnico(existing));
          reintentos++;
        }
        codigosSesion.add(numeroSerie);
        existing.add(numeroSerie);

        const result = await api.registrarMovimiento({
          id: `${baseId}-${i}`,
          tipo: 'entrada',
          productoId,
          cantidad: '1',
          nombre,
          marca: marca || undefined,
          numeroSerie,
          concepto: descripcion || undefined,
          fecha: fechaIso
        });
        if (result?.ok === false) {
          showToast(result.error || 'Error al registrar entrada', 'error');
          return;
        }
        etiquetas.push({
          numeroSerie,
          nombre,
          marca: marca || '',
          expediente: (expedienteId || nuevoExpediente || '').trim()
        });
      }

      if (imprimirEtiquetas && etiquetas.length && api.printEtiquetas) {
        try {
          const printResult = await api.printEtiquetas(etiquetas);
          if (printResult?.ok === false) {
            showToast(printResult.error || 'Producto guardado, pero no se imprimieron las etiquetas', 'error');
          }
        } catch {
          showToast('Producto guardado, pero falló la impresión de etiquetas', 'error');
        }
      }

      showToast('Producto guardado en inventario');
      setModalAgregarOpen(false);
      await loadData();
    } catch (err) {
      showToast(err?.message || 'Error al guardar', 'error');
    } finally {
      setSubmittingAgregar(false);
      hide();
    }
  }

  function openEditar(movId) {
    if (!isAdmin) {
      showToast('Solo admin puede editar.', 'error');
      return;
    }
    const mov = data.movimientos.find((m) => m.id === movId);
    if (!mov) return;
    setFormEditar({
      id: mov.id,
      serie: mov.numeroSerie || '',
      nombre: mov.nombre || '',
      marca: mov.marca || '',
      cantidad: String(mov.cantidad || '1'),
      fecha: mov.fecha ? toLocalDatetimeValue(mov.fecha) : '',
      concepto: mov.concepto || ''
    });
    setModalEditarOpen(true);
    setOpenMenuId(null);
  }

  async function handleEditarSubmit(e) {
    e.preventDefault();
    if (!isAdmin) return;
    const api = getStockAPI();
    try {
      const result = await api.updateMovimiento(formEditar.id, {
        numeroSerie: formEditar.serie.trim() || undefined,
        nombre: formEditar.nombre.trim() || undefined,
        marca: formEditar.marca.trim() || undefined,
        cantidad: formEditar.cantidad,
        concepto: formEditar.concepto.trim() || undefined,
        fecha: formEditar.fecha ? fromLocalDatetimeValue(formEditar.fecha) : undefined
      });
      if (result?.ok) {
        showToast('Producto actualizado');
        setModalEditarOpen(false);
        await loadData();
      } else {
        showToast(result?.error || 'Error', 'error');
      }
    } catch {
      showToast('Error al guardar', 'error');
    }
  }

  async function handleDelete(movId) {
    if (!isAdmin) {
      showToast('Solo admin puede eliminar.', 'error');
      return;
    }
    if (!confirm('¿Seguro que quiere eliminar este producto?')) return;
    const api = getStockAPI();
    try {
      await api.deleteMovimiento(movId);
      showToast('Producto eliminado del inventario');
      await loadData();
    } catch {
      showToast('Error al eliminar', 'error');
    }
    setOpenMenuId(null);
  }

  function openEntregas(movId) {
    setEntregasInfo(buildEntregasInfo(movId, data));
    setModalEntregasOpen(true);
    setOpenMenuId(null);
  }

  async function handleExportInventario() {
    const api = getStockAPI();
    if (!api?.exportInventario) return;
    show('Exportando inventario…');
    try {
      const r = await api.exportInventario();
      if (r?.ok && r.path) showToast(`Inventario exportado en: ${r.path}`);
      else if (!r?.cancelled) showToast(r?.error || 'Error al exportar', 'error');
    } catch (err) {
      showToast(`Error al exportar: ${err?.message || 'Error'}`, 'error');
    } finally {
      hide();
    }
  }

  async function handleExportHistorial() {
    const api = getStockAPI();
    if (!api?.exportMovimientos) return;
    show('Exportando historial…');
    try {
      const r = await api.exportMovimientos();
      if (r?.ok && r.path) showToast(`Historial exportado en: ${r.path}`);
      else if (!r?.cancelled) showToast(r?.error || 'Error al exportar', 'error');
    } catch (err) {
      showToast(`Error al exportar: ${err?.message || 'Error'}`, 'error');
    } finally {
      hide();
    }
  }

  function limpiarFiltrosHistorial() {
    setFiltrosHist({ buscar: '', tipo: '', desde: '', hasta: '', usuario: '' });
    setPagHist(1);
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

      <nav className="tabs">
        <button
          type="button"
          className={`tab${tab === 'productos' ? ' active' : ''}`}
          onClick={() => setTab('productos')}
        >
          Productos
        </button>
        <button
          type="button"
          className={`tab${tab === 'historial' ? ' active' : ''}`}
          onClick={() => setTab('historial')}
        >
          Historial
        </button>
      </nav>

      <div className="content content-in-page">
        {tab === 'productos' && (
          <section className="panel active">
            <div className="panel-header">
              <h2>Inventario</h2>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-primary" onClick={() => setModalAgregarOpen(true)}>
                  + Agregar producto
                </button>
                <button type="button" className="btn btn-secondary" title="Exportar listado a Excel (CSV)" onClick={handleExportInventario}>
                  📥 Exportar a Excel
                </button>
              </div>
            </div>
            <p className="panel-desc">Vista de todos los productos recibidos (entradas).</p>

            <div className="form-group" style={{ maxWidth: 520, marginBottom: '1rem' }}>
              <div className="search-bar" role="search">
                <span className="search-icon" aria-hidden="true">🔍</span>
                <input
                  type="search"
                  placeholder="Buscar en inventario…"
                  autoComplete="off"
                  value={busquedaInv}
                  onChange={(e) => { setBusquedaInv(e.target.value); setPagInv(1); }}
                />
                {busquedaInv && (
                  <button type="button" className="search-clear" aria-label="Limpiar búsqueda" onClick={() => setBusquedaInv('')}>&times;</button>
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
                        <p>No hay productos en el inventario. Agrega productos desde Expedientes o usa &quot;+ Agregar producto&quot;.</p>
                      </td>
                    </tr>
                  )}
                  {entradas.length > 0 && !entradasFiltradas.length && (
                    <tr>
                      <td colSpan={9} className="empty-state">
                        <p>
                          Ningún producto coincide con &quot;{busquedaInv}&quot;. Prueba por nombre, nº de serie o expediente.
                        </p>
                      </td>
                    </tr>
                  )}
                  {pageInv.items.map((m) => {
                    const disponible = computeDisponible(m, salidasPorEntrada, provistosPorMov);
                    const provistoGuardia = provistosPorMov[m.id] || 0;
                    const cantidad = parseInt(m.cantidad, 10) || 0;
                    const dispLabel = disponible === 0 ? 'AGOTADO' : String(disponible);
                    const claseDisp = disponible === 0 ? 'stock-cell stock-cell-cero' : 'stock-cell';
                    return (
                      <tr key={m.id}>
                        <td>{getCodigoExpediente(m, data.productos)}</td>
                        <td>{m.nombre || '—'}</td>
                        <td>{m.marca || '—'}</td>
                        <td>{m.numeroSerie || '—'}</td>
                        <td className="stock-cell num-col">{cantidad}</td>
                        <td className={`${claseDisp} num-col`}>{dispLabel}</td>
                        <td>{formatMovFecha(m.fecha)}</td>
                        <td>{m.concepto || '—'}</td>
                        <td className="td-acciones-inv">
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
                              {provistoGuardia > 0 && (
                                <button type="button" className="inv-menu-entregas" onClick={() => openEntregas(m.id)}>
                                  Ver entrega(s)
                                </button>
                              )}
                              {isAdmin && (
                                <>
                                  <button type="button" className="inv-menu-editar" onClick={() => openEditar(m.id)}>Editar</button>
                                  <button type="button" className="inv-menu-eliminar" onClick={() => handleDelete(m.id)}>Eliminar</button>
                                </>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <PaginationBar info={pageInv} onPageChange={setPagInv} />
            </div>
          </section>
        )}

        {tab === 'historial' && (
          <section className="panel active">
            <div className="panel-header">
              <h2>Historial de movimientos</h2>
              <button type="button" className="btn btn-secondary" title="Exportar historial a Excel (CSV)" onClick={handleExportHistorial}>
                📥 Exportar a Excel
              </button>
            </div>
            <p className="panel-desc">
              Registro de ingresos al inventario, salidas y entregas o provisiones a dependencias o divisiones.
            </p>

            <div className="filtros-avanzados">
              <div className="filtros-row">
                <div className="filtro-grupo">
                  <label htmlFor="filtro-mov-buscar">Buscar</label>
                  <input
                    id="filtro-mov-buscar"
                    type="text"
                    placeholder="Producto, expediente, destino, concepto…"
                    autoComplete="off"
                    value={filtrosHist.buscar}
                    onChange={(e) => { setFiltrosHist((f) => ({ ...f, buscar: e.target.value })); setPagHist(1); }}
                  />
                </div>
                <div className="filtro-grupo">
                  <label htmlFor="filtro-mov-tipo">Tipo</label>
                  <select
                    id="filtro-mov-tipo"
                    value={filtrosHist.tipo}
                    onChange={(e) => { setFiltrosHist((f) => ({ ...f, tipo: e.target.value })); setPagHist(1); }}
                  >
                    <option value="">Todos</option>
                    <option value="entrada">Entrada</option>
                    <option value="salida">Salida</option>
                    <option value="provision">Provisión / Entrega</option>
                  </select>
                </div>
                <div className="filtro-grupo">
                  <label htmlFor="filtro-mov-desde">Desde</label>
                  <input
                    id="filtro-mov-desde"
                    type="date"
                    value={filtrosHist.desde}
                    onChange={(e) => { setFiltrosHist((f) => ({ ...f, desde: e.target.value })); setPagHist(1); }}
                  />
                </div>
                <div className="filtro-grupo">
                  <label htmlFor="filtro-mov-hasta">Hasta</label>
                  <input
                    id="filtro-mov-hasta"
                    type="date"
                    value={filtrosHist.hasta}
                    onChange={(e) => { setFiltrosHist((f) => ({ ...f, hasta: e.target.value })); setPagHist(1); }}
                  />
                </div>
                {isAdmin && (
                  <div className="filtro-grupo">
                    <label htmlFor="filtro-mov-usuario">Usuario</label>
                    <input
                      id="filtro-mov-usuario"
                      type="text"
                      placeholder="Nombre de usuario…"
                      autoComplete="off"
                      value={filtrosHist.usuario}
                      onChange={(e) => { setFiltrosHist((f) => ({ ...f, usuario: e.target.value })); setPagHist(1); }}
                    />
                  </div>
                )}
                <div className="filtro-grupo filtro-grupo-btn">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={limpiarFiltrosHistorial}>
                    Limpiar filtros
                  </button>
                </div>
              </div>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Expediente</th>
                    <th>Producto</th>
                    <th>Destino</th>
                    <th className="num-col">Cantidad</th>
                    {isAdmin && <th className="col-mov-usuario-th">Usuario</th>}
                    <th>Concepto</th>
                  </tr>
                </thead>
                <tbody>
                  {!historialFiltrado.length && (
                    <tr>
                      <td colSpan={isAdmin ? 8 : 7} className="empty-state">
                        <p>No hay movimientos que coincidan con los filtros.</p>
                      </td>
                    </tr>
                  )}
                  {pageHist.items.map((e, idx) => (
                    <tr key={`${e.fecha}-${e.tipo}-${idx}`}>
                      <td>
                        {e.fecha
                          ? new Date(e.fecha).toLocaleString('es-ES', {
                            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                          })
                          : '—'}
                      </td>
                      <td><span className={`badge ${e.tipoClass}`}>{e.tipoLabel}</span></td>
                      <td>{e.expediente}</td>
                      <td>{e.producto}</td>
                      <td>{e.destino}</td>
                      <td className="num-col">{e.cantidad}</td>
                      {isAdmin && <td className="col-mov-usuario-td">{e.usuario || '—'}</td>}
                      <td>{e.concepto}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <PaginationBar info={pageHist} onPageChange={setPagHist} />
            </div>
          </section>
        )}
      </div>

      <ModalAgregarProducto
        open={modalAgregarOpen}
        onClose={() => !submittingAgregar && setModalAgregarOpen(false)}
        productos={data.productos}
        movimientos={data.movimientos}
        onSubmit={handleAgregarProducto}
        submitting={submittingAgregar}
      />

      <ModalShell open={modalEditarOpen} onClose={() => setModalEditarOpen(false)} title="Editar producto" wide>
        <form onSubmit={handleEditarSubmit}>
          <div className="form-row form-row-3">
            <div className="form-group">
              <label htmlFor="edit-mov-numero-serie">Nº de serie</label>
              <input id="edit-mov-numero-serie" type="text" value={formEditar.serie} onChange={(e) => setFormEditar((f) => ({ ...f, serie: e.target.value }))} />
            </div>
            <div className="form-group">
              <label htmlFor="edit-mov-nombre">Nombre</label>
              <input id="edit-mov-nombre" type="text" required value={formEditar.nombre} onChange={(e) => setFormEditar((f) => ({ ...f, nombre: e.target.value }))} />
            </div>
            <div className="form-group">
              <label htmlFor="edit-mov-marca">Marca</label>
              <input id="edit-mov-marca" type="text" value={formEditar.marca} onChange={(e) => setFormEditar((f) => ({ ...f, marca: e.target.value }))} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="edit-mov-cantidad">Cantidad</label>
              <input id="edit-mov-cantidad" type="number" min={1} required value={formEditar.cantidad} onChange={(e) => setFormEditar((f) => ({ ...f, cantidad: e.target.value }))} />
            </div>
            <div className="form-group">
              <label htmlFor="edit-mov-fecha">Fecha</label>
              <input id="edit-mov-fecha" type="datetime-local" value={formEditar.fecha} onChange={(e) => setFormEditar((f) => ({ ...f, fecha: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="edit-mov-descripcion">Descripción / Concepto</label>
            <input id="edit-mov-descripcion" type="text" value={formEditar.concepto} onChange={(e) => setFormEditar((f) => ({ ...f, concepto: e.target.value }))} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setModalEditarOpen(false)}>Cancelar</button>
            <button type="submit" className="btn btn-primary">Guardar</button>
          </div>
        </form>
      </ModalShell>

      <ModalShell open={modalEntregasOpen} onClose={() => setModalEntregasOpen(false)} title="Información de entrega" wide>
        <div className="modal-body-table">
          <p className="panel-desc" style={{ marginTop: 0 }}>
            {entregasInfo ? `Entregas registradas para este producto (${entregasInfo.count}).` : 'Entregas registradas para este producto.'}
          </p>
          {entregasInfo?.count === 0 && (
            <p className="empty-state">No hay entregas registradas para este ítem.</p>
          )}
          {entregasInfo && entregasInfo.items.length > 0 && (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Dependencia</th>
                    <th className="num-col">Cant.</th>
                    <th>Concepto</th>
                    <th>Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {entregasInfo.items.map((row, i) => (
                    <tr key={i}>
                      <td>{row.fecha}</td>
                      <td>{row.dependencia}</td>
                      <td className="num-col">{row.cantidad}</td>
                      <td>{row.concepto}</td>
                      <td>{row.usuario}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setModalEntregasOpen(false)}>Cerrar</button>
        </div>
      </ModalShell>
    </div>
  );
}
