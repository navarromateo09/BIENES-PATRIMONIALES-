import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLoading } from '../contexts/LoadingContext';
import { useToast } from '../contexts/ToastContext';
import { getStockAPI } from '../hooks/useStockAPI';
import {
  ACTA_PRINT_STYLES,
  buildActaHtml,
  buildActaSavePayload,
  buildActasPorExpediente,
  buildGuardiaDepRows,
  buildProductosDisponibles,
  buildProvisionPayload,
  filterProvisionesEnriched,
  getDisplayLabel,
  getDivisiones,
  isTxtItem,
  toLocalDatetimeValue
} from '../utils/guardiaHelpers';
import '../theme/guardia-pro.css';

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

const WIZARD_STEPS = [
  { n: 1, label: 'Dependencia' },
  { n: 2, label: 'Productos' },
  { n: 3, label: 'Confirmar' },
  { n: 4, label: 'Acta e imprimir' }
];

export default function GuardiaPage() {
  const { isAdmin } = useAuth();
  const { show, hide } = useLoading();
  const { showToast } = useToast();

  const [dependencias, setDependencias] = useState([]);
  const [productos, setProductos] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [provisiones, setProvisiones] = useState([]);

  const [busquedaDep, setBusquedaDep] = useState('');
  const [expandedDepIds, setExpandedDepIds] = useState({});
  const [openMenuId, setOpenMenuId] = useState(null);

  const [selectedDependenciaId, setSelectedDependenciaId] = useState(null);
  const [wizardStep, setWizardStep] = useState(1);

  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [carrito, setCarrito] = useState([]);
  const [fechaProvision, setFechaProvision] = useState('');
  const [conceptoProvision, setConceptoProvision] = useState('');

  const [filtroProvBuscar, setFiltroProvBuscar] = useState('');
  const [filtroProvDesde, setFiltroProvDesde] = useState('');
  const [filtroProvHasta, setFiltroProvHasta] = useState('');

  const [pendingProvision, setPendingProvision] = useState(null);
  const [datosActaOpciones, setDatosActaOpciones] = useState(null);
  const [actaDatos, setActaDatos] = useState(null);
  const [actasCola, setActasCola] = useState([]);

  const [modalEliminarDep, setModalEliminarDep] = useState(null);
  const [modalEditarDepId, setModalEditarDepId] = useState(null);
  const [editDepForm, setEditDepForm] = useState({ nombre: '', numero: '', codigo: '' });
  const [editDepChild, setEditDepChild] = useState({ nombre: '', numero: '' });

  const actaContenidoRef = useRef(null);

  const selectedDep = useMemo(
    () => dependencias.find((d) => d.id === selectedDependenciaId) || null,
    [dependencias, selectedDependenciaId]
  );
  const selectedDepLabel = useMemo(
    () => (selectedDep ? getDisplayLabel(selectedDep, dependencias) : ''),
    [selectedDep, dependencias]
  );

  const depRows = useMemo(
    () => buildGuardiaDepRows(dependencias, busquedaDep, expandedDepIds),
    [dependencias, busquedaDep, expandedDepIds]
  );

  const provisionesFiltradas = useMemo(() => {
    if (!selectedDependenciaId) return [];
    return filterProvisionesEnriched({
      provisiones,
      dependenciaId: selectedDependenciaId,
      productos,
      movimientos,
      buscar: filtroProvBuscar,
      desde: filtroProvDesde,
      hasta: filtroProvHasta
    });
  }, [provisiones, selectedDependenciaId, productos, movimientos, filtroProvBuscar, filtroProvDesde, filtroProvHasta]);

  const productosDisponibles = useMemo(
    () => buildProductosDisponibles({ productos, movimientos, provisiones, busqueda: busquedaProducto }),
    [productos, movimientos, provisiones, busquedaProducto]
  );

  const actaHtml = useMemo(
    () => (actaDatos ? buildActaHtml(actaDatos) : ''),
    [actaDatos]
  );

  const editDep = useMemo(
    () => (modalEditarDepId ? dependencias.find((d) => d.id === modalEditarDepId) : null),
    [dependencias, modalEditarDepId]
  );
  const editDepHijos = useMemo(
    () => (editDep ? getDivisiones(dependencias, editDep.id) : []),
    [dependencias, editDep]
  );

  const loadAll = useCallback(async () => {
    const api = getStockAPI();
    if (!api) return;
    show('Cargando entregas…');
    try {
      let deps = api.getDependencias ? await api.getDependencias() : [];
      deps = (deps || []).filter((d) => !isTxtItem(d));
      setDependencias(deps);

      let raw;
      if (api.getGuardiaData) {
        raw = await api.getGuardiaData();
      } else if (api.getData) {
        raw = await api.getData();
      } else {
        raw = {};
      }
      setProductos(raw.productos || []);
      setMovimientos(raw.movimientos || []);
      const provs = raw.guardiaProvisiones
        || (api.getGuardiaProvisiones ? await api.getGuardiaProvisiones() : []);
      setProvisiones(provs || []);
    } catch {
      showToast('Error al cargar datos', 'error');
      setDependencias([]);
      setProductos([]);
      setMovimientos([]);
      setProvisiones([]);
    } finally {
      hide();
    }
  }, [hide, show, showToast]);

  useEffect(() => {
    loadAll();
    window._realtimeRefresh = () => { loadAll(); };
    return () => {
      if (window._realtimeRefresh) window._realtimeRefresh = undefined;
    };
  }, [loadAll]);

  useEffect(() => {
    const closeMenus = () => setOpenMenuId(null);
    document.addEventListener('click', closeMenus);
    return () => document.removeEventListener('click', closeMenus);
  }, []);

  function toggleExpand(depId) {
    setExpandedDepIds((prev) => ({ ...prev, [depId]: !prev[depId] }));
  }

  function resetWizard() {
    setWizardStep(1);
    setSelectedDependenciaId(null);
    setCarrito([]);
    setBusquedaProducto('');
    setFechaProvision('');
    setConceptoProvision('');
    setPendingProvision(null);
    setActaDatos(null);
    setActasCola([]);
    setDatosActaOpciones(null);
  }

  function seleccionarDependencia(depId) {
    setSelectedDependenciaId(depId);
    setCarrito([]);
    setBusquedaProducto('');
    setFechaProvision(toLocalDatetimeValue(new Date().toISOString()));
    setConceptoProvision('');
    setWizardStep(2);
    loadAll();
  }

  function addToCarrito(item) {
    if (item.disponibleMov < 1) {
      showToast('Producto agotado: no hay unidades disponibles.', 'error');
      return;
    }
    if (!item.movimientoId) {
      showToast('No se puede proveer un expediente completo. Seleccioná un ítem dentro del expediente.', 'error');
      return;
    }
    setCarrito((prev) => [...prev, {
      productoId: item.productoId,
      movimientoId: item.movimientoId,
      label: item.label,
      nomProducto: item.nomProducto,
      codProducto: item.codProducto,
      codExp: item.codExp,
      cantidad: 1,
      disponible: item.disponibleMov
    }]);
  }

  function updateCarritoCantidad(idx, val) {
    setCarrito((prev) => prev.map((it, i) => {
      if (i !== idx) return it;
      const max = it.disponible != null ? it.disponible : 999999;
      return { ...it, cantidad: Math.min(Math.max(1, val), max) };
    }));
  }

  function removeCarritoItem(idx) {
    setCarrito((prev) => prev.filter((_, i) => i !== idx));
  }

  function continuarAConfirmacion() {
    if (!carrito.length || !selectedDependenciaId) return;
    const payload = buildProvisionPayload({
      carrito,
      selectedDependenciaId,
      fechaInput: fechaProvision,
      concepto: conceptoProvision,
      productos,
      movimientos,
      dependencias
    });
    setPendingProvision(payload);
    setWizardStep(3);
  }

  async function confirmarProvision() {
    if (!pendingProvision) return;
    const { provisions, depLabel, itemsForActa, fechaStr, fecha, conceptoVal, destinatario } = pendingProvision;
    setPendingProvision(null);
    const api = getStockAPI();
    if (!api?.saveGuardiaProvision) {
      showToast('API no disponible', 'error');
      return;
    }
    show('Guardando provisión…');
    try {
      for (const prov of provisions) {
        // eslint-disable-next-line no-await-in-loop
        await api.saveGuardiaProvision(prov);
      }
      showToast(provisions.length > 1 ? 'Productos provistos' : 'Producto provisto');
      setCarrito([]);
      await loadAll();
      const items = itemsForActa.length ? itemsForActa : [{ productLabel: '—', cantidad: 1, expediente: '—', seriales: [] }];
      const expedientesUnicos = {};
      items.forEach((it) => {
        const exp = (it.expediente || '').toString().trim() || '—';
        expedientesUnicos[exp] = true;
      });
      const datosActa = {
        dependencia_id: selectedDependenciaId,
        depLabel,
        fechaStr,
        fecha,
        concepto: conceptoVal,
        destinatario,
        items
      };
      if (Object.keys(expedientesUnicos).length >= 2) {
        setDatosActaOpciones(datosActa);
      } else {
        setActaDatos(datosActa);
        setWizardStep(4);
      }
    } catch (err) {
      showToast(err?.message || 'Error al guardar', 'error');
    } finally {
      hide();
    }
  }

  async function quitarProvision(id) {
    if (!window.confirm('¿Quitar esta provisión?')) return;
    const api = getStockAPI();
    if (!api?.deleteGuardiaProvision) return;
    show('Quitando provisión…');
    try {
      await api.deleteGuardiaProvision(id);
      showToast('Provisión quitada');
      await loadAll();
    } catch {
      showToast('Error al quitar', 'error');
    } finally {
      hide();
    }
  }

  function openEditarDep(depId) {
    const dep = dependencias.find((d) => d.id === depId);
    if (!dep) return;
    setModalEditarDepId(depId);
    setEditDepForm({
      nombre: (dep.nombre || '').toString(),
      numero: dep.numero != null ? String(dep.numero) : '',
      codigo: dep.codigo != null ? String(dep.codigo) : ''
    });
    setEditDepChild({ nombre: '', numero: '' });
    setOpenMenuId(null);
  }

  async function guardarEditarDep() {
    const dep = dependencias.find((d) => d.id === modalEditarDepId);
    if (!dep) return;
    const nombre = editDepForm.nombre.trim().toUpperCase();
    if (!nombre) {
      showToast('El nombre es obligatorio', 'error');
      return;
    }
    const api = getStockAPI();
    show('Guardando cambios…');
    try {
      await api.saveDependencia({
        id: dep.id,
        nombre,
        codigo: dep.codigo || '',
        parentId: dep.parentId || null,
        numero: editDepForm.numero.trim()
      });
      showToast('Dependencia actualizada');
      await loadAll();
    } catch (err) {
      showToast(err?.message || 'Error al guardar', 'error');
    } finally {
      hide();
    }
  }

  async function agregarDivision() {
    const dep = dependencias.find((d) => d.id === modalEditarDepId);
    if (!dep) return;
    const nombre = editDepChild.nombre.trim().toUpperCase();
    const numero = editDepChild.numero.trim();
    if (!nombre) {
      showToast('Debe ingresar un nombre', 'error');
      return;
    }
    const sufijo = dep.parentId ? 'sd' : 'div';
    const newId = `${dep.id}-${sufijo}-${Date.now()}`;
    const api = getStockAPI();
    show('Agregando…');
    try {
      await api.saveDependencia({
        id: newId,
        nombre,
        codigo: dep.codigo || '',
        parentId: dep.id,
        numero
      });
      showToast(dep.parentId ? 'Sub-división agregada' : 'División agregada');
      setEditDepChild({ nombre: '', numero: '' });
      await loadAll();
    } catch (err) {
      showToast(err?.message || 'Error al agregar', 'error');
    } finally {
      hide();
    }
  }

  async function eliminarDependencia() {
    if (!modalEliminarDep) return;
    const depId = modalEliminarDep.id;
    setModalEliminarDep(null);
    const api = getStockAPI();
    show('Eliminando dependencia…');
    try {
      await api.deleteDependencia(depId);
      showToast('Dependencia eliminada');
      if (selectedDependenciaId === depId) {
        setSelectedDependenciaId(null);
        setWizardStep(1);
      }
      await loadAll();
    } catch (err) {
      showToast(err?.message || 'Error al eliminar dependencia', 'error');
    } finally {
      hide();
    }
  }

  async function imprimirActa() {
    if (!actaDatos) return;
    const api = getStockAPI();
    if (api?.saveActa) {
      show('Registrando acta…');
      try {
        await api.saveActa(buildActaSavePayload(actaDatos));
        showToast('Acta registrada en el apartado Actas');
      } catch {
        showToast('Error al registrar acta', 'error');
      } finally {
        hide();
      }
    }
    const contenido = actaContenidoRef.current?.innerHTML || actaHtml;
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
      setActasCola((cola) => {
        if (cola.length > 0) {
          const [next, ...rest] = cola;
          setActaDatos(next);
          return rest;
        }
        return cola;
      });
    }, 300);
  }

  function wizardAtras() {
    if (wizardStep === 4) setWizardStep(3);
    else if (wizardStep === 3) {
      setPendingProvision(null);
      setWizardStep(2);
    } else if (wizardStep === 2) {
      setSelectedDependenciaId(null);
      setCarrito([]);
      setWizardStep(1);
    }
  }

  const showHistorial = wizardStep === 1 && selectedDependenciaId;

  return (
    <div className="content-panel guardia-content-panel">
      <div className={`guardia-page-header${wizardStep > 1 ? ' guardia-page-header--compact' : ''}`}>
        <h2 className="page-title">Control de entregas</h2>
        {wizardStep === 1 && (
          <p className="panel-desc">
            Seguí los pasos para registrar una entrega: elegí la dependencia destino, los productos, confirmá y generá el acta.
          </p>
        )}
      </div>

      <div className={`guardia-wizard-root${wizardStep > 1 ? ' guardia-wizard-active' : ''}`}>
        <ol className="guardia-stepper" aria-label="Pasos para realizar una entrega">
          {WIZARD_STEPS.map(({ n, label }) => (
            <li
              key={n}
              className={`guardia-stepper-item${wizardStep === n ? ' active' : ''}${wizardStep > n ? ' done' : ''}`}
            >
              <span className="guardia-stepper-num" aria-hidden="true">{n}</span>
              <span className="guardia-stepper-label">{label}</span>
            </li>
          ))}
        </ol>

        {wizardStep >= 2 && (
          <div className="guardia-wizard-toolbar">
            <button type="button" className="btn btn-secondary btn-sm" disabled={wizardStep <= 1} onClick={wizardAtras}>
              ← Paso anterior
            </button>
            {selectedDepLabel && (
              <span className="guardia-wizard-chip">Destino: {selectedDepLabel}</span>
            )}
            <button type="button" className="btn btn-primary btn-sm" onClick={resetWizard}>
              + Nueva entrega
            </button>
          </div>
        )}

        {/* Paso 1 */}
        {wizardStep === 1 && (
          <div className="guardia-wizard-step is-active">
            <div className="guardia-step-card">
              <h3 className="guardia-step-title">Paso 1 · Seleccionar dependencia</h3>
              <p className="guardia-step-desc">
                Buscá por nombre, código o número. Elegí la dependencia principal o una división como destino.
              </p>
              <div className="form-group guardia-search-wrap">
                <div className="search-bar" role="search">
                  <span className="search-icon" aria-hidden="true">🔍</span>
                  <input
                    type="search"
                    placeholder="Buscar dependencias…"
                    value={busquedaDep}
                    onChange={(e) => setBusquedaDep(e.target.value)}
                    autoComplete="off"
                  />
                  {busquedaDep && (
                    <button type="button" className="search-clear" aria-label="Limpiar búsqueda" onClick={() => setBusquedaDep('')}>&times;</button>
                  )}
                </div>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Identificador</th>
                      <th>Nombre</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!dependencias.length && (
                      <tr>
                        <td colSpan={3} className="empty-state">
                          <p>No hay dependencias. Crea dependencias en Gestión de dependencias.</p>
                        </td>
                      </tr>
                    )}
                    {dependencias.length > 0 && !depRows.length && busquedaDep && (
                      <tr>
                        <td colSpan={3} className="empty-state">
                          <p>
                            Ninguna dependencia coincide con &quot;{busquedaDep}&quot;. Prueba con otro nombre o número (ej. D4, 144, 144-1).
                          </p>
                        </td>
                      </tr>
                    )}
                    {depRows.map((row) => {
                      if (row.type === 'main') {
                        return (
                          <tr key={row.key} className="main-dep-row" data-dep-id={row.dep.id}>
                            <td>
                              {row.hasChildren ? (
                                <button
                                  type="button"
                                  className={`btn-flecha-dep ${row.isExpanded ? 'arrow-expanded' : 'arrow-collapsed'}`}
                                  aria-label="Ver subdivisiones"
                                  title="Ver subdivisiones"
                                  onClick={() => toggleExpand(row.dep.id)}
                                >
                                  {row.isExpanded ? '▼' : '▶'}
                                </button>
                              ) : (
                                <span className="btn-flecha-dep-placeholder" />
                              )}
                              {' '}
                              <span className="link-dependencia">{row.label}</span>
                            </td>
                            <td>{row.nombre}</td>
                            <td>
                              <DepAcciones
                                depId={row.dep.id}
                                depLabel={row.label}
                                openMenuId={openMenuId}
                                isAdmin={isAdmin}
                                onOpenMenu={(id) => setOpenMenuId(id)}
                                onSeleccionar={() => seleccionarDependencia(row.dep.id)}
                                onEditar={() => openEditarDep(row.dep.id)}
                                onEliminar={() => {
                                  if (!isAdmin) {
                                    showToast('Solo admin puede eliminar dependencias', 'error');
                                    return;
                                  }
                                  setModalEliminarDep({ id: row.dep.id, label: row.label });
                                  setOpenMenuId(null);
                                }}
                              />
                            </td>
                          </tr>
                        );
                      }
                      const levelClass = row.level === 1 ? ' row-nivel-1' : ' row-nivel-2';
                      const lastClass = row.isLast ? ' row-division-last' : '';
                      const hiddenClass = row.hidden ? ' row-division-hidden' : '';
                      const indent = 8 + (row.level * 22);
                      return (
                        <tr
                          key={row.key}
                          className={`row-division${levelClass}${hiddenClass}${lastClass}`}
                          data-parent-id={row.dep.parentId}
                          data-root-id={row.rootId}
                        >
                          <td style={{ paddingLeft: `${indent}px` }}>
                            <span className="link-dependencia">{row.labelPrefix}{row.label}</span>
                          </td>
                          <td>{row.nombre}</td>
                          <td>
                            <DepAcciones
                              depId={row.dep.id}
                              depLabel={row.label}
                              openMenuId={openMenuId}
                              isAdmin={isAdmin}
                              onOpenMenu={(id) => setOpenMenuId(id)}
                              onSeleccionar={() => seleccionarDependencia(row.dep.id)}
                              onEditar={() => openEditarDep(row.dep.id)}
                              onEliminar={() => {
                                if (!isAdmin) {
                                  showToast('Solo admin puede eliminar dependencias', 'error');
                                  return;
                                }
                                setModalEliminarDep({ id: row.dep.id, label: row.label });
                                setOpenMenuId(null);
                              }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Paso 2 */}
        {wizardStep === 2 && (
          <div className="guardia-wizard-step guardia-wizard-step--productos is-active" id="guardia-wizard-step-2">
            <div className="guardia-step2-card">
              <header className="guardia-step2-head">
                <div>
                  <h3 className="guardia-step2-title">Paso 2 · Productos</h3>
                  <p className="guardia-step2-sub">
                    Destino: <strong>{selectedDepLabel}</strong>
                  </p>
                </div>
                <div className="guardia-step2-search">
                  <div className="search-bar" role="search">
                    <span className="search-icon" aria-hidden="true">🔍</span>
                    <input
                      id="guardia-buscar-producto"
                      type="search"
                      placeholder="Buscar por nombre, código o serie…"
                      value={busquedaProducto}
                      onChange={(e) => setBusquedaProducto(e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                </div>
              </header>

              {(productosDisponibles.agotadoMsg || productosDisponibles.emptyMsg) && (
                <div className="guardia-step2-alerts">
                  {productosDisponibles.agotadoMsg && (
                    <p className="guardia-agotado-msg" role="alert">{productosDisponibles.agotadoMsg}</p>
                  )}
                  {productosDisponibles.emptyMsg && (
                    <p className="guardia-empty-msg">{productosDisponibles.emptyMsg}</p>
                  )}
                </div>
              )}

              <div className="guardia-step2-grid">
                <section className="guardia-step2-panel guardia-step2-panel--catalog" aria-label="Productos disponibles">
                  <div className="guardia-step2-panel-head">
                    <h4 className="guardia-step2-panel-title">Disponibles</h4>
                    <span className="guardia-step2-panel-count">{productosDisponibles.items.length}</span>
                  </div>
                  <div className="guardia-step2-table-wrap">
                    <table className="data-table data-table-compact guardia-step2-catalog-table">
                      <colgroup>
                        <col className="guardia-step2-col-serie" />
                        <col className="guardia-step2-col-exp" />
                        <col className="guardia-step2-col-nombre" />
                        <col className="guardia-step2-col-disp" />
                        <col className="guardia-step2-col-action" />
                      </colgroup>
                      <thead>
                        <tr>
                          <th>Nº serie</th>
                          <th>Exp.</th>
                          <th>Producto</th>
                          <th className="num-col">Disp.</th>
                          <th aria-label="Acción" />
                        </tr>
                      </thead>
                      <tbody>
                        {productosDisponibles.items.map((item) => (
                          <tr
                            key={`${item.movimientoId}-${item.productoId}`}
                            className={item.agotado ? 'guardia-fila-agotada' : ''}
                          >
                            <td className="guardia-step2-cell-clip" title={item.codProducto}>{item.codProducto}</td>
                            <td className="guardia-step2-cell-clip guardia-step2-cell-exp" title={item.codExp}>{item.codExp}</td>
                            <td className="guardia-step2-cell-clip guardia-step2-cell-nombre" title={item.nomProducto}>{item.nomProducto}</td>
                            <td className={`guardia-step2-col-disp num-col ${item.agotado ? 'stock-cell stock-cell-cero' : 'stock-cell'}`}>
                              {item.disponibleMov}
                            </td>
                            <td className="guardia-step2-col-action">
                              {item.agotado ? (
                                <span className="guardia-badge-agotado" title="Sin stock">Agotado</span>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm btn-seleccionar-producto"
                                  aria-label={`Agregar ${item.nomProducto}`}
                                  title="Agregar a la entrega"
                                  onClick={() => addToCarrito(item)}
                                >
                                  +
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <aside className="guardia-step2-panel guardia-step2-panel--cart" aria-label="Carrito de entrega">
                  <div className="guardia-step2-panel-head">
                    <h4 className="guardia-step2-panel-title">En esta entrega</h4>
                    <span className="guardia-step2-panel-count">{carrito.length}</span>
                  </div>
                  {carrito.length > 0 ? (
                    <div className="guardia-step2-table-wrap">
                      <table className="data-table data-table-compact guardia-step2-cart-table">
                        <colgroup>
                          <col />
                          <col className="guardia-step2-col-cant" />
                          <col className="guardia-step2-col-action" />
                        </colgroup>
                        <thead>
                          <tr>
                            <th>Producto</th>
                            <th className="num-col">Cant.</th>
                            <th aria-label="Quitar" />
                          </tr>
                        </thead>
                        <tbody>
                          {carrito.map((item, idx) => (
                            <tr key={`${item.movimientoId}-${idx}`}>
                              <td className="guardia-step2-cart-label" title={item.label}>
                                <span className="guardia-step2-cart-name">{item.nomProducto}</span>
                                <span className="guardia-step2-cart-meta">
                                  {item.codProducto} · Exp. {item.codExp}
                                </span>
                              </td>
                              <td className="num-col">
                                <input
                                  type="number"
                                  className="guardia-step2-cart-cantidad"
                                  min={1}
                                  max={item.disponible}
                                  value={item.cantidad}
                                  onChange={(e) => updateCarritoCantidad(idx, parseInt(e.target.value, 10) || 1)}
                                />
                              </td>
                              <td>
                                <button type="button" className="btn btn-danger btn-sm" onClick={() => removeCarritoItem(idx)}>
                                  ×
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="guardia-step2-cart-empty">
                      Seleccioná productos de la lista con el botón <strong>+</strong>
                    </p>
                  )}
                  <footer className="guardia-step2-cart-footer">
                    <div className="guardia-step2-meta">
                      <div className="form-group">
                        <label htmlFor="guardia-provision-fecha">Fecha</label>
                        <input
                          id="guardia-provision-fecha"
                          type="datetime-local"
                          value={fechaProvision}
                          onChange={(e) => setFechaProvision(e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="guardia-provision-concepto">Descripción</label>
                        <input
                          id="guardia-provision-concepto"
                          type="text"
                          placeholder="Opcional"
                          value={conceptoProvision}
                          onChange={(e) => setConceptoProvision(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="guardia-step2-actions">
                      {carrito.length > 0 && (
                        <button type="button" className="btn btn-secondary" onClick={() => setCarrito([])}>
                          Vaciar
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={!carrito.length}
                        onClick={continuarAConfirmacion}
                      >
                        Continuar →
                      </button>
                    </div>
                  </footer>
                </aside>
              </div>
            </div>
          </div>
        )}

        {/* Paso 3 */}
        {wizardStep === 3 && pendingProvision && (
          <div className="guardia-wizard-step is-active">
            <div className="guardia-wizard-panel modal-confirmar-content" style={{ maxWidth: '520px', margin: '0 auto' }}>
              <div className="modal-confirmar-icono" aria-hidden="true">!</div>
              <h3 className="modal-confirmar-titulo">
                {pendingProvision.provisions.length > 1
                  ? '¿Seguro que desea proveer los productos?'
                  : '¿Seguro que desea proveer el producto?'}
              </h3>
              <div className="modal-body modal-confirmar-body">
                <table className="modal-confirmar-tabla">
                  <thead>
                    <tr>
                      <th className="modal-confirmar-th">Concepto</th>
                      <th className="modal-confirmar-th">Dato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingProvision.confirmRows.map((row, i) => (
                      <tr key={i}>
                        <td className="modal-confirmar-label">Producto</td>
                        <td className="modal-confirmar-valor">{row.label} — Cantidad: {row.cantidad}</td>
                      </tr>
                    ))}
                    <tr>
                      <td className="modal-confirmar-label">Destino</td>
                      <td className="modal-confirmar-valor">{pendingProvision.depLabel || '—'}</td>
                    </tr>
                  </tbody>
                </table>
                <p className="modal-confirmar-pregunta">¿Confirma la provisión?</p>
              </div>
              <div className="modal-actions modal-confirmar-actions">
                <button type="button" className="btn btn-secondary" onClick={() => { setPendingProvision(null); setWizardStep(2); }}>
                  No
                </button>
                <button type="button" className="btn btn-primary modal-confirmar-btn-si" onClick={confirmarProvision}>
                  Sí
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Paso 4 */}
        {wizardStep === 4 && actaDatos && (
          <div className="guardia-wizard-step guardia-wizard-step--acta is-active" id="modal-acta-entrega">
            <div className="guardia-step4-card">
              <h3 className="guardia-step4-title">Paso 4 · Acta de entrega</h3>
              <p className="guardia-step4-hint">Revisá el documento. Al imprimir queda registrado en el módulo Actas.</p>
              <div
                ref={actaContenidoRef}
                className="acta-entrega-print-area"
                dangerouslySetInnerHTML={{ __html: actaHtml }}
              />
              <div className="guardia-step4-actions">
                <button type="button" className="btn btn-primary" onClick={imprimirActa}>
                  Imprimir acta
                </button>
                <button type="button" className="btn btn-secondary" onClick={resetWizard}>
                  Finalizar y nueva entrega
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Historial provisiones */}
      {showHistorial && (
        <div className="table-wrap guardia-historial-wrap" style={{ marginTop: '1.5rem' }}>
          <h3 className="page-title" style={{ fontSize: '1rem' }}>Productos provistos a esta dependencia</h3>
          <div className="filtros-avanzados">
            <div className="filtros-row">
              <div className="filtro-grupo">
                <label htmlFor="filtro-guardia-buscar">Buscar</label>
                <input
                  id="filtro-guardia-buscar"
                  type="text"
                  placeholder="Producto, concepto…"
                  value={filtroProvBuscar}
                  onChange={(e) => setFiltroProvBuscar(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="filtro-grupo">
                <label htmlFor="filtro-guardia-desde">Desde</label>
                <input
                  id="filtro-guardia-desde"
                  type="date"
                  value={filtroProvDesde}
                  onChange={(e) => setFiltroProvDesde(e.target.value)}
                />
              </div>
              <div className="filtro-grupo">
                <label htmlFor="filtro-guardia-hasta">Hasta</label>
                <input
                  id="filtro-guardia-hasta"
                  type="date"
                  value={filtroProvHasta}
                  onChange={(e) => setFiltroProvHasta(e.target.value)}
                />
              </div>
              <div className="filtro-grupo filtro-grupo-btn">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => { setFiltroProvBuscar(''); setFiltroProvDesde(''); setFiltroProvHasta(''); }}
                >
                  Limpiar filtros
                </button>
              </div>
            </div>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Producto / Expediente</th>
                <th>Fecha asignación</th>
                <th className="num-col">Cantidad</th>
                <th>Concepto</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {!provisionesFiltradas.length && (
                <tr>
                  <td colSpan={5} className="empty-state">No hay productos provistos que coincidan con los filtros.</td>
                </tr>
              )}
              {provisionesFiltradas.map((e) => (
                <tr key={e.id}>
                  <td>{e.nombreProd}</td>
                  <td>{e.fecha}</td>
                  <td className="num-col">{e.cantidad}</td>
                  <td>{e.concepto}</td>
                  <td>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => quitarProvision(e.id)}>
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal elegir tipo acta */}
      <ModalShell
        open={!!datosActaOpciones}
        onClose={() => setDatosActaOpciones(null)}
        title="¿Cómo querés generar el acta?"
      >
        <div className="modal-body">
          <p className="panel-desc" style={{ marginBottom: '1rem' }}>
            Hay ítems de más de un expediente. Podés generar una sola acta con todo o una acta por cada expediente.
          </p>
          <div className="modal-actions" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setActaDatos(datosActaOpciones);
                setDatosActaOpciones(null);
                setWizardStep(4);
              }}
            >
              Una sola acta con todos los ítems
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                const cola = buildActasPorExpediente(datosActaOpciones);
                setDatosActaOpciones(null);
                if (cola.length > 0) {
                  const [first, ...rest] = cola;
                  setActaDatos(first);
                  setActasCola(rest);
                  setWizardStep(4);
                }
              }}
            >
              Una acta por expediente
            </button>
          </div>
        </div>
      </ModalShell>

      {/* Modal confirmar eliminar dependencia */}
      <ModalShell
        open={!!modalEliminarDep}
        onClose={() => setModalEliminarDep(null)}
        confirmStyle
        actions={(
          <div className="modal-actions modal-confirmar-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setModalEliminarDep(null)}>Cancelar</button>
            <button type="button" className="btn btn-danger" onClick={eliminarDependencia}>Aceptar</button>
          </div>
        )}
      >
        <div className="modal-confirmar-icono" aria-hidden="true">!</div>
        <h3 className="modal-confirmar-titulo">Confirmar eliminación</h3>
        <div className="modal-body modal-confirmar-body">
          <p className="modal-confirmar-pregunta">
            ¿Seguro que desea eliminar &quot;{modalEliminarDep?.label}&quot;?
          </p>
        </div>
      </ModalShell>

      {/* Modal editar dependencia */}
      <ModalShell
        open={!!modalEditarDepId}
        onClose={() => setModalEditarDepId(null)}
        wide
        title={editDep ? `Editar: ${getDisplayLabel(editDep, dependencias)}` : 'Editar dependencia'}
        actions={(
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setModalEditarDepId(null)}>Cancelar</button>
            <button type="button" className="btn btn-primary" onClick={guardarEditarDep}>Guardar cambios</button>
          </div>
        )}
      >
        <div className="modal-body">
          <div className="form-row form-row-3">
            <div className="form-group">
              <label htmlFor="editar-dep-guardia-nombre">Nombre</label>
              <input
                id="editar-dep-guardia-nombre"
                type="text"
                placeholder="Nombre"
                value={editDepForm.nombre}
                onChange={(e) => setEditDepForm((f) => ({ ...f, nombre: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label htmlFor="editar-dep-guardia-numero">Número</label>
              <input
                id="editar-dep-guardia-numero"
                type="text"
                placeholder="Ej: 1"
                value={editDepForm.numero}
                onChange={(e) => setEditDepForm((f) => ({ ...f, numero: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label htmlFor="editar-dep-guardia-codigo">Código</label>
              <input id="editar-dep-guardia-codigo" type="text" readOnly value={editDepForm.codigo} />
            </div>
          </div>
          <div className="form-row form-row-3" style={{ marginTop: '0.5rem' }}>
            <div className="form-group">
              <label htmlFor="editar-dep-guardia-child-nombre">
                {editDep?.parentId ? 'Agregar sub-división' : 'Agregar división'}
              </label>
              <input
                id="editar-dep-guardia-child-nombre"
                type="text"
                placeholder="Nombre"
                value={editDepChild.nombre}
                onChange={(e) => setEditDepChild((f) => ({ ...f, nombre: e.target.value.toUpperCase() }))}
              />
            </div>
            <div className="form-group">
              <label htmlFor="editar-dep-guardia-child-numero">Número</label>
              <input
                id="editar-dep-guardia-child-numero"
                type="text"
                placeholder="Ej: 1"
                value={editDepChild.numero}
                onChange={(e) => setEditDepChild((f) => ({ ...f, numero: e.target.value }))}
              />
            </div>
            <div className="form-group form-group-actions" style={{ alignSelf: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={agregarDivision}>Agregar</button>
            </div>
          </div>
          <div className="table-wrap" style={{ marginTop: '0.75rem' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Nombre</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {!editDepHijos.length && (
                  <tr>
                    <td colSpan={3} className="empty-state"><p>No hay elementos cargados.</p></td>
                  </tr>
                )}
                {editDepHijos.map((h) => {
                  const tipo = editDep?.parentId ? 'Sub-división' : 'División';
                  const num = (h.numero != null ? String(h.numero) : '').trim() || '—';
                  const nom = (h.nombre || '').toString().trim() || '—';
                  const label = getDisplayLabel(h, dependencias);
                  return (
                    <tr key={h.id}>
                      <td>{tipo}</td>
                      <td>{num} - {nom}</td>
                      <td>
                        {isAdmin ? (
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => setModalEliminarDep({ id: h.id, label })}
                          >
                            Eliminar
                          </button>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </ModalShell>
    </div>
  );
}

function DepAcciones({ depId, openMenuId, isAdmin, onOpenMenu, onSeleccionar, onEditar, onEliminar }) {
  const isOpen = openMenuId === depId;
  return (
    <div className="dep-acciones-inline">
      <button type="button" className="btn btn-primary btn-sm btn-dep-guardia" onClick={onSeleccionar}>
        Seleccionar
      </button>
      <div className="dep-menu-dots-wrap">
        <button
          type="button"
          className="dep-menu-dots-btn"
          title="Más opciones"
          onClick={(e) => { e.stopPropagation(); onOpenMenu(isOpen ? null : depId); }}
        >
          ⋮
        </button>
        <div className={`dep-menu-dots-dropdown${isOpen ? ' dep-menu-dots-open' : ''}`}>
          <button type="button" className="dep-menu-dots-item dep-menu-dots-editar" onClick={(e) => { e.stopPropagation(); onEditar(); }}>
            Editar
          </button>
          {isAdmin && (
            <button type="button" className="dep-menu-dots-item dep-menu-dots-eliminar" onClick={(e) => { e.stopPropagation(); onEliminar(); }}>
              Eliminar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
