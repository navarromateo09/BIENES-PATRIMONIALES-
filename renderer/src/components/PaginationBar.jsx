export default function PaginationBar({ info, onPageChange }) {
  if (!info || info.total === 0) return null;

  const { pagina, totalPaginas, inicio, fin, total } = info;
  const maxVisible = 5;
  let startPage = Math.max(1, pagina - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPaginas, startPage + maxVisible - 1);
  if (endPage - startPage < maxVisible - 1) startPage = Math.max(1, endPage - maxVisible + 1);

  const pages = [];
  if (startPage > 1) {
    pages.push(1);
    if (startPage > 2) pages.push('…');
  }
  for (let i = startPage; i <= endPage; i++) pages.push(i);
  if (endPage < totalPaginas) {
    if (endPage < totalPaginas - 1) pages.push('…');
    pages.push(totalPaginas);
  }

  return (
    <div className="paginacion-wrap">
      <span className="pag-info">
        Mostrando {inicio}–{fin} de {total}
      </span>
      <div className="pag-botones">
        <button
          type="button"
          className="pag-btn pag-prev"
          disabled={pagina <= 1}
          title="Anterior"
          onClick={() => onPageChange(pagina - 1)}
        >
          «
        </button>
        {pages.map((p, idx) => (
          typeof p === 'number' ? (
            <button
              key={`${p}-${idx}`}
              type="button"
              className={`pag-btn pag-num${p === pagina ? ' pag-active' : ''}`}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          ) : (
            <span key={`ellipsis-${idx}`} className="pag-ellipsis">{p}</span>
          )
        ))}
        <button
          type="button"
          className="pag-btn pag-next"
          disabled={pagina >= totalPaginas}
          title="Siguiente"
          onClick={() => onPageChange(pagina + 1)}
        >
          »
        </button>
      </div>
    </div>
  );
}
