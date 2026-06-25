const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
/** Si falta en el instalador, la app debe abrir igual (sin auto-actualización). */
let autoUpdater = null;
try {
  autoUpdater = require('electron-updater').autoUpdater;
} catch (e) {
  console.warn('[AutoUpdate] electron-updater no disponible:', e && e.message);
}
const path = require('path');
const { pathToFileURL } = require('url');
const fs = require('fs');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');

let supabase;
try {
  const config = require('./supabase-config.js');
  supabase = createClient(config.url, config.anonKey);
} catch (e) {
  console.warn('Supabase no configurado (falta supabase-config.js). Usando datos locales.');
  supabase = null;
}

const DATA_FILE = path.join(app.getPath('userData'), 'stock-data.json');
const DEPOSITO_DATA_FILE = path.join(app.getPath('userData'), 'deposito-data.json');
const AUTH_FILE = path.join(app.getPath('userData'), 'auth.json');
const SESSION_FILE = path.join(app.getPath('userData'), 'auth-session.json');
/** Sin teclado/ratón durante este tiempo → cerrar sesión (minutos → ms). */
const SESSION_IDLE_MS = 10 * 60 * 1000;
let lastSessionActivity = Date.now();
const TXT_ORDEN_FILE = path.join(app.getPath('userData'), 'txt-orden.json');
const AUDIT_LOG_FILE = path.join(app.getPath('userData'), 'audit-log.json');
const ACTAS_ATTACHMENTS_FILE = path.join(app.getPath('userData'), 'actas-adjuntos.json');
const ACTAS_ATTACHMENTS_DIR = path.join(app.getPath('userData'), 'actas-adjuntos');
const ACTAS_ATTACHMENTS_BUCKET = 'actas-adjuntos';
const ACTAS_ATTACHMENTS_TABLE = 'actas_adjuntos';

function loadAuditLog() {
  try {
    if (fs.existsSync(AUDIT_LOG_FILE)) {
      const raw = fs.readFileSync(AUDIT_LOG_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return data;
    }
  } catch (_) {}
  return [];
}

function saveAuditLog(entries) {
  const safe = Array.isArray(entries) ? entries : [];
  fs.writeFileSync(AUDIT_LOG_FILE, JSON.stringify(safe, null, 2), 'utf-8');
}

async function logAudit(accion, modulo, detalle, entidadId) {
  const session = loadSession();
  const usuario = session && session.username ? session.username : 'sistema';
  const entry = {
    id: Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8),
    fecha: new Date().toISOString(),
    usuario: usuario,
    accion: accion,
    modulo: modulo,
    detalle: detalle || '',
    entidadId: entidadId || null
  };

  if (supabase) {
    try {
      await supabase.from('audit_log').insert({
        id: entry.id,
        fecha: entry.fecha,
        usuario: entry.usuario,
        accion: entry.accion,
        modulo: entry.modulo,
        detalle: entry.detalle,
        entidad_id: entry.entidadId
      });
    } catch (e) {
      console.warn('[Audit] Error al guardar en Supabase:', e && e.message);
    }
  }

  try {
    const log = loadAuditLog();
    log.unshift(entry);
    if (log.length > 5000) log.length = 5000;
    saveAuditLog(log);
  } catch (e) {
    console.warn('[Audit] Error al guardar localmente:', e && e.message);
  }
}

function loadTxtOrdenCounts() {
  try {
    if (fs.existsSync(TXT_ORDEN_FILE)) {
      const raw = fs.readFileSync(TXT_ORDEN_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (data && typeof data === 'object') return data;
    }
  } catch (e) { /* ignore */ }
  return {};
}

function saveTxtOrdenCounts(counts) {
  const safe = counts && typeof counts === 'object' ? counts : {};
  fs.writeFileSync(TXT_ORDEN_FILE, JSON.stringify(safe, null, 2), 'utf-8');
}

async function syncTxtOrdenLocalToSupabase() {
  if (!supabase) return;
  try {
    // Traer todos los conteos remotos
    const { data, error } = await supabase
      .from('txt_orden_counts')
      .select('id, count, updated_at');
    const remote = {};
    if (!error && Array.isArray(data)) {
      data.forEach(function (row) {
        if (!row || row.id == null) return;
        const n = parseInt(row.count, 10);
        remote[String(row.id)] = {
          count: isNaN(n) ? 0 : Math.max(0, n),
          updatedAt: row.updated_at ? String(row.updated_at) : null
        };
      });
    }

    // Mezclar con los locales tomando siempre el máximo
    const local = loadTxtOrdenCounts();
    const merged = {};
    const allIds = new Set([
      ...Object.keys(local || {}),
      ...Object.keys(remote || {})
    ]);

    allIds.forEach(function (id) {
      const loc = getTxtOrdenEntry(local, id);
      const rem = remote[id] || { count: 0, updatedAt: null };
      const bestCount = Math.max(loc.count || 0, rem.count || 0);
      const updatedAt =
        loc.updatedAt && rem.updatedAt
          ? (new Date(loc.updatedAt) > new Date(rem.updatedAt) ? loc.updatedAt : rem.updatedAt)
          : (loc.updatedAt || rem.updatedAt || new Date().toISOString());
      merged[id] = { count: bestCount, updatedAt };
    });

    // Guardar localmente el resultado fusionado
    saveTxtOrdenCounts(merged);

    // Y subirlo a Supabase (solo si hay algo que guardar)
    const entries = Object.keys(merged || {}).map(function (id) {
      const entry = merged[id];
      return {
        id: String(id),
        count: entry.count,
        updated_at: entry.updatedAt || new Date().toISOString()
      };
    });
    if (entries.length) {
      await supabase.from('txt_orden_counts').upsert(entries, { onConflict: 'id' });
    }
  } catch (e) {
    console.warn('[TXT] No se pudo sincronizar órdenes con Supabase:', e && e.message);
  }
}

function loadActasAdjuntos() {
  try {
    if (fs.existsSync(ACTAS_ATTACHMENTS_FILE)) {
      const raw = fs.readFileSync(ACTAS_ATTACHMENTS_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (data && typeof data === 'object') return data;
    }
  } catch (_) {}
  return {};
}

function saveActasAdjuntos(map) {
  const safe = map && typeof map === 'object' ? map : {};
  fs.writeFileSync(ACTAS_ATTACHMENTS_FILE, JSON.stringify(safe, null, 2), 'utf-8');
}

function mergeActasAdjuntos(actas, providedMap) {
  const map = providedMap && typeof providedMap === 'object' ? providedMap : loadActasAdjuntos();
  return (Array.isArray(actas) ? actas : []).map(function (a) {
    const id = a && a.id ? String(a.id) : '';
    const meta = id ? map[id] : null;
    if (!meta) return a;
    if (meta.path && !fs.existsSync(meta.path)) return a;
    return Object.assign({}, a, {
      adjunto: {
        name: meta.originalName || (meta.path ? path.basename(meta.path) : 'adjunto'),
        updatedAt: meta.updatedAt || null
      }
    });
  });
}

async function getActasAdjuntosMapFromSupabase() {
  const map = {};
  if (!supabase) return map;
  try {
    const { data, error } = await supabase
      .from(ACTAS_ATTACHMENTS_TABLE)
      .select('acta_id, file_path, original_name, updated_at');
    if (error || !Array.isArray(data)) return map;
    data.forEach(function (r) {
      const id = r && r.acta_id ? String(r.acta_id) : '';
      if (!id) return;
      map[id] = {
        filePath: r.file_path || null,
        originalName: r.original_name || null,
        updatedAt: r.updated_at || null
      };
    });
    return map;
  } catch (_) {
    return map;
  }
}

async function removeActaAdjunto(actaId) {
  const id = actaId ? String(actaId) : '';
  if (!id) return;
  if (supabase) {
    try {
      const { data: rows } = await supabase
        .from(ACTAS_ATTACHMENTS_TABLE)
        .select('file_path')
        .eq('acta_id', id)
        .limit(1);
      const filePath = rows && rows[0] ? rows[0].file_path : null;
      if (filePath) {
        try { await supabase.storage.from(ACTAS_ATTACHMENTS_BUCKET).remove([filePath]); } catch (_) {}
      }
      try { await supabase.from(ACTAS_ATTACHMENTS_TABLE).delete().eq('acta_id', id); } catch (_) {}
    } catch (_) {}
    return;
  }
  const map = loadActasAdjuntos();
  const meta = map[id];
  if (meta && meta.path && fs.existsSync(meta.path)) {
    try { fs.unlinkSync(meta.path); } catch (_) {}
  }
  delete map[id];
  saveActasAdjuntos(map);
}

function getTxtOrdenEntry(counts, id) {
  const k = String(id);
  const raw = counts && typeof counts === 'object' ? counts[k] : undefined;
  if (raw == null) return { count: 0, updatedAt: null };
  if (typeof raw === 'number' || typeof raw === 'string') {
    const n = parseInt(raw, 10);
    return { count: isNaN(n) ? 0 : Math.max(0, n), updatedAt: null };
  }
  if (raw && typeof raw === 'object') {
    const n = parseInt(raw.count, 10);
    const updatedAt = raw.updatedAt ? String(raw.updatedAt) : null;
    return { count: isNaN(n) ? 0 : Math.max(0, n), updatedAt };
  }
  return { count: 0, updatedAt: null };
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password, 'utf8').digest('hex');
}

function loadAuth() {
  try {
    const raw = fs.readFileSync(AUTH_FILE, 'utf-8');
    const data = JSON.parse(raw);
    if (data && data.username && data.passwordHash) return data;
  } catch (e) { /* no auth yet */ }
  return null;
}

function saveAuth(username, passwordHash) {
  fs.writeFileSync(AUTH_FILE, JSON.stringify({ username, passwordHash }, null, 2), 'utf-8');
}

function loadSession() {
  try {
    const raw = fs.readFileSync(SESSION_FILE, 'utf-8');
    const data = JSON.parse(raw);
    if (data && data.username) return data;
  } catch (e) { /* no session */ }
  return null;
}

function saveSession(username, rol) {
  const r = rol || 'usuario';
  fs.writeFileSync(SESSION_FILE, JSON.stringify({ username, rol: r }, null, 2), 'utf-8');
  lastSessionActivity = Date.now();
}

function touchSessionActivity() {
  lastSessionActivity = Date.now();
}

function clearSession() {
  try {
    if (fs.existsSync(SESSION_FILE)) fs.unlinkSync(SESSION_FILE);
  } catch (e) { /* ignore */ }
}

function ensureAdminSession(message) {
  const session = loadSession();
  if (!session || !session.username || (session.rol || 'usuario') !== 'admin') {
    throw new Error(message || 'No autorizado');
  }
  return session;
}

function isAdminSession() {
  const session = loadSession();
  return !!(session && session.username && (session.rol || 'usuario') === 'admin');
}

async function expireSessionIfIdle() {
  const sess = loadSession();
  if (!sess || !sess.username) return;
  if (Date.now() - lastSessionActivity < SESSION_IDLE_MS) return;
  try {
    await logAudit('LOGOUT', 'Sesión', 'Sesión cerrada por inactividad');
  } catch (_) {}
  clearSession();
  BrowserWindow.getAllWindows().forEach(function (win) {
    if (win && !win.isDestroyed() && win.webContents) {
      try { win.webContents.send('session-expired'); } catch (_) {}
    }
  });
}

function rowToProducto(row) {
  if (!row) return null;
  return {
    id: row.id,
    codigo: row.codigo ?? undefined,
    nombre: row.nombre ?? undefined,
    descripcion: row.descripcion ?? undefined,
    numeroSerie: row.numero_serie ?? undefined,
    stockActual: row.stock_actual ?? 0,
    unidad: row.unidad ?? 'unidades',
    marca: row.marca ?? undefined,
    solicitadoPor: row.solicitado_por ?? undefined,
    anio: row.anio ?? undefined
  };
}

function productoToRow(p) {
  const row = {
    id: p.id,
    codigo: p.codigo || null,
    nombre: p.nombre || null,
    descripcion: p.descripcion || null,
    numero_serie: p.numeroSerie || null,
    stock_actual: p.stockActual ?? 0,
    unidad: p.unidad || 'unidades',
    marca: p.marca || null
  };
  if (p.solicitadoPor != null && p.solicitadoPor !== '') row.solicitado_por = p.solicitadoPor;
  if (p.anio != null && p.anio !== '') row.anio = p.anio;
  return row;
}

function rowToMovimiento(row) {
  if (!row) return null;
  return {
    id: row.id,
    tipo: row.tipo,
    productoId: row.producto_id ?? null,
    cantidad: row.cantidad,
    fecha: row.fecha,
    numeroSerie: row.numero_serie ?? undefined,
    nombre: row.nombre ?? undefined,
    marca: row.marca ?? undefined,
    concepto: row.concepto ?? undefined,
    destino: row.destino ?? undefined,
    usuario: row.usuario ?? undefined
  };
}

function movimientoToRow(m) {
  return {
    id: m.id,
    tipo: m.tipo,
    producto_id: m.productoId ?? null,
    cantidad: m.cantidad,
    fecha: m.fecha,
    numero_serie: m.numeroSerie || null,
    nombre: m.nombre || null,
    marca: m.marca || null,
    concepto: m.concepto || null,
    destino: m.destino || null,
    usuario: m.usuario || null
  };
}

async function fetchAllRows(table, orderCol, ascending) {
  if (!supabase) return [];
  const PAGE = 1000;
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order(orderCol, { ascending: ascending !== false })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || !data.length) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function loadData() {
  if (!supabase) {
    try {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (!parsed.dependencias) parsed.dependencias = [];
      if (!parsed.txtDependencias) parsed.txtDependencias = [];
      if (!parsed.txtRealizados) parsed.txtRealizados = [];
      if (!parsed.guardiaProvisiones) parsed.guardiaProvisiones = [];
      if (!parsed.actas) parsed.actas = [];
      if (!parsed.matafuegos) parsed.matafuegos = [];
      if (parsed.productos && Array.isArray(parsed.productos)) {
        parsed.productos = parsed.productos.map(function (p) {
          return Object.assign({}, p, { anio: p.anio != null && p.anio !== '' ? p.anio : undefined });
        });
      }
      parsed.actas = mergeActasAdjuntos(parsed.actas);
      return parsed;
    } catch (e) {
      return { productos: [], movimientos: [], dependencias: [], txtDependencias: [], txtRealizados: [], guardiaProvisiones: [], actas: [], matafuegos: [] };
    }
  }
  try {
    const [rawProductos, rawMovimientos, rawDependencias, rawTxtDependencias] = await Promise.all([
      fetchAllRows('productos', 'id', true),
      fetchAllRows('movimientos', 'fecha', false),
      fetchAllRows('dependencias', 'id', true),
      fetchAllRows('txt_dependencias', 'id', true)
    ]);
    let guardiaProvisiones = [];
    try {
      const rawGuardia = await fetchAllRows('guardia_provision', 'fecha_asignacion', false);
      guardiaProvisiones = rawGuardia.map(r => ({
        id: r.id,
        dependencia_id: r.dependencia_id,
        producto_id: r.producto_id,
        movimiento_id: r.movimiento_id || null,
        fecha_asignacion: r.fecha_asignacion,
        cantidad: r.cantidad != null ? r.cantidad : 1,
        concepto: r.concepto || null,
        usuario: r.usuario || null
      }));
    } catch (_) { /* tabla guardia_provision puede no existir aún */ }
    const productos = rawProductos.map(rowToProducto);
    const movimientos = rawMovimientos.map(rowToMovimiento);
    const dependencias = rawDependencias.map(r => ({
      id: r.id,
      nombre: r.nombre || '',
      codigo: r.codigo != null ? String(r.codigo) : '',
      parentId: r.parent_id ?? null,
      numero: r.numero != null ? String(r.numero) : ''
    }));
    const txtDependencias = rawTxtDependencias.map(r => ({
      id: r.id,
      nombre: r.nombre || '',
      codigo: r.codigo != null ? String(r.codigo) : '',
      parentId: r.parent_id ?? null,
      numero: r.numero != null ? String(r.numero) : ''
    }));
    let txtRealizados = [];
    try {
      const rawTxtRealizados = await fetchAllRows('txt_realizados', 'updated_at', false);
      txtRealizados = rawTxtRealizados.map(r => {
        let registros = [];
        if (Array.isArray(r.registros_json)) registros = r.registros_json;
        else if (typeof r.registros_json === 'string') {
          try { registros = JSON.parse(r.registros_json); } catch (_) { registros = []; }
        }
        if (!Array.isArray(registros)) registros = [];
        return {
          id: r.id,
          nombre: r.nombre || '',
          registros,
          createdAt: r.created_at || null,
          updatedAt: r.updated_at || null
        };
      });
    } catch (_) { /* tabla txt_realizados puede no existir aún */ }
    let actas = [];
    try {
      const rawActas = await fetchAllRows('actas', 'fecha', false);
      actas = rawActas.map(r => {
        let seriales = r.seriales;
        if (typeof seriales === 'string') try { seriales = JSON.parse(seriales); } catch (_) { seriales = []; }
        if (!Array.isArray(seriales)) seriales = [];
        return {
          id: r.id,
          fecha: r.fecha,
          dependencia_id: r.dependencia_id,
          depLabel: r.dep_label || '',
          productLabel: r.product_label || '',
          expediente: r.expediente || '',
          cantidad: r.cantidad != null ? r.cantidad : 1,
          seriales,
          concepto: r.concepto || null,
          provision_id: r.provision_id || null
        };
      });
    } catch (_) {
      actas = loadActasFromFile();
    }
    let matafuegos = [];
    try {
      const rawMatafuegos = await fetchAllRows('matafuegos', 'created_at', false);
      matafuegos = rawMatafuegos.map(r => ({
        id: r.id,
        marca: r.marca || null,
        numeroSerie: r.numero_serie || '',
        caracteristicas: r.caracteristicas || null,
        fechaVencimiento: r.fecha_vencimiento || null,
        estado: normalizeMatafuegoEstadoFromDb(r.estado || 'disponible', r.dependencia_id || null),
        fechaIngreso: r.fecha_ingreso || null,
        dependenciaId: r.dependencia_id || null,
        fechaEntrega: r.fecha_entrega || null,
        createdAt: r.created_at || null
      }));
    } catch (_) { /* tabla matafuegos puede no existir aún */ }
    const remoteAdjuntos = await getActasAdjuntosMapFromSupabase();
    actas = mergeActasAdjuntos(actas, remoteAdjuntos);
    return { productos, movimientos, dependencias, txtDependencias, txtRealizados, guardiaProvisiones, actas, matafuegos };
  } catch (e) {
    console.error('Supabase loadData error', e);
    return { productos: [], movimientos: [], dependencias: [], txtDependencias: [], txtRealizados: [], guardiaProvisiones: [], actas: [], matafuegos: [] };
  }
}

function mapRawMatafuegoRows(rawMatafuegos) {
  return (rawMatafuegos || []).map(function (r) {
    return {
      id: r.id,
      marca: r.marca || null,
      numeroSerie: r.numero_serie || '',
      caracteristicas: r.caracteristicas || null,
      fechaVencimiento: r.fecha_vencimiento || null,
      estado: normalizeMatafuegoEstadoFromDb(r.estado || 'disponible', r.dependencia_id || null),
      fechaIngreso: r.fecha_ingreso || null,
      dependenciaId: r.dependencia_id || null,
      fechaEntrega: r.fecha_entrega || null,
      createdAt: r.created_at || null
    };
  });
}

async function fetchAuditLogMatafuegos(limit) {
  const max = limit != null ? limit : 2000;
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .eq('modulo', 'Matafuegos')
        .order('fecha', { ascending: false })
        .limit(max);
      if (!error && data) {
        return data.map(function (r) {
          return {
            id: r.id,
            fecha: r.fecha,
            usuario: r.usuario,
            accion: r.accion,
            modulo: r.modulo,
            detalle: r.detalle,
            entidadId: r.entidad_id
          };
        });
      }
    } catch (_) { /* fallback local */ }
  }
  return loadAuditLog()
    .filter(function (e) { return e && e.modulo === 'Matafuegos'; })
    .sort(function (a, b) { return String(b.fecha || '').localeCompare(String(a.fecha || '')); })
    .slice(0, max);
}

async function fetchMatafuegosRecargandoAuditEntries() {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('audit_log')
        .select('fecha, detalle, entidad_id')
        .eq('modulo', 'Matafuegos')
        .ilike('detalle', 'MATAFUEGO_RECARGANDO|%')
        .order('fecha', { ascending: true })
        .limit(5000);
      if (!error && data) {
        return data.map(function (r) {
          return { fecha: r.fecha, detalle: r.detalle, entidadId: r.entidad_id };
        });
      }
    } catch (_) {}
  }
  return loadAuditLog()
    .filter(function (e) {
      return e && e.modulo === 'Matafuegos' && String(e.detalle || '').indexOf('MATAFUEGO_RECARGANDO|') === 0;
    })
    .sort(function (a, b) { return String(a.fecha || '').localeCompare(String(b.fecha || '')); });
}

/** Carga ligera para la pantalla Matafuegos (sin productos, movimientos, actas, etc.). */
async function loadMatafuegosBundle() {
  if (!supabase) {
    const data = await loadData();
    const auditAll = await fetchAuditLogMatafuegos(2000);
    const recEntries = await fetchMatafuegosRecargandoAuditEntries();
    return {
      matafuegos: data.matafuegos || [],
      dependencias: filterDependenciasParaEntregasStock(data.dependencias || [], data.txtDependencias || []),
      txtDependencias: data.txtDependencias || [],
      auditLog: auditAll,
      recargandoMap: buildMatafuegosRecargandoMap(recEntries)
    };
  }
  try {
    const [rawMatafuegos, rawDependencias, rawTxtDependencias, auditLog, recEntries] = await Promise.all([
      fetchAllRows('matafuegos', 'created_at', false),
      fetchAllRows('dependencias', 'id', true),
      fetchAllRows('txt_dependencias', 'id', true),
      fetchAuditLogMatafuegos(2000),
      fetchMatafuegosRecargandoAuditEntries()
    ]);
    const dependencias = (rawDependencias || []).map(function (r) {
      return {
        id: r.id,
        nombre: r.nombre || '',
        codigo: r.codigo != null ? String(r.codigo) : '',
        parentId: r.parent_id ?? null,
        numero: r.numero != null ? String(r.numero) : ''
      };
    });
    const txtDependencias = (rawTxtDependencias || []).map(function (r) {
      return {
        id: r.id,
        nombre: r.nombre || '',
        codigo: r.codigo != null ? String(r.codigo) : '',
        parentId: r.parent_id ?? null,
        numero: r.numero != null ? String(r.numero) : ''
      };
    });
    return {
      matafuegos: mapRawMatafuegoRows(rawMatafuegos),
      dependencias: filterDependenciasParaEntregasStock(dependencias, txtDependencias),
      txtDependencias: txtDependencias,
      auditLog: auditLog,
      recargandoMap: buildMatafuegosRecargandoMap(recEntries)
    };
  } catch (e) {
    console.error('Supabase loadMatafuegosBundle error', e);
    return { matafuegos: [], dependencias: [], txtDependencias: [], auditLog: [], recargandoMap: {} };
  }
}

