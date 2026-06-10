# Control de Stock - Empresa

Aplicación de escritorio con **Electron** para controlar el stock: todo lo que **entra** y **sale** del inventario.

## Requisitos

- Node.js (v16 o superior)
- npm

## Instalación

1. Abre una terminal en la carpeta del proyecto:
   ```bash
   cd control-stock
   ```

2. Instala las dependencias:
   ```bash
   npm install
   ```

3. Inicia la aplicación:
   ```bash
   npm start
   ```

## Uso

- **Productos**: Crea y edita productos (código, nombre, descripción, stock inicial, unidad).
- **Entrada**: Registra ingresos de stock (compra, devolución, etc.).
- **Salida**: Registra salidas de stock (venta, consumo, etc.).
- **Historial**: Consulta todos los movimientos con fecha, tipo, producto, cantidad y concepto.

Los datos se guardan automáticamente en tu equipo (en la carpeta de datos de usuario de Electron).

## Tecnologías

- Electron
- JavaScript (vanilla)
- HTML5
- CSS3
