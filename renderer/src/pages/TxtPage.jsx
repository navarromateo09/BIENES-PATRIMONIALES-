import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLoading } from '../contexts/LoadingContext';
import { useToast } from '../contexts/ToastContext';
import { getStockAPI } from '../hooks/useStockAPI';
import {
  TXT_NUEVO_COLUMNS,
  TXT_NUEVO_FIELD_MAX,
  TXT_REPARTICION_DEFAULT_NOMBRE,
  TXT_REPARTICION_DEFAULT_NUMERO,
  buildTxtSearchRows,
  clampTxtNuevoItem,
  depMatchesQuery,
  emptyTxtNuevoForm,
  expandTxtItemPorRepeticiones,
  formatFechaHoraIso,
  getDepDisplayLabel,
  getDivisiones,
  getMainDeps,
  getTxtNuevoDefaultNames,
  isTxtRealizadosSchemaErrorMsg,
  normalizeKey,
  onlyDigits,
  parseDependenciasCsv,
  parseDependenciasTxt,
  parseTxtNuevoRepeticiones,
  parseTxtOrdenNumber,
  formatTxtOrdenInput,
  readFileAsText
} from '../utils/txtHelpers';

function ModalShell({ open, onClose, title, wide, children, actions }) {
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
        {actions}
      </div>
    </div>,
    document.body
  );
}

function toOrderNumber(value) {
  return parseTxtOrdenNumber(value);
}

function getOrdenScopeKeyFromValues(depCodigo, habNumero, habNombre) {
  const depKey = onlyDigits(depCodigo || '') || normalizeKey(depCodigo || '');
  const habKey = onlyDigits(habNumero || '') || normalizeKey(habNumero || '') || normalizeKey(habNombre || '');
  if (!depKey && !habKey) return '';
  return `${depKey}|${habKey}`;
}

function ModalTxtOrden({ open, ordenId, ordenLabel, onClose, showToast }) {
  const [cantidad, setCantidad] = useState('0');
  const [ultimaMod, setUltimaMod] = useState('—');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !ordenId) return;
    setCantidad('0');
    setUltimaMod('—');
    const api = getStockAPI();
    if (!api) return;
    if (api.getTxtOrdenInfo) {
      api.getTxtOrdenInfo(ordenId).then((info) => {
        const n = info && info.count != null ? info.count : 0;
        setCantidad(formatTxtOrdenInput(n != null ? n : 0) || '0');
        const updatedAt = info && info.updatedAt ? String(info.updatedAt) : '';
        if (!updatedAt) {
          setUltimaMod('—');
        } else {
          const d = new Date(updatedAt);
          setUltimaMod(Number.isNaN(d.getTime())
            ? updatedAt
            : d.toLocaleString('es-AR', {
              day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
            }));
        }
      }).catch(() => {});
    } else if (api.getTxtOrdenCount) {
      api.getTxtOrdenCount(ordenId).then((n) => {
        setCantidad(formatTxtOrdenInput(n != null ? n : 0) || '0');
      }).catch(() => {});
    }
  }, [open, ordenId]);

  async function handleGuardar() {
    if (!ordenId) {
      showToast('Primero selecciona un resultado', 'error');
      return;
    }
    const api = getStockAPI();
    if (!api?.saveTxtOrdenCount) {
      showToast('Función de guardado no disponible', 'error');
      return;
    }
    const parsed = parseTxtOrdenNumber(cantidad);
    if (parsed == null) {
      showToast('Ingresá un número de orden válido (ej. 9.960 o 9960)', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.saveTxtOrdenCount(ordenId, parsed);
      showToast(`Conteo guardado: ${formatTxtOrdenInput(parsed)}`, 'success');
      onClose();
    } catch (err) {
      const msg = err?.message || 'Error desconocido';
      if (msg.toLowerCase().includes('no handler registered')) {
        showToast('Error al guardar el conteo: falta handler en el backend. Reiniciá el programa.', 'error');
      } else {
        showToast(`Error al guardar el conteo: ${msg}`, 'error');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="ORDEN"
      wide
      actions={(
        <div className="modal-actions">
          <button type="button" className="btn btn-primary" disabled={saving} onClick={handleGuardar}>Guardar</button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      )}
    >
      <div className="modal-body">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>ORDEN</th>
                <th>CANTIDAD</th>
                <th>ÚLTIMA MODIFICACIÓN</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{ordenLabel?.trim() || '—'}</td>
                <td>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Ej: 9.960"
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value)}
                  />
                </td>
                <td>{ultimaMod}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </ModalShell>
  );
}

