export function getStockAPI() {
  if (typeof window === 'undefined') return null;
  return window.stockAPI || null;
}

export async function apiCall(fn, fallbackError) {
  const api = getStockAPI();
  if (!api) throw new Error('stockAPI no disponible');
  return fn(api);
}
