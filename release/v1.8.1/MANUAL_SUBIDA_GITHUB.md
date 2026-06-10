# Subida manual a GitHub — versión **v1.8.1**

Repositorio: `https://github.com/navarromateo09/BIENES-PATRIMONIALES-.git`

## 1. Versión en el proyecto

- `package.json` → `"version": "1.8.1"` (la app muestra **v1.8.1** vía `getAppVersion` / `sidebar-version.js`).

## 2. Subir el código (manual)

1. Entrá a GitHub → tu repo → **Add file** → **Upload files** (o subí los cambios con Git).
2. Subí los archivos de **`stock respaldo`** que hayas modificado, **sin** `node_modules` ni `dist` si no querés peso innecesario en el repo.
3. Mensaje de commit sugerido: `Release v1.8.1 — TXT referencia, layout, matafuegos scroll`.

## 3. Tag de versión (recomendado)

En la web de GitHub: **Releases** → **Draft a new release**

- **Tag**: `v1.8.1`
- **Title**: `v1.8.1`
- **Description**: pegá el contenido de `NOTAS_RELEASE_GITHUB.txt` (mismo directorio).

## 4. Instalador (generado)

Después de ejecutar `npm run dist:win` en la carpeta `stock respaldo`, los archivos quedan en:

**`stock respaldo/dist/`**

| Archivo | Uso |
|---------|-----|
| `Bienes.y.Patrimoniales.Setup.1.8.1.exe` | Instalador NSIS (subilo como asset del Release). |
| `Bienes.y.Patrimoniales.Setup.1.8.1.exe.blockmap` | Para actualizaciones delta (electron-updater). |
| `latest.yml` | Metadatos de la última versión para auto-actualización. |

**No hace falta subir el `.exe` al historial Git del repo** (solo al **Release** como archivo adjunto).

## 5. Archivos clave en esta versión (referencia)

- `package.json`, `package-lock.json`
- `main.js` (export TXT: columnas, marca col. 164, formato valor referencia)
- `txt.js`, `txt.html` (límites de digitación TXT)
- `styles.css`, `matafuegos.js` (scroll / vistas en pantallas chicas)

---

*Generado para carga manual en GitHub — v1.8.1*
