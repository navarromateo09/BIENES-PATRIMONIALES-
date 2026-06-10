const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('stockAPI', {
  getDataBackend: () => ipcRenderer.invoke('get-data-backend'),
  getData: () => ipcRenderer.invoke('get-data'),
  getMatafuegosData: () => ipcRenderer.invoke('get-matafuegos-data'),
  getProductosData: () => ipcRenderer.invoke('get-productos-data'),
  getGuardiaData: () => ipcRenderer.invoke('get-guardia-data'),
  getDashboardData: () => ipcRenderer.invoke('get-dashboard-data'),
  getDependenciasStatsData: () => ipcRenderer.invoke('get-dependencias-stats-data'),
  focusWindow: () => ipcRenderer.invoke('focus-window'),
  saveProducto: (producto) => ipcRenderer.invoke('save-producto', producto),
  deleteProducto: (id) => ipcRenderer.invoke('delete-producto', id),
  deleteExpedienteCascade: (id) => ipcRenderer.invoke('delete-expediente-cascade', id),
  registrarMovimiento: async (movimiento) => {
    // Asegurar que el backend guarde el "usuario" del login en cada movimiento.
    const auth = await ipcRenderer.invoke('get-auth-status');
    const username = auth && auth.username ? auth.username : null;
    const mov = Object.assign({}, movimiento || {});
    if (username && !mov.usuario) mov.usuario = username;
    return ipcRenderer.invoke('registrar-movimiento', mov);
  },
  updateMovimiento: (movimientoId, updates) => ipcRenderer.invoke('update-movimiento', movimientoId, updates),
  deleteMovimiento: (id) => ipcRenderer.invoke('delete-movimiento', id),
  asignarEntradaAExpediente: (movimientoId, nuevoProductoId) => ipcRenderer.invoke('asignar-entrada-a-expediente', movimientoId, nuevoProductoId),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getAuthStatus: () => ipcRenderer.invoke('get-auth-status'),
  logout: () => ipcRenderer.invoke('logout'),
  sessionActivity: () => ipcRenderer.invoke('session-activity'),
  onSessionExpired: (callback) => {
    const handler = () => {
      if (typeof callback === 'function') callback();
    };
    ipcRenderer.on('session-expired', handler);
    return () => { ipcRenderer.removeListener('session-expired', handler); };
  },
  login: (username, password) => ipcRenderer.invoke('login', username, password),
  createAccount: (username, password) => ipcRenderer.invoke('create-account', username, password),
  getDependencias: () => ipcRenderer.invoke('get-dependencias'),
  // TXT: tabla exclusiva (no se mezcla con dependencias)
  getTxtDependencias: () => ipcRenderer.invoke('get-txt-dependencias'),
  normalizeDependenciasNombres: () => ipcRenderer.invoke('normalize-dependencias-nombres'),
  saveDependencia: (d) => ipcRenderer.invoke('save-dependencia', d),
  importDependencias: (dependencias) => ipcRenderer.invoke('import-dependencias', dependencias),
  deleteDependencia: (id) => ipcRenderer.invoke('delete-dependencia', id),
  saveTxtDependencia: (d) => ipcRenderer.invoke('save-txt-dependencia', d),
  importTxtDependencias: (dependencias) => ipcRenderer.invoke('import-txt-dependencias', dependencias),
  getTxtRealizados: () => ipcRenderer.invoke('get-txt-realizados'),
  saveTxtRealizado: (r) => ipcRenderer.invoke('save-txt-realizado', r),
  deleteTxtRealizado: (id) => ipcRenderer.invoke('delete-txt-realizado', id),
  getTxtOrdenCount: (id) => ipcRenderer.invoke('get-txt-orden-count', id),
  getTxtOrdenInfo: (id) => ipcRenderer.invoke('get-txt-orden-info', id),
  saveTxtOrdenCount: (id, count) => ipcRenderer.invoke('save-txt-orden-count', id, count),
  changePassword: (currentPassword, newPassword) => ipcRenderer.invoke('change-password', currentPassword, newPassword),
  getGuardiaProvisiones: () => ipcRenderer.invoke('get-guardia-provisiones'),
  saveGuardiaProvision: async (p) => {
    // Asegurar que el backend guarde "usuario" para el historial (Provisión/Entrega).
    const auth = await ipcRenderer.invoke('get-auth-status');
    const username = auth && auth.username ? auth.username : null;
    const prov = Object.assign({}, p || {});
    if (username && !prov.usuario) prov.usuario = username;
    return ipcRenderer.invoke('save-guardia-provision', prov);
  },
  deleteGuardiaProvision: (id) => ipcRenderer.invoke('delete-guardia-provision', id),
  saveActa: (acta) => ipcRenderer.invoke('save-acta', acta),
  deleteActa: (id) => ipcRenderer.invoke('delete-acta', id),
  pickActaAdjunto: (actaId) => ipcRenderer.invoke('pick-acta-adjunto', actaId),
  openActaAdjunto: (actaId) => ipcRenderer.invoke('open-acta-adjunto', actaId),
  saveMatafuego: (m) => ipcRenderer.invoke('save-matafuego', m),
  deleteMatafuego: (id) => ipcRenderer.invoke('delete-matafuego', id),
  syncExpiredMatafuegos: () => ipcRenderer.invoke('sync-expired-matafuegos'),
  setMatafuegoRecargando: (id, recargando) => ipcRenderer.invoke('set-matafuego-recargando', { id: id, recargando: !!recargando }),
  getMatafuegosRecargandoMap: () => ipcRenderer.invoke('get-matafuegos-recargando-map'),
  getAssetUrl: (filename) => ipcRenderer.invoke('get-asset-url', filename),
  adminListUsuarios: () => ipcRenderer.invoke('admin-list-usuarios'),
  adminResetPassword: (username, newPassword) => ipcRenderer.invoke('admin-reset-password', username, newPassword),
  adminRenameUser: (currentUsername, newUsername) => ipcRenderer.invoke('admin-rename-user', currentUsername, newUsername),
  adminAuthorizeUser: (username) => ipcRenderer.invoke('admin-authorize-user', username),
  adminRejectUser: (username) => ipcRenderer.invoke('admin-reject-user', username),
  exportTxtNuevo: (registros, nombreDefault) => ipcRenderer.invoke('export-txt-nuevo', registros, nombreDefault),
  exportTxtNuevoWord: (registros, nombreDefault) => ipcRenderer.invoke('export-txt-nuevo-word', registros, nombreDefault),
  getDepositoData: () => ipcRenderer.invoke('get-deposito-data'),
  migrarExpedienteDeposito: (codigo) => ipcRenderer.invoke('migrar-expediente-deposito', codigo),
  registrarDepositoMovimiento: async (movimiento) => {
    const auth = await ipcRenderer.invoke('get-auth-status');
    const username = auth && auth.username ? auth.username : null;
    const mov = Object.assign({}, movimiento || {});
    if (username && !mov.usuario) mov.usuario = username;
    return ipcRenderer.invoke('registrar-deposito-movimiento', mov);
  },
  updateDepositoMovimiento: (movimientoId, updates) => ipcRenderer.invoke('update-deposito-movimiento', movimientoId, updates),
  deleteDepositoMovimiento: (id) => ipcRenderer.invoke('delete-deposito-movimiento', id),
  exportDepositoInventario: () => ipcRenderer.invoke('export-deposito-inventario'),
  exportInventario: () => ipcRenderer.invoke('export-inventario'),
  exportMatafuegosExcel: (payload) => ipcRenderer.invoke('export-matafuegos-excel', payload),
  exportMovimientos: () => ipcRenderer.invoke('export-movimientos'),
  exportExpedienteDetalle: (expedienteId, search) => ipcRenderer.invoke('export-expediente-detalle', expedienteId, search),
  printEtiquetas: (etiquetas) => ipcRenderer.invoke('print-etiquetas', etiquetas),
  getAuditLog: (filtros) => ipcRenderer.invoke('get-audit-log', filtros || {}),
  createBackup: () => ipcRenderer.invoke('create-backup'),
  exportBackupFile: () => ipcRenderer.invoke('export-backup-file'),
  restoreBackup: () => ipcRenderer.invoke('restore-backup'),
  listBackups: () => ipcRenderer.invoke('list-backups'),

  // Realtime: escuchar cambios en datos desde otra sesión
  onDataChanged: (callback) => {
    const handler = (_event, payload) => {
      if (typeof callback === 'function') callback(payload);
    };
    ipcRenderer.on('data-changed', handler);
    return () => { ipcRenderer.removeListener('data-changed', handler); };
  },

  // Updates (auto-actualización)
  getLastUpdateStatus: () => ipcRenderer.invoke('updates-get-last-status'),
  checkForUpdates: () => ipcRenderer.invoke('updates-check'),
  downloadUpdate: () => ipcRenderer.invoke('updates-download'),
  installUpdate: () => ipcRenderer.invoke('updates-install'),
  onUpdateStatus: (callback) => {
    const handler = (_event, payload) => {
      if (typeof callback === 'function') callback(payload);
    };
    ipcRenderer.on('update-status', handler);
    return () => { ipcRenderer.removeListener('update-status', handler); };
  }
});
