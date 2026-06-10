#!/usr/bin/env node
/**
 * Migra el expediente DEPOSITO (productos + movimientos) al inventario de depósito
 * y elimina el expediente del módulo principal.
 *
 * Uso: node scripts/migrar-expediente-deposito.js [CODIGO_EXPEDIENTE]
 * Por defecto CODIGO_EXPEDIENTE = DEPOSITO
 */
'use strict';

const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const CODIGO = (process.argv[2] || 'DEPOSITO').trim().toUpperCase();
const USER_DATA = path.join(process.env.APPDATA || '', 'control-stock-empresa');
const DEPOSITO_DATA_FILE = path.join(USER_DATA, 'deposito-data.json');

let config;
try {
  config = require(path.join(__dirname, '..', 'supabase-config.js'));
} catch (e) {
  console.error('Falta supabase-config.js');
  process.exit(1);
}

const supabase = createClient(config.url, config.anonKey);

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

async function depositoTableExists() {
  const { error } = await supabase.from('deposito_movimientos').select('id').limit(1);
  if (!error) return true;
  if (error.code === 'PGRST205') return false;
  throw error;
}

function loadDepositoLocal() {
  try {
    if (fs.existsSync(DEPOSITO_DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DEPOSITO_DATA_FILE, 'utf-8')).movimientos || [];
    }
  } catch (_) {}
  return [];
}

function saveDepositoLocal(movimientos) {
  if (!fs.existsSync(USER_DATA)) fs.mkdirSync(USER_DATA, { recursive: true });
  fs.writeFileSync(DEPOSITO_DATA_FILE, JSON.stringify({ movimientos }, null, 2), 'utf-8');
}

async function loadDepositoMovimientos() {
  if (await depositoTableExists()) {
    const { data, error } = await supabase.from('deposito_movimientos').select('*').order('fecha', { ascending: false });
    if (error) throw error;
    return (data || []).map(rowToDepositoMovimiento);
  }
  return loadDepositoLocal();
}

async function upsertDeposito(mov) {
  if (await depositoTableExists()) {
    let { error } = await supabase.from('deposito_movimientos').upsert(depositoMovimientoToRow(mov), { onConflict: 'id' });
    if (error && /usuario/i.test(error.message || '')) {
      const row2 = Object.assign({}, depositoMovimientoToRow(mov));
      delete row2.usuario;
      ({ error } = await supabase.from('deposito_movimientos').upsert(row2, { onConflict: 'id' }));
    }
    if (error) throw error;
    return;
  }
  const list = await loadDepositoMovimientos();
  const idx = list.findIndex(m => m.id === mov.id);
  if (idx >= 0) list[idx] = mov;
  else list.push(mov);
  saveDepositoLocal(list);
}

async function fetchAllMovimientos(productoId) {
  const all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from('movimientos').select('*').eq('producto_id', productoId).range(from, from + 999);
    if (error) throw error;
    if (!data || !data.length) break;
    all.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return all;
}

async function main() {
  console.log('Migrando expediente', CODIGO, '→ inventario de depósito…');

  const tableOk = await depositoTableExists();
  if (!tableOk) {
    console.warn('AVISO: La tabla deposito_movimientos no existe en Supabase.');
    console.warn('Los datos se guardarán en:', DEPOSITO_DATA_FILE);
    console.warn('Ejecutá supabase-deposito-inventario.sql en el SQL Editor de Supabase para sincronizar en la nube.');
  }

  const { data: productos, error: errP } = await supabase.from('productos').select('id,codigo,nombre');
  if (errP) throw errP;
  const exp = (productos || []).find(p =>
    ((p.codigo || '').toString().trim().toUpperCase() === CODIGO) ||
    ((p.nombre || '').toString().trim().toUpperCase() === CODIGO)
  );
  if (!exp) {
    console.error('No se encontró expediente', CODIGO);
    process.exit(1);
  }

  const rawMovs = await fetchAllMovimientos(exp.id);
  console.log('Movimientos en expediente:', rawMovs.length);

  const existentes = await loadDepositoMovimientos();
  const seriesEnDeposito = {};
  existentes.forEach(m => {
    if (m.tipo === 'entrada') {
      const s = String(m.numeroSerie || '').trim();
      if (s) seriesEnDeposito[s] = true;
    }
  });

  const idMap = {};
  const nuevos = [];
  const entradas = rawMovs.filter(m => m.tipo === 'entrada');
  const salidas = rawMovs.filter(m => m.tipo === 'salida');

  entradas.forEach(m => {
    const serie = String(m.numero_serie || '').trim();
    if (serie && seriesEnDeposito[serie]) {
      console.log('  Omitido (ya en depósito):', serie);
      return;
    }
    const newId = 'dep-mig-' + m.id;
    idMap[m.id] = newId;
    nuevos.push({
      id: newId,
      tipo: 'entrada',
      expediente: CODIGO,
      cantidad: m.cantidad,
      fecha: m.fecha,
      numeroSerie: m.numero_serie,
      nombre: m.nombre,
      marca: m.marca,
      concepto: m.concepto,
      usuario: m.usuario
    });
    if (serie) seriesEnDeposito[serie] = true;
  });

  salidas.forEach(m => {
    const newEntradaId = idMap[m.entrada_id];
    if (m.entrada_id && !newEntradaId) return;
    nuevos.push({
      id: 'dep-mig-' + m.id,
      tipo: 'salida',
      expediente: CODIGO,
      cantidad: m.cantidad,
      fecha: m.fecha,
      numeroSerie: m.numero_serie,
      nombre: m.nombre,
      marca: m.marca,
      concepto: m.concepto,
      entradaId: newEntradaId || null,
      usuario: m.usuario
    });
  });

  for (const mov of nuevos) {
    await upsertDeposito(mov);
    console.log('  +', mov.tipo, mov.nombre, mov.numeroSerie || '');
  }

  try {
    await supabase.from('guardia_provision').delete().eq('producto_id', exp.id);
  } catch (_) {}
  await supabase.from('movimientos').delete().eq('producto_id', exp.id);
  const { error: errDel } = await supabase.from('productos').delete().eq('id', exp.id);
  if (errDel) throw errDel;

  console.log('\nListo:', nuevos.length, 'registros migrados. Expediente', CODIGO, 'eliminado.');
}

main().catch(err => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