function mapDependenciasFromRaw(rawDependencias, rawTxtDependencias) {
  const dependencias = (rawDependencias || []).map(function (r) {
    return {
      id: r.id,
      nombre: r.nombre || '',
      codigo: r.codigo != null ? String(r.codigo) : '',
      parentId: r.parent_id ?? null,
      numero: r.numero != null ? String(r.numero) : ''
    };
  });
  const txtDependencias = (rawTxtDependencias || []).map(function (r) {
    return {
      id: r.id,
      nombre: r.nombre || '',
      codigo: r.codigo != null ? String(r.codigo) : '',
      parentId: r.parent_id ?? null,
      numero: r.numero != null ? String(r.numero) : ''
    };
  });
  return {
    dependencias: filterDependenciasParaEntregasStock(dependencias, txtDependencias),
    txtDependencias: txtDependencias
  };
}

async function fetchGuardiaProvisionesOnly() {
  if (!supabase) {
    const data = await loadData();
    return data.guardiaProvisiones || [];
  }
  try {
    const rawGuardia = await fetchAllRows('guardia_provision', 'fecha_asignacion', false);
    return rawGuardia.map(function (r) {
      return {
        id: r.id,
        dependencia_id: r.dependencia_id,
        producto_id: r.producto_id,
        movimiento_id: r.movimiento_id || null,
        fecha_asignacion: r.fecha_asignacion,
        cantidad: r.cantidad != null ? r.cantidad : 1,
        concepto: r.concepto || null,
        usuario: r.usuario || null
      };
    });
  } catch (_) {
    return [];
  }
}

/** Inventario / entregas: productos, movimientos, guardia y dependencias (sin actas, TXT, etc.). */
async function loadProductosBundle() {
  if (!supabase) {
    const data = await loadData();
    return {
      productos: data.productos || [],
      movimientos: data.movimientos || [],
      guardiaProvisiones: data.guardiaProvisiones || [],
      dependencias: filterDependenciasParaEntregasStock(data.dependencias || [], data.txtDependencias || [])
    };
  }
  try {
    const [rawProductos, rawMovimientos, rawDependencias, rawTxtDependencias, guardiaProvisiones] = await Promise.all([
      fetchAllRows('productos', 'id', true),
      fetchAllRows('movimientos', 'fecha', false),
      fetchAllRows('dependencias', 'id', true),
      fetchAllRows('txt_dependencias', 'id', true),
      fetchGuardiaProvisionesOnly()
    ]);
    const deps = mapDependenciasFromRaw(rawDependencias, rawTxtDependencias);
    return {
      productos: rawProductos.map(rowToProducto),
      movimientos: rawMovimientos.map(rowToMovimiento),
      guardiaProvisiones: guardiaProvisiones,
      dependencias: deps.dependencias
    };
  } catch (e) {
    console.error('Supabase loadProductosBundle error', e);
    return { productos: [], movimientos: [], guardiaProvisiones: [], dependencias: [] };
  }
}

/** Gestión dependencias: envíos por dependencia (sin actas ni matafuegos). */
async function loadDependenciasStatsBundle() {
  if (!supabase) {
    const data = await loadData();
    return {
      productos: data.productos || [],
      movimientos: data.movimientos || [],
      guardiaProvisiones: data.guardiaProvisiones || []
    };
  }
  try {
    const [rawProductos, rawMovimientos, guardiaProvisiones] = await Promise.all([
      fetchAllRows('productos', 'id', true),
      fetchAllRows('movimientos', 'fecha', false),
      fetchGuardiaProvisionesOnly()
    ]);
    return {
      productos: rawProductos.map(rowToProducto),
      movimientos: rawMovimientos.map(rowToMovimiento),
      guardiaProvisiones: guardiaProvisiones
    };
  } catch (e) {
    console.error('Supabase loadDependenciasStatsBundle error', e);
    return { productos: [], movimientos: [], guardiaProvisiones: [] };
  }
}

/** Inicio: métricas y notificaciones sin cargar actas ni TXT realizados. */
async function loadDashboardBundle() {
  if (!supabase) {
    const data = await loadData();
    return {
      productos: data.productos || [],
      movimientos: data.movimientos || [],
      guardiaProvisiones: data.guardiaProvisiones || [],
      dependencias: filterDependenciasParaEntregasStock(data.dependencias || [], data.txtDependencias || []),
      matafuegos: data.matafuegos || []
    };
  }
  try {
    const [rawProductos, rawMovimientos, rawDependencias, rawTxtDependencias, rawMatafuegos, guardiaProvisiones] = await Promise.all([
      fetchAllRows('productos', 'id', true),
      fetchAllRows('movimientos', 'fecha', false),
      fetchAllRows('dependencias', 'id', true),
      fetchAllRows('txt_dependencias', 'id', true),
      fetchAllRows('matafuegos', 'created_at', false),
      fetchGuardiaProvisionesOnly()
    ]);
    const deps = mapDependenciasFromRaw(rawDependencias, rawTxtDependencias);
    return {
      productos: rawProductos.map(rowToProducto),
      movimientos: rawMovimientos.map(rowToMovimiento),
      guardiaProvisiones: guardiaProvisiones,
      dependencias: deps.dependencias,
      matafuegos: mapRawMatafuegoRows(rawMatafuegos)
    };
  } catch (e) {
    console.error('Supabase loadDashboardBundle error', e);
    return { productos: [], movimientos: [], guardiaProvisiones: [], dependencias: [], matafuegos: [] };
  }
}

function normalizeMatafuegoEstadoFromDb(estado, dependenciaId) {
  const s = String(estado || 'disponible').trim().toLowerCase();
  if (s === 'disponible' && dependenciaId) return 'entregado';
  if (s === 'para_recarga') return 'recarga';
  if (s === 'entregados') return 'entregado';
  return s || 'disponible';
}

function normalizeMatafuegoEstadoToDb(estado) {
  const appState = normalizeMatafuegoEstadoFromDb(estado);
  if (appState === 'recarga') return 'para_recarga';
  if (appState === 'entregado') return 'entregados';
  return appState;
}

function getMatafuegoEstadoDbCandidates(estado) {
  const appState = normalizeMatafuegoEstadoFromDb(estado);
  if (appState === 'recarga') return ['para_recarga', 'recarga', 'PARA_RECARGA', 'RECARGA'];
  // En el esquema actual de Supabase (según supabase-completo.sql),
  // estado solo admite 'disponible' o 'recarga'. "Entregado" se representa
  // como disponible + dependencia_id asignada.
  if (appState === 'entregado') return ['disponible', 'DISPONIBLE'];
  if (appState === 'inservible') return ['inservible', 'inservibles', 'INSERVIBLE', 'INSERVIBLES'];
  return ['disponible', 'disponibles', 'DISPONIBLE', 'DISPONIBLES'];
}

function mapMatafuegoRowDbToApp(r) {
  if (!r) return null;
  return {
    id: r.id,
    marca: r.marca || null,
    numeroSerie: r.numero_serie || '',
    caracteristicas: r.caracteristicas || null,
    fechaVencimiento: r.fecha_vencimiento || null,
    estado: normalizeMatafuegoEstadoFromDb(r.estado || 'disponible', r.dependencia_id || null),
    fechaIngreso: r.fecha_ingreso || null,
    dependenciaId: r.dependencia_id || null,
    fechaEntrega: r.fecha_entrega || null,
    createdAt: r.created_at || null
  };
}

/** Clave de comparación de Nº de serie (ignora mayúsculas, espacios y ceros a la izquierda en series numéricas). */
function matafuegoSerieCompareKey(serie) {
  const alnum = String(serie || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
  if (!alnum) return '';
  if (/^\d+$/.test(alnum)) return alnum.replace(/^0+/, '') || '0';
  return alnum;
}

async function findMatafuegoBySerieDuplicado(numeroSerie, excludeId) {
  const key = matafuegoSerieCompareKey(numeroSerie);
  if (!key) return null;
  const exclude = excludeId != null ? String(excludeId) : '';
  let list = [];
  if (supabase) {
    try {
      const raw = await fetchAllRows('matafuegos', 'created_at', false);
      list = (raw || []).map(mapMatafuegoRowDbToApp).filter(Boolean);
    } catch (_) {
      const data = await loadData();
      list = data.matafuegos || [];
    }
  } else {
    const data = await loadData();
    list = data.matafuegos || [];
  }
  for (const m of list) {
    if (!m || (exclude && String(m.id) === exclude)) continue;
    if (matafuegoSerieCompareKey(m.numeroSerie) === key) return m;
  }
  return null;
}

/** Misma fila salvo entrega: permite a usuarios no admin registrar entrega sin tocar identidad del matafuego. */
function isMatafuegoSoloEntregaDesdeDisponible(prev, next) {
  if (!prev || !next) return false;
  const prevEst = String(prev.estado || 'disponible').toLowerCase();
  if (prevEst !== 'disponible') return false;
  const nextEst = normalizeMatafuegoEstadoFromDb(next.estado || 'disponible', next.dependenciaId || null);
  if (nextEst !== 'entregado') return false;
  if (!next.dependenciaId) return false;
  const same = (a, b) => String(a == null ? '' : a).trim() === String(b == null ? '' : b).trim();
  if (!same(prev.marca, next.marca)) return false;
  if (!same(prev.numeroSerie, next.numeroSerie)) return false;
  if (!same(prev.caracteristicas, next.caracteristicas)) return false;
  if (!same(prev.fechaVencimiento, next.fechaVencimiento)) return false;
  return true;
}

/** Tras recarga en taller: volver a disponible; permite nuevo vencimiento y fecha_ingreso = última recarga (día del alta). */
function isMatafuegoSoloVueltaDisponibleDesdeRecarga(prev, next) {
  if (!prev || !next) return false;
  const prevEst = String(prev.estado || '').toLowerCase();
  if (prevEst !== 'recarga') return false;
  const nextEst = normalizeMatafuegoEstadoFromDb(next.estado || 'disponible', next.dependenciaId || null);
  if (nextEst !== 'disponible') return false;
  if (next.dependenciaId) return false;
  const same = (a, b) => String(a == null ? '' : a).trim() === String(b == null ? '' : b).trim();
  if (!same(prev.marca, next.marca)) return false;
  if (!same(prev.numeroSerie, next.numeroSerie)) return false;
  if (!same(prev.caracteristicas, next.caracteristicas)) return false;
  return true;
}

/** Solo actualiza fecha de vencimiento (o pasa a/desde vencido sin fecha); resto de la fila igual. */
function isMatafuegoSoloCambioVencimiento(prev, next) {
  if (!prev || !next) return false;
  const same = (a, b) => String(a == null ? '' : a).trim() === String(b == null ? '' : b).trim();
  const sameIngreso = (a, b) => {
    var sa = String(a == null ? '' : a).trim().slice(0, 10);
    var sb = String(b == null ? '' : b).trim().slice(0, 10);
    return sa === sb;
  };
  const normFv = function (fv) {
    if (fv == null || fv === '') return '';
    return String(fv).trim().slice(0, 10);
  };
  if (!same(prev.marca, next.marca)) return false;
  if (!same(prev.numeroSerie, next.numeroSerie)) return false;
  if (!same(prev.caracteristicas, next.caracteristicas)) return false;
  if (!same(String(prev.estado || ''), String(next.estado || ''))) return false;
  if (!same(prev.dependenciaId, next.dependenciaId)) return false;
  if (!sameIngreso(prev.fechaIngreso, next.fechaIngreso)) return false;
  if (normFv(prev.fechaVencimiento) === normFv(next.fechaVencimiento)) return false;
  return true;
}

function inferMatafuegoMovimiento(prev, next) {
  if (!prev) return 'ingreso';
  if (!prev.dependenciaId && next && next.dependenciaId) return 'egreso';
  if (prev.dependenciaId && next && next.dependenciaId
    && String(prev.dependenciaId) !== String(next.dependenciaId)) return 'editado';
  if ((prev.estado || '') !== (next.estado || '')) return 'cambio_estado';
  return 'editado';
}

async function logMatafuegoMovimiento(prev, next) {
  const mov = inferMatafuegoMovimiento(prev, next);
  const session = loadSession();
  const usuario = session && session.username ? session.username : 'sistema';
  const payload = {
    movimiento: mov,
    fecha: new Date().toISOString(),
    id: next && next.id ? next.id : (prev && prev.id ? prev.id : null),
    marca: next && next.marca ? next.marca : (prev && prev.marca ? prev.marca : null),
    numeroSerie: next && next.numeroSerie ? next.numeroSerie : (prev && prev.numeroSerie ? prev.numeroSerie : ''),
    caracteristicas: next && next.caracteristicas ? next.caracteristicas : (prev && prev.caracteristicas ? prev.caracteristicas : ''),
    estadoAnterior: prev && prev.estado ? prev.estado : null,
    estadoNuevo: next && next.estado ? next.estado : null,
    dependenciaAnterior: prev && prev.dependenciaId ? prev.dependenciaId : null,
    dependenciaNueva: next && next.dependenciaId ? next.dependenciaId : null,
    usuario
  };
  await logAudit('MODIFICAR', 'Matafuegos', 'MATAFUEGO_HIST|' + JSON.stringify(payload), payload.id);
}

function buildMatafuegosRecargandoMap(entries) {
  const byId = {};
  (entries || []).forEach(function (e) {
    const det = String((e && e.detalle) || '');
    if (det.indexOf('MATAFUEGO_RECARGANDO|') !== 0) return;
    try {
      const p = JSON.parse(det.slice('MATAFUEGO_RECARGANDO|'.length));
      const id = String((p && p.id) || '').trim();
      if (!id) return;
      const fecha = String((p && p.fecha) || (e && e.fecha) || '');
      const recargando = !!(p && p.recargando);
      if (!byId[id] || fecha >= byId[id].fecha) {
        byId[id] = { fecha: fecha, recargando: recargando };
      }
    } catch (_) {}
  });
  const out = {};
  Object.keys(byId).forEach(function (id) {
    out[id] = !!byId[id].recargando;
  });
  return out;
}

let mainWindow;
let lastUpdateStatus = null;
let updateCheckStarted = false;

function sendUpdateStatus(payload) {
  lastUpdateStatus = payload || null;
  try {
    const wins = BrowserWindow.getAllWindows();
    wins.forEach(function (win) {
      if (win && win.webContents && !win.isDestroyed()) {
        win.webContents.send('update-status', payload);
      }
    });
  } catch (_) {}
}

function scheduleUpdateCheck() {
  if (!app.isPackaged || !autoUpdater || updateCheckStarted) return;
  updateCheckStarted = true;
  setTimeout(function () {
    autoUpdater.checkForUpdates().catch(function (err) {
      sendUpdateStatus({
        status: 'error',
        error: err && err.message ? err.message : String(err || 'Error al buscar actualización')
      });
    });
  }, 1200);
}

function setupAutoUpdates() {
  // Solo tiene sentido en apps empaquetadas (instalador/portable).
  if (!app.isPackaged || !autoUpdater) return;

  try {
    // Mismo origen que en package.json → build.publish (GitHub Releases + latest.yml).
    try {
      autoUpdater.setFeedURL({ provider: 'github', owner: 'navarromateo09', repo: 'BIENES-PATRIMONIALES-' });
    } catch (_) {}
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('checking-for-update', function () {
      sendUpdateStatus({ status: 'checking' });
    });
    autoUpdater.on('update-available', function (info) {
      sendUpdateStatus({ status: 'available', info: info || null });
    });
    autoUpdater.on('update-not-available', function (info) {
      sendUpdateStatus({
        status: 'not-available',
        info: info || null,
        currentVersion: app.getVersion()
      });
    });
    autoUpdater.on('error', function (err) {
      sendUpdateStatus({ status: 'error', error: err && err.message ? err.message : String(err || 'Error') });
    });
    autoUpdater.on('download-progress', function (p) {
      sendUpdateStatus({
        status: 'progress',
        progress: p && p.percent != null ? p.percent : null,
        bytesPerSecond: p && p.bytesPerSecond != null ? p.bytesPerSecond : null
      });
    });
    autoUpdater.on('update-downloaded', function (info) {
      sendUpdateStatus({ status: 'downloaded', info: info || null });
    });
  } catch (e) {
    console.warn('[AutoUpdate] No se pudo inicializar:', e && e.message);
  }
}

/** Fondo del login: url() relativa en CSS dentro de app.asar a veces no carga en la app instalada; forzamos file:// absoluto. */
function applyLoginScreenBackground(webContents) {
  try {
    const pngPath = path.join(__dirname, 'emblemalogin.png');
    if (!fs.existsSync(pngPath)) return;
    const href = pathToFileURL(pngPath).href;
    const css =
      '.pantalla-login, body.tema-claro .pantalla-login { ' +
      'background-image: url(' + JSON.stringify(href) + ') !important; ' +
      'background-position: center center !important; ' +
      'background-size: cover !important; ' +
      'background-repeat: no-repeat !important; ' +
      '}';
    webContents.insertCSS(css, { cssOrigin: 'user' }).catch(function () {});
  } catch (_) {}
}

function loadRendererWindow() {
  const devUrl = process.env.ELECTRON_RENDERER_URL || '';
  if (devUrl) {
    mainWindow.loadURL(devUrl);
    return;
  }
  const reactIndex = path.join(__dirname, 'renderer', 'dist', 'index.html');
  if (fs.existsSync(reactIndex)) {
    mainWindow.loadFile(reactIndex);
    return;
  }
  mainWindow.loadFile('index.html');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    show: false
  });

  mainWindow.webContents.on('did-finish-load', function () {
    var u = '';
    try {
      u = mainWindow.webContents.getURL() || '';
    } catch (_) {}
    if (u.indexOf('login') >= 0 || u.indexOf('#/login') >= 0 || u.indexOf('index.html') >= 0 || u.indexOf('5173') >= 0) {
      applyLoginScreenBackground(mainWindow.webContents);
    }
    scheduleUpdateCheck();
  });

  loadRendererWindow();
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.maximize();
  });
  // Windows + Electron: tras diálogos nativos o cambios de foco del SO, a veces el webContents no recibe clics hasta reactivar la ventana.
  mainWindow.on('focus', function () {
    try {
      if (mainWindow && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.focus();
      }
    } catch (_) {}
  });
  mainWindow.on('closed', () => { mainWindow = null; });

  // F5 recarga la página; F12 abre/cierra la consola de desarrollador
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F5' || (input.ctrl && input.key === 'r')) {
      mainWindow.reload();
      event.preventDefault();
    }
    if (input.key === 'F12' || (input.ctrl && input.shift && input.key === 'I')) {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });
}

const BACKUP_DIR = path.join(app.getPath('userData'), 'backups');
const BACKUP_STATE_FILE = path.join(app.getPath('userData'), 'backup-state.json');

function loadBackupState() {
  try {
    if (fs.existsSync(BACKUP_STATE_FILE)) {
      const raw = fs.readFileSync(BACKUP_STATE_FILE, 'utf-8');
      const data = JSON.parse(raw);
      return data && typeof data === 'object' ? data : {};
    }
  } catch (_) {}
  return {};
}

function saveBackupState(state) {
  try {
    const safe = state && typeof state === 'object' ? state : {};
    fs.writeFileSync(BACKUP_STATE_FILE, JSON.stringify(safe, null, 2), 'utf-8');
  } catch (_) {}
}

function scheduleAutoBackups() {
  const INTERVAL_MS = 30 * 60 * 1000; // cada 30 min verifica
  const PERIOD_MS = 24 * 60 * 60 * 1000; // 24 hs
  let running = false;

  async function tick() {
    if (running) return;
    running = true;
    try {
      const st = loadBackupState();
      const lastIso = st && st.lastAutoBackupAt ? String(st.lastAutoBackupAt) : '';
      const lastMs = lastIso ? new Date(lastIso).getTime() : 0;
      const now = Date.now();
      const needs = !lastMs || isNaN(lastMs) || (now - lastMs) >= PERIOD_MS;
      if (!needs) return;

      const res = await createBackup(false);
      if (res && res.ok) {
        saveBackupState({ lastAutoBackupAt: new Date().toISOString(), lastAutoBackupFile: res.filename });
      }
    } catch (e) {
      console.warn('[Backup] Auto-backup programado falló:', e && e.message);
    } finally {
      running = false;
    }
  }

  // pequeña demora al iniciar para no competir con el arranque
  setTimeout(tick, 2 * 60 * 1000);
  setInterval(tick, INTERVAL_MS);
}

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

async function createBackup(manual) {
  ensureBackupDir();
  const data = await loadData();
  const auditLog = loadAuditLog();
  const backup = {
    _meta: {
      version: 1,
      fecha: new Date().toISOString(),
      tipo: manual ? 'manual' : 'automatico'
    },
    productos: data.productos || [],
    movimientos: data.movimientos || [],
    dependencias: data.dependencias || [],
    txtDependencias: data.txtDependencias || [],
    txtRealizados: data.txtRealizados || [],
    guardiaProvisiones: data.guardiaProvisiones || [],
    actas: data.actas || [],
    matafuegos: data.matafuegos || [],
    auditLog: auditLog
  };
  const now = new Date();
  const ts = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') + '-' +
    String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0');
  const filename = 'backup-' + ts + (manual ? '-manual' : '-auto') + '.json';
  const filePath = path.join(BACKUP_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(backup, null, 2), 'utf-8');
  cleanOldBackups();
  return { ok: true, path: filePath, filename: filename };
}

function cleanOldBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
      .sort()
      .reverse();
    const MAX_BACKUPS = 20;
    if (files.length > MAX_BACKUPS) {
      files.slice(MAX_BACKUPS).forEach(f => {
        try { fs.unlinkSync(path.join(BACKUP_DIR, f)); } catch (_) { /* ignore */ }
      });
    }
  } catch (_) { /* ignore */ }
}

function listBackups() {
  ensureBackupDir();
  try {
    return fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
      .sort()
      .reverse()
      .map(f => {
        const stat = fs.statSync(path.join(BACKUP_DIR, f));
        return { filename: f, size: stat.size, date: stat.mtime.toISOString() };
      });
  } catch (_) { return []; }
}

