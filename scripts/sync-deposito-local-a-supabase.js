#!/usr/bin/env node
/**
 * Sube a Supabase los movimientos guardados en deposito-data.json
 * (útil después de ejecutar supabase-deposito-inventario.sql).
 */
'use strict';

const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const DEPOSITO_DATA_FILE = path.join(process.env.APPDATA || '', 'control-stock-empresa', 'deposito-data.json');
const config = require(path.join(__dirname, '..', 'supabase-config.js'));
const supabase = createClient(config.url, config.anonKey);

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

async function main() {
  const { error: probe } = await supabase.from('deposito_movimientos').select('id').limit(1);
  if (probe && probe.code === 'PGRST205') {
    console.error('La tabla deposito_movimientos no existe. Ejecutá supabase-deposito-inventario.sql primero.');
    process.exit(1);
  }
  if (probe) throw probe;

  if (!fs.existsSync(DEPOSITO_DATA_FILE)) {
    console.log('No hay archivo local', DEPOSITO_DATA_FILE);
    return;
  }
  const movimientos = JSON.parse(fs.readFileSync(DEPOSITO_DATA_FILE, 'utf-8')).movimientos || [];
  if (!movimientos.length) {
    console.log('Nada que sincronizar.');
    return;
  }

  const rows = movimientos.map(depositoMovimientoToRow);
  const { error } = await supabase.from('deposito_movimientos').upsert(rows, { onConflict: 'id' });
  if (error) throw error;
  console.log('Sincronizados', rows.length, 'registros a Supabase.');
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
