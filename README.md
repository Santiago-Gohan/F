# Encuentro Barrera

Aplicación web para coordinar la celebración de los cumpleaños de los abuelos: cada familia entra con un **enlace único** (sin cuenta ni contraseña), registra su disponibilidad e ideas, y la organización administra todo desde un panel privado.

- Web pública / resumen: https://family.nnking919.workers.dev
- Panel de administración: https://family.nnking919.workers.dev/admin

## Cómo funciona

| Ruta | Para quién | Qué hace |
|---|---|---|
| `/` | Todos | Resumen general de la celebración (sin nombres) y acceso pegando el enlace familiar. |
| `/f/<token>` | Cada familia | Su panel personal: responde y actualiza cuando quiera. Sin login. |
| `/admin` | Solo el organizador | Crea familias, copia enlaces, ve respuestas, renombra, elimina y exporta CSV. |

Cada familia recibe un enlace largo e imposible de adivinar. Quien tenga el enlace puede responder; la organización puede eliminar el enlace en cualquier momento.

## Base de datos (Cloudflare KV)

El Worker usa un binding de KV llamado **`FAMILIA`**. Si falta, la web muestra “Base de datos pendiente” y no guarda nada.

### Opción A · Wrangler (recomendado)

```sh
npx wrangler kv namespace create FAMILIA
```

Copia el `id` que devuelve, pégalo en `wrangler.toml` y descomenta el bloque `[[kv_namespaces]]`.

Luego define la contraseña de administración y despliega:

```sh
npx wrangler secret put ADMIN_CLAVE
npx wrangler deploy
```

### Opción B · Panel de Cloudflare

1. **Storage & Databases → KV → Create instance** → nombre `familia`.
2. En el Worker `family`: **Settings → Bindings → Add → KV namespace**, variable `FAMILIA`, selecciona la instancia.
3. **Settings → Variables and Secrets → Add**, nombre `ADMIN_CLAVE`, valor tu contraseña (tipo *Secret*).
4. Vuelve a desplegar el código.

> Si no defines `ADMIN_CLAVE`, la contraseña temporal es `admin123`. El panel muestra una advertencia y debes cambiarla.

## Despliegue

El proyecto se despliega como **Worker con archivos estáticos** (binding `ASSETS`) y `worker.js` como entrypoint.

```sh
npx wrangler deploy
```

Archivos que se publican: `index.html`, `app.js`, `family-logic.js`, `admin.html`, `admin.js`.  
`.assetsignore` evita publicar el código del Worker, la configuración y las pruebas.

## Funciones

- Enlace único por familia, sin registro ni contraseña.
- Formulario con nombre, personas, rango de disponibilidad, hasta 3 periodos y hasta 3 ideas.
- Sugiere el mejor día y la mejor ventana de dos días; desempata con las preferencias.
- Resumen público sin nombres.
- Panel admin: métricas, creación de familias, copia de enlaces, WhatsApp, renombrado, eliminación y CSV.
- Sin `localStorage`: todo se guarda en KV y se comparte entre dispositivos.
- El texto del usuario se inserta con `textContent` (sin `innerHTML`) para evitar inyección de HTML.
- Diseño adaptable a móviles e impresión.

## API

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| `GET` | `/api/resumen` | Público | Totales y filas agregadas sin nombres. |
| `GET` | `/api/familia/:token` | Enlace | Datos de esa familia. |
| `PUT` | `/api/familia/:token` | Enlace | Guarda/actualiza su respuesta. |
| `POST` | `/api/admin/login` | Público | Devuelve token de sesión (12 h). |
| `POST` | `/api/admin/logout` | Admin | Cierra sesión. |
| `GET` | `/api/admin/familias` | Admin | Lista completa con tokens. |
| `POST` | `/api/admin/familias` | Admin | Crea una familia y su enlace. |
| `PATCH` | `/api/admin/familias/:token` | Admin | Renombra. |
| `DELETE` | `/api/admin/familias/:token` | Admin | Elimina familia y enlace. |
| `GET` | `/api/admin/export` | Admin | Descarga CSV. |

El token de administración viaja en la cabecera `X-Admin-Token` y se guarda en `sessionStorage`.

## Fechas

- Cumpleaños del abuelo: **8 de diciembre**.
- Cumpleaños de la abuela: **22 de enero**.
- Periodo del formulario: **1 de diciembre de 2026 – 15 de febrero de 2027**.

## Pruebas

```sh
node --test family-logic.test.cjs
```
