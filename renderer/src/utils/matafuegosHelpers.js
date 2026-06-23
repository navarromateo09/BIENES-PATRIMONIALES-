const VENCIDO_SIN_FECHA = '1900-01-01';

export const MF_KG_OPTIONS = ['5 kg', '10 kg'];

export const HISTORIAL_MOVIMIENTO_FILTROS = [
  { value: 'ingreso', label: 'Ingreso' },
  { value: 'egreso', label: 'Salida / Egreso' },
  { value: 'cambio_estado', label: 'Cambio de estado' },
  { value: 'editado', label: 'Editado' },
  { value: 'entrega', label: 'Entrega' },
  { value: 'eliminacion', label: 'Eliminado' }
];

export function inferCapacidadTipo(caracteristicas) {
  const c = String(caracteristicas || '').trim();
  if (!c) return { capacidad: '—', tipo: '' };
  const kg = c.match(/(\d+(?:[.,]\d+)?)\s*kg/i);
  const l = c.match(/(\d+(?:[.,]\d+)?)\s*l(?:itros?)?/i);
  let capacidad = '—';
  if (kg) capacidad = `${kg[1]} kg`;
  else if (l) capacidad = `${l[1]} L`;
  const tipo = /\b(polvo|abc|co2|agua|espuma|pqs)\b/i.exec(c);
  return { capacidad, tipo: tipo ? tipo[1].toUpperCase() : '' };
}

/** Separa kg guardado en características del resto (tipo, notas, etc.). */
export function parseKgFromCaracteristicas(caracteristicas) {
  const c = String(caracteristicas || '').trim();
  if (!c) return { kg: '', rest: '' };
  const match = c.match(/(\d+(?:[.,]\d+)?)\s*kg/i);
  if (!match) return { kg: '', rest: c };
  const num = match[1].replace(',', '.');
  const kg = MF_KG_OPTIONS.find((opt) => opt.replace(/\s/g, '').toLowerCase() === `${num}kg`) || `${num} kg`;
  let rest = c.replace(match[0], '').replace(/^[\s,·\-]+|[\s,·\-]+$/g, '').trim();
  return { kg, rest };
}

/** Arma el texto final de características para guardar en BD. */
export function buildMatafuegoCaracteristicas(kg, extra) {
  const parts = [];
  const k = String(kg || '').trim();
  const e = String(extra || '').trim();
  if (k) parts.push(k);
  if (e) parts.push(e);
  return parts.join(', ') || '';
}

export function formatFecha(val) {
  if (!val || val === VENCIDO_SIN_FECHA) return 'Sin fecha';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-AR');
}

export function isVencidoSinFecha(fecha) {
  return !fecha || String(fecha).slice(0, 10) === VENCIDO_SIN_FECHA;
}

