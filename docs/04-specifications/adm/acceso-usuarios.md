# Especificación — Entrega 1: ingreso, usuarios, roles y sedes

> Estado: **APROBADA para el prototipo** (DEC-083) · 2026-10-29
> Matriz de permisos: `PROVISIONAL` (Q-B-01 → DEC-083), cargada desde `01-requirements/actors-permissions.md` §3.

## 1. Objetivo y alcance

Que cada persona entre con su cuenta, quede ubicada en su rol y sus sedes, y vea solo lo que le corresponde. El administrador gestiona usuarios.

**Incluye:** inicio y cierre de sesión; segundo factor (TOTP) obligatorio para roles sensibles con configuración guiada; contexto de usuario (roles, sedes, permisos efectivos); redirección a la pantalla del rol; lista, creación, edición de roles/sedes, desactivación y reactivación de usuarios; consulta de roles y sedes; usuarios y sedes de demostración; auditoría de los cambios.

**No incluye (entregas posteriores):** recuperación de contraseña por correo (necesita proveedor de correo, INT-03); edición de roles y permisos desde la interfaz (RF-004 queda en modo lectura: la matriz se cambia por semilla); políticas y bandeja de aprobaciones (RF-006/007, entrega 2+); creación de sedes desde la interfaz (RF-005 en lectura; se siembran).

## 2. Requerimientos y reglas cubiertas

| ID      | Cobertura en esta entrega                                                           |
| ------- | ----------------------------------------------------------------------------------- |
| RF-001  | Completo (correo + contraseña + TOTP para roles sensibles)                          |
| RF-003  | Completo salvo invitación por correo: el administrador fija una contraseña temporal |
| RF-004  | Lectura de roles y permisos; edición posterior                                      |
| RF-005  | Lectura de sedes y ubicaciones; se siembran                                         |
| BR-001  | Filtro por sede en el servicio de autorización                                      |
| BR-002  | `authz.require` en backend para toda ruta                                           |
| BR-005  | Auditoría de alta, cambios de rol/sede, desactivación                               |
| BR-010  | Los usuarios no se borran: se desactivan                                            |
| DEC-043 | MFA obligatorio para roles con `requires_mfa` (ADM, MGR, CONT — provisional)        |

## 3. Modelo de datos (esquema `admin`)

Tablas según `database-design.md`: `sites`, `locations`, `users` (vínculo `auth_user_id → auth.user.id`), `roles` (`requires_mfa`), `permissions`, `role_permissions` (alcance `ALL|SITE|OWN`), `user_roles`, `user_sites`. Sin borrado de usuarios (BR-010).

## 4. Contrato de API

| Método y ruta                                              | Permiso           | Descripción                                                                              |
| ---------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------- |
| `POST /api/auth/sign-in/email`                             | —                 | Better Auth. Si el usuario tiene TOTP activo responde `twoFactorRedirect: true`          |
| `POST /api/auth/two-factor/verify-totp`                    | —                 | Completa el ingreso (o confirma la activación) con el código                             |
| `POST /api/auth/two-factor/enable`                         | sesión            | Inicia la activación de TOTP (pide contraseña); devuelve `totpURI` y códigos de respaldo |
| `POST /api/auth/sign-out`                                  | sesión            | Cierra sesión                                                                            |
| `GET /api/v1/me`                                           | sesión            | Usuario, roles, sedes, permisos efectivos, `mfa: { required, enabled }`, shell de inicio |
| `GET /api/v1/admin/users`                                  | `adm.user.read`   | Lista paginada con filtro por texto y estado                                             |
| `POST /api/v1/admin/users`                                 | `adm.user.create` | Crea usuario con nombre, correo, contraseña temporal, roles y sedes. Idempotente         |
| `PATCH /api/v1/admin/users/{id}`                           | `adm.user.update` | Cambia nombre, roles o sedes (`If-Match` con versión)                                    |
| `POST /api/v1/admin/users/{id}/deactivate` · `/reactivate` | `adm.user.update` | Desactiva (revoca sesiones) o reactiva                                                   |
| `GET /api/v1/admin/roles`                                  | `adm.user.read`   | Roles con sus permisos y alcances                                                        |
| `GET /api/v1/admin/sites`                                  | `adm.site.read`   | Sedes y ubicaciones (filtradas por alcance)                                              |

**MFA obligatorio:** si el usuario tiene un rol con `requires_mfa` y aún no activó TOTP, toda ruta `/api/v1/*` responde `403 MFA_SETUP_REQUIRED`, excepto `GET /api/v1/me`.

