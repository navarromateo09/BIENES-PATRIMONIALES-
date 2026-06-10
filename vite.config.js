const path = require('path');
const { defineConfig } = require('vite');
const react = require('@vitejs/plugin-react');

const rootDir = __dirname;
const legacyScripts = [
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
  'loading.js',
  'session-idle.js',
  'realtime-sync.js',
  'sidebar-active.js',
  'sidebar-roles.js',
  'sidebar-version.js'
];

module.exports = defineConfig({
  root: path.join(rootDir, 'renderer'),
  base: './',
  plugins: [react()],
  build: {
    outDir: path.join(rootDir, 'renderer', 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: path.join(rootDir, 'renderer', 'index.html')
    }
  },
  server: {
    port: 5173,
    strictPort: true
  },
  publicDir: path.join(rootDir, 'renderer', 'public'),
  resolve: {
    alias: {
      '@': path.join(rootDir, 'renderer', 'src')
    }
  },
  define: {
    __LEGACY_SCRIPTS__: JSON.stringify(legacyScripts)
  }
});
