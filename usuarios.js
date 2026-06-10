(function () {
  'use strict';

  const usuariosInfo = document.getElementById('usuarios-info');
  const formCambiar = document.getElementById('form-cambiar-password');
  const panelAdmin = document.getElementById('panel-admin-usuarios');
  const tablaUsuariosAdmin = document.getElementById('tabla-usuarios-admin');
  const formAdminRename = document.getElementById('form-admin-rename');
  const selectAdminRenameUsuario = document.getElementById('admin-rename-usuario-select');
  const formAdminReset = document.getElementById('form-admin-reset');
  const selectAdminUsuario = document.getElementById('admin-usuario-select');
  var esAdmin1 = false;
  var usuarioActual = '';

  function showToast(message, type) {
    var existing = document.querySelector('.toast');
    if (existing) existing.remove();
    var toast = document.createElement('div');
    toast.className = 'toast ' + (type || 'success');
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function () { toast.remove(); }, 3500);
  }

  function renderUsuariosAdmin(usuarios) {
    if (!tablaUsuariosAdmin) return;
    if (!usuarios || usuarios.length === 0) {
      tablaUsuariosAdmin.innerHTML = '<tr><td colspan="4">No hay usuarios cargados.</td></tr>';
      return;
    }
    tablaUsuariosAdmin.innerHTML = usuarios.map(function (u) {
      var rol = (u.rol || 'usuario').toString();
      var creado = u.created_at ? new Date(u.created_at).toLocaleString('es-AR') : '—';
      var esPendiente = rol.toLowerCase() === 'pendiente';
      var puedeAutorizar = esAdmin1 && esPendiente;
      var acciones = puedeAutorizar
        ? '<button type="button" class="btn btn-sm btn-success btn-autorizar-usuario" data-username="' + u.username + '">Autorizar</button><button type="button" class="btn btn-sm btn-danger btn-rechazar-usuario" data-username="' + u.username + '">Rechazar</button>'
        : '—';
      return '<tr><td>' + u.username + '</td><td>' + rol + '</td><td>' + creado + '</td><td>' + acciones + '</td></tr>';
    }).join('');
  }

  async function cargarAdminUsuarios() {
    if (!panelAdmin || !tablaUsuariosAdmin || !selectAdminUsuario || !selectAdminRenameUsuario) return;
    try {
      var resp = await window.stockAPI.adminListUsuarios();
      if (!resp || !resp.ok) {
        showToast(resp && resp.error ? resp.error : 'No se pudieron cargar los usuarios', 'error');
        return;
      }
      var usuarios = resp.usuarios || [];
      renderUsuariosAdmin(usuarios);
      var usuariosHabilitados = usuarios.filter(function (u) {
        var rol = (u.rol || '').toString().toLowerCase();
        return rol !== 'pendiente';
      });
      selectAdminUsuario.innerHTML = usuariosHabilitados.map(function (u) {
        return '<option value="' + u.username + '">' + u.username + ' (' + (u.rol || 'usuario') + ')</option>';
      }).join('');
      selectAdminRenameUsuario.innerHTML = usuariosHabilitados.filter(function (u) {
        return (u.username || '').toLowerCase() !== (usuarioActual || '').toLowerCase();
      }).map(function (u) {
        return '<option value="' + u.username + '">' + u.username + ' (' + (u.rol || 'usuario') + ')</option>';
      }).join('');
    } catch (err) {
      showToast('Error al cargar usuarios', 'error');
    }
  }

  async function init() {
    var status = await window.stockAPI.getAuthStatus();
    if (usuariosInfo) {
      if (status.username) {
        var rolLabel = (status.rol || 'usuario').toLowerCase();
        if (rolLabel === 'admin') rolLabel = 'Admin';
        else if (rolLabel === 'oficina') rolLabel = 'Oficina';
        else rolLabel = 'Usuario';
        usuariosInfo.innerHTML = '<p>Usuario actual: <strong>' + status.username + '</strong> (' + rolLabel + ')</p>';
      } else {
        usuariosInfo.innerHTML = '<p>No hay usuario cargado.</p>';
      }
    }

    formCambiar.addEventListener('submit', async function (e) {
      e.preventDefault();
      var actual = document.getElementById('password-actual').value;
      var nueva = document.getElementById('password-nueva').value;
      var nueva2 = document.getElementById('password-nueva2').value;
      if (nueva !== nueva2) {
        showToast('Las contraseñas nuevas no coinciden', 'error');
        return;
      }
      try {
        var result = await window.stockAPI.changePassword(actual, nueva);
        if (result.ok) {
          showToast('Contraseña actualizada');
          formCambiar.reset();
        } else {
          showToast(result.error || 'Error', 'error');
        }
      } catch (err) {
        showToast('Error al cambiar contraseña', 'error');
      }
    });

    // Panel de administración solo para admin
    if (status.rol && status.rol.toLowerCase() === 'admin') {
      usuarioActual = (status.username || '').trim();
      esAdmin1 = (status.username || '').toLowerCase() === 'admin1';
      if (panelAdmin) panelAdmin.style.display = 'block';
      await cargarAdminUsuarios();

      if (tablaUsuariosAdmin && !tablaUsuariosAdmin.dataset.bindAuthorize) {
        tablaUsuariosAdmin.dataset.bindAuthorize = '1';
        tablaUsuariosAdmin.addEventListener('click', async function (ev) {
          var btn = ev.target && ev.target.closest
            ? ev.target.closest('.btn-autorizar-usuario, .btn-rechazar-usuario')
            : null;
          if (!btn) return;
          var userTarget = (btn.getAttribute('data-username') || '').trim();
          if (!userTarget) return;
          var esAutorizar = btn.classList.contains('btn-autorizar-usuario');
          var pregunta = esAutorizar
            ? '¿Autorizar al usuario "' + userTarget + '" para que pueda ingresar al sistema?'
            : '¿Rechazar al usuario "' + userTarget + '"? Esta acción elimina su cuenta pendiente.';
          if (!confirm(pregunta)) return;
          btn.disabled = true;
          try {
            var r = esAutorizar
              ? await window.stockAPI.adminAuthorizeUser(userTarget)
              : await window.stockAPI.adminRejectUser(userTarget);
            if (r && r.ok) {
              showToast(esAutorizar ? 'Usuario autorizado: ' + userTarget : 'Usuario rechazado: ' + userTarget);
              await cargarAdminUsuarios();
            } else {
              showToast((r && r.error) || (esAutorizar ? 'No se pudo autorizar al usuario' : 'No se pudo rechazar al usuario'), 'error');
            }
          } catch (err) {
            showToast(esAutorizar ? 'No se pudo autorizar al usuario' : 'No se pudo rechazar al usuario', 'error');
          } finally {
            btn.disabled = false;
          }
        });
      }

      if (formAdminRename && selectAdminRenameUsuario) {
        formAdminRename.addEventListener('submit', async function (e) {
          e.preventDefault();
          var userActual = selectAdminRenameUsuario.value;
          var userNuevo = (document.getElementById('admin-rename-username-nuevo').value || '').trim();
          if (!userActual) {
            showToast('Seleccioná un usuario', 'error');
            return;
          }
          if (!userNuevo || userNuevo.length < 3) {
            showToast('El nuevo nombre debe tener al menos 3 caracteres', 'error');
            return;
          }
          try {
            var r = await window.stockAPI.adminRenameUser(userActual, userNuevo);
            if (r && r.ok) {
              showToast('Usuario renombrado: ' + userActual + ' → ' + userNuevo);
              document.getElementById('admin-rename-username-nuevo').value = '';
              await cargarAdminUsuarios();
            } else {
              showToast((r && r.error) || 'No se pudo cambiar el nombre de usuario', 'error');
            }
          } catch (err) {
            showToast('No se pudo cambiar el nombre de usuario', 'error');
          }
        });
      }

      if (formAdminReset && selectAdminUsuario) {
        formAdminReset.addEventListener('submit', async function (e) {
          e.preventDefault();
          var userTarget = selectAdminUsuario.value;
          var passNueva = document.getElementById('admin-password-nueva').value;
          if (!userTarget) {
            showToast('Seleccioná un usuario', 'error');
            return;
          }
          if (!passNueva || passNueva.length < 4) {
            showToast('La nueva contraseña debe tener al menos 4 caracteres', 'error');
            return;
          }
          try {
            var r = await window.stockAPI.adminResetPassword(userTarget, passNueva);
            if (r && r.ok) {
              showToast('Contraseña actualizada para ' + userTarget);
              document.getElementById('admin-password-nueva').value = '';
            } else {
              showToast((r && r.error) || 'Error al actualizar contraseña', 'error');
            }
          } catch (err) {
            showToast('Error al actualizar contraseña', 'error');
          }
        });
      }
    }
  }

  window._realtimeRefresh = function (table) {
    if (table === 'usuarios') init();
  };

  init();
})();