**Errores propios:** `EMAIL_TAKEN` (409), `LAST_ADMIN` (409, no se puede quitar el último administrador activo ni desactivarse a sí mismo), `UNKNOWN_ROLE` / `UNKNOWN_SITE` (422).

## 5. Pantallas

| Pantalla                                                | Estados                                                                                                |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Ingresar (`/ingresar`)                                  | formulario; error de credenciales (mensaje genérico); paso del código de 6 dígitos; cuenta desactivada |
| Configurar segundo factor (`/seguridad/segundo-factor`) | pide contraseña → QR y clave manual → código de confirmación → códigos de respaldo para guardar        |
| Inicio por rol                                          | CAJ → `/pos`; DIST → `/ruta`; resto → `/erp`                                                           |
| Usuarios (`/erp/usuarios`, solo ADM)                    | lista con rol, sedes y estado; vacío; crear; editar; desactivar/reactivar; sin permiso                 |
| Barra superior                                          | nombre, rol, cerrar sesión                                                                             |

## 6. Auditoría

`adm.user.create`, `adm.user.update` (antes/después de roles y sedes), `adm.user.deactivate`, `adm.user.reactivate`. Inicio de sesión y MFA los registra Better Auth en sus tablas.

## 7. Criterios de aceptación

```gherkin
Escenario: ingreso de un cajero
  Dado un usuario activo con rol Cajero en la sede "Punto de asados"
  Cuando ingresa con correo y contraseña correctos
  Entonces queda en la pantalla de Caja
  Y /api/v1/me muestra el rol CAJ y solo la sede "Punto de asados"

Escenario: credenciales incorrectas
  Cuando alguien ingresa con una contraseña incorrecta
  Entonces ve "Correo o contraseña incorrectos" sin indicar cuál de los dos falló

Escenario: administrador sin segundo factor
  Dado un administrador que aún no activó el segundo factor
  Cuando llama a GET /api/v1/admin/users
  Entonces recibe 403 MFA_SETUP_REQUIRED
  Y la interfaz lo lleva a configurar el segundo factor

Escenario: administrador con segundo factor
  Dado un administrador con TOTP activo
  Cuando ingresa con correo y contraseña
  Entonces se le pide el código de 6 dígitos antes de crear la sesión

Escenario: crear usuario
  Dado un administrador con sesión y segundo factor
  Cuando crea "Juan" con rol Distribuidor y sede "Bodega principal"
  Entonces Juan puede ingresar y entra al portal de Ruta
  Y queda un registro de auditoría adm.user.create

Escenario: permiso denegado
  Dado un cajero con sesión
  Cuando llama a GET /api/v1/admin/users
  Entonces recibe 403 FORBIDDEN

Escenario: alta duplicada
  Cuando el administrador envía dos veces la misma creación con la misma Idempotency-Key
  Entonces se crea un solo usuario y la segunda respuesta es la misma

Escenario: correo ya usado
  Cuando el administrador crea un usuario con un correo existente
  Entonces recibe 409 EMAIL_TAKEN

Escenario: desactivar
  Dado un usuario con sesión abierta
  Cuando el administrador lo desactiva
  Entonces su sesión deja de funcionar
  Y no puede volver a ingresar hasta que lo reactiven

Escenario: último administrador
  Cuando el único administrador activo intenta quitarse el rol o desactivarse
  Entonces recibe 409 LAST_ADMIN
```

## 8. Pruebas

- **Unitarias:** resolución de permisos efectivos y alcance (`ALL` > `SITE` > `OWN`), filtro por sede, regla del último administrador, shell de inicio por rol.
- **Integración (PostgreSQL real):** ingreso completo con Better Auth; MFA obligatorio y flujo TOTP completo; `/me`; crear/editar/desactivar con auditoría; 403/404/409/422; idempotencia; sesión revocada al desactivar.
- **E2E:** ingreso de cajero → Caja; administrador → configurar segundo factor → Usuarios → crear repartidor.

## 9. Datos de demostración

Sedes: **Bodega principal** (ubicaciones: Principal, Producción, En tránsito, En ruta, En inspección) y **Punto de asados** (Productos del punto, Cocina). Usuarios demo, uno por rol, con contraseña común definida al sembrar (`DEMO_PASSWORD`). El comando se niega a correr en producción.

## 10. Definición de terminado

Criterios de §7 automatizados; CI en verde; `PROJECT-STATUS.md`, roadmap y menú del ERP actualizados.
