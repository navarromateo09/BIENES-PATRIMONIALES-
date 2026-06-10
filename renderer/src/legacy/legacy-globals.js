/** Puente mínimo: expone Paginacion si el script legacy aún no cargó. */
window.Paginacion = window.Paginacion || {
  DEFAULT_POR_PAGINA: 50,
  paginar(items, page, size) {
    const s = size || 50;
    const p = Math.max(1, page || 1);
    const start = (p - 1) * s;
    return (items || []).slice(start, start + s);
  },
  renderControles(container, page, totalPages, onChange) {
    if (!container) return;
    container.innerHTML = '';
    if (totalPages <= 1) return;
    const prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'btn btn-secondary btn-sm';
    prev.textContent = '← Anterior';
    prev.disabled = page <= 1;
    prev.onclick = () => onChange(page - 1);
    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'btn btn-secondary btn-sm';
    next.textContent = 'Siguiente →';
    next.disabled = page >= totalPages;
    next.onclick = () => onChange(page + 1);
    const info = document.createElement('span');
    info.style.margin = '0 0.75rem';
    info.textContent = `Página ${page} / ${totalPages}`;
    container.appendChild(prev);
    container.appendChild(info);
    container.appendChild(next);
  }
};