export function normalizeSearch(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

export function normalizeAlnum(s) {
  return normalizeSearch(s).replace(/[^a-z0-9]/g, '');
}

function levenshtein(a, b) {
  const s = a || '';
  const t = b || '';
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  const prev = Array.from({ length: t.length + 1 }, (_, j) => j);
  for (let i = 1; i <= s.length; i++) {
    const cur = [i];
    for (let j = 1; j <= t.length; j++) {
      const cost = s.charAt(i - 1) === t.charAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev.splice(0, prev.length, ...cur);
  }
  return prev[t.length];
}

function isSubsequence(needle, haystack) {
  if (!needle) return true;
  if (!haystack) return false;
  let i = 0;
  for (let j = 0; j < haystack.length && i < needle.length; j++) {
    if (haystack.charAt(j) === needle.charAt(i)) i += 1;
  }
  return i === needle.length;
}

export function serieCompareKey(serie) {
  const alnum = normalizeAlnum(serie);
  if (!alnum) return '';
  if (/^\d+$/.test(alnum)) return alnum.replace(/^0+/, '') || '0';
  return alnum;
}

export function isExactSerieMatch(serie, termRaw) {
  const t = serieCompareKey(termRaw);
  return !!t && serieCompareKey(serie) === t;
}

export function serialMatchScore(serie, termRaw) {
  const s = serieCompareKey(serie);
  const t = serieCompareKey(termRaw);
  if (!t) return 0;
  if (!s) return 999;
  if (s === t) return 0;
  if (s.includes(t)) return 1;
  if (t.includes(s)) return 2;
  if (isSubsequence(t, s)) return 3;
  if (isSubsequence(s, t)) return 4;
  return 10 + levenshtein(s, t);
}

function serialFuzzyMatch(serie, termRaw) {
  const s = normalizeAlnum(serie);
  const t = normalizeAlnum(termRaw);
  if (!t || t.length < 2 || !s) return false;
  if (s === t || s.includes(t) || t.includes(s)) return true;
  if (isSubsequence(t, s) || isSubsequence(s, t)) return true;
  const maxLen = Math.max(s.length, t.length);
  const minLen = Math.min(s.length, t.length);
  if (minLen <= 4 || maxLen - minLen > 4) return false;
  const dist = levenshtein(s, t);
  const allowed = Math.max(1, Math.floor(maxLen * 0.22));
  if (minLen >= 5 && dist <= allowed) return true;
  if (minLen >= 3 && dist <= 2) return true;
  return minLen >= 2 && dist <= 1;
}

export function getMatafuegoSearchText(m, estadoKey, depNombre = '') {
  const inf = inferCapacidadTipo(m.caracteristicas);
  const parts = [
    m.id, m.marca, m.numeroSerie, m.caracteristicas,
    inf.capacidad, inf.tipo, formatFecha(m.fechaVencimiento),
    m.fechaVencimiento, m.estado, estadoKey, depNombre
  ];
  if (estadoKey === 'recarga' || estadoKey === 'entregado') {
    parts.push(m.fechaIngreso, formatFecha(m.fechaIngreso));
  }
  if (estadoKey === 'entregado') {
    parts.push(m.fechaEntrega, formatFecha(m.fechaEntrega));
  }
  return normalizeSearch(parts.join(' '));
}

export function matafuegoMatchesTerm(m, estadoKey, termRaw, depNombre = '') {
  const term = normalizeSearch(termRaw);
  if (!term) return true;
  const blob = getMatafuegoSearchText(m, estadoKey, depNombre);
  if (blob.includes(term)) return true;

  const serie = String(m.numeroSerie || '').trim();
  const termTrim = String(termRaw || '').trim();
  if (serie && termTrim && serialFuzzyMatch(serie, termTrim)) return true;

  const tokens = term.split(/\s+/).filter((x) => x.length >= 2);
  if (tokens.length > 1) {
    return tokens.every((tok) => blob.includes(tok) || (serie && serialFuzzyMatch(serie, tok)));
  }
  if (tokens.length === 1) {
    const tok = tokens[0];
    if (blob.includes(tok)) return true;
    if (serie && serialFuzzyMatch(serie, tok)) return true;
    const marca = normalizeSearch(m.marca);
    if (marca && tok.length >= 3) {
      if (marca.includes(tok)) return true;
      if (levenshtein(marca, tok) <= 1) return true;
    }
  }
  return false;
}

/** @deprecated use matafuegoMatchesTerm */
export function matafuegoMatchesSearch(m, term, depNombre) {
  return matafuegoMatchesTerm(m, m.estado || 'disponible', term, depNombre);
}

export function getEffectiveSearchTerm(panelTerm, globalTerm) {
  if (normalizeSearch(panelTerm)) return String(panelTerm || '').trim();
  return String(globalTerm || '').trim();
}

export function mapEstadoKeyToTab(estadoKey) {
  if (estadoKey === 'recarga') return 'recarga';
  if (estadoKey === 'entregado') return 'entregados';
  if (estadoKey === 'inservible') return 'inservibles';
  return 'disponibles';
}

export function estadoSugerenciaLabel(estadoKey) {
  if (estadoKey === 'recarga') return 'Recarga';
  if (estadoKey === 'entregado') return 'Entregado';
  if (estadoKey === 'inservible') return 'Inservible';
  return 'Disponible';
}

export function estadoBadgeClass(estadoKey) {
  if (estadoKey === 'recarga') return 'matafuegos-sug-badge matafuegos-sug-badge-recarga';
  if (estadoKey === 'entregado') return 'matafuegos-sug-badge matafuegos-sug-badge-entregado';
  if (estadoKey === 'inservible') return 'matafuegos-sug-badge matafuegos-sug-badge-inservible';
  return 'matafuegos-sug-badge matafuegos-sug-badge-disponible';
}

export function buildSearchSuggestionValue(m) {
  if (!m) return '';
  const serie = String(m.numeroSerie || '').trim();
  if (serie) return serie;
  const marca = String(m.marca || '').trim();
  const car = String(m.caracteristicas || '').trim();
  if (marca && car) return `${marca} ${car}`.trim();
  if (marca) return marca;
  return String(m.id || '').trim();
}

export function secondaryLineSug(m, estadoKey, depNombre) {
  if (estadoKey === 'recarga') {
    const fi = m.fechaIngreso ? formatFecha(m.fechaIngreso) : '—';
    return `Ingreso: ${fi} · ${depNombre || '—'}`;
  }
  if (estadoKey === 'entregado') {
    const fe = m.fechaEntrega ? formatFecha(m.fechaEntrega) : '—';
    return `Entrega: ${fe} · ${depNombre || '—'}`;
  }
  return `Venc.: ${formatFecha(m.fechaVencimiento)}`;
}

export function getUbicacionTexto(m, estadoKey, depNombre) {
  if (!m) return '—';
  if (estadoKey === 'disponible') return 'Disponibles';
  if (estadoKey === 'recarga') return 'Para recarga';
  if (estadoKey === 'entregado') {
    return depNombre && depNombre !== '—' ? `Entregados · ${depNombre}` : 'Entregados';
  }
  if (estadoKey === 'inservible') return 'Inservibles';
  return estadoSugerenciaLabel(estadoKey);
}

const SEARCH_POOLS = [
  { catKey: 'disponibles', estadoKey: 'disponible' },
  { catKey: 'recarga', estadoKey: 'recarga' },
  { catKey: 'entregados', estadoKey: 'entregado' },
  { catKey: 'inservibles', estadoKey: 'inservible' }
];

export function findMatafuegoBySerie(all, serie) {
  const key = serieCompareKey(serie);
  if (!key) return null;
  const cats = categorizeMatafuegos(all);
  const pools = [
    { items: cats.disponibles, estadoKey: 'disponible' },
    { items: cats.recarga, estadoKey: 'recarga' },
    { items: cats.entregados, estadoKey: 'entregado' },
    { items: cats.inservibles, estadoKey: 'inservible' }
  ];
  for (const pool of pools) {
    for (const m of pool.items) {
      if (serieCompareKey(m.numeroSerie) === key) {
        return { m, estadoKey: pool.estadoKey };
      }
    }
  }
  return null;
}

/**
 * Valida series del formulario de alta/edición.
 * Devuelve errores con índice de campo y mensaje explícito.
 */
export function validateMatafuegoSeriesForm(series, allMatafuegos, editId = null) {
  const errors = [];
  const seen = new Map();

  (series || []).forEach((raw, i) => {
    const s = String(raw || '').trim();
    if (!s) {
      errors.push({
        index: i,
        type: 'empty',
        serie: '',
        message: `Completá el Nº de serie ${i + 1}.`
      });
      return;
    }
    const key = serieCompareKey(s);
    if (seen.has(key)) {
      const firstIdx = seen.get(key);
      const firstVal = String(series[firstIdx] || '').trim();
      errors.push({
        index: i,
        type: 'form_duplicate',
        serie: s,
        duplicateWithIndex: firstIdx,
        message: `Nº de serie ${i + 1} ("${s}") se repite con el campo Nº de serie ${firstIdx + 1} ("${firstVal}").`
      });
    } else {
      seen.set(key, i);
    }
  });

  (series || []).forEach((raw, i) => {
    const s = String(raw || '').trim();
    if (!s) return;
    if (errors.some((e) => e.index === i && e.type === 'form_duplicate')) return;

    const found = findMatafuegoBySerie(allMatafuegos, s);
    if (found && String(found.m.id) !== String(editId || '')) {
      const marca = String(found.m.marca || '—').trim() || '—';
      const ubic = getUbicacionTexto(found.m, found.estadoKey, '');
      errors.push({
        index: i,
        type: 'system_duplicate',
        serie: s,
        marca,
        ubicacion: ubic,
        estadoKey: found.estadoKey,
        message: `Nº de serie ${i + 1} ("${s}") ya existe: ${ubic} · Marca ${marca}.`
      });
    }
  });

  return errors;
}

export function collectGlobalSearchMatches(cats, dependencias, termRaw, limit = 12) {
  const term = normalizeSearch(termRaw);
  if (!term) return [];
  const depMap = new Map((dependencias || []).map((d) => [d.id, d.nombre || d.codigo || '']));
  const all = [];

  SEARCH_POOLS.forEach(({ catKey, estadoKey }) => {
    (cats[catKey] || []).forEach((m) => {
      const depNombre = depMap.get(m.dependenciaId) || '';
      if (!matafuegoMatchesTerm(m, estadoKey, termRaw, depNombre)) return;
      all.push({
        m,
        estadoKey,
        depNombre,
        score: serialMatchScore(m.numeroSerie, termRaw),
        exact: isExactSerieMatch(m.numeroSerie, termRaw)
      });
    });
  });

  all.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return String(a.m.numeroSerie || '').localeCompare(String(b.m.numeroSerie || ''), 'es', { numeric: true });
  });
  return all.slice(0, limit);
}

