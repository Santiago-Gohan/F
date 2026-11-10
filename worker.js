// ============================================================
//  Encuentro familiar · Cloudflare Worker
//  - Sirve los archivos estáticos (index.html, app.js, admin.html...)
//  - Cada familia entra con un link único: /f/<token>  (sin login)
//  - Panel de administración protegido: /admin
//  Base de datos: KV (binding "FAMILIA")
//  Contraseña de admin: variable/secreto "ADMIN_CLAVE"
// ============================================================

const EVENT_START = '2026-12-01';
const EVENT_END = '2027-02-15';
const PERIODOS = new Set([
  'dec-01-07', 'dec-08-15', 'dec-16-23', 'dec-24-25', 'dec-26-30',
  'dec-31-jan-01', 'jan-02-11', 'jan-12-15', 'jan-16-25', 'jan-26-feb-15'
]);
const ACTIVIDADES = new Set([
  'lunch', 'picnic', 'cake', 'music', 'games', 'memories', 'outing', 'surprise'
]);
const PREFIJO_FAMILIA = 'familia:';
const PREFIJO_SESION = 'sesion:';
const DURACION_SESION = 12 * 60 * 60; // 12 horas
const CLAVE_DEFECTO = 'admin123';

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

function texto(valor, max) {
  return String(valor == null ? '' : valor).trim().slice(0, max);
}

function isoValida(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const fecha = new Date(valor + 'T00:00:00Z');
  return Number.isFinite(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
}

function normalizar(body) {
  const datos = {
    name: texto(body && body.name, 70),
    people: Number(body && body.people),
    from: texto(body && body.from, 10),
    to: texto(body && body.to, 10),
    periods: Array.isArray(body && body.periods)
      ? [...new Set(body.periods.filter(p => PERIODOS.has(p)))] : [],
    activities: Array.isArray(body && body.activities)
      ? [...new Set(body.activities.filter(a => ACTIVIDADES.has(a)))] : [],
    customActivity: texto(body && body.customActivity, 240)
  };
  const errores = [];
  if (!datos.name) errores.push('name');
  if (!Number.isInteger(datos.people) || datos.people < 1 || datos.people > 15) errores.push('people');
  if (!isoValida(datos.from) || !isoValida(datos.to) || datos.from > datos.to ||
      datos.from < EVENT_START || datos.to > EVENT_END) errores.push('dates');
  if (datos.periods.length < 1 || datos.periods.length > 3) errores.push('periods');
  if (datos.activities.length > 3) errores.push('activities');
  if (!datos.activities.length && !datos.customActivity) errores.push('activities');
  return { datos, errores };
}

function respondio(familia) {
  return Boolean(familia && Number(familia.people) >= 1 &&
    isoValida(familia.from) && isoValida(familia.to));
}

function tokenValido(token) {
  return typeof token === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(token);
}

function kvLista(env) {
  return Boolean(env && env.FAMILIA);
}

async function listarFamilias(env) {
  const claves = [];
  let cursor;
  do {
    const pagina = await env.FAMILIA.list({ prefix: PREFIJO_FAMILIA, cursor });
    claves.push(...pagina.keys);
    cursor = pagina.list_complete ? null : pagina.cursor;
  } while (cursor);
  const valores = await Promise.all(claves.map(k => env.FAMILIA.get(k.name, 'json')));
  return valores.filter(Boolean);
}

async function resumen(env) {
  const familias = await listarFamilias(env);
  const conRespuesta = familias.filter(respondio);
  return {
    total: familias.length,
    respondidas: conRespuesta.length,
    personas: conRespuesta.reduce((suma, f) => suma + Number(f.people), 0),
    filas: conRespuesta.map(f => ({
      people: Number(f.people),
      from: f.from,
      to: f.to,
      periods: Array.isArray(f.periods) ? f.periods : [],
      activities: Array.isArray(f.activities) ? f.activities : []
    }))
  };
}

async function obtenerFamilia(env, token) {
  if (!tokenValido(token)) return null;
  return await env.FAMILIA.get(PREFIJO_FAMILIA + token, 'json');
}

async function guardarFamilia(env, token, datos) {
  const ahora = new Date().toISOString();
  const previa = (await obtenerFamilia(env, token)) || {};
  const registro = {
    token,
    ...datos,
    createdAt: previa.createdAt || ahora,
    updatedAt: ahora
  };
  await env.FAMILIA.put(PREFIJO_FAMILIA + token, JSON.stringify(registro));
  return registro;
}

async function adminAutenticado(request, env) {
  const token = request.headers.get('X-Admin-Token') || '';
  if (!token) return false;
  return Boolean(await env.FAMILIA.get(PREFIJO_SESION + token));
}

function csvCampo(valor) {
  let t = String(valor == null ? '' : valor);
  if (/^[\u0000-\u0020]*[=+\-@]/.test(t)) t = "'" + t;
  return '"' + t.replace(/"/g, '""') + '"';
}

async function exportarCsv(env) {
  const familias = (await listarFamilias(env))
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'));
  const cabecera = ['Familia', 'Personas', 'Libre desde', 'Libre hasta',
    'Periodos', 'Ideas', 'Otra idea', 'Actualizado'];
  const filas = familias.map(f => [
    f.name,
    respondio(f) ? f.people : '',
    respondio(f) ? f.from : '',
    respondio(f) ? f.to : '',
    (f.periods || []).join(' | '),
    (f.activities || []).join(' | '),
    f.customActivity || '',
    f.updatedAt || ''
  ]);
  const lineas = [cabecera, ...filas].map(fila => fila.map(csvCampo).join(',')).join('\r\n');
  return new Response('\uFEFF' + lineas, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="encuentro-familiar.csv"',
      'cache-control': 'no-store'
    }
  });
}