// ── Supabase Realtime ──
let realtimeChannel = null;
const REALTIME_TABLES = ['productos', 'movimientos', 'deposito_movimientos', 'dependencias', 'txt_dependencias', 'txt_realizados', 'guardia_provision', 'actas', 'matafuegos', 'audit_log'];

function setupRealtimeSubscriptions() {
  if (!supabase) return;
  try {
    realtimeChannel = supabase.channel('stock-realtime');
    REALTIME_TABLES.forEach(function (table) {
      realtimeChannel = realtimeChannel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: table },
        function (payload) {
          console.log('[Realtime] Cambio en', table, payload.eventType);
          broadcastDataChanged(table, payload.eventType);
        }
      );
    });
    realtimeChannel.subscribe(function (status) {
      console.log('[Realtime] Estado de suscripción:', status);
    });
  } catch (err) {
    console.warn('[Realtime] Error al configurar suscripciones:', err && err.message);
  }
}

function broadcastDataChanged(table, eventType) {
  const allWindows = BrowserWindow.getAllWindows();
  allWindows.forEach(function (win) {
    if (win && win.webContents && !win.isDestroyed()) {
      try {
        win.webContents.send('data-changed', { table: table, event: eventType });
      } catch (_) {}
    }
  });
}

app.whenReady().then(async () => {
  if (loadSession()) touchSessionActivity();
  setInterval(function () {
    expireSessionIfIdle().catch(function () {});
  }, 30000);

  createWindow();
  setupAutoUpdates();
  setupRealtimeSubscriptions();
  // Sincronizar al inicio los conteos de ORDEN de TXT locales hacia Supabase
  // para que todas las PCs vean los mismos valores.
  try { await syncTxtOrdenLocalToSupabase(); } catch (e) {
    console.warn('[TXT] syncTxtOrdenLocalToSupabase falló:', e && e.message);
  }
  try { await createBackup(false); } catch (e) {
    console.warn('[Backup] Auto-backup al inicio falló:', e && e.message);
  }
  try {
    // Registrar el arranque como "auto-backup reciente" y activar el programador.
    const st = loadBackupState();
    if (!st || !st.lastAutoBackupAt) {
      saveBackupState({ lastAutoBackupAt: new Date().toISOString() });
    }
    scheduleAutoBackups();
  } catch (_) {}
});

// IPC: Updates (auto-actualización)
ipcMain.handle('updates-get-last-status', () => {
  return {
    status: lastUpdateStatus,
    currentVersion: app.getVersion(),
    packaged: app.isPackaged
  };
});

ipcMain.handle('updates-check', async () => {
  if (!app.isPackaged) {
    const error = 'Solo funciona en la app instalada (.exe), no con INICIAR-APP-ACTUALIZADA.bat.';
    sendUpdateStatus({ status: 'error', error: error });
    return { ok: false, error: error };
  }
  if (!autoUpdater) {
    const error = 'Actualización automática no incluida. Descargá la última versión desde GitHub Releases.';
    sendUpdateStatus({ status: 'error', error: error });
    return { ok: false, error: error };
  }
  try {
    updateCheckStarted = true;
    const res = await autoUpdater.checkForUpdates();
    return { ok: true, currentVersion: app.getVersion(), result: res || null };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e || 'Error al buscar actualización') };
  }
});

ipcMain.handle('updates-download', async () => {
  if (!app.isPackaged) return { ok: false, error: 'La app no está empaquetada (modo dev).' };
  if (!autoUpdater) return { ok: false, error: 'Actualización automática no incluida en esta instalación. Descarga la última versión desde GitHub Releases.' };
  try {
    const res = await autoUpdater.downloadUpdate();
    return { ok: true, result: res || null };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e || 'Error al descargar actualización') };
  }
});

ipcMain.handle('updates-install', async () => {
  if (!app.isPackaged) return { ok: false, error: 'La app no está empaquetada (modo dev).' };
  if (!autoUpdater) return { ok: false, error: 'Actualización automática no incluida en esta instalación. Descarga la última versión desde GitHub Releases.' };
  try {
    // quitAndInstall cierra y aplica.
    autoUpdater.quitAndInstall(false, true);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e || 'Error al instalar actualización') };
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (realtimeChannel && supabase) {
    try { supabase.removeChannel(realtimeChannel); } catch (_) {}
    realtimeChannel = null;
  }
  clearSession();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// IPC: Auth
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-auth-status', () => {
  const session = loadSession();
  if (session && session.username) {
    return { hasUser: true, username: session.username, rol: session.rol || 'usuario' };
  }
  return { hasUser: false, username: null, rol: null };
});

ipcMain.handle('login', async (_, username, password) => {
  const user = (username || '').trim();
  const pass = (password || '').trim();
  if (!user) return { ok: false, error: 'Usuario o contraseña incorrectos' };

  if (supabase) {
    const { data: rows, error } = await supabase.from('usuarios').select('username, password_hash, rol').eq('username', user).limit(1);
    if (error) return { ok: false, error: 'Error al conectar' };
    if (!rows || rows.length === 0) return { ok: false, error: 'Usuario o contraseña incorrectos' };
    const row = rows[0];
    const rolRaw = (row.rol || '').toString().trim().toLowerCase();
    if (rolRaw === 'pendiente') {
      return { ok: false, error: 'Tu cuenta está pendiente de autorización por admin1.' };
    }
    const storedHash = (row.password_hash || row.passwordHash || '').toString().trim();
    const hash = hashPassword(pass);
    if (hash !== storedHash) return { ok: false, error: 'Usuario o contraseña incorrectos' };
    const rol = (rolRaw && ['admin', 'usuario', 'oficina'].includes(rolRaw)) ? rolRaw : 'usuario';
    saveSession(row.username, rol);
    await logAudit('LOGIN', 'Sesión', 'Inició sesión: ' + row.username);
    return { ok: true };
  }

  const auth = loadAuth();
  if (!auth) return { ok: false, error: 'No hay cuenta configurada' };
  if (user !== auth.username) return { ok: false, error: 'Usuario o contraseña incorrectos' };
  const hash = hashPassword(pass);
  if (hash !== auth.passwordHash) return { ok: false, error: 'Usuario o contraseña incorrectos' };
  saveSession(auth.username, 'usuario');
  await logAudit('LOGIN', 'Sesión', 'Inició sesión: ' + auth.username);
  return { ok: true };
});

ipcMain.handle('logout', async () => {
  await logAudit('LOGOUT', 'Sesión', 'Cerró sesión');
  clearSession();
});

ipcMain.handle('session-activity', () => {
  touchSessionActivity();
  return { ok: true };
});

ipcMain.handle('get-audit-log', async (_, filtros) => {
  let entries = [];
  const depNeedle = (filtros && filtros.dependencia) ? String(filtros.dependencia).trim() : '';
  const qNeedle = (filtros && filtros.q) ? String(filtros.q).trim() : '';
  if (supabase) {
    try {
      let query = supabase.from('audit_log').select('*').order('fecha', { ascending: false }).limit(500);
      if (filtros && filtros.usuario) query = query.eq('usuario', filtros.usuario);
      if (filtros && filtros.modulo) query = query.eq('modulo', filtros.modulo);
      if (filtros && filtros.accion) query = query.eq('accion', filtros.accion);
      if (filtros && filtros.desde) query = query.gte('fecha', filtros.desde);
      if (filtros && filtros.hasta) query = query.lte('fecha', filtros.hasta);
      // Dependencia/texto: sin cambiar esquema, filtramos por detalle (ilike)
      if (depNeedle) query = query.ilike('detalle', '%' + depNeedle + '%');
      if (qNeedle) query = query.ilike('detalle', '%' + qNeedle + '%');
      const { data, error } = await query;
      if (!error && data) entries = data.map(r => ({
        id: r.id, fecha: r.fecha, usuario: r.usuario, accion: r.accion,
        modulo: r.modulo, detalle: r.detalle, entidadId: r.entidad_id
      }));
    } catch (e) { /* fallback local */ }
  }
  if (!entries.length) {
    entries = loadAuditLog();
    if (filtros) {
      if (filtros.usuario) entries = entries.filter(e => e.usuario === filtros.usuario);
      if (filtros.modulo) entries = entries.filter(e => e.modulo === filtros.modulo);
      if (filtros.accion) entries = entries.filter(e => e.accion === filtros.accion);
      if (filtros.desde) entries = entries.filter(e => e.fecha >= filtros.desde);
      if (filtros.hasta) entries = entries.filter(e => e.fecha <= filtros.hasta);
      if (depNeedle) {
        const n = depNeedle.toLowerCase();
        entries = entries.filter(e => String(e.detalle || '').toLowerCase().includes(n));
      }
      if (qNeedle) {
        const n = qNeedle.toLowerCase();
        entries = entries.filter(e => String(e.detalle || '').toLowerCase().includes(n));
      }
    }
    entries = entries.slice(0, 500);
  }
  return entries;
});

ipcMain.handle('set-matafuego-recargando', async (_, payload) => {
  const id = payload && payload.id != null ? String(payload.id).trim() : '';
  if (!id) return { ok: false, error: 'ID de matafuego inválido' };
  const recargando = !!(payload && payload.recargando);
  const evt = {
    id: id,
    recargando: recargando,
    fecha: new Date().toISOString()
  };
  await logAudit('MODIFICAR', 'Matafuegos', 'MATAFUEGO_RECARGANDO|' + JSON.stringify(evt), id);
  return { ok: true };
});

ipcMain.handle('get-matafuegos-recargando-map', async () => {
  const entries = await fetchMatafuegosRecargandoAuditEntries();
  return buildMatafuegosRecargandoMap(entries);
});

ipcMain.handle('create-account', async (_, username, password) => {
  const user = (username || '').trim();
  const pass = password || '';
  if (!user) return { ok: false, error: 'El usuario no puede estar vacío' };
  if (!pass || pass.length < 4) return { ok: false, error: 'La contraseña debe tener al menos 4 caracteres' };

  if (supabase) {
    const { data: existing } = await supabase.from('usuarios').select('id').eq('username', user).limit(1);
    if (existing && existing.length > 0) return { ok: false, error: 'Ese usuario ya existe' };
    const id = Date.now().toString();
    const { error } = await supabase.from('usuarios').insert({
      id,
      username: user,
      password_hash: hashPassword(pass),
      rol: 'pendiente'
    });
    if (error) {
      const msg = (error.message || '').toString();
      if (msg.toLowerCase().includes('usuarios_rol_check')) {
        return { ok: false, error: 'Falta actualizar la tabla usuarios en Supabase para permitir el rol "pendiente". Ejecutá el script SQL de migración y reintentá.' };
      }
      return { ok: false, error: msg || 'Error al crear cuenta' };
    }
    await logAudit('CREAR', 'Usuarios', 'Registro pendiente de autorización: ' + user, id);
    return { ok: true, pendingApproval: true };
  }

  if (loadAuth()) return { ok: false, error: 'Ya existe una cuenta' };
  saveAuth(user, hashPassword(pass));
  saveSession(user, 'usuario');
  return { ok: true };
});

// IPC: Saber si los datos se guardan en Supabase o en local
ipcMain.handle('get-data-backend', () => ({ backend: supabase ? 'supabase' : 'local' }));

// IPC: Ruta absoluta para imágenes/assets (evita que falle la carga por rutas relativas)
ipcMain.handle('get-asset-url', (_, filename) => {
  const filePath = path.join(__dirname, filename);
  return 'file:///' + filePath.replace(/\\/g, '/');
});

async function syncExpiredMatafuegosToRecarga() {
  const today = new Date().toISOString().slice(0, 10);
  const sinFechaSentinel = '1900-01-01';
  let moved = 0;

  if (supabase) {
    const { data: rows, error } = await supabase
      .from('matafuegos')
      .select('id, estado, fecha_vencimiento, fecha_ingreso, dependencia_id')
      .eq('estado', 'disponible');
    if (error) throw new Error(error.message || 'Error al leer matafuegos');

    const toMove = (rows || []).filter(r => {
      if (r.dependencia_id) return false; // no mover unidades ya entregadas
      const fv = r.fecha_vencimiento ? String(r.fecha_vencimiento).slice(0, 10) : '';
      if (!fv) return false;
      if (fv === sinFechaSentinel) return true;
      return fv <= today;
    });
    if (toMove.length === 0) return { moved: 0 };

    for (const r of toMove) {
      let movedOk = false;
      let lastUpErr = null;
      for (const estadoDb of getMatafuegoEstadoDbCandidates('recarga')) {
        const { error: upErr } = await supabase
          .from('matafuegos')
          .update({
            estado: estadoDb,
            fecha_ingreso: r.fecha_ingreso || today
          })
          .eq('id', r.id)
          .eq('estado', 'disponible');
        if (!upErr) {
          movedOk = true;
          lastUpErr = null;
          break;
        }
        lastUpErr = upErr;
        const msg = String(upErr.message || '');
        if (!msg.toLowerCase().includes('matafuegos_estado_check')) break;
      }
      if (!movedOk && lastUpErr) throw new Error(lastUpErr.message || 'Error al actualizar matafuego vencido');
      moved += 1;
    }
    if (moved > 0) {
      await logAudit('MODIFICAR', 'Matafuegos', 'Movimiento automático a recarga de matafuegos vencidos: ' + moved, null);
    }
    return { moved };
  }

  const data = await loadData();
  if (!data.matafuegos) data.matafuegos = [];
  data.matafuegos.forEach(function (m) {
    if ((m.estado || 'disponible') !== 'disponible') return;
    const fv = m.fechaVencimiento ? String(m.fechaVencimiento).slice(0, 10) : '';
    if (!fv) return;
    const vencido = (fv === sinFechaSentinel) || (fv <= today);
    if (!vencido) return;
    m.estado = 'recarga';
    if (!m.fechaIngreso) m.fechaIngreso = today;
    moved += 1;
  });
  if (moved > 0) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    await logAudit('MODIFICAR', 'Matafuegos', 'Movimiento automático a recarga de matafuegos vencidos: ' + moved, null);
  }
  return { moved };
}

// IPC: Obtener todos los datos
ipcMain.handle('get-data', () => loadData());

ipcMain.handle('get-matafuegos-data', () => loadMatafuegosBundle());
ipcMain.handle('get-productos-data', () => loadProductosBundle());
ipcMain.handle('get-guardia-data', () => loadProductosBundle());
ipcMain.handle('get-dashboard-data', () => loadDashboardBundle());
ipcMain.handle('get-dependencias-stats-data', () => loadDependenciasStatsBundle());
ipcMain.handle('sync-expired-matafuegos', () => syncExpiredMatafuegosToRecarga());

// Fix foco (Electron): algunos diálogos nativos (confirm/alert) pueden dejar
// la ventana sin foco hasta que el usuario haga alt-tab. Exponemos un handler
// para re-enfocar la ventana desde el renderer cuando sea necesario.
ipcMain.handle('focus-window', () => {
  try {
    if (mainWindow) {
      if (mainWindow.isMinimized && mainWindow.isMinimized()) mainWindow.restore();
      if (mainWindow.show) mainWindow.show();
      if (mainWindow.focus) mainWindow.focus();
      if (mainWindow.webContents && mainWindow.webContents.focus) mainWindow.webContents.focus();
    }
  } catch (e) {
    console.warn('[focus-window] error:', e && e.message ? e.message : e);
  }
  return { ok: true };
});

// IPC: Guardar producto (expediente)
ipcMain.handle('save-producto', async (_, producto) => {
  if (!producto.id) {
    producto.id = Date.now().toString();
    producto.stockActual = producto.stockActual || 0;
  }
  const preData = await loadData();
  const esEdicionProducto = (preData.productos || []).some(p => p && p.id === producto.id);
  if (esEdicionProducto && !isAdminSession()) {
    throw new Error('Solo un administrador puede editar expedientes.');
  }
  const codigoNorm = String(producto.codigo || '').trim();
  if (codigoNorm) {
    const duplicado = (preData.productos || []).some(p => String(p.codigo || '').trim() === codigoNorm && p.id !== producto.id);
    if (duplicado) throw new Error('Ya existe un expediente con ese número. Usá otro número.');
  }
  if (supabase) {
    if (codigoNorm) {
      const { data: rows } = await supabase.from('productos').select('id').ilike('codigo', codigoNorm);
      const otro = (rows || []).find(r => r.id !== producto.id);
      if (otro) throw new Error('Ya existe un expediente con ese número. Usá otro número.');
    }
    var row = productoToRow(producto);
    var result = await supabase.from('productos').upsert(row, { onConflict: 'id' });
    if (result.error && (result.error.message || '').toLowerCase().indexOf('anio') >= 0) {
      delete row.anio;
      result = await supabase.from('productos').upsert(row, { onConflict: 'id' });
    }
    if (result.error) throw new Error(result.error.message);
    await logAudit(producto._isNew ? 'CREAR' : 'EDITAR', 'Expedientes', (producto._isNew ? 'Creó' : 'Editó') + ' expediente ' + (producto.codigo || producto.id), producto.id);
    return producto.id;
  }
  const data = await loadData();
  const idx = data.productos.findIndex(p => p.id === producto.id);
  const esNuevo = idx < 0;
  const toSave = {
    id: producto.id,
    codigo: producto.codigo,
    nombre: producto.nombre,
    descripcion: producto.descripcion,
    stockActual: producto.stockActual ?? 0,
    unidad: producto.unidad || 'unidades',
    marca: producto.marca,
    solicitadoPor: producto.solicitadoPor,
    anio: producto.anio != null && producto.anio !== '' ? producto.anio : undefined
  };
  if (idx >= 0) data.productos[idx] = toSave;
  else data.productos.push(toSave);
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  await logAudit(esNuevo ? 'CREAR' : 'EDITAR', 'Expedientes', (esNuevo ? 'Creó' : 'Editó') + ' expediente ' + (producto.codigo || producto.id), producto.id);
  return producto.id;
});

// IPC: Eliminar producto (expediente)
ipcMain.handle('delete-producto', async (_, id) => {
  ensureAdminSession('Solo un administrador puede eliminar expedientes.');
  if (supabase) {
    const { data: movs, error: errMov } = await supabase.from('movimientos').select('id').eq('producto_id', id).limit(1);
    if (errMov) throw new Error(errMov.message);
    if (movs && movs.length > 0) throw new Error('No se puede eliminar el expediente porque tiene movimientos registrados. Eliminá primero los movimientos o productos asociados.');
    await supabase.from('movimientos').delete().eq('producto_id', id);
    const { error } = await supabase.from('productos').delete().eq('id', id);
    if (error) throw new Error(error.message);
    await logAudit('ELIMINAR', 'Expedientes', 'Eliminó expediente ' + id, id);
    return true;
  }
  const data = await loadData();
  const tieneMovimientos = (data.movimientos || []).some(m => m.productoId === id);
  if (tieneMovimientos) throw new Error('No se puede eliminar el expediente porque tiene movimientos registrados. Eliminá primero los movimientos o productos asociados.');
  data.productos = data.productos.filter(p => p.id !== id);
  data.movimientos = data.movimientos.filter(m => m.productoId !== id);
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  await logAudit('ELIMINAR', 'Expedientes', 'Eliminó expediente ' + id, id);
  return true;
});

