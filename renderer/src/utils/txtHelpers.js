export const TXT_REPARTICION_DEFAULT_NUMERO = '250';
export const TXT_REPARTICION_DEFAULT_NOMBRE = 'DPTO GENERAL DE POLICIA';

export const TXT_NUEVO_FIELD_MAX = {
  reparticion: 3,
  reparticionDesc: 25,
  dependencia: 4,
  dependenciaDesc: 25,
  habitacion: 4,
  habitacionDesc: 25,
  cuenta: 3,
  especie: 4,
  motivo: 2,
  estado: 1,
  cantidad: 3,
  orden: 4,
  valorDigits: 10,
  mes: 2,
  anio: 2,
  descripcion: 46
};

export const TXT_NUEVO_COLUMNS = [
  { key: 'reparticion', label: 'Rep' },
  { key: 'reparticionDesc', label: 'Desc. rep' },
  { key: 'dependencia', label: 'Dep' },
  { key: 'dependenciaDesc', label: 'Desc. dep' },
  { key: 'habitacion', label: 'Hab.' },
  { key: 'habitacionDesc', label: 'Desc. hab' },
  { key: 'cuenta', label: 'Cuenta' },
  { key: 'especie', label: 'Especie' },
  { key: 'motivo', label: 'Motivo' },
  { key: 'estado', label: 'Estado' },
  { key: 'cantidad', label: 'Cant.' },
  { key: 'orden', label: 'Orden' },
  { key: 'valor', label: 'Valor' },
  { key: 'mes', label: 'Mes' },
  { key: 'anio', label: 'Año' },
  { key: 'descripcion', label: 'Descripción' }
];

function strSliceTxtNuevo(s, max) {
  const t = String(s == null ? '' : s);
  return t.length <= max ? t : t.slice(0, max);
}

function onlyDigitsSliceTxtNuevo(s, max) {
  const d = String(s || '').replace(/[^\d]/g, '');
  return d.length <= max ? d : d.slice(0, max);
}

export function normalizeTxtNuevoValorDigits(s) {
  return onlyDigitsSliceTxtNuevo(String(s || '').replace(/\./g, '').replace(/,/g, ''), TXT_NUEVO_FIELD_MAX.valorDigits);
}

export function clampTxtNuevoItem(item) {
  const M = TXT_NUEVO_FIELD_MAX;
  const cantStr = onlyDigitsSliceTxtNuevo(String(item.cantidad || ''), M.cantidad);
  let cantOut = '';
  if (cantStr !== '') {
    const nq = parseInt(cantStr, 10);
    if (!Number.isNaN(nq) && nq >= 0) cantOut = nq > 999 ? '999' : String(nq);
  }
  const mesStr = onlyDigitsSliceTxtNuevo(String(item.mes || ''), M.mes);
  let mesOut = '';
  if (mesStr !== '') {
    let mm = parseInt(mesStr, 10);
    if (!Number.isNaN(mm)) {
      if (mm > 12) mm = 12;
      if (mm < 0) mm = 0;
      mesOut = String(mm);
    }
  }
  return {
    reparticion: strSliceTxtNuevo(item.reparticion, M.reparticion),
    reparticionDesc: strSliceTxtNuevo(item.reparticionDesc, M.reparticionDesc),
    dependencia: onlyDigitsSliceTxtNuevo(item.dependencia, M.dependencia),
    dependenciaDesc: strSliceTxtNuevo(item.dependenciaDesc, M.dependenciaDesc),
    habitacion: onlyDigitsSliceTxtNuevo(item.habitacion, M.habitacion),
    habitacionDesc: strSliceTxtNuevo(item.habitacionDesc, M.habitacionDesc),
    cuenta: strSliceTxtNuevo(item.cuenta, M.cuenta),
    especie: onlyDigitsSliceTxtNuevo(item.especie, M.especie),
    motivo: onlyDigitsSliceTxtNuevo(item.motivo, M.motivo),
    estado: strSliceTxtNuevo(item.estado, M.estado),
    cantidad: cantOut,
    orden: onlyDigitsSliceTxtNuevo(item.orden, M.orden),
    valor: normalizeTxtNuevoValorDigits(item.valor),
    mes: mesOut,
    anio: onlyDigitsSliceTxtNuevo(String(item.anio || ''), M.anio),
    descripcion: strSliceTxtNuevo(String(item.descripcion || '').toUpperCase(), M.descripcion)
  };
}

