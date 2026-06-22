import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLoading } from '../contexts/LoadingContext';
import { useToast } from '../contexts/ToastContext';
import { getStockAPI } from '../hooks/useStockAPI';
import {
  applyVencimientoFilter,
  buildSearchSuggestionValue,
  categorizeMatafuegos,
  collectGlobalSearchMatches,
  countProximosVencimiento,
  estadoBadgeClass,
  estadoSugerenciaLabel,
  formatFecha,
  getEffectiveSearchTerm,
  inferCapacidadTipo,
  isExactSerieMatch,
  isVencidoSinFecha,
  mapEstadoKeyToTab,
  matafuegoMatchesTerm,
  normalizeSearch,
  paginate,
  parseHistorialRow,
  secondaryLineSug
} from '../utils/matafuegosHelpers';
import MatafuegoEntregaWizard from '../components/matafuegos/MatafuegoEntregaWizard';
import '../theme/matafuegos-pro.css';

const TAB_ESTADO = {
  disponibles: 'disponible',
  recarga: 'recarga',
  inservibles: 'inservible',
  entregados: 'entregado'
};

const TABS = [
  { key: 'disponibles', label: 'Disponibles', title: 'Matafuegos disponibles', sub: 'En condiciones de uso y operativos' },
  { key: 'recarga', label: 'Para recarga', title: 'Matafuegos para recarga', sub: 'Vencidos o pendientes de recarga' },
  { key: 'inservibles', label: 'Inservibles', title: 'Matafuegos inservibles', sub: 'Fuera de servicio' },
  { key: 'entregados', label: 'Entregados', title: 'Matafuegos entregados', sub: 'Con dependencia asignada' },
  { key: 'historial', label: 'Historial', title: 'Historial de movimientos', sub: 'Ingresos y cambios registrados' }
];

const KPI = [
  { key: 'disponibles', label: 'Disponibles', hint: 'En condiciones de uso', cls: 'mf-kpi--green' },
  { key: 'recarga', label: 'Para recarga', hint: 'Vencidos / pendientes', cls: 'mf-kpi--orange' },
  { key: 'inservibles', label: 'Inservibles', hint: 'Fuera de servicio', cls: 'mf-kpi--red' },
  { key: 'historial', label: 'Historial', hint: 'Ingresos y cambios', cls: 'mf-kpi--violet' },
  { key: 'entregados', label: 'Entregados', hint: 'Con destino asignado', cls: 'mf-kpi--blue' }
];

function depNombre(deps, id) {
  if (!id) return '';
  const d = deps.find((x) => x.id === id);
  return d ? (d.nombre || d.codigo || '') : '';
}

