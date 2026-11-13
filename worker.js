// ============================================================
//  Encuentro familiar · Cloudflare Worker
//  - Sirve los archivos estáticos (index.html, app.js, admin.html...)
//  - Un solo enlace general por encuentro: /f/<token>  (sin login)
//  - Cada persona que abre el enlace guarda su propia respuesta
//  - Panel de administración protegido: /admin
//  Base de datos: KV (binding "FAMILIA")
//  Contraseña de admin: variable/secreto "ADMIN_CLAVE"
// ============================================================

const PREFIJO_ENLACE = 'familia:';
const PREFIJO_RESPUESTA = 'respuesta:';
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

function fechaIso(valor) {
  const v = texto(valor, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '';
}

function normalizar(body) {
  const datos = {
    respondent: texto(body && body.respondent, 70),
    people: Number(body && body.people),
    availableFrom: fechaIso(body && body.availableFrom),
    availableTo: fechaIso(body && body.availableTo),
    proposal: texto(body && body.proposal, 240)
  };
  const errores = [];
  if (!datos.respondent) errores.push('respondent');
  if (!Number.isInteger(datos.people) || datos.people < 1 || datos.people > 30) errores.push('people');
  if (!datos.availableFrom) errores.push('availableFrom');
  if (!datos.availableTo) errores.push('availableTo');
  if (datos.availableFrom && datos.availableTo && datos.availableFrom > datos.availableTo) {
    errores.push('availableTo');
  }
  return { datos, errores };
}

function respondio(respuesta) {
  return Boolean(respuesta && typeof respuesta.respondent === 'string' &&
    respuesta.respondent.trim() && Number(respuesta.people) >= 1);
}

function tokenValido(token) {
  return typeof token === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(token);
}

function idValido(id) {
  return typeof id === 'string' && /^[A-Za-z0-9-]{6,64}$/.test(id);
}

function kvLista(env) {
  return Boolean(env && env.FAMILIA);
}

async function listarClaves(env, prefijo) {
  const claves = [];
  let cursor;
  do {
    const pagina = await env.FAMILIA.list({ prefix: prefijo, cursor });
    claves.push(...pagina.keys);
    cursor = pagina.list_complete ? null : pagina.cursor;
  } while (cursor);
  return claves;
}

async function listarEnlaces(env) {
  const claves = await listarClaves(env, PREFIJO_ENLACE);
  const valores = await Promise.all(claves.map(k => env.FAMILIA.get(k.name, 'json')));
  return valores.filter(Boolean);
}

// Compatibilidad con el modelo anterior: un enlace guardaba una sola respuesta.
function esLegacy(enlace) {
  return respondio(enlace);
}

function respuestaLegacy(enlace) {
  return {
    id: 'principal',
    respondent: enlace.respondent,
    people: Number(enlace.people),
    availableFrom: enlace.availableFrom || '',
    availableTo: enlace.availableTo || '',
    proposal: enlace.proposal || '',
    createdAt: enlace.createdAt || enlace.updatedAt || '',
    updatedAt: enlace.updatedAt || ''
  };
}

async function respuestasDe(env, enlace) {
  const claves = await listarClaves(env, PREFIJO_RESPUESTA + enlace.token + ':');
  const valores = await Promise.all(claves.map(k => env.FAMILIA.get(k.name, 'json')));
  const respuestas = valores.filter(Boolean);
  if (esLegacy(enlace)) respuestas.push(respuestaLegacy(enlace));
  return respuestas.sort((a, b) => String(a.respondent).localeCompare(String(b.respondent), 'es'));
}

async function enlaceConRespuestas(env, enlace) {
  const respuestas = await respuestasDe(env, enlace);
  return {
    token: enlace.token,
    name: enlace.name,
    createdAt: enlace.createdAt,
    updatedAt: enlace.updatedAt,
    respuestas,
    hogares: respuestas.length,
    people: respuestas.reduce((suma, r) => suma + Number(r.people || 0), 0)
  };
}

async function resumen(env) {
  const enlaces = await listarEnlaces(env);
  const filas = [];
  for (const enlace of enlaces) {
    for (const respuesta of await respuestasDe(env, enlace)) {
      if (!respondio(respuesta)) continue;
      filas.push({
        respondent: respuesta.respondent,
        people: Number(respuesta.people),
        availableFrom: respuesta.availableFrom || '',
        availableTo: respuesta.availableTo || '',
        updatedAt: respuesta.updatedAt
      });
    }
  }
  return {
    total: enlaces.length,
    respondidas: filas.length,
    personas: filas.reduce((suma, f) => suma + Number(f.people), 0),
    filas
  };
}

async function obtenerEnlace(env, token) {
  if (!tokenValido(token)) return null;
  return await env.FAMILIA.get(PREFIJO_ENLACE + token, 'json');
}

async function obtenerRespuesta(env, token, id) {
  if (!tokenValido(token) || !idValido(id)) return null;
  if (id === 'principal') return null;
  return await env.FAMILIA.get(PREFIJO_RESPUESTA + token + ':' + id, 'json');
}

async function crearRespuesta(env, token, datos) {
  const ahora = new Date().toISOString();
  const id = crypto.randomUUID().replace(/-/g, '');
  const registro = {
    id,
    ...datos,
    createdAt: ahora,
    updatedAt: ahora
  };
  await env.FAMILIA.put(PREFIJO_RESPUESTA + token + ':' + id, JSON.stringify(registro));
  return registro;
}

async function actualizarRespuesta(env, token, id, datos) {
  const ahora = new Date().toISOString();
  const previa = await obtenerRespuesta(env, token, id);
  if (!previa) return null;
  const registro = {
    ...previa,
    ...datos,
    id,
    createdAt: previa.createdAt || ahora,
    updatedAt: ahora
  };
  await env.FAMILIA.put(PREFIJO_RESPUESTA + token + ':' + id, JSON.stringify(registro));
  return registro;
}

async function actualizarLegacy(env, enlace, datos) {
  const ahora = new Date().toISOString();
  const registro = {
    ...enlace,
    ...datos,
    updatedAt: ahora
  };
  await env.FAMILIA.put(PREFIJO_ENLACE + enlace.token, JSON.stringify(registro));
  return {
    id: 'principal',
    ...datos,
    createdAt: enlace.createdAt || ahora,
    updatedAt: ahora
  };
}

async function borrarRespuesta(env, enlace, id) {
  if (id === 'principal') {
    const resto = { ...enlace };
    delete resto.respondent;
    delete resto.people;
    delete resto.availableFrom;
    delete resto.availableTo;
    delete resto.proposal;
    resto.updatedAt = new Date().toISOString();
    await env.FAMILIA.put(PREFIJO_ENLACE + enlace.token, JSON.stringify(resto));
    return true;
  }
  await env.FAMILIA.delete(PREFIJO_RESPUESTA + enlace.token + ':' + id);
  return true;
}

async function borrarEnlace(env, token) {
  const claves = await listarClaves(env, PREFIJO_RESPUESTA + token + ':');
  await Promise.all(claves.map(k => env.FAMILIA.delete(k.name)));
  await env.FAMILIA.delete(PREFIJO_ENLACE + token);
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
  const enlaces = (await listarEnlaces(env))
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'));
  const cabecera = ['Enlace', 'Nombre y apellido', 'Personas', 'Disponible desde', 'Disponible hasta', 'Propuesta', 'Actualizado'];
  const filas = [];
  for (const enlace of enlaces) {
    for (const respuesta of await respuestasDe(env, enlace)) {
      if (!respondio(respuesta)) continue;
      filas.push([
        enlace.name,
        respuesta.respondent,
        respuesta.people,
        respuesta.availableFrom || '',
        respuesta.availableTo || '',
        respuesta.proposal || '',
        respuesta.updatedAt || ''
      ]);
    }
  }
  const lineas = [cabecera, ...filas].map(fila => fila.map(csvCampo).join(',')).join('\r\n');
  return new Response('\uFEFF' + lineas, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="encuentro-barrera.csv"',
      'cache-control': 'no-store'
    }
  });
}