export function emptyTxtNuevoForm() {
  return {
    reparticion: TXT_REPARTICION_DEFAULT_NUMERO,
    reparticionDesc: TXT_REPARTICION_DEFAULT_NOMBRE,
    dependencia: '',
    dependenciaDesc: '',
    habitacion: '',
    habitacionDesc: '',
    cuenta: '',
    especie: '',
    motivo: '',
    estado: '',
    cantidad: '',
    orden: '',
    valor: '',
    mes: '',
    anio: '',
    descripcion: ''
  };
}

export function normalizeKey(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function onlyDigits(s) {
  return String(s || '').replace(/[^\d]/g, '');
}

export function normalizeString(s) {
  return normalizeKey(s);
}

export function getMainDeps(deps) {
  return (deps || []).filter((d) => d && (d.parentId == null || d.parentId === ''));
}

export function getDivisiones(deps, parentId) {
  return (deps || []).filter((d) => d.parentId === parentId);
}

export function getDepDisplayLabel(dep, deps) {
  if (!dep) return '—';
  const nombre = (dep.nombre != null ? String(dep.nombre).trim() : '');
  const codigo = (dep.codigo != null ? String(dep.codigo).trim() : '');
  const numero = (dep.numero != null ? String(dep.numero).trim() : '');
  if (dep.parentId) {
    const parent = (deps || []).find((d) => d.id === dep.parentId);
    const parentCodigo = parent && parent.codigo != null ? String(parent.codigo).trim() : (codigo || '');
    const idCompuesto = parentCodigo && numero ? `${parentCodigo}-${numero}` : (parentCodigo || numero || '');
    const parts = [idCompuesto, nombre].filter(Boolean);
    return parts.length ? parts.join(' - ') : '—';
  }
  const partsMain = [codigo, nombre].filter(Boolean);
  return partsMain.length ? partsMain.join(' - ') : (nombre || codigo || '—');
}

export function depMatchesQuery(dep, queryNorm, allDeps) {
  if (!queryNorm) return true;
  const codigo = dep?.codigo != null ? String(dep.codigo).trim() : '';
  const numero = dep?.numero != null ? String(dep.numero).trim() : '';
  const nombre = normalizeString(dep?.nombre || '');
  let parentCodigo = '';
  if (dep?.parentId && allDeps) {
    const parent = allDeps.find((d) => d.id === dep.parentId);
    if (parent?.codigo != null) parentCodigo = String(parent.codigo).trim();
  }
  const idCompuesto = parentCodigo && numero ? `${parentCodigo}-${numero}` : '';
  const combo = normalizeString([codigo, numero, nombre, idCompuesto, `${parentCodigo} ${numero}`].filter(Boolean).join(' '));
  return normalizeString(codigo).includes(queryNorm)
    || normalizeString(numero).includes(queryNorm)
    || nombre.includes(queryNorm)
    || normalizeString(idCompuesto).includes(queryNorm)
    || combo.includes(queryNorm);
}

/** Filas estructuradas para el buscador TXT */
export function buildTxtSearchRows(deps, query) {
  const queryNorm = normalizeString(query);
  const mainDeps = getMainDeps(deps).slice().sort((a, b) => {
    const ca = parseInt(String(a.codigo || '0').replace(/\D/g, ''), 10) || 0;
    const cb = parseInt(String(b.codigo || '0').replace(/\D/g, ''), 10) || 0;
    return ca - cb;
  });
  const depsById = new Map((deps || []).filter((d) => d?.id).map((d) => [d.id, d]));
  const renderedDivIds = new Set();
  const rows = [];

  mainDeps.forEach((main) => {
    const divisions = getDivisiones(deps, main.id).slice().sort((a, b) => {
      const na = parseInt(String(a.numero || '0').replace(/\D/g, ''), 10) || 0;
      const nb = parseInt(String(b.numero || '0').replace(/\D/g, ''), 10) || 0;
      return na - nb;
    });
    const mainOk = depMatchesQuery(main, queryNorm, deps);
    const divMatches = divisions.filter((div) => depMatchesQuery(div, queryNorm, deps));
    if (!mainOk && !divMatches.length) return;

    rows.push({
      type: 'main',
      id: main.id,
      label: getDepDisplayLabel(main, deps).trim()
    });

    const renderDivs = mainOk ? divisions : divMatches;
    renderDivs.forEach((div) => {
      renderedDivIds.add(div.id);
      rows.push({
        type: 'division',
        id: div.id,
        label: getDepDisplayLabel(div, deps).trim(),
        parentId: main.id
      });
    });
  });

  const orphans = (deps || []).filter((d) => {
    if (!d?.parentId) return false;
    if (renderedDivIds.has(d.id)) return false;
    if (depsById.has(d.parentId)) return false;
    return depMatchesQuery(d, queryNorm, deps);
  });

  orphans.forEach((div) => {
    rows.push({
      type: 'division',
      id: div.id,
      label: getDepDisplayLabel(div, deps).trim(),
      orphan: true
    });
  });

  return rows;
}

export function parseTxtNuevoRepeticiones(value) {
  const n = parseInt(String(value == null ? '' : value).replace(/[^\d]/g, ''), 10);
  if (Number.isNaN(n) || n < 1) return 1;
  if (n > 999) return 999;
  return n;
}

export function expandTxtItemPorRepeticiones(item, repeticiones) {
  if (!item) return [];
  const n = parseTxtNuevoRepeticiones(repeticiones);
  let baseOrden = parseInt(String(item.orden == null ? '' : item.orden).replace(/[^\d]/g, ''), 10);
  if (Number.isNaN(baseOrden)) baseOrden = 0;
  const rows = [];
  for (let i = 0; i < n; i++) {
    rows.push(clampTxtNuevoItem({ ...item, orden: String(baseOrden + i) }));
  }
  return rows;
}

export function formatFechaHoraIso(isoString) {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

export function getTxtNuevoDefaultNames(registros) {
  const rep = registros[0] ? (registros[0].reparticion || '0') : '0';
  const dep = registros[0] ? (registros[0].dependencia || '0') : '0';
  const hab = registros[0] ? (registros[0].habitacion || '0') : '0';
  return {
    txt: `${rep}-${dep}-${hab}-txt-export`,
    word: `${rep}-${dep}-${hab}-modelo`
  };
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (e) => reject(e);
    reader.readAsText(file, 'utf-8');
  });
}

