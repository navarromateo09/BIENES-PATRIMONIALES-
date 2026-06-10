# Subida manual a GitHub — versión **v1.8.0**

Repositorio: `https://github.com/navarromateo09/BIENES-PATRIMONIALES-.git`

## 1. Versión en el proyecto

- `package.json` → `"version": "1.8.0"` (la app muestra **v1.8.0** vía `getAppVersion` / `sidebar-version.js`).

## 2. Subir el código (manual)

1. Entrá a GitHub → tu repo → **Add file** → **Upload files** (o editá archivos sueltos).
2. Subí la carpeta **`stock respaldo`** (o los archivos que hayas tocado), **sin** `node_modules` si no querés peso innecesario.
3. Mensaje de commit sugerido: `Release v1.8.0 — matafuegos, historial, sync recargando`.

## 3. Tag de versión (recomendado)

En la web de GitHub: **Releases** → **Draft a new release**  
- **Tag**: `v1.8.0`  
- **Title**: `v1.8.0`  
- **Description**: pegá el contenido de `NOTAS_RELEASE_GITHUB.txt` (mismo directorio).

## 4. Instalador (generado)

Después de ejecutar `npm run dist:win` en la carpeta `stock respaldo`, los archivos quedan en:

**`stock respaldo/dist/`**

| Archivo | Uso |
|---------|-----|
| `Bienes.y.Patrimoniales.Setup.1.8.0.exe` | Instalador NSIS (subilo como asset del Release). |
| `Bienes.y.Patrimoniales.Setup.1.8.0.exe.blockmap` | Para actualizaciones delta (electron-updater). |
| `latest.yml` | Metadatos de la última versión para auto-actualización. |

**No hace falta subir el `.exe` al repositorio Git** (solo al **Release** como archivo adjunto, o dejarlo en un disco compartido).

## 5. Archivos clave tocados en esta versión (referencia)

- `package.json`
- `main.js`
- `preload.js`
- `matafuegos.html`
- `matafuegos.js`

---

*Generado para carga manual en GitHub — v1.8.0*
