export const DEFAULT_PAGE_SIZE = 50;

export function paginar(items, pagina, porPagina = DEFAULT_PAGE_SIZE) {
  const p = Math.max(1, pagina || 1);
  const size = porPagina || DEFAULT_PAGE_SIZE;
  const total = (items || []).length;
  const totalPaginas = Math.max(1, Math.ceil(total / size));
  const page = Math.min(p, totalPaginas);
  const inicio = (page - 1) * size;
  const fin = Math.min(inicio + size, total);
  return {
    items: (items || []).slice(inicio, fin),
    pagina: page,
    totalPaginas,
    total,
    inicio: total > 0 ? inicio + 1 : 0,
    fin
  };
}