export function parseDependenciasTxt(text) {
  if (text == null) throw new Error('Archivo vacío.');
  const normalized = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n').map((l) => (l || '').trim()).filter(Boolean);
  if (!lines.length) throw new Error('No encontré líneas con datos.');

  function extractDigits(token) {
    return String(token || '').replace(/[^\d]/g, '');
  }

  function splitColumns(line) {
    return String(line || '')
      .split(/[\t;|,]+| {2,}/g)
      .map((s) => String(s || '').trim())
      .filter(Boolean);
  }

  const recordsById = new Map();
  let depCount = 0;
  let divCount = 0;
  let skipped = 0;
  const skippedExamples = [];

  lines.forEach((line, idx) => {
    let codigo = '';
    let numero = '';
    let nombreDep = '';
    let nombreDiv = '';

    const tokens = splitColumns(line);
    if (tokens?.length >= 3) {
      codigo = extractDigits(tokens[0]);
      if (codigo) {
        let numIdx = -1;
        for (let i = 1; i < tokens.length; i++) {
          const t = String(tokens[i] || '').trim();
          if (/^\d+$/.test(t)) { numIdx = i; break; }
        }
        if (numIdx !== -1) {
          numero = extractDigits(tokens[numIdx]);
          nombreDep = tokens.slice(1, numIdx).join(' ').trim();
          nombreDiv = tokens.slice(numIdx + 1).join(' ').trim();
        }
      }
    }

    if (!codigo || !numero || !nombreDep) {
      const m = String(line).match(/^\s*(\d+)\s+(.+?)\s+(\d+)(?:\s+(.+?))?\s*$/);
      if (m) {
        codigo = m[1] || '';
        nombreDep = (m[2] || '').trim();
        numero = extractDigits(m[3]);
        nombreDiv = (m[4] || '').trim();
      }
    }

    if (!codigo || !nombreDep || !numero) {
      skipped++;
      if (skippedExamples.length < 5) skippedExamples.push({ idx: idx + 1, line: line.slice(0, 120) });
      return;
    }

    codigo = codigo.replace(/\s+/g, '');
    numero = numero.replace(/\s+/g, '');
    const mainId = `txt-dep-${codigo}`;
    const divId = `${mainId}-div-${numero}`;
    const mainNombreNorm = nombreDep.toUpperCase();
    const divNombreNorm = nombreDiv.toUpperCase();

    if (!recordsById.has(mainId)) {
      recordsById.set(mainId, { id: mainId, nombre: mainNombreNorm, codigo, parentId: null, numero: null });
      depCount++;
    }
    const existingMain = recordsById.get(mainId);
    existingMain.nombre = mainNombreNorm;
    existingMain.codigo = codigo;

    if (numero && nombreDiv) {
      if (!recordsById.has(divId)) {
        recordsById.set(divId, { id: divId, nombre: divNombreNorm, codigo, parentId: mainId, numero });
        divCount++;
      } else {
        recordsById.get(divId).nombre = divNombreNorm;
      }
    }
  });

  return { records: Array.from(recordsById.values()), depCount, divCount, skipped, skippedExamples, total: lines.length };
}

