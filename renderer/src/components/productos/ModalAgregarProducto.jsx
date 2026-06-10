import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  generarSeriesAutomaticas,
  normalizarCodigoSerie,
  toLocalDatetimeValue
} from '../../utils/productosHelpers';

function ModalShell({ open, onClose, children }) {
  if (!open) return null;
  return createPortal(
    <div
      className="modal open modal-tema-clara modal-inventario-add"
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-content modal-content-wide modal-inventario-add-content">
        {children}
      </div>
    </div>,
    document.body
  );
}

const emptyForm = () => ({
  expedienteId: '',
  nuevoExpediente: '',
  nombre: '',
  marca: '',
  cantidad: '1',
  series: [''],
  descripcion: '',
  fecha: toLocalDatetimeValue(new Date().toISOString()),
  generarCodigo: true,
  imprimirEtiquetas: true
});

export default function ModalAgregarProducto({
  open,
  onClose,
  productos,
  movimientos,
  onSubmit,
  submitting
}) {
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (!open) return;
    const initial = emptyForm();
    initial.series = generarSeriesAutomaticas(1, movimientos, false, ['']);
    setForm(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir
  }, [open]);

  const esNuevoExpediente = !form.expedienteId;
  const cantidad = Math.min(100, Math.max(1, parseInt(form.cantidad, 10) || 1));

  useEffect(() => {
    if (!open) return;
    setForm((f) => {
      const n = Math.min(100, Math.max(1, parseInt(f.cantidad, 10) || 1));
      const series = [...f.series];
      while (series.length < n) series.push('');
      while (series.length > n) series.pop();
      return { ...f, series };
    });
  }, [form.cantidad, open]);

  function updateSeries(idx, value) {
    setForm((f) => {
      const series = [...f.series];
      series[idx] = value;
      return { ...f, series };
    });
  }

  function handleGenerarCodigos() {
    setForm((f) => ({
      ...f,
      series: generarSeriesAutomaticas(cantidad, movimientos, true, f.series)
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    let series = [...form.series];
    if (form.generarCodigo) {
      series = generarSeriesAutomaticas(cantidad, movimientos, false, series);
    }
    await onSubmit({
      expedienteId: form.expedienteId.trim(),
      nuevoExpediente: form.nuevoExpediente.trim(),
      nombre: form.nombre.trim(),
      marca: form.marca.trim(),
      cantidad,
      series: series.map((s) => normalizarCodigoSerie(s)),
      descripcion: form.descripcion.trim(),
      fecha: form.fecha,
      imprimirEtiquetas: form.imprimirEtiquetas
    });
  }

  return (
    <ModalShell open={open} onClose={onClose}>
      <div className="modal-header modal-inventario-add-header">
        <div>
          <h3>Agregar producto al inventario</h3>
          <p className="modal-inventario-add-sub">Completá los datos del producto y su expediente de destino.</p>
        </div>
        <button type="button" className="modal-close" aria-label="Cerrar" onClick={onClose}>&times;</button>
      </div>
      <form className="modal-inventario-add-form" onSubmit={handleSubmit}>
        <div className="modal-inventario-add-scroll">
          <section className="modal-form-section">
            <h4 className="modal-form-section-title">Expediente</h4>
            <div className="form-row form-row-2 modal-inventario-exp-row">
              <div className="form-group">
                <label htmlFor="agregar-producto-expediente">Seleccionar expediente</label>
                <select
                  id="agregar-producto-expediente"
                  value={form.expedienteId}
                  onChange={(e) => setForm((f) => ({ ...f, expedienteId: e.target.value }))}
                >
                  <option value="">— Crear nuevo expediente —</option>
                  {(productos || []).filter((p) => p?.id != null && String(p.id).trim() !== '').map((p) => {
                    const label = [p.codigo, p.nombre].filter(Boolean).join(' - ') || p.nombre || p.codigo || p.id;
                    return <option key={p.id} value={p.id}>{label}</option>;
                  })}
                </select>
              </div>
              {esNuevoExpediente && (
                <div className="form-group wrap-nuevo-expediente">
                  <label htmlFor="agregar-producto-nuevo-expediente-numero">Nº o nombre del nuevo expediente</label>
                  <input
                    id="agregar-producto-nuevo-expediente-numero"
                    type="text"
                    placeholder="Ej: 211/200"
                    required={esNuevoExpediente}
                    value={form.nuevoExpediente}
                    onChange={(e) => setForm((f) => ({ ...f, nuevoExpediente: e.target.value }))}
                  />
                  <small className="form-hint">Solo si creás un expediente nuevo.</small>
                </div>
              )}
            </div>
          </section>

          <section className="modal-form-section">
            <h4 className="modal-form-section-title">Producto</h4>
            <div className="form-row form-row-3 modal-inventario-producto-row">
              <div className="form-group">
                <label htmlFor="agregar-producto-nombre">Nombre / Tipo</label>
                <input
                  id="agregar-producto-nombre"
                  type="text"
                  required
                  placeholder="Nombre del producto"
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label htmlFor="agregar-producto-marca">Marca</label>
                <input
                  id="agregar-producto-marca"
                  type="text"
                  placeholder="Ej: Samsung, HP"
                  value={form.marca}
                  onChange={(e) => setForm((f) => ({ ...f, marca: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label htmlFor="agregar-producto-cantidad">Cantidad</label>
                <input
                  id="agregar-producto-cantidad"
                  type="number"
                  min={1}
                  max={100}
                  required
                  value={form.cantidad}
                  onChange={(e) => setForm((f) => ({ ...f, cantidad: e.target.value }))}
                />
              </div>
            </div>
          </section>

          <section className="modal-form-section">
            <h4 className="modal-form-section-title">
              Nº de serie <span className="text-muted">(opcional)</span>
            </h4>
            <p className="form-hint modal-inventario-series-hint">
              Un casillero por unidad. Si quedan vacíos, se numeran automáticamente.
            </p>
            <div className="modal-inventario-series-tools">
              <label className="modal-inventario-check">
                <input
                  type="checkbox"
                  checked={form.generarCodigo}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setForm((f) => {
                      const n = Math.min(100, Math.max(1, parseInt(f.cantidad, 10) || 1));
                      return {
                        ...f,
                        generarCodigo: checked,
                        series: checked ? generarSeriesAutomaticas(n, movimientos, false, f.series) : f.series
                      };
                    });
                  }}
                />
                Generar código único en vacíos
              </label>
              <button type="button" className="btn btn-secondary btn-sm" onClick={handleGenerarCodigos}>
                Generar códigos
              </button>
            </div>
            <div className="series-inputs-container modal-inventario-series-box">
              {form.series.map((serie, i) => (
                <div key={i} className="form-group form-group-inline-serie">
                  <label htmlFor={`agregar-producto-serie-${i}`}>{`Nº de serie ${i + 1}:`}</label>
                  <input
                    id={`agregar-producto-serie-${i}`}
                    type="text"
                    placeholder="Opcional"
                    autoComplete="off"
                    value={serie}
                    onChange={(e) => updateSeries(i, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="modal-form-section modal-form-section-last">
            <div className="form-row form-row-2">
              <div className="form-group">
                <label htmlFor="agregar-producto-fecha">Fecha</label>
                <input
                  id="agregar-producto-fecha"
                  type="datetime-local"
                  value={form.fecha}
                  onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label htmlFor="agregar-producto-descripcion">Descripción / Concepto</label>
                <input
                  id="agregar-producto-descripcion"
                  type="text"
                  placeholder="Ej: Recepción por compra"
                  value={form.descripcion}
                  onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                />
              </div>
            </div>
          </section>
        </div>
        <div className="modal-actions modal-inventario-add-actions">
          <label className="modal-inventario-check modal-inventario-check-footer">
            <input
              type="checkbox"
              checked={form.imprimirEtiquetas}
              onChange={(e) => setForm((f) => ({ ...f, imprimirEtiquetas: e.target.checked }))}
            />
            Imprimir etiquetas al guardar
          </label>
          <div className="modal-inventario-add-btns">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      </form>
    </ModalShell>
  );
}
