import { depMatchesBusqueda, extractComisariaNumber, normalizeDepSearch } from './dependenciasHelpers';
import { buildGuardiaDepRows, getDisplayLabel, isTxtItem } from './guardiaHelpers';
import { inferCapacidadTipo, normalizeSearch } from './matafuegosHelpers';

export { buildGuardiaDepRows, getDisplayLabel };

export function filterDepsForEntrega(deps) {
  return (deps || []).filter((d) => !isTxtItem(d));
}

function getDepParent(deps, dep) {
  if (!dep?.parentId) return null;
  return deps.find((d) => d.id === dep.parentId) || null;
}

function getDepBreadcrumb(dep, deps) {
  const parts = [];
  let current = getDepParent(deps, dep);
  while (current) {
    parts.unshift(getDisplayLabel(current, deps));
    current = getDepParent(deps, current);
  }
  return parts.join(' › ');
}

function scoreDepSearchMatch(dep, deps, qRaw) {
  const q = normalizeDepSearch(qRaw);
  const qCompact = q.replace(/\s/g, '');
  const parent = getDepParent(deps, dep);
  if (!depMatchesBusqueda(dep, deps, qRaw, parent)) return -1;

  const nombre = normalizeDepSearch(dep.nombre || '');
  const label = normalizeDepSearch(getDisplayLabel(dep, deps));
  const codigo = normalizeDepSearch(dep.codigo || '');
  const numero = normalizeDepSearch(dep.numero || '');
  const nombreCompact = nombre.replace(/\s/g, '');
  const labelCompact = label.replace(/\s/g, '');

  let score = 80;

  if (nombre === q || nombreCompact === qCompact) score = 0;
  else if (nombre.startsWith(q)) score = 8;
  else if (nombre.includes(q)) score = 15;
  else if (label.includes(q) || labelCompact.includes(qCompact)) score = 25;
  else if (codigo.includes(q) || numero.includes(q)) score = 35;

  const tokens = q.split(/\s+/).filter(Boolean);
  const numToken = tokens.find((t) => /^\d{1,2}/.test(t));
  if (numToken) {
    const wanted = parseInt(numToken.replace(/\D/g, ''), 10);
    const found = extractComisariaNumber(dep, deps);
    if (!Number.isNaN(wanted) && found === wanted) score = 0;
    else if (!Number.isNaN(wanted) && found != null) score += 50;
  }

  if (dep.parentId && (nombre.includes(q) || nombreCompact.includes(qCompact))) {
    score -= 12;
  }

  let depth = 0;
  let cur = dep;
  while (cur?.parentId) {
    depth += 1;
    cur = getDepParent(deps, cur);
  }
  score += depth * 2;

  return score;
}

function compareDepSearchRows(a, b, deps) {
  if (a.score !== b.score) return a.score - b.score;
  const na = extractComisariaNumber(a.dep, deps);
  const nb = extractComisariaNumber(b.dep, deps);
  if (na != null && nb != null && na !== nb) return na - nb;
  return a.label.localeCompare(b.label, 'es', { numeric: true, sensitivity: 'base' });
}

function buildFlatSearchDepRows(deps, busqueda) {
  const q = (busqueda || '').trim();
  return (deps || [])
    .map((dep) => {
      const score = scoreDepSearchMatch(dep, deps, q);
      if (score < 0) return null;
      return {
        key: dep.id,
        type: dep.parentId ? 'division' : 'main',
        dep,
        label: getDisplayLabel(dep, deps),
        nombre: (dep.nombre || '').trim() || '—',
        breadcrumb: getDepBreadcrumb(dep, deps),
        score,
        searchMode: true,
        isTopMatch: score <= 10
      };
    })
    .filter(Boolean)
    .sort((a, b) => compareDepSearchRows(a, b, deps));
}

/**
 * Filas para paso 1: sin búsqueda = árbol manual; con búsqueda = lista plana
 * ordenada (divisiones coincidentes primero, sin desplegar padres).
 */
export function buildEntregaDepRows(deps, busqueda, expandedIds = {}) {
  const q = (busqueda || '').trim();
  if (!q) {
    return buildGuardiaDepRows(deps, busqueda, expandedIds).map((row) => ({
      ...row,
      searchMode: false
    }));
  }
  return buildFlatSearchDepRows(deps, busqueda);
}

export function filterMatafuegosDisponibles(disponibles, busqueda) {
  const list = disponibles || [];
  const q = normalizeSearch(busqueda);
  if (!q) return list;
  return list.filter((m) => {
    const inf = inferCapacidadTipo(m.caracteristicas);
    const hay = `${m.marca || ''} ${m.numeroSerie || ''} ${m.caracteristicas || ''} ${inf.capacidad} ${inf.tipo}`;
    return normalizeSearch(hay).includes(q);
  });
}

export function matafuegoCartLabel(m) {
  const inf = inferCapacidadTipo(m.caracteristicas);
  const marca = (m.marca || '—').trim();
  const serie = (m.numeroSerie || '—').trim();
  const extra = [inf.capacidad !== '—' ? inf.capacidad : '', inf.tipo].filter(Boolean).join(' · ');
  return { marca, serie, extra };
}
