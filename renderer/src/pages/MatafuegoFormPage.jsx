import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLoading } from '../contexts/LoadingContext';
import { useToast } from '../contexts/ToastContext';
import { getStockAPI } from '../hooks/useStockAPI';
import { filterDepsForEntrega, getDisplayLabel } from '../utils/matafuegosEntregaHelpers';
import {
  buildMatafuegoCaracteristicas,
  formatFecha,
  isVencidoSinFecha,
  MF_KG_OPTIONS,
  parseKgFromCaracteristicas,
  validateMatafuegoSeriesForm,
  VENCIDO_SIN_FECHA
} from '../utils/matafuegosHelpers';
import '../theme/matafuegos-pro.css';

const EMPTY_FORM = {
  marca: '',
  cantidad: 1,
  series: [''],
  kg: '',
  caracteristicas: '',
  fechaVencimiento: '',
  sinFecha: false,
  dependenciaId: ''
};

function clampCantidad(n) {
  const v = parseInt(n, 10);
  if (Number.isNaN(v) || v < 1) return 1;
  return Math.min(v, 100);
}

export default function MatafuegoFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { show, hide } = useLoading();
  const { showToast } = useToast();

  const [form, setForm] = useState(EMPTY_FORM);
  const [loaded, setLoaded] = useState(!isEdit);
  const [seriesErrors, setSeriesErrors] = useState({});
  const [validationReport, setValidationReport] = useState([]);
  const [dependencias, setDependencias] = useState([]);
  const [editItem, setEditItem] = useState(null);
  const [depBuscar, setDepBuscar] = useState('');

  const load = useCallback(async () => {
    const api = getStockAPI();
    if (!api?.getMatafuegosData) return;
    show(isEdit ? 'Cargando matafuego…' : 'Preparando formulario…');
    try {
      const bundle = await api.getMatafuegosData();
      setDependencias(bundle.dependencias || []);
      if (!isEdit) {
        setLoaded(true);
        return;
      }
      const all = bundle.matafuegos || [];
      const item = all.find((m) => String(m.id) === String(id));
      if (!item) {
        showToast('Matafuego no encontrado', 'error');
        navigate('/matafuegos', { replace: true });
        return;
      }
      const { kg, rest } = parseKgFromCaracteristicas(item.caracteristicas);
      setEditItem(item);
      setForm({
        marca: item.marca || '',
        cantidad: 1,
        series: [item.numeroSerie || ''],
        kg,
        caracteristicas: rest,
        fechaVencimiento: isVencidoSinFecha(item.fechaVencimiento)
          ? ''
          : String(item.fechaVencimiento || '').slice(0, 10),
        sinFecha: isVencidoSinFecha(item.fechaVencimiento),
        dependenciaId: item.dependenciaId || ''
      });
      setLoaded(true);
    } catch (e) {
      showToast(e.message || 'Error al cargar', 'error');
      navigate('/matafuegos', { replace: true });
    } finally {
      hide();
    }
  }, [show, hide, showToast, isEdit, id, navigate]);

  useEffect(() => { load(); }, [load]);

  const cantidad = useMemo(() => clampCantidad(form.cantidad), [form.cantidad]);

  const isEntregadoEdit = Boolean(
    isEdit && editItem && (
      String(editItem.estado || '').toLowerCase() === 'entregado' || editItem.dependenciaId
    )
  );

  const depsFiltradas = useMemo(() => {
    const deps = filterDepsForEntrega(dependencias);
    const q = depBuscar.trim().toLowerCase();
    const list = !q
      ? deps
      : deps.filter((d) => {
        const label = getDisplayLabel(d, dependencias).toLowerCase();
        const nombre = String(d.nombre || '').toLowerCase();
        const codigo = String(d.codigo || '').toLowerCase();
        return label.includes(q) || nombre.includes(q) || codigo.includes(q);
      });
    return list.slice().sort((a, b) => {
      const la = getDisplayLabel(a, dependencias).toLowerCase();
      const lb = getDisplayLabel(b, dependencias).toLowerCase();
      return la.localeCompare(lb, 'es');
    });
  }, [dependencias, depBuscar]);

  useEffect(() => {
    if (isEdit) return;
    setForm((prev) => {
      const next = [...prev.series];
      while (next.length < cantidad) next.push('');
      while (next.length > cantidad) next.pop();
      return { ...prev, series: next, cantidad };
    });
  }, [cantidad, isEdit]);

  function updateSerie(index, value) {
    setForm((prev) => {
      const series = [...prev.series];
      series[index] = value;
      return { ...prev, series };
    });
    setSeriesErrors((prev) => {
      if (!prev[index]) return prev;
      const next = { ...prev };
      delete next[index];
      return next;
    });
    if (validationReport.length) setValidationReport([]);
  }

  function applySeriesValidationErrors(errors) {
    const byIndex = {};
    errors.forEach((err) => {
      byIndex[err.index] = err.message;
      if (err.type === 'form_duplicate' && err.duplicateWithIndex != null) {
        byIndex[err.duplicateWithIndex] = `Este valor se repite en el Nº de serie ${err.index + 1} ("${err.serie}").`;
      }
    });
    setSeriesErrors(byIndex);
    setValidationReport(errors);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const api = getStockAPI();
    if (!api?.saveMatafuego) return;

    if (!form.marca.trim()) {
      showToast('Indicá la marca', 'error');
      return;
    }
    if (!form.kg) {
      showToast('Seleccioná el peso (kg)', 'error');
      return;
    }
    if (!form.sinFecha && !form.fechaVencimiento) {
      showToast('Indicá la fecha de vencimiento o marcá "Vencido sin fecha"', 'error');
      return;
    }
    if (isEntregadoEdit && !form.dependenciaId) {
      showToast('Seleccioná el destino de entrega', 'error');
      return;
    }

    show('Guardando…');
    try {
      const bundle = await api.getMatafuegosData();
      const all = bundle.matafuegos || [];
      const seriesValidation = validateMatafuegoSeriesForm(form.series, all, id);
      if (seriesValidation.length) {
        applySeriesValidationErrors(seriesValidation);
        const n = seriesValidation.length;
        showToast(
          n === 1
            ? seriesValidation[0].message
            : `Hay ${n} números de serie con problema. Revisá el listado debajo de los campos.`,
          'error'
        );
        document.getElementById(`mf-serie-${seriesValidation[0].index}`)?.focus();
        document.getElementById(`mf-serie-${seriesValidation[0].index}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        return;
      }
      setSeriesErrors({});
      setValidationReport([]);

      const caracteristicasGuardar = buildMatafuegoCaracteristicas(form.kg, form.caracteristicas);
      const existing = isEdit ? all.find((m) => String(m.id) === String(id)) : null;

      const basePayload = {
        marca: form.marca.trim(),
        caracteristicas: caracteristicasGuardar || null,
        fechaVencimiento: form.sinFecha ? VENCIDO_SIN_FECHA : form.fechaVencimiento,
        estado: isEdit
          ? (existing?.estado || 'disponible')
          : 'disponible',
        fechaIngreso: isEdit
          ? (existing?.fechaIngreso || new Date().toISOString().slice(0, 10))
          : new Date().toISOString().slice(0, 10),
        dependenciaId: isEntregadoEdit
          ? (form.dependenciaId || null)
          : (isEdit ? (existing?.dependenciaId || null) : null),
        fechaEntrega: isEntregadoEdit ? (existing?.fechaEntrega || null) : undefined
      };

      if (isEdit) {
        await api.saveMatafuego({
          ...basePayload,
          id,
          numeroSerie: form.series[0].trim()
        });
        showToast('Matafuego actualizado');
      } else {
        const ts = Date.now();
        for (let i = 0; i < form.series.length; i++) {
          await api.saveMatafuego({
            ...basePayload,
            id: `${ts}-${i}`,
            numeroSerie: form.series[i].trim()
          });
        }
        showToast(form.series.length > 1
          ? `Se agregaron ${form.series.length} matafuegos`
          : 'Matafuego agregado');
      }
      navigate('/matafuegos');
    } catch (err) {
      showToast(err.message || 'Error al guardar', 'error');
    } finally {
      hide();
    }
  }

  if (!loaded) return null;

  return (
      <div className="mf-page mf-form-page">
        <header className="mf-form-hero">
          <div>
            <Link to="/matafuegos" className="mf-form-back">← Volver a Matafuegos</Link>
            <h1 className="mf-hero-title">{isEdit ? 'Editar matafuego' : 'Agregar nuevo matafuego'}</h1>
            <p className="mf-hero-sub">
              {isEdit
                ? (isEntregadoEdit
                  ? 'Modificá los datos del matafuego o corregí el destino donde fue entregado.'
                  : 'Modificá los datos del matafuego seleccionado.')
                : 'Completá los datos requeridos para registrar uno o varios matafuegos en disponibles.'}
            </p>
          </div>
        </header>

        <div className="mf-form-card">
          <form className="mf-form" onSubmit={handleSubmit}>
            <div className="mf-form-grid mf-form-grid--2">
              <div className="form-group">
                <label htmlFor="mf-marca">Marca *</label>
                <input
                  id="mf-marca"
                  type="text"
                  required
                  placeholder="Ej: Metalúrgica"
                  value={form.marca}
                  onChange={(e) => setForm({ ...form, marca: e.target.value })}
                />
              </div>
              {!isEdit && (
                <div className="form-group">
                  <label htmlFor="mf-cantidad">Cantidad *</label>
                  <input
                    id="mf-cantidad"
                    type="number"
                    min={1}
                    max={100}
                    required
                    value={form.cantidad}
                    onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
                  />
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Nº de serie *</label>
              <p className="mf-form-hint">
                {isEdit || cantidad === 1
                  ? 'Si el número ya existe en el sistema, el guardado te avisará.'
                  : `Completá el número de serie de cada unidad (${cantidad} campos).`}
              </p>
              {validationReport.length > 0 && (
                <div className="mf-series-report" role="alert">
                  <p className="mf-series-report-title">Números de serie con problema</p>
                  <ul className="mf-series-report-list">
                    {validationReport.map((err, i) => (
                      <li key={`${err.index}-${err.type}-${i}`}>{err.message}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mf-series-grid">
                {form.series.map((serie, idx) => (
                  <div key={idx} className="form-group mf-series-item">
                    <label htmlFor={`mf-serie-${idx}`}>
                      {form.series.length > 1 ? `Nº de serie ${idx + 1}` : 'Nº de serie'}
                    </label>
                    <input
                      id={`mf-serie-${idx}`}
                      type="text"
                      required
                      placeholder={`Ej: ${idx + 1}`}
                      value={serie}
                      className={seriesErrors[idx] ? 'mf-input-error' : undefined}
                      aria-invalid={seriesErrors[idx] ? 'true' : undefined}
                      aria-describedby={seriesErrors[idx] ? `mf-serie-err-${idx}` : undefined}
                      onChange={(e) => updateSerie(idx, e.target.value)}
                      disabled={isEdit && idx > 0}
                    />
                    {seriesErrors[idx] && (
                      <p id={`mf-serie-err-${idx}`} className="mf-field-error">{seriesErrors[idx]}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="mf-form-grid mf-form-grid--2">
              <div className="form-group">
                <label htmlFor="mf-kg">Kg *</label>
                <select
                  id="mf-kg"
                  required
                  value={form.kg}
                  onChange={(e) => setForm({ ...form, kg: e.target.value })}
                >
                  <option value="">Seleccionar…</option>
                  {MF_KG_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="mf-caracteristicas">Características <span className="mf-label-optional">(opcional)</span></label>
                <input
                  id="mf-caracteristicas"
                  type="text"
                  placeholder="Ej: polvo ABC, CO2"
                  value={form.caracteristicas}
                  onChange={(e) => setForm({ ...form, caracteristicas: e.target.value })}
                />
              </div>
            </div>

            <div className="mf-form-grid mf-form-grid--2">
              <div className="form-group">
                <label htmlFor="mf-vencimiento">Fecha de vencimiento {!form.sinFecha && '*'}</label>
                <input
                  id="mf-vencimiento"
                  type="date"
                  required={!form.sinFecha}
                  disabled={form.sinFecha}
                  value={form.fechaVencimiento}
                  onChange={(e) => setForm({ ...form, fechaVencimiento: e.target.value })}
                />
              </div>
              <div className="form-group mf-form-check">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={form.sinFecha}
                    onChange={(e) => setForm({ ...form, sinFecha: e.target.checked })}
                  />
                  {' '}Vencido sin fecha
                </label>
              </div>
            </div>

            {isEntregadoEdit && (
              <section className="mf-form-section mf-form-section--destino" aria-labelledby="mf-destino-title">
                <h3 id="mf-destino-title" className="mf-form-section-title">Destino de entrega</h3>
                <p className="mf-form-hint">
                  Si se entregó en la dependencia equivocada, elegí el destino correcto. La fecha de entrega se mantiene.
                </p>
                {editItem?.fechaEntrega && (
                  <p className="mf-form-destino-meta">
                    Fecha de entrega actual: <strong>{formatFecha(editItem.fechaEntrega)}</strong>
                  </p>
                )}
                <div className="form-group">
                  <label htmlFor="mf-dep-buscar">Buscar dependencia</label>
                  <input
                    id="mf-dep-buscar"
                    type="search"
                    placeholder="Nombre, código, comisaría…"
                    value={depBuscar}
                    onChange={(e) => setDepBuscar(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="mf-dependencia">Dependencia destino *</label>
                  <select
                    id="mf-dependencia"
                    required
                    value={form.dependenciaId}
                    onChange={(e) => setForm({ ...form, dependenciaId: e.target.value })}
                  >
                    <option value="">— Seleccionar dependencia —</option>
                    {depsFiltradas.map((d) => {
                      const label = getDisplayLabel(d, dependencias);
                      return (
                        <option key={d.id} value={d.id}>
                          {label !== '—' ? label : (d.nombre || d.codigo || d.id)}
                        </option>
                      );
                    })}
                  </select>
                  {depBuscar && depsFiltradas.length === 0 && (
                    <p className="mf-form-hint">Ninguna dependencia coincide con la búsqueda.</p>
                  )}
                </div>
              </section>
            )}

            <div className="mf-form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => navigate('/matafuegos')}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary">
                {isEdit
                  ? 'Guardar cambios'
                  : (cantidad > 1 ? `Guardar ${cantidad} matafuegos` : 'Guardar matafuego')}
              </button>
            </div>
          </form>
        </div>
      </div>
  );
}
