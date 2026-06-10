(function () {
  'use strict';

  let data = { productos: [], movimientos: [] };
  let dependencias = [];

  let selectedExpedienteProductId = null;
  let currentPage = 'dashboard';

  const panels = {
    productos: document.getElementById('panel-productos'),
    salidas: document.getElementById('panel-salidas'),
    'detalle-expediente': document.getElementById('panel-detalle-expediente'),
    destinos: document.getElementById('panel-destinos'),
    historial: document.getElementById('panel-historial')
  };

  const tabButtons = document.querySelectorAll('.tab');
  const listaProductos = document.getElementById('lista-productos');
  const listaMovimientos = document.getElementById('lista-movimientos');
  const selectDestino = document.getElementById('select-destino');
  const buscarDestino = document.getElementById('buscar-destino');
  const destinoResumen = document.getElementById('destino-resumen');
  const listaEnviosDestino = document.getElementById('lista-envios-destino');
  const listaDetalleExpediente = document.getElementById('lista-detalle-expediente');
  const detalleExpedienteDesc = document.getElementById('detalle-expediente-desc');
  const detalleExpedienteContenido = document.getElementById('detalle-expediente-contenido');
  const detalleExpedienteResumen = document.getElementById('detalle-expediente-resumen');
  const detalleExpedienteTitulo = document.getElementById('detalle-expediente-titulo');
  const modalProducto = document.getElementById('modal-producto');
  const formProducto = document.getElementById('form-producto');
  const formSalida = document.getElementById('form-salida');
  const selectSalida = document.getElementById('salida-producto');
  const selectSalidaItem = document.getElementById('salida-item');

  function setFormSubmitting(form, submitting) {
    if (!form || !form.dataset) return;
    form.dataset.submitting = submitting ? '1' : '0';

    // Solo deshabilitamos los botones de submit para evitar bloquear la UI completa.
    const submitControls = form.querySelectorAll('button[type="submit"], input[type="submit"]');
    submitControls.forEach(btn => {
      btn.disabled = submitting;
    });
  }

  function showToast(message, type = 'success') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  }

  function openTab(tabName) {
    tabButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    Object.keys(panels).forEach(key => {
      panels[key].classList.toggle('active', key === tabName);
    });
    if (tabName === 'productos') renderProductos();
    if (tabName === 'historial') renderMovimientos();
    if (tabName === 'detalle-expediente') renderDetalleExpediente();
    if (tabName === 'destinos') renderDestinos();
    if (tabName === 'salidas') fillProductSelects();
  }

  function verDetalleExpediente(productId) {
    selectedExpedienteProductId = productId;
    openTab('detalle-expediente');
  }

  function renderDetalleExpediente() {
    const producto = selectedExpedienteProductId
      ? data.productos.find(p => p.id === selectedExpedienteProductId)
      : null;

    if (detalleExpedienteDesc) detalleExpedienteDesc.style.display = producto ? 'none' : 'block';
    if (detalleExpedienteContenido) detalleExpedienteContenido.style.display = producto ? 'block' : 'none';

    if (producto) {
      const btnWrap = document.getElementById('expediente-btn-agregar-wrap');
      const formWrap = document.getElementById('form-agregar-expediente-wrap');
      if (btnWrap) btnWrap.style.display = 'block';
      if (formWrap) formWrap.style.display = 'none';
      const fechaInput = document.getElementById('expediente-fecha');
      if (fechaInput && !fechaInput.value) {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const h = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        fechaInput.value = `${y}-${m}-${d}T${h}:${min}`;
      }
    }

    if (!producto || !listaDetalleExpediente) {
      if (listaDetalleExpediente) listaDetalleExpediente.innerHTML = '';
      return;
    }

    if (detalleExpedienteTitulo) detalleExpedienteTitulo.textContent = `Productos recibidos - Expediente ${escapeHtml(producto.codigo)}`;
    const entradas = (data.movimientos || []).filter(m => m.tipo === 'entrada' && m.productoId === producto.id);
    const total = entradas.reduce((sum, m) => sum + (parseInt(m.cantidad, 10) || 0), 0);
    const unidad = producto.unidad || 'unidades';
    if (detalleExpedienteResumen) {
      detalleExpedienteResumen.innerHTML = `Expediente <strong>${escapeHtml(producto.codigo)}</strong> — <strong>${escapeHtml(producto.nombre)}</strong>. Total recibido: <strong>${total} ${escapeHtml(unidad)}</strong> (${entradas.length} entrada${entradas.length !== 1 ? 's' : ''}).`;
    }

    if (!entradas.length) {
      listaDetalleExpediente.innerHTML = '<tr><td colspan="8" class="empty-state"><p>No hay ingresos registrados. Haz clic en "Agregar producto nuevo" para agregar.</p></td></tr>';
      return;
    }

    const salidas = (data.movimientos || []).filter(mov => mov.tipo === 'salida');
    const salidasPorEntrada = {};
    salidas.forEach(s => {
      const eid = s.entradaId || s.entrada;
      if (eid) {
        salidasPorEntrada[eid] = (salidasPorEntrada[eid] || 0) + (parseInt(s.cantidad, 10) || 0);
      }
    });

    const ordenadas = [...entradas].sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
    listaDetalleExpediente.innerHTML = ordenadas.map(m => {
      const fecha = m.fecha ? new Date(m.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
      const recibido = parseInt(m.cantidad, 10) || 0;
      const entregado = salidasPorEntrada[m.id] || 0;
      const disponible = Math.max(0, recibido - entregado);
      const cantidadTexto = `${recibido} / ${disponible}`;
      return `<tr><td>${escapeHtml(fecha)}</td><td>${escapeHtml(m.numeroSerie || '-')}</td><td>${escapeHtml(m.nombre || '-')}</td><td>${escapeHtml(m.marca || '-')}</td><td class="stock-cell" title="Recibido / Disponible">${cantidadTexto}</td><td>${escapeHtml(unidad)}</td><td>${escapeHtml(m.concepto || '-')}</td><td><button type="button" class="btn btn-secondary btn-sm btn-editar-mov" data-movimiento-id="${m.id}">Editar</button></td></tr>`;
    }).join('');

    listaDetalleExpediente.querySelectorAll('.btn-editar-mov').forEach(btn => {
      btn.addEventListener('click', () => openModalEditarMovimiento(btn.dataset.movimientoId));
    });
  }

  function openModalEditarMovimiento(movimientoId) {
    const mov = data.movimientos.find(m => m.id === movimientoId);
    if (!mov) return;
    document.getElementById('edit-mov-id').value = mov.id;
    document.getElementById('edit-mov-numero-serie').value = mov.numeroSerie || '';
    document.getElementById('edit-mov-nombre').value = mov.nombre || '';
    document.getElementById('edit-mov-marca').value = mov.marca || '';
    document.getElementById('edit-mov-cantidad').value = mov.cantidad || '';
    document.getElementById('edit-mov-descripcion').value = mov.concepto || '';
    const fechaEl = document.getElementById('edit-mov-fecha');
    if (mov.fecha) {
      const d = new Date(mov.fecha);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const h = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      fechaEl.value = `${y}-${m}-${day}T${h}:${min}`;
    } else {
      fechaEl.value = '';
    }
    document.getElementById('modal-editar-movimiento').classList.add('open');
  }

  function closeModalEditarMovimiento() {
    document.getElementById('modal-editar-movimiento').classList.remove('open');
  }

  async function guardarEditarMovimiento(e) {
    e.preventDefault();
    const form = e && e.target && e.target.tagName === 'FORM' ? e.target : document.getElementById('form-editar-movimiento');
    if (form && form.dataset.submitting === '1') return;
    setFormSubmitting(form, true);
    const id = document.getElementById('edit-mov-id').value;
    const fechaInput = document.getElementById('edit-mov-fecha').value;
    const fecha = fechaInput ? new Date(fechaInput).toISOString() : undefined;
    const updates = {
      numeroSerie: document.getElementById('edit-mov-numero-serie').value.trim() || undefined,
      nombre: document.getElementById('edit-mov-nombre').value.trim() || undefined,
      marca: document.getElementById('edit-mov-marca').value.trim() || undefined,
      cantidad: document.getElementById('edit-mov-cantidad').value,
      concepto: document.getElementById('edit-mov-descripcion').value.trim() || undefined,
      fecha
    };
    try {
      const result = await window.stockAPI.updateMovimiento(id, updates);
      if (result.ok) {
        showToast('Producto actualizado');
        closeModalEditarMovimiento();
        await loadData();
        renderDetalleExpediente();
        fillProductSelects();
      } else {
        showToast(result.error || 'Error', 'error');
      }
    } catch (err) {
      showToast('Error al guardar', 'error');
    } finally {
      setFormSubmitting(form, false);
    }
  }

  async function agregarProductoExpediente(e) {
    e.preventDefault();
    if (!selectedExpedienteProductId) {
      showToast('Selecciona un expediente desde la pestaña Productos', 'error');
      return;
    }
    const form = e && e.target && e.target.tagName === 'FORM' ? e.target : document.getElementById('form-agregar-expediente');
    if (form && form.dataset.submitting === '1') return;
    setFormSubmitting(form, true);
    const numeroSerie = document.getElementById('expediente-numero-serie').value.trim();
    const nombre = document.getElementById('expediente-nombre').value.trim();
    const marca = document.getElementById('expediente-marca').value.trim();
    const cantidad = document.getElementById('expediente-cantidad').value;
    const descripcion = document.getElementById('expediente-descripcion').value.trim();
    const fechaInput = document.getElementById('expediente-fecha').value;
    const fecha = fechaInput ? new Date(fechaInput).toISOString() : new Date().toISOString();
    try {
      const result = await window.stockAPI.registrarMovimiento({
        tipo: 'entrada',
        productoId: selectedExpedienteProductId,
        cantidad,
        concepto: descripcion || undefined,
        fecha,
        numeroSerie: numeroSerie || undefined,
        nombre: nombre || undefined,
        marca: marca || undefined
      });
      if (result.ok) {
        showToast('Productos agregados al expediente');
        document.getElementById('form-agregar-expediente').reset();
        const now = new Date();
        const fechaEl = document.getElementById('expediente-fecha');
        if (fechaEl) {
          const y = now.getFullYear();
          const m = String(now.getMonth() + 1).padStart(2, '0');
          const d = String(now.getDate()).padStart(2, '0');
          const h = String(now.getHours()).padStart(2, '0');
          const min = String(now.getMinutes()).padStart(2, '0');
          fechaEl.value = `${y}-${m}-${d}T${h}:${min}`;
        }
        const btnWrap = document.getElementById('expediente-btn-agregar-wrap');
        const formWrap = document.getElementById('form-agregar-expediente-wrap');
        if (btnWrap) btnWrap.style.display = 'block';
        if (formWrap) formWrap.style.display = 'none';
        await loadData();
        renderDetalleExpediente();
        fillProductSelects();
      } else {
        showToast(result.error || 'Error', 'error');
      }
    } catch (err) {
      showToast('Error al agregar productos', 'error');
    } finally {
      setFormSubmitting(form, false);
    }
  }

  async function loadData() {
    try {
      data = await window.stockAPI.getData();
      if (!data.productos) data.productos = [];
      if (!data.movimientos) data.movimientos = [];
    } catch (e) {
      console.error(e);
      showToast('Error al cargar datos', 'error');
    }
  }

  function fillProductSelects() {
    const options = data.productos.map(p =>
      `<option value="${p.id}">${escapeHtml(p.nombre)} (${p.codigo}) - Stock: ${p.stockActual ?? 0}</option>`
    ).join('');
    const emptyExp = '<option value="">Seleccionar expediente</option>';
    selectSalida.innerHTML = emptyExp + options;
    fillSalidaItems(selectSalida.value);
  }

  function fillSalidaItems(productoId) {
    if (!selectSalidaItem) return;
    selectSalidaItem.innerHTML = '<option value="">— Seleccionar producto del expediente —</option>';
    if (!productoId) {
      selectSalidaItem.disabled = true;
      return;
    }
    const entradas = (data.movimientos || []).filter(m => m.tipo === 'entrada' && m.productoId === productoId);
    entradas.forEach(m => {
      const parts = [m.nombre || 'Sin nombre', m.marca || '', m.numeroSerie ? `Nº ${m.numeroSerie}` : ''].filter(Boolean);
      const label = parts.join(' — ') || `Entrada ${m.fecha ? new Date(m.fecha).toLocaleDateString('es') : m.id}`;
      selectSalidaItem.innerHTML += `<option value="${m.id}">${escapeHtml(label)}</option>`;
    });
    selectSalidaItem.disabled = entradas.length === 0;
    if (entradas.length === 0) {
      selectSalidaItem.innerHTML = '<option value="">— No hay productos cargados en este expediente —</option>';
    }
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function renderProductos() {
    if (!data.productos.length) {
      listaProductos.innerHTML = '<tr><td colspan="7" class="empty-state"><p>No hay productos. Agrega uno con "Nuevo producto".</p></td></tr>';
      return;
    }
    listaProductos.innerHTML = data.productos.map(p => `
      <tr>
        <td><button type="button" class="link-expediente" data-id="${p.id}" title="Ver productos recibidos">${escapeHtml(p.codigo)}</button></td>
        <td>${escapeHtml(p.numeroSerie || '-')}</td>
        <td>${escapeHtml(p.nombre)}</td>
        <td>${escapeHtml(p.descripcion || '-')}</td>
        <td class="stock-cell">${Number(p.stockActual ?? 0)}</td>
        <td>${escapeHtml(p.unidad || 'unidades')}</td>
        <td>
          <button type="button" class="btn btn-secondary btn-sm btn-editar" data-id="${p.id}">Editar</button>
          <button type="button" class="btn btn-danger btn-sm btn-eliminar" data-id="${p.id}">Eliminar</button>
        </td>
      </tr>
    `).join('');

    listaProductos.querySelectorAll('.link-expediente').forEach(btn => {
      btn.addEventListener('click', (e) => { e.preventDefault(); verDetalleExpediente(btn.dataset.id); });
    });
    listaProductos.querySelectorAll('.btn-editar').forEach(btn => {
      btn.addEventListener('click', () => openModalProducto(btn.dataset.id));
    });
    listaProductos.querySelectorAll('.btn-eliminar').forEach(btn => {
      btn.addEventListener('click', () => eliminarProducto(btn.dataset.id, btn));
    });
  }

  function renderMovimientos() {
    const movs = [...(data.movimientos || [])].reverse();
    const getNombre = (id) => {
      const p = data.productos.find(x => x.id === id);
      return p ? p.nombre : '(eliminado)';
    };
    if (!movs.length) {
      listaMovimientos.innerHTML = '<tr><td colspan="6" class="empty-state"><p>No hay movimientos registrados.</p></td></tr>';
      return;
    }
    listaMovimientos.innerHTML = movs.map(m => {
      const fecha = m.fecha ? new Date(m.fecha).toLocaleString('es') : '-';
      const tipoClass = m.tipo === 'entrada' ? 'badge-entrada' : 'badge-salida';
      const tipoLabel = m.tipo === 'entrada' ? 'Entrada' : 'Salida';
      const destino = m.tipo === 'salida' && (m.destino || '').trim() ? escapeHtml((m.destino || '').trim()) : '—';
      return `
        <tr>
          <td>${escapeHtml(fecha)}</td>
          <td><span class="badge ${tipoClass}">${tipoLabel}</span></td>
          <td>${escapeHtml(getNombre(m.productoId))}</td>
          <td>${destino}</td>
          <td>${m.cantidad}</td>
          <td>${escapeHtml(m.concepto || '-')}</td>
        </tr>
      `;
    }).join('');
  }

  function getUniqueDestinos() {
    const salidas = (data.movimientos || []).filter(m => m.tipo === 'salida');
    const set = new Set();
    salidas.forEach(m => {
      const d = (m.destino || '').trim();
      set.add(d || 'Sin destino');
    });
    return Array.from(set).filter(Boolean).sort();
  }

  function renderDestinos() {
    const destinos = getUniqueDestinos();
    const select = selectDestino;
    const currentVal = select.value;

    select.innerHTML = '<option value="">-- Elige un destino --</option>' +
      destinos.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');

    const search = (buscarDestino && buscarDestino.value || '').trim().toLowerCase();
    if (search) {
      const opts = Array.from(select.options);
      opts.forEach((opt, i) => {
        if (i === 0) return;
        opt.hidden = !opt.textContent.toLowerCase().includes(search);
      });
    } else {
      Array.from(select.options).forEach(opt => { opt.hidden = false; });
    }

    if (currentVal && destinos.includes(currentVal)) select.value = currentVal;
    updateEnviosPorDestino();
  }

  function updateEnviosPorDestino() {
    const destino = (selectDestino && selectDestino.value || '').trim();
    const getProducto = (id) => data.productos.find(p => p.id === id);
    const salidas = (data.movimientos || []).filter(m => m.tipo === 'salida');
    const envios = destino
      ? salidas.filter(m => ((m.destino || '').trim() || 'Sin destino') === destino)
      : [];

    if (!destino) {
      destinoResumen.innerHTML = '';
      listaEnviosDestino.innerHTML = '<tr><td colspan="5" class="empty-state"><p>Selecciona un destino para ver los productos enviados.</p></td></tr>';
      return;
    }

    if (!envios.length) {
      destinoResumen.innerHTML = '<p class="empty-state">No hay envíos registrados para este destino.</p>';
      listaEnviosDestino.innerHTML = '';
      return;
    }

    const totalUnidades = envios.reduce((sum, m) => sum + (parseInt(m.cantidad, 10) || 0), 0);
    destinoResumen.innerHTML = `<p class="destino-resumen-texto">A <strong>${escapeHtml(destino)}</strong> enviaste <strong>${totalUnidades}</strong> unidades en total (${envios.length} movimiento${envios.length !== 1 ? 's' : ''}).</p>`;

    const ordenadas = [...envios].sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
    listaEnviosDestino.innerHTML = ordenadas.map(m => {
      const p = getProducto(m.productoId);
      const fecha = m.fecha ? new Date(m.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
      const nombre = p ? p.nombre : '(eliminado)';
      const unidad = p ? (p.unidad || 'unidades') : 'unidades';
      return `<tr><td>${escapeHtml(fecha)}</td><td>${escapeHtml(nombre)}</td><td class="stock-cell">${m.cantidad}</td><td>${escapeHtml(unidad)}</td><td>${escapeHtml(m.concepto || '-')}</td></tr>`;
    }).join('');
  }

  function openModalProducto(id) {
    const titulo = document.getElementById('modal-producto-titulo');
    if (id) {
      const p = data.productos.find(x => x.id === id);
      if (!p) return;
      titulo.textContent = 'Editar Expediente';
      document.getElementById('producto-id').value = p.id;
      document.getElementById('producto-codigo').value = p.codigo || '';
    } else {
      titulo.textContent = 'Nuevo Expediente';
      formProducto.reset();
      document.getElementById('producto-id').value = '';
    }
    modalProducto.classList.add('open');
  }

  function closeModalProducto() {
    modalProducto.classList.remove('open');
  }

  async function guardarProducto(e) {
    e.preventDefault();
    const form = e && e.target && e.target.tagName === 'FORM' ? e.target : formProducto;
    if (form && form.dataset.submitting === '1') return;
    setFormSubmitting(form, true);
    const id = document.getElementById('producto-id').value.trim() || null;
    const codigo = document.getElementById('producto-codigo').value.trim();
    let producto;
    if (id) {
      const existente = data.productos.find(p => p.id === id);
      producto = existente ? { ...existente, codigo } : { id, codigo, nombre: codigo, descripcion: '', stockActual: 0, unidad: 'unidades' };
    } else {
      producto = {
        codigo,
        nombre: codigo,
        descripcion: '',
        stockActual: 0,
        unidad: 'unidades'
      };
    }
    try {
      await window.stockAPI.saveProducto(producto);
      showToast(id ? 'Expediente actualizado' : 'Expediente creado');
      closeModalProducto();
      await loadData();
      renderProductos();
      fillProductSelects();
    } catch (err) {
      showToast('Error al guardar', 'error');
    } finally {
      setFormSubmitting(form, false);
    }
  }

  async function eliminarProducto(id, btn) {
    if (btn && btn.dataset && btn.dataset.deleting === '1') return;
    if (!confirm('¿Eliminar este producto? Se borrarán también sus movimientos.')) return;
    if (btn && btn.dataset) {
      btn.dataset.deleting = '1';
      btn.disabled = true;
    }
    try {
      await window.stockAPI.deleteProducto(id);
      showToast('Producto eliminado');
      await loadData();
      renderProductos();
      fillProductSelects();
    } catch (err) {
      showToast('Error al eliminar', 'error');
    } finally {
      if (btn && btn.dataset) {
        btn.dataset.deleting = '0';
        btn.disabled = false;
      }
    }
  }

  async function registrarSalida(e) {
    e.preventDefault();
    const form = e && e.target && e.target.tagName === 'FORM' ? e.target : formSalida;
    const productoId = selectSalida.value;
    const cantidad = document.getElementById('salida-cantidad').value;
    const concepto = document.getElementById('salida-concepto').value.trim();
    const destino = document.getElementById('salida-destino').value.trim();
    if (!productoId) {
      showToast('Selecciona un producto', 'error');
      return;
    }
    if (!destino) {
      showToast('Indica el destino del envío', 'error');
      return;
    }
    if (form && form.dataset.submitting === '1') return;
    setFormSubmitting(form, true);
    const entradaId = selectSalidaItem && selectSalidaItem.value ? selectSalidaItem.value : undefined;
    try {
      const result = await window.stockAPI.registrarMovimiento({
        tipo: 'salida',
        productoId,
        cantidad,
        concepto,
        destino,
        entradaId
      });
      if (result.ok) {
        showToast('Salida registrada');
        formSalida.reset();
        await loadData();
        fillProductSelects();
      } else {
        showToast(result.error || 'Error', 'error');
      }
    } catch (err) {
      showToast('Error al registrar salida', 'error');
    } finally {
      setFormSubmitting(form, false);
    }
  }

  function initApp() {
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => openTab(btn.dataset.tab));
    });

    const btnNuevo = document.getElementById('btn-nuevo-producto');
    if (btnNuevo) btnNuevo.addEventListener('click', () => openModalProducto(null));
    if (modalProducto) {
      const closeBtn = modalProducto.querySelector('.modal-close');
      const cancelBtn = modalProducto.querySelector('.modal-cancel');
      if (closeBtn) closeBtn.addEventListener('click', closeModalProducto);
      if (cancelBtn) cancelBtn.addEventListener('click', closeModalProducto);
      modalProducto.addEventListener('click', (e) => {
        if (e.target === modalProducto) closeModalProducto();
      });
      modalProducto.addEventListener('keydown', (e) => {
        if (!modalProducto.classList.contains('open')) return;
        if (!modalProducto.contains(e.target)) return;

        if (e.key === 'Escape') {
          e.preventDefault();
          closeModalProducto();
          return;
        }

        // Enter dentro del modal dispara el submit (guardar) del formulario.
        if (e.key === 'Enter' && e.target && e.target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          if (formProducto) {
            formProducto.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
          }
        }
      });
    }

    formProducto.addEventListener('submit', guardarProducto);
    formSalida.addEventListener('submit', registrarSalida);

    const formAgregarExp = document.getElementById('form-agregar-expediente');
    if (formAgregarExp) formAgregarExp.addEventListener('submit', agregarProductoExpediente);

    const btnAgregarExp = document.getElementById('btn-agregar-producto-expediente');
    const btnCancelarExp = document.getElementById('btn-cancelar-agregar-expediente');
    const expedienteBtnWrap = document.getElementById('expediente-btn-agregar-wrap');
    const expedienteFormWrap = document.getElementById('form-agregar-expediente-wrap');
    if (btnAgregarExp && expedienteBtnWrap && expedienteFormWrap) {
      btnAgregarExp.addEventListener('click', () => {
        expedienteBtnWrap.style.display = 'none';
        expedienteFormWrap.style.display = 'block';
      });
    }
    if (btnCancelarExp && expedienteBtnWrap && expedienteFormWrap) {
      btnCancelarExp.addEventListener('click', () => {
        expedienteFormWrap.style.display = 'none';
        expedienteBtnWrap.style.display = 'block';
      });
    }

    const formEditarMov = document.getElementById('form-editar-movimiento');
    const modalEditarMov = document.getElementById('modal-editar-movimiento');
    if (formEditarMov) formEditarMov.addEventListener('submit', guardarEditarMovimiento);
    const closeEditarMov = document.querySelector('.modal-editar-mov-close');
    const cancelEditarMov = document.querySelector('.modal-editar-mov-cancel');
    if (closeEditarMov) closeEditarMov.addEventListener('click', closeModalEditarMovimiento);
    if (cancelEditarMov) cancelEditarMov.addEventListener('click', closeModalEditarMovimiento);
    if (modalEditarMov) {
      modalEditarMov.addEventListener('click', (ev) => {
        if (ev.target === modalEditarMov) closeModalEditarMovimiento();
      });
      modalEditarMov.addEventListener('keydown', (e) => {
        if (!modalEditarMov.classList.contains('open')) return;
        if (!modalEditarMov.contains(e.target)) return;

        if (e.key === 'Escape') {
          e.preventDefault();
          closeModalEditarMovimiento();
          return;
        }

        // Enter dentro del modal dispara el submit (guardar) del formulario.
        if (e.key === 'Enter' && e.target && e.target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          if (formEditarMov) {
            formEditarMov.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
          }
        }
      });
    }

    if (selectSalida) selectSalida.addEventListener('change', () => fillSalidaItems(selectSalida.value));
    if (selectDestino) selectDestino.addEventListener('change', updateEnviosPorDestino);
    if (buscarDestino) buscarDestino.addEventListener('input', renderDestinos);

    loadData().then(() => {
      renderProductos();
      fillProductSelects();
      renderMovimientos();
    });

    document.addEventListener('keydown', async (e) => {
      if (e.key === 'F5' || e.keyCode === 116) {
        e.preventDefault();
        await loadData();
        const activeTab = document.querySelector('.tab.active');
        const tabName = activeTab ? activeTab.dataset.tab : 'productos';
        openTab(tabName);
        showToast('Datos actualizados');
      }
    });
  }

  async function init() {
    const pantallaLogin = document.getElementById('pantalla-login');
    const appContenido = document.getElementById('app-contenido');
    const formLogin = document.getElementById('form-login');
    const formCrear = document.getElementById('form-crear-cuenta');

    if (!pantallaLogin || !appContenido) {
      initApp();
      return;
    }

    appContenido.style.display = 'none';
    const status = await window.stockAPI.getAuthStatus();

    if (status.hasUser) {
      formLogin.style.display = 'block';
      formCrear.style.display = 'none';
    } else {
      formLogin.style.display = 'none';
      formCrear.style.display = 'block';
    }

    function showMainApp() {
      pantallaLogin.style.display = 'none';
      appContenido.style.display = 'block';
      initApp();
    }

    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const user = document.getElementById('login-usuario').value.trim();
      const pass = document.getElementById('login-password').value;
      const result = await window.stockAPI.login(user, pass);
      if (result.ok) showMainApp();
      else showToast(result.error || 'Error al iniciar sesión', 'error');
    });

    formCrear.addEventListener('submit', async (e) => {
      e.preventDefault();
      const user = document.getElementById('crear-usuario').value.trim();
      const pass = document.getElementById('crear-password').value;
      const pass2 = document.getElementById('crear-password2').value;
      if (pass !== pass2) {
        showToast('Las contraseñas no coinciden', 'error');
        return;
      }
      const result = await window.stockAPI.createAccount(user, pass);
      if (result.ok) {
        if (result.pendingApproval) {
          showToast('Cuenta creada. Quedó pendiente de autorización por admin1.');
          formCrear.reset();
          formLogin.style.display = 'block';
          formCrear.style.display = 'none';
          const loginUsuario = document.getElementById('login-usuario');
          if (loginUsuario) loginUsuario.value = user;
          return;
        }
        showToast('Cuenta creada. Bienvenido.');
        showMainApp();
      } else {
        showToast(result.error || 'Error al crear cuenta', 'error');
      }
    });

    const loginUsuario = document.getElementById('login-usuario');
    const loginPass = document.getElementById('login-password');
    if (loginUsuario) loginUsuario.focus();
  }

  init();
})();
