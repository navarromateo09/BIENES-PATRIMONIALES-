import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '../contexts/ToastContext';
import { getStockAPI } from '../hooks/useStockAPI';

function formatPercent(p) {
  if (p == null || Number.isNaN(p)) return '';
  return `${Math.max(0, Math.min(100, Math.round(p)))}%`;
}

export default function UpdateBanner() {
  const { showToast } = useToast();
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState('Actualización');
  const [message, setMessage] = useState('—');
  const [actionLabel, setActionLabel] = useState('Actualizar');
  const [actionDisabled, setActionDisabled] = useState(false);
  const [status, setStatus] = useState('idle');
  const manualCheckRef = useRef(false);

  const handleStatus = useCallback((payload) => {
    if (!payload?.status) return;
    setStatus(payload.status);

    if (payload.status === 'checking') {
      setVisible(true);
      setTitle('Buscando actualización…');
      setMessage('Verificando si hay una versión nueva en GitHub');
      setActionLabel('Esperar');
      setActionDisabled(true);
      return;
    }
    if (payload.status === 'available') {
      const ver = payload.info?.version || payload.info?.releaseName;
      setVisible(true);
      setTitle('Actualización disponible');
      setMessage(ver ? `Nueva versión: ${ver}` : 'Hay una versión nueva para instalar');
      setActionLabel('Descargar');
      setActionDisabled(false);
      manualCheckRef.current = false;
      return;
    }
    if (payload.status === 'not-available') {
      if (manualCheckRef.current) {
        const cur = payload.info?.version || payload.currentVersion;
        showToast(cur ? `Ya tenés la última versión (${cur})` : 'Ya tenés la última versión', 'success');
      }
      manualCheckRef.current = false;
      setVisible(false);
      return;
    }
    if (payload.status === 'progress') {
      setVisible(true);
      setTitle('Descargando actualización…');
      setMessage(`Progreso: ${formatPercent(payload.progress)}`);
      setActionLabel('Descargando…');
      setActionDisabled(true);
      return;
    }
    if (payload.status === 'downloaded') {
      setVisible(true);
      setTitle('Actualización lista');
      setMessage('Se descargó la actualización. Presioná Instalar para reiniciar.');
      setActionLabel('Instalar');
      setActionDisabled(false);
      return;
    }
    if (payload.status === 'error') {
      setVisible(true);
      setTitle('No se pudo actualizar');
      setMessage(payload.error ? String(payload.error) : 'Error desconocido');
      setActionLabel('Reintentar');
      setActionDisabled(false);
      if (manualCheckRef.current) {
        showToast(payload.error ? String(payload.error) : 'Error al buscar actualización', 'error');
      }
      manualCheckRef.current = false;
    }
  }, [showToast]);

  useEffect(() => {
    const api = getStockAPI();
    if (!api?.onUpdateStatus) return undefined;

    const unsub = api.onUpdateStatus(handleStatus);

    api.getLastUpdateStatus?.().then((snap) => {
      if (snap?.status) {
        handleStatus({
          ...snap.status,
          currentVersion: snap.currentVersion
        });
      }
    }).catch(() => {});

    const onManualCheck = async () => {
      manualCheckRef.current = true;
      try {
        const res = await api.checkForUpdates?.();
        if (res?.ok === false && res?.error) {
          handleStatus({ status: 'error', error: res.error });
        }
      } catch {
        handleStatus({ status: 'error', error: 'No se pudo verificar actualizaciones' });
      }
    };
    window.addEventListener('app-request-update-check', onManualCheck);

    return () => {
      if (typeof unsub === 'function') unsub();
      window.removeEventListener('app-request-update-check', onManualCheck);
    };
  }, [handleStatus]);

  async function onAction() {
    const api = getStockAPI();
    if (!api) return;
    setActionDisabled(true);
    try {
      if (status === 'available') {
        await api.downloadUpdate?.();
      } else if (status === 'downloaded') {
        await api.installUpdate?.();
      } else if (status === 'error') {
        manualCheckRef.current = true;
        await api.checkForUpdates?.();
      }
    } catch {
      setActionDisabled(false);
    }
  }

  if (!visible) return null;

  return (
    <div id="update-banner" className="update-banner update-banner--react" role="status" aria-live="polite">
      <div className="update-banner-inner">
        <div className="update-banner-text">
          <strong id="update-banner-title">{title}</strong>
          <span id="update-banner-msg">{message}</span>
        </div>
        <div className="update-banner-actions">
          <button
            type="button"
            id="update-banner-btn-accion"
            className="btn btn-primary btn-sm"
            disabled={actionDisabled}
            onClick={onAction}
          >
            {actionLabel}
          </button>
          <button
            type="button"
            id="update-banner-btn-cerrar"
            className="btn btn-secondary btn-sm"
            onClick={() => setVisible(false)}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