export function parseDependenciasCsv(text) {
  if (text == null) throw new Error('Archivo vacío.');
  const normalized = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n').filter((l) => l != null && String(l).trim() !== '');
  if (!lines.length) throw new Error('No encontré líneas con datos.');

  function normalizeHeader(h) {
    return String(h || '').trim().toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_');
  }

  function splitCsvLine(line, delim) {
    const out = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; continue; }
        inQuotes = !inQuotes;
        continue;
      }
      if (!inQuotes && ch === delim) { out.push(cur); cur = ''; continue; }
      cur += ch;
    }
    out.push(cur);
    return out.map((s) => String(s || '').trim());
  }

  const headerLine = String(lines[0] || '');
  let delim = ',';
  if (headerLine.includes(';') && !headerLine.includes(',')) delim = ';';
  else if (headerLine.includes('\t')) delim = '\t';

  const headers = splitCsvLine(headerLine, delim).map(normalizeHeader);
  const idxId = headers.indexOf('id');
  const idxNombre = headers.indexOf('nombre');
  const idxCodigo = headers.indexOf('codigo');
  const idxNumero = headers.indexOf('numero');
  let idxParent = headers.indexOf('parent_id');
  if (idxParent === -1) idxParent = headers.indexOf('id_padre');
  if (idxParent === -1) idxParent = headers.indexOf('parentid');
  let idxNombreDiv = headers.indexOf('nombre_division');
  if (idxNombreDiv === -1) idxNombreDiv = headers.indexOf('nombre_divisiones');
  if (idxNombreDiv === -1) idxNombreDiv = headers.indexOf('division');
  if (idxNombreDiv === -1) idxNombreDiv = headers.indexOf('divisiones');
  if (idxNombreDiv === -1) idxNombreDiv = headers.indexOf('nombrediv');

  const hasFormatoCompleto = idxId !== -1 && idxNombre !== -1 && idxCodigo !== -1 && idxParent !== -1 && idxNumero !== -1;
  const hasFormatoSimple = idxId !== -1 && idxNombre !== -1 && idxParent !== -1 && idxNombreDiv !== -1;
  if (!hasFormatoCompleto && !hasFormatoSimple) {
    throw new Error(`CSV inválido: encabezados no reconocidos (${JSON.stringify(headers)}).`);
  }

  const recordsById = new Map();
  let depCount = 0;
  let divCount = 0;
  let skipped = 0;
  const skippedExamples = [];
  const inferredParents = new Map();

  function parseFromId(id) {
    const s = String(id || '').trim();
    const mDiv = s.match(/^dep-(\d+)-div-(\d+)$/i);
    if (mDiv) return { codigo: mDiv[1], numero: mDiv[2], parentId: `dep-${mDiv[1]}`, isDiv: true };
    const mDep = s.match(/^dep-(\d+)$/i);
    if (mDep) return { codigo: mDep[1], numero: null, parentId: null, isDiv: false };
    const mTxtDiv = s.match(/^txt-dep-(\d+)-div-(\d+)$/i);
    if (mTxtDiv) return { codigo: mTxtDiv[1], numero: mTxtDiv[2], parentId: `txt-dep-${mTxtDiv[1]}`, isDiv: true };
    const mTxtDep = s.match(/^txt-dep-(\d+)$/i);
    if (mTxtDep) return { codigo: mTxtDep[1], numero: null, parentId: null, isDiv: false };
    return { codigo: '', numero: null, parentId: null, isDiv: false };
  }

  for (let li = 1; li < lines.length; li++) {
    const line = String(lines[li] || '');
    if (!line.trim()) continue;
    const cols = splitCsvLine(line, delim);
    let id = cols[idxId] != null ? String(cols[idxId]).trim() : '';
    let nombre = cols[idxNombre] != null ? String(cols[idxNombre]).trim() : '';
    let codigo = hasFormatoCompleto ? (cols[idxCodigo] != null ? String(cols[idxCodigo]).trim() : '') : '';
    let parentId = cols[idxParent] != null ? String(cols[idxParent]).trim() : '';
    let numero = hasFormatoCompleto ? (cols[idxNumero] != null ? String(cols[idxNumero]).trim() : '') : '';
    const nombreDiv = idxNombreDiv !== -1 ? (cols[idxNombreDiv] != null ? String(cols[idxNombreDiv]).trim() : '') : '';

    if (!id) {
      skipped++;
      if (skippedExamples.length < 5) skippedExamples.push({ idx: li + 1, line: line.slice(0, 120) });
      continue;
    }

    if (!hasFormatoCompleto) {
      const parsed = parseFromId(id);
      if (!codigo) codigo = parsed.codigo || '';
      if (!numero) numero = parsed.numero || '';
      if (!parentId) parentId = parsed.parentId || '';
      if (parentId && nombreDiv) nombre = nombreDiv;
    }

    if (codigo) codigo = codigo.replace(/\s+/g, '');
    if (numero) numero = String(numero).replace(/\s+/g, '');
    if (parentId === '') parentId = null;
    if (numero === '') numero = null;
    if (parentId && nombreDiv) nombre = nombreDiv;

    if (!recordsById.has(id)) {
      recordsById.set(id, { id, nombre, codigo, parentId, numero });
      if (parentId) divCount++; else depCount++;
    } else {
      const prev = recordsById.get(id);
      recordsById.set(id, {
        id,
        nombre: nombre || prev.nombre,
        codigo: codigo || prev.codigo,
        parentId: parentId != null ? parentId : prev.parentId,
        numero: numero != null ? numero : prev.numero
      });
    }

    if (parentId && codigo) {
      const pId = String(parentId);
      if (!inferredParents.has(pId)) {
        const parentNombre = (cols[idxNombre] != null ? String(cols[idxNombre]).trim() : '') || `DEP ${codigo}`;
        inferredParents.set(pId, { id: pId, nombre: parentNombre, codigo });
      }
    }
  }

  inferredParents.forEach((p) => {
    if (!p?.id || recordsById.has(p.id)) return;
    recordsById.set(p.id, { id: p.id, nombre: p.nombre || '', codigo: p.codigo || '', parentId: null, numero: null });
    depCount++;
  });

  return {
    records: Array.from(recordsById.values()),
    depCount,
    divCount,
    skipped,
    skippedExamples,
    total: Math.max(0, lines.length - 1)
  };
}

export function isTxtRealizadosSchemaErrorMsg(msg) {
  const m = String(msg || '').toLowerCase();
  if (m.includes('no handler registered')) return false;
  if (m.includes('does not exist') && m.includes('txt_realizados')) return true;
  if (m.includes('schema cache') && m.includes('txt_realizados')) return true;
  if (m.includes('registros_json') && m.includes('column')) return true;
  if (m.includes('row-level security') || m.includes('row level security')) return true;
  if (m.includes('violates') && m.includes('policy')) return true;
  return m.includes('relation') && m.includes('txt_realizados');
}