export function categorizeMatafuegos(all) {
  const disponibles = [];
  const recarga = [];
  const entregados = [];
  const inservibles = [];
  (all || []).forEach((m) => {
    const e = (m.estado || 'disponible').toLowerCase();
    if (e === 'recarga') recarga.push(m);
    else if (e === 'entregado') entregados.push(m);
    else if (e === 'inservible') inservibles.push(m);
    else disponibles.push(m);
  });
  return { disponibles, recarga, entregados, inservibles };
}

export function countProximosVencimiento(disponibles, dias = 30) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const lim = new Date(hoy);
  lim.setDate(lim.getDate() + dias);
  return disponibles.filter((m) => {
    if (!m.fechaVencimiento || isVencidoSinFecha(m.fechaVencimiento)) return false;
    const fv = new Date(m.fechaVencimiento);
    return fv >= hoy && fv <= lim;
  }).length;
}

/** Desglose por capacidad en kg (5, 10 u otros / sin dato). */
export function countCapacidadKgBreakdown(items) {
  let kg5 = 0;
  let kg10 = 0;
  let otros = 0;
  let sinDato = 0;

  (items || []).forEach((m) => {
    const { capacidad } = inferCapacidadTipo(m.caracteristicas);
    if (capacidad === '—') {
      sinDato += 1;
      return;
    }
    const norm = capacidad.replace(/\s/g, '').toLowerCase();
    if (norm === '5kg') kg5 += 1;
    else if (norm === '10kg') kg10 += 1;
    else otros += 1;
  });

  return { kg5, kg10, otros, sinDato };
}

