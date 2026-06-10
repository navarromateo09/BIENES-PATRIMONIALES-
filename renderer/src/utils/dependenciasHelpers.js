const TXT_ID_PREFIXES_EXCLUIR = ['txt-dep-'];

export function isTxtItem(dep) {
  if (!dep || dep.id == null) return false;
  const id = String(dep.id);
  return TXT_ID_PREFIXES_EXCLUIR.some((p) => id.indexOf(p) === 0);
}

export function getDisplayLabel(dep, deps) {
  if (!dep) return '';
  let codigo = (dep.codigo || '').toString().trim();
  const nombre = (dep.nombre || '').toString().trim();
  const numero = (dep.numero || '').toString().trim();
  if (dep.parentId && deps?.length) {
    const parent = deps.find((d) => d.id === dep.parentId);
    if (parent) codigo = (parent.codigo || '').toString().trim();
  }
  if (dep.parentId && numero) return `${codigo} - ${numero} - ${nombre}`;
  if (codigo && nombre) return `${codigo} - ${nombre}`;
  return nombre || codigo || '—';
}

export function getMainDeps(deps) {
  return (deps || []).filter((d) => !d.parentId);
}

export function getDivisiones(deps, parentId) {
  return (deps || []).filter((d) => d.parentId === parentId);
}

export function depMatchesBusqueda(dep, deps, busqueda, parent) {
  if (!busqueda) return true;
  const label = getDisplayLabel(dep, deps).toLowerCase();
  const nombre = (dep.nombre || '').toLowerCase();
  const codigo = (dep.codigo != null ? String(dep.codigo) : '').toLowerCase().trim();
  const numero = (dep.numero != null ? String(dep.numero) : '').toLowerCase().trim();
  const idCorto = dep.parentId && parent
    ? `${(parent.codigo != null ? String(parent.codigo) : '').trim().toLowerCase()}-${numero}`
    : codigo;
  const busquedaNorm = busqueda.replace(/\s/g, '').toLowerCase();
  const labelNorm = label.replace(/\s/g, '');
  const idCortoNorm = idCorto.replace(/\s/g, '');
  return label.indexOf(busqueda) >= 0 || nombre.indexOf(busqueda) >= 0
    || codigo.indexOf(busqueda) >= 0 || numero.indexOf(busqueda) >= 0
    || idCortoNorm.indexOf(busquedaNorm) >= 0 || labelNorm.indexOf(busquedaNorm) >= 0;
}

export function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .trim();
}

function splitCsvLine(line) {
  const out = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out.map((x) => String(x || '').trim());
}

function safeRead(record, keys) {
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (record[k] != null && String(record[k]).trim() !== '') return String(record[k]).trim();
  }
  return '';
}

export function parseDependenciasCsvImport(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    if (!cols.length) continue;
    const row = {};
    headers.forEach((h, idx) => { row[h] = cols[idx] != null ? cols[idx] : ''; });
    records.push(row);
  }

  const ts = Date.now().toString();
  const parsed = [];
  records.forEach((r, idx) => {
    const nombre = safeRead(r, ['nombre', 'name']).toUpperCase();
    const codigo = safeRead(r, ['codigo', 'cod', 'id_principal', 'codigo_principal']);
    const parentId = safeRead(r, ['parentid', 'parent_id', 'padre', 'dependencia_padre']) || null;
    const numero = safeRead(r, ['numero', 'num', 'nro', 'n']);
    let id = safeRead(r, ['id']);
    if (!nombre) return;
    if (!id) {
      const base = slugify(`${codigo ? `${codigo}-` : ''}${nombre}`) || `fila-${idx}`;
      id = `impdep-${ts}-${base}`;
    }
    parsed.push({ id, nombre, codigo: codigo || '', parentId, numero: numero || '' });
  });
  return parsed;
}

export function parseDependenciasTxtImport(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const ts = Date.now().toString();
  const records = [];
  const stack = [];
  let rowIdx = 0;

  lines.forEach((rawLine) => {
    if (!rawLine || !rawLine.trim()) return;
    if (rawLine.trim().indexOf('#') === 0) return;

    const indentMatch = rawLine.match(/^\s*/);
    const indent = indentMatch ? indentMatch[0] : '';
    const level = Math.floor(indent.replace(/\t/g, '  ').length / 2);

    const line = rawLine.trim().replace(/^[-*]\s*/, '');
    if (!line) return;

    const parts = line.split('|').map((x) => String(x || '').trim());
    const nombre = (parts[0] || '').toUpperCase();
    const codigo = parts[1] || '';
    const numero = parts[2] || '';
    if (!nombre) return;

    while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
    const parentId = stack.length ? stack[stack.length - 1].id : null;
    const base = slugify(`${codigo ? `${codigo}-` : ''}${nombre}`) || `fila-${rowIdx}`;
    const id = `impdep-${ts}-${rowIdx}-${base}`;
    rowIdx++;

    records.push({ id, nombre, codigo, parentId, numero });
    stack.push({ level, id });
  });

  return records;
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = (e) => reject(e);
    reader.readAsText(file, 'utf-8');
  });
}