async function manejarApi(request, env, url) {
  const metodo = request.method;
  const path = url.pathname;

  if (!kvLista(env)) {
    return json({
      error: 'Falta conectar la base de datos',
      detalle: 'Crea el KV "FAMILIA" y asígnalo como binding FAMILIA en el Worker.'
    }, 503);
  }

  // ---------- Resultados públicos (sin nombres) ----------
  if (path === '/api/resumen' && metodo === 'GET') {
    return json(await resumen(env));
  }

  // ---------- Respuesta de una familia ----------
  const mFamilia = path.match(/^\/api\/familia\/([A-Za-z0-9-]{8,64})\/?$/);
  if (mFamilia) {
    const token = mFamilia[1];
    const familia = await obtenerFamilia(env, token);
    if (!familia) return json({ error: 'Link no válido o eliminado' }, 404);

    if (metodo === 'GET') return json(familia);

    if (metodo === 'POST' || metodo === 'PUT') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
      const { datos, errores } = normalizar(body);
      if (errores.length) return json({ error: 'Revisa los campos', campos: errores }, 422);
      return json(await guardarFamilia(env, token, datos));
    }
    return json({ error: 'Método no permitido' }, 405);
  }

  // ---------- Login de administración ----------
  if (path === '/api/admin/login' && metodo === 'POST') {
    let body;
    try { body = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
    const esperada = String(env.ADMIN_CLAVE || CLAVE_DEFECTO);
    if (String(body.clave || '') !== esperada) {
      return json({ error: 'Contraseña incorrecta' }, 401);
    }
    const token = crypto.randomUUID();
    await env.FAMILIA.put(PREFIJO_SESION + token, '1', { expirationTtl: DURACION_SESION });
    return json({ token, porDefecto: !env.ADMIN_CLAVE });
  }

  if (path === '/api/admin/logout' && metodo === 'POST') {
    const token = request.headers.get('X-Admin-Token') || '';
    if (token) await env.FAMILIA.delete(PREFIJO_SESION + token);
    return json({ ok: true });
  }

  // ---------- Rutas protegidas de administración ----------
  if (path.startsWith('/api/admin/')) {
    if (!(await adminAutenticado(request, env))) {
      return json({ error: 'No autorizado' }, 401);
    }

    if (path === '/api/admin/familias' && metodo === 'GET') {
      const familias = (await listarFamilias(env))
        .sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'));
      return json({ familias });
    }

    if (path === '/api/admin/familias' && metodo === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
      const nombre = texto(body.name, 70);
      if (!nombre) return json({ error: 'Escribe el nombre de la familia' }, 422);
      const token = crypto.randomUUID().replace(/-/g, '');
      const ahora = new Date().toISOString();
      const registro = {
        token,
        name: nombre,
        people: 0,
        from: '',
        to: '',
        periods: [],
        activities: [],
        customActivity: '',
        createdAt: ahora,
        updatedAt: ahora
      };
      await env.FAMILIA.put(PREFIJO_FAMILIA + token, JSON.stringify(registro));
      return json(registro, 201);
    }

    const mAdmin = path.match(/^\/api\/admin\/familias\/([A-Za-z0-9-]{8,64})\/?$/);
    if (mAdmin) {
      const token = mAdmin[1];
      const familia = await obtenerFamilia(env, token);
      if (!familia) return json({ error: 'Familia no encontrada' }, 404);

      if (metodo === 'DELETE') {
        await env.FAMILIA.delete(PREFIJO_FAMILIA + token);
        return json({ ok: true });
      }
      if (metodo === 'PATCH' || metodo === 'PUT') {
        let body;
        try { body = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
        const nombre = texto(body.name, 70);
        if (!nombre) return json({ error: 'Escribe el nombre' }, 422);
        familia.name = nombre;
        familia.updatedAt = new Date().toISOString();
        await env.FAMILIA.put(PREFIJO_FAMILIA + token, JSON.stringify(familia));
        return json(familia);
      }
      return json({ error: 'Método no permitido' }, 405);
    }

    if (path === '/api/admin/export' && metodo === 'GET') {
      return exportarCsv(env);
    }

    return json({ error: 'No encontrado' }, 404);
  }

  return json({ error: 'No encontrado' }, 404);
}

async function servirAsset(env, url, pathname) {
  if (!env.ASSETS) {
    return new Response(
      'Falta el binding ASSETS. En Cloudflare, configura los archivos estáticos del Worker.',
      { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8' } }
    );
  }
  return env.ASSETS.fetch(new URL(pathname, url).toString());
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === '/api' || path.startsWith('/api/')) {
        return await manejarApi(request, env, url);
      }

      // Panel de administración (protegido por contraseña en /api/admin).
      if (path === '/admin' || path === '/admin/') {
        return servirAsset(env, url, '/admin.html');
      }

      // Link único por familia: se sirve la app y app.js lee el token.
      if (/^\/f\/[A-Za-z0-9-]{8,64}\/?$/.test(path)) {
        return servirAsset(env, url, '/index.html');
      }

      return servirAsset(env, url, path);
    } catch (error) {
      return json({ error: 'Error interno', detalle: String((error && error.message) || error) }, 500);
    }
  }
};
