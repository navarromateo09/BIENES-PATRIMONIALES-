import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  buildEntregaDepRows,
  filterDepsForEntrega,
  filterMatafuegosDisponibles,
  getDisplayLabel,
  matafuegoCartLabel
} from '../../utils/matafuegosEntregaHelpers';
import { formatFecha, inferCapacidadTipo } from '../../utils/matafuegosHelpers';

const STEPS = [
  { n: 1, label: 'Destino' },
  { n: 2, label: 'Matafuegos' },
  { n: 3, label: 'Confirmar' }
];

export default function MatafuegoEntregaWizard({
  open,
  dependencias,
  disponibles,
  onClose,
  onConfirm
}) {
  const [step, setStep] = useState(1);
  const [selectedDepId, setSelectedDepId] = useState(null);
  const [busquedaDep, setBusquedaDep] = useState('');
  const [expandedDepIds, setExpandedDepIds] = useState({});
  const [busquedaMf, setBusquedaMf] = useState('');
  const [carrito, setCarrito] = useState([]);

  const deps = useMemo(() => filterDepsForEntrega(dependencias), [dependencias]);
  const depRows = useMemo(
    () => buildEntregaDepRows(deps, busquedaDep, expandedDepIds),
    [deps, busquedaDep, expandedDepIds]
  );
  const depSearchActive = Boolean(busquedaDep.trim());
  const selectedDep = useMemo(
    () => deps.find((d) => d.id === selectedDepId) || null,
    [deps, selectedDepId]
  );
  const selectedDepLabel = useMemo(
    () => (selectedDep ? getDisplayLabel(selectedDep, deps) : ''),
    [selectedDep, deps]
  );
  const catalogo = useMemo(
    () => filterMatafuegosDisponibles(disponibles, busquedaMf),
    [disponibles, busquedaMf]
  );
  const carritoIds = useMemo(() => new Set(carrito.map((m) => m.id)), [carrito]);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  function resetAndClose() {
    setStep(1);
    setSelectedDepId(null);
    setBusquedaDep('');
    setExpandedDepIds({});
    setBusquedaMf('');
    setCarrito([]);
    onClose();
  }

  function toggleExpand(depId) {
    setExpandedDepIds((prev) => ({ ...prev, [depId]: !prev[depId] }));
  }

  function seleccionarDependencia(depId) {
    setSelectedDepId(depId);
    setCarrito([]);
    setBusquedaMf('');
    setStep(2);
  }

  function pickDependencia(depId, e) {
    e?.stopPropagation?.();
    seleccionarDependencia(depId);
  }

  function renderDepAction(depId) {
    return (
      <button
        type="button"
        className="btn btn-primary btn-sm mf-entrega-pick-btn"
        onClick={(e) => pickDependencia(depId, e)}
      >
        Seleccionar
      </button>
    );
  }

  function addToCarrito(m) {
    if (carritoIds.has(m.id)) {
      return;
    }
    setCarrito((prev) => [...prev, m]);
  }

  function removeFromCarrito(id) {
    setCarrito((prev) => prev.filter((m) => m.id !== id));
  }

  function wizardAtras() {
    if (step === 3) setStep(2);
    else if (step === 2) {
      setSelectedDepId(null);
      setCarrito([]);
      setStep(1);
    }
  }

  async function handleConfirmar() {
    if (!selectedDepId || !carrito.length) return;
    try {
      await onConfirm({ dependenciaId: selectedDepId, matafuegos: carrito, depLabel: selectedDepLabel });
      setStep(1);
      setSelectedDepId(null);
      setBusquedaDep('');
      setExpandedDepIds({});
      setBusquedaMf('');
      setCarrito([]);
      onClose();
    } catch {
      /* el padre muestra el error */
    }
  }

  return createPortal(
    <div className="mf-entrega-overlay" role="dialog" aria-modal="true" aria-labelledby="mf-entrega-title" onClick={(e) => { if (e.target === e.currentTarget) resetAndClose(); }}>
      <div className="mf-entrega-wizard">
        <header className="mf-entrega-head">
          <div>
            <h2 id="mf-entrega-title" className="mf-entrega-title">Entregar matafuegos</h2>
            <p className="mf-entrega-sub">
              Registrá la entrega paso a paso: destino, selección y confirmación.
            </p>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={resetAndClose}>
            Cerrar
          </button>
        </header>

        <ol className={`mf-entrega-stepper${step > 1 ? ' mf-entrega-stepper--compact' : ''}`} aria-label="Pasos">
          {STEPS.map(({ n, label }) => (
            <li
              key={n}
              className={`mf-entrega-stepper-item${step === n ? ' active' : ''}${step > n ? ' done' : ''}`}
            >
              <span className="mf-entrega-stepper-num" aria-hidden="true">{n}</span>
              <span className="mf-entrega-stepper-label">{label}</span>
            </li>
          ))}
        </ol>

        {step >= 2 && (
          <div className="mf-entrega-toolbar">
            <button type="button" className="btn btn-secondary btn-sm" onClick={wizardAtras}>
              ← Paso anterior
            </button>
            {selectedDepLabel && (
              <span className="mf-entrega-chip">Destino: {selectedDepLabel}</span>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="mf-entrega-step">
            <div className="mf-entrega-card">
              <h3 className="mf-entrega-step-title">Paso 1 · Seleccionar destino</h3>
              <p className="mf-entrega-step-desc">
                Buscá por nombre, código o número. Hacé clic en la fila o en <strong>Seleccionar</strong>.
              </p>
              <div className="search-bar mf-entrega-search" role="search">
                <span className="search-icon" aria-hidden="true">🔍</span>
                <input
                  type="search"
                  placeholder="Buscar dependencias…"
                  value={busquedaDep}
                  onChange={(e) => setBusquedaDep(e.target.value)}
                  autoComplete="off"
                />
                {busquedaDep && (
                  <button
                    type="button"
                    className="search-clear"
                    aria-label="Limpiar"
                    onClick={() => { setBusquedaDep(''); setExpandedDepIds({}); }}
                  >
                    &times;
                  </button>
                )}
              </div>
              {depSearchActive && depRows.length > 0 && (
                <p className="mf-entrega-search-hint" role="status">
                  {depRows.length} coincidencia{depRows.length === 1 ? '' : 's'} — mejor opción arriba
                  {depRows.length > 12 && ' · Si buscás una comisaría puntual, probá ej. «comisaria 4» o «4ta»'}
                </p>
              )}
              <div className="inst-table-wrap table-wrap mf-entrega-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Identificador</th>
                      <th>Nombre</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!deps.length && (
                      <tr>
                        <td colSpan={3} className="empty-state">
                          <p>No hay dependencias cargadas.</p>
                        </td>
                      </tr>
                    )}
                    {deps.length > 0 && !depRows.length && busquedaDep && (
                      <tr>
                        <td colSpan={3} className="empty-state">
                          <p>Ninguna dependencia coincide con &quot;{busquedaDep}&quot;.</p>
                        </td>
                      </tr>
                    )}
                    {depRows.map((row) => {
                      if (row.searchMode) {
                        return (
                          <tr
                            key={row.key}
                            className={`mf-entrega-dep-hit mf-entrega-dep-row${row.isTopMatch ? ' mf-entrega-dep-hit--top' : ''}`}
                            onClick={() => seleccionarDependencia(row.dep.id)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); seleccionarDependencia(row.dep.id); } }}
                            tabIndex={0}
                            role="button"
                            aria-label={`Seleccionar ${row.nombre}`}
                          >
                            <td>
                              {row.breadcrumb && (
                                <span className="mf-entrega-dep-breadcrumb" title={row.breadcrumb}>
                                  {row.breadcrumb}
                                </span>
                              )}
                              <span className="link-dependencia mf-entrega-dep-label">{row.label}</span>
                            </td>
                            <td>{row.nombre}</td>
                            <td>{renderDepAction(row.dep.id)}</td>
                          </tr>
                        );
                      }
                      if (row.type === 'main') {
                        return (
                          <tr
                            key={row.key}
                            className="main-dep-row mf-entrega-dep-row"
                            onClick={() => seleccionarDependencia(row.dep.id)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); seleccionarDependencia(row.dep.id); } }}
                            tabIndex={0}
                            role="button"
                            aria-label={`Seleccionar ${row.nombre}`}
                          >
                            <td>
                              {row.hasChildren ? (
                                <button
                                  type="button"
                                  className={`btn-flecha-dep ${row.isExpanded ? 'arrow-expanded' : 'arrow-collapsed'}`}
                                  aria-label="Ver subdivisiones"
                                  onClick={(e) => { e.stopPropagation(); toggleExpand(row.dep.id); }}
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
                            <td>{renderDepAction(row.dep.id)}</td>
                          </tr>
                        );
                      }
                      const levelClass = row.level === 1 ? ' row-nivel-1' : ' row-nivel-2';
                      const hiddenClass = row.hidden ? ' row-division-hidden' : '';
                      const indent = 8 + (row.level * 22);
                      return (
                        <tr
                          key={row.key}
                          className={`row-division mf-entrega-dep-row${levelClass}${hiddenClass}`}
                          onClick={() => seleccionarDependencia(row.dep.id)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); seleccionarDependencia(row.dep.id); } }}
                          tabIndex={row.hidden ? -1 : 0}
                          role="button"
                          aria-label={`Seleccionar ${row.nombre}`}
                          aria-hidden={row.hidden || undefined}
                        >
                          <td style={{ paddingLeft: `${indent}px` }}>
                            <span className="link-dependencia">{row.labelPrefix}{row.label}</span>
                          </td>
                          <td>{row.nombre}</td>
                          <td>{renderDepAction(row.dep.id)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="mf-entrega-step mf-entrega-step--pick">
            <div className="mf-entrega-pick-card">
              <header className="mf-entrega-pick-head">
                <div>
                  <h3 className="mf-entrega-step-title">Paso 2 · Seleccionar matafuegos</h3>
                  <p className="mf-entrega-step-desc">
                    Destino: <strong>{selectedDepLabel}</strong> — podés agregar uno o varios.
                  </p>
                </div>
                <div className="search-bar mf-entrega-search mf-entrega-search--inline" role="search">
                  <span className="search-icon" aria-hidden="true">🔍</span>
                  <input
                    type="search"
                    placeholder="Buscar por marca, serie, tipo…"
                    value={busquedaMf}
                    onChange={(e) => setBusquedaMf(e.target.value)}
                    autoComplete="off"
                  />
                </div>
              </header>
              <div className="mf-entrega-pick-grid">
                <section className="mf-entrega-pick-panel" aria-label="Disponibles">
                  <div className="mf-entrega-pick-panel-head">
                    <h4>Disponibles</h4>
                    <span>{catalogo.length}</span>
                  </div>
                  <div className="mf-entrega-pick-table-wrap">
                    <table className="data-table data-table-compact">
                      <thead>
                        <tr>
                          <th>Marca</th>
                          <th>Nº serie</th>
                          <th>Capacidad</th>
                          <th>Tipo</th>
                          <th>Vencimiento</th>
                          <th aria-label="Agregar" />
                        </tr>
                      </thead>
                      <tbody>
                        {!catalogo.length && (
                          <tr>
                            <td colSpan={6} className="empty-state">No hay matafuegos disponibles con ese criterio.</td>
                          </tr>
                        )}
                        {catalogo.map((m) => {
                          const inf = inferCapacidadTipo(m.caracteristicas);
                          const enCarrito = carritoIds.has(m.id);
                          return (
                            <tr key={m.id} className={enCarrito ? 'mf-entrega-row-added' : ''}>
                              <td>{m.marca || '—'}</td>
                              <td>{m.numeroSerie || '—'}</td>
                              <td>{inf.capacidad}</td>
                              <td>{inf.tipo || '—'}</td>
                              <td>{formatFecha(m.fechaVencimiento)}</td>
                              <td>
                                {enCarrito ? (
                                  <span className="mf-entrega-badge-added">Agregado</span>
                                ) : (
                                  <button type="button" className="btn btn-primary btn-sm" onClick={() => addToCarrito(m)} title="Agregar">
                                    +
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
                <aside className="mf-entrega-pick-panel mf-entrega-pick-panel--cart" aria-label="Seleccionados">
                  <div className="mf-entrega-pick-panel-head">
                    <h4>En esta entrega</h4>
                    <span>{carrito.length}</span>
                  </div>
                  {carrito.length ? (
                    <div className="mf-entrega-pick-table-wrap">
                      <table className="data-table data-table-compact">
                        <thead>
                          <tr>
                            <th>Matafuego</th>
                            <th aria-label="Quitar" />
                          </tr>
                        </thead>
                        <tbody>
                          {carrito.map((m) => {
                            const { marca, serie, extra } = matafuegoCartLabel(m);
                            return (
                              <tr key={m.id}>
                                <td className="mf-entrega-cart-label">
                                  <span className="mf-entrega-cart-name">{marca} · Nº {serie}</span>
                                  {extra && <span className="mf-entrega-cart-meta">{extra}</span>}
                                </td>
                                <td>
                                  <button type="button" className="btn btn-danger btn-sm" onClick={() => removeFromCarrito(m.id)}>×</button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="mf-entrega-cart-empty">
                      Agregá matafuegos con el botón <strong>+</strong> de la lista.
                    </p>
                  )}
                  <footer className="mf-entrega-pick-footer">
                    {carrito.length > 0 && (
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setCarrito([])}>
                        Vaciar
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={!carrito.length}
                      onClick={() => setStep(3)}
                    >
                      Continuar →
                    </button>
                  </footer>
                </aside>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="mf-entrega-step">
            <div className="mf-entrega-confirm-card">
              <div className="modal-confirmar-icono" aria-hidden="true">!</div>
              <h3 className="modal-confirmar-titulo">
                {carrito.length > 1
                  ? `¿Registrar entrega de ${carrito.length} matafuegos?`
                  : '¿Registrar entrega del matafuego?'}
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
                    <tr>
                      <td className="modal-confirmar-label">Destino</td>
                      <td className="modal-confirmar-valor">{selectedDepLabel || '—'}</td>
                    </tr>
                    {carrito.map((m) => {
                      const { marca, serie, extra } = matafuegoCartLabel(m);
                      return (
                        <tr key={m.id}>
                          <td className="modal-confirmar-label">Matafuego</td>
                          <td className="modal-confirmar-valor">
                            {marca} · Nº {serie}{extra ? ` · ${extra}` : ''}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="modal-confirmar-pregunta">Los ítems pasarán a estado <strong>entregado</strong>.</p>
              </div>
              <div className="modal-actions modal-confirmar-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setStep(2)}>
                  Volver
                </button>
                <button type="button" className="btn btn-primary modal-confirmar-btn-si" onClick={handleConfirmar}>
                  Confirmar entrega
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
