const VENCIDO_SIN_FECHA = '1900-01-01';

export const MF_KG_OPTIONS = ['5 kg', '10 kg'];

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
    const fe = m.fechaIngreso ? formatFecha(m.fechaIngreso) : '—';
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

export function parseHistorialRow(row) {
  const detalle = String(row?.detalle || '');
  if (detalle.startsWith('MATAFUEGO_HIST|')) {
    try {
      const obj = JSON.parse(detalle.slice('MATAFUEGO_HIST|'.length));
      return {
        id: row.id,
        fecha: obj.fecha || row.fecha,
        movimiento: labelMovimiento(obj.movimiento),
        marca: obj.marca || '—',
        numeroSerie: obj.numeroSerie || row.entidadId || '—'
      };
    } catch (_) { /* fallthrough */ }
  }
  return {
    id: row.id,
    fecha: row.fecha,
    movimiento: 'Actualización',
    marca: '—',
    numeroSerie: row.entidadId || '—'
  };
}

function labelMovimiento(key) {
  const k = String(key || '').toLowerCase();
  if (k === 'ingreso') return 'Ingreso';
  if (k === 'egreso') return 'Egreso';
  if (k === 'cambio_estado') return 'Cambio de estado';
  if (k === 'entrega') return 'Entrega';
  return 'Actualización';
}

export function paginate(items, page, size) {
  const total = items.length;
  const totalPaginas = Math.max(1, Math.ceil(total / size));
  const p = Math.min(Math.max(1, page), totalPaginas);
  const start = (p - 1) * size;
  return { items: items.slice(start, start + size), pagina: p, totalPaginas, total };
}

export { VENCIDO_SIN_FECHA };
