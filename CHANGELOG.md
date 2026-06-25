# Historial de versiones

## 1.9.12

### Matafuegos — Entregar (pantallas chicas)
- Botón **Continuar** fijo al pie de la ventana en el paso 2; siempre visible aunque haya muchos matafuegos en el carrito.

### Matafuegos — Entregados
- En **Editar**, los administradores pueden cambiar el **destino de entrega** si se registró por error.

### Técnico
- Versión **1.9.12** (`package.json`).

---

## 1.9.11

### Matafuegos — Entregar (pantallas chicas)
- Botón **Continuar** fijo al pie del paso 2 (fuera del panel del carrito).
- Lista de seleccionados con scroll interno; ya no desaparece el botón con 3+ matafuegos.
- Modo ultra-compacto en monitores bajos (oculta franja superior y barra «Paso anterior»).

### Técnico
- Versión **1.9.11** (`package.json`).

---

## 1.9.10

### TXT — Orden con punto de miles
- El modal **ORDEN** acepta números con separador argentino (ej. **9.960** o **9960**).
- Se guarda el valor entero correcto (9960) en lugar de cortar en el punto.

### TXT — Agregar dependencia
- Corregido el guardado que quedaba trabado al crear dependencia nueva con división.
- Guardado en orden (primero dependencia, después divisiones) y recarga más rápida.

### Matafuegos — Entregar (pantallas chicas)
- Pestaña **Entregar** en modo compacto: oculta KPIs y banners para ganar espacio.
- Tabla y wizard con scroll interno; botón **Continuar** siempre visible en paso 2.
- Adaptado a monitores con poca altura (1366×768 y similares).

### Técnico
- Versión **1.9.10** (`package.json`).

---

## 1.9.9

### Matafuegos — Historial
- Filtros por **marca**, **capacidad (kg)** y **tipo de movimiento** (ingreso, salida, cambio de estado, editado, entrega, eliminado).
- Columna **Capacidad** en la tabla.
- Solo movimientos reales (sin registros internos de recarga).

### Matafuegos — Entregados
- Filtros por **marca** y **capacidad (kg)**.
- Columna **Usuario** (quién registró la entrega).
- Entregas nuevas guardan usuario y fecha; entregas antiguas sin auditoría muestran **—**.

### Matafuegos — Auditoría de entregas
- Historial ampliado (hasta 2000 registros) y mejor detección de movimientos de entrega.
- Usuario guardado en cada movimiento del historial.

### Técnico
- Versión **1.9.9** (`package.json`).

---

## 1.9.8

### Dependencias
- Los usuarios **no administradores** pueden **agregar dependencias** y **divisiones** (+ Agregar dependencia, + División).
- Editar, eliminar e importar estructura siguen reservados para administradores.
- Auditoría registra creación y edición de dependencias.

### Matafuegos — Entrega
- Wizard de entrega en pestaña **Entregar** (pantalla completa, estilo Guardia).
- Búsqueda de dependencias mejorada: `comisaria 1/2/3/4`, `Nº`, abreviaturas (`com 4`, `4ta`, etc.).
- Tabla de resultados con **scroll** cuando hay muchas coincidencias.

### Matafuegos — Para recarga
- Restaurados botones **En recarga (taller)** y **Listo** (nueva fecha de vencimiento → Disponibles).

### Matafuegos — KPIs
- Desglose por capacidad (**5 kg** / **10 kg**) en tarjetas Disponibles y Para recarga.

### Técnico
- Versión **1.9.8** (`package.json`).

---

## 1.9.6

### Matafuegos — Historial
- El movimiento genérico **Actualización** pasa a llamarse **Editado**.
- Nueva columna **Usuario** en el historial (quién registró cada movimiento).

### Matafuegos — Entrega
- Búsqueda de dependencias corregida: `comisaria 4` encuentra la comisaría correcta (ya no confunde con **ZONA 4**).
- Reconoce variantes: `4ta`, `cuarta`, `cria`, etc.
- Se puede **seleccionar haciendo clic en la fila**; botón **Seleccionar** fijo a la derecha.

### Matafuegos — Entregados
- Columna **Fecha de entrega** al registrar una entrega (entregas nuevas).
- SQL opcional en Supabase: `supabase-matafuegos-fecha-entrega.sql` (`fecha_entrega`).

### Técnico
- Versión **1.9.6** (`package.json`).

---

## 1.9.2

