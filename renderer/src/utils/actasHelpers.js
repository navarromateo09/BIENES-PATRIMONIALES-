export { ACTA_PRINT_STYLES } from './guardiaHelpers';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS_PALABRAS = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE', 'TREINTA', 'TREINTA Y UNO'];
const CANT_PALABRAS = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE', 'TREINTA'];
const HORAS_PALABRAS = ['CERO', 'UNA', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO'];

export const PAG_CARPETAS_EXP = 12;

function escapeHtml(str) {
  if (str == null || str === '') return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function numeroACapitalizar(n) {
  return n >= 1 && n <= 31 ? DIAS_PALABRAS[n] : String(n);
}

function cantidadEnPalabras(n) {
  return n >= 1 && n <= 30 ? CANT_PALABRAS[n] : String(n);
}

function yearEnPalabras(y) {
  if (y === 2025) return 'dos mil Veinticinco';
  if (y === 2026) return 'dos mil Veintiséis';
  if (y === 2027) return 'dos mil Veintisiete';
  if (y >= 2020 && y <= 2030) {
    const map = { 2020: 'Veinte', 2021: 'Veintiuno', 2022: 'Veintidós', 2023: 'Veintitrés', 2024: 'Veinticuatro' };
    return `dos mil ${map[y] || String(y)}`;
  }
  return `dos mil ${String(y).slice(-2)}`;
}

export function limpiarDepLabelViejo(label) {
  let txt = (label || '').toString().trim();
  if (!txt) return '—';
  txt = txt.replace(/^\s*(?:\d+\s*-\s*)+/, '').trim();
  return txt || '—';
}

export function formatFechaActa(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return isoStr;
  return d.toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

export function getDepLabelActa(depId, dependencias) {
  if (!depId) return '—';
  const d = (dependencias || []).find((x) => x.id === depId);
  if (!d) return '—';
  const nom = (d.nombre || '').toString().trim();
  const cod = (d.codigo || '').toString().trim();
  return nom || cod || '—';
}

export function fechaToDatetimeLocal(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${h}:${min}`;
}

export function buildActaHtmlForReprint(acta, dependencias) {
  let dep = getDepLabelActa(acta.dependencia_id, dependencias);
  if (dep === '—') dep = limpiarDepLabelViejo(acta.depLabel);
  const compareciente = (acta.destinatario || '').toString().trim() || '—';
  const productLabel = (acta.productLabel || '').toString().trim() || '—';
  const cantidad = acta.cantidad != null ? parseInt(acta.cantidad, 10) : 0;
  const expediente = (acta.expediente || '').toString().trim() || '—';
  const seriales = Array.isArray(acta.seriales) ? acta.seriales : [];
  const d = acta.fecha ? new Date(acta.fecha) : new Date();
  const diaPalabra = numeroACapitalizar(d.getDate());
  const mesNombre = MESES[d.getMonth()] || '—';
  const anioPalabra = yearEnPalabras(d.getFullYear());
  const horaNum = d.getHours();
  const horaPalabra = (horaNum >= 0 && horaNum < 24) ? HORAS_PALABRAS[horaNum] : String(horaNum);
  const cantPalabra = cantidadEnPalabras(cantidad);
  const descripcionProducto = cantidad >= 1 && cantidad <= 30
    ? `(${cantidad < 10 ? `0${cantidad}` : String(cantidad)}) ${cantPalabra} ${productLabel.toUpperCase()}`
    : `(${cantidad}) ${productLabel.toUpperCase()}`;

  let lineasSerie;
  if (seriales.length > 0) {
    lineasSerie = seriales.map((s, i) => {
      const texto = (s.num || '—');
      return `<span class="acta-editable">${escapeHtml(texto)}</span>${i < seriales.length - 1 ? '; ' : '.'}`;
    }).join('');
  } else {
    lineasSerie = '<span class="acta-editable">—</span>';
  }

  return `<div class="acta-documento">`
    + '<div class="acta-logo-wrap"><img src="logito.jpeg" alt="" class="acta-logo"></div>'
    + `<p class="acta-parrafo"><strong>ACTA DE ENTREGA:</strong> En la Ciudad de San Miguel de Tucumán, Departamento Capital, a los <strong><span class="acta-editable">${diaPalabra} días del mes de ${mesNombre} del año ${anioPalabra}</span></strong>, siendo horas <strong><span class="acta-editable">${horaPalabra}</span></strong>, el funcionario de Policía que suscribe por <span class="acta-editable">—</span>, con prestación de servicio en División Control Bienes Patrimoniales (D-4); asistido en éste acto por el <span class="acta-editable">—</span>, redacto la presente a los fines y efectos legales de dejar debidamente documentado lo siguiente:</p>`
    + `<p class="acta-parrafo">Que en la fecha y hora indicada, se hace comparecer a <span class="acta-editable" contenteditable="true">${escapeHtml(compareciente)}</span>, perteneciente a <span class="acta-editable">${escapeHtml(dep)}</span>, cumpliendo función de <span class="acta-editable" contenteditable="true">—</span>, a quien se le procede hacer entrega en calidad de <strong>PROVISIÓN</strong>:</p>`
    + `<p class="acta-parrafo"><span class="acta-editable" contenteditable="true">${escapeHtml(descripcionProducto)}</span> con sus respectivos <strong>NROS DE SERIE</strong>: ${lineasSerie}</p>`
    + `<p class="acta-parrafo">Bien adquirido mediante EXP. <span class="acta-editable">${escapeHtml(expediente)}</span>.</p>`
    + '<p class="acta-parrafo acta-parrafo-final">Así mismo, se le hace conocer que se deberá poner el mayor celo en el cuidado y mantenimiento de dichos elementos a fin que no sufra mayores deterioros más que los causados por el normal. No siendo para más se da por finalizado el acto previa lectura y ratificación de su contenido por parte de los intervinientes lo firman por ante mí en conformidad lo que CERTIFICO.</p>'
    + '<div class="acta-espacio-firmas" aria-label="Espacio reservado para firmas y sellos"></div></div>';
}

export function filtrarActas(actas, { busqueda, dependenciaId, desde, hasta, dependencias }) {
  const q = (busqueda || '').trim().toLowerCase();
  return (actas || []).filter((a) => {
    if (dependenciaId) {
      const actaDepId = (a.dependencia_id || '').toString();
      if (actaDepId !== dependenciaId) return false;
    }
    if (desde || hasta) {
      const t = a.fecha ? new Date(a.fecha).getTime() : 0;
      if (desde && t < desde) return false;
      if (hasta && t > hasta) return false;
    }
    if (q) {
      const id = (a.id || '').toString().toLowerCase();
      const fecha = formatFechaActa(a.fecha).toLowerCase();
      const exp = (a.expediente || '').toString().trim().toLowerCase();
      const depLabel = (getDepLabelActa(a.dependencia_id, dependencias) || limpiarDepLabelViejo(a.depLabel) || '').toString().toLowerCase();
      const prod = (a.productLabel || '').toString().trim().toLowerCase();
      const haystack = [id, fecha, exp, depLabel, prod].join(' ');
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

function expedienteGrupoKey(a) {
  const s = (a?.expediente != null) ? String(a.expediente).trim() : '';
  return s || 'Sin expediente';
}

export function groupActasByExpediente(actas) {
  const map = {};
  (actas || []).forEach((a) => {
    const key = expedienteGrupoKey(a);
    if (!map[key]) map[key] = [];
    map[key].push(a);
  });
  const grupos = Object.keys(map).map((key) => {
    const items = map[key].slice().sort((a, b) => {
      const ta = a.fecha ? new Date(a.fecha).getTime() : 0;
      const tb = b.fecha ? new Date(b.fecha).getTime() : 0;
      return tb - ta;
    });
    return { expediente: key, actas: items };
  });
  grupos.sort((g1, g2) => {
    const t1 = g1.actas[0]?.fecha ? new Date(g1.actas[0].fecha).getTime() : 0;
    const t2 = g2.actas[0]?.fecha ? new Date(g2.actas[0].fecha).getTime() : 0;
    if (t2 !== t1) return t2 - t1;
    return g1.expediente.localeCompare(g2.expediente, 'es', { sensitivity: 'base' });
  });
  return grupos;
}
