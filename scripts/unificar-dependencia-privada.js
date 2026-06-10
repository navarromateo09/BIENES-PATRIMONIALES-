#!/usr/bin/env node
/**
 * Unifica dep-00555 y dep-5555 en una sola dependencia "PRIVADA".
 * Uso: node scripts/unificar-dependencia-privada.js
 */
'use strict';

const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const KEEP_ID = 'dep-00555';
const MERGE_IDS = ['dep-5555'];

const config = require(path.join(__dirname, '..', 'supabase-config.js'));
const supabase = createClient(config.url, config.anonKey);

const REF_TABLES = [
  { table: 'matafuegos', col: 'dependencia_id' },
  { table: 'guardia_provision', col: 'dependencia_id' },
  { table: 'actas', col: 'dependencia_id' }
];

async function main() {
  console.log('Unificando dependencias PRIVADA →', KEEP_ID);

  for (const mergeId of MERGE_IDS) {
    for (const ref of REF_TABLES) {
      const { data, error } = await supabase
        .from(ref.table)
        .update({ [ref.col]: KEEP_ID })
        .eq(ref.col, mergeId)
        .select('id');
      if (error && !/column|does not exist/i.test(error.message || '')) {
        throw new Error(ref.table + ': ' + error.message);
      }
      if (data && data.length) {
        console.log('  ' + ref.table + ':', data.length, 'registro(s) de', mergeId, '→', KEEP_ID);
      }
    }

    await supabase.from('dependencias').delete().eq('parent_id', mergeId);
    const { error: delErr } = await supabase.from('dependencias').delete().eq('id', mergeId);
    if (delErr) throw delErr;
    console.log('  Eliminada dependencia', mergeId);
  }

  const { error: updErr } = await supabase
    .from('dependencias')
    .update({ nombre: 'PRIVADA', codigo: '' })
    .eq('id', KEEP_ID);
  if (updErr) throw updErr;
  console.log('  Actualizada', KEEP_ID, '→ nombre "PRIVADA" (sin código en pantalla)');

  const { data: mf } = await supabase
    .from('matafuegos')
    .select('id,numero_serie,dependencia_id')
    .eq('dependencia_id', KEEP_ID);
  console.log('\nMatafuegos en PRIVADA:', (mf || []).length);
  (mf || []).forEach(function (m) {
    console.log('  -', m.numero_serie, '(' + m.id + ')');
  });

  const { data: dup } = await supabase
    .from('dependencias')
    .select('id,codigo,nombre')
    .eq('nombre', 'PRIVADA')
    .is('parent_id', null);
  console.log('\nDependencias raíz llamadas PRIVADA:', dup);
  console.log('\nListo.');
}

main().catch(function (e) {
  console.error('Error:', e.message || e);
  process.exit(1);
});
