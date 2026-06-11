import { depMatchesBusqueda } from './dependenciasHelpers';
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
  const q = normalizeSearch(qRaw);
  const qCompact = q.replace(/\s/g, '');
  const parent = getDepParent(deps, dep);
  const qLower = String(qRaw || '').trim().toLowerCase();
  if (!depMatchesBusqueda(dep, deps, qLower, parent)) return -1;

  const nombre = normalizeSearch(dep.nombre || '');
  const label = normalizeSearch(getDisplayLabel(dep, deps));
  const codigo = normalizeSearch(dep.codigo || '');
  const numero = normalizeSearch(dep.numero || '');
  const nombreCompact = nombre.replace(/\s/g, '');
  const labelCompact = label.replace(/\s/g, '');

  let score = 80;

  if (nombre === q || nombreCompact === qCompact) score = 0;
  else if (nombre.startsWith(q)) score = 8;
  else if (nombre.includes(q)) score = 15;
  else if (label.includes(q) || labelCompact.includes(qCompact)) score = 25;
  else if (codigo.includes(q) || numero.includes(q)) score = 35;

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
    .sort((a, b) => a.score - b.score || a.label.localeCompare(b.label, 'es'));
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