function respuestaPublica(respuesta) {
  // El id no se publica: es la llave para editar y solo la guarda el dispositivo
  // donde se creó la respuesta.
  return {
    respondent: respuesta.respondent,
    people: Number(respuesta.people),
    availableFrom: respuesta.availableFrom || '',
    availableTo: respuesta.availableTo || '',
    proposal: respuesta.proposal || '',
    createdAt: respuesta.createdAt || '',
    updatedAt: respuesta.updatedAt || ''
  };
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

  // ---------- Resultados públicos agregados ----------
  if (path === '/api/resumen' && metodo === 'GET') {
    return json(await resumen(env));
  }

  // ---------- Enlace público: grupo + respuestas ----------
  const mEnlace = path.match(/^\/api\/familia\/([A-Za-z0-9-]{8,64})\/?$/);
  if (mEnlace) {
    const token = mEnlace[1];
    const enlace = await obtenerEnlace(env, token);
    if (!enlace) return json({ error: 'Link no válido o eliminado' }, 404);

    if (metodo === 'GET') {
      const respuestas = await respuestasDe(env, enlace);
      return json({
        token: enlace.token,
        name: enlace.name,
        createdAt: enlace.createdAt,
        updatedAt: enlace.updatedAt,
        respuestas: respuestas.map(respuestaPublica)
      });
    }

    if (metodo === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
      const { datos, errores } = normalizar(body);
      if (errores.length) return json({ error: 'Revisa los campos', campos: errores }, 422);
      const respuesta = await crearRespuesta(env, token, datos);
      return json(respuesta, 201);
    }

    return json({ error: 'Método no permitido' }, 405);
  }

  // ---------- Una respuesta concreta (editar la propia) ----------
  const mRespuesta = path.match(/^\/api\/familia\/([A-Za-z0-9-]{8,64})\/([A-Za-z0-9-]{6,64})\/?$/);
  if (mRespuesta) {
    const token = mRespuesta[1];
    const id = mRespuesta[2];
    const enlace = await obtenerEnlace(env, token);
    if (!enlace) return json({ error: 'Link no válido o eliminado' }, 404);

    if (id === 'principal') {
      if (!esLegacy(enlace)) return json({ error: 'Respuesta no encontrada' }, 404);
      if (metodo === 'GET') return json(respuestaLegacy(enlace));
      if (metodo === 'PUT') {
        let body;
        try { body = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
        const { datos, errores } = normalizar(body);
        if (errores.length) return json({ error: 'Revisa los campos', campos: errores }, 422);
        return json(await actualizarLegacy(env, enlace, datos));
      }
      return json({ error: 'Método no permitido' }, 405);
    }

    const respuesta = await obtenerRespuesta(env, token, id);
    if (!respuesta) return json({ error: 'Respuesta no encontrada' }, 404);

    if (metodo === 'GET') return json(respuesta);

    if (metodo === 'PUT') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
      const { datos, errores } = normalizar(body);
      if (errores.length) return json({ error: 'Revisa los campos', campos: errores }, 422);
      const actualizada = await actualizarRespuesta(env, token, id, datos);
      return json(actualizada);
    }

    return json({ error: 'Método no permitido' }, 405);
  }

  // ---------- Login de administración ----------
  if (path === '/api/admin/login' && metodo === 'POST') {
    let body;
    try { body = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
    const esperada = String(env.ADMIN_CLAVE || CLAVE_DEFECTO).trim();
    if (String(body.clave || '').trim() !== esperada) {
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
      const enlaces = (await listarEnlaces(env))
        .sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'));
      const familias = [];
      for (const enlace of enlaces) familias.push(await enlaceConRespuestas(env, enlace));
      return json({ familias });
    }

    if (path === '/api/admin/familias' && metodo === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
      const nombre = texto(body.name, 70);
      if (!nombre) return json({ error: 'Escribe el nombre del enlace' }, 422);
      const token = crypto.randomUUID().replace(/-/g, '');
      const ahora = new Date().toISOString();
      const registro = {
        token,
        name: nombre,
        createdAt: ahora,
        updatedAt: ahora
      };
      await env.FAMILIA.put(PREFIJO_ENLACE + token, JSON.stringify(registro));
      return json({ ...registro, respuestas: [], hogares: 0, people: 0 }, 201);
    }

    const mAdminEnlace = path.match(/^\/api\/admin\/familias\/([A-Za-z0-9-]{8,64})\/?$/);
    if (mAdminEnlace) {
      const token = mAdminEnlace[1];
      const enlace = await obtenerEnlace(env, token);
      if (!enlace) return json({ error: 'Enlace no encontrado' }, 404);

      if (metodo === 'DELETE') {
        await borrarEnlace(env, token);
        return json({ ok: true });
      }
      if (metodo === 'PATCH' || metodo === 'PUT') {
        let body;
        try { body = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
        const nombre = texto(body.name, 70);
        if (!nombre) return json({ error: 'Escribe el nombre' }, 422);
        enlace.name = nombre;
        enlace.updatedAt = new Date().toISOString();
        await env.FAMILIA.put(PREFIJO_ENLACE + token, JSON.stringify(enlace));
        return json(await enlaceConRespuestas(env, enlace));
      }
      return json({ error: 'Método no permitido' }, 405);
    }

    const mAdminRespuesta = path.match(/^\/api\/admin\/respuestas\/([A-Za-z0-9-]{8,64})\/([A-Za-z0-9-]{6,64})\/?$/);
    if (mAdminRespuesta && metodo === 'DELETE') {
      const token = mAdminRespuesta[1];
      const id = mAdminRespuesta[2];
      const enlace = await obtenerEnlace(env, token);
      if (!enlace) return json({ error: 'Enlace no encontrado' }, 404);
      await borrarRespuesta(env, enlace, id);
      return json({ ok: true });
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

      // Enlace general: se sirve la app y app.js lee el token.
      if (/^\/f\/[A-Za-z0-9-]{8,64}\/?$/.test(path)) {
        return servirAsset(env, url, '/index.html');
      }

      return servirAsset(env, url, path);
    } catch (error) {
      return json({ error: 'Error interno', detalle: String((error && error.message) || error) }, 500);
    }
  }
};
