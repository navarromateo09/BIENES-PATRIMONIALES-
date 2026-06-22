# Subir v1.9.6 a GitHub

## 1. Subir el código

Desde la carpeta clon de Git (`_gh_clone`) o GitHub Desktop:

1. Copiá / sincronizá los archivos de `stock respaldo` al repositorio.
2. Commit sugerido: **v1.9.6: historial matafuegos, búsqueda entrega y fecha de entrega**
3. **Push origin**

---

## 2. Crear Release en GitHub

Abrí: https://github.com/navarromateo09/BIENES-PATRIMONIALES-/releases/new

1. **Tag:** `1.9.6`
2. **Title:** `v1.9.6`
3. **Release notes:** pegá el contenido de `release/v1.9.6/NOTAS_RELEASE_GITHUB.txt`
4. Arrastrá estos 3 archivos desde `release\`:

```
release\Bienes.y.Patrimoniales.Setup.1.9.6.exe
release\Bienes.y.Patrimoniales.Setup.1.9.6.exe.blockmap
release\latest.yml
```

5. **Publish release**

---

## 3. Generar el instalador (si aún no lo hiciste)

En `stock respaldo`, doble clic en `ACTUALIZAR-EJECUTABLE.bat` o:

```bash
npm run dist:win
```

---

## Verificación

- Login muestra **v1.9.6**
- Matafuegos → Historial: columna Usuario y movimiento **Editado**
- Entregar matafuegos → buscar `comisaria 4` y seleccionar con clic en la fila
