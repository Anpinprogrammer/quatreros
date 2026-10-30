# Mostrar el prototipo en local

> Datos 100 % ficticios. La semilla demo **se niega a correr en producción**.

## 1. Preparar (una sola vez)

Sigue "Primeros pasos" del `README.md` (pnpm, `.env`, `docker compose up -d`, `pnpm db:migrate`). Luego agrega a `.env`:

```
DEMO_PASSWORD=<elige una de 12+ caracteres>
```

```bash
pnpm db:seed:demo        # sedes, ubicaciones y 7 usuarios demo (uno por rol)
```

## 2. Levantar

```bash
pnpm dev                 # web en http://localhost:5173
```

O, igual que en producción (la API sirve la web en un solo puerto): `pnpm build` y `APP_BASE_URL=http://localhost:3000 node apps/api/dist/main.js` → http://localhost:3000

## 3. Usuarios demo

Todos usan la contraseña de `DEMO_PASSWORD`.

| Correo                           | Rol           | Entra a | Segundo factor |
| -------------------------------- | ------------- | ------- | -------------- |
| `admin@quatreros.example`        | Administrador | ERP     | Obligatorio    |
| `manager@quatreros.example`      | Manager       | ERP     | Obligatorio    |
| `contabilidad@quatreros.example` | Contador      | ERP     | Obligatorio    |
| `compras@quatreros.example`      | Comprador     | ERP     | —              |
| `produccion@quatreros.example`   | Productor     | ERP     | —              |
| `caja@quatreros.example`         | Cajero        | Caja    | —              |
| `reparto@quatreros.example`      | Distribuidor  | Ruta    | —              |

## 4. Guion sugerido (entrega 1, ~5 minutos)

1. **Caja en tableta**: ingresa como `caja@` → queda directo en la pantalla de Caja, con su nombre y el indicador de conexión.
2. **Repartidor en celular**: ingresa como `reparto@` → portal de Distribución, una columna.
3. **Seguridad**: contraseña equivocada → mensaje genérico (no revela si el correo existe).
4. **Administrador**: ingresa como `admin@` → el sistema exige configurar la verificación en dos pasos (QR con Google/Microsoft Authenticator) y entrega códigos de respaldo.
5. **Usuarios**: pestaña _08. Administración_ → _Usuarios y permisos_ → crear un repartidor nuevo con sede "Bodega principal" → cerrar sesión → ese usuario ya ingresa a Ruta.
6. **Protecciones**: intentar desactivarse a sí mismo o dejar el sistema sin administrador → el sistema lo impide.
7. **Command Center**: el tablero muestra qué entrega activa cada indicador; en cada pestaña, los módulos "En construcción" y los que "Esperan decisión P-xx".

## 5. Volver a empezar

Para repetir la demo desde cero (el administrador sin segundo factor), recrea la base: `docker compose down -v && docker compose up -d`, luego `pnpm db:migrate`, `pnpm db:seed` y `pnpm db:seed:demo`.
