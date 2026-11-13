# Encuentro Barrera

Aplicación web para coordinar la celebración de los cumpleaños de los abuelos: es **una sola familia** y cada respuesta representa a un **hogar**. La organización comparte **un solo enlace** con todos; cada hijo o nieto lo abre desde su dispositivo, escribe su nombre, la cantidad de personas de su hogar que posiblemente pueden asistir, sus fechas de disponibilidad y, si quiere, una propuesta para el evento (sin cuenta ni contraseña). La organización administra los resultados desde un panel privado.

- Web pública / resumen: https://family.nnking919.workers.dev
- Panel de administración: https://family.nnking919.workers.dev/admin

## Cómo funciona

| Ruta | Para quién | Qué hace |
|---|---|---|
| `/` | Todos | Acceso a la encuesta pegando el enlace del encuentro. No muestra resultados. |
| `/f/<token>` | Toda la familia | El mismo enlace para todos: cada persona registra su nombre, cantidad de asistentes, fechas de disponibilidad y una propuesta opcional. Sin login. |
| `/admin` | Solo el organizador | Crea un enlace, lo comparte, ve las respuestas de cada hogar, renombra, borra respuestas y exporta CSV. |

Hay **un solo enlace general** por encuentro. Quien tenga el enlace puede responder; cada dispositivo recuerda la respuesta que creó para poder editarla después. La organización puede eliminar respuestas individuales o el enlace completo en cualquier momento.

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

- Un solo enlace general para toda la familia, sin registro ni contraseña.
- Cada persona responde por su hogar con nombre y apellido, cantidad de personas, tramo de fechas disponibles y una propuesta opcional.
- El dispositivo recuerda la respuesta propia en `localStorage` para poder editarla; también permite “Registrar otra persona” en el mismo dispositivo.
- Mensaje de agradecimiento al guardar: “Esperamos que puedas asistir. Pronto Santiago Barrera compartirá los resultados.”
- La encuesta no muestra resultados; el organizador los revisa y comparte desde su panel.
- Panel admin: métricas Enlaces / Hogares / Personas, creación de enlaces, copia, WhatsApp, renombrado, borrado de respuestas y CSV.
- El texto del usuario se inserta con `textContent` (sin `innerHTML`) para evitar inyección de HTML.
- Diseño adaptable a móviles e impresión.

## API

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| `GET` | `/api/resumen` | Público | Totales agregados sin nombres (la web no los muestra). |
| `GET` | `/api/familia/:token` | Enlace | Enlace con la lista de respuestas. |
| `POST` | `/api/familia/:token` | Enlace | Crea la respuesta de un hogar y devuelve su `id`. |
| `GET` | `/api/familia/:token/:id` | Enlace | Datos de una respuesta concreta. |
| `PUT` | `/api/familia/:token/:id` | Enlace | Actualiza la respuesta propia. |
| `POST` | `/api/admin/login` | Público | Devuelve token de sesión (12 h). |
| `POST` | `/api/admin/logout` | Admin | Cierra sesión. |
| `GET` | `/api/admin/familias` | Admin | Lista de enlaces con sus respuestas. |
| `POST` | `/api/admin/familias` | Admin | Crea un enlace general. |
| `PATCH` | `/api/admin/familias/:token` | Admin | Renombra el enlace. |
| `DELETE` | `/api/admin/familias/:token` | Admin | Elimina el enlace y todas sus respuestas. |
| `DELETE` | `/api/admin/respuestas/:token/:id` | Admin | Borra una respuesta individual. |
| `GET` | `/api/admin/export` | Admin | Descarga CSV. |

El token de administración viaja en la cabecera `X-Admin-Token` y se guarda en `sessionStorage`. Los `id` de las respuestas no se publican en el listado: cada dispositivo guarda el suyo para poder editar solo su propia respuesta.

## Fechas

- Cumpleaños del abuelo: **8 de diciembre**.
- Cumpleaños de la abuela: **22 de enero**.

## Pruebas

```sh
node --test family-logic.test.cjs
```
