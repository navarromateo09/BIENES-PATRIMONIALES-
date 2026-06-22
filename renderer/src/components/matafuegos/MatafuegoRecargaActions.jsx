function IconRecarga() {
  return (
    <svg className="mf-btn-recarga-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <polyline points="21 3 21 9 15 9" />
    </svg>
  );
}

function IconListo() {
  return (
    <svg className="mf-btn-recarga-listo-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

export default function MatafuegoRecargaActions({
  recargando,
  onToggleRecargando,
  onOpenListo,
  onEdit,
  onDelete,
  isAdmin
}) {
  const toggleTitle = recargando
    ? 'Quitar estado recargando'
    : 'Marcar como en recarga (taller)';

  return (
    <div className="mf-acciones-recarga-cell">
      {recargando && (
        <button
          type="button"
          className="mf-btn-recarga-listo"
          title="Recarga terminada: pasar a disponible"
          onClick={onOpenListo}
        >
          <IconListo />
          <span className="mf-btn-recarga-listo-text">Listo</span>
        </button>
      )}
      <button
        type="button"
        className={`mf-btn-recarga-toggle${recargando ? ' active' : ''}`}
        title={toggleTitle}
        aria-label={toggleTitle}
        onClick={onToggleRecargando}
      >
        <IconRecarga />
      </button>
      <button type="button" className="btn btn-secondary btn-sm" onClick={onEdit}>
        Editar
      </button>
      {isAdmin && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={onDelete}>
          Eliminar
        </button>
      )}
    </div>
  );
}