export default function MatafuegosPage() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { show, hide } = useLoading();
  const { showToast } = useToast();

  const [tab, setTab] = useState('disponibles');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [globalSearch, setGlobalSearch] = useState('');
  const [panelSearch, setPanelSearch] = useState('');
  const [filtroMarca, setFiltroMarca] = useState('');
  const [filtroVenc, setFiltroVenc] = useState('');

  const [all, setAll] = useState([]);
  const [dependencias, setDependencias] = useState([]);
  const [historial, setHistorial] = useState([]);

  const [entregaOpen, setEntregaOpen] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestIndex, setSuggestIndex] = useState(-1);
  const [highlightId, setHighlightId] = useState(null);
  const globalSearchRef = useRef(null);
  const skipPageResetRef = useRef(false);


  const cats = useMemo(() => categorizeMatafuegos(all), [all]);
  const counts = useMemo(() => ({
    disponibles: cats.disponibles.length,
    recarga: cats.recarga.length,
    inservibles: cats.inservibles.length,
    entregados: cats.entregados.length,
    historial: historial.length
  }), [cats, historial]);

  const marcas = useMemo(() => {
    const s = new Set();
    cats.disponibles.forEach((m) => { if (m.marca) s.add(m.marca); });
    return [...s].sort();
  }, [cats.disponibles]);

  const proximos30 = useMemo(() => countProximosVencimiento(cats.disponibles), [cats.disponibles]);

  const load = useCallback(async () => {
    const api = getStockAPI();
    if (!api?.getMatafuegosData) return;
    show('Cargando matafuegos…');
    try {
      if (api.syncExpiredMatafuegos) await api.syncExpiredMatafuegos().catch(() => {});
      const bundle = await api.getMatafuegosData();
      setAll(bundle.matafuegos || []);
      setDependencias(bundle.dependencias || []);
      setHistorial((bundle.auditLog || []).map(parseHistorialRow));
    } catch (e) {
      showToast(e.message || 'Error al cargar', 'error');
    } finally {
      hide();
    }
  }, [show, hide, showToast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (skipPageResetRef.current) {
      skipPageResetRef.current = false;
      return;
    }
    setPage(1);
    setHighlightId(null);
  }, [tab, globalSearch, panelSearch, filtroMarca, filtroVenc]);

  useEffect(() => {
    if (!showSuggestions) return undefined;
    function onDocClick(e) {
      if (globalSearchRef.current && !globalSearchRef.current.contains(e.target)) {
        setShowSuggestions(false);
        setSuggestIndex(-1);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [showSuggestions]);

  const effectiveTerm = getEffectiveSearchTerm(panelSearch, globalSearch);
  const gTerm = normalizeSearch(globalSearch);

  const globalMatches = useMemo(
    () => collectGlobalSearchMatches(cats, dependencias, globalSearch, 12),
    [cats, dependencias, globalSearch]
  );

  const filteredList = useMemo(() => {
    if (tab === 'historial') {
      let h = historial;
      const term = normalizeSearch(effectiveTerm);
      if (term) {
        h = h.filter((r) => normalizeSearch(`${r.marca} ${r.numeroSerie} ${r.movimiento} ${r.usuario || ''}`).includes(term));
      }
      return h;
    }
    const estadoKey = TAB_ESTADO[tab] || 'disponible';
    let list = cats[tab] || [];
    list = list.filter((m) => matafuegoMatchesTerm(
      m,
      estadoKey,
      effectiveTerm,
      depNombre(dependencias, m.dependenciaId)
    ));
    if (tab === 'disponibles') {
      if (filtroMarca) list = list.filter((m) => m.marca === filtroMarca);
      list = applyVencimientoFilter(list, filtroVenc);
    }
    return list;
  }, [tab, cats, historial, dependencias, effectiveTerm, filtroMarca, filtroVenc]);

  useEffect(() => {
    if (!highlightId) return;
    const idx = filteredList.findIndex((row) => row.id === highlightId);
    if (idx < 0) return;
    const targetPage = Math.floor(idx / pageSize) + 1;
    setPage(targetPage);
    const timer = setTimeout(() => {
      document.getElementById(`mf-row-${highlightId}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 80);
    return () => clearTimeout(timer);
  }, [highlightId, filteredList, pageSize]);

  const pag = useMemo(() => paginate(filteredList, page, pageSize), [filteredList, page, pageSize]);

  async function saveMatafuego(payload) {
    const api = getStockAPI();
    await api.saveMatafuego(payload);
  }

  async function handleEntregaConfirm({ dependenciaId, matafuegos }) {
    if (!dependenciaId || !matafuegos?.length) {
      showToast('Seleccioná destino y al menos un matafuego', 'error');
      throw new Error('incomplete');
    }
    show(matafuegos.length > 1 ? 'Registrando entregas…' : 'Registrando entrega…');
    const hoy = new Date().toISOString().slice(0, 10);
    try {
      for (const m of matafuegos) {
        // eslint-disable-next-line no-await-in-loop
        await saveMatafuego({
          ...m,
          estado: 'entregado',
          dependenciaId,
          fechaEntrega: hoy
        });
      }
      showToast(matafuegos.length > 1 ? `${matafuegos.length} matafuegos entregados` : 'Matafuego entregado');
      await load();
    } catch (err) {
      if (err?.message !== 'incomplete') {
        showToast(err.message || 'Error al registrar', 'error');
      }
      throw err;
    } finally {
      hide();
    }
  }

  async function handleDelete(m) {
    if (!isAdmin) {
      showToast('Solo un administrador puede eliminar', 'error');
      return;
    }
    if (!window.confirm('¿Eliminar este matafuego? Esta acción no se puede deshacer.')) return;
    const api = getStockAPI();
    show('Eliminando…');
    try {
      await api.deleteMatafuego(m.id);
      showToast('Eliminado');
      await load();
    } catch (err) {
      showToast(err.message || 'Error', 'error');
    } finally {
      hide();
    }
  }

  async function handleExport() {
    const api = getStockAPI();
    if (!api?.exportMatafuegosExcel) return;
    const rows = filteredList.map((m) => {
      const inf = inferCapacidadTipo(m.caracteristicas);
      const row = {
        Marca: m.marca || '',
        Serie: m.numeroSerie || '',
        Capacidad: inf.capacidad,
        Tipo: inf.tipo,
        Vencimiento: formatFecha(m.fechaVencimiento),
        Estado: m.estado || '',
        Dependencia: depNombre(dependencias, m.dependenciaId)
      };
      if (tab === 'entregados') {
        row['Fecha entrega'] = m.fechaEntrega ? formatFecha(m.fechaEntrega) : 'Sin registro';
      }
      return row;
    });
    if (!rows.length) {
      showToast('No hay filas para exportar', 'error');
      return;
    }
    const r = await api.exportMatafuegosExcel({
      rows,
      sheetName: TABS.find((t) => t.key === tab)?.label || 'Matafuegos',
      defaultPath: `matafuegos-${tab}.xlsx`
    });
    if (r?.ok) showToast('Exportado correctamente');
    else if (!r?.cancelled) showToast(r?.error || 'Error al exportar', 'error');
  }

  function switchTab(nextTab) {
    setTab(nextTab);
    setPanelSearch('');
    setHighlightId(null);
  }

  function applyGlobalSuggestion(match) {
    const fill = buildSearchSuggestionValue(match.m);
    const destTab = mapEstadoKeyToTab(match.estadoKey);
    skipPageResetRef.current = true;
    setGlobalSearch(fill);
    setPanelSearch(fill);
    setTab(destTab);
    setFiltroMarca('');
    setFiltroVenc('');
    setShowSuggestions(false);
    setSuggestIndex(-1);
    setHighlightId(match.m.id);
  }

  function onGlobalSearchKeyDown(e) {
    if (!showSuggestions || !globalMatches.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSuggestIndex((i) => (i < 0 ? 0 : Math.min(i + 1, globalMatches.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSuggestIndex((i) => (i <= 0 ? globalMatches.length - 1 : i - 1));
    } else if (e.key === 'Enter' && suggestIndex >= 0) {
      e.preventDefault();
      applyGlobalSuggestion(globalMatches[suggestIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSuggestIndex(-1);
    }
  }

  function vencClass(m) {
    if (isVencidoSinFecha(m.fechaVencimiento)) return 'mf-venc-prox';
    const fv = new Date(m.fechaVencimiento);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const en30 = new Date(hoy);
    en30.setDate(en30.getDate() + 30);
    if (fv >= hoy && fv <= en30) return 'mf-venc-prox';
    return 'mf-venc-ok';
  }

  const tabInfo = TABS.find((t) => t.key === tab);

  return (
    <>
      <div className="mf-page">
        <header className="mf-hero">
          <div>
            <h1 className="mf-hero-title">MATAFUEGOS</h1>
            <p className="mf-hero-sub">Gestión y control de matafuegos</p>
          </div>
          <div className="mf-hero-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEntregaOpen(true)}>
              Entregar matafuego
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/matafuegos/nuevo')}>
              + Agregar nuevo matafuego
            </button>
          </div>
        </header>

        <section className="mf-kpi-grid" aria-label="Resumen">
          {KPI.map((k) => (
            <button
              key={k.key}
              type="button"
              className={`mf-kpi ${k.cls}${tab === k.key ? ' active' : ''}`}
              onClick={() => switchTab(k.key)}
            >
              <p className="mf-kpi-label">{k.label}</p>
              <p className="mf-kpi-value">{counts[k.key] ?? 0}</p>
              <p className="mf-kpi-hint">{k.hint}</p>
            </button>
          ))}
        </section>

        <div className="mf-alert-banner">
          <span aria-hidden="true">📅</span>
          <span>
            <strong>Próximo vencimiento:</strong>{' '}
            {proximos30} matafuego(s) disponibles vencen en los próximos 30 días.
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ marginLeft: 'auto' }}
            onClick={() => { switchTab('disponibles'); setFiltroVenc('prox30'); }}
          >
            Ver próximos
          </button>
        </div>

        <div className="mf-search-global" ref={globalSearchRef}>
          <div className="matafuegos-search-combo">
            <span className="mf-search-icon" aria-hidden="true">🔍</span>
            <input
              type="search"
              placeholder="Buscar por serie, marca, características, vencimiento, estado…"
              value={globalSearch}
              aria-expanded={showSuggestions && gTerm ? 'true' : 'false'}
              aria-controls="matafuegos-search-suggestions"
              aria-autocomplete="list"
              onChange={(e) => {
                setGlobalSearch(e.target.value);
                setShowSuggestions(true);
                setSuggestIndex(-1);
                setHighlightId(null);
              }}
              onFocus={() => { if (gTerm) setShowSuggestions(true); }}
              onKeyDown={onGlobalSearchKeyDown}
            />
            {globalSearch && (
              <button
                type="button"
                className="mf-search-clear"
                aria-label="Limpiar búsqueda global"
                onClick={() => {
                  setGlobalSearch('');
                  setShowSuggestions(false);
                  setSuggestIndex(-1);
                  setHighlightId(null);
                }}
              >
                ✕
              </button>
            )}
            {showSuggestions && gTerm && (
              <div
                id="matafuegos-search-suggestions"
                className="matafuegos-search-suggestions"
                role="listbox"
                aria-label="Coincidencias de búsqueda"
              >
                {!globalMatches.length ? (
                  <div className="matafuegos-sug-empty" role="option">
                    Sin coincidencias en ningún listado.
                  </div>
                ) : globalMatches.map((match, idx) => {
                  const { m, estadoKey, depNombre: dep, exact } = match;
                  const serie = String(m.numeroSerie || '').trim();
                  const marca = String(m.marca || '—').trim() || '—';
                  return (
                    <button
                      key={`${estadoKey}-${m.id}`}
                      type="button"
                      role="option"
                      className={[
                        'matafuegos-sug-item',
                        exact ? 'matafuegos-sug-exact' : '',
                        idx === suggestIndex ? 'matafuegos-sug-active' : ''
                      ].filter(Boolean).join(' ')}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyGlobalSuggestion(match)}
                    >
                      <span className="matafuegos-sug-icon" aria-hidden="true">{exact ? '✓' : '⏱'}</span>
                      <span className="matafuegos-sug-body">
                        <span className="matafuegos-sug-line1">
                          <span className={estadoBadgeClass(estadoKey)}>
                            {estadoSugerenciaLabel(estadoKey)}
                          </span>
                          <span>
                            {marca} · Nº {serie || '—'}
                            {exact && (
                              <span className="matafuegos-sug-exact-tag" aria-label="Coincidencia exacta">✓ Exacto</span>
                            )}
                          </span>
                        </span>
                        <span className="matafuegos-sug-line2">
                          {secondaryLineSug(m, estadoKey, dep)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {gTerm && !panelSearch && filteredList.length === 0 && globalMatches.length > 0 && tab !== 'historial' && (
            <p className="mf-search-hint">
              Hay {globalMatches.length} coincidencia(s) en otras secciones. Elegí una en la lista de arriba para ir directo.
            </p>
          )}
        </div>

        <div className="mf-panel-card">
          <div className="mf-panel-toolbar">
            <span className="mf-pag-info">{filteredList.length} registro(s) en {tabInfo?.label}</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleExport}>
              Exportar Excel
            </button>
          </div>
          <nav className="mf-tabs" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                className={`mf-tab${tab === t.key ? ' active' : ''}`}
                onClick={() => switchTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <div className="mf-tab-body">
            <div className="mf-tab-head">
              <h3>{tabInfo?.title}</h3>
              <p>{tabInfo?.sub}</p>
            </div>

            {tab === 'disponibles' && (
              <div className="mf-filters-row">
                <div>
                  <label>Marca</label>
                  <select value={filtroMarca} onChange={(e) => setFiltroMarca(e.target.value)}>
                    <option value="">Todas</option>
                    {marcas.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label>Vencimiento</label>
                  <select value={filtroVenc} onChange={(e) => setFiltroVenc(e.target.value)}>
                    <option value="">Todos</option>
                    <option value="prox30">Próximos 30 días</option>
                    <option value="vencidos">Ya vencidos</option>
                    <option value="sin_fecha">Sin fecha</option>
                  </select>
                </div>
                {(filtroMarca || filtroVenc) && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setFiltroMarca(''); setFiltroVenc(''); }}>
                    Limpiar filtros
                  </button>
                )}
              </div>
            )}

            <div className="mf-panel-search">
              <input
                type="search"
                placeholder={`Buscar en ${tabInfo?.label.toLowerCase()}…`}
                value={panelSearch}
                onChange={(e) => {
                  setPanelSearch(e.target.value);
                  setHighlightId(null);
                }}
              />
            </div>

            {tab === 'historial' ? (
              filteredList.length === 0 ? (
                <p className="mf-empty">No hay registros en el historial.</p>
              ) : (
                <>
                  <div className="inst-table-wrap table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr><th>Fecha</th><th>Movimiento</th><th>Usuario</th><th>Marca</th><th>Nº de serie</th></tr>
                      </thead>
                      <tbody>
                        {pag.items.map((r) => (
                          <tr key={r.id}>
                            <td>{r.fecha ? new Date(r.fecha).toLocaleString('es-AR') : '—'}</td>
                            <td>{r.movimiento}</td>
                            <td>{r.usuario || '—'}</td>
                            <td>{r.marca}</td>
                            <td>{r.numeroSerie}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )
            ) : filteredList.length === 0 ? (
              <p className="mf-empty">No hay matafuegos en esta sección con los filtros aplicados.</p>
            ) : (
              <div className="inst-table-wrap table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Marca</th>
                      <th>Nº de serie</th>
                      <th>Capacidad</th>
                      <th>Tipo</th>
                      {tab === 'entregados' && <th>Dependencia</th>}
                      {tab === 'entregados' && <th>Fecha de entrega</th>}
                      <th>Última recarga</th>
                      <th>Próximo vencimiento</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pag.items.map((m) => {
                      const inf = inferCapacidadTipo(m.caracteristicas);
                      return (
                        <tr
                          key={m.id}
                          id={`mf-row-${m.id}`}
                          className={[
                            highlightId === m.id ? 'matafuegos-row-highlight' : '',
                            isExactSerieMatch(m.numeroSerie, effectiveTerm) ? 'mf-row-search-exact' : ''
                          ].filter(Boolean).join(' ') || undefined}
                        >
                          <td>{m.marca || '—'}</td>
                          <td>{m.numeroSerie || '—'}</td>
                          <td>{inf.capacidad}</td>
                          <td>{inf.tipo ? <span className="mf-badge-tipo">{inf.tipo}</span> : '—'}</td>
                          {tab === 'entregados' && <td>{depNombre(dependencias, m.dependenciaId) || '—'}</td>}
                          {tab === 'entregados' && (
                            <td>{m.fechaEntrega ? formatFecha(m.fechaEntrega) : <span className="mf-fecha-sin-registro">Sin registro</span>}</td>
                          )}
                          <td>{formatFecha(m.fechaIngreso)}</td>
                          <td className={vencClass(m)}>{formatFecha(m.fechaVencimiento)}</td>
                          <td className="mf-actions-cell">
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate(`/matafuegos/editar/${m.id}`)}>Editar</button>
                            {isAdmin && (
                              <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleDelete(m)}>Eliminar</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {filteredList.length > 0 && (
              <div className="mf-pag-footer">
                <div className="mf-pag-btns">
                  <button type="button" className="btn btn-secondary btn-sm" disabled={pag.pagina <= 1} onClick={() => setPage((p) => p - 1)}>← Anterior</button>
                  <span className="mf-pag-info">Página {pag.pagina} / {pag.totalPaginas} ({pag.total} registros)</span>
                  <button type="button" className="btn btn-secondary btn-sm" disabled={pag.pagina >= pag.totalPaginas} onClick={() => setPage((p) => p + 1)}>Siguiente →</button>
                </div>
                <label>
                  <span className="mf-pag-info">Por página </span>
                  <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
                    {[10, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
              </div>
            )}
          </div>
        </div>
      </div>

      <MatafuegoEntregaWizard
        open={entregaOpen}
        dependencias={dependencias}
        disponibles={cats.disponibles}
        onClose={() => setEntregaOpen(false)}
        onConfirm={handleEntregaConfirm}
      />
    </>
  );
}