export function collectMatafuegoMarcas(items) {
  const s = new Set();
  (items || []).forEach((m) => {
    const marca = String(m?.marca || '').trim();
    if (marca) s.add(marca);
  });
  return [...s].sort();
}

export function matchesCapacidadKgFilter(m, kgFilter) {
  if (!kgFilter) return true;
  const { capacidad } = inferCapacidadTipo(m?.caracteristicas);
  if (kgFilter === 'otros') return capacidad !== '—' && !MF_KG_OPTIONS.includes(capacidad);
  if (kgFilter === 'sin_dato') return capacidad === '—';
  return capacidad === kgFilter;
}

function toIsoDateLocal(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseIsoYmdLocalDate(iso) {
  if (!iso) return null;
  const parts = String(iso).slice(0, 10).split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function minFechaMananaIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  return toIsoDateLocal(d);
}

/** Fecha sugerida al dar por terminada una recarga en taller. */
export function defaultVencimientoPostRecarga(m) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setFullYear(d.getFullYear() + 1);
  const suggested = toIsoDateLocal(d);
  if (!m?.fechaVencimiento || isVencidoSinFecha(m.fechaVencimiento)) return suggested;
  const fv = String(m.fechaVencimiento).slice(0, 10);
  const v = parseIsoYmdLocalDate(fv);
  if (!v) return suggested;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  if (v <= hoy) return suggested;
  if (m.fechaIngreso) {
    const ing = parseIsoYmdLocalDate(String(m.fechaIngreso).slice(0, 10));
    if (ing && v < ing) return suggested;
  }
  return fv;
}

export function buildRecargandoIdsFromMap(recargandoMap, recargaItems) {
  const ids = {};
  const recargaIdSet = new Set((recargaItems || []).map((m) => String(m.id)));
  Object.keys(recargandoMap || {}).forEach((id) => {
    if (recargandoMap[id] && recargaIdSet.has(String(id))) ids[String(id)] = true;
  });
  return ids;
}

export function applyVencimientoFilter(list, filtro) {
  if (!filtro) return list;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const en30 = new Date(hoy);
  en30.setDate(en30.getDate() + 30);
  return list.filter((m) => {
    if (filtro === 'sin_fecha') return isVencidoSinFecha(m.fechaVencimiento);
    if (!m.fechaVencimiento || isVencidoSinFecha(m.fechaVencimiento)) return filtro === 'sin_fecha';
    const fv = new Date(m.fechaVencimiento);
    if (filtro === 'prox30') return fv >= hoy && fv <= en30;
    if (filtro === 'vencidos') return fv < hoy;
    return true;
  });
}