export function formatFechaEnvios(fechaStr) {
  if (!fechaStr) return '—';
  const d = new Date(fechaStr);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(-2)}`;
}

export function formatFechaYHora(fechaStr) {
  if (!fechaStr) return '—';
  const d = new Date(fechaStr);
  if (Number.isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${h}:${min}`;
}

export function buildEnviosData(dep, deps, cachedData) {
  const label = getDisplayLabel(dep, deps);
  const salidas = (cachedData.movimientos || []).filter(
    (m) => m.tipo === 'salida' && ((m.destino || '').trim() === label)
  );
  salidas.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));

  const provisionesGuardia = (cachedData.guardiaProvisiones || []).filter(
    (p) => p.dependencia_id === dep.id
  );
  provisionesGuardia.sort((a, b) => new Date(b.fecha_asignacion || 0) - new Date(a.fecha_asignacion || 0));

  function getProductoNombre(productoId) {
    if (!productoId) return 'producto';
    const p = (cachedData.productos || []).find((x) => x.id === productoId);
    return (p && (p.nombre || p.codigo)) ? (p.nombre || p.codigo) : 'producto';
  }

  const salidaItems = salidas.map((m) => ({
    type: 'salida',
    cantidad: m.cantidad != null ? String(m.cantidad) : '—',
    producto: getProductoNombre(m.productoId),
    fecha: formatFechaEnvios(m.fecha)
  }));

  const provisionItems = provisionesGuardia.map((p) => {
    const prod = (cachedData.productos || []).find((x) => x.id === p.producto_id);
    let nombre = '—';
    let codigo = '—';
    let caracteristicas = '—';
    const expediente = prod ? ((prod.codigo != null ? String(prod.codigo) : '').trim() || '—') : '—';

    if (p.movimiento_id && (cachedData.movimientos || []).length) {
      const mov = (cachedData.movimientos || []).find((x) => x.id === p.movimiento_id);
      if (mov) {
        nombre = (mov.nombre != null ? String(mov.nombre).trim() : '') || '—';
        codigo = (mov.numeroSerie != null ? String(mov.numeroSerie).trim() : '') || '—';
        const carParts = [];
        const marca = (mov.marca != null ? String(mov.marca) : '').trim();
        const serie = (mov.numeroSerie != null ? String(mov.numeroSerie) : '').trim();
        const concepto = (mov.concepto != null ? String(mov.concepto) : '').trim();
        if (marca) carParts.push(`Marca: ${marca}`);
        if (serie) carParts.push(`Serie: ${serie}`);
        if (concepto) carParts.push(concepto);
        caracteristicas = carParts.join(' · ') || '—';
      }
    } else {
      nombre = prod ? ((prod.nombre != null ? String(prod.nombre).trim() : '') || 'Expediente completo') : '—';
      codigo = expediente;
      caracteristicas = prod ? ((prod.descripcion != null ? String(prod.descripcion).trim() : '') || '—') : '—';
    }

    return {
      type: 'provision',
      nombre,
      codigo,
      expediente,
      caracteristicas,
      cantidad: p.cantidad != null ? p.cantidad : 1,
      diaEntrega: formatFechaYHora(p.fecha_asignacion)
    };
  });

  return { label, salidaItems, provisionItems, total: salidaItems.length + provisionItems.length };
}

/** Filas planas para la tabla (main, division, subdivision). */
export function buildTableRows(deps, busqueda, expandedDepIds) {
  const q = (busqueda || '').trim().toLowerCase();
  const rows = [];
  const mainDeps = getMainDeps(deps);

  mainDeps.forEach((d) => {
    const divisiones = getDivisiones(deps, d.id);
    const mainMatch = depMatchesBusqueda(d, deps, q, null);
    const divisionesFiltradas = q
      ? divisiones.filter((div) => {
        if (depMatchesBusqueda(div, deps, q, d)) return true;
        return getDivisiones(deps, div.id).some((sub) => depMatchesBusqueda(sub, deps, q, div));
      })
      : divisiones;
    const algunaDivisionMatch = divisionesFiltradas.length > 0;
    if (q && !mainMatch && !algunaDivisionMatch) return;

    const isExpanded = !!expandedDepIds[d.id];
    const divisionesARenderizar = q && !mainMatch ? divisionesFiltradas : divisiones;

    rows.push({
      kind: 'main',
      dep: d,
      label: getDisplayLabel(d, deps),
      hasChildren: divisiones.length > 0,
      isExpanded
    });

    divisionesARenderizar.forEach((div) => {
      const subDivs = getDivisiones(deps, div.id);
      const subDivsARenderizar = q
        ? subDivs.filter((sub) => depMatchesBusqueda(sub, deps, q, div))
        : subDivs;
      const hidden = !isExpanded;

      rows.push({
        kind: 'division',
        dep: div,
        parentId: d.id,
        label: getDisplayLabel(div, deps),
        hidden,
        hasSubDivs: subDivsARenderizar.length > 0
      });

      subDivsARenderizar.forEach((subDiv) => {
        rows.push({
          kind: 'subdivision',
          dep: subDiv,
          parentId: div.id,
          label: getDisplayLabel(subDiv, deps),
          hidden
        });
      });
    });
  });

  return rows;
}
