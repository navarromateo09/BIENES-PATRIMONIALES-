# Subida manual a GitHub — versión **v1.8.4**

Repositorio: `https://github.com/navarromateo09/BIENES-PATRIMONIALES-.git`

## 1. Versión en el proyecto

- `package.json` → `"version": "1.8.4"` (la app muestra **v1.8.4** vía `getAppVersion` / `sidebar-version.js`).
- `package-lock.json` → misma versión en el bloque raíz (`name` + `packages[""]`).

## 2. Subir el código (manual)

1. En GitHub → tu repo → **Add file** → **Upload files** (o Git en tu máquina).
2. Subí los archivos de **`stock respaldo`** que correspondan a esta release, **sin** `node_modules` ni `dist` si no querés peso en el historial.
3. Mensaje de commit sugerido: `Release v1.8.4 — foco Electron tras diálogos, matafuegos solo vencimiento, dashboard loading`.

## 3. Tag de versión (recomendado)

**Releases** → **Draft a new release**

- **Tag**: `v1.8.4`
- **Title**: `v1.8.4`
- **Description**: pegá el contenido de `release/v1.8.4/NOTAS_RELEASE_GITHUB.txt`.

## 4. Instalador (generado en tu PC)

En la carpeta `stock respaldo`:

```bash
npm run dist:win
```

Salida en **`stock respaldo/dist/`**:

| Archivo | Uso |
|---------|-----|
| `Bienes.y.Patrimoniales.Setup.1.8.4.exe` | Instalador NSIS (asset del Release). |
| `Bienes.y.Patrimoniales.Setup.1.8.4.exe.blockmap` | Actualizaciones delta (electron-updater). |
| `latest.yml` | Metadatos de la última versión para auto-actualización. |

El **`.exe`** conviene adjuntarlo solo al **Release**, no obligatorio en el repo Git.

## 5. Archivos clave en v1.8.4 (referencia)

- `package.json`, `package-lock.json`, `CHANGELOG.md`
- `main.js` (foco al `focus` de ventana; permiso `save-matafuego` solo cambio de vencimiento)
- `loading.js` (parche `alert`/`confirm`/`prompt`, overlay)
- `dashboard.html` (script `loading.js`)
- `release/v1.8.4/MANUAL_SUBIDA_GITHUB.md`, `release/v1.8.4/NOTAS_RELEASE_GITHUB.txt`

---

*Generado para carga manual en GitHub — v1.8.4*