// IPC: Eliminar expediente + movimientos asociados (solo para admin desde UI)
ipcMain.handle('delete-expediente-cascade', async (_, id) => {
  ensureAdminSession('Solo un administrador puede eliminar expedientes.');
  if (!id) throw new Error('Expediente inválido');

  if (supabase) {
    // Borrar provisiones vinculadas (si existe tabla)
    try {
      await supabase.from('guardia_provision').delete().eq('producto_id', id);
    } catch (_) { /* ignore */ }
    // Borrar movimientos del expediente
    await supabase.from('movimientos').delete().eq('producto_id', id);
    // Borrar expediente
    const { error } = await supabase.from('productos').delete().eq('id', id);
    if (error) throw new Error(error.message);
    await logAudit('ELIMINAR', 'Expedientes', 'Eliminó expediente (cascada) ' + id, id);
    return true;
  }

  const data = await loadData();
  const movsAEliminar = (data.movimientos || []).filter(m => m.productoId === id).map(m => m.id);
  data.movimientos = (data.movimientos || []).filter(m => m.productoId !== id);
  data.productos = (data.productos || []).filter(p => p.id !== id);
  if (Array.isArray(data.guardiaProvisiones)) {
    data.guardiaProvisiones = data.guardiaProvisiones.filter(p => p.producto_id !== id && !movsAEliminar.includes(p.movimiento_id));
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  await logAudit('ELIMINAR', 'Expedientes', 'Eliminó expediente (cascada) ' + id, id);
  return true;
});

// IPC: Registrar movimiento (entrada o salida)
ipcMain.handle('registrar-movimiento', async (_, movimiento) => {
  // Guardamos el usuario que inició la acción para mostrarlo luego en "Historial"
  const session = loadSession();
  const usuarioSession = session && session.username ? session.username : null;
  if (usuarioSession && !movimiento.usuario) movimiento.usuario = usuarioSession;

  const cantidad = parseInt(movimiento.cantidad, 10);
  if (isNaN(cantidad) || cantidad <= 0) return { ok: false, error: 'Cantidad inválida' };

  const productoId = movimiento.productoId;
  if (!movimiento.id) movimiento.id = Date.now().toString();
  movimiento.fecha = movimiento.fecha || new Date().toISOString();

  const numeroSerieNorm = String(movimiento.numeroSerie || '').trim();
  if (movimiento.tipo === 'entrada' && numeroSerieNorm) {
    const data = await loadData();
    const duplicado = (data.movimientos || []).some(m => m.tipo === 'entrada' && String(m.numeroSerie || '').trim() === numeroSerieNorm && m.id !== movimiento.id);
    if (duplicado) return { ok: false, error: 'Ya existe una entrada con ese número de serie. Usá otro.' };
  }
  if (supabase && movimiento.tipo === 'entrada' && numeroSerieNorm) {
    const { data: rows } = await supabase.from('movimientos').select('id').eq('tipo', 'entrada').ilike('numero_serie', numeroSerieNorm);
    const otro = (rows || []).find(r => r.id !== movimiento.id);
    if (otro) return { ok: false, error: 'Ya existe una entrada con ese número de serie. Usá otro.' };
  }

  if (movimiento.tipo === 'entrada' && !productoId) {
    movimiento.productoId = null;
    if (supabase) {
      const row = movimientoToRow(movimiento);
      let { error } = await supabase.from('movimientos').insert(row);
      // Compatibilidad: si la columna "usuario" no existe todavía en Supabase,
      // reintenta sin ese campo para que no falle el registro del movimiento.
      if (error && /usuario/i.test(error.message || '')) {
        const row2 = Object.assign({}, row);
        delete row2.usuario;
        ({ error } = await supabase.from('movimientos').insert(row2));
      }
      if (error) return { ok: false, error: error.message };
      await logAudit('CREAR', 'Movimientos', 'Registró ' + movimiento.tipo + ' (sin expediente), cant: ' + movimiento.cantidad, movimiento.id);
      return { ok: true };
    }
    const data = await loadData();
    data.movimientos.push(movimiento);
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    await logAudit('CREAR', 'Movimientos', 'Registró ' + movimiento.tipo + ' (sin expediente), cant: ' + movimiento.cantidad, movimiento.id);
    return { ok: true };
  }

  const data = await loadData();
  const producto = productoId ? data.productos.find(p => p.id === productoId) : null;
  if (!producto) return { ok: false, error: 'Producto no encontrado' };
  if (movimiento.tipo === 'salida' && producto.stockActual < cantidad) {
    return { ok: false, error: 'Stock insuficiente' };
  }

  if (supabase) {
    const row = movimientoToRow(movimiento);
    let { error: errMov } = await supabase.from('movimientos').insert(row);
    if (errMov && /usuario/i.test(errMov.message || '')) {
      const row2 = Object.assign({}, row);
      delete row2.usuario;
      ({ error: errMov } = await supabase.from('movimientos').insert(row2));
    }
    if (errMov) return { ok: false, error: errMov.message };
    const nuevoStock = movimiento.tipo === 'entrada'
      ? (producto.stockActual || 0) + cantidad
      : producto.stockActual - cantidad;
    const { error: errProd } = await supabase.from('productos').update({ stock_actual: nuevoStock }).eq('id', productoId);
    if (errProd) return { ok: false, error: errProd.message };
    await logAudit('CREAR', 'Movimientos', 'Registró ' + movimiento.tipo + ' de ' + cantidad + ' en expediente ' + (producto.codigo || productoId) + (movimiento.destino ? ' → ' + movimiento.destino : ''), movimiento.id);
    return { ok: true };
  }

  data.movimientos.push(movimiento);
  if (movimiento.tipo === 'entrada') producto.stockActual = (producto.stockActual || 0) + cantidad;
  else producto.stockActual = producto.stockActual - cantidad;
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  await logAudit('CREAR', 'Movimientos', 'Registró ' + movimiento.tipo + ' de ' + cantidad + ' en expediente ' + (producto.codigo || productoId) + (movimiento.destino ? ' → ' + movimiento.destino : ''), movimiento.id);
  return { ok: true };
});

// IPC: Actualizar movimiento (solo entradas; ajusta stock si cambia cantidad)
ipcMain.handle('update-movimiento', async (_, movimientoId, updates) => {
  ensureAdminSession('Solo un administrador puede editar productos del inventario.');
  const data = await loadData();
  const mov = data.movimientos.find(m => m.id === movimientoId);
  if (!mov) return { ok: false, error: 'Movimiento no encontrado' };
  if (mov.tipo !== 'entrada') return { ok: false, error: 'Solo se pueden editar entradas' };

  const producto = mov.productoId ? data.productos.find(p => p.id === mov.productoId) : null;
  const oldCantidad = parseInt(mov.cantidad, 10) || 0;
  const newCantidad = updates.cantidad != null ? parseInt(updates.cantidad, 10) : oldCantidad;
  if (isNaN(newCantidad) || newCantidad <= 0) return { ok: false, error: 'Cantidad inválida' };

  if (updates.numeroSerie !== undefined) mov.numeroSerie = updates.numeroSerie;
  if (updates.nombre !== undefined) mov.nombre = updates.nombre;
  if (updates.marca !== undefined) mov.marca = updates.marca;
  if (updates.cantidad !== undefined) mov.cantidad = String(updates.cantidad);
  if (updates.concepto !== undefined) mov.concepto = updates.concepto;
  if (updates.fecha !== undefined) mov.fecha = updates.fecha;

  if (producto) {
    const delta = newCantidad - oldCantidad;
    producto.stockActual = (producto.stockActual || 0) + delta;
  }

  if (supabase) {
    const row = movimientoToRow(mov);
    let { error: errMov } = await supabase.from('movimientos').update(row).eq('id', movimientoId);
    if (errMov && /usuario/i.test(errMov.message || '')) {
      const row2 = Object.assign({}, row);
      delete row2.usuario;
      ({ error: errMov } = await supabase.from('movimientos').update(row2).eq('id', movimientoId));
    }
    if (errMov) return { ok: false, error: errMov.message };
    if (producto) {
      await supabase.from('productos').update({ stock_actual: producto.stockActual }).eq('id', mov.productoId);
    }
    return { ok: true };
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  return { ok: true };
});

// IPC: Eliminar un movimiento (p. ej. una entrada del inventario)
ipcMain.handle('delete-movimiento', async (_, movimientoId) => {
  ensureAdminSession('Solo un administrador puede eliminar productos del inventario.');
  const data = await loadData();
  const mov = data.movimientos.find(m => m.id === movimientoId);
  if (!mov) throw new Error('Movimiento no encontrado');
  if (mov.tipo !== 'entrada') throw new Error('Solo se pueden eliminar entradas');
  const cantidad = parseInt(mov.cantidad, 10) || 0;
  const producto = mov.productoId ? data.productos.find(p => p.id === mov.productoId) : null;
  if (producto) {
    producto.stockActual = Math.max(0, (producto.stockActual || 0) - cantidad);
  }
  data.movimientos = data.movimientos.filter(m => m.id !== movimientoId);
  if (supabase) {
    await supabase.from('movimientos').delete().eq('id', movimientoId);
    if (producto) {
      await supabase.from('productos').update({ stock_actual: producto.stockActual }).eq('id', mov.productoId);
    }
    return true;
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  return true;
});

// IPC: Asignar una entrada (producto del inventario) a otro expediente
ipcMain.handle('asignar-entrada-a-expediente', async (_, movimientoId, nuevoProductoId) => {
  ensureAdminSession('Solo un administrador puede editar productos del inventario.');
  const data = await loadData();
  const mov = data.movimientos.find(m => m.id === movimientoId);
  if (!mov) return { ok: false, error: 'Movimiento no encontrado' };
  if (mov.tipo !== 'entrada') return { ok: false, error: 'Solo se pueden asignar entradas' };

  const productoNuevo = data.productos.find(p => p.id === nuevoProductoId);
  if (!productoNuevo) return { ok: false, error: 'Expediente destino no encontrado' };

  if (mov.productoId === nuevoProductoId) return { ok: true };

  const cantidad = parseInt(mov.cantidad, 10) || 0;
  const viejoProductoId = mov.productoId;
  if (viejoProductoId) {
    const productoViejo = data.productos.find(p => p.id === viejoProductoId);
    if (productoViejo) {
      productoViejo.stockActual = Math.max(0, (productoViejo.stockActual || 0) - cantidad);
    }
  }
  productoNuevo.stockActual = (productoNuevo.stockActual || 0) + cantidad;
  mov.productoId = nuevoProductoId;

  if (supabase) {
    await supabase.from('movimientos').update({ producto_id: nuevoProductoId }).eq('id', movimientoId);
    if (viejoProductoId) {
      const productoViejo = data.productos.find(p => p.id === viejoProductoId);
      if (productoViejo) {
        await supabase.from('productos').update({ stock_actual: productoViejo.stockActual }).eq('id', viejoProductoId);
      }
    }
    await supabase.from('productos').update({ stock_actual: productoNuevo.stockActual }).eq('id', nuevoProductoId);
    return { ok: true };
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  return { ok: true };
});

/** Dependencias de Gestión/Entregas: sin registros TXT ni hijos de TXT (habitaciones importadas). */
const TXT_DEP_ID_PREFIX_STOCK = 'txt-dep-';

function filterDependenciasParaEntregasStock(deps, txtDependencias) {
  const list = Array.isArray(deps) ? deps : [];
  const txtList = Array.isArray(txtDependencias) ? txtDependencias : [];
  const txtIdSet = new Set();
  txtList.forEach((d) => {
    if (d && d.id != null) txtIdSet.add(String(d.id));
  });
  const cache = new Map();
  function isTxtLikeId(id) {
    const s = String(id || '');
    return s.indexOf(TXT_DEP_ID_PREFIX_STOCK) === 0 || txtIdSet.has(s);
  }
  function shouldExclude(dep) {
    if (!dep || dep.id == null) return true;
    const id = String(dep.id);
    if (cache.has(id)) return cache.get(id);
    if (isTxtLikeId(id)) {
      cache.set(id, true);
      return true;
    }
    const parentId = dep.parentId;
    if (parentId == null || parentId === '') {
      cache.set(id, false);
      return false;
    }
    const parent = list.find((x) => x && String(x.id) === String(parentId));
    const ex = parent ? shouldExclude(parent) : false;
    cache.set(id, ex);
    return ex;
  }
  return list.filter((d) => !shouldExclude(d));
}

// IPC: Dependencias (destinos)
ipcMain.handle('get-dependencias', async () => {
  const data = await loadData();
  return filterDependenciasParaEntregasStock(data.dependencias || [], data.txtDependencias || []);
});

// IPC: TXT dependencias (EXCLUSIVAS de la pestaña TXT)
ipcMain.handle('get-txt-dependencias', async () => {
  if (supabase) {
    try {
      const raw = await fetchAllRows('txt_dependencias', 'id', true);
      return (raw || []).map(function (r) {
        return {
          id: r.id,
          nombre: r.nombre || '',
          codigo: r.codigo != null ? String(r.codigo) : '',
          parentId: r.parent_id ?? null,
          numero: r.numero != null ? String(r.numero) : null
        };
      });
    } catch (e) {
      console.warn('[TXT] get-txt-dependencias Supabase:', e && e.message);
    }
  }
  const data = await loadData();
  return data.txtDependencias || [];
});

ipcMain.handle('get-txt-realizados', async () => {
  const data = await loadData();
  const list = Array.isArray(data.txtRealizados) ? data.txtRealizados : [];
  return list.sort((a, b) => {
    const aa = a && a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const bb = b && b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return bb - aa;
  });
});

function isTxtRealizadosSupabaseSchemaError(err) {
  const msg = String((err && err.message) || err || '').toLowerCase();
  const code = String((err && err.code) || '');
  if (code === '42P01' || code === 'PGRST204' || code === 'PGRST205') return true;
  if (msg.includes('txt_realizados') && (
    msg.includes('does not exist') ||
    msg.includes('schema cache') ||
    msg.includes('could not find the table') ||
    msg.includes('relation')
  )) return true;
  if (msg.includes('registros_json') && (msg.includes('column') || msg.includes('could not find'))) return true;
  return false;
}

/** RLS / permisos en Supabase: la app guarda en esta PC y no muestra error falso. */
function isTxtRealizadosSupabaseAccessError(err) {
  const msg = String((err && err.message) || err || '').toLowerCase();
  const code = String((err && err.code) || '');
  if (code === '42501') return true;
  if (msg.includes('row-level security') || msg.includes('row level security')) return true;
  if (msg.includes('violates') && msg.includes('policy')) return true;
  if (msg.includes('permission denied')) return true;
  return false;
}

function isTxtRealizadosSupabaseFallbackError(err) {
  return isTxtRealizadosSupabaseSchemaError(err) || isTxtRealizadosSupabaseAccessError(err);
}

async function persistTxtRealizadoLocal(row) {
  const data = await loadData();
  if (!Array.isArray(data.txtRealizados)) data.txtRealizados = [];
  const idx = data.txtRealizados.findIndex(r => r && String(r.id) === row.id);
  if (idx >= 0) data.txtRealizados[idx] = { ...data.txtRealizados[idx], ...row };
  else data.txtRealizados.push(row);
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

ipcMain.handle('save-txt-realizado', async (_, realizado) => {
  if (!realizado || !realizado.id) throw new Error('Realizado inválido');
  const row = {
    id: String(realizado.id),
    nombre: realizado.nombre != null ? String(realizado.nombre) : '',
    registros: Array.isArray(realizado.registros) ? realizado.registros : [],
    createdAt: realizado.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  let esEdicion = false;
  if (supabase) {
    const { data: rows, error: selErr } = await supabase
      .from('txt_realizados')
      .select('id')
      .eq('id', row.id)
      .limit(1);
    if (!selErr && rows) esEdicion = rows.length > 0;
    else {
      const d = await loadData();
      esEdicion = Array.isArray(d.txtRealizados) && d.txtRealizados.some(r => r && String(r.id) === row.id);
    }
  } else {
    const d = await loadData();
    esEdicion = Array.isArray(d.txtRealizados) && d.txtRealizados.some(r => r && String(r.id) === row.id);
  }
  if (esEdicion && !isAdminSession()) {
    throw new Error('Solo un administrador puede editar registros de TXT.');
  }

  if (supabase) {
    const payload = {
      id: row.id,
      nombre: row.nombre,
      registros_json: row.registros,
      created_at: row.createdAt,
      updated_at: row.updatedAt
    };
    const { error } = await supabase.from('txt_realizados').upsert(payload, { onConflict: 'id' });
    if (!error) {
      try { await persistTxtRealizadoLocal(row); } catch (_) { /* copia local opcional */ }
      return { ok: true, storage: 'supabase' };
    }
    if (isTxtRealizadosSupabaseFallbackError(error)) {
      await persistTxtRealizadoLocal(row);
      const warnRls = isTxtRealizadosSupabaseAccessError(error);
      return {
        ok: true,
        storage: 'local',
        warn: warnRls
          ? 'Se guardó en Realizados en esta PC. Los archivos TXT/Word ya se exportaron. Para sincronizar en Supabase, ejecutá supabase-txt-realizados.sql (políticas RLS).'
          : 'Se guardó en esta PC. Ejecutá supabase-txt-realizados.sql en Supabase para sincronizar en la nube.'
      };
    }
    throw new Error(error.message || 'Error al guardar TXT realizado');
  }

  await persistTxtRealizadoLocal(row);
  return { ok: true, storage: 'local' };
});

ipcMain.handle('delete-txt-realizado', async (_, id) => {
  ensureAdminSession('Solo un administrador puede eliminar registros de TXT.');
  const rid = id != null ? String(id) : '';
  if (!rid) throw new Error('ID inválido');

  if (supabase) {
    const { error } = await supabase.from('txt_realizados').delete().eq('id', rid);
    if (error) throw new Error(error.message || 'Error al eliminar TXT realizado');
    return { ok: true };
  }

  const data = await loadData();
  if (!Array.isArray(data.txtRealizados)) data.txtRealizados = [];
  data.txtRealizados = data.txtRealizados.filter(r => !(r && String(r.id) === rid));
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  return { ok: true };
});

ipcMain.handle('import-txt-dependencias', async (_, dependencias) => {
  const list = Array.isArray(dependencias) ? dependencias : [];
  const clean = list
    .filter(d => d && d.id != null)
    .map(d => ({
      id: String(d.id),
      nombre: d.nombre != null ? String(d.nombre) : '',
      codigo: d.codigo != null ? String(d.codigo) : '',
      parentId: d.parentId ?? null,
      numero: d.numero != null ? String(d.numero) : ''
    }));

  if (!clean.length) return { ok: true, total: 0, inserted: 0, updated: 0 };

  if (supabase) {
    const rows = clean.map(d => ({
      id: d.id,
      nombre: d.nombre,
      codigo: d.codigo,
      parent_id: d.parentId ?? null,
      numero: d.numero && String(d.numero).trim() !== '' ? String(d.numero) : null
    }));

    // Borrar datos viejos: primero hijos (por FK), luego padres
    await supabase.from('txt_dependencias').delete().not('parent_id', 'is', null);
    await supabase.from('txt_dependencias').delete().is('parent_id', null);

    const parents = rows.filter(r => !r.parent_id);
    const children = rows.filter(r => !!r.parent_id);

    const BATCH = 500;
    for (let i = 0; i < parents.length; i += BATCH) {
      const chunk = parents.slice(i, i + BATCH);
      const { error: e1 } = await supabase.from('txt_dependencias').insert(chunk);
      if (e1) throw new Error(e1.message);
    }
    for (let i = 0; i < children.length; i += BATCH) {
      const chunk = children.slice(i, i + BATCH);
      const { error: e2 } = await supabase.from('txt_dependencias').insert(chunk);
      if (e2) throw new Error(e2.message);
    }

    return { ok: true, total: rows.length, inserted: rows.length, updated: 0 };
  }

  const data = await loadData();
  if (!data.txtDependencias) data.txtDependencias = [];

  const idxById = new Map();
  (data.txtDependencias || []).forEach((d, idx) => {
    if (d && d.id != null) idxById.set(String(d.id), idx);
  });

  let inserted = 0;
  let updated = 0;
  clean.forEach(d => {
    const id = d.id;
    const row = { id, nombre: d.nombre, codigo: d.codigo, parentId: d.parentId ?? null, numero: d.numero != null ? String(d.numero) : '' };
    if (idxById.has(id)) {
      const idx = idxById.get(id);
      data.txtDependencias[idx] = { ...(data.txtDependencias[idx] || {}), ...row };
      updated++;
    } else {
      data.txtDependencias.push(row);
      idxById.set(id, data.txtDependencias.length - 1);
      inserted++;
    }
  });

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  return { ok: true, total: clean.length, inserted, updated };
});

ipcMain.handle('save-txt-dependencia', async (_, dependencia) => {
  if (!dependencia.id) dependencia.id = Date.now().toString();
  let esEdicion = false;
  if (supabase) {
    const { data: rows } = await supabase.from('txt_dependencias').select('id').eq('id', String(dependencia.id)).limit(1);
    esEdicion = !!(rows && rows.length);
  } else {
    const d = await loadData();
    esEdicion = Array.isArray(d.txtDependencias) && d.txtDependencias.some(x => x && String(x.id) === String(dependencia.id));
  }
  if (esEdicion && !isAdminSession()) {
    throw new Error('Solo un administrador puede editar dependencias de TXT.');
  }
  const row = {
    id: dependencia.id,
    nombre: dependencia.nombre || '',
    codigo: dependencia.codigo != null ? String(dependencia.codigo) : '',
    parent_id: dependencia.parentId ?? null,
    numero: dependencia.numero != null ? String(dependencia.numero) : null
  };
  if (supabase) {
    const { error } = await supabase.from('txt_dependencias').upsert(row, { onConflict: 'id' });
    if (error) throw new Error(error.message);
    try {
      let data;
      try {
        data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
      } catch (_) {
        data = {};
      }
      if (!data.txtDependencias) data.txtDependencias = [];
      const idxLocal = data.txtDependencias.findIndex(function (d) { return d && String(d.id) === String(dependencia.id); });
      const toSave = {
        id: dependencia.id,
        nombre: dependencia.nombre || '',
        codigo: dependencia.codigo != null ? String(dependencia.codigo) : '',
        parentId: dependencia.parentId ?? null,
        numero: dependencia.numero != null ? String(dependencia.numero) : ''
      };
      if (idxLocal >= 0) data.txtDependencias[idxLocal] = { ...data.txtDependencias[idxLocal], ...toSave };
      else data.txtDependencias.push(toSave);
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (_) { /* caché local opcional */ }
    return dependencia.id;
  }
  const data = await loadData();
  if (!data.txtDependencias) data.txtDependencias = [];
  const idx = data.txtDependencias.findIndex(d => d.id === dependencia.id);
  const toSave = { id: dependencia.id, nombre: dependencia.nombre || '', codigo: dependencia.codigo != null ? String(dependencia.codigo) : '', parentId: dependencia.parentId ?? null, numero: dependencia.numero != null ? String(dependencia.numero) : '' };
  if (idx >= 0) data.txtDependencias[idx] = { ...data.txtDependencias[idx], ...toSave };
  else data.txtDependencias.push(toSave);
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  return dependencia.id;
});

// Normalizar nombres de dependencias/divisiones a MAYUSCULAS (para arreglar datos históricos)
ipcMain.handle('normalize-dependencias-nombres', async () => {
  const data = await loadData();
  const deps = Array.isArray(data.dependencias) ? data.dependencias : [];
  // Evitar modificar registros importados desde TXT
  const isTxtId = (id) => typeof id === 'string' && id.startsWith('txt-dep-');
  const needs = deps.some(d => d && typeof d.nombre === 'string' && d.nombre !== d.nombre.toUpperCase());
  if (!needs) return { ok: true, updated: 0, skipped: true };

  let updated = 0;
  if (supabase) {
    const { data: rows, error } = await supabase.from('dependencias').select('id,nombre');
    if (error) throw new Error(error.message);
    for (const r of rows || []) {
      if (isTxtId(r && r.id)) continue;
      const n = (r && r.nombre != null ? r.nombre : '');
      const up = String(n).toUpperCase();
      if (up !== n) {
        const { error: e2 } = await supabase.from('dependencias').update({ nombre: up }).eq('id', r.id);
        if (e2) throw new Error(e2.message);
        updated++;
      }
    }
    return { ok: true, updated, skipped: false };
  }

  // Modo archivo local (stock-data.json)
  if (!data.dependencias) data.dependencias = [];
  data.dependencias = data.dependencias.map(d => {
    if (d && d.id && String(d.id).startsWith('txt-dep-')) return d;
    if (!d || d.nombre == null) return d;
    return Object.assign({}, d, { nombre: String(d.nombre).toUpperCase() });
  });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');

  // Contar cambios para feedback
  updated = deps.reduce((acc, d) => acc + (d && typeof d.nombre === 'string' && d.nombre !== d.nombre.toUpperCase() ? 1 : 0), 0);
  return { ok: true, updated, skipped: false };
});

// IPC: Importar dependencias/divisiones desde TXT/CSV (batch)
// Formato esperado desde el frontend:
// [{ id, nombre, codigo, parentId: null|id, numero }]
ipcMain.handle('import-dependencias', async (_, dependencias) => {
  ensureAdminSession('Solo un administrador puede modificar dependencias.');
  const list = Array.isArray(dependencias) ? dependencias : [];
  const clean = list
    .filter(d => d && d.id != null)
    .map(d => ({
      id: String(d.id),
      nombre: d.nombre != null ? String(d.nombre) : '',
      codigo: d.codigo != null ? String(d.codigo) : '',
      parentId: d.parentId ?? null,
      numero: d.numero != null ? String(d.numero) : ''
    }));

  if (!clean.length) return { ok: true, total: 0, inserted: 0, updated: 0 };

  if (supabase) {
    const rows = clean.map(d => ({
      id: d.id,
      nombre: d.nombre,
      codigo: d.codigo,
      parent_id: d.parentId ?? null,
      numero: d.numero && String(d.numero).trim() !== '' ? String(d.numero) : null
    }));
    const { error } = await supabase.from('dependencias').upsert(rows, { onConflict: 'id' });
    if (error) throw new Error(error.message);
    return { ok: true, total: rows.length, inserted: rows.length, updated: 0 };
  }

  const data = await loadData();
  if (!data.dependencias) data.dependencias = [];

  // Insert/Update local por id
  const idxById = new Map();
  (data.dependencias || []).forEach((d, idx) => {
    if (d && d.id != null) idxById.set(String(d.id), idx);
  });

  let inserted = 0;
  let updated = 0;
  clean.forEach(d => {
    const id = d.id;
    const row = {
      id,
      nombre: d.nombre,
      codigo: d.codigo,
      parentId: d.parentId ?? null,
      numero: d.numero != null ? String(d.numero) : ''
    };

    if (idxById.has(id)) {
      const idx = idxById.get(id);
      data.dependencias[idx] = { ...(data.dependencias[idx] || {}), ...row };
      updated++;
    } else {
      data.dependencias.push(row);
      idxById.set(id, data.dependencias.length - 1);
      inserted++;
    }
  });

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  return { ok: true, total: clean.length, inserted, updated };
});

ipcMain.handle('save-dependencia', async (_, dependencia) => {
  const session = loadSession();
  if (!session || !session.username) {
    throw new Error('Debe iniciar sesión.');
  }
  if (!dependencia.id) dependencia.id = Date.now().toString();

  let esEdicion = false;
  if (supabase) {
    const { data: rows } = await supabase.from('dependencias').select('id').eq('id', String(dependencia.id)).limit(1);
    esEdicion = !!(rows && rows.length);
  } else {
    const data = await loadData();
    esEdicion = (data.dependencias || []).some((d) => d && String(d.id) === String(dependencia.id));
  }
  if (esEdicion && !isAdminSession()) {
    throw new Error('Solo un administrador puede editar dependencias.');
  }

  const row = {
    id: dependencia.id,
    nombre: dependencia.nombre || '',
    codigo: dependencia.codigo != null ? String(dependencia.codigo) : '',
    parent_id: dependencia.parentId ?? null,
    numero: dependencia.numero != null ? String(dependencia.numero) : null
  };
  if (supabase) {
    const { error } = await supabase.from('dependencias').upsert(row, { onConflict: 'id' });
    if (error) throw new Error(error.message);
    await logAudit(
      esEdicion ? 'MODIFICAR' : 'CREAR',
      'Dependencias',
      (esEdicion ? 'Editó' : 'Creó') + ' dependencia ' + (row.nombre || row.id),
      row.id
    );
    return dependencia.id;
  }
  const data = await loadData();
  if (!data.dependencias) data.dependencias = [];
  const idx = data.dependencias.findIndex(d => d.id === dependencia.id);
  const toSave = { id: dependencia.id, nombre: dependencia.nombre || '', codigo: dependencia.codigo != null ? String(dependencia.codigo) : '', parentId: dependencia.parentId ?? null, numero: dependencia.numero != null ? String(dependencia.numero) : '' };
  if (idx >= 0) data.dependencias[idx] = { ...data.dependencias[idx], ...toSave };
  else data.dependencias.push(toSave);
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  await logAudit(
    esEdicion ? 'MODIFICAR' : 'CREAR',
    'Dependencias',
    (esEdicion ? 'Editó' : 'Creó') + ' dependencia ' + (toSave.nombre || toSave.id),
    toSave.id
  );
  return dependencia.id;
});

ipcMain.handle('delete-dependencia', async (_, id) => {
  const session = loadSession();
  if (!session || !session.username || (session.rol || 'usuario') !== 'admin') {
    throw new Error('No autorizado');
  }
  if (supabase) {
    await supabase.from('dependencias').delete().eq('parent_id', id);
    const { error } = await supabase.from('dependencias').delete().eq('id', id);
    if (error) throw new Error(error.message);
    await logAudit('ELIMINAR', 'Dependencias', 'Eliminó dependencia ' + id, id);
    return true;
  }
  const data = await loadData();
  data.dependencias = (data.dependencias || []).filter(d => d.id !== id && d.parentId !== id);
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  await logAudit('ELIMINAR', 'Dependencias', 'Eliminó dependencia ' + id, id);
  return true;
});

// IPC: Conteo "ORDEN" por dependencia/división (TXT)
function parseTxtOrdenCountInput(value) {
  const digits = String(value ?? '').trim().replace(/[^\d]/g, '');
  if (!digits) return 0;
  const n = parseInt(digits, 10);
  return Number.isNaN(n) || n < 0 ? 0 : n;
}

ipcMain.handle('get-txt-orden-count', async (_, id) => {
  if (!id) return 0;
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('txt_orden_counts')
        .select('count')
        .eq('id', String(id))
        .limit(1)
        .maybeSingle();
      if (!error && data) {
        const n = parseInt(data.count, 10);
        return isNaN(n) ? 0 : Math.max(0, n);
      }
    } catch (_) {}
  }
  const counts = loadTxtOrdenCounts();
  return getTxtOrdenEntry(counts, id).count;
});

ipcMain.handle('get-txt-orden-info', async (_, id) => {
  if (!id) return { count: 0, updatedAt: null };
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('txt_orden_counts')
        .select('count, updated_at')
        .eq('id', String(id))
        .limit(1)
        .maybeSingle();
      if (!error && data) {
        const n = parseInt(data.count, 10);
        return {
          count: isNaN(n) ? 0 : Math.max(0, n),
          updatedAt: data.updated_at ? String(data.updated_at) : null
        };
      }
    } catch (_) {}
  }
  const counts = loadTxtOrdenCounts();
  return getTxtOrdenEntry(counts, id);
});

ipcMain.handle('save-txt-orden-count', async (_, id, count) => {
  if (!id) throw new Error('Falta id');
  const safeCount = parseTxtOrdenCountInput(count);
  if (supabase) {
    try {
      const payload = { id: String(id), count: safeCount, updated_at: new Date().toISOString() };
      const { error } = await supabase.from('txt_orden_counts').upsert(payload, { onConflict: 'id' });
      if (!error) return { ok: true };
    } catch (_) {}
  }
  const counts = loadTxtOrdenCounts();
  const k = String(id);
  counts[k] = { count: safeCount, updatedAt: new Date().toISOString() };
  saveTxtOrdenCounts(counts);
  return { ok: true };
});

// IPC: Guardia - provisiones (dependencia + producto + fecha)
ipcMain.handle('get-guardia-provisiones', async () => fetchGuardiaProvisionesOnly());

ipcMain.handle('save-guardia-provision', async (_, provision) => {
  if (!provision.id) provision.id = Date.now().toString();
  const cantidad = provision.cantidad != null ? parseInt(provision.cantidad, 10) : 1;
  if (isNaN(cantidad) || cantidad <= 0) throw new Error('Cantidad inválida');

  const session = loadSession();
  const usuarioSession = session && session.username ? session.username : null;
  const usuarioFinal = provision && provision.usuario ? provision.usuario : usuarioSession;

  const data = await loadData();
  const esEdicionProvision = (data.guardiaProvisiones || []).some(function (p) { return p && p.id === provision.id; });
  if (esEdicionProvision && !isAdminSession()) {
    throw new Error('Solo un administrador puede editar entregas registradas.');
  }
  const mov = (data.movimientos || []).find(m => m.id === provision.movimiento_id);
  if (!mov && provision.movimiento_id) throw new Error('Movimiento no encontrado');
  if (mov) {
    const movCant = parseInt(mov.cantidad, 10) || 0;
    const provisiones = (data.guardiaProvisiones || []).filter(p => p.movimiento_id === provision.movimiento_id);
    const totalProvisionado = provisiones.reduce((sum, p) => {
      const c = p.id === provision.id ? cantidad : (parseInt(p.cantidad, 10) || 0);
      return sum + c;
    }, 0);
    if (totalProvisionado > movCant) throw new Error('No hay cantidad disponible. No se puede entregar más de lo disponible.');
  }

  // Concepto: si no viene, completar automáticamente con "características"
  // (en este sistema, el campo concepto se usa como descripción/características)
  let conceptoAuto = (provision && provision.concepto != null ? String(provision.concepto) : '').trim();
  if (!conceptoAuto) {
    const parts = [];
    if (mov) {
      const marca = (mov.marca != null ? String(mov.marca) : '').trim();
      const desc = (mov.concepto != null ? String(mov.concepto) : '').trim();
      if (marca) parts.push('Marca: ' + marca);
      if (desc) parts.push(desc);
    } else {
      const prod = (data.productos || []).find(p => p.id === provision.producto_id);
      if (prod) {
        const marca = (prod.marca != null ? String(prod.marca) : '').trim();
        const desc = (prod.descripcion != null ? String(prod.descripcion) : '').trim();
        if (marca) parts.push('Marca: ' + marca);
        if (desc) parts.push(desc);
      }
    }
    conceptoAuto = parts.join(' · ').trim();
  }

  const row = {
    id: provision.id,
    dependencia_id: provision.dependencia_id,
    producto_id: provision.producto_id,
    fecha_asignacion: provision.fecha_asignacion || new Date().toISOString(),
    cantidad: provision.cantidad != null ? provision.cantidad : 1,
    concepto: conceptoAuto || null,
    usuario: usuarioFinal
  };
  if (provision.movimiento_id) row.movimiento_id = provision.movimiento_id;
  if (supabase) {
    let result = await supabase.from('guardia_provision').upsert(row, { onConflict: 'id' });
    if (result.error && /movimiento_id|column.*schema/i.test(result.error.message)) {
      delete row.movimiento_id;
      result = await supabase.from('guardia_provision').upsert(row, { onConflict: 'id' });
    }
    if (result.error && /usuario/i.test(result.error.message || '')) {
      delete row.usuario;
      result = await supabase.from('guardia_provision').upsert(row, { onConflict: 'id' });
    }
    if (result.error) throw new Error(result.error.message);
    await logAudit('ENTREGAR', 'Entregas', 'Proveyó ' + (provision.cantidad || 1) + ' unidad(es) a dependencia ' + provision.dependencia_id + ' (dep:' + provision.dependencia_id + ')', provision.id);
    return provision.id;
  }
  if (!data.guardiaProvisiones) data.guardiaProvisiones = [];
  const idx = data.guardiaProvisiones.findIndex(p => p.id === provision.id);
  const toSave = { id: provision.id, dependencia_id: provision.dependencia_id, producto_id: provision.producto_id, movimiento_id: provision.movimiento_id || null, fecha_asignacion: provision.fecha_asignacion || new Date().toISOString(), cantidad: provision.cantidad != null ? provision.cantidad : 1, concepto: conceptoAuto || null, usuario: usuarioSession };
  toSave.usuario = usuarioFinal;
  if (idx >= 0) data.guardiaProvisiones[idx] = toSave;
  else data.guardiaProvisiones.push(toSave);
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  await logAudit('ENTREGAR', 'Entregas', 'Proveyó ' + (provision.cantidad || 1) + ' unidad(es) a dependencia ' + provision.dependencia_id + ' (dep:' + provision.dependencia_id + ')', provision.id);
  return provision.id;
});

ipcMain.handle('delete-guardia-provision', async (_, id) => {
  ensureAdminSession('Solo un administrador puede eliminar entregas registradas.');
  if (supabase) {
    // Capturar dependencia_id para auditoría antes de borrar
    let depId = null;
    try {
      const { data: rows } = await supabase.from('guardia_provision').select('dependencia_id').eq('id', id).limit(1);
      if (rows && rows[0] && rows[0].dependencia_id != null) depId = rows[0].dependencia_id;
    } catch (_) {}
    const { error } = await supabase.from('guardia_provision').delete().eq('id', id);
    if (error) throw new Error(error.message);
    await logAudit('QUITAR', 'Entregas', 'Quitó provisión ' + id + (depId != null ? (' (dep:' + depId + ')') : ''), id);
    return true;
  }
  const data = await loadData();
  const prov = (data.guardiaProvisiones || []).find(p => p.id === id) || null;
  data.guardiaProvisiones = (data.guardiaProvisiones || []).filter(p => p.id !== id);
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  await logAudit('QUITAR', 'Entregas', 'Quitó provisión ' + id + (prov && prov.dependencia_id != null ? (' (dep:' + prov.dependencia_id + ')') : ''), id);
  return true;
});

// IPC: Registrar acta de entrega (al imprimir desde Entregas)
function saveActasToFile(acta) {
  let data = { productos: [], movimientos: [], dependencias: [], guardiaProvisiones: [], actas: [] };
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      data = JSON.parse(raw);
    }
  } catch (_) { /* usar data por defecto */ }
  if (!data.actas) data.actas = [];
  data.actas.unshift(acta);
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function loadActasFromFile() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const data = JSON.parse(raw);
      return Array.isArray(data.actas) ? data.actas : [];
    }
  } catch (_) { /* ignorar */ }
  return [];
}

