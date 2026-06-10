import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLoading } from '../contexts/LoadingContext';
import { useToast } from '../contexts/ToastContext';
import { getStockAPI } from '../hooks/useStockAPI';
import {
  buildEnviosData,
  buildTableRows,
  getDisplayLabel,
  getMainDeps,
  isTxtItem,
  parseDependenciasCsvImport,
  parseDependenciasTxtImport,
  readFileAsText,
  slugify
} from '../utils/dependenciasHelpers';

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

function DivisionesNuevaList({ items, onChange, disabled }) {
  if (!items.length) return null;

  function removeDiv(idx) {
    onChange(items.filter((_, i) => i !== idx));
  }

  function removeSub(divIdx, subIdx) {
    const next = items.map((d, i) => {
      if (i !== divIdx) return d;
      const subs = [...(d.subDivisiones || [])];
      subs.splice(subIdx, 1);
      return { ...d, subDivisiones: subs };
    });
    onChange(next);
  }

  function addSub(divIdx, numero, nombre) {
    const next = items.map((d, i) => {
      if (i !== divIdx) return d;
      const subs = [...(d.subDivisiones || []), { numero, nombre }];
      return { ...d, subDivisiones: subs };
    });
    onChange(next);
  }

  return (
    <ul className="lista-divisiones-nueva">
      {items.map((item, idx) => {
        const num = (item.numero || '').toString().trim();
        const nom = (item.nombre || '').toString().trim();
        const texto = num ? `${num} - ${nom}` : nom;
        const subDivs = item.subDivisiones || [];
        return (
          <li key={idx} className="division-nueva-item">
            <div className="division-nueva-top">
              <span className="division-nueva-text">{texto}</span>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                disabled={disabled}
                onClick={() => removeDiv(idx)}
              >
                Quitar
              </button>
            </div>
            <SubDivisionForm
              disabled={disabled}
              onAdd={(numero, nombre) => addSub(idx, numero, nombre)}
            />
            {subDivs.length > 0 && (
              <ul className="lista-subdivisiones-nueva">
                {subDivs.map((sd, sidx) => {
                  const sn = (sd.numero || '').toString().trim();
                  const sNombre = (sd.nombre || '').toString().trim();
                  const sTexto = sn ? `${sn} - ${sNombre}` : sNombre;
                  return (
                    <li key={sidx} className="subdiv-nueva-item">
                      <span>{sTexto}</span>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={disabled}
                        onClick={() => removeSub(idx, sidx)}
                      >
                        Quitar
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function SubDivisionForm({ onAdd, disabled }) {
  const [nombre, setNombre] = useState('');
  const [numero, setNumero] = useState('');

  function handleAdd() {
    const n = nombre.trim().toUpperCase();
    if (!n) return;
    onAdd(numero.trim(), n);
    setNombre('');
    setNumero('');
  }

  return (
    <div className="subdiv-nueva-form">
      <div className="subdiv-nueva-row">
        <input
          type="text"
          className="subdiv-nueva-nombre"
          placeholder="Nombre sub-división"
          value={nombre}
          disabled={disabled}
          onChange={(e) => setNombre(e.target.value.toUpperCase())}
        />
        <input
          type="text"
          className="subdiv-nueva-numero"
          placeholder="1"
          inputMode="numeric"
          value={numero}
          disabled={disabled}
          onChange={(e) => setNumero(e.target.value)}
        />
        <button type="button" className="btn btn-secondary btn-sm" disabled={disabled} onClick={handleAdd}>
          + Agregar sub división
        </button>
      </div>
    </div>
  );
}

export default function DependenciasPage() {
  const { isAdmin } = useAuth();
  const { show, hide } = useLoading();
  const { showToast } = useToast();
  const importInputRef = useRef(null);

  const [deps, setDeps] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [expandedDepIds, setExpandedDepIds] = useState({});
  const [openMenuId, setOpenMenuId] = useState(null);

  const [editFormOpen, setEditFormOpen] = useState(false);
  const [editId, setEditId] = useState('');
  const [editNombre, setEditNombre] = useState('');
  const [editCodigo, setEditCodigo] = useState('');
  const [editParentId, setEditParentId] = useState('');
  const [editNumero, setEditNumero] = useState('');

  const [modalAgregarOpen, setModalAgregarOpen] = useState(false);
  const [modalAgregarParentId, setModalAgregarParentId] = useState('');
  const [nuevaDepNombre, setNuevaDepNombre] = useState('');
  const [nuevaDepCodigo, setNuevaDepCodigo] = useState('');
  const [divisionNumero, setDivisionNumero] = useState('');
  const [divisionNombre, setDivisionNombre] = useState('');
  const [divisionesNueva, setDivisionesNueva] = useState([]);

  const [modalEnviosOpen, setModalEnviosOpen] = useState(false);
  const [enviosData, setEnviosData] = useState(null);

  const isDivisionEdit = !!editParentId;
  const mainDeps = getMainDeps(deps);
  const tableRows = buildTableRows(deps, busqueda, expandedDepIds);
  const sinCoincidencias = deps.length > 0 && busqueda.trim() && tableRows.length === 0;

  const loadStatsData = useCallback(async () => {
    const api = getStockAPI();
    if (!api) return statsData;
    try {
      let data;
      if (api.getDependenciasStatsData) {
        data = await api.getDependenciasStatsData();
      } else if (api.getData) {
        data = await api.getData();
      }
      if (data) {
        return {
          productos: data.productos || [],
          movimientos: data.movimientos || [],
          guardiaProvisiones: data.guardiaProvisiones || []
        };
      }
    } catch {
      /* ignore */
    }
    return { productos: [], movimientos: [], guardiaProvisiones: [] };
  }, []);

  const loadDeps = useCallback(async () => {
    const api = getStockAPI();
    if (!api?.getDependencias) return [];
    let list = await api.getDependencias();
    list = (list || []).filter((d) => !isTxtItem(d));

    if (!window.__depsNombresNormalizedOnce) {
      window.__depsNombresNormalizedOnce = true;
      const needs = list.some(
        (d) => d && typeof d.nombre === 'string' && d.nombre && d.nombre !== d.nombre.toUpperCase()
      );
      if (needs && api.normalizeDependenciasNombres) {
        try {
          await api.normalizeDependenciasNombres();
          list = await api.getDependencias();
          list = (list || []).filter((d) => !isTxtItem(d));
        } catch {
          /* ignore */
        }
      }
    }
    return list;
  }, []);

  const refresh = useCallback(async () => {
    show('Cargando dependencias…');
    try {
      await loadStatsData();
      const list = await loadDeps();
      setDeps(list);
    } catch {
      showToast('Error al cargar dependencias', 'error');
    } finally {
      hide();
    }
  }, [hide, loadDeps, loadStatsData, show, showToast]);

  useEffect(() => {
    refresh();
    window._realtimeRefresh = (table) => {
      if (!table || table === 'dependencias') refresh();
    };
    return () => {
      if (window._realtimeRefresh) window._realtimeRefresh = undefined;
    };
  }, [refresh]);

  useEffect(() => {
    if (!openMenuId) return undefined;
    const close = () => setOpenMenuId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openMenuId]);

  function toggleExpand(id) {
    setExpandedDepIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function startEdit(dep) {
    setEditId(dep.id);
    setEditNombre(dep.nombre || '');
    setEditCodigo((dep.codigo || '').toString());
    setEditNumero((dep.numero || '').toString());
    setEditParentId(dep.parentId || '');
    setEditFormOpen(true);
    setOpenMenuId(null);
  }

  async function handleDelete(id) {
    if (!confirm('¿Seguro que quiere eliminar esta dependencia?')) return;
    const api = getStockAPI();
    show('Eliminando…');
    try {
      await api.deleteDependencia(id);
      showToast('Dependencia eliminada');
      await refresh();
    } catch {
      showToast('Error al eliminar', 'error');
    } finally {
      hide();
    }
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    const nombre = editNombre.trim().toUpperCase();
    const parentId = editParentId || null;
    const codigo = editCodigo.trim();

    if (!nombre) {
      showToast('Escribe un nombre', 'error');
      return;
    }
    if (!parentId && !codigo) {
      showToast('Las dependencias principales deben tener un código (ej. 144)', 'error');
      return;
    }

    let payload = { id: editId || undefined, nombre, parentId };
    if (parentId) {
      const parent = deps.find((d) => d.id === parentId);
      payload = {
        ...payload,
        codigo: parent ? (parent.codigo || '').toString() : '',
        numero: editNumero.trim()
      };
    } else {
      payload = { ...payload, codigo, numero: '' };
    }

    const api = getStockAPI();
    show('Guardando…');
    try {
      await api.saveDependencia(payload);
      showToast(editId ? 'Dependencia actualizada' : 'Dependencia creada');
      setEditFormOpen(false);
      resetEditForm();
      await refresh();
    } catch {
      showToast('Error al guardar', 'error');
    } finally {
      hide();
    }
  }

  function resetEditForm() {
    setEditId('');
    setEditNombre('');
    setEditCodigo('');
    setEditParentId('');
    setEditNumero('');
  }

  function openAgregarModal(parentId = '') {
    setModalAgregarParentId(parentId);
    setNuevaDepNombre('');
    setNuevaDepCodigo('');
    setDivisionNumero('');
    setDivisionNombre('');
    setDivisionesNueva([]);
    if (parentId) {
      const parent = deps.find((d) => d.id === parentId);
      if (parent) {
        setNuevaDepNombre(parent.nombre || '');
        setNuevaDepCodigo((parent.codigo || '').toString());
      }
    }
    setModalAgregarOpen(true);
  }

  function openAgregarDivisiones(parentId) {
    openAgregarModal(parentId);
  }

  function agregarDivisionALista() {
    const numero = divisionNumero.trim();
    const nombre = divisionNombre.trim().toUpperCase();
    if (!nombre) {
      showToast('Escribe el nombre de la división', 'error');
      return;
    }
    setDivisionesNueva((prev) => [...prev, { numero: numero || '', nombre, subDivisiones: [] }]);
    setDivisionNumero('');
    setDivisionNombre('');
  }

  async function saveDivisionesToParent(parentId, items, parentCodigo) {
    const api = getStockAPI();
    const baseTs = Date.now().toString();
    for (let i = 0; i < items.length; i++) {
      const div = items[i];
      const divNombre = (div?.nombre || '').toString().trim().toUpperCase();
      if (!divNombre) continue;
      const divNumero = div?.numero != null ? String(div.numero).trim() : '';
      const divId = `${parentId}-d${baseTs}-${i}`;
      await api.saveDependencia({
        id: divId,
        nombre: divNombre,
        codigo: parentCodigo,
        parentId,
        numero: divNumero
      });
      const subDivs = div.subDivisiones || [];
      for (let j = 0; j < subDivs.length; j++) {
        const sd = subDivs[j];
        const sdNombre = (sd?.nombre || '').toString().trim().toUpperCase();
        if (!sdNombre) continue;
        await api.saveDependencia({
          id: `${divId}-sd${j}`,
          nombre: sdNombre,
          codigo: parentCodigo,
          parentId: divId,
          numero: sd?.numero != null ? String(sd.numero).trim() : ''
        });
      }
    }
  }

  async function handleAgregarSubmit(e) {
    e.preventDefault();
    const nombre = nuevaDepNombre.trim().toUpperCase();
    const codigo = nuevaDepCodigo.trim();
    const codigoDigits = (codigo || '').replace(/[^\d]/g, '');
    const parentIdForMode = modalAgregarParentId.trim();

    if (!nombre) {
      showToast('Escribe el nombre de la dependencia', 'error');
      return;
    }

    const api = getStockAPI();
    show(parentIdForMode ? 'Guardando divisiones…' : 'Guardando dependencia…');
    try {
      if (parentIdForMode) {
        if (!divisionesNueva.length) {
          showToast('Primero agregá al menos una división a la lista', 'error');
          return;
        }
        const parent = deps.find((d) => d.id === parentIdForMode);
        if (!parent) {
          showToast('No se encontró la dependencia seleccionada', 'error');
          return;
        }
        await saveDivisionesToParent(parentIdForMode, divisionesNueva, (parent.codigo || '').toString().trim());
        showToast('Divisiones agregadas correctamente');
      } else {
        const slugNombre = slugify(nombre) || 'dependencia';
        const mainId = codigoDigits ? `dep-${codigoDigits}` : `dep-${slugNombre}-${Date.now()}`;
        await api.saveDependencia({ id: mainId, nombre, codigo: codigoDigits || '', parentId: null });
        await saveDivisionesToParent(mainId, divisionesNueva, codigoDigits || '');
        showToast(
          divisionesNueva.length
            ? `Dependencia creada con ${divisionesNueva.length} división(es)`
            : 'Dependencia creada (sin divisiones)'
        );
      }
      setModalAgregarOpen(false);
      await refresh();
    } catch {
      showToast('Error al guardar', 'error');
    } finally {
      hide();
    }
  }

  async function openEnvios(dep) {
    show('Cargando envíos…');
    try {
      const cached = await loadStatsData();
      const data = buildEnviosData(dep, deps, cached);
      setEnviosData(data);
      setModalEnviosOpen(true);
    } finally {
      hide();
    }
  }

  async function handleImport(file) {
    if (!file) return;
    const fileName = (file.name || '').toString();
    const ext = (fileName.split('.').pop() || '').toLowerCase();
    if (ext !== 'csv' && ext !== 'txt') {
      showToast('Formato no soportado. Usa .csv o .txt', 'error');
      return;
    }
    if (!confirm(`Importar "${fileName}" en la pestaña Dependencias? Esto NO afecta la pestaña TXT.`)) return;

    show('Leyendo archivo…');
    try {
      const text = await readFileAsText(file);
      const rows = ext === 'csv' ? parseDependenciasCsvImport(text) : parseDependenciasTxtImport(text);
      if (!rows.length) {
        showToast('No se encontraron registros para importar.', 'error');
        return;
      }
      if (!confirm(`Se importarán ${rows.length} registros en Dependencias. ¿Continuar?`)) return;

      show('Importando dependencias…');
      const api = getStockAPI();
      if (api.importDependencias) {
        await api.importDependencias(rows);
      } else {
        for (const row of rows) {
          await api.saveDependencia(row);
        }
      }
      showToast(`Importación completada: ${rows.length} registros.`);
      await refresh();
    } catch {
      showToast('Error al importar estructura', 'error');
    } finally {
      hide();
    }
  }

  function renderAcciones(dep) {
    return (
      <>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => openEnvios(dep)}
        >
          Ver envíos
        </button>
        {isAdmin && (
          <>
            {' '}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => openAgregarDivisiones(dep.id)}
            >
              + División
            </button>
            {' '}
            <div className="dep-acciones-wrap">
              <button
                type="button"
                className="btn btn-icon btn-menu-dep"
                aria-label="Más acciones"
                title="Acciones"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenMenuId((cur) => (cur === dep.id ? null : dep.id));
                }}
              >
                &#8942;
              </button>
              <div className={`dep-menu-dropdown${openMenuId === dep.id ? ' dep-menu-open' : ''}`}>
                <button type="button" className="dep-menu-editar" onClick={() => startEdit(dep)}>Editar</button>
                <button type="button" className="dep-menu-eliminar" onClick={() => handleDelete(dep.id)}>Eliminar</button>
              </div>
            </div>
          </>
        )}
      </>
    );
  }

  return (
    <div className="content-panel">
      <div className="panel-header">
        <h2 className="page-title">Gestión de dependencias</h2>
        {isAdmin && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => importInputRef.current?.click()}
            >
              Importar estructura
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".csv,.txt"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImport(file);
                e.target.value = '';
              }}
            />
            <button type="button" className="btn btn-primary" onClick={() => openAgregarModal('')}>
              + Agregar dependencia
            </button>
          </div>
        )}
      </div>
      <p className="panel-desc">
        Destinos o áreas con número de identificación (ej. 144). Puedes crear divisiones dentro de cada dependencia (ej. 144 - División 1).
      </p>

      {editFormOpen && isAdmin && (
        <form className="form-movimiento form-dependencia-inline" onSubmit={handleEditSubmit}>
          <div className="form-row form-row-inline">
            <div className="form-group">
              <label htmlFor="dependencia-parent">Pertenece a</label>
              <select
                id="dependencia-parent"
                value={editParentId}
                onChange={(e) => setEditParentId(e.target.value)}
              >
                <option value="">— Dependencia principal —</option>
                {mainDeps.map((d) => (
                  <option key={d.id} value={d.id}>{getDisplayLabel(d, deps)}</option>
                ))}
              </select>
            </div>
            {isDivisionEdit ? (
              <div className="form-group">
                <label htmlFor="dependencia-numero-div">Número (dentro del grupo)</label>
                <input
                  id="dependencia-numero-div"
                  type="text"
                  placeholder="Ej: 1"
                  inputMode="numeric"
                  value={editNumero}
                  onChange={(e) => setEditNumero(e.target.value)}
                />
              </div>
            ) : (
              <div className="form-group">
                <label htmlFor="dependencia-codigo">Código / Número</label>
                <input
                  id="dependencia-codigo"
                  type="text"
                  placeholder="Ej: 144"
                  inputMode="numeric"
                  value={editCodigo}
                  onChange={(e) => setEditCodigo(e.target.value)}
                />
              </div>
            )}
            <div className="form-group">
              <label htmlFor="dependencia-nombre">Nombre</label>
              <input
                id="dependencia-nombre"
                type="text"
                required
                placeholder="Ej: Armamento, División 1"
                value={editNombre}
                onChange={(e) => setEditNombre(e.target.value.toUpperCase())}
              />
            </div>
            <div className="form-group form-group-actions">
              <label>&nbsp;</label>
              <div>
                <button type="submit" className="btn btn-primary">Guardar</button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => { setEditFormOpen(false); resetEditForm(); }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      <div className="form-group" style={{ maxWidth: 520, marginBottom: '1rem' }}>
        <div className="search-bar" role="search">
          <span className="search-icon" aria-hidden="true">🔍</span>
          <input
            type="search"
            id="buscar-dependencias"
            placeholder="Buscar dependencias…"
            autoComplete="off"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          {busqueda && (
            <button
              type="button"
              className="search-clear"
              aria-label="Limpiar búsqueda"
              onClick={() => setBusqueda('')}
            >
              &times;
            </button>
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
            {!deps.length && (
              <tr>
                <td colSpan={3} className="empty-state">
                  <p>No hay dependencias. Agrega una con el botón de arriba.</p>
                </td>
              </tr>
            )}
            {sinCoincidencias && (
              <tr>
                <td colSpan={3} className="empty-state">
                  <p>
                    Ninguna dependencia coincide con &quot;{busqueda}&quot;. Prueba con otro nombre o número (ej. D4, 144, 144-1).
                  </p>
                </td>
              </tr>
            )}
            {tableRows.map((row) => {
              const { dep, label, hidden } = row;
              const nombre = (dep.nombre || '').trim() || '—';

              if (row.kind === 'main') {
                return (
                  <tr key={dep.id} className="main-dep-row" data-dep-id={dep.id}>
                    <td>
                      {row.hasChildren ? (
                        <button
                          type="button"
                          className={`btn-flecha-dep ${row.isExpanded ? 'arrow-expanded' : 'arrow-collapsed'}`}
                          aria-label="Ver subdivisiones"
                          title="Ver subdivisiones"
                          onClick={() => toggleExpand(dep.id)}
                        >
                          {row.isExpanded ? '▼' : '▶'}
                        </button>
                      ) : (
                        <span className="btn-flecha-dep-placeholder" />
                      )}
                      {' '}
                      <button
                        type="button"
                        className="link-dependencia"
                        title="Ver envíos"
                        onClick={() => openEnvios(dep)}
                      >
                        {label}
                      </button>
                    </td>
                    <td>{nombre}</td>
                    <td>{renderAcciones(dep)}</td>
                  </tr>
                );
              }

              if (row.kind === 'division') {
                return (
                  <tr
                    key={dep.id}
                    className={`row-division row-nivel-1${row.hasSubDivs ? ' row-division-parent' : ''}${hidden ? ' row-division-hidden' : ''}`}
                    data-parent-id={row.parentId}
                  >
                    <td>
                      <span className="dep-tree-seg seg-connector seg-mid" />
                      <button type="button" className="link-dependencia" title="Ver envíos" onClick={() => openEnvios(dep)}>
                        {label}
                      </button>
                    </td>
                    <td>{nombre}</td>
                    <td>{renderAcciones(dep)}</td>
                  </tr>
                );
              }

              return (
                <tr
                  key={dep.id}
                  className={`row-division row-nivel-2${hidden ? ' row-division-hidden' : ''}`}
                  data-parent-id={row.parentId}
                >
                  <td>
                    <span className="dep-tree-seg seg-mid" />
                    <span className="dep-tree-seg seg-connector seg-last" />
                    <button type="button" className="link-dependencia" title="Ver envíos" onClick={() => openEnvios(dep)}>
                      {label}
                    </button>
                  </td>
                  <td>{nombre}</td>
                  <td>{renderAcciones(dep)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ModalShell
        open={modalAgregarOpen}
        onClose={() => setModalAgregarOpen(false)}
        title={modalAgregarParentId ? 'Agregar divisiones' : 'Agregar dependencia'}
        wide
      >
        <form onSubmit={handleAgregarSubmit}>
          <input type="hidden" value={modalAgregarParentId} readOnly />
          <div className="form-row form-row-2">
            <div className="form-group">
              <label htmlFor="nueva-dep-nombre">Nombre</label>
              <input
                id="nueva-dep-nombre"
                type="text"
                required
                placeholder="Ej: Armamento"
                value={nuevaDepNombre}
                readOnly={!!modalAgregarParentId}
                onChange={(e) => setNuevaDepNombre(e.target.value.toUpperCase())}
              />
            </div>
            <div className="form-group">
              <label htmlFor="nueva-dep-codigo">Número / ID</label>
              <input
                id="nueva-dep-codigo"
                type="text"
                placeholder="Opcional (solo para casos que lo usen)"
                inputMode="numeric"
                value={nuevaDepCodigo}
                readOnly={!!modalAgregarParentId}
                onChange={(e) => setNuevaDepCodigo(e.target.value)}
              />
            </div>
          </div>
          <div className="form-group">
            <label>Divisiones</label>
            <p className="panel-desc" style={{ marginBottom: '0.5rem' }}>
              Opcional: agrega subdivisiones con un número identificador dentro del grupo (ej. 1, 2, 3).
            </p>
            <div className="form-row form-row-inline form-row-divisiones" style={{ marginBottom: '0.5rem' }}>
              <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                <label htmlFor="nueva-division-nombre" className="label-inline">Nombre</label>
                <input
                  id="nueva-division-nombre"
                  type="text"
                  placeholder="Ej: Bienes y Patrimoniales"
                  className="input-division-nombre"
                  style={{ width: '100%' }}
                  value={divisionNombre}
                  onChange={(e) => setDivisionNombre(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      agregarDivisionALista();
                    }
                  }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0, flex: '0 0 80px' }}>
                <label htmlFor="nueva-division-numero" className="label-inline">Nº</label>
                <input
                  id="nueva-division-numero"
                  type="text"
                  placeholder="1"
                  inputMode="numeric"
                  style={{ width: '100%' }}
                  value={divisionNumero}
                  onChange={(e) => setDivisionNumero(e.target.value)}
                />
              </div>
              <button type="button" className="btn btn-secondary" onClick={agregarDivisionALista}>
                + Agregar división
              </button>
            </div>
            <DivisionesNuevaList items={divisionesNueva} onChange={setDivisionesNueva} disabled={false} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setModalAgregarOpen(false)}>Cancelar</button>
            <button type="submit" className="btn btn-primary">
              {modalAgregarParentId ? 'Guardar divisiones' : 'Guardar dependencia'}
            </button>
          </div>
        </form>
      </ModalShell>

      <ModalShell
        open={modalEnviosOpen}
        onClose={() => setModalEnviosOpen(false)}
        title={enviosData ? `Envíos a ${enviosData.label}` : 'Envíos a la dependencia'}
        wide
      >
        <div className="modal-body">
          <p className="panel-desc">Resumen de entregas realizadas a esta dependencia.</p>
          {enviosData?.total === 0 && (
            <p className="empty-state">No hay envíos registrados a esta dependencia.</p>
          )}
          {enviosData && enviosData.salidaItems.length > 0 && (
            <ul className="lista-envios-dependencia">
              <li className="item-envio-dep item-envio-dep-titulo"><strong>Entregas (salidas)</strong></li>
              {enviosData.salidaItems.map((item, i) => (
                <li key={`s-${i}`} className="item-envio-dep">
                  {`Le entregué ${item.cantidad} ${item.producto} el día ${item.fecha}`}
                </li>
              ))}
            </ul>
          )}
          {enviosData && enviosData.provisionItems.length > 0 && (
            <ul className="lista-envios-dependencia">
              <li className="item-envio-dep item-envio-dep-titulo"><strong>Productos provistos (guardia)</strong></li>
              <li className="item-envio-dep item-envio-dep-table-wrap">
                <table className="data-table tabla-provisiones-guardia">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Código</th>
                      <th>Expediente</th>
                      <th>Características</th>
                      <th>Cantidad</th>
                      <th>Día de entrega y horario</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enviosData.provisionItems.map((p, i) => (
                      <tr key={`p-${i}`}>
                        <td>{p.nombre}</td>
                        <td>{p.codigo}</td>
                        <td>{p.expediente}</td>
                        <td>{p.caracteristicas}</td>
                        <td>{p.cantidad}</td>
                        <td>{p.diaEntrega}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </li>
            </ul>
          )}
        </div>
      </ModalShell>
    </div>
  );
}
