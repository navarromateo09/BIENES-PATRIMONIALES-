import { useEffect, useState } from 'react';
import { defaultVencimientoPostRecarga, minFechaMananaIso } from '../../utils/matafuegosHelpers';

export default function MatafuegoRecargaListoModal({ matafuego, onClose, onConfirm }) {
  const [fecha, setFecha] = useState('');

  useEffect(() => {
    if (matafuego) setFecha(defaultVencimientoPostRecarga(matafuego));
  }, [matafuego]);

  if (!matafuego) return null;

  const label = [matafuego.marca, matafuego.numeroSerie].filter(Boolean).join(' · ') || 'Matafuego';

  function handleSubmit(e) {
    e.preventDefault();
    if (!fecha) return;
    onConfirm(fecha.slice(0, 10));
  }

  return (
    <div className="modal open mf-recarga-listo-modal" role="dialog" aria-modal="true" aria-labelledby="mf-recarga-listo-title">
      <div className="modal-content modal-tema-clara" style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <h3 id="mf-recarga-listo-title">Recarga terminada</h3>
          <button type="button" className="modal-close" aria-label="Cerrar" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <p className="panel-desc" style={{ marginTop: 0 }}>
            Tras la recarga, indicá la nueva fecha de vencimiento para pasar el matafuego a <strong>Disponibles</strong>.
            <br />
            <strong>{label}</strong>
          </p>
          <div className="form-group">
            <label htmlFor="mf-recarga-listo-fecha">Nueva fecha de vencimiento</label>
            <input
              id="mf-recarga-listo-fecha"
              type="date"
              required
              min={minFechaMananaIso()}
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>
          <div className="modal-footer" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary">Pasar a disponible</button>
          </div>
        </form>
      </div>
    </div>
  );
}