// IPC: Guardar matafuego
ipcMain.handle('save-matafuego', async (_, matafuego) => {
  console.log('[MATAFUEGOS][save-matafuego] Inicio', {
    id: matafuego && matafuego.id ? matafuego.id : null,
    estado: matafuego && matafuego.estado ? matafuego.estado : null,
    dependenciaId: matafuego && matafuego.dependenciaId ? matafuego.dependenciaId : null,
    fechaIngreso: matafuego && matafuego.fechaIngreso ? matafuego.fechaIngreso : null
  });
  if (!matafuego.id) matafuego.id = Date.now().toString();
  let prevMatafuego = null;
  let esEdicion = false;
  if (supabase) {
    const { data: rows } = await supabase
      .from('matafuegos')
      .select('id, marca, numero_serie, caracteristicas, fecha_vencimiento, estado, fecha_ingreso, dependencia_id, fecha_entrega')
      .eq('id', String(matafuego.id))
      .limit(1);
    esEdicion = !!(rows && rows.length);
    if (esEdicion) prevMatafuego = mapMatafuegoRowDbToApp(rows[0]);
  } else {
    const d = await loadData();
    if (Array.isArray(d.matafuegos)) {
      const prevLocal = d.matafuegos.find(x => x && String(x.id) === String(matafuego.id));
      esEdicion = !!prevLocal;
      if (prevLocal) prevMatafuego = {
        id: prevLocal.id,
        marca: prevLocal.marca || null,
        numeroSerie: prevLocal.numeroSerie || '',
        caracteristicas: prevLocal.caracteristicas || null,
        fechaVencimiento: prevLocal.fechaVencimiento || null,
        estado: prevLocal.estado || 'disponible',
        fechaIngreso: prevLocal.fechaIngreso || null,
        dependenciaId: prevLocal.dependenciaId || null,
        fechaEntrega: prevLocal.fechaEntrega || null
      };
    }
  }
  if (esEdicion && !isAdminSession() && !isMatafuegoSoloEntregaDesdeDisponible(prevMatafuego, matafuego) && !isMatafuegoSoloVueltaDisponibleDesdeRecarga(prevMatafuego, matafuego) && !isMatafuegoSoloCambioVencimiento(prevMatafuego, matafuego)) {
    throw new Error('Solo un administrador puede editar matafuegos.');
  }
  const serieNorm = String(matafuego.numeroSerie || '').trim();
  if (serieNorm) {
    const dupSerie = await findMatafuegoBySerieDuplicado(serieNorm, esEdicion ? matafuego.id : null);
    if (dupSerie) {
      throw new Error('El número de serie ya está registrado en el sistema.');
    }
  }
  const estadoApp = normalizeMatafuegoEstadoFromDb(matafuego.estado || 'disponible', matafuego.dependenciaId || null);
  let fechaEntrega = matafuego.fechaEntrega != null && matafuego.fechaEntrega !== ''
    ? String(matafuego.fechaEntrega).slice(0, 10)
    : (prevMatafuego && prevMatafuego.fechaEntrega ? String(prevMatafuego.fechaEntrega).slice(0, 10) : null);
  if (estadoApp === 'entregado') {
    if (!fechaEntrega) fechaEntrega = new Date().toISOString().slice(0, 10);
  } else {
    fechaEntrega = null;
  }
  const row = {
    id: matafuego.id,
    marca: matafuego.marca || null,
    numero_serie: matafuego.numeroSerie || '',
    caracteristicas: matafuego.caracteristicas || null,
    fecha_vencimiento: matafuego.fechaVencimiento || null,
    estado: normalizeMatafuegoEstadoToDb(matafuego.estado || 'disponible'),
    fecha_ingreso: matafuego.fechaIngreso || null,
    dependencia_id: matafuego.dependenciaId || null,
    fecha_entrega: fechaEntrega
  };
  // Compatibilidad con esquema actual de Supabase (estado solo disponible/recarga):
  // "entregado" se representa como estado disponible + dependencia asignada.
  const nextMatafuego = {
    id: matafuego.id,
    marca: matafuego.marca || null,
    numeroSerie: matafuego.numeroSerie || '',
    caracteristicas: matafuego.caracteristicas || null,
    fechaVencimiento: matafuego.fechaVencimiento || null,
    estado: estadoApp,
    fechaIngreso: matafuego.fechaIngreso || null,
    dependenciaId: matafuego.dependenciaId || null,
    fechaEntrega
  };
  if (estadoApp === 'entregado') row.estado = 'disponible';
  if (supabase) {
    const estadoCandidates = getMatafuegoEstadoDbCandidates(matafuego.estado || 'disponible');
    console.log('[MATAFUEGOS][save-matafuego] Supabase candidatos estado', {
      estadoOriginal: matafuego.estado || 'disponible',
      estadoApp: estadoApp,
      estadoRowInicial: row.estado,
      candidatos: estadoCandidates
    });
    let lastErr = null;
    let lastEstadoTried = null;
    for (const estadoDb of estadoCandidates) {
      const rowTry = { ...row, estado: estadoDb };
      lastEstadoTried = estadoDb;
      console.log('[MATAFUEGOS][save-matafuego] Intentando upsert', {
        id: rowTry.id,
        estado: rowTry.estado,
        dependencia_id: rowTry.dependencia_id,
        fecha_ingreso: rowTry.fecha_ingreso
      });
      const { error } = await supabase.from('matafuegos').upsert(rowTry, { onConflict: 'id' });
      if (!error) {
        console.log('[MATAFUEGOS][save-matafuego] Upsert OK', {
          id: rowTry.id,
          estadoGuardado: rowTry.estado
        });
        lastErr = null;
        break;
      }
      lastErr = error;
      console.error('[MATAFUEGOS][save-matafuego] Upsert ERROR', {
        id: rowTry.id,
        estadoProbado: rowTry.estado,
        code: error.code || null,
        details: error.details || null,
        hint: error.hint || null,
        message: error.message || String(error)
      });
      const msg = String(error.message || '');
      if (!msg.toLowerCase().includes('matafuegos_estado_check')) break;
    }
    if (lastErr) {
      const baseMsg = lastErr.message || 'Error al guardar matafuego';
      const code = String(lastErr.code || '');
      const msgLow = baseMsg.toLowerCase();
      if (code === '23505' || msgLow.includes('duplicate key') || msgLow.includes('unique constraint') || msgLow.includes('idx_matafuegos_numero_serie')) {
        throw new Error('Ya existe un matafuego con ese número de serie. Verificá el listado o usá otro Nº de serie.');
      }
      console.error('[MATAFUEGOS][save-matafuego] Fallo final', {
        id: row.id,
        estadoApp: estadoApp,
        ultimoEstadoProbado: lastEstadoTried,
        rowBase: row
      });
      throw new Error(baseMsg + ' (estado probado: ' + String(lastEstadoTried || 'N/D') + ')');
    }
    await logMatafuegoMovimiento(prevMatafuego, nextMatafuego);
    return matafuego.id;
  }
  const data = await loadData();
  if (!data.matafuegos) data.matafuegos = [];
  const idx = data.matafuegos.findIndex(m => m.id === matafuego.id);
  const prevLocal = idx >= 0 ? data.matafuegos[idx] : null;
  let usuarioEntrega = prevLocal && prevLocal.usuarioEntrega ? prevLocal.usuarioEntrega : null;
  const entregaNueva = estadoApp === 'entregado' && (!prevMatafuego || !prevMatafuego.dependenciaId);
  if (entregaNueva) {
    const sess = loadSession();
    if (sess && sess.username) usuarioEntrega = sess.username;
  } else if (estadoApp !== 'entregado') {
    usuarioEntrega = null;
  }
  const toSave = {
    id: matafuego.id,
    marca: matafuego.marca,
    numeroSerie: matafuego.numeroSerie,
    caracteristicas: matafuego.caracteristicas,
    fechaVencimiento: matafuego.fechaVencimiento,
    estado: matafuego.estado || 'disponible',
    fechaIngreso: matafuego.fechaIngreso || null,
    dependenciaId: matafuego.dependenciaId || null,
    fechaEntrega: nextMatafuego.fechaEntrega || null,
    usuarioEntrega: usuarioEntrega || null
  };
  if (idx >= 0) data.matafuegos[idx] = toSave;
  else data.matafuegos.unshift(toSave);
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  await logMatafuegoMovimiento(prevMatafuego, nextMatafuego);
  return matafuego.id;
});

// IPC: Eliminar matafuego
ipcMain.handle('delete-matafuego', async (_, id) => {
  const session = loadSession();
  if (!session || !session.username || (session.rol || 'usuario') !== 'admin') {
    throw new Error('Solo un administrador puede eliminar matafuegos.');
  }
  if (supabase) {
    const { error } = await supabase.from('matafuegos').delete().eq('id', id);
    if (error) throw new Error(error.message);
    await logAudit('ELIMINAR', 'Matafuegos', 'Eliminó matafuego ' + id, id);
    return;
  }
  const data = await loadData();
  if (!data.matafuegos) data.matafuegos = [];
  data.matafuegos = data.matafuegos.filter(m => m.id !== id);
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  await logAudit('ELIMINAR', 'Matafuegos', 'Eliminó matafuego ' + id, id);
});