function ModalTxtAgregar({ open, onClose, deps, preselectDepId, onSaved, showToast }) {
  const [modo, setModo] = useState('existente');
  const [codigo, setCodigo] = useState('');
  const [nombreDep, setNombreDep] = useState('');
  const [divisionesTemp, setDivisionesTemp] = useState([]);
  const [divNum, setDivNum] = useState('');
  const [divNombre, setDivNombre] = useState('');
  const [depBuscar, setDepBuscar] = useState('');
  const [depId, setDepId] = useState('');
  const [habNum, setHabNum] = useState('');
  const [habNombre, setHabNombre] = useState('');
  const [showDepSug, setShowDepSug] = useState(false);
  const [saving, setSaving] = useState(false);

  const mainDeps = useMemo(() => {
    const mains = getMainDeps(deps);
    return mains.slice().sort((a, b) => {
      const ca = parseInt(String(a.codigo || '0').replace(/\D/g, ''), 10) || 0;
      const cb = parseInt(String(b.codigo || '0').replace(/\D/g, ''), 10) || 0;
      if (ca !== cb) return ca - cb;
      return String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es');
    });
  }, [deps]);

  const depSugerencias = useMemo(() => {
    const q = normalizeKey(depBuscar);
    let filtered = q
      ? mainDeps.filter((d) => depMatchesQuery(d, q, deps))
      : mainDeps.slice(0, 80);
    if (q) filtered = filtered.slice(0, 100);
    return filtered;
  }, [mainDeps, depBuscar, deps]);

  const depSeleccionada = useMemo(
    () => (depId ? deps.find((d) => String(d.id) === String(depId)) : null),
    [deps, depId]
  );

  const pendingDivision = !!onlyDigits(divNum) && !!divNombre.trim();

  const canGuardar = modo === 'existente'
    ? !!depId && !!onlyDigits(habNum) && !!habNombre.trim()
    : !!onlyDigits(codigo) && !!nombreDep.trim() && (divisionesTemp.length > 0 || pendingDivision);

  useEffect(() => {
    if (!open) return;
    setModo('existente');
    setCodigo('');
    setNombreDep('');
    setDivisionesTemp([]);
    setDivNum('');
    setDivNombre('');
    setDepBuscar('');
    setDepId('');
    setHabNum('');
    setHabNombre('');
    setShowDepSug(false);
  }, [open]);

  useEffect(() => {
    if (!open || !preselectDepId) return;
    const dep = mainDeps.find((d) => String(d.id) === String(preselectDepId))
      || deps.find((d) => String(d.id) === String(preselectDepId));
    if (dep) {
      setDepId(String(dep.id));
      setDepBuscar(getDepDisplayLabel(dep, deps));
    }
  }, [open, preselectDepId, mainDeps, deps]);

  function selectDep(dep) {
    if (!dep) {
      setDepId('');
      setDepBuscar('');
      return;
    }
    setDepId(String(dep.id));
    setDepBuscar(getDepDisplayLabel(dep, deps));
    setShowDepSug(false);
  }

  function addDivisionTemp() {
    const numeroDigits = onlyDigits(divNum);
    if (!numeroDigits) {
      showToast('Ingresá el nº de división', 'error');
      return;
    }
    const nombre = divNombre.trim().toUpperCase();
    if (!nombre) {
      showToast('Ingresá el nombre de la división', 'error');
      return;
    }
    if (divisionesTemp.some((d) => String(d.numero) === numeroDigits)) {
      showToast('Ya existe esa división en la lista', 'error');
      return;
    }
    setDivisionesTemp((prev) => [...prev, { numero: numeroDigits, nombre }]);
    setDivNum('');
    setDivNombre('');
  }

  function buildDivisionesParaGuardar() {
    const list = [...divisionesTemp];
    const numeroDigits = onlyDigits(divNum);
    const nombre = divNombre.trim().toUpperCase();
    if (numeroDigits && nombre && !list.some((d) => String(d.numero) === numeroDigits)) {
      list.push({ numero: numeroDigits, nombre });
    }
    return list;
  }

  async function handleGuardar() {
    const api = getStockAPI();
    if (!api?.saveTxtDependencia) {
      showToast('No se puede guardar: falta conexión a tabla TXT', 'error');
      return;
    }
    setSaving(true);
    try {
      if (modo === 'existente') {
        const depObj = deps.find((d) => String(d.id) === String(depId));
        const divNumeroDigits = onlyDigits(habNum);
        const divNombre2 = habNombre.trim().toUpperCase();
        if (!depObj) {
          showToast('Selecciona una dependencia existente', 'error');
          return;
        }
        if (!divNumeroDigits) {
          showToast('Ingresá el nº de habitación', 'error');
          return;
        }
        if (!divNombre2) {
          showToast('Ingresá el nombre de la habitación', 'error');
          return;
        }
        const mainId = depObj.id;
        const divId = `${mainId}-div-${divNumeroDigits}`;
        await api.saveTxtDependencia({
          id: divId,
          nombre: divNombre2,
          codigo: depObj.codigo || '',
          parentId: mainId,
          numero: divNumeroDigits
        });
        showToast('Habitación agregada', 'success');
      } else {
        const codigoDigits = onlyDigits(codigo);
        const nombreDep2 = nombreDep.trim().toUpperCase();
        const divisiones = buildDivisionesParaGuardar();
        if (!codigoDigits) {
          showToast('Ingresá el código/ID de dependencia', 'error');
          return;
        }
        if (!nombreDep2) {
          showToast('Ingresá el nombre de dependencia', 'error');
          return;
        }
        if (!divisiones.length) {
          showToast('Completá al menos una división (nº y nombre)', 'error');
          return;
        }
        const mainId2 = `txt-dep-${codigoDigits}`;
        await api.saveTxtDependencia({
          id: mainId2,
          nombre: nombreDep2,
          codigo: codigoDigits,
          parentId: null,
          numero: null
        });
        for (const d of divisiones) {
          // eslint-disable-next-line no-await-in-loop
          await api.saveTxtDependencia({
            id: `${mainId2}-div-${d.numero}`,
            nombre: d.nombre,
            codigo: codigoDigits,
            parentId: mainId2,
            numero: d.numero
          });
        }
        showToast('Dependencia y divisiones agregadas', 'success');
      }
      onClose();
      await onSaved();
    } catch (err) {
      console.error('[TXT] saveDependencia ERROR:', err);
      showToast(err?.message || 'Error al guardar', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Agregar a TXT"
      wide
      actions={(
        <div className="modal-actions">
          <button type="button" className="btn btn-primary" disabled={!canGuardar || saving} onClick={handleGuardar}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        </div>
      )}
    >
      <div className="modal-body">
        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <label>¿Qué querés hacer?</label>
          <div className="txt-agregar-modo-tabs" role="group" aria-label="Modo de carga">
            <button
              type="button"
              className={`btn txt-agregar-modo-tab${modo === 'existente' ? ' is-active' : ''}`}
              onClick={() => setModo('existente')}
            >
              Dependencia existente (+ habitación)
            </button>
            <button
              type="button"
              className={`btn txt-agregar-modo-tab${modo === 'nueva' ? ' is-active' : ''}`}
              onClick={() => setModo('nueva')}
            >
              Crear dependencia nueva
            </button>
          </div>
          <p className="panel-desc" style={{ margin: '0.5rem 0 0' }}>
            Para agregar una habitación a una dependencia que ya figura en el buscador, usá la primera opción.
          </p>
        </div>

        {modo === 'nueva' ? (
          <div>
            <p className="panel-desc" style={{ margin: '0 0 1rem' }}>
              Creá una dependencia nueva e indicá las habitaciones (divisiones). Podés usar «+ Agregar división a la lista» o guardar directo si ya completaste nº y nombre abajo.
            </p>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="txt-agregar-codigo">Código / ID de dependencia</label>
                <input
                  id="txt-agregar-codigo"
                  type="text"
                  placeholder="Ej: 430"
                  inputMode="numeric"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="txt-agregar-nombre-dep">Nombre de dependencia</label>
                <input
                  id="txt-agregar-nombre-dep"
                  type="text"
                  placeholder="Ej: OFICINA JEFE"
                  value={nombreDep}
                  onChange={(e) => setNombreDep(e.target.value)}
                />
              </div>
            </div>
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label>Divisiones (armar lista)</label>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="txt-agregar-div-num">Nº división</label>
                  <input
                    id="txt-agregar-div-num"
                    type="text"
                    placeholder="Ej: 1"
                    inputMode="numeric"
                    value={divNum}
                    onChange={(e) => setDivNum(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="txt-agregar-div-nombre">Nombre división</label>
                  <input
                    id="txt-agregar-div-nombre"
                    type="text"
                    placeholder="Ej: OF SECRETARIA"
                    value={divNombre}
                    onChange={(e) => setDivNombre(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-productos-expediente-actions" style={{ paddingTop: 0, borderTop: 'none', marginTop: 0 }}>
                <button type="button" className="btn btn-secondary" onClick={addDivisionTemp}>+ Agregar división a la lista</button>
              </div>
              {divisionesTemp.length > 0 && (
                <ul style={{ margin: '.75rem 0 0', paddingLeft: '1.15rem' }}>
                  {divisionesTemp.map((d, idx) => (
                    <li key={idx}>
                      {d.numero} - {d.nombre}
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        style={{ marginLeft: '0.75rem' }}
                        onClick={() => setDivisionesTemp((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        Quitar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <div>
            <p className="panel-desc" style={{ margin: '0 0 1rem' }}>
              Elegí la dependencia ya cargada y completá el número y nombre de la habitación a agregar.
            </p>
            <div className="form-group txt-agregar-dep-picker">
              <label htmlFor="txt-agregar-dep-buscar">Dependencia existente</label>
              <div className="txt-agregar-dep-search-wrap">
                <input
                  id="txt-agregar-dep-buscar"
                  type="search"
                  placeholder={mainDeps.length ? `Escribí código o nombre (${mainDeps.length} dependencias)…` : 'Sin dependencias cargadas'}
                  autoComplete="off"
                  disabled={!mainDeps.length}
                  value={depBuscar}
                  onChange={(e) => {
                    setDepBuscar(e.target.value);
                    setDepId('');
                    setShowDepSug(true);
                  }}
                  onFocus={() => setShowDepSug(true)}
                />
                {showDepSug && depSugerencias.length > 0 && (
                  <div className="txt-agregar-dep-sugerencias" role="listbox" aria-label="Dependencias">
                    {depSugerencias.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        className="txt-nuevo-sug-item"
                        onClick={() => selectDep(d)}
                      >
                        {getDepDisplayLabel(d, deps)}
                      </button>
                    ))}
                  </div>
                )}
                {showDepSug && depBuscar && !depSugerencias.length && (
                  <div className="txt-agregar-dep-sugerencias">
                    <div className="txt-agregar-sug-empty" style={{ padding: '0.65rem', color: '#6b7280', fontSize: '0.88rem' }}>
                      Sin coincidencias. Probá con el código (ej: 8) o parte del nombre.
                    </div>
                  </div>
                )}
              </div>
              {depSeleccionada && (
                <p className="panel-desc txt-agregar-dep-seleccionada">
                  Seleccionada: {getDepDisplayLabel(depSeleccionada, deps)}
                </p>
              )}
              {!mainDeps.length && (
                <p className="panel-desc" style={{ margin: '0.5rem 0 0', color: '#b45309' }}>
                  No hay dependencias en la tabla TXT. Importá un TXT/CSV en esta pantalla o creá una dependencia nueva arriba.
                </p>
              )}
            </div>
            <div className="form-row" style={{ marginTop: '1rem' }}>
              <div className="form-group">
                <label htmlFor="txt-agregar-div-num-ex">Nº habitación</label>
                <input
                  id="txt-agregar-div-num-ex"
                  type="text"
                  placeholder="Ej: 2"
                  inputMode="numeric"
                  value={habNum}
                  onChange={(e) => setHabNum(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="txt-agregar-div-nombre-ex">Nombre habitación</label>
                <input
                  id="txt-agregar-div-nombre-ex"
                  type="text"
                  placeholder="Ej: OFICINA TECNICA"
                  value={habNombre}
                  onChange={(e) => setHabNombre(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
}

export default function TxtPage() {
  const { show, hide } = useLoading();
  const { showToast } = useToast();

  const [view, setView] = useState('buscador');
  const [viewAnterior, setViewAnterior] = useState('buscador');
  const [deps, setDeps] = useState([]);
  const [realizados, setRealizados] = useState([]);

  const [busqueda, setBusqueda] = useState('');
  const [debouncedBusqueda, setDebouncedBusqueda] = useState('');
  const [selectedResultId, setSelectedResultId] = useState(null);

  const [modalOrden, setModalOrden] = useState({ open: false, id: '', label: '' });
  const [modalAgregar, setModalAgregar] = useState({ open: false, preselectDepId: '' });

  const [nuevoForm, setNuevoForm] = useState(emptyTxtNuevoForm);
  const [nuevoRegistros, setNuevoRegistros] = useState([]);
  const [nuevoEditIndex, setNuevoEditIndex] = useState(-1);
  const [repeticiones, setRepeticiones] = useState('1');
  const [showDepSug, setShowDepSug] = useState(false);
  const [showHabSug, setShowHabSug] = useState(false);

  const importInputRef = useRef(null);
  const ordenUltimoPorHabitacion = useRef(Object.create(null));
  const ordenRemotoPorHabitacionId = useRef(Object.create(null));
  const ordenManualEdit = useRef(false);
  const ordenFetchToken = useRef(0);
  const syncingRef = useRef(false);

  const searchRows = useMemo(
    () => buildTxtSearchRows(deps, debouncedBusqueda),
    [deps, debouncedBusqueda]
  );

  const mainDepsNuevo = useMemo(() => getMainDeps(deps), [deps]);

  const depSugerenciasNuevo = useMemo(() => {
    const rawDep = String(nuevoForm.dependencia || '').trim();
    const rawDesc = String(nuevoForm.dependenciaDesc || '').trim();
    if (!rawDep && !rawDesc) return [];
    const qNormDep = normalizeKey(rawDep);
    const qNormDesc = normalizeKey(rawDesc);
    function matchesNeedle(d, qNorm) {
      if (!qNorm) return true;
      const codigo = normalizeKey(d?.codigo ?? '');
      const nombre = normalizeKey(d?.nombre ?? '');
      const combo = normalizeKey(`${d?.codigo ?? ''} ${d?.nombre ?? ''}`);
      return codigo.includes(qNorm) || nombre.includes(qNorm) || combo.includes(qNorm);
    }
    return mainDepsNuevo
      .filter((d) => {
        const okDep = !rawDep || matchesNeedle(d, qNormDep);
        const okDesc = !rawDesc || matchesNeedle(d, qNormDesc);
        return okDep && okDesc;
      })
      .slice(0, 12);
  }, [mainDepsNuevo, nuevoForm.dependencia, nuevoForm.dependenciaDesc]);

  const habSugerenciasNuevo = useMemo(() => {
    const rawNum = String(nuevoForm.habitacion || '').trim();
    const rawDesc = String(nuevoForm.habitacionDesc || '').trim();
    if (!rawNum && !rawDesc) return [];
    const qNormNum = normalizeKey(rawNum);
    const qNormDesc = normalizeKey(rawDesc);
    const depNum = onlyDigits(nuevoForm.dependencia);
    const selectedDep = depNum
      ? mainDepsNuevo.find((d) => onlyDigits(d.codigo || '') === depNum)
      : mainDepsNuevo.find((d) => normalizeKey(d.nombre || '') === normalizeKey(nuevoForm.dependenciaDesc));
    const divisions = selectedDep
      ? getDivisiones(deps, selectedDep.id)
      : deps.filter((d) => d?.parentId);
    function matchesNeedle(d, qNorm) {
      if (!qNorm) return true;
      const numero = normalizeKey(d?.numero ?? '');
      const nombre = normalizeKey(d?.nombre ?? '');
      const combo = normalizeKey(`${d?.numero ?? ''} ${d?.nombre ?? ''}`);
      return numero.includes(qNorm) || nombre.includes(qNorm) || combo.includes(qNorm);
    }
    return divisions
      .filter((d) => {
        const okNum = !rawNum || matchesNeedle(d, qNormNum);
        const okDesc = !rawDesc || matchesNeedle(d, qNormDesc);
        return okNum && okDesc;
      })
      .slice(0, 12);
  }, [deps, mainDepsNuevo, nuevoForm]);

  const loadDeps = useCallback(async (force = false) => {
    const api = getStockAPI();
    if (!api) return [];
    if (api.getTxtDependencias) {
      const list = await api.getTxtDependencias();
      const arr = Array.isArray(list) ? list : [];
      setDeps(arr);
      return arr;
    }
    if (api.getData) {
      const data = await api.getData();
      const arr = Array.isArray(data?.txtDependencias) ? data.txtDependencias : [];
      setDeps(arr);
      return arr;
    }
    setDeps([]);
    return [];
  }, []);

  const loadRealizados = useCallback(async () => {
    const api = getStockAPI();
    if (!api?.getTxtRealizados) {
      setRealizados([]);
      return [];
    }
    try {
      const rows = await api.getTxtRealizados();
      const arr = Array.isArray(rows) ? rows : [];
      setRealizados(arr);
      return arr;
    } catch (err) {
      console.error('[TXT] Error al cargar realizados:', err);
      setRealizados([]);
      return [];
    }
  }, []);

  const loadAll = useCallback(async () => {
    show('Cargando TXT…');
    try {
      await Promise.all([loadDeps(true), loadRealizados()]);
    } catch {
      showToast('Error al cargar datos TXT', 'error');
    } finally {
      hide();
    }
  }, [hide, loadDeps, loadRealizados, show, showToast]);

  useEffect(() => {
    loadAll();
    window._realtimeRefresh = (table) => {
      if (!table || table === 'txt_dependencias') loadDeps(true);
      if (!table || table === 'txt_realizados') loadRealizados();
    };
    return () => {
      if (window._realtimeRefresh) window._realtimeRefresh = undefined;
    };
  }, [loadAll, loadDeps, loadRealizados]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedBusqueda(busqueda.trim()), 250);
    return () => clearTimeout(t);
  }, [busqueda]);

  function getSelectedDepByForm(form = nuevoForm) {
    const depNum = onlyDigits(form.dependencia);
    const depName = normalizeKey(form.dependenciaDesc);
    const byNum = depNum ? mainDepsNuevo.find((d) => onlyDigits(d.codigo || '') === depNum) : null;
    if (byNum) return byNum;
    return depName ? mainDepsNuevo.find((d) => normalizeKey(d.nombre || '') === depName) : null;
  }

  function getSelectedHabitacionByForm(form = nuevoForm) {
    const habNum = onlyDigits(form.habitacion);
    const habName = normalizeKey(form.habitacionDesc);
    if (!habNum && !habName) return null;
    const dep = getSelectedDepByForm(form);
    const divisions = dep ? getDivisiones(deps, dep.id) : deps.filter((d) => d?.parentId);
    const byNum = habNum ? divisions.find((d) => onlyDigits(d.numero || '') === habNum) : null;
    if (byNum) return byNum;
    return habName ? divisions.find((d) => normalizeKey(d.nombre || '') === habName) : null;
  }

  function getOrdenScopeKeyFromForm(form = nuevoForm) {
    const hab = getSelectedHabitacionByForm(form);
    if (hab?.id) return `id:${String(hab.id)}`;
    return getOrdenScopeKeyFromValues(form.dependencia, form.habitacion, form.habitacionDesc);
  }

  function takeMaxOrdenForScope(scopeKey, ordenValue) {
    if (!scopeKey) return;
    const parsed = toOrderNumber(ordenValue);
    if (parsed == null) return;
    const current = ordenUltimoPorHabitacion.current[scopeKey];
    if (current == null || parsed > current) {
      ordenUltimoPorHabitacion.current[scopeKey] = parsed;
    }
  }

  function rebuildOrdenCache(regs = nuevoRegistros, realizadosList = realizados) {
    ordenUltimoPorHabitacion.current = Object.create(null);
    regs.forEach((r) => {
      const scope = getOrdenScopeKeyFromValues(r?.dependencia, r?.habitacion, r?.habitacionDesc);
      takeMaxOrdenForScope(scope, toOrderNumber(r?.orden));
    });
    realizadosList.forEach((modelo) => {
      const registros = Array.isArray(modelo?.registros) ? modelo.registros : [];
      registros.forEach((r) => {
        const scope = getOrdenScopeKeyFromValues(r?.dependencia, r?.habitacion, r?.habitacionDesc);
        takeMaxOrdenForScope(scope, toOrderNumber(r?.orden));
      });
    });
  }

  function suggestNextOrden(force = false, form = nuevoForm) {
    if (nuevoEditIndex >= 0) return;
    const scopeKey = getOrdenScopeKeyFromForm(form);
    if (!scopeKey) return;
    const currentRaw = String(form.orden || '').trim();
    if (!force && ordenManualEdit.current && currentRaw) return;
    let lastLocal = ordenUltimoPorHabitacion.current[scopeKey];
    let lastRemote = null;
    if (scopeKey.startsWith('id:')) {
      const habId = scopeKey.slice(3);
      if (habId && ordenRemotoPorHabitacionId.current[habId] != null) {
        lastRemote = ordenRemotoPorHabitacionId.current[habId];
      }
    }
    let last = lastLocal;
    if (lastRemote != null && (last == null || lastRemote > last)) last = lastRemote;
    const next = last == null ? 1 : last + 1;
    setNuevoForm((prev) => ({ ...prev, orden: String(next) }));
    ordenManualEdit.current = false;
  }

  const refreshRemoteOrden = useCallback((form = nuevoForm) => {
    const hab = getSelectedHabitacionByForm(form);
    const habId = hab?.id ? String(hab.id) : '';
    if (!habId) {
      suggestNextOrden(false, form);
      return;
    }
    const api = getStockAPI();
    if (!api?.getTxtOrdenCount) {
      suggestNextOrden(false, form);
      return;
    }
    const token = ++ordenFetchToken.current;
    api.getTxtOrdenCount(habId).then((n) => {
      if (token !== ordenFetchToken.current) return;
      const parsed = parseInt(n, 10);
      ordenRemotoPorHabitacionId.current[habId] = Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
      suggestNextOrden(false, form);
    }).catch(() => {
      if (token !== ordenFetchToken.current) return;
      suggestNextOrden(false, form);
    });
  }, [nuevoForm, nuevoEditIndex, deps, mainDepsNuevo]);

  function syncDependenciaFromNumero(form) {
    const depNum = onlyDigits(form.dependencia);
    if (!depNum) return form;
    const dep = mainDepsNuevo.find((d) => onlyDigits(d.codigo || '') === depNum);
    if (!dep) return form;
    return clampTxtNuevoItem({
      ...form,
      dependencia: String(dep.codigo || ''),
      dependenciaDesc: String(dep.nombre || '')
    });
  }

  function syncHabitacionFromNumero(form) {
    const habNum = onlyDigits(form.habitacion);
    if (!habNum) return form;
    const dep = getSelectedDepByForm(form);
    const divisions = dep ? getDivisiones(deps, dep.id) : deps.filter((d) => d?.parentId);
    const div = divisions.find((d) => onlyDigits(d.numero || '') === habNum);
    if (!div) return form;
    const next = {
      ...form,
      habitacion: String(div.numero || ''),
      habitacionDesc: String(div.nombre || '')
    };
    if (dep) {
      next.dependencia = String(dep.codigo || '');
      next.dependenciaDesc = String(dep.nombre || '');
    }
    return clampTxtNuevoItem(next);
  }

  function handleNuevoFieldChange(key, rawValue) {
    if (syncingRef.current) return;
    syncingRef.current = true;
    try {
      let next = clampTxtNuevoItem({ ...nuevoForm, [key]: rawValue });
      if (key === 'dependencia') next = syncDependenciaFromNumero(next);
      if (key === 'dependenciaDesc') {
        const depName = normalizeKey(rawValue);
        if (depName) {
          const dep = mainDepsNuevo.find((d) => normalizeKey(d.nombre || '') === depName);
          if (dep) {
            next = clampTxtNuevoItem({
              ...next,
              dependencia: String(dep.codigo || ''),
              dependenciaDesc: String(dep.nombre || '')
            });
          }
        }
      }
      if (key === 'habitacion') next = syncHabitacionFromNumero(next);
      if (key === 'habitacionDesc') {
        const habName = normalizeKey(rawValue);
        if (habName) {
          const dep = getSelectedDepByForm(next);
          const divisions = dep ? getDivisiones(deps, dep.id) : deps.filter((d) => d?.parentId);
          const div = divisions.find((d) => normalizeKey(d.nombre || '') === habName);
          if (div) {
            const parent = dep || deps.find((d) => d?.id === div.parentId);
            next = clampTxtNuevoItem({
              ...next,
              habitacion: String(div.numero || ''),
              habitacionDesc: String(div.nombre || ''),
              dependencia: parent ? String(parent.codigo || '') : next.dependencia,
              dependenciaDesc: parent ? String(parent.nombre || '') : next.dependenciaDesc
            });
          }
        }
      }
      if (key === 'orden') ordenManualEdit.current = true;
      setNuevoForm(next);
      if (key === 'habitacion' || key === 'habitacionDesc' || key === 'dependencia' || key === 'dependenciaDesc') {
        setTimeout(() => refreshRemoteOrden(next), 0);
      }
    } finally {
      syncingRef.current = false;
    }
  }

  function applyDepSuggestion(dep) {
    setNuevoForm(clampTxtNuevoItem({
      ...nuevoForm,
      dependencia: String(dep.codigo || ''),
      dependenciaDesc: String(dep.nombre || '')
    }));
    setShowDepSug(false);
  }

  function applyHabSuggestion(div) {
    const parent = deps.find((d) => d?.id === div.parentId);
    const next = clampTxtNuevoItem({
      ...nuevoForm,
      habitacion: String(div.numero || ''),
      habitacionDesc: String(div.nombre || ''),
      dependencia: parent ? String(parent.codigo || '') : nuevoForm.dependencia,
      dependenciaDesc: parent ? String(parent.nombre || '') : nuevoForm.dependenciaDesc
    });
    setNuevoForm(next);
    setShowHabSug(false);
    setTimeout(() => refreshRemoteOrden(next), 0);
  }

  function limpiarCamposNuevo() {
    setNuevoForm(emptyTxtNuevoForm());
    setRepeticiones('1');
    setNuevoEditIndex(-1);
    ordenManualEdit.current = false;
  }

  function resetNuevoCompleto() {
    setNuevoForm(emptyTxtNuevoForm());
    setNuevoRegistros([]);
    setRepeticiones('1');
    setNuevoEditIndex(-1);
    ordenManualEdit.current = false;
    ordenRemotoPorHabitacionId.current = Object.create(null);
    rebuildOrdenCache([], realizados);
  }

  function openNuevo(fromView) {
    if (fromView && fromView !== 'nuevo') setViewAnterior(fromView);
    setView('nuevo');
    rebuildOrdenCache(nuevoRegistros, realizados);
    ordenRemotoPorHabitacionId.current = Object.create(null);
    refreshRemoteOrden();
  }

  function closeNuevo() {
    setView(viewAnterior || 'buscador');
  }

  function pushNuevoRows(rows, opts = {}) {
    if (!rows?.length) return;
    if (nuevoEditIndex >= 0 && nuevoEditIndex < nuevoRegistros.length) {
      if (rows.length > 1) {
        showToast('Al editar solo se actualiza una fila. Usá «Agregar repetidas» para cargar varias.', 'error');
        return;
      }
      const next = [...nuevoRegistros];
      next[nuevoEditIndex] = rows[0];
      setNuevoRegistros(next);
      rows.forEach((row) => {
        const scope = getOrdenScopeKeyFromValues(row.dependencia, row.habitacion, row.habitacionDesc);
        takeMaxOrdenForScope(scope, toOrderNumber(row.orden));
      });
      showToast('Registro actualizado.', 'success');
    } else {
      setNuevoRegistros((prev) => [...prev, ...rows]);
      rows.forEach((row) => {
        const scope = getOrdenScopeKeyFromValues(row.dependencia, row.habitacion, row.habitacionDesc);
        takeMaxOrdenForScope(scope, toOrderNumber(row.orden));
      });
      showToast(opts.fromRepetidas
        ? `Se agregaron ${rows.length} filas repetidas a la grilla.`
        : 'Registro agregado a la grilla.', 'success');
    }
    limpiarCamposNuevo();
    refreshRemoteOrden();
  }

  function guardarFila() {
    const item = clampTxtNuevoItem(nuevoForm);
    const hasAnyValue = Object.keys(item).some((k) => item[k] !== '');
    if (!hasAnyValue) {
      showToast('Completa al menos un campo para agregar el registro.', 'error');
      return;
    }
    pushNuevoRows([item]);
  }

  function agregarRepetidas() {
    if (nuevoEditIndex >= 0) {
      showToast('Terminá la edición o cancelá antes de agregar repetidas.', 'error');
      return;
    }
    const item = clampTxtNuevoItem(nuevoForm);
    const hasAnyValue = Object.keys(item).some((k) => item[k] !== '');
    if (!hasAnyValue) {
      showToast('Completá los datos del registro antes de agregar repetidas.', 'error');
      return;
    }
    const rep = parseTxtNuevoRepeticiones(repeticiones);
    setRepeticiones(String(rep));
    const rows = expandTxtItemPorRepeticiones(item, rep);
    pushNuevoRows(rows, { fromRepetidas: true });
  }

  function editarRegistro(idx) {
    const row = nuevoRegistros[idx];
    if (!row) return;
    setNuevoEditIndex(idx);
    setNuevoForm(clampTxtNuevoItem({ ...row }));
    ordenManualEdit.current = false;
    showToast(`Editando registro #${idx + 1}`, 'success');
  }

  function eliminarRegistro(idx) {
    if (!window.confirm('¿Eliminar este registro de la grilla?')) return;
    setNuevoRegistros((prev) => prev.filter((_, i) => i !== idx));
    if (nuevoEditIndex === idx) limpiarCamposNuevo();
    else if (nuevoEditIndex > idx) setNuevoEditIndex((i) => i - 1);
    showToast('Registro eliminado.', 'success');
  }

  async function exportarTxtYWord(regs) {
    if (!regs?.length) {
      showToast('No hay registros cargados para exportar.', 'error');
      return { ok: false };
    }
    const api = getStockAPI();
    if (!api?.exportTxtNuevo) {
      showToast('Función de exportación no disponible.', 'error');
      return { ok: false };
    }
    if (!api.exportTxtNuevoWord) {
      showToast('Función de exportación Word no disponible.', 'error');
      return { ok: false };
    }
    const names = getTxtNuevoDefaultNames(regs);
    const resTxt = await api.exportTxtNuevo(regs, names.txt);
    if (resTxt?.cancelled) return { ok: false, cancelled: true };
    if (!resTxt?.ok) {
      showToast(`Error al exportar: ${resTxt?.error || 'desconocido'}`, 'error');
      return { ok: false };
    }
    const resWord = await api.exportTxtNuevoWord(regs, names.word);
    if (resWord?.cancelled) return { ok: false, cancelled: true };
    if (!resWord?.ok) {
      showToast(`Error al exportar Word: ${resWord?.error || 'desconocido'}`, 'error');
      return { ok: false };
    }
    return { ok: true };
  }

  async function registerTxtRealizado(regs, nombreBase) {
    const api = getStockAPI();
    if (!api?.saveTxtRealizado) {
      throw new Error('La función saveTxtRealizado no está disponible. Reinicia la app.');
    }
    const ahora = new Date().toISOString();
    const nombre = String(nombreBase || 'TXT EXPORTADO').trim() || 'TXT EXPORTADO';
    const payload = {
      id: `txt-realizado-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      nombre,
      registros: JSON.parse(JSON.stringify(regs)),
      createdAt: ahora,
      updatedAt: ahora
    };
    const res = await api.saveTxtRealizado(payload);
    await loadRealizados();
    return res || { ok: true };
  }

  async function handleFinalizado() {
    if (!nuevoRegistros.length) {
      showToast('No hay registros para guardar en Realizados.', 'error');
      return;
    }
    try {
      const exportRes = await exportarTxtYWord(nuevoRegistros);
      if (!exportRes?.ok) return;

      nuevoRegistros.forEach((r) => {
        const scope = getOrdenScopeKeyFromValues(r.dependencia, r.habitacion, r.habitacionDesc);
        takeMaxOrdenForScope(scope, toOrderNumber(r.orden));
        const hab = getSelectedHabitacionByForm(r);
        const habId = hab?.id ? String(hab.id) : '';
        if (habId && getStockAPI()?.saveTxtOrdenCount) {
          const parsed = toOrderNumber(r.orden);
          if (parsed != null) {
            getStockAPI().saveTxtOrdenCount(habId, parsed).catch(() => {});
          }
        }
      });

      let nombre = 'TXT-FINALIZADO';
      if (nuevoRegistros[0]) {
        const p = nuevoRegistros[0];
        const base = [p.reparticion || '0', p.dependencia || '0', p.habitacion || '0'].join('-');
        const now = new Date();
        const sello = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
        nombre = `${base}-finalizado-${sello}`;
      }

      const res = await registerTxtRealizado(nuevoRegistros, nombre);
      if (res?.storage === 'local') {
        showToast(res.warn || 'Guardado en Realizados en esta PC. Los archivos TXT/Word ya se exportaron.', 'success');
      } else {
        showToast('Guardado en Realizados. Los archivos TXT/Word ya se exportaron.', 'success');
      }
      closeNuevo();
    } catch (err) {
      const msg = err?.message ? String(err.message) : 'desconocido';
      if (msg.toLowerCase().includes('no handler registered')) {
        showToast('Error al guardar: falta actualizar/reiniciar la app en esta PC.', 'error');
        return;
      }
      if (isTxtRealizadosSchemaErrorMsg(msg)) {
        showToast(
          'Los archivos TXT/Word se exportaron. No se pudo guardar en Realizados en la nube; ejecutá supabase-txt-realizados.sql en Supabase o reiniciá la app.',
          'error'
        );
        return;
      }
      showToast(`Error al guardar en Realizados: ${msg}`, 'error');
    }
  }

  function openResultRow(row) {
    setSelectedResultId(row.id);
    setBusqueda(row.label);
    showToast(`Seleccionado: ${row.label}`, 'success');
    setModalOrden({ open: true, id: row.id, label: row.label });
  }

  async function handleImport(file) {
    if (!file) return;
    const fileName = String(file.name || '');
    const sizeKb = Math.round((file.size || 0) / 1024);
    if (!window.confirm(`Importar "${fileName}" (~${sizeKb} KB)? Esto cargará dependencias y divisiones en el TXT.`)) return;

    show('Importando dependencias…');
    try {
      const text = await readFileAsText(file);
      const ext = (fileName.split('.').pop() || '').toLowerCase();
      const parsed = ext === 'csv' ? parseDependenciasCsv(text) : parseDependenciasTxt(text);
      if (!parsed.records?.length) {
        showToast('No hay registros para importar.', 'error');
        return;
      }
      const skippedTxt = parsed.skipped > 0
        ? ` Se saltearon ${parsed.skipped} líneas.`
        : '';
      if (!window.confirm(`Se importarán ${parsed.depCount} dependencias y ${parsed.divCount} divisiones.${skippedTxt} ¿Continuar?`)) return;

      const api = getStockAPI();
      if (api?.importTxtDependencias) {
        await api.importTxtDependencias(parsed.records);
      } else if (api?.saveTxtDependencia) {
        for (const rec of parsed.records) {
          await api.saveTxtDependencia(rec);
        }
      } else {
        throw new Error('No hay función de importación disponible.');
      }
      await loadDeps(true);
      showToast(`Importación finalizada: ${parsed.depCount} dependencias / ${parsed.divCount} divisiones.`, 'success');
    } catch (err) {
      showToast(err?.message || 'Error al importar', 'error');
    } finally {
      hide();
    }
  }

  async function exportarModelo(modelo, tipo) {
    const regs = Array.isArray(modelo.registros)
      ? modelo.registros.map((r) => clampTxtNuevoItem(r))
      : [];
    if (!regs.length) {
      showToast('El TXT seleccionado no tiene registros.', 'error');
      return;
    }
    const api = getStockAPI();
    try {
      if (tipo === 'txt') {
        if (!api?.exportTxtNuevo) {
          showToast('Función de exportación no disponible.', 'error');
          return;
        }
        const res = await api.exportTxtNuevo(regs, modelo.nombre || 'txt-export');
        if (res?.ok) showToast('TXT exportado correctamente.', 'success');
        else if (!res?.cancelled) showToast('Error al exportar TXT.', 'error');
      } else {
        if (!api?.exportTxtNuevoWord) {
          showToast('Función de exportación Word no disponible.', 'error');
          return;
        }
        const res = await api.exportTxtNuevoWord(regs, modelo.nombre || 'txt-modelo');
        if (res?.ok) showToast('Word exportado correctamente.', 'success');
        else if (!res?.cancelled) showToast('Error al exportar Word.', 'error');
      }
    } catch {
      showToast(`Error al exportar ${tipo === 'txt' ? 'TXT' : 'Word'}.`, 'error');
    }
  }

  async function eliminarModelo(modelId) {
    if (!window.confirm('¿Eliminar este TXT realizado?')) return;
    const api = getStockAPI();
    if (!api?.deleteTxtRealizado) return;
    try {
      await api.deleteTxtRealizado(modelId);
      await loadRealizados();
      showToast('TXT eliminado.', 'success');
    } catch (err) {
      showToast(`Error al eliminar: ${err?.message || 'desconocido'}`, 'error');
    }
  }

  function verModelo(modelo) {
    const rawRegs = Array.isArray(modelo.registros)
      ? JSON.parse(JSON.stringify(modelo.registros))
      : [];
    setNuevoRegistros(rawRegs.map((r) => clampTxtNuevoItem(r)));
    setNuevoEditIndex(-1);
    setViewAnterior('realizados');
    setView('nuevo');
    rebuildOrdenCache(rawRegs, realizados);
    showToast(`TXT cargado: ${modelo.nombre || ''}`, 'success');
  }

  const M = TXT_NUEVO_FIELD_MAX;
  const guardarFilaLabel = nuevoEditIndex >= 0 ? 'Actualizar' : 'Guardar fila';

  return (
    <div className="content-panel">
      <div className="panel-header">
        <h2 className="page-title">
          TXT <span className="txt-build-badge" title="Versión React">· React</span>
        </h2>
        <button
          type="button"
          className={`btn ${view === 'buscador' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setView('buscador')}
        >
          Buscador
        </button>
        <button
          type="button"
          className={`btn ${view === 'realizados' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => { loadRealizados(); setView('realizados'); }}
        >
          Realizados
        </button>
        <button
          type="button"
          className={`btn ${view === 'nuevo' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => openNuevo('buscador')}
        >
          Nuevo registro
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => { resetNuevoCompleto(); openNuevo('buscador'); }}
        >
          Nuevo
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => importInputRef.current?.click()}
        >
          Importar TXT/CSV
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setModalAgregar({ open: true, preselectDepId: '' })}
        >
          + Agregar
        </button>
      </div>

      {view !== 'nuevo' && (
        <>
          <p className="panel-desc">
            Buscador de dependencias y habitaciones del módulo <strong>TXT</strong> (tabla propia, separada de <strong>Dependencias</strong> del menú). Importá TXT/CSV con columnas: <strong>codigo</strong>, <strong>nombre</strong>, <strong>numero</strong>, <strong>nombre división</strong>.
          </p>
          <p className="panel-desc txt-hint-agregar-habitacion">
            <strong>Agregar habitación:</strong> botón verde <strong>+ Habitación</strong> en cada dependencia TXT, o <strong>+ Agregar</strong>. Lo cargado en <strong>Dependencias</strong> (entregas) no aparece acá.
          </p>
        </>
      )}

      <input
        ref={importInputRef}
        type="file"
        accept=".txt,.csv,text/plain"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          handleImport(file);
          e.target.value = '';
        }}
      />

      {view === 'buscador' && (
        <div id="txt-seccion-buscador" style={{ marginTop: '1rem' }}>
          <div className="txt-search-bar" role="search">
            <span className="txt-search-icon" aria-hidden="true">🔍</span>
            <input
              type="search"
              placeholder="Buscar dependencia o división..."
              autoComplete="off"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            {busqueda && (
              <button
                type="button"
                className="txt-search-clear"
                aria-label="Limpiar búsqueda"
                onClick={() => { setBusqueda(''); setDebouncedBusqueda(''); }}
              >
                &times;
              </button>
            )}
          </div>

          <div className={`txt-resultados${!searchRows.length ? ' empty-state' : ''}`} style={{ marginTop: '0.75rem' }}>
            {!debouncedBusqueda && !searchRows.length && deps.length === 0 && (
              <p style={{ textAlign: 'center', margin: 0 }}>
                No hay dependencias cargadas. Importá un archivo TXT/CSV o agregá manualmente.
              </p>
            )}
            {!debouncedBusqueda && searchRows.length > 0 && (
              <div className="txt-results-wrapper">
                <div style={{ textAlign: 'center', marginBottom: '0.75rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Mostrando todas las dependencias y divisiones ({searchRows.length})
                </div>
                {searchRows.map((row) => (
                  row.type === 'main' ? (
                    <div key={row.id} className="txt-result-line txt-result-main txt-result-main-row">
                      <div
                        className={`txt-result-selectable${selectedResultId === row.id ? ' txt-result-selected' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => openResultRow(row)}
                        onKeyDown={(e) => { if (e.key === 'Enter') openResultRow(row); }}
                      >
                        <span className="txt-result-arrow" aria-hidden="true">▶</span>
                        <strong>{row.label}</strong>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary txt-btn-add-habitacion"
                        title="Agregar habitación a esta dependencia"
                        onClick={(e) => {
                          e.stopPropagation();
                          setModalAgregar({ open: true, preselectDepId: row.id });
                        }}
                      >
                        + Habitación
                      </button>
                    </div>
                  ) : (
                    <div
                      key={row.id}
                      className={`txt-result-line txt-result-division txt-result-selectable${selectedResultId === row.id ? ' txt-result-selected' : ''}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => openResultRow(row)}
                      onKeyDown={(e) => { if (e.key === 'Enter') openResultRow(row); }}
                    >
                      <span className="txt-result-indent" aria-hidden="true" />
                      <span className="txt-result-dot" aria-hidden="true">•</span>
                      <span>{row.label}</span>
                    </div>
                  )
                ))}
              </div>
            )}
            {debouncedBusqueda && !searchRows.length && (
              <p style={{ textAlign: 'center', margin: 0 }}>
                {`No se encontraron dependencias ni divisiones para "${debouncedBusqueda}".`}
              </p>
            )}
            {debouncedBusqueda && searchRows.length > 0 && (
              <div className="txt-results-wrapper">
                <div style={{ textAlign: 'center', marginBottom: '0.75rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Coincidencias para: <strong>{debouncedBusqueda}</strong>
                </div>
                {searchRows.map((row) => (
                  row.type === 'main' ? (
                    <div key={row.id} className="txt-result-line txt-result-main txt-result-main-row">
                      <div
                        className={`txt-result-selectable${selectedResultId === row.id ? ' txt-result-selected' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => openResultRow(row)}
                        onKeyDown={(e) => { if (e.key === 'Enter') openResultRow(row); }}
                      >
                        <span className="txt-result-arrow" aria-hidden="true">▶</span>
                        <strong>{row.label}</strong>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary txt-btn-add-habitacion"
                        title="Agregar habitación a esta dependencia"
                        onClick={(e) => {
                          e.stopPropagation();
                          setModalAgregar({ open: true, preselectDepId: row.id });
                        }}
                      >
                        + Habitación
                      </button>
                    </div>
                  ) : (
                    <div
                      key={row.id}
                      className={`txt-result-line txt-result-division txt-result-selectable${selectedResultId === row.id ? ' txt-result-selected' : ''}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => openResultRow(row)}
                      onKeyDown={(e) => { if (e.key === 'Enter') openResultRow(row); }}
                    >
                      <span className="txt-result-indent" aria-hidden="true" />
                      <span className="txt-result-dot" aria-hidden="true">•</span>
                      <span>{row.label}</span>
                    </div>
                  )
                ))}
              </div>
            )}
            {!debouncedBusqueda && !searchRows.length && deps.length > 0 && (
              <p style={{ textAlign: 'center', margin: 0 }}>
                Escribí en la lupa para buscar dependencias y divisiones.
              </p>
            )}
          </div>
        </div>
      )}

      {view === 'realizados' && (
        <div className="table-wrap txt-realizados-wrap" style={{ marginTop: '1.25rem' }}>
          <div className="txt-realizados-head">
            <h3>Realizados</h3>
            <span className="txt-realizados-count">{realizados.length}</span>
          </div>
          <table className="data-table txt-realizados-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Registros</th>
                <th>Última modificación</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {!realizados.length ? (
                <tr>
                  <td colSpan={4} className="txt-realizados-empty">Todavía no hay TXT realizados.</td>
                </tr>
              ) : realizados.map((modelo) => (
                <tr key={modelo.id}>
                  <td className="txt-realizados-name-cell">{modelo.nombre || 'SIN NOMBRE'}</td>
                  <td>
                    <span className="txt-realizados-badge">
                      {Array.isArray(modelo.registros) ? modelo.registros.length : 0}
                    </span>
                  </td>
                  <td className="txt-realizados-date-cell">{formatFechaHoraIso(modelo.updatedAt)}</td>
                  <td className="txt-realizados-actions">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => verModelo(modelo)}>Ver</button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => exportarModelo(modelo, 'txt')}>TXT</button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => exportarModelo(modelo, 'word')}>Word</button>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => eliminarModelo(modelo.id)}>Borrar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === 'nuevo' && (
        <section id="txt-seccion-nuevo" className="txt-seccion-nuevo" aria-label="Nuevo registro TXT">
          <div className="txt-nuevo-page">
            <div className="txt-nuevo-page-head">
              <h3 className="txt-nuevo-page-title">Nuevo registro TXT</h3>
              <button type="button" className="btn btn-secondary btn-sm txt-nuevo-volver" onClick={closeNuevo}>← Volver</button>
            </div>

            <div className="txt-nuevo-page-body">
              <div className="txt-nuevo-form-panel">
                <div className="txt-nuevo-grid txt-nuevo-grid-ubicacion">
                  <div className="form-group">
                    <label htmlFor="txt-nuevo-reparticion">Repartición</label>
                    <input
                      id="txt-nuevo-reparticion"
                      type="text"
                      maxLength={M.reparticion}
                      value={nuevoForm.reparticion || TXT_REPARTICION_DEFAULT_NUMERO}
                      onChange={(e) => handleNuevoFieldChange('reparticion', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="txt-nuevo-reparticion-desc">Desc. repartición</label>
                    <input
                      id="txt-nuevo-reparticion-desc"
                      type="text"
                      maxLength={M.reparticionDesc}
                      value={nuevoForm.reparticionDesc || TXT_REPARTICION_DEFAULT_NOMBRE}
                      onChange={(e) => handleNuevoFieldChange('reparticionDesc', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="txt-nuevo-dependencia">Dependencia</label>
                    <input
                      id="txt-nuevo-dependencia"
                      type="text"
                      maxLength={M.dependencia}
                      inputMode="numeric"
                      value={nuevoForm.dependencia}
                      onChange={(e) => handleNuevoFieldChange('dependencia', e.target.value)}
                      onFocus={() => setShowDepSug(true)}
                    />
                  </div>
                  <div className="form-group txt-nuevo-search-wrap">
                    <label htmlFor="txt-nuevo-dependencia-desc">Desc. dependencia</label>
                    <input
                      id="txt-nuevo-dependencia-desc"
                      type="text"
                      maxLength={M.dependenciaDesc}
                      value={nuevoForm.dependenciaDesc}
                      onChange={(e) => handleNuevoFieldChange('dependenciaDesc', e.target.value)}
                      onFocus={() => setShowDepSug(true)}
                    />
                    {showDepSug && depSugerenciasNuevo.length > 0 && (
                      <div className="txt-nuevo-sugerencias">
                        {depSugerenciasNuevo.map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            className="txt-nuevo-sug-item"
                            onClick={() => applyDepSuggestion(d)}
                          >
                            <span className="txt-nuevo-sug-codigo">{d.codigo}</span>
                            <span className="txt-nuevo-sug-sep"> - </span>
                            <span className="txt-nuevo-sug-nombre">{d.nombre}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="form-group">
                    <label htmlFor="txt-nuevo-habitacion">Habitación</label>
                    <input
                      id="txt-nuevo-habitacion"
                      type="text"
                      maxLength={M.habitacion}
                      inputMode="numeric"
                      value={nuevoForm.habitacion}
                      onChange={(e) => handleNuevoFieldChange('habitacion', e.target.value)}
                      onFocus={() => setShowHabSug(true)}
                    />
                  </div>
                  <div className="form-group txt-nuevo-search-wrap">
                    <label htmlFor="txt-nuevo-habitacion-desc">Desc. habitación</label>
                    <input
                      id="txt-nuevo-habitacion-desc"
                      type="text"
                      maxLength={M.habitacionDesc}
                      value={nuevoForm.habitacionDesc}
                      onChange={(e) => handleNuevoFieldChange('habitacionDesc', e.target.value)}
                      onFocus={() => setShowHabSug(true)}
                    />
                    {showHabSug && habSugerenciasNuevo.length > 0 && (
                      <div className="txt-nuevo-sugerencias">
                        {habSugerenciasNuevo.map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            className="txt-nuevo-sug-item"
                            onClick={() => applyHabSuggestion(d)}
                          >
                            <span className="txt-nuevo-sug-codigo">{d.numero}</span>
                            <span className="txt-nuevo-sug-sep"> - </span>
                            <span className="txt-nuevo-sug-nombre">{d.nombre}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="txt-nuevo-grid txt-nuevo-grid-datos">
                  {[
                    { key: 'cuenta', label: 'Cuenta', max: M.cuenta },
                    { key: 'especie', label: 'Especie', max: M.especie, numeric: true },
                    { key: 'motivo', label: 'Motivo', max: M.motivo, numeric: true },
                    { key: 'estado', label: 'Estado', max: M.estado },
                    { key: 'cantidad', label: 'Cantidad', max: M.cantidad, numeric: true },
                    { key: 'orden', label: 'Orden', max: M.orden, numeric: true },
                    { key: 'valor', label: 'Valor', max: 14 },
                    { key: 'mes', label: 'Mes', max: M.mes, numeric: true },
                    { key: 'anio', label: 'Año', max: M.anio, numeric: true }
                  ].map((f) => (
                    <div key={f.key} className="form-group">
                      <label htmlFor={`txt-nuevo-${f.key}`}>{f.label}</label>
                      <input
                        id={`txt-nuevo-${f.key}`}
                        type="text"
                        maxLength={f.max}
                        inputMode={f.numeric ? 'numeric' : undefined}
                        value={nuevoForm[f.key]}
                        onChange={(e) => handleNuevoFieldChange(f.key, e.target.value)}
                      />
                    </div>
                  ))}
                  <div className="form-group txt-nuevo-desc-field">
                    <label htmlFor="txt-nuevo-descripcion">Descripción del bien</label>
                    <input
                      id="txt-nuevo-descripcion"
                      type="text"
                      maxLength={M.descripcion}
                      value={nuevoForm.descripcion}
                      onChange={(e) => handleNuevoFieldChange('descripcion', e.target.value.toUpperCase())}
                    />
                  </div>
                </div>

                <div className="txt-nuevo-repeticiones-row" role="group" aria-label="Líneas repetidas">
                  <div className="form-group txt-nuevo-repeticiones-field">
                    <label htmlFor="txt-nuevo-repeticiones">Líneas repetidas</label>
                    <input
                      id="txt-nuevo-repeticiones"
                      type="text"
                      inputMode="numeric"
                      maxLength={3}
                      value={repeticiones}
                      onChange={(e) => setRepeticiones(e.target.value.replace(/[^\d]/g, '').slice(0, 3))}
                      onBlur={() => {
                        const trimmed = String(repeticiones || '').trim();
                        setRepeticiones(trimmed ? String(parseTxtNuevoRepeticiones(trimmed)) : '1');
                      }}
                    />
                  </div>
                  <button type="button" className="btn btn-secondary" onClick={agregarRepetidas}>Agregar repetidas</button>
                  <button type="button" className="btn btn-primary" onClick={guardarFila}>{guardarFilaLabel}</button>
                  <p className="txt-nuevo-repeticiones-hint">
                    <strong>Cantidad</strong> = valor por fila. <strong>Repetidas</strong> = cuántas filas iguales (solo cambia el orden).
                  </p>
                </div>
              </div>

              <div className="table-wrap txt-nuevo-tabla-wrap">
                <table className="data-table txt-nuevo-tabla">
                  <thead>
                    <tr>
                      {TXT_NUEVO_COLUMNS.map((col) => (
                        <th key={col.key}>{col.label}</th>
                      ))}
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!nuevoRegistros.length ? (
                      <tr className="txt-nuevo-empty-row">
                        <td colSpan={TXT_NUEVO_COLUMNS.length + 1}>Todavía no hay registros cargados.</td>
                      </tr>
                    ) : nuevoRegistros.map((r, idx) => (
                      <tr key={idx}>
                        {TXT_NUEVO_COLUMNS.map((col) => (
                          <td key={col.key}>{r[col.key]}</td>
                        ))}
                        <td className="txt-nuevo-actions-col">
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => editarRegistro(idx)}>Editar</button>
                          <button type="button" className="btn btn-danger btn-sm" onClick={() => eliminarRegistro(idx)}>Eliminar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="txt-nuevo-page-actions">
              <button type="button" className="btn btn-primary" onClick={handleFinalizado}>Finalizado</button>
              <button type="button" className="btn btn-secondary txt-nuevo-volver" onClick={closeNuevo}>Cerrar</button>
            </div>
          </div>
        </section>
      )}

      <ModalTxtOrden
        open={modalOrden.open}
        ordenId={modalOrden.id}
        ordenLabel={modalOrden.label}
        onClose={() => setModalOrden({ open: false, id: '', label: '' })}
        showToast={showToast}
      />

      <ModalTxtAgregar
        open={modalAgregar.open}
        preselectDepId={modalAgregar.preselectDepId}
        deps={deps}
        onClose={() => setModalAgregar({ open: false, preselectDepId: '' })}
        onSaved={() => loadDeps(true)}
        showToast={showToast}
      />
    </div>
  );
}
