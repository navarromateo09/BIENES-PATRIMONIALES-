const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const publicDir = path.join(root, 'renderer', 'public');
const legacyDir = path.join(publicDir, 'legacy');

const copyFiles = [
  'styles.css',
  'realtime-sync.js',
  'loading.js',
  'paginacion.js',
  'deposito.js',
  'productos.js',
  'expedientes.js',
  'guardia.js',
  'txt.js',
  'dependencias.js',
  'actas.js',
  'matafuegos.js',
  'logo-fallback.js',
  'deposito.html',
  'productos.html',
  'expedientes.html',
  'guardia.html',
  'txt.html',
  'dependencias.html',
  'actas.html',
  'matafuegos.html'
];

const copyAssets = [
  'emblemalogin.png',
  'logo.png',
  'logoacta.png',
  'accesoicono.png',
  'icon-deposito.png',
  'fondo-escudo.png',
  'logito.jpeg',
  'placa tuc.png'
];

if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
if (!fs.existsSync(legacyDir)) fs.mkdirSync(legacyDir, { recursive: true });

copyFiles.forEach((name) => {
  const src = path.join(root, name);
  const destRoot = (name.endsWith('.css') || name === 'realtime-sync.js')
    ? path.join(publicDir, name)
    : path.join(legacyDir, name);
  if (!fs.existsSync(src)) {
    console.warn('[sync-legacy] omitido (no existe):', name);
    return;
  }
  fs.copyFileSync(src, destRoot);
  console.log('[sync-legacy]', name);
});

copyAssets.forEach((name) => {
  const src = path.join(root, name);
  const dest = path.join(publicDir, name);
  if (!fs.existsSync(src)) {
    console.warn('[sync-legacy] asset omitido:', name);
    return;
  }
  fs.copyFileSync(src, dest);
  console.log('[sync-legacy] asset', name);
});

console.log('Legacy sync OK');