ipcMain.handle('save-acta', async (_, acta) => {
  if (!acta.id) acta.id = Date.now().toString();
  acta.fecha = acta.fecha || new Date().toISOString();
  if (!acta.seriales) acta.seriales = [];
  let esEdicion = false;
  if (supabase) {
    try {
      const { data: rows } = await supabase.from('actas').select('id').eq('id', String(acta.id)).limit(1);
      esEdicion = !!(rows && rows.length);
    } catch (_) {}
  }
  if (!supabase) {
    const dataActa = await loadData();
    esEdicion = Array.isArray(dataActa.actas) && dataActa.actas.some(a => a && String(a.id || '') === String(acta.id));
  }
  if (esEdicion && !isAdminSession()) {
    throw new Error('Solo un administrador puede editar actas.');
  }

  if (supabase) {
    try {
      const row = {
        id: acta.id,
        fecha: acta.fecha,
        dependencia_id: acta.dependencia_id || null,
        dep_label: acta.depLabel || '',
        product_label: acta.productLabel || '',
        expediente: acta.expediente || '',
        cantidad: acta.cantidad != null ? acta.cantidad : 1,
        seriales: JSON.stringify(acta.seriales),
        concepto: acta.concepto || null,
        provision_id: acta.provision_id || null
      };
      const { error } = await supabase.from('actas').upsert(row, { onConflict: 'id' });
      if (error) throw new Error(error.message);
      await logAudit('CREAR', 'Actas', 'Generó acta para ' + (acta.depLabel || 'dependencia') + ' - ' + (acta.productLabel || ''), acta.id);
      return acta.id;
    } catch (err) {
      console.warn('Supabase actas falló, guardando en archivo local:', err && err.message);
      saveActasToFile(acta);
      await logAudit('CREAR', 'Actas', 'Generó acta para ' + (acta.depLabel || 'dependencia') + ' - ' + (acta.productLabel || ''), acta.id);
      return acta.id;
    }
  }
  const data = await loadData();
  if (!data.actas) data.actas = [];
  const idx = data.actas.findIndex(a => (a.id || '') === (acta.id || ''));
  if (idx >= 0) data.actas[idx] = acta;
  else data.actas.unshift(acta);
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  await logAudit('CREAR', 'Actas', 'Generó acta para ' + (acta.depLabel || 'dependencia') + ' - ' + (acta.productLabel || ''), acta.id);
  return acta.id;
});

// IPC: Eliminar acta
ipcMain.handle('delete-acta', async (_, id) => {
  ensureAdminSession('Solo un administrador puede eliminar actas.');
  if (!id) throw new Error('Acta inválida');

  // Si hay supabase, borrar en tabla actas
  if (supabase) {
    try {
      const { error } = await supabase.from('actas').delete().eq('id', id);
      if (error) throw new Error(error.message);
      await removeActaAdjunto(id);
      return true;
    } catch (err) {
      // Si falla Supabase, intentamos eliminar del archivo local como fallback
    }
  }

  const data = await loadData();
  if (!Array.isArray(data.actas)) data.actas = [];
  const before = data.actas.length;
  data.actas = data.actas.filter(a => (a && (a.id || '')) !== id);
  if (data.actas.length === before) {
    // nada que borrar, igualmente persistimos si hace falta
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  await removeActaAdjunto(id);
  return true;
});

ipcMain.handle('pick-acta-adjunto', async (_, actaId) => {
  const id = actaId ? String(actaId) : '';
  if (!id) throw new Error('Acta inválida');
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow || null, {
    title: 'Seleccionar adjunto de acta',
    properties: ['openFile'],
    filters: [
      { name: 'Documentos e imágenes', extensions: ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'bmp', 'tif', 'tiff'] },
      { name: 'Todos los archivos', extensions: ['*'] }
    ]
  });
  if (canceled || !filePaths || !filePaths[0]) return { canceled: true };

  const sourcePath = filePaths[0];
  if (!fs.existsSync(sourcePath)) throw new Error('No se encontró el archivo seleccionado.');

  if (supabase) {
    const ext = path.extname(sourcePath || '').toLowerCase() || '';
    const safeExt = ext && ext.length <= 8 ? ext : '';
    const sourceName = path.basename(sourcePath);
    const sourceBuffer = fs.readFileSync(sourcePath);
    const remotePath = id + '/' + Date.now() + safeExt;

    const { data: prevRows } = await supabase
      .from(ACTAS_ATTACHMENTS_TABLE)
      .select('file_path')
      .eq('acta_id', id)
      .limit(1);
    const prevPath = prevRows && prevRows[0] ? prevRows[0].file_path : null;

    const { error: uploadError } = await supabase.storage
      .from(ACTAS_ATTACHMENTS_BUCKET)
      .upload(remotePath, sourceBuffer, {
        upsert: true,
        contentType: 'application/octet-stream'
      });
    if (uploadError) throw new Error(uploadError.message || 'No se pudo subir el adjunto');

    if (prevPath && prevPath !== remotePath) {
      try { await supabase.storage.from(ACTAS_ATTACHMENTS_BUCKET).remove([prevPath]); } catch (_) {}
    }

    const nowIso = new Date().toISOString();
    const { error: upsertError } = await supabase
      .from(ACTAS_ATTACHMENTS_TABLE)
      .upsert({
        acta_id: id,
        file_path: remotePath,
        original_name: sourceName,
        updated_at: nowIso
      }, { onConflict: 'acta_id' });
    if (upsertError) throw new Error(upsertError.message || 'No se pudo guardar el metadato del adjunto');
    return { canceled: false, name: sourceName, updatedAt: nowIso };
  }

  if (!fs.existsSync(ACTAS_ATTACHMENTS_DIR)) fs.mkdirSync(ACTAS_ATTACHMENTS_DIR, { recursive: true });
  const ext = path.extname(sourcePath || '').toLowerCase() || '';
  const safeExt = ext && ext.length <= 8 ? ext : '';
  const storedName = id + '-' + Date.now() + safeExt;
  const targetPath = path.join(ACTAS_ATTACHMENTS_DIR, storedName);
  fs.copyFileSync(sourcePath, targetPath);

  const map = loadActasAdjuntos();
  const prev = map[id];
  if (prev && prev.path && fs.existsSync(prev.path)) {
    try { fs.unlinkSync(prev.path); } catch (_) {}
  }
  map[id] = {
    originalName: path.basename(sourcePath),
    storedName: storedName,
    path: targetPath,
    updatedAt: new Date().toISOString()
  };
  saveActasAdjuntos(map);
  return { canceled: false, name: map[id].originalName, updatedAt: map[id].updatedAt };
});

ipcMain.handle('open-acta-adjunto', async (_, actaId) => {
  const id = actaId ? String(actaId) : '';
  if (!id) throw new Error('Acta inválida');

  if (supabase) {
    const { data: rows, error } = await supabase
      .from(ACTAS_ATTACHMENTS_TABLE)
      .select('file_path, original_name')
      .eq('acta_id', id)
      .limit(1);
    if (error) throw new Error(error.message || 'No se pudo abrir el adjunto');
    if (!rows || !rows[0] || !rows[0].file_path) throw new Error('Esta acta no tiene adjunto.');

    const filePath = rows[0].file_path;
    const originalName = (rows[0].original_name || '').toString().trim();
    const { data: fileData, error: dlError } = await supabase.storage
      .from(ACTAS_ATTACHMENTS_BUCKET)
      .download(filePath);
    if (dlError || !fileData) throw new Error((dlError && dlError.message) || 'No se pudo descargar el adjunto');

    const arr = await fileData.arrayBuffer();
    const outDir = path.join(app.getPath('temp'), ACTAS_ATTACHMENTS_BUCKET);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const safeName = (originalName || path.basename(filePath)).replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
    const outPath = path.join(outDir, id + '-' + safeName);
    fs.writeFileSync(outPath, Buffer.from(arr));
    const openErr = await shell.openPath(outPath);
    if (openErr) throw new Error(openErr);
    return true;
  }

  const map = loadActasAdjuntos();
  const meta = map[id];
  if (!meta || !meta.path || !fs.existsSync(meta.path)) {
    throw new Error('Esta acta no tiene adjunto.');
  }
  const openErr = await shell.openPath(meta.path);
  if (openErr) throw new Error(openErr);
  return true;
});

// IPC: Cambiar contraseña del usuario actual
ipcMain.handle('change-password', async (_, currentPassword, newPassword) => {
  if (!newPassword || newPassword.length < 4) return { ok: false, error: 'La nueva contraseña debe tener al menos 4 caracteres' };

  if (supabase) {
    const session = loadSession();
    if (!session || !session.username) return { ok: false, error: 'No hay sesión' };
    const { data: rows, error: errFetch } = await supabase.from('usuarios').select('password_hash').eq('username', session.username).limit(1);
    if (errFetch || !rows || rows.length === 0) return { ok: false, error: 'Usuario no encontrado' };
    const currentHash = hashPassword(currentPassword || '');
    if (currentHash !== rows[0].password_hash) return { ok: false, error: 'Contraseña actual incorrecta' };
    const { error: errUpdate } = await supabase.from('usuarios').update({ password_hash: hashPassword(newPassword) }).eq('username', session.username);
    if (errUpdate) return { ok: false, error: errUpdate.message || 'Error al actualizar' };
    return { ok: true };
  }

  const auth = loadAuth();
  if (!auth) return { ok: false, error: 'No hay sesión' };
  const currentHash = hashPassword(currentPassword || '');
  if (currentHash !== auth.passwordHash) return { ok: false, error: 'Contraseña actual incorrecta' };
  saveAuth(auth.username, hashPassword(newPassword));
  return { ok: true };
});

// IPC: ADMIN - Listar usuarios
ipcMain.handle('admin-list-usuarios', async () => {
  const session = loadSession();
  if (!session || !session.username || (session.rol || 'usuario') !== 'admin') {
    return { ok: false, error: 'No autorizado' };
  }

  if (!supabase) {
    return { ok: false, error: 'Gestión de usuarios solo disponible con Supabase' };
  }

  try {
    const { data: rows, error } = await supabase
      .from('usuarios')
      .select('username, rol, created_at')
      .order('username', { ascending: true });
    if (error) return { ok: false, error: error.message || 'Error al listar usuarios' };
    return { ok: true, usuarios: rows || [] };
  } catch (err) {
    return { ok: false, error: 'Error al listar usuarios' };
  }
});

// IPC: ADMIN - Resetear contraseña de otro usuario
ipcMain.handle('admin-reset-password', async (_, targetUsername, newPassword) => {
  const user = (targetUsername || '').trim();
  const newPass = (newPassword || '').trim();
  if (!user) return { ok: false, error: 'Usuario objetivo vacío' };
  if (!newPass || newPass.length < 4) return { ok: false, error: 'La nueva contraseña debe tener al menos 4 caracteres' };

  const session = loadSession();
  if (!session || !session.username || (session.rol || 'usuario') !== 'admin') {
    return { ok: false, error: 'No autorizado' };
  }

  if (!supabase) {
    return { ok: false, error: 'Gestión de usuarios solo disponible con Supabase' };
  }

  try {
    const { error } = await supabase
      .from('usuarios')
      .update({ password_hash: hashPassword(newPass) })
      .eq('username', user);
    if (error) return { ok: false, error: error.message || 'Error al actualizar contraseña' };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: 'Error al actualizar contraseña' };
  }
});

// IPC: ADMIN - Renombrar usuario (excepto su propia cuenta)
ipcMain.handle('admin-rename-user', async (_, currentUsername, newUsername) => {
  const currentUser = (currentUsername || '').trim();
  const nextUser = (newUsername || '').trim();
  if (!currentUser) return { ok: false, error: 'Usuario objetivo vacío' };
  if (!nextUser || nextUser.length < 3) return { ok: false, error: 'El nuevo nombre debe tener al menos 3 caracteres' };

  const session = loadSession();
  if (!session || !session.username || (session.rol || 'usuario') !== 'admin') {
    return { ok: false, error: 'No autorizado' };
  }
  if (currentUser === session.username) {
    return { ok: false, error: 'No podés renombrar tu propio usuario desde este panel' };
  }

  if (!supabase) {
    return { ok: false, error: 'Gestión de usuarios solo disponible con Supabase' };
  }

  try {
    const { data: rowsCurrent, error: errCurrent } = await supabase
      .from('usuarios')
      .select('username')
      .eq('username', currentUser)
      .limit(1);
    if (errCurrent) return { ok: false, error: errCurrent.message || 'Error al buscar usuario actual' };
    if (!rowsCurrent || rowsCurrent.length === 0) return { ok: false, error: 'Usuario no encontrado' };

    const { data: rowsExisting, error: errExisting } = await supabase
      .from('usuarios')
      .select('username')
      .eq('username', nextUser)
      .limit(1);
    if (errExisting) return { ok: false, error: errExisting.message || 'Error al validar nuevo nombre' };
    if (rowsExisting && rowsExisting.length > 0) return { ok: false, error: 'Ese nombre de usuario ya existe' };

    const { error: errUpdate } = await supabase
      .from('usuarios')
      .update({ username: nextUser })
      .eq('username', currentUser);
    if (errUpdate) return { ok: false, error: errUpdate.message || 'Error al cambiar nombre de usuario' };

    await logAudit('MODIFICAR', 'Usuarios', 'Renombró usuario: ' + currentUser + ' -> ' + nextUser, currentUser);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: 'Error al cambiar nombre de usuario' };
  }
});

// IPC: ADMIN1 - Autorizar usuario pendiente
ipcMain.handle('admin-authorize-user', async (_, targetUsername) => {
  const user = (targetUsername || '').trim();
  if (!user) return { ok: false, error: 'Usuario objetivo vacío' };

  const session = loadSession();
  if (!session || !session.username || (session.rol || 'usuario') !== 'admin' || session.username !== 'admin1') {
    return { ok: false, error: 'Solo admin1 puede autorizar usuarios' };
  }

  if (!supabase) {
    return { ok: false, error: 'Gestión de usuarios solo disponible con Supabase' };
  }

  try {
    const { data: rows, error: errFetch } = await supabase
      .from('usuarios')
      .select('username, rol')
      .eq('username', user)
      .limit(1);
    if (errFetch) return { ok: false, error: errFetch.message || 'Error al buscar usuario' };
    if (!rows || rows.length === 0) return { ok: false, error: 'Usuario no encontrado' };
    if ((rows[0].rol || '').toString().toLowerCase() !== 'pendiente') {
      return { ok: false, error: 'El usuario no está pendiente de autorización' };
    }

    const { error } = await supabase
      .from('usuarios')
      .update({ rol: 'usuario' })
      .eq('username', user);
    if (error) return { ok: false, error: error.message || 'Error al autorizar usuario' };
    await logAudit('MODIFICAR', 'Usuarios', 'admin1 autorizó usuario: ' + user, user);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: 'Error al autorizar usuario' };
  }
});

// IPC: ADMIN1 - Rechazar usuario pendiente
ipcMain.handle('admin-reject-user', async (_, targetUsername) => {
  const user = (targetUsername || '').trim();
  if (!user) return { ok: false, error: 'Usuario objetivo vacío' };

  const session = loadSession();
  if (!session || !session.username || (session.rol || 'usuario') !== 'admin' || session.username !== 'admin1') {
    return { ok: false, error: 'Solo admin1 puede rechazar usuarios' };
  }

  if (!supabase) {
    return { ok: false, error: 'Gestión de usuarios solo disponible con Supabase' };
  }

  try {
    const { data: rows, error: errFetch } = await supabase
      .from('usuarios')
      .select('username, rol')
      .eq('username', user)
      .limit(1);
    if (errFetch) return { ok: false, error: errFetch.message || 'Error al buscar usuario' };
    if (!rows || rows.length === 0) return { ok: false, error: 'Usuario no encontrado' };
    if ((rows[0].rol || '').toString().toLowerCase() !== 'pendiente') {
      return { ok: false, error: 'Solo se pueden rechazar usuarios pendientes' };
    }

    const { error } = await supabase
      .from('usuarios')
      .delete()
      .eq('username', user);
    if (error) return { ok: false, error: error.message || 'Error al rechazar usuario' };

    await logAudit('ELIMINAR', 'Usuarios', 'admin1 rechazó usuario pendiente: ' + user, user);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: 'Error al rechazar usuario' };
  }
});

// --- Backup / Restore ---
ipcMain.handle('create-backup', async () => {
  try {
    const result = await createBackup(true);
    await logAudit('CREAR', 'Backup', 'Creó backup manual: ' + result.filename);
    return result;
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : 'Error al crear backup' };
  }
});

ipcMain.handle('export-backup-file', async () => {
  try {
    const result = await createBackup(true);
    if (!result.ok) return result;
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Exportar backup completo',
      defaultPath: result.filename,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (canceled || !filePath) return { ok: false, error: 'Cancelado' };
    fs.copyFileSync(result.path, filePath);
    await logAudit('CREAR', 'Backup', 'Exportó backup a: ' + filePath);
    return { ok: true, path: filePath };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : 'Error al exportar backup' };
  }
});

ipcMain.handle('restore-backup', async () => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Restaurar backup',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    });
    if (canceled || !filePaths || !filePaths.length) return { ok: false, error: 'Cancelado' };
    const raw = fs.readFileSync(filePaths[0], 'utf-8');
    const backup = JSON.parse(raw);
    if (!backup || typeof backup !== 'object') throw new Error('Formato de backup inválido');

    await createBackup(false);

    const data = {
      productos: Array.isArray(backup.productos) ? backup.productos : [],
      movimientos: Array.isArray(backup.movimientos) ? backup.movimientos : [],
      dependencias: Array.isArray(backup.dependencias) ? backup.dependencias : [],
      txtDependencias: Array.isArray(backup.txtDependencias) ? backup.txtDependencias : [],
      txtRealizados: Array.isArray(backup.txtRealizados) ? backup.txtRealizados : [],
      guardiaProvisiones: Array.isArray(backup.guardiaProvisiones) ? backup.guardiaProvisiones : [],
      actas: Array.isArray(backup.actas) ? backup.actas : [],
      matafuegos: Array.isArray(backup.matafuegos) ? backup.matafuegos : []
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');

    if (Array.isArray(backup.auditLog)) {
      saveAuditLog(backup.auditLog);
    }

    await logAudit('RESTAURAR', 'Backup', 'Restauró backup desde: ' + path.basename(filePaths[0]));
    return { ok: true, filename: path.basename(filePaths[0]) };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : 'Error al restaurar backup' };
  }
});

ipcMain.handle('list-backups', () => {
  return listBackups();
});

// --- Exportar a Excel (.xlsx) ---
function buildInventarioRows(data) {
  const movs = data.movimientos || [];
  const prods = data.productos || [];
  const provisiones = data.guardiaProvisiones || [];
  const prodById = new Map(prods.map(p => [p.id, p]));
  const entradas = movs.filter(m => m.tipo === 'entrada');
  const salidas = movs.filter(m => m.tipo === 'salida');
  const salidasPorEntrada = {};
  salidas.forEach(s => {
    const eid = s.entradaId || s.entrada;
    if (eid) salidasPorEntrada[eid] = (salidasPorEntrada[eid] || 0) + (parseInt(s.cantidad, 10) || 0);
  });
  const provistosPorMov = {};
  provisiones.forEach(p => {
    if (p.movimiento_id) provistosPorMov[p.movimiento_id] = (provistosPorMov[p.movimiento_id] || 0) + (p.cantidad != null ? p.cantidad : 1);
  });
  return entradas.map(m => {
    const producto = m.productoId ? prodById.get(m.productoId) : null;
    const codigoExp = producto ? ((producto.codigo || '').trim() || 'Sin asignar') : 'Sin asignar';
    const cantidad = parseInt(m.cantidad, 10) || 0;
    const entregado = salidasPorEntrada[m.id] || 0;
    const provisto = provistosPorMov[m.id] || 0;
    const disponible = Math.max(0, cantidad - entregado - provisto);
    const fecha = m.fecha ? new Date(m.fecha).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
    return {
      Expediente: codigoExp,
      'Tipo de elemento': (m.nombre || '').trim() || '-',
      Marca: (m.marca || '').trim() || '-',
      'Nº de serie': (m.numeroSerie || '').trim() || '-',
      Cantidad: cantidad,
      Disponible: disponible,
      Fecha: fecha,
      Concepto: (m.concepto || '').trim() || '-'
    };
  });
}

function buildMovimientosRows(data) {
  const movs = data.movimientos || [];
  const prods = data.productos || [];
  const deps = data.dependencias || [];
  const provisiones = data.guardiaProvisiones || [];
  const prodById = new Map(prods.map(p => [p.id, p]));
  const depById = new Map(deps.map(d => [d.id, d]));
  const movById = new Map(movs.map(m => [m.id, m]));
  const getExpediente = (productoId) => {
    const p = prodById.get(productoId);
    return p ? ((p.codigo || p.id || '').toString().trim() || '—') : '—';
  };
  const getDepLabel = (id) => {
    const d = depById.get(id);
    return d ? (d.codigo || d.nombre || d.numero || '').toString().trim() || '—' : '—';
  };
  const rows = [];
  movs.forEach(m => {
    const prod = m.productoId ? prodById.get(m.productoId) : null;
    const nombreProducto = (m.nombre || m.numeroSerie || (prod && prod.nombre) || '').toString().trim() || '—';
    const tipoLabel = m.tipo === 'entrada' ? 'Entrada' : 'Salida';
    const destino = m.tipo === 'salida' && (m.destino || '').trim() ? (m.destino || '').trim() : '—';
    const fechaMs = m.fecha ? new Date(m.fecha).getTime() : 0;
    rows.push({
      _ts: fechaMs,
      Fecha: m.fecha ? new Date(m.fecha).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '',
      Tipo: tipoLabel,
      Expediente: getExpediente(m.productoId),
      Producto: nombreProducto,
      Destino: destino,
      Cantidad: m.cantidad != null ? m.cantidad : '',
      Concepto: (m.concepto || '').trim() || '—',
      Usuario: (m.usuario || m.user || m.username || '').toString().trim() || '—'
    });
  });
  provisiones.forEach(p => {
    const prod = p.producto_id ? prodById.get(p.producto_id) : null;
    let nombreProducto = (prod && prod.nombre) ? (prod.nombre || '').toString().trim() : '';
    if (p.movimiento_id && movs.length) {
      const mov = movById.get(p.movimiento_id);
      if (mov) nombreProducto = (mov.nombre || mov.numeroSerie || '').toString().trim() || nombreProducto || '—';
    }
    if (!nombreProducto) nombreProducto = '—';
    const fechaMs = p.fecha_asignacion ? new Date(p.fecha_asignacion).getTime() : 0;
    rows.push({
      _ts: fechaMs,
      Fecha: p.fecha_asignacion ? new Date(p.fecha_asignacion).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '',
      Tipo: 'Provisión / Entrega',
      Expediente: getExpediente(p.producto_id),
      Producto: nombreProducto,
      Destino: getDepLabel(p.dependencia_id),
      Cantidad: p.cantidad != null ? p.cantidad : 1,
      Concepto: (p.concepto || '').trim() || '—',
      Usuario: (p.usuario || p.user || p.username || '').toString().trim() || '—'
    });
  });
  rows.sort((a, b) => b._ts - a._ts);
  return rows.map(r => {
    const { _ts, ...rest } = r;
    return rest;
  });
}

