# Subir v1.9.4 a GitHub

## 1. Subir el código (GitHub Desktop)

1. Abrí **GitHub Desktop**
2. **File → Add local repository**
3. Elegí esta carpeta: `C:\Users\USUARIO\Desktop\RESPALDO PROGRAMA\_gh_clone`
4. Deberías ver el commit: **v1.9.4: migracion completa a React y mejoras de UI**
5. Clic en **Push origin**

(Si GitHub Desktop pide iniciar sesión, usá tu cuenta `navarromateo09`.)

---

## 2. Actualizar el instalador en Releases (auto-actualización)

Ya existe el release **1.9.4**, pero hay un instalador **más nuevo** (con todos los fixes de React).

Abrí: https://github.com/navarromateo09/BIENES-PATRIMONIALES-/releases/tag/1.9.4

1. Clic en **Edit release** (lápiz)
2. En **Release notes**, pegá el contenido de `release/v1.9.4/NOTAS_RELEASE_GITHUB.txt`
3. **Eliminá** los 3 archivos viejos del release:
   - `Bienes.y.Patrimoniales.Setup.1.9.4.exe`
   - `Bienes.y.Patrimoniales.Setup.1.9.4.exe.blockmap`
   - `latest.yml`
4. **Arrastrá** estos 3 archivos nuevos desde `release\`:

```
release\Bienes.y.Patrimoniales.Setup.1.9.4.exe
release\Bienes.y.Patrimoniales.Setup.1.9.4.exe.blockmap
release\latest.yml
```

5. **Update release**

---

## Verificación

- Código en: https://github.com/navarromateo09/BIENES-PATRIMONIALES-
- Instalador nuevo: ~91,9 MB (91867875 bytes)
- Instalador viejo en GitHub: ~91,8 MB (91827496 bytes) — reemplazarlo

Las PCs con la app instalada detectarán la actualización al abrir el menú de usuario → Buscar actualizaciones.
