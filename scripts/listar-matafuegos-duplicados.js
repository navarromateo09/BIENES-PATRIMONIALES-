#!/usr/bin/env node
/**
 * Lista matafuegos con el mismo Nº de serie (duplicados en base de datos).
 * Uso: node scripts/listar-matafuegos-duplicados.js
 * Salida: consola + scripts/reporte-matafuegos-duplicados.txt
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const REPORT_FILE = path.join(__dirname, 'reporte-matafuegos-duplicados.txt');
const LOCAL_DATA = path.join(process.env.APPDATA || '', 'control-stock-empresa', 'stock-data.json');

function serieKey(serie) {
  const alnum = String(serie || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
  if (!alnum) return '';
  if (/^\d+$/.test(alnum)) return alnum.replace(/^0+/, '') || '0';
  return alnum;
}

function estadoLabel(estado, dependenciaId) {
  const s = String(estado || 'disponible').trim().toLowerCase();
  if (s === 'disponible' && dependenciaId) return 'entregado';
  if (s === 'para_recarga' || s === 'recarga') return 'recarga';
  if (s === 'entregados' || s === 'entregado') return 'entregado';
  if (s === 'inservible' || s === 'inservibles') return 'inservible';
  return s || 'disponible';
}

function formatFecha(v) {
  if (!v) return '—';
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return parseInt(m[3], 10) + '/' + parseInt(m[2], 10) + '/' + m[1];
  return String(v).slice(0, 10);
}

async function fetchAllMatafuegos(supabase) {
  const pageSize = 1000;
  let from = 0;
  const all = [];
  for (;;) {
    const { data, error } = await supabase
      .from('matafuegos')
      .select('id, marca, numero_serie, caracteristicas, fecha_vencimiento, estado, fecha_ingreso, dependencia_id, created_at')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || !data.length) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

function loadLocalMatafuegos() {
  if (!fs.existsSync(LOCAL_DATA)) return null;
  const parsed = JSON.parse(fs.readFileSync(LOCAL_DATA, 'utf-8'));
  return (parsed.matafuegos || []).map(function (m) {
    return {
      id: m.id,
      marca: m.marca,
      numero_serie: m.numeroSerie || m.numero_serie || '',
      caracteristicas: m.caracteristicas,
      fecha_vencimiento: m.fechaVencimiento || m.fecha_vencimiento,
      estado: m.estado,
      fecha_ingreso: m.fechaIngreso || m.fecha_ingreso,
      dependencia_id: m.dependenciaId || m.dependencia_id,
      created_at: m.createdAt || m.created_at || null
    };
  });
}

function analyze(rows) {
  const bySerie = {};
  const sinSerie = [];

  rows.forEach(function (r) {
    const serie = String(r.numero_serie || '').trim();
    const key = serieKey(serie);
    if (!key) {
      sinSerie.push(r);
      return;
    }
    if (!bySerie[key]) bySerie[key] = { serieMostrada: serie, items: [] };
    bySerie[key].items.push(r);
  });

  const gruposDup = Object.keys(bySerie)
    .filter(function (k) { return bySerie[k].items.length > 1; })
    .map(function (k) {
      const g = bySerie[k];
      const items = g.items.slice().sort(function (a, b) {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        if (ta !== tb) return ta - tb;
        return String(a.id).localeCompare(String(b.id));
      });
      return { key: k, serie: g.serieMostrada, items: items, keep: items[0], eliminar: items.slice(1) };
    })
    .sort(function (a, b) { return a.serie.localeCompare(b.serie, 'es', { numeric: true }); });

  const totalEliminar = gruposDup.reduce(function (n, g) { return n + g.eliminar.length; }, 0);

  return { total: rows.length, sinSerie: sinSerie.length, gruposDup: gruposDup, totalEliminar: totalEliminar };
}

function lineaItem(r, tag) {
  const est = estadoLabel(r.estado, r.dependencia_id);
  return [
    '    ' + (tag || ' '),
    'id=' + r.id,
    'serie=' + (r.numero_serie || '—'),
    'marca=' + (r.marca || '—'),
    'estado=' + est,
    'ingreso=' + formatFecha(r.fecha_ingreso),
    'venc=' + formatFecha(r.fecha_vencimiento),
    r.dependencia_id ? 'dep=' + r.dependencia_id : ''
  ].filter(Boolean).join(' | ');
}

function buildReport(result, source) {
  const lines = [];
  lines.push('REPORTE DE MATAFUEGOS DUPLICADOS (mismo Nº de serie)');
  lines.push('Fuente: ' + source);
  lines.push('Generado: ' + new Date().toLocaleString('es-AR'));
  lines.push('');
  lines.push('Total matafuegos en base: ' + result.total);
  lines.push('Sin número de serie: ' + result.sinSerie);
  lines.push('Series con duplicados: ' + result.gruposDup.length);
  lines.push('Registros a eliminar (copias extra): ' + result.totalEliminar);
  lines.push('');
  lines.push('— Mantener el primero de cada grupo (más antiguo por created_at/id); eliminar el resto desde la app (admin) o Supabase.');
  lines.push('');

  if (!result.gruposDup.length) {
    lines.push('No hay duplicados por número de serie.');
    return lines.join('\n');
  }

  result.gruposDup.forEach(function (g, idx) {
    lines.push('--- Grupo ' + (idx + 1) + ': Nº ' + g.serie + ' (' + g.items.length + ' registros) ---');
    lines.push(lineaItem(g.keep, '[MANTENER]'));
    g.eliminar.forEach(function (r) {
      lines.push(lineaItem(r, '[ELIMINAR]'));
    });
    lines.push('');
  });

  lines.push('=== RESUMEN IDs A ELIMINAR (copiar) ===');
  const ids = [];
  result.gruposDup.forEach(function (g) {
    g.eliminar.forEach(function (r) { ids.push(r.id); });
  });
  lines.push(ids.join('\n'));

  return lines.join('\n');
}

async function main() {
  let rows = [];
  let source = 'Supabase';

  try {
    const config = require(path.join(__dirname, '..', 'supabase-config.js'));
    const supabase = createClient(config.url, config.anonKey);
    rows = await fetchAllMatafuegos(supabase);
  } catch (e) {
    console.warn('Supabase no disponible:', e.message || e);
    const local = loadLocalMatafuegos();
    if (!local) throw new Error('No se pudo leer Supabase ni ' + LOCAL_DATA);
    rows = local;
    source = 'Archivo local ' + LOCAL_DATA;
  }

  const result = analyze(rows);
  const report = buildReport(result, source);

  fs.writeFileSync(REPORT_FILE, report, 'utf-8');
  console.log(report);
  console.log('\nReporte guardado en:', REPORT_FILE);
}

main().catch(function (e) {
  console.error('Error:', e.message || e);
  process.exit(1);
});
