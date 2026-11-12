# Encuentro Barrera

Aplicación web para coordinar la celebración de los cumpleaños de los abuelos: es **una sola familia** y cada respuesta representa a un **hogar**. Los hijos y nietos responden con un **enlace único por hogar** (sin cuenta ni contraseña), registran quién responde, la cantidad de personas que posiblemente pueden asistir, sus fechas de disponibilidad y, si quieren, una propuesta para el evento. La organización administra los resultados desde un panel privado.

- Web pública / resumen: https://family.nnking919.workers.dev
- Panel de administración: https://family.nnking919.workers.dev/admin

## Cómo funciona

| Ruta | Para quién | Qué hace |
|---|---|---|
| `/` | Todos | Acceso a la encuesta pegando el enlace del hogar. No muestra resultados. |
| `/f/<token>` | Cada hogar | Su encuesta personal: quién responde, cantidad de asistentes, fechas de disponibilidad y una propuesta opcional. Sin login. |
| `/admin` | Solo el organizador | Crea hogares, copia enlaces, ve los resultados, renombra, elimina y exporta CSV. |

Cada hogar recibe un enlace largo e imposible de adivinar. Quien tenga el enlace puede responder; la organización puede eliminar el enlace en cualquier momento.

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

- Enlace único por hogar, sin registro ni contraseña.
- Encuesta con nombre y apellido de quien responde, cantidad de personas que posiblemente pueden asistir, tramo de fechas disponibles y una propuesta opcional para el evento.
- Mensaje de agradecimiento al guardar: “Esperamos que puedas asistir. Pronto Santiago Barrera compartirá los resultados.”
- La encuesta no muestra resultados; el organizador los revisa y comparte desde su panel.
- Panel admin: métricas, creación de hogares, copia de enlaces, WhatsApp, renombrado, eliminación y CSV.
- Sin `localStorage`: todo se guarda en KV y se comparte entre dispositivos.
- El texto del usuario se inserta con `textContent` (sin `innerHTML`) para evitar inyección de HTML.
- Diseño adaptable a móviles e impresión.

## API

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| `GET` | `/api/resumen` | Público | Totales agregados sin nombres (la web no los muestra). |
| `GET` | `/api/familia/:token` | Enlace | Datos de ese hogar. |
| `PUT` | `/api/familia/:token` | Enlace | Guarda/actualiza su respuesta. |
| `POST` | `/api/admin/login` | Público | Devuelve token de sesión (12 h). |
| `POST` | `/api/admin/logout` | Admin | Cierra sesión. |
| `GET` | `/api/admin/familias` | Admin | Lista completa con tokens. |
| `POST` | `/api/admin/familias` | Admin | Crea un hogar y su enlace. |
| `PATCH` | `/api/admin/familias/:token` | Admin | Renombra. |
| `DELETE` | `/api/admin/familias/:token` | Admin | Elimina el hogar y su enlace. |
| `GET` | `/api/admin/export` | Admin | Descarga CSV. |

El token de administración viaja en la cabecera `X-Admin-Token` y se guarda en `sessionStorage`.

## Fechas

- Cumpleaños del abuelo: **8 de diciembre**.
- Cumpleaños de la abuela: **22 de enero**.

## Pruebas

```sh
node --test family-logic.test.cjs
```