function buildDetalleExpedienteRows(data, expedienteId, search) {
  const movs = data.movimientos || [];
  const prods = data.productos || [];
  const provisiones = data.guardiaProvisiones || [];
  const prodById = new Map(prods.map(p => [p.id, p]));

  const entries = movs.filter(m => m.tipo === 'entrada' && m.productoId === expedienteId);
  const provistosPorMov = {};
  provisiones.forEach(p => {
    if (p.movimiento_id) provistosPorMov[p.movimiento_id] = (provistosPorMov[p.movimiento_id] || 0) + (p.cantidad != null ? p.cantidad : 1);
  });

  const exped = prodById.get(expedienteId);
  const codigoExp = exped ? ((exped.codigo || '').trim() || expedienteId) : expedienteId;

  const q = (search || '').toString().trim().toLowerCase();

  const rows = entries.map(m => {
    const recibido = parseInt(m.cantidad, 10) || 0;
    const provisto = provistosPorMov[m.id] || 0;
    const disponible = Math.max(0, recibido - provisto);
    const fecha = m.fecha ? new Date(m.fecha).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

    const producto = prodById.get(m.productoId);
    const nombre = (m.nombre || (producto && producto.nombre) || '').toString().trim() || '-';
    const marca = (m.marca || (producto && producto.marca) || '').toString().trim() || '-';
    const descripcion = (m.concepto || '').toString().trim() || '-';
    const numeroSerie = (m.numeroSerie || '').toString().trim() || '-';

    return {
      Expediente: codigoExp,
      Cantidad: recibido,
      Disponible: disponible,
      Nombre: nombre,
      Marca: marca,
      Descripción: descripcion,
      'Nº de serie': numeroSerie,
      Fecha: fecha
    };
  });

  rows.sort((a, b) => {
    const da = a.Fecha && a.Fecha !== '-' ? new Date(a.Fecha).getTime() : 0;
    const db = b.Fecha && b.Fecha !== '-' ? new Date(b.Fecha).getTime() : 0;
    return db - da;
  });

  if (!q) return rows;

  // Mismo criterio "simple" que el filtro del modal: busca en campos concatenados.
  return rows.filter(r => {
    const texto = [
      r.Nombre,
      r.Marca,
      r.Descripción,
      r['Nº de serie'],
      r.Fecha
    ].map(x => (x == null ? '' : String(x))).join(' ').toLowerCase();
    return texto.indexOf(q) >= 0;
  });
}

/**
 * Export TXT "nuevo": una línea por registro, 164 caracteres: campos fijos + descripción (46)
 * + marca fija "1" en columna 164. Los máximos de digitación en UI están en TXT_NUEVO_FIELD_MAX (txt.js).
 * Editá solo esta tabla cuando tengas la grilla definitiva.
 * Comentarios "cols a-b" = posición 1-based en el TXT resultante (layout actual).
 */
const TXT_NUEVO_EXPORT_SPEC = [
  { key: 'reparticion', width: 3, pad: 'R', empty: '', note: 'cols 1-3' },
  { key: 'reparticionDesc', width: 25, pad: 'R', empty: '', note: 'cols 4-28 (dependencia arranca col 29)' },
  { key: 'dependencia', width: 4, pad: 'L0', empty: '0', note: 'cols 29-32' },
  { key: 'dependenciaDesc', width: 25, pad: 'R', empty: '', note: 'cols 33-57 (habitacion arranca col 58)' },
  { key: 'habitacion', width: 4, pad: 'L0', empty: '0', note: 'cols 58-61' },
  { key: 'habitacionDesc', width: 25, pad: 'R', empty: '', note: 'cols 62-86 (cuenta arranca col 87)' },
  { key: 'cuenta', width: 3, pad: 'R', empty: '0', note: 'cols 87-89' },
  { key: 'especie', width: 4, pad: 'L0', empty: '0', note: 'cols 90-93' },
  { key: 'motivo', width: 2, pad: 'L0', empty: '0', note: 'cols 94-95' },
  { key: 'estado', width: 1, pad: 'R', empty: '0', note: 'col 96' },
  { key: 'cantidad', width: 3, pad: 'L0', empty: '0', note: 'cols 97-99' },
  { key: 'orden', width: 4, pad: 'L0', empty: '0', note: 'cols 100-103' },
  { key: 'valor', width: 10, pad: 'L0', empty: '0', isValor: true, note: 'cols 104-113: 3 dígitos n÷10^7 (L0) + 7 dígitos n%10^7 (ceros a la derecha)' },
  { key: 'mes', width: 2, pad: 'L0', empty: '0', note: 'cols 114-115' },
  { key: 'anio', width: 2, pad: 'R', empty: '0', note: 'cols 116-117' },
  { key: 'descripcion', width: 46, pad: 'R', empty: '', note: 'cols 118-163 (espacios a la derecha si falta texto)' },
  { key: '_col164', width: 1, pad: 'CONST', value: '1', note: 'col 164, siempre 1' }
];

function padTxtNuevoR(str, len) {
  var s = String(str == null ? '' : str);
  while (s.length < len) s += ' ';
  return s.slice(0, len);
}

function padTxtNuevoL0(str, len) {
  var s = String(str == null ? '' : str);
  while (s.length < len) s = '0' + s;
  return s.slice(-len);
}

/** Relleno numérico a la derecha con ceros (alineado a la izquierda del valor). */
function padTxtNuevoR0(str, len) {
  var s = String(str == null ? '' : str).replace(/\D/g, '');
  if (!s) s = '0';
  while (s.length < len) s += '0';
  return s.slice(0, len);
}

/**
 * Valor en 10 dígitos como el sistema de referencia TXT:
 * 3 dígitos = parte entera de (n / 10^7) con ceros a la izquierda;
 * 7 dígitos = (n % 10^7) con ceros a la derecha (ej. 22926 → 2292600).
 * Así el bloque final no queda 0022926… sino 2292600…
 */
function formatValorTxtNuevo10Referencia(valorRaw) {
  var d = String(valorRaw == null ? '' : valorRaw).replace(/\./g, '').replace(/,/g, '').replace(/\D/g, '');
  if (!d) d = '0';
  var n = parseInt(d, 10);
  if (!isFinite(n) || n < 0) n = 0;
  if (n > 9999999999) n = 9999999999;
  var high = Math.floor(n / 10000000);
  var low = n % 10000000;
  return padTxtNuevoL0(String(high), 3) + padTxtNuevoR0(String(low), 7);
}

/** Exporta una fila por registro en grilla (cantidad = valor del bien en cada fila). */
function expandTxtRegistrosPorCantidad(registros) {
  return Array.isArray(registros) ? registros.slice() : [];
}

function buildTxtNuevoExportLine(r) {
  var parts = [];
  for (var i = 0; i < TXT_NUEVO_EXPORT_SPEC.length; i++) {
    var s = TXT_NUEVO_EXPORT_SPEC[i];
    if (s.pad === 'CONST') {
      parts.push(String(s.value != null ? s.value : '1'));
      continue;
    }
    if (s.isValor) {
      parts.push(formatValorTxtNuevo10Referencia((r && r.valor) != null ? r.valor : '0'));
      continue;
    }
    raw = r && r[s.key] != null && r[s.key] !== '' ? r[s.key] : (s.empty != null ? s.empty : '');
    if (s.pad === 'R') parts.push(padTxtNuevoR(raw, s.width));
    else if (s.pad === 'L0') parts.push(padTxtNuevoL0(raw, s.width));
  }
  return parts.join('');
}

ipcMain.handle('export-txt-nuevo', async (_, registros, nombreDefault) => {
  try {
    if (!Array.isArray(registros) || !registros.length) return { ok: false, error: 'No hay registros para exportar' };

    var registrosExpandidos = expandTxtRegistrosPorCantidad(registros);
    var lines = registrosExpandidos.map(function (r) {
      return buildTxtNuevoExportLine(r);
    });

    var content = lines.join('\r\n');
    var defaultName = (nombreDefault || 'txt-export') + '.txt';

    const win = BrowserWindow.getFocusedWindow();
    const { filePath, canceled } = await dialog.showSaveDialog(win || null, {
      title: 'Exportar TXT',
      defaultPath: defaultName,
      filters: [{ name: 'Bloc de notas', extensions: ['txt'] }, { name: 'Todos', extensions: ['*'] }]
    });
    if (canceled || !filePath) return { ok: false, cancelled: true };
    fs.writeFileSync(filePath, content, 'utf-8');
    return { ok: true, path: filePath };
  } catch (err) {
    console.error('export-txt-nuevo', err);
    return { ok: false, error: err.message || 'Error al exportar' };
  }
});

function escapeHtmlForWord(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatValorWord(value) {
  var raw = String(value == null ? '' : value).trim();
  if (!raw) return '';
  var normalized = raw.replace(/\./g, '').replace(/,/g, '.');
  var n = Number(normalized);
  if (!isNaN(n)) {
    return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return raw;
}

function formatMesWord(value) {
  var raw = String(value == null ? '' : value).trim();
  if (!raw) return '';
  var n = parseInt(raw, 10);
  if (isNaN(n)) return raw;
  return String(n);
}

var TXT_WORD_MAX_ROWS_PER_PAGE = 17;

function chunkTxtWordRows(rows, pageSize) {
  var size = pageSize > 0 ? pageSize : 17;
  var chunks = [];
  for (var i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size));
  }
  return chunks.length ? chunks : [[]];
}

function buildTxtWordRowHtml(r) {
  var td0 = ' style="border:none;border-top:none;border-left:none;border-right:none;border-bottom:none;mso-border-top-alt:none;mso-border-left-alt:none;mso-border-right-alt:none;mso-border-bottom-alt:none;"';
  return '<tr>' +
    '<td class="c"' + td0 + '>' + escapeHtmlForWord(r.cuenta || '') + '</td>' +
    '<td class="c"' + td0 + '>' + escapeHtmlForWord(r.especie || '') + '</td>' +
    '<td class="c"' + td0 + '>' + escapeHtmlForWord(r.motivo || '') + '</td>' +
    '<td class="c"' + td0 + '>' + escapeHtmlForWord(r.estado || '') + '</td>' +
    '<td class="c"' + td0 + '>' + escapeHtmlForWord(r.cantidad || '') + '</td>' +
    '<td class="c"' + td0 + '>' + escapeHtmlForWord(r.orden || '') + '</td>' +
    '<td class="r"' + td0 + '>' + escapeHtmlForWord(formatValorWord(r.valor || '')) + '</td>' +
    '<td class="c"' + td0 + '>' + escapeHtmlForWord(formatMesWord(r.mes || '')) + '</td>' +
    '<td class="c"' + td0 + '>' + escapeHtmlForWord(r.anio || '') + '</td>' +
    '<td' + td0 + '>' + escapeHtmlForWord(r.descripcion || '') + '</td>' +
    '<td class="c"' + td0 + '>1</td>' +
    '</tr>';
}

function buildTxtWordPageHeaderHtml(fecha, pageNum, totalPages) {
  return '<table class="header-tbl"><tr>\n' +
    '<td class="header-left">\n' +
    '  <p style="font-weight:bold;">Contadur\u00EDa General de la Provincia</p>\n' +
    '  <p style="font-weight:bold;margin-left:24px;">Departamento Patrimonial</p>\n' +
    '</td>\n' +
    '<td class="header-center">INVENTARIO DE BIENES</td>\n' +
    '<td class="header-right">\n' +
    '  <table class="header-right-inner"><tr><td class="header-right-fecha">Fecha de Impresi\u00F3n: &nbsp;&nbsp;&nbsp;' + escapeHtmlForWord(fecha) + '</td><td class="header-right-pagina">P\u00E1gina ' + escapeHtmlForWord(String(pageNum)) + ' de ' + escapeHtmlForWord(String(totalPages)) + '</td></tr></table>\n' +
    '</td>\n' +
    '</tr></table>\n' +
    '<p style="margin:0;padding:0;font-size:10pt;line-height:12pt;mso-line-height-rule:exactly;height:12pt;">&nbsp;</p>\n';
}

function buildTxtWordMetaHtml(first) {
  return '<table class="meta-tbl" cellspacing="0" cellpadding="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">\n' +
    '<tr style="mso-yfti-irow:0;mso-yfti-firstrow:yes;height:0;">' +
    '<td class="ml" style="padding:0;line-height:10pt;mso-line-height-rule:exactly;">Reparticion:</td>' +
    '<td class="mn" style="padding:0;line-height:10pt;mso-line-height-rule:exactly;">' + escapeHtmlForWord(first.reparticion || '') + '</td>' +
    '<td class="md" style="padding:0;line-height:10pt;mso-line-height-rule:exactly;">' + escapeHtmlForWord(first.reparticionDesc || '') + '</td></tr>\n' +
    '<tr style="mso-yfti-irow:1;height:0;">' +
    '<td class="ml" style="padding:0;line-height:10pt;mso-line-height-rule:exactly;">Dependencia:</td>' +
    '<td class="mn" style="padding:0;line-height:10pt;mso-line-height-rule:exactly;">' + escapeHtmlForWord(first.dependencia || '') + '</td>' +
    '<td class="md" style="padding:0;line-height:10pt;mso-line-height-rule:exactly;">' + escapeHtmlForWord(first.dependenciaDesc || '') + '</td></tr>\n' +
    '<tr style="mso-yfti-irow:2;height:0;">' +
    '<td class="ml" style="padding:0;line-height:10pt;mso-line-height-rule:exactly;">Habitacion:</td>' +
    '<td class="mn" style="padding:0;line-height:10pt;mso-line-height-rule:exactly;">' + escapeHtmlForWord(first.habitacion || '') + '</td>' +
    '<td class="md" style="padding:0;line-height:10pt;mso-line-height-rule:exactly;">' + escapeHtmlForWord(first.habitacionDesc || '') + '</td></tr>\n' +
    '<tr style="mso-yfti-irow:3;mso-yfti-lastrow:yes;height:0;">' +
    '<td class="ml" style="padding:0;line-height:10pt;mso-line-height-rule:exactly;">Motivo:</td>' +
    '<td class="mn" style="padding:0;line-height:10pt;mso-line-height-rule:exactly;">' + escapeHtmlForWord(first.motivo || '') + '</td>' +
    '<td class="md" style="padding:0;line-height:10pt;mso-line-height-rule:exactly;"></td></tr>\n' +
    '</table>\n' +
    '<p style="margin:0;padding:0;font-size:10pt;line-height:12pt;mso-line-height-rule:exactly;height:12pt;">&nbsp;</p>\n';
}

function buildTxtWordTableHeadHtml() {
  return '<table class="data-tbl" border="0" cellspacing="0" cellpadding="0">\n' +
    '<thead>\n' +
    '<tr>' +
    '<th style="width:6%;">Cuenta</th>' +
    '<th style="width:7%;">Especie</th>' +
    '<th style="width:6%;">Motivo</th>' +
    '<th style="width:6%;">Estado</th>' +
    '<th style="width:7%;">Cantidad</th>' +
    '<th style="width:6%;">Orden</th>' +
    '<th style="width:10%;">Valor</th>' +
    '<th style="width:4%;">Mes</th>' +
    '<th style="width:4%;">A\u00F1o</th>' +
    '<th style="width:40%;">Bien</th>' +
    '<th style="width:4%;">NR</th>' +
    '</tr>\n' +
    '</thead>\n' +
    '<tbody>\n';
}

ipcMain.handle('export-txt-nuevo-word', async (_, registros, nombreDefault) => {
  try {
    if (!Array.isArray(registros) || !registros.length) {
      return { ok: false, error: 'No hay registros para exportar' };
    }

    var defaultName = (nombreDefault || 'txt-modelo') + '.doc';
    var win = BrowserWindow.getFocusedWindow();
    var saveRes = await dialog.showSaveDialog(win || null, {
      title: 'Exportar Word',
      defaultPath: defaultName,
      filters: [{ name: 'Word', extensions: ['doc'] }, { name: 'Todos', extensions: ['*'] }]
    });
    if (saveRes.canceled || !saveRes.filePath) return { ok: false, cancelled: true };

    var registrosExpandidos = expandTxtRegistrosPorCantidad(registros);

    var totalCantidadHab = 0;
    registrosExpandidos.forEach(function (r) {
      var cantidadNum = parseInt(String(r.cantidad == null ? '' : r.cantidad).replace(/[^\d-]/g, ''), 10);
      if (!isNaN(cantidadNum)) totalCantidadHab += cantidadNum;
    });

    var now = new Date();
    var dd = String(now.getDate()).padStart(2, '0');
    var mm = String(now.getMonth() + 1).padStart(2, '0');
    var yyyy = now.getFullYear();
    var fecha = dd + '/' + mm + '/' + yyyy;

    var pageChunks = chunkTxtWordRows(registrosExpandidos, TXT_WORD_MAX_ROWS_PER_PAGE);
    var totalPages = pageChunks.length;
    var first = registros[0] || {};
    var pagesHtml = pageChunks.map(function (pageRows, pageIdx) {
      var pageNum = pageIdx + 1;
      var rowsHtml = pageRows.map(function (r) {
        return buildTxtWordRowHtml(r);
      }).join('\n');
      var pageBreak = pageIdx > 0
        ? '<div class="txt-word-page-break" style="page-break-before:always;mso-break-type:section-break;"><br clear="all" style="page-break-before:always;mso-break-type:section-break;"></div>\n'
        : '';
      var footerHtml = pageNum === totalPages
        ? '<p class="tot">Cant. de bienes de la hab.: &nbsp;&nbsp;&nbsp;&nbsp;' + escapeHtmlForWord(String(totalCantidadHab)) + '</p>\n'
        : '';
      return pageBreak +
        buildTxtWordPageHeaderHtml(fecha, pageNum, totalPages) +
        buildTxtWordMetaHtml(first) +
        buildTxtWordTableHeadHtml() +
        rowsHtml + '\n</tbody>\n</table>\n' +
        footerHtml;
    }).join('\n');

    var html =
      '<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
      'xmlns:w="urn:schemas-microsoft-com:office:word" ' +
      'xmlns="http://www.w3.org/TR/REC-html40">\n' +
      '<head>\n' +
      '<meta charset="utf-8">\n' +
      '<!--[if gte mso 9]><xml><w:WordDocument>' +
      '<w:View>Print</w:View>' +
      '<w:Zoom>100</w:Zoom>' +
      '<w:DoNotOptimizeForBrowser/>' +
      '</w:WordDocument></xml><![endif]-->\n' +
      '<style>\n' +
      '@page Section1 {\n' +
      '  size: 297mm 210mm;\n' +
      '  mso-page-orientation: landscape;\n' +
      '  margin: 15mm 18mm 15mm 18mm;\n' +
      '}\n' +
      'div.Section1 { page: Section1; }\n' +
      'body { font-family: Arial, sans-serif; font-size: 10pt; color: #000; }\n' +
      'p { margin: 0; padding: 0; }\n' +
      '.header-tbl { width: 100%; border-collapse: collapse; }\n' +
      '.header-tbl td { border: none; padding: 0; vertical-align: top; font-size: 10pt; }\n' +
      '.header-left { text-align: left; width: 30%; }\n' +
      '.header-center { text-align: center; width: 30%; font-size: 12pt; font-weight: bold; }\n' +
      '.header-right { text-align: right; width: 40%; }\n' +
      '.header-right-inner { width: 100%; border-collapse: collapse; }\n' +
      '.header-right-inner td { border: none; padding: 0; font-size: 10pt; }\n' +
      '.header-right-fecha { width: 70%; text-align: center; }\n' +
      '.header-right-pagina { width: 30%; text-align: right; }\n' +
      '.meta-tbl { border-collapse: collapse; border-spacing: 0; margin: 0; }\n' +
      '.meta-tbl tr { height: auto; mso-height-source: auto; }\n' +
      '.meta-tbl td { border: none; padding: 0 !important; margin: 0; font-size: 10pt; font-weight: bold; vertical-align: top; line-height: 10pt; mso-line-height-rule: exactly; mso-padding-alt: 0cm 0cm 0cm 0cm; }\n' +
      '.ml { width: 95pt; white-space: nowrap; }\n' +
      '.mn { width: 35pt; white-space: nowrap; }\n' +
      '.md { padding-left: 18pt !important; white-space: nowrap; }\n' +
      '.data-tbl { width: 100%; border-collapse: collapse; margin-top: 0; border: none; }\n' +
      '.data-tbl thead th { border: 1px solid #000; padding: 2px 4px; font-size: 9pt; font-weight: bold; text-align: center; vertical-align: middle; }\n' +
      '.data-tbl tbody td { border: none !important; padding: 2px 4px; font-size: 9pt; vertical-align: middle; }\n' +
      '.c { text-align: center; }\n' +
      '.r { text-align: right; }\n' +
      '.tot { margin-top: 8px; font-size: 10pt; font-weight: bold; }\n' +
      '.txt-word-page-break { page-break-before: always; }\n' +
      '</style>\n' +
      '</head>\n' +
      '<body>\n' +
      '<div class="Section1">\n' +
      pagesHtml + '\n' +
      '</div>\n' +
      '</body>\n' +
      '</html>';

    fs.writeFileSync(saveRes.filePath, html, 'utf8');
    return { ok: true, path: saveRes.filePath };
  } catch (err) {
    console.error('export-txt-nuevo-word', err);
    return { ok: false, error: err.message || 'Error al exportar Word' };
  }
});

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const CODE39_PATTERNS = {
  '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn',
  '4': 'nnnwwnnnw', '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw',
  '8': 'wnnwnnwnn', '9': 'nnwwnnwnn', 'A': 'wnnnnwnnw', 'B': 'nnwnnwnnw',
  'C': 'wnwnnwnnn', 'D': 'nnnnwwnnw', 'E': 'wnnnwwnnn', 'F': 'nnwnwwnnn',
  'G': 'nnnnnwwnw', 'H': 'wnnnnwwnn', 'I': 'nnwnnwwnn', 'J': 'nnnnwwwnn',
  'K': 'wnnnnnnww', 'L': 'nnwnnnnww', 'M': 'wnwnnnnwn', 'N': 'nnnnwnnww',
  'O': 'wnnnwnnwn', 'P': 'nnwnwnnwn', 'Q': 'nnnnnnwww', 'R': 'wnnnnnwwn',
  'S': 'nnwnnnwwn', 'T': 'nnnnwnwwn', 'U': 'wwnnnnnnw', 'V': 'nwwnnnnnw',
  'W': 'wwwnnnnnn', 'X': 'nwnnwnnnw', 'Y': 'wwnnwnnnn', 'Z': 'nwwnwnnnn',
  '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn', '$': 'nwnwnwnnn',
  '/': 'nwnwnnnwn', '+': 'nwnnnwnwn', '%': 'nnnwnwnwn', '*': 'nwnnwnwnn'
};