### Auto-actualización
- Corregido: la app React no buscaba actualizaciones en GitHub (faltaba el banner y la verificación al iniciar).
- Al abrir la app aparece el aviso si hay versión nueva en Releases.

---

## 1.9.1

### Interfaz React
- App con React: navegación fluida, sidebar fijo, transiciones entre módulos.
- Menú de usuario superior corregido (Configuración, Usuarios, Cerrar sesión).
- Panel Gestión de usuarios funcional (contraseña propia y admin).
- Diseño adaptable a pantallas pequeñas.

### Entregas, Inventario, modales
- Wizard de entregas; filtro de stock; layout compacto.
- Modal agregar producto en inventario rediseñado.
- Modales legacy posicionados correctamente (portal a body).

### Matafuegos
- Búsqueda general, formulario en ruta dedicada, series duplicadas.

### Técnico
- Versión **1.9.1** (`package.json`).

---

## 1.8.9

### TXT — Nuevo registro

- Pantalla **Nuevo registro** como pestaña a pantalla completa (ya no modal), con formulario compacto y tabla con más espacio.
- **Cantidad** = valor de cada fila; **Líneas repetidas** + botón **Agregar repetidas** para cargar N filas con orden correlativo (sin usar cantidad como contador de filas).
- Valores por defecto: repartición **250** y descripción **DPTO GENERAL DE POLICIA** (editables).
- Campo **Líneas repetidas** permite borrar y escribir otro número (ej. 5).

### TXT — Exportación Word

- Máximo **17 filas por hoja** con paginación (encabezado repetido, «Página X de Y»).
- Columna **NR** siempre muestra **1** en cada fila.
- Exportación respeta la cantidad de cada fila tal como está en la grilla.

### TXT — Realizados

- Si Supabase rechaza por **RLS**, guarda en **esta PC** y muestra éxito (sin error engañoso al pulsar **Finalizado**).
- SQL `supabase-txt-realizados.sql` actualizado (políticas `anon` / `authenticated`).

### Técnico

- Versión **1.8.9** (`package.json`, `package-lock.json`).

---

## 1.8.8

### Rendimiento

- Carga ligera en **Inventario**, **Entregas (guardia)**, **Inicio (dashboard)** y **Dependencias** (envíos): ya no esperan `getData()` completo.
- `get-guardia-provisiones` lee solo la tabla de provisiones.

### Matafuegos

- **Exportar Excel** del listado visible (pestaña actual + búsqueda y filtros).
- Avisos y confirmaciones con **modales propios** (`appDialog`) en lugar de `alert`/`confirm` nativos.
- Enlaces desde el dashboard: `matafuegos.html?mf=prox30` y `?mf=recarga`.

### Inicio (dashboard)

- Notificaciones con accesos directos a matafuegos por vencer y en recarga.

### Desarrollo

- Script **`npm run release`** → ejecuta `dist:win` (genera instalador en `dist/`).

### Técnico

- Versión **1.8.8**; IPC: `get-productos-data`, `get-guardia-data`, `get-dashboard-data`, `get-dependencias-stats-data`, `export-matafuegos-excel`.

---

## 1.8.7

### Matafuegos

- **Carga más rápida** al abrir la sección: solo trae matafuegos, dependencias, auditoría y estado de recarga (sin cargar inventario completo).
- **Filtros avanzados** en Recarga, Entregados e Inservibles (marca, vencimiento, rango de fechas, orden), igual que en Disponibles.
- Validación de **Nº de serie duplicado** reforzada; mensaje claro si Supabase rechaza por serie repetida.

### Base de datos / mantenimiento

- Script SQL `supabase-matafuegos-serie-unica.sql` (índice único en `numero_serie`; ejecutar cuando no haya duplicados).
- `scripts/README.md` con documentación de scripts de mantenimiento.

### Técnico

- Versión de aplicación **1.8.7** (`package.json`, `package-lock.json`).
- IPC `get-matafuegos-data` en `main.js` / `preload.js`.

---

## 1.8.6

### Depósito

- **Resumen por tipo**: tarjetas con contador por nombre/marca (estilo matafuegos); clic en una tarjeta filtra la tabla de unidades.
- Inventario de depósito independiente del expediente DEPOSITO (sincronización con Supabase `deposito_movimientos`).

### Matafuegos

