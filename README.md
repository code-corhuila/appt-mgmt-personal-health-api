# Salud Activa — Personal Health API

API del bounded context `personal-health`, compatible con el contrato que utiliza la app Android
Salud Activa para autenticación y perfil básico del usuario.

## Funcionalidad

- Registro con nombre, correo, teléfono opcional y contraseña.
- Inicio de sesión y emisión de JWT compatible con el claim `userId` de Salud Activa.
- Lectura del perfil autenticado con `GET /api/auth/profile`.
- Actualización de nombre y teléfono con `PUT /api/auth/profile`.
- Almacenamiento MongoDB con hash de contraseña; los endpoints nunca devuelven el hash.
- Comprobaciones de liveness y readiness.

El modelo soportado en Salud Activa contiene `nombre`, `email` y `telefono`. Esta API no agrega
campos clínicos sin un contrato de datos compartido.

## Ejecución local

Requiere Node.js 22+ y MongoDB. `JWT_SECRET` debe coincidir con el valor que usan los demás servicios
Salud Activa para verificar sus tokens.

```powershell
Copy-Item .env.example .env
npm ci
npm start
```

El servicio escucha por defecto en `http://localhost:3005`. Para ejecutar el stack contenedorizado,
define `JWT_SECRET` y corre:

```powershell
docker compose up --build
```

## API

| Método y ruta | Descripción |
|---|---|
| `POST /api/auth/register` | Crear usuario y devolver JWT |
| `POST /api/auth/login` | Autenticar con `{ "email": "...", "contrasena": "..." }` |
| `GET /api/auth/profile` | Consultar el perfil autenticado |
| `PUT /api/auth/profile` | Actualizar `{ "nombre": "...", "telefono": "..." }` |
| `GET /health/live` | Comprobar proceso |
| `GET /health/ready` | Comprobar disponibilidad de MongoDB |

Las rutas de perfil requieren `Authorization: Bearer <JWT>`. La identidad se obtiene del token; el
cliente no puede seleccionar otra cuenta al actualizar. Las respuestas mantienen `id` y `_id` para
compatibilidad con los modelos Android existentes.

Contrato: [OpenAPI](docs/openapi.yaml).

## Pruebas

```powershell
npm test
```

GitHub Actions ejecuta pruebas y valida Compose en Pull Requests a `develop`, `qa` o `main`, y en
ramas de historia.

## Flujo de ramas

```text
hu-xxx-dev -> PR develop -> re-aplicación con git cherry-pick -x -> PR qa
           -> re-aplicación con git cherry-pick -x -> PR main
```

No hacer commits directos a ramas permanentes. `main` requiere aprobación de `ariel5253`; la
gobernanza completa está en
[`library-docs`](https://github.com/code-corhuila/library-docs).

## Branching

Three permanent branches. **None of them accepts a direct commit** — you enter through a child
branch and leave through a Pull Request.

```
develop  <--PR--  feat/... fix/... chore/...
qa       <--PR--  qa/...
main     <--PR--  release/...  hotfix/...
```

Promotion happens **by re-application** (`git cherry-pick -x`), never by merging one permanent
branch into another: `merge develop -> qa` and `merge qa -> main` do not exist in this model.

`main` requires **1 approval from `ariel5253`**. On `develop` and `qa` the team sets its own review
rule.

Full policy: `00-governance/branching-policy.md` in `library-docs`.