function normalizeBarcodeValue(input) {
  const normalized = String(input || '').toUpperCase().replace(/[^A-Z0-9\-\.\$\/\+\% ]/g, '-').trim();
  return normalized || 'SIN-SERIE';
}

function buildCode39Svg(value) {
  const text = '*' + normalizeBarcodeValue(value) + '*';
  const narrow = 2;
  const wide = 5;
  const height = 62;
  let x = 0;
  const bars = [];

  for (let c = 0; c < text.length; c++) {
    const ch = text[c];
    const pattern = CODE39_PATTERNS[ch] || CODE39_PATTERNS['-'];
    for (let i = 0; i < pattern.length; i++) {
      const w = pattern[i] === 'w' ? wide : narrow;
      const isBar = i % 2 === 0;
      if (isBar) {
        bars.push('<rect x="' + x + '" y="0" width="' + w + '" height="' + height + '" fill="#000"/>');
      }
      x += w;
    }
    x += narrow;
  }

  const width = x + narrow;
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '">' + bars.join('') + '</svg>';
}

function buildEtiquetasHtml(etiquetas) {
  const items = (Array.isArray(etiquetas) ? etiquetas : []).map(function (item) {
    const numeroSerie = normalizeBarcodeValue(item && item.numeroSerie ? item.numeroSerie : '');
    const nombre = item && item.nombre ? String(item.nombre).trim() : '';
    const marca = item && item.marca ? String(item.marca).trim() : '';
    const expediente = item && item.expediente ? String(item.expediente).trim() : '';
    const barcode = buildCode39Svg(numeroSerie);
    const meta = [nombre, marca, expediente ? ('Exp: ' + expediente) : ''].filter(Boolean).join(' | ');
    return '<section class="etiqueta">' +
      '<div class="serie">' + escapeHtml(numeroSerie) + '</div>' +
      '<div class="barcode">' + barcode + '</div>' +
      '<div class="meta">' + escapeHtml(meta || ' ') + '</div>' +
      '</section>';
  }).join('');

  return '<!doctype html><html><head><meta charset="utf-8">' +
    '<style>' +
    '@page { size: 58mm 32mm; margin: 2mm; }' +
    'html,body{margin:0;padding:0;font-family:Arial,sans-serif;color:#111;}' +
    '.etiqueta{width:54mm;height:28mm;box-sizing:border-box;border:1px solid #111;padding:1.5mm 2mm;page-break-after:always;display:flex;flex-direction:column;justify-content:space-between;}' +
    '.etiqueta:last-child{page-break-after:auto;}' +
    '.serie{font-size:12px;font-weight:700;line-height:1.1;text-align:center;letter-spacing:.5px;}' +
    '.barcode{display:flex;justify-content:center;align-items:center;min-height:14mm;}' +
    '.barcode svg{width:100%;height:13mm;}' +
    '.meta{font-size:8px;line-height:1.15;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
    '</style></head><body>' + items + '</body></html>';
}

ipcMain.handle('print-etiquetas', async (_, etiquetas) => {
  try {
    if (!Array.isArray(etiquetas) || etiquetas.length === 0) {
      return { ok: false, error: 'No hay etiquetas para imprimir.' };
    }
    const html = buildEtiquetasHtml(etiquetas);
    const printWindow = new BrowserWindow({
      show: false,
      width: 420,
      height: 280,
      webPreferences: { sandbox: true }
    });
    await printWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    return await new Promise((resolve) => {
      printWindow.webContents.print({ silent: false, printBackground: true }, (success, errorType) => {
        try { if (!printWindow.isDestroyed()) printWindow.close(); } catch (_) {}
        if (success) resolve({ ok: true });
        else resolve({ ok: false, error: errorType || 'No se pudo imprimir.' });
      });
    });
  } catch (err) {
    console.error('print-etiquetas', err);
    return { ok: false, error: err.message || 'Error al imprimir etiquetas' };
  }
});

// ── Depósito: inventario aparte (tabla deposito_movimientos) ──
function rowToDepositoMovimiento(row) {
  if (!row) return null;
  return {
    id: row.id,
    tipo: row.tipo,
    expediente: row.expediente || 'DEPOSITO',
    cantidad: row.cantidad,
    fecha: row.fecha,
    numeroSerie: row.numero_serie ?? undefined,
    nombre: row.nombre ?? undefined,
    marca: row.marca ?? undefined,
    concepto: row.concepto ?? undefined,
    entradaId: row.entrada_id ?? undefined,
    usuario: row.usuario ?? undefined
  };
}

function depositoMovimientoToRow(m) {
  return {
    id: m.id,
    tipo: m.tipo,
    expediente: (m.expediente || 'DEPOSITO').toString().trim() || 'DEPOSITO',
    cantidad: m.cantidad,
    fecha: m.fecha,
    numero_serie: m.numeroSerie || null,
    nombre: m.nombre || null,
    marca: m.marca || null,
    concepto: m.concepto || null,
    entrada_id: m.entradaId || null,
    usuario: m.usuario || null
  };
}

function loadDepositoDataFromLocalFile() {
  try {
    if (fs.existsSync(DEPOSITO_DATA_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DEPOSITO_DATA_FILE, 'utf-8'));
      return { movimientos: Array.isArray(parsed.movimientos) ? parsed.movimientos : [] };
    }
  } catch (_) { /* ignore */ }
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return { movimientos: Array.isArray(parsed.depositoMovimientos) ? parsed.depositoMovimientos : [] };
  } catch (_) {
    return { movimientos: [] };
  }
}

function saveDepositoDataToLocalFile(movimientos) {
  const list = Array.isArray(movimientos) ? movimientos : [];
  fs.writeFileSync(DEPOSITO_DATA_FILE, JSON.stringify({ movimientos: list }, null, 2), 'utf-8');
}

async function depositoTableExists() {
  if (!supabase) return false;
  const { error } = await supabase.from('deposito_movimientos').select('id').limit(1);
  if (!error) return true;
  if (error.code === 'PGRST205' || /deposito_movimientos/i.test(error.message || '')) return false;
  throw error;
}

async function loadDepositoData() {
  if (!supabase) return loadDepositoDataFromLocalFile();
  let tableOk = false;
  try {
    tableOk = await depositoTableExists();
  } catch (e) {
    console.warn('[Deposito] depositoTableExists:', e && e.message);
    return loadDepositoDataFromLocalFile();
  }
  if (!tableOk) return loadDepositoDataFromLocalFile();
  try {
    const raw = await fetchAllRows('deposito_movimientos', 'fecha', false);
    return { movimientos: raw.map(rowToDepositoMovimiento) };
  } catch (e) {
    console.warn('[Deposito] loadDepositoData:', e && e.message);
    return loadDepositoDataFromLocalFile();
  }
}

async function saveDepositoMovimientosLocal(movimientos) {
  saveDepositoDataToLocalFile(movimientos);
}

async function upsertDepositoMovimiento(movimiento) {
  const row = depositoMovimientoToRow(movimiento);
  if (supabase) {
    let tableOk = false;
    try {
      tableOk = await depositoTableExists();
    } catch (_) { tableOk = false; }
    if (tableOk) {
      let { error } = await supabase.from('deposito_movimientos').upsert(row, { onConflict: 'id' });
      if (error && /usuario/i.test(error.message || '')) {
        const row2 = Object.assign({}, row);
        delete row2.usuario;
        ({ error } = await supabase.from('deposito_movimientos').upsert(row2, { onConflict: 'id' }));
      }
      if (error) throw new Error(error.message);
      return;
    }
  }
  const depData = await loadDepositoData();
  const list = depData.movimientos || [];
  const idx = list.findIndex(m => m.id === movimiento.id);
  const toSave = {
    id: movimiento.id,
    tipo: movimiento.tipo,
    expediente: movimiento.expediente,
    cantidad: movimiento.cantidad,
    fecha: movimiento.fecha,
    numeroSerie: movimiento.numeroSerie,
    nombre: movimiento.nombre,
    marca: movimiento.marca,
    concepto: movimiento.concepto,
    entradaId: movimiento.entradaId,
    usuario: movimiento.usuario
  };
  if (idx >= 0) list[idx] = toSave;
  else list.push(toSave);
  await saveDepositoMovimientosLocal(list);
}

/** Migra todo el expediente DEPOSITO al inventario de depósito y lo elimina del módulo de expedientes. */
async function migrarExpedienteDepositoAInventario(codigoExpediente) {
  const codigo = (codigoExpediente || 'DEPOSITO').toString().trim().toUpperCase();
  const data = await loadData();
  const exp = (data.productos || []).find(p =>
    ((p.codigo || '').toString().trim().toUpperCase() === codigo) ||
    ((p.nombre || '').toString().trim().toUpperCase() === codigo)
  );
  if (!exp) throw new Error('No se encontró el expediente «' + codigo + '».');

  const movsExp = (data.movimientos || []).filter(m => m.productoId === exp.id);
  if (!movsExp.length) {
    if (supabase) {
      try { await supabase.from('guardia_provision').delete().eq('producto_id', exp.id); } catch (_) {}
      const { error } = await supabase.from('productos').delete().eq('id', exp.id);
      if (error) throw new Error(error.message);
    } else {
      const local = await loadData();
      local.productos = (local.productos || []).filter(p => p.id !== exp.id);
      fs.writeFileSync(DATA_FILE, JSON.stringify(local, null, 2), 'utf-8');
    }
    await logAudit('ELIMINAR', 'Expedientes', 'Eliminó expediente vacío ' + codigo + ' tras migración', exp.id);
    return { ok: true, migrados: 0, expedienteId: exp.id, codigo: codigo };
  }

  const depData = await loadDepositoData();
  const existentes = depData.movimientos || [];
  const seriesEnDeposito = {};
  existentes.forEach(m => {
    if (m.tipo === 'entrada') {
      const s = String(m.numeroSerie || '').trim();
      if (s) seriesEnDeposito[s] = true;
    }
  });

  const idMap = {};
  const nuevos = [];
  const entradas = movsExp.filter(m => m.tipo === 'entrada');
  const salidas = movsExp.filter(m => m.tipo === 'salida');

  entradas.forEach(m => {
    const serie = String(m.numeroSerie || '').trim();
    if (serie && seriesEnDeposito[serie]) return;
    const newId = 'dep-mig-' + m.id;
    idMap[m.id] = newId;
    nuevos.push({
      id: newId,
      tipo: 'entrada',
      expediente: codigo,
      cantidad: m.cantidad,
      fecha: m.fecha || new Date().toISOString(),
      numeroSerie: m.numeroSerie,
      nombre: m.nombre,
      marca: m.marca,
      concepto: m.concepto,
      usuario: m.usuario
    });
    if (serie) seriesEnDeposito[serie] = true;
  });

  salidas.forEach(m => {
    const entradaOrig = m.entradaId || m.entrada;
    const newEntradaId = entradaOrig ? idMap[entradaOrig] : null;
    if (!newEntradaId && entradaOrig) return;
    nuevos.push({
      id: 'dep-mig-' + m.id,
      tipo: 'salida',
      expediente: codigo,
      cantidad: m.cantidad,
      fecha: m.fecha || new Date().toISOString(),
      numeroSerie: m.numeroSerie,
      nombre: m.nombre,
      marca: m.marca,
      concepto: m.concepto,
      entradaId: newEntradaId,
      usuario: m.usuario
    });
  });

  for (const mov of nuevos) {
    await upsertDepositoMovimiento(mov);
  }

  if (supabase) {
    try { await supabase.from('guardia_provision').delete().eq('producto_id', exp.id); } catch (_) {}
    await supabase.from('movimientos').delete().eq('producto_id', exp.id);
    const { error } = await supabase.from('productos').delete().eq('id', exp.id);
    if (error) throw new Error(error.message);
  } else {
    const local = await loadData();
    local.movimientos = (local.movimientos || []).filter(m => m.productoId !== exp.id);
    local.productos = (local.productos || []).filter(p => p.id !== exp.id);
    if (Array.isArray(local.guardiaProvisiones)) {
      local.guardiaProvisiones = local.guardiaProvisiones.filter(p =>
        p.producto_id !== exp.id && !movsExp.some(m => m.id === p.movimiento_id)
      );
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(local, null, 2), 'utf-8');
  }

  await logAudit('MODIFICAR', 'Deposito', 'Migró expediente ' + codigo + ' al inventario de depósito (' + nuevos.length + ' registros)', exp.id);
  broadcastDataChanged('deposito_movimientos', 'MIGRATE');
  broadcastDataChanged('productos', 'DELETE');
  broadcastDataChanged('movimientos', 'DELETE');
  return { ok: true, migrados: nuevos.length, expedienteId: exp.id, codigo: codigo };
}

function buildDepositoInventarioRows(depData) {
  const movimientos = Array.isArray(depData.movimientos) ? depData.movimientos : [];
  const entradas = movimientos.filter(m => m && m.tipo === 'entrada');
  const salidas = movimientos.filter(m => m && m.tipo === 'salida');
  const salidasPorEntrada = {};
  salidas.forEach(s => {
    const eid = s.entradaId;
    if (eid) salidasPorEntrada[eid] = (salidasPorEntrada[eid] || 0) + (parseInt(s.cantidad, 10) || 0);
  });
  return entradas.map(m => {
    const cantidad = parseInt(m.cantidad, 10) || 0;
    const entregado = salidasPorEntrada[m.id] || 0;
    const disponible = Math.max(0, cantidad - entregado);
    let fechaStr = '';
    try {
      if (m.fecha) fechaStr = new Date(m.fecha).toLocaleString('es-AR');
    } catch (_) {}
    return {
      Expediente: m.expediente || 'DEPOSITO',
      'Tipo de elemento': m.nombre || '',
      Marca: m.marca || '',
      'Nº de serie': m.numeroSerie || '',
      Cantidad: cantidad,
      Disponible: disponible === 0 ? 'AGOTADO' : disponible,
      Fecha: fechaStr,
      Concepto: m.concepto || ''
    };
  });
}

ipcMain.handle('get-deposito-data', async () => loadDepositoData());

ipcMain.handle('registrar-deposito-movimiento', async (_, movimiento) => {
  const session = loadSession();
  const usuarioSession = session && session.username ? session.username : null;
  if (usuarioSession && !movimiento.usuario) movimiento.usuario = usuarioSession;

  const cantidad = parseInt(movimiento.cantidad, 10);
  if (isNaN(cantidad) || cantidad <= 0) return { ok: false, error: 'Cantidad inválida' };
  if (!movimiento.id) movimiento.id = Date.now().toString() + '-dep';
  movimiento.fecha = movimiento.fecha || new Date().toISOString();
  movimiento.tipo = movimiento.tipo || 'entrada';
  movimiento.expediente = (movimiento.expediente || 'DEPOSITO').toString().trim() || 'DEPOSITO';

  const numeroSerieNorm = String(movimiento.numeroSerie || '').trim();
  if (movimiento.tipo === 'entrada' && numeroSerieNorm) {
    const depData = await loadDepositoData();
    const duplicado = (depData.movimientos || []).some(m =>
      m.tipo === 'entrada' && String(m.numeroSerie || '').trim() === numeroSerieNorm && m.id !== movimiento.id
    );
    if (duplicado) return { ok: false, error: 'Ya existe una entrada en depósito con ese número de serie.' };
  }

  try {
    await upsertDepositoMovimiento(movimiento);
  } catch (err) {
    return { ok: false, error: err.message || 'Error al guardar' };
  }
  await logAudit('CREAR', 'Deposito', 'Registró ' + movimiento.tipo + ' depósito, cant: ' + cantidad, movimiento.id);
  return { ok: true };
});

ipcMain.handle('update-deposito-movimiento', async (_, movimientoId, updates) => {
  ensureAdminSession('Solo un administrador puede editar el inventario de depósito.');
  const depData = await loadDepositoData();
  const mov = (depData.movimientos || []).find(m => m.id === movimientoId);
  if (!mov) return { ok: false, error: 'Registro no encontrado' };
  if (mov.tipo !== 'entrada') return { ok: false, error: 'Solo se pueden editar entradas' };

  const oldCantidad = parseInt(mov.cantidad, 10) || 0;
  const newCantidad = updates.cantidad != null ? parseInt(updates.cantidad, 10) : oldCantidad;
  if (isNaN(newCantidad) || newCantidad <= 0) return { ok: false, error: 'Cantidad inválida' };

  if (updates.expediente !== undefined) mov.expediente = (updates.expediente || 'DEPOSITO').toString().trim() || 'DEPOSITO';
  if (updates.numeroSerie !== undefined) mov.numeroSerie = updates.numeroSerie;
  if (updates.nombre !== undefined) mov.nombre = updates.nombre;
  if (updates.marca !== undefined) mov.marca = updates.marca;
  if (updates.cantidad !== undefined) mov.cantidad = String(updates.cantidad);
  if (updates.concepto !== undefined) mov.concepto = updates.concepto;
  if (updates.fecha !== undefined) mov.fecha = updates.fecha;

  try {
    await upsertDepositoMovimiento(mov);
  } catch (err) {
    return { ok: false, error: err.message || 'Error al guardar' };
  }
  await logAudit('MODIFICAR', 'Deposito', 'Editó entrada depósito ' + movimientoId, movimientoId);
  return { ok: true };
});

ipcMain.handle('delete-deposito-movimiento', async (_, id) => {
  ensureAdminSession('Solo un administrador puede eliminar del inventario de depósito.');
  const rid = id != null ? String(id) : '';
  if (!rid) return { ok: false, error: 'ID inválido' };

  let tableOk = false;
  if (supabase) {
    try { tableOk = await depositoTableExists(); } catch (_) { tableOk = false; }
  }
  if (supabase && tableOk) {
    await supabase.from('deposito_movimientos').delete().eq('entrada_id', rid);
    const { error } = await supabase.from('deposito_movimientos').delete().eq('id', rid);
    if (error) return { ok: false, error: error.message };
  } else {
    const depData = await loadDepositoData();
    const list = (depData.movimientos || []).filter(m => m.id !== rid && m.entradaId !== rid);
    await saveDepositoMovimientosLocal(list);
  }
  await logAudit('ELIMINAR', 'Deposito', 'Eliminó registro depósito ' + rid, rid);
  return { ok: true };
});

ipcMain.handle('migrar-expediente-deposito', async (_, codigoExpediente) => {
  try {
    return await migrarExpedienteDepositoAInventario(codigoExpediente);
  } catch (err) {
    return { ok: false, error: err.message || 'Error en la migración' };
  }
});

ipcMain.handle('export-deposito-inventario', async () => {
  try {
    const depData = await loadDepositoData();
    const rows = buildDepositoInventarioRows(depData);
    const sheet = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, 'Deposito');
    const win = BrowserWindow.getFocusedWindow();
    const { filePath, canceled } = await dialog.showSaveDialog(win || null, {
      title: 'Guardar inventario de depósito',
      defaultPath: 'inventario-deposito.xlsx',
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    });
    if (canceled || !filePath) return { ok: false, cancelled: true };
    XLSX.writeFile(wb, filePath);
    return { ok: true, path: filePath };
  } catch (err) {
    console.error('export-deposito-inventario', err);
    return { ok: false, error: err.message || 'Error al exportar' };
  }
});

ipcMain.handle('export-inventario', async () => {
  try {
    const data = await loadData();
    const rows = buildInventarioRows(data);
    const sheet = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, 'Inventario');
    const win = BrowserWindow.getFocusedWindow();
    const { filePath, canceled } = await dialog.showSaveDialog(win || null, {
      title: 'Guardar inventario',
      defaultPath: 'inventario.xlsx',
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    });
    if (canceled || !filePath) return { ok: false, cancelled: true };
    XLSX.writeFile(wb, filePath);
    return { ok: true, path: filePath };
  } catch (err) {
    console.error('export-inventario', err);
    return { ok: false, error: err.message || 'Error al exportar' };
  }
});

ipcMain.handle('export-movimientos', async () => {
  try {
    const data = await loadData();
    const rows = buildMovimientosRows(data);
    const sheet = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, 'Movimientos');
    const win = BrowserWindow.getFocusedWindow();
    const { filePath, canceled } = await dialog.showSaveDialog(win || null, {
      title: 'Guardar historial de movimientos',
      defaultPath: 'movimientos.xlsx',
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    });
    if (canceled || !filePath) return { ok: false, cancelled: true };
    XLSX.writeFile(wb, filePath);
    return { ok: true, path: filePath };
  } catch (err) {
    console.error('export-movimientos', err);
    return { ok: false, error: err.message || 'Error al exportar' };
  }
});

ipcMain.handle('export-matafuegos-excel', async (_, payload) => {
  try {
    const rows = payload && Array.isArray(payload.rows) ? payload.rows : [];
    const sheetName = (payload && payload.sheetName) ? String(payload.sheetName).slice(0, 31) : 'Matafuegos';
    const defaultPath = (payload && payload.defaultPath) ? String(payload.defaultPath) : 'matafuegos.xlsx';
    if (!rows.length) return { ok: false, error: 'No hay filas para exportar' };
    const sheet = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, sheetName.replace(/[\\/*?:\[\]]/g, '_') || 'Matafuegos');
    const win = BrowserWindow.getFocusedWindow();
    const { filePath, canceled } = await dialog.showSaveDialog(win || null, {
      title: 'Exportar matafuegos',
      defaultPath: defaultPath,
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    });
    if (canceled || !filePath) return { ok: false, cancelled: true };
    XLSX.writeFile(wb, filePath);
    return { ok: true, path: filePath };
  } catch (err) {
    console.error('export-matafuegos-excel', err);
    return { ok: false, error: err.message || 'Error al exportar' };
  }
});

ipcMain.handle('export-expediente-detalle', async (_, expedienteId, search) => {
  try {
    const expId = (expedienteId || '').toString().trim();
    if (!expId) return { ok: false, error: 'Expediente inválido' };
    const data = await loadData();
    const rows = buildDetalleExpedienteRows(data, expId, search);
    const sheet = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, 'Detalle del expediente');
    const win = BrowserWindow.getFocusedWindow();

    // Nombre de archivo: expediente.xlsx (o el codigo si existe)
    const exped = (data.productos || []).find(p => p.id === expId);
    const codigo = exped && (exped.codigo || '').toString().trim();
    const defaultName = codigo ? `expediente-${codigo}.xlsx` : 'expediente-detalle.xlsx';

    const { filePath, canceled } = await dialog.showSaveDialog(win || null, {
      title: 'Exportar detalle del expediente',
      defaultPath: defaultName,
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    });
    if (canceled || !filePath) return { ok: false, cancelled: true };
    XLSX.writeFile(wb, filePath);
    return { ok: true, path: filePath };
  } catch (err) {
    console.error('export-expediente-detalle', err);
    return { ok: false, error: err.message || 'Error al exportar' };
  }
});