- **Búsqueda inteligente** en todos los buscadores (global, pestañas y entrega): tolera errores de tipeo, dígitos faltantes o de más en el Nº de serie; sugerencias ordenadas por relevancia.
- **Entregados**: corrección del buscador que no permitía escribir tras registrar una entrega (foco en Electron tras `alert`).

### Actas

- Menú de acciones (⋮) en expedientes: ya no queda oculto detrás de la carpeta inferior; se posiciona hacia arriba si no hay espacio.

### Datos / mantenimiento

- Script para unificar dependencia **PRIVADA** duplicada (`scripts/unificar-dependencia-privada.js`).
- Scripts de migración depósito (`scripts/migrar-expediente-deposito.js`, `scripts/sync-deposito-local-a-supabase.js`).

### Técnico

- Versión de aplicación **1.8.6** (`package.json`, `package-lock.json`).
- Mejoras en `loading.js` (`appUiFocus.focusSearchInput`) para recuperar foco en barras de búsqueda tras diálogos nativos.

---

## 1.8.5

### Matafuegos

- Al agregar matafuego(s), si el **número de serie ya existe** se muestra un **modal** (no solo un aviso del sistema) indicando duplicado y **ubicación actual** (Disponibles, Para recarga, Entregados con dependencia, Inservibles). También al salir del campo de serie.
- **Entrega múltiple**: seleccionar varios matafuegos disponibles y entregarlos a una dependencia en un solo envío.
- **Alta masiva**: campo Cantidad y un input de Nº de serie por unidad; guardado en lote.
- Corrección: en el alta masiva se podía borrar el `1` de cantidad porque el formulario lo reescribía en cada tecla.
- Eliminado el botón y modal **"+ Agregar para recarga"** (los vencidos pasan solos a recarga al registrarlos).
- Eliminado el aviso superior **"Hay X matafuegos en recarga"** (el contador en la tarjeta sigue disponible).

### Técnico

- Versión de aplicación **1.8.5** (`package.json`, `package-lock.json`).

---

## 1.8.4

### Interfaz y Electron (Windows)

- Tras `alert` / `confirm` / `prompt` nativos, la ventana a veces dejaba de recibir clics y el foco en campos hasta minimizar: recuperación de foco desde el renderer (`loading.js`) y `webContents.focus()` al enfocar la ventana (`main.js`).
- Overlay de carga: al ocultarlo se fuerza `pointer-events: none` por si quedara interceptando eventos.
- El dashboard incluye `loading.js` para el mismo comportamiento y el loader global.

### Matafuegos

- Usuarios no administradores pueden guardar la edición cuando **solo cambia la fecha de vencimiento** (misma fila lógica); sigue requiriendo admin el resto de ediciones.

### Técnico

- Versión de aplicación **1.8.4** (`package.json`, `package-lock.json`).

---

## 1.8.3

### Dependencias

- Corrección: las dependencias nuevas con id `dep-{código}` (desde **+ Agregar dependencia**) ya no se ocultan en Gestión de dependencias, guardia ni matafuegos. Solo se excluyen por prefijo los duplicados históricos `txt-dep-`.
- Ajuste en `main.js` para normalización de nombres: mismo criterio de prefijo `txt-dep-`.

### Técnico

- Versión de aplicación **1.8.3** (`package.json`, `package-lock.json`).

---

## 1.8.2

### Matafuegos

- Vista de detalle en listas (tarjetas, pestañas y avisos) con botón **Volver al resumen**.
- Tablas sin scroll interno vertical; historial con paginación en el pie.
- Columna **Ubicación** eliminada en la pestaña Disponibles.
- Buscador por pestaña (Disponibles, Inservibles, Entregados, Historial), alineado con el comportamiento de Recarga.
- Usuarios no administradores pueden **entregar** matafuego desde Disponibles (solo esa transición, sin alterar identidad).
- Panel **Entregar matafuego** a pantalla completa con **Volver al panel**.
- Formulario de entrega en dos columnas: dependencias a la izquierda; búsqueda y tabla de disponibles a la derecha.
- Paginación: siempre muestra texto «Mostrando X–Y de Z» y controles (página única con botones laterales deshabilitados).
- Ajustes responsive en pestañas, tablas y pie de paginación.

### Técnico

- `package.json` / `package-lock.json`: versión **1.8.2** (Electron `app.getVersion()` y badge del sidebar).

---

## 1.8.1 y anteriores

Sin registro detallado en este repositorio; consultar commits anteriores en GitHub si hace falta.
