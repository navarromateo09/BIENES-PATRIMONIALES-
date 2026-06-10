# Paso a paso: Roles de usuario (Usuario, Oficina, Admin y Pendiente)

## 1. Base de datos en Supabase

### Si es instalación nueva
1. Abrí el proyecto en [Supabase](https://supabase.com) y entrá al **SQL Editor**.
2. Ejecutá el script que ya tenés: **supabase-usuarios.sql** o **supabase-completo.sql**.
3. La tabla `usuarios` quedará con los roles: `admin`, `usuario`, `oficina` y `pendiente`.

### Si ya tenés la tabla `usuarios` creada (solo con admin y usuario)
1. En Supabase, abrí **SQL Editor** → **New query**.
2. Pegá y ejecutá:

```sql
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check CHECK (rol IN ('admin', 'usuario', 'oficina', 'pendiente'));
```

3. Con eso la base ya acepta también el rol `pendiente`.

---

## 2. Asignar rol a un usuario existente

1. En Supabase: **SQL Editor** → **New query**.
2. Para poner a alguien como **oficina**:

```sql
UPDATE usuarios SET rol = 'oficina' WHERE username = 'nombre_de_usuario';
```

3. Para poner a alguien como **admin**:

```sql
UPDATE usuarios SET rol = 'admin' WHERE username = 'nombre_de_usuario';
```

4. Reemplazá `nombre_de_usuario` por el usuario real (ej: `'juan'`, `'maria'`).
5. Hacé clic en **Run**.

---

## 3. Crear un usuario nuevo con rol Oficina o Admin

1. En Supabase: **SQL Editor** → **New query**.
2. Para crear un usuario con rol **oficina** (ejemplo: usuario `oficina1`, contraseña `miClave123`):

   - Primero generá el hash de la contraseña. En Node (en la carpeta del proyecto) podés ejecutar en la consola:

   ```bash
   node -e "console.log(require('crypto').createHash('sha256').update('miClave123','utf8').digest('hex'))"
   ```

   - Copiá el resultado (el hash en hexadecimal).
   - En Supabase ejecutá (reemplazá `HASH_AQUI` por ese hash):

   ```sql
   INSERT INTO usuarios (id, username, password_hash, rol)
   VALUES (gen_random_uuid()::text, 'oficina1', 'HASH_AQUI', 'oficina');
   ```

3. Para crear un **admin** nuevo, cambiá `'oficina'` por `'admin'` en el `INSERT`.

---

## 4. Cómo funciona en la aplicación

### Al iniciar sesión
1. El usuario ingresa con su **usuario** y **contraseña**.
2. La app consulta en Supabase y guarda en sesión: **usuario** y **rol** (admin, oficina o usuario).
3. Según el rol, la interfaz se adapta.

### Qué ve cada rol
- **Admin**: ve todo el menú, incluido **Configuración** (gestión de usuarios / cambiar contraseña).
- **Oficina**: ve todo el menú **excepto** el enlace a **Configuración**.
- **Usuario**: igual que Oficina, no ve **Configuración**.

### Dónde se muestra el rol
- En el **Dashboard**, en la esquina superior (header) se muestra: *"Nombre (Admin)"*, *"Nombre (Oficina)"* o *"Nombre (Usuario)"*.

---

## 5. Resumen rápido

| Paso | Acción |
|------|--------|
| 1 | En Supabase: ejecutar SQL para tener los 3 roles (o el `ALTER` si la tabla ya existía). |
| 2 | Asignar rol con `UPDATE usuarios SET rol = 'oficina' WHERE username = '...';` (o `'admin'`). |
| 3 | Opcional: crear usuarios nuevos con `INSERT` y el hash de la contraseña. |
| 4 | En la app: iniciar sesión; el rol se guarda solo y Configuración solo la ve Admin. |

---

## 6. Usuario admin por defecto

El script **supabase-usuarios.sql** ya crea un usuario:

- **Usuario:** `admin`  
- **Contraseña:** `admin123`  
- **Rol:** `admin`  

Podés usarlo para entrar y luego cambiar la contraseña desde **Configuración**, o crear otros usuarios (oficina/admin) como en el paso 3.
