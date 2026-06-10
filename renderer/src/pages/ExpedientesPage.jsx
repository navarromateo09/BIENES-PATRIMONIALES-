import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLoading } from '../contexts/LoadingContext';
import { useToast } from '../contexts/ToastContext';
import PaginationBar from '../components/PaginationBar';
import { getStockAPI } from '../hooks/useStockAPI';
import { DEFAULT_PAGE_SIZE, paginar } from '../utils/pagination';
import { toLocalDatetimeValue, fromLocalDatetimeValue } from '../utils/depositoHelpers';
import {
  buildEntregasRows,
  buildProvistosGuardiaPorMov,
  enrichDetalleMovimiento,
  filterDetalleEntradas,
  filterExpedientes,
  getAnioDisplay,
  getExpedienteEstado,
  movimientoTieneProvisiones,
  normalizeSerie,
  sortExpedientes,
  validateSerieInList
} from '../utils/expedientesHelpers';

function ModalShell({ open, onClose, title, wide, confirmStyle, children, actions }) {
  if (!open) return null;
  return createPortal(
    <div
      className={`modal open modal-tema-clara${confirmStyle ? ' modal-confirmar-estilo' : ''}`}
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`modal-content${wide ? ' modal-content-wide' : ''}${confirmStyle ? ' modal-confirmar-content' : ''}`}>
        {confirmStyle ? (
          <>
            <button type="button" className="modal-close modal-confirmar-close-top" aria-label="Cerrar" onClick={onClose}>&times;</button>
            {children}
            {actions}
          </>
        ) : (
          <>
            <div className="modal-header">
              <h3>{title}</h3>
              <button type="button" className="modal-close" aria-label="Cerrar" onClick={onClose}>&times;</button>
            </div>
            {children}
            {actions}
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

const emptyExpForm = () => ({ numero: '', anio: '', solicitadoPor: '' });
const emptyAddProd = () => ({
  numeroSerie: '', nombre: '', marca: '', cantidad: '1', fecha: toLocalDatetimeValue(new Date().toISOString()), concepto: ''
});

export default function ExpedientesPage() {
  const { isAdmin } = useAuth();
  const { show, hide } = useLoading();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [productos, setProductos] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [guardiaProvisiones, setGuardiaProvisiones] = useState([]);
  const [dependencias, setDependencias] = useState([]);

  const [view, setView] = useState('lista');
  const [selectedExpId, setSelectedExpId] = useState(null);

  const [busquedaLista, setBusquedaLista] = useState('');
  const [ordenLista, setOrdenLista] = useState('numero-asc');
  const [pagLista, setPagLista] = useState(1);
  const [openMenuExpId, setOpenMenuExpId] = useState(null);

  const [busquedaDetalle, setBusquedaDetalle] = useState('');
  const [pagDetalle, setPagDetalle] = useState(1);
  const [openMenuMovId, setOpenMenuMovId] = useState(null);

  const [modalExpOpen, setModalExpOpen] = useState(false);
  const [editingExpId, setEditingExpId] = useState(null);
  const [formExp, setFormExp] = useState(emptyExpForm());
  const [submittingExp, setSubmittingExp] = useState(false);

  const [modalAddProdOpen, setModalAddProdOpen] = useState(false);
  const [formAddProd, setFormAddProd] = useState(emptyAddProd());
  const [submittingAdd, setSubmittingAdd] = useState(false);
  const [addSeries, setAddSeries] = useState({ active: false, list: [], idx: 0, cantidad: 0, base: null, error: '' });

  const [modalEditMovOpen, setModalEditMovOpen] = useState(false);
  const [formEditMov, setFormEditMov] = useState({
    id: '', numeroSerie: '', nombre: '', marca: '', cantidad: '1', fecha: '', concepto: ''
  });
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [editSeries, setEditSeries] = useState({
    active: false, list: [], idx: 0, cantidad: 0, base: null, replaceId: null, error: ''
  });

  const [modalEliminarExp, setModalEliminarExp] = useState(null);
  const [eliminarCascade, setEliminarCascade] = useState(false);
  const [modalEliminarMovId, setModalEliminarMovId] = useState(null);
  const [modalEntregasMovId, setModalEntregasMovId] = useState(null);

  const provistosPorMov = useMemo(() => buildProvistosGuardiaPorMov(guardiaProvisiones), [guardiaProvisiones]);

  const selectedExp = useMemo(
    () => productos.find((p) => p.id === selectedExpId) || null,
    [productos, selectedExpId]
  );

  const expedientesFiltrados = useMemo(() => {
    const filtrados = filterExpedientes(productos, { busqueda: busquedaLista, movimientos, provistosPorMov });
    return sortExpedientes(filtrados, ordenLista);
  }, [productos, busquedaLista, ordenLista, movimientos, provistosPorMov]);

  const pageLista = useMemo(
    () => paginar(expedientesFiltrados, pagLista, DEFAULT_PAGE_SIZE),
    [expedientesFiltrados, pagLista]
  );

  const detalleEntradas = useMemo(() => {
    if (!selectedExpId) return [];
    const entradas = movimientos.filter((m) => m.tipo === 'entrada' && m.productoId === selectedExpId);
    const filtradas = filterDetalleEntradas(entradas, busquedaDetalle);
    return filtradas.slice().sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
  }, [movimientos, selectedExpId, busquedaDetalle]);

  const pageDetalle = useMemo(
    () => paginar(detalleEntradas, pagDetalle, DEFAULT_PAGE_SIZE),
    [detalleEntradas, pagDetalle]
  );

  const entregasRows = useMemo(() => {
    if (!modalEntregasMovId) return [];
    return buildEntregasRows(modalEntregasMovId, { guardiaProvisiones, movimientos, dependencias });
  }, [modalEntregasMovId, guardiaProvisiones, movimientos, dependencias]);

  const loadData = useCallback(async () => {
    const api = getStockAPI();
    if (!api?.getData) return;
    show('Cargando expedientes…');
    try {
      const raw = await api.getData();
      setProductos(Array.isArray(raw?.productos) ? raw.productos : []);
      setMovimientos(Array.isArray(raw?.movimientos) ? raw.movimientos : []);
      setGuardiaProvisiones(Array.isArray(raw?.guardiaProvisiones) ? raw.guardiaProvisiones : []);
      if (api.getDependencias) {
        const deps = await api.getDependencias();
        setDependencias(Array.isArray(deps) ? deps : []);
      }
    } catch {
      showToast('Error al cargar expedientes', 'error');
    } finally {
      hide();
    }
  }, [hide, show, showToast]);

  useEffect(() => {
    loadData();
    window._realtimeRefresh = () => { loadData(); };
    return () => {
      if (window._realtimeRefresh) window._realtimeRefresh = undefined;
    };
  }, [loadData]);

  useEffect(() => {
    const closeMenus = () => { setOpenMenuExpId(null); setOpenMenuMovId(null); };
    document.addEventListener('click', closeMenus);
    return () => document.removeEventListener('click', closeMenus);
  }, []);

  useEffect(() => {
    const openExp = searchParams.get('openExp');
    const openMov = searchParams.get('openMov');
    if (!openExp || !productos.length) return;
    const exp = productos.find((p) => p.id === openExp);
    if (!exp) return;
    setSelectedExpId(openExp);
    setView('detalle');
    if (openMov && movimientos.length) {
      const mov = movimientos.find((m) => m.id === openMov);
      if (mov && isAdmin) openEditarMov(mov);
    }
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productos, movimientos, searchParams]);

  async function guardarSeriesComoUnidades(movBase, list, replaceMovimientoId) {
    const api = getStockAPI();
    if (!api?.registrarMovimiento) return;
    const faltan = (list || []).filter((x) => normalizeSerie(x) === '').length;
    if (faltan > 0) {
      showToast(`Faltan ${faltan} número(s) de serie`, 'error');
      return;
    }
    const seen = {};
    for (let i = 0; i < list.length; i++) {
      const n = normalizeSerie(list[i]).toLowerCase();
      if (seen[n]) {
        showToast('Hay números de serie repetidos', 'error');
        return;
      }
      seen[n] = true;
    }
    show(`Guardando ${list.length} unidades…`);
    try {
      const baseId = Date.now().toString();
      for (let k = 0; k < list.length; k++) {
        const mov = {
          ...movBase,
          id: `${baseId}-${k}`,
          cantidad: '1',
          numeroSerie: normalizeSerie(list[k])
        };
        // eslint-disable-next-line no-await-in-loop
        const r = await api.registrarMovimiento(mov);
        if (r?.ok === false) {
          showToast(r.error || 'Error al guardar', 'error');
          return;
        }
      }
      if (replaceMovimientoId) {
        try { await api.deleteMovimiento(replaceMovimientoId); } catch { /* ignore */ }
      }
      showToast('Unidades agregadas con sus series');
      setBusquedaDetalle('');
      await loadData();
    } catch {
      showToast('Error al guardar', 'error');
    } finally {
      hide();
    }
  }

  function openDetalle(expId) {
    setSelectedExpId(expId);
    setView('detalle');
    setPagDetalle(1);
    setBusquedaDetalle('');
  }

  function openModalExpediente(exp) {
    if (exp) {
      setEditingExpId(exp.id);
      setFormExp({
        numero: (exp.codigo || '').toString().trim(),
        anio: (exp.anio || '').toString().trim(),
        solicitadoPor: (exp.solicitadoPor || '').toString().trim()
      });
    } else {
      setEditingExpId(null);
      setFormExp(emptyExpForm());
    }
    setModalExpOpen(true);
  }

  async function guardarExpediente(e) {
    e.preventDefault();
    const numero = formExp.numero.trim();
    if (!numero) {
      showToast('Escribe el número de expediente', 'error');
      return;
    }
    const existe = productos.some((p) => {
      if (editingExpId && p.id === editingExpId) return false;
      return (p.codigo || '').toString().trim().toLowerCase() === numero.toLowerCase();
    });
    if (existe) {
      showToast('Ese expediente ya existe', 'error');
      return;
    }
    const api = getStockAPI();
    setSubmittingExp(true);
    try {
      const payload = {
        codigo: numero,
        nombre: numero,
        descripcion: '',
        stockActual: 0,
        unidad: 'unidades',
        solicitadoPor: formExp.solicitadoPor.trim() || undefined,
        anio: formExp.anio.trim() || undefined
      };
      if (editingExpId) payload.id = editingExpId;
      await api.saveProducto(payload);
      showToast(editingExpId ? 'Expediente actualizado' : 'Expediente agregado');
      setModalExpOpen(false);
      await loadData();
    } catch (err) {
      showToast(err?.message || 'Error al guardar', 'error');
    } finally {
      setSubmittingExp(false);
    }
  }

  function openAgregarProducto() {
    if (!selectedExpId) {
      showToast('Primero selecciona un expediente', 'error');
      return;
    }
    setFormAddProd(emptyAddProd());
    setAddSeries({ active: false, list: [], idx: 0, cantidad: 0, base: null, error: '' });
    setModalAddProdOpen(true);
  }

  function startAddSeriesMode() {
    const cantidad = parseInt(formAddProd.cantidad, 10) || 0;
    if (cantidad <= 1) {
      showToast('La cantidad debe ser mayor a 1 para cargar series por unidad', 'error');
      return;
    }
    const base = {
      tipo: 'entrada',
      productoId: selectedExpId,
      cantidad: String(cantidad),
      concepto: formAddProd.concepto.trim() || undefined,
      numeroSerie: formAddProd.numeroSerie.trim() || undefined,
      nombre: formAddProd.nombre.trim() || undefined,
      marca: formAddProd.marca.trim() || undefined,
      fecha: formAddProd.fecha ? fromLocalDatetimeValue(formAddProd.fecha) : undefined
    };
    const list = new Array(cantidad).fill('');
    if (formAddProd.numeroSerie.trim()) list[0] = normalizeSerie(formAddProd.numeroSerie);
    setAddSeries({ active: true, list, idx: 0, cantidad, base, error: '' });
    setFormAddProd((f) => ({ ...f, numeroSerie: list[0] || '' }));
  }

  async function submitAgregarProducto(e) {
    e.preventDefault();
    if (!selectedExpId) return;
    const nombre = formAddProd.nombre.trim();
    const cantidad = parseInt(formAddProd.cantidad, 10) || 0;
    if (!nombre) {
      showToast('El nombre es obligatorio', 'error');
      return;
    }
    if (!cantidad || cantidad <= 0) {
      showToast('Cantidad inválida', 'error');
      return;
    }
    if (cantidad > 1) {
      if (addSeries.active) {
        showToast('Terminá de cargar las series con el botón ✓', 'error');
        return;
      }
      startAddSeriesMode();
      return;
    }
    const api = getStockAPI();
    setSubmittingAdd(true);
    try {
      const movimiento = {
        tipo: 'entrada',
        productoId: selectedExpId,
        cantidad: String(cantidad),
        concepto: formAddProd.concepto.trim() || undefined,
        numeroSerie: formAddProd.numeroSerie.trim() || undefined,
        nombre: nombre || undefined,
        marca: formAddProd.marca.trim() || undefined,
        fecha: formAddProd.fecha ? fromLocalDatetimeValue(formAddProd.fecha) : undefined
      };
      const result = await api.registrarMovimiento(movimiento);
      if (result?.ok === false) {
        showToast(result.error || 'Error al guardar', 'error');
        return;
      }
      showToast('Producto agregado al expediente');
      setModalAddProdOpen(false);
      await loadData();
    } catch {
      showToast('Error al guardar', 'error');
    } finally {
      setSubmittingAdd(false);
    }
  }

  async function avanzarSerieAgregar() {
    if (!addSeries.active) return;
    const err = validateSerieInList(addSeries.list, addSeries.idx, formAddProd.numeroSerie);
    if (err) {
      setAddSeries((s) => ({ ...s, error: err }));
      return;
    }
    const list = [...addSeries.list];
    list[addSeries.idx] = normalizeSerie(formAddProd.numeroSerie);
    if (addSeries.idx < addSeries.cantidad - 1) {
      const nextIdx = addSeries.idx + 1;
      setAddSeries((s) => ({ ...s, list, idx: nextIdx, error: '' }));
      setFormAddProd((f) => ({ ...f, numeroSerie: list[nextIdx] || '' }));
      return;
    }
    await guardarSeriesComoUnidades(addSeries.base, list, null);
    setModalAddProdOpen(false);
    setAddSeries({ active: false, list: [], idx: 0, cantidad: 0, base: null, error: '' });
  }

  function openEditarMov(mov) {
    if (!isAdmin) {
      showToast('Solo admin puede editar productos del expediente.', 'error');
      return;
    }
    setFormEditMov({
      id: mov.id,
      numeroSerie: mov.numeroSerie || '',
      nombre: mov.nombre || '',
      marca: mov.marca || '',
      cantidad: String(mov.cantidad || '1'),
      fecha: mov.fecha ? toLocalDatetimeValue(mov.fecha) : '',
      concepto: mov.concepto || ''
    });
    setEditSeries({ active: false, list: [], idx: 0, cantidad: 0, base: null, replaceId: null, error: '' });
    setModalEditMovOpen(true);
    setOpenMenuMovId(null);
  }

  function startEditSeriesMode() {
    const mov = movimientos.find((m) => m.id === formEditMov.id);
    if (!mov) return;
    const cantidad = parseInt(formEditMov.cantidad, 10) || 0;
    if (cantidad <= 1) {
      showToast('La cantidad debe ser mayor a 1 para cargar series por unidad', 'error');
      return;
    }
    if (movimientoTieneProvisiones(mov.id, guardiaProvisiones)) {
      showToast('No se puede dividir: ya tiene entregas registradas', 'error');
      return;
    }
    const base = {
      tipo: 'entrada',
      productoId: mov.productoId,
      cantidad: String(cantidad),
      concepto: formEditMov.concepto.trim() || undefined,
      numeroSerie: formEditMov.numeroSerie.trim() || undefined,
      nombre: formEditMov.nombre.trim() || undefined,
      marca: formEditMov.marca.trim() || undefined,
      fecha: formEditMov.fecha ? fromLocalDatetimeValue(formEditMov.fecha) : (mov.fecha || undefined)
    };
    const list = new Array(cantidad).fill('');
    if (formEditMov.numeroSerie.trim()) list[0] = normalizeSerie(formEditMov.numeroSerie);
    setEditSeries({
      active: true, list, idx: 0, cantidad, base, replaceId: mov.id, error: ''
    });
    setFormEditMov((f) => ({ ...f, numeroSerie: list[0] || '' }));
  }

  async function submitEditarMov(e) {
    e.preventDefault();
    if (!isAdmin) return;
    if (editSeries.active) {
      showToast('Terminá de cargar las series con el botón ✓ antes de guardar', 'error');
      return;
    }
    const api = getStockAPI();
    setSubmittingEdit(true);
    try {
      await api.updateMovimiento(formEditMov.id, {
        numeroSerie: formEditMov.numeroSerie.trim() || undefined,
        nombre: formEditMov.nombre.trim() || undefined,
        marca: formEditMov.marca.trim() || undefined,
        cantidad: formEditMov.cantidad,
        concepto: formEditMov.concepto.trim() || undefined,
        fecha: formEditMov.fecha ? fromLocalDatetimeValue(formEditMov.fecha) : undefined
      });
      showToast('Producto actualizado');
      setModalEditMovOpen(false);
      await loadData();
    } catch {
      showToast('Error al guardar', 'error');
    } finally {
      setSubmittingEdit(false);
    }
  }

  async function avanzarSerieEditar() {
    if (!editSeries.active) return;
    const err = validateSerieInList(editSeries.list, editSeries.idx, formEditMov.numeroSerie);
    if (err) {
      setEditSeries((s) => ({ ...s, error: err }));
      return;
    }
    const list = [...editSeries.list];
    list[editSeries.idx] = normalizeSerie(formEditMov.numeroSerie);
    if (editSeries.idx < editSeries.cantidad - 1) {
      const nextIdx = editSeries.idx + 1;
      setEditSeries((s) => ({ ...s, list, idx: nextIdx, error: '' }));
      setFormEditMov((f) => ({ ...f, numeroSerie: list[nextIdx] || '' }));
      return;
    }
    await guardarSeriesComoUnidades(editSeries.base, list, editSeries.replaceId);
    setModalEditMovOpen(false);
    setEditSeries({ active: false, list: [], idx: 0, cantidad: 0, base: null, replaceId: null, error: '' });
  }

  async function confirmarEliminarExp() {
    if (!modalEliminarExp || !isAdmin) return;
    const id = modalEliminarExp.id;
    const doCascade = eliminarCascade && modalEliminarExp.tieneMovs;
    const api = getStockAPI();
    show(doCascade ? 'Eliminando en cascada…' : 'Eliminando expediente…');
    try {
      if (doCascade && api.deleteExpedienteCascade) {
        await api.deleteExpedienteCascade(id);
      } else {
        await api.deleteProducto(id);
      }
      showToast(doCascade ? 'Expediente eliminado (con movimientos)' : 'Expediente eliminado');
      setModalEliminarExp(null);
      setEliminarCascade(false);
      if (selectedExpId === id) {
        setSelectedExpId(null);
        setView('lista');
      }
      await loadData();
    } catch (err) {
      showToast(err?.message || 'Error al eliminar', 'error');
    } finally {
      hide();
    }
  }

  async function confirmarEliminarMov() {
    if (!modalEliminarMovId || !isAdmin) return;
    const id = modalEliminarMovId;
    setModalEliminarMovId(null);
    const api = getStockAPI();
    show('Eliminando producto…');
    try {
      await api.deleteMovimiento(id);
      showToast('Producto eliminado');
      await loadData();
    } catch (err) {
      showToast(err?.message || 'Error al eliminar', 'error');
    } finally {
      hide();
    }
  }

  async function exportarDetalle() {
    if (!selectedExpId) {
      showToast('Selecciona un expediente primero', 'error');
      return;
    }
    const api = getStockAPI();
    if (!api?.exportExpedienteDetalle) {
      showToast('Exportación no disponible', 'error');
      return;
    }
    show('Exportando detalle del expediente…');
    try {
      const r = await api.exportExpedienteDetalle(selectedExpId, busquedaDetalle);
      if (r?.ok && r.path) showToast(`Detalle exportado en: ${r.path}`);
      else if (!r?.cancelled) showToast(r?.error || 'Error al exportar', 'error');
    } catch (err) {
      showToast(`Error al exportar: ${err?.message || 'Error'}`, 'error');
    } finally {
      hide();
    }
  }

  const codigoDetalle = selectedExp ? ((selectedExp.codigo || '').toString().trim() || '—') : '—';
  const solicitadoDetalle = selectedExp && (selectedExp.solicitadoPor || '').toString().trim()
    ? selectedExp.solicitadoPor
    : '';

  return (
    <div className="content-panel">
      {view === 'lista' && (
        <section className="panel active">
          <div className="panel-header">
            <h2 className="page-title">Expedientes</h2>
            <button type="button" className="btn btn-primary" onClick={() => openModalExpediente(null)}>
              + Agregar expediente
            </button>
          </div>
          <p className="panel-desc">Agrega expedientes por número y consúltalos en la lista.</p>

          <div className="form-group" style={{ maxWidth: 520, marginBottom: '1rem' }}>
            <div className="search-bar" role="search">
              <span className="search-icon" aria-hidden="true">🔍</span>
              <input
                type="search"
                placeholder="Buscar expedientes…"
                value={busquedaLista}
                onChange={(e) => { setBusquedaLista(e.target.value); setPagLista(1); }}
                autoComplete="off"
              />
              {busquedaLista && (
                <button type="button" className="search-clear" aria-label="Limpiar" onClick={() => { setBusquedaLista(''); setPagLista(1); }}>&times;</button>
              )}
            </div>
          </div>
          <div className="form-group" style={{ maxWidth: 280, marginBottom: '1rem' }}>
            <label htmlFor="ordenar-expedientes">Ordenar por</label>
            <select
              id="ordenar-expedientes"
              value={ordenLista}
              onChange={(e) => { setOrdenLista(e.target.value); setPagLista(1); }}
            >
              <option value="numero-asc">Número (A-Z)</option>
              <option value="numero-desc">Número (Z-A)</option>
              <option value="anio-desc">Año (más reciente primero)</option>
              <option value="anio-asc">Año (más antiguo primero)</option>
            </select>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Año</th>
                  <th>Solicitado por</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {!pageLista.items.length && (
                  <tr>
                    <td colSpan={5} className="empty-state">
                      <p>
                        {busquedaLista
                          ? `Ningún expediente coincide con "${busquedaLista}".`
                          : 'No hay expedientes. Usa "Agregar expediente".'}
                      </p>
                    </td>
                  </tr>
                )}
                {pageLista.items.map((p) => {
                  const estado = getExpedienteEstado(p.id, movimientos, provistosPorMov);
                  const codigo = (p.codigo || '').toString().trim() || '-';
                  return (
                    <tr key={p.id}>
                      <td>
                        <button
                          type="button"
                          className="link-expediente numero-expediente-badge"
                          title="Ver productos del expediente"
                          onClick={() => openDetalle(p.id)}
                        >
                          {codigo}
                        </button>
                      </td>
                      <td>{getAnioDisplay(p)}</td>
                      <td>{(p.solicitadoPor || '').toString().trim() || '—'}</td>
                      <td>
                        <span className={`estado-exp-badge ${estado.clase}`}>{estado.texto}</span>
                      </td>
                      <td className="td-acciones-exp">
                        <ExpMenu
                          open={openMenuExpId === p.id}
                          onToggle={(e) => { e.stopPropagation(); setOpenMenuExpId(openMenuExpId === p.id ? null : p.id); }}
                          isAdmin={isAdmin}
                          onEditar={() => { if (isAdmin) openModalExpediente(p); else showToast('Solo admin puede editar expedientes.', 'error'); }}
                          onEliminar={() => {
                            if (!isAdmin) { showToast('Solo admin puede eliminar expedientes.', 'error'); return; }
                            const tieneMovs = movimientos.some((m) => m.productoId === p.id);
                            setModalEliminarExp({ id: p.id, codigo, tieneMovs });
                            setEliminarCascade(false);
                            setOpenMenuExpId(null);
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <PaginationBar info={pageLista} onPageChange={setPagLista} />
          </div>
        </section>
      )}

      {view === 'detalle' && (
        <section className="panel active">
          <div className="panel-header">
            <h2 className="page-title">Expediente {codigoDetalle}</h2>
            <div>
              <button type="button" className="btn btn-secondary" onClick={() => setView('lista')}>← Volver</button>
              <button type="button" className="btn btn-primary" onClick={openAgregarProducto}>+ Agregar producto</button>
              <button type="button" className="btn btn-secondary" title="Exportar productos del expediente a Excel (xlsx)" onClick={exportarDetalle}>
                📥 Exportar a Excel
              </button>
            </div>
          </div>
          <p className="panel-desc">
            Productos cargados dentro del expediente {codigoDetalle}
            {solicitadoDetalle ? `. Solicitado por: ${solicitadoDetalle}` : '.'}
          </p>

          <div className="form-group" style={{ maxWidth: 520, marginBottom: '1rem' }}>
            <div className="search-bar" role="search">
              <span className="search-icon" aria-hidden="true">🔍</span>
              <input
                type="search"
                placeholder="Buscar dentro del expediente…"
                value={busquedaDetalle}
                onChange={(e) => { setBusquedaDetalle(e.target.value); setPagDetalle(1); }}
                autoComplete="off"
              />
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="num-col">Cantidad / Disponible</th>
                  <th>Nombre</th>
                  <th>Marca</th>
                  <th>Descripción</th>
                  <th>Nº de serie</th>
                  <th>Fecha</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {!pageDetalle.items.length && (
                  <tr>
                    <td colSpan={7} className="empty-state">
                      <p>
                        {busquedaDetalle
                          ? `No hay resultados para "${busquedaDetalle}".`
                          : 'No hay productos en este expediente. Usa "Agregar producto".'}
                      </p>
                    </td>
                  </tr>
                )}
                {pageDetalle.items.map((m) => {
                  const row = enrichDetalleMovimiento(m, provistosPorMov);
                  return (
                    <tr key={m.id}>
                      <td className={`num-col ${row.agotado ? 'stock-cell stock-cell-cero' : 'stock-cell'}`}>
                        {row.recibido} / {row.dispLabel}
                      </td>
                      <td>{m.nombre || '-'}</td>
                      <td>{m.marca || '-'}</td>
                      <td>{m.concepto || '-'}</td>
                      <td>{m.numeroSerie || '-'}</td>
                      <td>{row.fecha}</td>
                      <td className="td-acciones-exp">
                        <MovMenu
                          open={openMenuMovId === m.id}
                          onToggle={(e) => { e.stopPropagation(); setOpenMenuMovId(openMenuMovId === m.id ? null : m.id); }}
                          isAdmin={isAdmin}
                          tieneEntregas={row.tieneEntregas}
                          onVerEntregas={() => { setModalEntregasMovId(m.id); setOpenMenuMovId(null); }}
                          onEditar={() => openEditarMov(m)}
                          onEliminar={() => {
                            if (!isAdmin) { showToast('Solo admin puede eliminar productos del expediente.', 'error'); return; }
                            setModalEliminarMovId(m.id);
                            setOpenMenuMovId(null);
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <PaginationBar info={pageDetalle} onPageChange={setPagDetalle} />
          </div>
        </section>
      )}

      {/* Modal expediente */}
      <ModalShell
        open={modalExpOpen}
        onClose={() => setModalExpOpen(false)}
        title={editingExpId ? 'Editar expediente' : 'Agregar expediente'}
        actions={(
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setModalExpOpen(false)}>Cancelar</button>
            <button type="submit" form="form-expediente" className="btn btn-primary" disabled={submittingExp}>
              {submittingExp ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        )}
      >
        <form id="form-expediente" onSubmit={guardarExpediente}>
          <div className="form-group">
            <label htmlFor="expediente-numero">Número de expediente</label>
            <input
              id="expediente-numero"
              type="text"
              required
              placeholder="Ej: 208/2020"
              value={formExp.numero}
              onChange={(e) => setFormExp((f) => ({ ...f, numero: e.target.value }))}
              autoComplete="off"
            />
          </div>
          <div className="form-group">
            <label htmlFor="expediente-anio">Año del expediente <span className="text-muted">(opcional)</span></label>
            <input
              id="expediente-anio"
              type="text"
              placeholder="Ej: 2024"
              maxLength={4}
              inputMode="numeric"
              value={formExp.anio}
              onChange={(e) => setFormExp((f) => ({ ...f, anio: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label htmlFor="expediente-solicitado-por">Solicitado por <span className="text-muted">(opcional)</span></label>
            <input
              id="expediente-solicitado-por"
              type="text"
              placeholder="Ej: Nombre del solicitante"
              value={formExp.solicitadoPor}
              onChange={(e) => setFormExp((f) => ({ ...f, solicitadoPor: e.target.value }))}
            />
          </div>
        </form>
      </ModalShell>

      {/* Modal agregar producto */}
      <ModalShell
        open={modalAddProdOpen}
        onClose={() => setModalAddProdOpen(false)}
        wide
        title="Agregar producto al expediente"
        actions={(
          <div className="modal-actions">
            {parseInt(formAddProd.cantidad, 10) > 1 && !addSeries.active && (
              <button type="button" className="btn btn-secondary" onClick={startAddSeriesMode}>
                Cargar series por unidad
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={() => setModalAddProdOpen(false)}>Cancelar</button>
            <button type="submit" form="form-producto-expediente" className="btn btn-primary" disabled={submittingAdd}>
              {submittingAdd ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        )}
      >
        <form id="form-producto-expediente" onSubmit={submitAgregarProducto}>
          <div className="form-row form-row-3">
            <div className="form-group">
              <label htmlFor="producto-exp-numero-serie">
                Nº de serie
                {addSeries.active && (
                  <span className="text-muted" style={{ marginLeft: '0.4rem' }}>
                    (Serie {addSeries.idx + 1} de {addSeries.cantidad})
                  </span>
                )}
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  id="producto-exp-numero-serie"
                  type="text"
                  style={{ flex: 1 }}
                  placeholder="Ej: SN-12345"
                  value={formAddProd.numeroSerie}
                  onChange={(e) => setFormAddProd((f) => ({ ...f, numeroSerie: e.target.value }))}
                  onKeyDown={(e) => {
                    if (addSeries.active && e.key === 'Enter') { e.preventDefault(); avanzarSerieAgregar(); }
                  }}
                />
                {addSeries.active && (
                  <>
                    <button type="button" className="btn btn-primary" style={{ padding: '0.45rem 0.65rem', lineHeight: 1 }} onClick={avanzarSerieAgregar}>✓</button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '0.45rem 0.6rem' }}
                      onClick={() => {
                        const list = Array.from({ length: addSeries.cantidad }, (_, i) => String(i + 1));
                        setAddSeries((s) => ({ ...s, list, error: '' }));
                        setFormAddProd((f) => ({ ...f, numeroSerie: list[addSeries.idx] || '' }));
                      }}
                    >
                      Auto
                    </button>
                  </>
                )}
              </div>
              {addSeries.error && <div className="text-muted" style={{ marginTop: '0.35rem' }}>{addSeries.error}</div>}
            </div>
            <div className="form-group">
              <label htmlFor="producto-exp-nombre">Nombre</label>
              <input
                id="producto-exp-nombre"
                type="text"
                required
                placeholder="Ej: Cartuchos, Teclado, Monitor"
                value={formAddProd.nombre}
                onChange={(e) => setFormAddProd((f) => ({ ...f, nombre: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label htmlFor="producto-exp-marca">Marca</label>
              <input
                id="producto-exp-marca"
                type="text"
                placeholder="Ej: HP, Samsung"
                value={formAddProd.marca}
                onChange={(e) => setFormAddProd((f) => ({ ...f, marca: e.target.value }))}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="producto-exp-cantidad">Cantidad</label>
              <input
                id="producto-exp-cantidad"
                type="number"
                min={1}
                required
                value={formAddProd.cantidad}
                onChange={(e) => {
                  setFormAddProd((f) => ({ ...f, cantidad: e.target.value }));
                  if (addSeries.active) setAddSeries({ active: false, list: [], idx: 0, cantidad: 0, base: null, error: '' });
                }}
              />
            </div>
            <div className="form-group">
              <label htmlFor="producto-exp-fecha">Fecha</label>
              <input
                id="producto-exp-fecha"
                type="datetime-local"
                value={formAddProd.fecha}
                onChange={(e) => setFormAddProd((f) => ({ ...f, fecha: e.target.value }))}
              />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="producto-exp-concepto">Descripción</label>
            <input
              id="producto-exp-concepto"
              type="text"
              placeholder="Ej: Recepción por compra"
              value={formAddProd.concepto}
              onChange={(e) => setFormAddProd((f) => ({ ...f, concepto: e.target.value }))}
            />
          </div>
        </form>
      </ModalShell>

      {/* Modal editar movimiento */}
      <ModalShell
        open={modalEditMovOpen}
        onClose={() => setModalEditMovOpen(false)}
        wide
        title="Editar producto"
        actions={(
          <div className="modal-actions">
            {parseInt(formEditMov.cantidad, 10) > 1
              && !editSeries.active
              && !movimientoTieneProvisiones(formEditMov.id, guardiaProvisiones) && (
              <button type="button" className="btn btn-secondary" onClick={startEditSeriesMode}>
                Cargar series por unidad
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={() => setModalEditMovOpen(false)}>Cancelar</button>
            <button type="submit" form="form-editar-mov-exp" className="btn btn-primary" disabled={submittingEdit}>
              {submittingEdit ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        )}
      >
        <form id="form-editar-mov-exp" onSubmit={submitEditarMov}>
          <div className="form-row form-row-3">
            <div className="form-group">
              <label htmlFor="edit-mov-exp-numero-serie">
                Nº de serie
                {editSeries.active && (
                  <span className="text-muted" style={{ marginLeft: '0.4rem' }}>
                    (Serie {editSeries.idx + 1} de {editSeries.cantidad})
                  </span>
                )}
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  id="edit-mov-exp-numero-serie"
                  type="text"
                  style={{ flex: 1 }}
                  value={formEditMov.numeroSerie}
                  onChange={(e) => setFormEditMov((f) => ({ ...f, numeroSerie: e.target.value }))}
                  onKeyDown={(e) => {
                    if (editSeries.active && e.key === 'Enter') { e.preventDefault(); avanzarSerieEditar(); }
                  }}
                />
                {editSeries.active && (
                  <>
                    <button type="button" className="btn btn-primary" style={{ padding: '0.45rem 0.65rem', lineHeight: 1 }} onClick={avanzarSerieEditar}>✓</button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '0.45rem 0.6rem' }}
                      onClick={() => {
                        const list = Array.from({ length: editSeries.cantidad }, (_, i) => String(i + 1));
                        setEditSeries((s) => ({ ...s, list, error: '' }));
                        setFormEditMov((f) => ({ ...f, numeroSerie: list[editSeries.idx] || '' }));
                      }}
                    >
                      Auto
                    </button>
                  </>
                )}
              </div>
              {editSeries.error && <div className="text-muted" style={{ marginTop: '0.35rem' }}>{editSeries.error}</div>}
            </div>
            <div className="form-group">
              <label htmlFor="edit-mov-exp-nombre">Nombre</label>
              <input
                id="edit-mov-exp-nombre"
                type="text"
                value={formEditMov.nombre}
                onChange={(e) => setFormEditMov((f) => ({ ...f, nombre: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label htmlFor="edit-mov-exp-marca">Marca</label>
              <input
                id="edit-mov-exp-marca"
                type="text"
                value={formEditMov.marca}
                onChange={(e) => setFormEditMov((f) => ({ ...f, marca: e.target.value }))}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="edit-mov-exp-cantidad">Cantidad</label>
              <input
                id="edit-mov-exp-cantidad"
                type="number"
                min={1}
                required
                value={formEditMov.cantidad}
                onChange={(e) => {
                  setFormEditMov((f) => ({ ...f, cantidad: e.target.value }));
                  if (editSeries.active) setEditSeries({ active: false, list: [], idx: 0, cantidad: 0, base: null, replaceId: null, error: '' });
                }}
              />
            </div>
            <div className="form-group">
              <label htmlFor="edit-mov-exp-fecha">Fecha</label>
              <input
                id="edit-mov-exp-fecha"
                type="datetime-local"
                value={formEditMov.fecha}
                onChange={(e) => setFormEditMov((f) => ({ ...f, fecha: e.target.value }))}
              />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="edit-mov-exp-descripcion">Descripción</label>
            <input
              id="edit-mov-exp-descripcion"
              type="text"
              value={formEditMov.concepto}
              onChange={(e) => setFormEditMov((f) => ({ ...f, concepto: e.target.value }))}
            />
          </div>
        </form>
      </ModalShell>

      {/* Eliminar expediente */}
      <ModalShell
        open={!!modalEliminarExp}
        onClose={() => { setModalEliminarExp(null); setEliminarCascade(false); }}
        title="Eliminar expediente"
        actions={(
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setModalEliminarExp(null)}>Cancelar</button>
            <button type="button" className="btn btn-danger" onClick={confirmarEliminarExp}>Eliminar</button>
          </div>
        )}
      >
        <div className="modal-body">
          <p className="panel-desc" style={{ margin: '0 0 0.75rem' }}>
            ¿Seguro que querés eliminar el expediente <strong>{modalEliminarExp?.codigo}</strong>?
            {modalEliminarExp?.tieneMovs && (
              <>
                <br />
                <span className="text-muted">Este expediente tiene movimientos registrados.</span>
              </>
            )}
          </p>
          {modalEliminarExp?.tieneMovs && isAdmin && (
            <label style={{ display: 'flex', gap: '0.55rem', alignItems: 'flex-start', cursor: 'pointer', marginTop: '0.75rem' }}>
              <input
                type="checkbox"
                checked={eliminarCascade}
                onChange={(e) => setEliminarCascade(e.target.checked)}
                style={{ marginTop: '0.25rem' }}
              />
              <span>
                <strong>Eliminar también sus movimientos asociados</strong>
                <span className="text-muted"> (solo admin)</span>
                <br />
                <span className="text-muted">Acción irreversible.</span>
              </span>
            </label>
          )}
        </div>
      </ModalShell>

      {/* Eliminar movimiento */}
      <ModalShell
        open={!!modalEliminarMovId}
        onClose={() => setModalEliminarMovId(null)}
        confirmStyle
        actions={(
          <div className="modal-actions modal-confirmar-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setModalEliminarMovId(null)}>Cancelar</button>
            <button type="button" className="btn btn-danger" onClick={confirmarEliminarMov}>Eliminar</button>
          </div>
        )}
      >
        <div className="modal-confirmar-icono" aria-hidden="true">!</div>
        <h3 className="modal-confirmar-titulo">Confirmar eliminación</h3>
        <div className="modal-body modal-confirmar-body">
          <p className="modal-confirmar-pregunta" style={{ marginTop: 0 }}>
            ¿Seguro que quiere eliminar este producto del expediente?
          </p>
        </div>
      </ModalShell>

      {/* Info entregas */}
      <ModalShell
        open={!!modalEntregasMovId}
        onClose={() => setModalEntregasMovId(null)}
        wide
        title="Información de entrega"
        actions={(
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setModalEntregasMovId(null)}>Cerrar</button>
          </div>
        )}
      >
        <div className="modal-body-table">
          <p className="panel-desc" style={{ marginTop: 0 }}>
            Entregas registradas para este producto ({entregasRows.length}).
          </p>
          {!entregasRows.length ? (
            <p className="empty-state">No hay entregas registradas para este ítem.</p>
          ) : (
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
                  {entregasRows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.fecha}</td>
                      <td>{r.dep}</td>
                      <td className="num-col">{r.cantidad}</td>
                      <td>{r.concepto}</td>
                      <td>{r.usuario}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </ModalShell>
    </div>
  );
}

function ExpMenu({ open, onToggle, isAdmin, onEditar, onEliminar }) {
  return (
    <div className="exp-acciones-wrap">
      <button type="button" className="btn btn-icon btn-menu-exp" aria-label="Acciones" onClick={onToggle}>&#8942;</button>
      <div className={`exp-menu-dropdown${open ? ' exp-menu-open' : ''}`}>
        {isAdmin && <button type="button" className="exp-list-editar" onClick={onEditar}>Editar</button>}
        {isAdmin && <button type="button" className="exp-list-eliminar" onClick={onEliminar}>Eliminar</button>}
      </div>
    </div>
  );
}

function MovMenu({ open, onToggle, isAdmin, tieneEntregas, onVerEntregas, onEditar, onEliminar }) {
  return (
    <div className="exp-acciones-wrap">
      <button type="button" className="btn btn-icon btn-menu-exp" aria-label="Acciones" onClick={onToggle}>&#8942;</button>
      <div className={`exp-menu-dropdown${open ? ' exp-menu-open' : ''}`}>
        {tieneEntregas && (
          <button type="button" className="exp-menu-entregas" onClick={onVerEntregas}>Ver entrega(s)</button>
        )}
        {isAdmin && <button type="button" className="exp-menu-editar" onClick={onEditar}>Editar</button>}
        {isAdmin && <button type="button" className="exp-menu-eliminar" onClick={onEliminar}>Eliminar</button>}
      </div>
    </div>
  );
}
