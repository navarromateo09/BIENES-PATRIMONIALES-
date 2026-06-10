(function () {
  'use strict';

  function showToast(message, type) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'toast ' + (type || 'success');
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function () { toast.remove(); }, 3500);
  }

  function showLogin() {
    document.getElementById('form-login').style.display = 'block';
    document.getElementById('form-crear-cuenta').style.display = 'none';
    var panelOlvide = document.getElementById('panel-olvide-password');
    if (panelOlvide) panelOlvide.style.display = 'none';
  }

  function showRegistro() {
    document.getElementById('form-login').style.display = 'none';
    document.getElementById('form-crear-cuenta').style.display = 'block';
    var panelOlvide = document.getElementById('panel-olvide-password');
    if (panelOlvide) panelOlvide.style.display = 'none';
  }

  function showOlvide() {
    document.getElementById('form-login').style.display = 'none';
    document.getElementById('form-crear-cuenta').style.display = 'none';
    var panelOlvide = document.getElementById('panel-olvide-password');
    if (panelOlvide) panelOlvide.style.display = 'block';
  }

  async function init() {
    var loginLogo = document.querySelector('.login-logo');
    if (loginLogo && window.stockAPI && typeof window.stockAPI.getAssetUrl === 'function') {
      var loginLogoFallbackTried = false;
      loginLogo.onerror = function () {
        if (loginLogoFallbackTried) {
          var wrap = document.querySelector('.login-logo-wrap');
          if (wrap) wrap.style.display = 'none';
          return;
        }
        loginLogoFallbackTried = true;
        var img = this;
        window.stockAPI.getAssetUrl('logo-sidebar.png').then(function (url) {
          img.src = url;
        }).catch(function () {
          var w = document.querySelector('.login-logo-wrap');
          if (w) w.style.display = 'none';
        });
      };
      window.stockAPI.getAssetUrl('logo-login.png').then(function (url) {
        if (loginLogo) loginLogo.src = url;
      }).catch(function () {
        window.stockAPI.getAssetUrl('logo-sidebar.png').then(function (url) {
          if (loginLogo) loginLogo.src = url;
        });
      });
    }

    const formLogin = document.getElementById('form-login');
    const formCrear = document.getElementById('form-crear-cuenta');
    const loginPassword = document.getElementById('login-password');
    const loginShowPassword = document.getElementById('login-show-password');
    function withTimeout(promise, ms) {
      return Promise.race([
        promise,
        new Promise(function (_resolve, reject) {
          setTimeout(function () { reject(new Error('timeout')); }, ms);
        })
      ]);
    }

    let status = { hasUser: false };
    if (window.appLoading && window.appLoading.show) window.appLoading.show('Verificando sesión…');
    try {
      if (!window.stockAPI || typeof window.stockAPI.getAuthStatus !== 'function') {
        throw new Error('stockAPI_no_disponible');
      }
      status = await withTimeout(window.stockAPI.getAuthStatus(), 8000);
    } catch (e) {
      status = { hasUser: false };
    } finally {
      if (window.appLoading && window.appLoading.hide) window.appLoading.hide();
    }

    // Si ya hay sesión, ir al dashboard
    if (status.hasUser) {
      window.location.href = 'dashboard.html';
      return;
    }

    // Siempre empezar con el formulario de iniciar sesión
    showLogin();

    document.getElementById('link-registrarme').addEventListener('click', function (e) {
      e.preventDefault();
      showRegistro();
    });
    document.getElementById('link-iniciar-sesion').addEventListener('click', function (e) {
      e.preventDefault();
      showLogin();
    });
    var linkOlvide = document.getElementById('link-olvide-password');
    if (linkOlvide) {
      linkOlvide.addEventListener('click', function (e) {
        e.preventDefault();
        showOlvide();
      });
    }
    var btnVolver = document.getElementById('btn-volver-login');
    if (btnVolver) {
      btnVolver.addEventListener('click', function () {
        showLogin();
      });
    }
    if (loginShowPassword && loginPassword) {
      loginShowPassword.addEventListener('change', function () {
        loginPassword.type = loginShowPassword.checked ? 'text' : 'password';
      });
    }

    formLogin.addEventListener('submit', async function (e) {
      e.preventDefault();
      const user = document.getElementById('login-usuario').value.trim();
      const pass = document.getElementById('login-password').value;
      if (window.appLoading && window.appLoading.show) window.appLoading.show('Iniciando sesión…');
      let result;
      try {
        result = await window.stockAPI.login(user, pass);
      } finally {
        if (window.appLoading && window.appLoading.hide) window.appLoading.hide();
      }
      if (result.ok) {
        window.location.href = 'dashboard.html';
      } else {
        if (loginShowPassword) loginShowPassword.checked = false;
        if (loginPassword) loginPassword.type = 'password';
        showToast(result.error || 'Error al iniciar sesión', 'error');
      }
    });

    formCrear.addEventListener('submit', async function (e) {
      e.preventDefault();
      const user = document.getElementById('crear-usuario').value.trim();
      const pass = document.getElementById('crear-password').value;
      const pass2 = document.getElementById('crear-password2').value;
      if (pass !== pass2) {
        showToast('Las contraseñas no coinciden', 'error');
        return;
      }
      if (window.appLoading && window.appLoading.show) window.appLoading.show('Creando cuenta…');
      let result;
      try {
        result = await window.stockAPI.createAccount(user, pass);
      } finally {
        if (window.appLoading && window.appLoading.hide) window.appLoading.hide();
      }
      if (result.ok) {
        if (result.pendingApproval) {
          showToast('Cuenta creada. Quedó pendiente de autorización por admin1.', 'success');
          formCrear.reset();
          showLogin();
          var loginUsuarioInput = document.getElementById('login-usuario');
          if (loginUsuarioInput) loginUsuarioInput.value = user;
          return;
        }
        showToast('Cuenta creada. Bienvenido.');
        window.location.href = 'dashboard.html';
      } else {
        showToast(result.error || 'Error al crear cuenta', 'error');
      }
    });

    var loginUsuario = document.getElementById('login-usuario');
    if (loginUsuario) loginUsuario.focus();
  }

  init();
})();