export function formatHistorialUsuario(usuario) {
  const u = String(usuario || '').trim();
  if (!u) return '—';
  if (u.toLowerCase() === 'sistema') return 'Sistema';
  return u;
}

/** Filas de auditoría que representan movimientos visibles en Historial. */
export function isMatafuegoHistorialAuditRow(row) {
  if (!row || row.modulo !== 'Matafuegos') return false;
  const detalle = String(row.detalle || '');
  if (detalle.startsWith('MATAFUEGO_HIST|')) return true;
  if (String(row.accion || '').toUpperCase() === 'ELIMINAR') return true;
  return false;
}

function isEntregaMovimiento(obj) {
  if (!obj) return false;
  const mov = String(obj.movimiento || '').toLowerCase();
  if (mov === 'egreso' || mov === 'entrega') return true;
  const nextEst = String(obj.estadoNuevo || '').toLowerCase();
  const prevEst = String(obj.estadoAnterior || '').toLowerCase();
  if (nextEst === 'entregado' && prevEst !== 'entregado') return true;
  const depNueva = obj.dependenciaNueva != null ? String(obj.dependenciaNueva).trim() : '';
  const depAnterior = obj.dependenciaAnterior != null ? String(obj.dependenciaAnterior).trim() : '';
  if (depNueva && !depAnterior) return true;
  return false;
}

/** Usuario que registró la entrega de cada matafuego (id → usuario). */
export function buildEntregaUsuarioByMatafuegoId(auditRows) {
  const byId = {};
  const bySerie = {};

  function consider(mfId, serie, fecha, usuario) {
    const u = formatHistorialUsuario(usuario);
    if (u === '—') return;
    const f = String(fecha || '');
    if (mfId) {
      const key = String(mfId);
      if (!byId[key] || f >= (byId[key].fecha || '')) byId[key] = { usuario: u, fecha: f };
    }
    const s = normalizeAlnum(serie);
    if (s) {
      if (!bySerie[s] || f >= (bySerie[s].fecha || '')) bySerie[s] = { usuario: u, fecha: f };
    }
  }

  (auditRows || []).forEach((row) => {
    const detalle = String(row.detalle || '');
    if (!detalle.startsWith('MATAFUEGO_HIST|')) return;
    try {
      const obj = JSON.parse(detalle.slice('MATAFUEGO_HIST|'.length));
      if (!isEntregaMovimiento(obj)) return;
      const usuario = row.usuario || obj.usuario;
      consider(obj.id || row.entidadId, obj.numeroSerie, obj.fecha || row.fecha, usuario);
    } catch (_) { /* ignore */ }
  });

  return { byId, bySerie };
}

export function resolveEntregaUsuario(matafuego, map) {
  if (!matafuego) return '—';
  const stored = formatHistorialUsuario(matafuego.usuarioEntrega);
  if (stored !== '—') return stored;
  if (!map) return '—';
  const idKey = String(matafuego.id || '');
  if (idKey && map.byId[idKey]) return map.byId[idKey].usuario;
  const s = normalizeAlnum(matafuego.numeroSerie);
  if (s && map.bySerie[s]) return map.bySerie[s].usuario;
  return '—';
}

function normalizeMovimientoKey(key) {
  const k = String(key || '').toLowerCase();
  if (k === 'ingreso') return 'ingreso';
  if (k === 'egreso' || k === 'salida') return 'egreso';
  if (k === 'cambio_estado' || k === 'cambio de estado') return 'cambio_estado';
  if (k === 'entrega') return 'entrega';
  if (k === 'eliminacion' || k === 'eliminación' || k === 'eliminado') return 'eliminacion';
  if (k === 'actualizacion' || k === 'editado') return 'editado';
  return 'editado';
}

export function movimientoKeyFromLabel(label) {
  const l = String(label || '').toLowerCase();
  if (l === 'ingreso') return 'ingreso';
  if (l === 'egreso' || l === 'salida') return 'egreso';
  if (l.includes('cambio de estado') || l === 'cambio de estado') return 'cambio_estado';
  if (l.includes('elimin')) return 'eliminacion';
  if (l === 'entrega') return 'entrega';
  return 'editado';
}

function inferHistorialMovimientoFromDetalle(detalle, accion) {
  const d = String(detalle || '').toLowerCase();
  if (d.includes('movimiento automático') && d.includes('recarga')) return 'Cambio de estado';
  if (d.includes('eliminó matafuego') || String(accion || '').toUpperCase() === 'ELIMINAR') return 'Eliminación';
  return 'Editado';
}

export function enrichHistorialRows(rows, matafuegos = []) {
  const mfById = new Map((matafuegos || []).map((m) => [String(m.id), m]));
  const mfBySerie = new Map();
  (matafuegos || []).forEach((m) => {
    const s = normalizeAlnum(m.numeroSerie);
    if (s) mfBySerie.set(s, m);
  });

  return (rows || []).map((r) => {
    let car = r.caracteristicas || '';
    if (!car && r.matafuegoId) car = mfById.get(String(r.matafuegoId))?.caracteristicas || '';
    if (!car && r.numeroSerie && r.numeroSerie !== '—') {
      car = mfBySerie.get(normalizeAlnum(r.numeroSerie))?.caracteristicas || '';
    }
    const { capacidad } = inferCapacidadTipo(car);
    const capacidadKg = capacidad !== '—' ? capacidad : '';
    return { ...r, capacidadKg };
  });
}

export function filterMatafuegoHistorial(rows, filtros = {}) {
  const { buscar = '', marca = '', kg = '', movimiento = '' } = filtros;
  let out = rows || [];

  if (marca) out = out.filter((r) => r.marca === marca);
  if (movimiento) {
    out = out.filter((r) => (r.movimientoKey || movimientoKeyFromLabel(r.movimiento)) === movimiento);
  }
  if (kg) {
    if (kg === 'otros') {
      out = out.filter((r) => r.capacidadKg && !MF_KG_OPTIONS.includes(r.capacidadKg));
    } else {
      out = out.filter((r) => r.capacidadKg === kg);
    }
  }
  if (buscar) {
    const term = normalizeSearch(buscar);
    out = out.filter((r) => normalizeSearch(
      `${r.marca} ${r.numeroSerie} ${r.movimiento} ${r.usuario || ''} ${r.capacidadKg || ''}`
    ).includes(term));
  }
  return out;
}

export function collectHistorialMarcas(rows) {
  const s = new Set();
  (rows || []).forEach((r) => {
    const m = String(r.marca || '').trim();
    if (m && m !== '—') s.add(m);
  });
  return [...s].sort();
}

export function parseHistorialRow(row) {
  const detalle = String(row?.detalle || '');
  if (detalle.startsWith('MATAFUEGO_HIST|')) {
    try {
      const obj = JSON.parse(detalle.slice('MATAFUEGO_HIST|'.length));
      const movimientoKey = normalizeMovimientoKey(obj.movimiento);
      const usuario = formatHistorialUsuario(row?.usuario || obj.usuario);
      return {
        id: row.id,
        fecha: obj.fecha || row.fecha,
        movimiento: labelMovimiento(obj.movimiento),
        movimientoKey,
        marca: obj.marca || '—',
        numeroSerie: obj.numeroSerie || row.entidadId || '—',
        matafuegoId: obj.id || row.entidadId || null,
        caracteristicas: obj.caracteristicas || '',
        usuario
      };
    } catch (_) { /* fallthrough */ }
  }
  const usuario = formatHistorialUsuario(row?.usuario);
  const movimiento = inferHistorialMovimientoFromDetalle(detalle, row?.accion);
  return {
    id: row.id,
    fecha: row.fecha,
    movimiento,
    movimientoKey: movimientoKeyFromLabel(movimiento),
    marca: '—',
    numeroSerie: row.entidadId || '—',
    matafuegoId: row.entidadId || null,
    caracteristicas: '',
    usuario
  };
}

function labelMovimiento(key) {
  const k = String(key || '').toLowerCase();
  if (k === 'ingreso') return 'Ingreso';
  if (k === 'egreso') return 'Egreso';
  if (k === 'cambio_estado') return 'Cambio de estado';
  if (k === 'entrega') return 'Entrega';
  if (k === 'actualizacion' || k === 'editado') return 'Editado';
  if (k === 'eliminacion') return 'Eliminación';
  return 'Editado';
}

export function paginate(items, page, size) {
  const total = items.length;
  const totalPaginas = Math.max(1, Math.ceil(total / size));
  const p = Math.min(Math.max(1, page), totalPaginas);
  const start = (p - 1) * size;
  return { items: items.slice(start, start + size), pagina: p, totalPaginas, total };
}

export { VENCIDO_SIN_FECHA };
