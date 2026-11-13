(() => {
  'use strict';

  const STORAGE_TOKEN = 'encuentro-admin-token';
  const STORAGE_DEFAULT = 'encuentro-admin-default';
  const STORAGE_FAMILIAS = 'encuentro-admin-familias';

  const loginView = document.getElementById('login-view');
  const dashboardView = document.getElementById('dashboard-view');
  const loginForm = document.getElementById('login-form');
  const adminKey = document.getElementById('admin-key');
  const loginError = document.getElementById('login-error');
  const defaultWarning = document.getElementById('default-warning');
  const createForm = document.getElementById('create-form');
  const newFamilyName = document.getElementById('new-family-name');
  const createError = document.getElementById('create-error');
  const createdBox = document.getElementById('created-box');
  const createdEmpty = document.getElementById('created-empty');
  const createdName = document.getElementById('created-name');
  const createdLink = document.getElementById('created-link');
  const familyList = document.getElementById('family-list');
  const familyEmpty = document.getElementById('family-empty');
  const listSummary = document.getElementById('list-summary');
  const listStatus = document.getElementById('list-status');

  let adminToken = sessionStorage.getItem(STORAGE_TOKEN) || '';
  let enlacesState = leerEnlacesCache();

  function leerEnlacesCache() {
    try {
      const datos = JSON.parse(sessionStorage.getItem(STORAGE_FAMILIAS) || '[]');
      return Array.isArray(datos) ? datos.filter(f => f && typeof f.token === 'string') : [];
    } catch {
      return [];
    }
  }

  function guardarEnlacesCache(enlaces) {
    try { sessionStorage.setItem(STORAGE_FAMILIAS, JSON.stringify(enlaces)); } catch { /* sin caché */ }
  }

  // ---------------------------------------------------------
  //  API
  // ---------------------------------------------------------
  async function api(path, options = {}) {
    const headers = { accept: 'application/json', ...(options.headers || {}) };
    if (adminToken) headers['X-Admin-Token'] = adminToken;
    const response = await fetch(path, { cache: 'no-store', ...options, headers });
    let body = null;
    try { body = await response.json(); } catch { body = null; }

    if (response.status === 401 && path !== '/api/admin/login') {
      cerrarSesionLocal();
      mostrarLogin('Tu sesión venció. Entra otra vez.');
      throw new Error('Sesión vencida');
    }
    if (!response.ok) {
      const error = new Error((body && body.error) || `Error ${response.status}`);
      error.status = response.status;
      error.body = body;
      throw error;
    }
    return body;
  }

  function mensajeDeError(error) {
    if (!error) return 'Ocurrió un error.';
    if (error.status === 503) return 'Falta conectar la base de datos (KV FAMILIA) en Cloudflare.';
    if (error.status === 401) return 'Contraseña incorrecta.';
    if (error.status === 404) return 'No se encontró ese recurso.';
    return error.message || 'No se pudo completar la acción.';
  }

  // ---------------------------------------------------------
  //  Sesión
  // ---------------------------------------------------------
  function mostrarLogin(mensaje = '') {
    dashboardView.hidden = true;
    loginView.hidden = false;
    loginError.textContent = mensaje;
    setTimeout(() => adminKey.focus(), 50);
  }

  function mostrarPanel() {
    loginView.hidden = true;
    dashboardView.hidden = false;
    defaultWarning.hidden = sessionStorage.getItem(STORAGE_DEFAULT) !== '1';
  }

  function cerrarSesionLocal() {
    adminToken = '';
    sessionStorage.removeItem(STORAGE_TOKEN);
    sessionStorage.removeItem(STORAGE_DEFAULT);
    sessionStorage.removeItem(STORAGE_FAMILIAS);
  }

  loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    loginError.textContent = '';
    const clave = adminKey.value.trim();
    if (!clave) {
      loginError.textContent = 'Escribe la contraseña.';
      adminKey.focus();
      return;
    }
    const button = loginForm.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = 'Entrando…';
    try {
      const data = await api('/api/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clave })
      });
      adminToken = data.token;
      sessionStorage.setItem(STORAGE_TOKEN, adminToken);
      sessionStorage.setItem(STORAGE_DEFAULT, data.porDefecto ? '1' : '0');
      adminKey.value = '';
      mostrarPanel();
      await cargarEnlaces();
    } catch (error) {
      loginError.textContent = error.status === 401 ? 'Contraseña incorrecta.' : mensajeDeError(error);
    } finally {
      button.disabled = false;
      button.textContent = 'Entrar';
    }
  });

  document.getElementById('logout-button').addEventListener('click', async () => {
    try { await api('/api/admin/logout', { method: 'POST' }); } catch { /* la sesión local se cierra igual */ }
    cerrarSesionLocal();
    limpiarDashboard();
    mostrarLogin('Saliste del panel.');
  });

  // ---------------------------------------------------------
  //  Datos y render
  // ---------------------------------------------------------
  function fecha(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return '—';
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(d);
  }

  function fechaCorta(iso) {
    if (!iso) return '';
    const d = new Date(`${iso}T00:00:00`);
    if (!Number.isFinite(d.getTime())) return '';
    return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  }

  function rangoFechas(desde, hasta) {
    const a = fechaCorta(desde);
    const b = fechaCorta(hasta);
    if (!a && !b) return '—';
    if (a && b) return `${a} – ${b}`;
    return a || b;
  }

  function enlaceDe(enlace) {
    return `${location.origin}/f/${enlace.token}`;
  }

  function elemento(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  function boton(texto, clase, accion) {
    const b = elemento('button', clase, texto);
    b.type = 'button';
    b.addEventListener('click', accion);
    return b;
  }

  function respuestasDe(enlace) {
    return Array.isArray(enlace && enlace.respuestas) ? enlace.respuestas : [];
  }

  function totalPersonas(respuestas) {
    return respuestas.reduce((suma, r) => suma + Number(r.people || 0), 0);
  }

  function mensajeWhatsApp(enlace) {
    return `Hola 👋 Te comparto el enlace del Encuentro Barrera (cumpleaños de los abuelos).\n\n${enlaceDe(enlace)}\n\nEntra, escribe tu nombre y apellido, cuántas personas posiblemente pueden asistir y en qué fechas están disponibles. Cada persona responde por su hogar. No necesitas contraseña ni crear cuenta.`;
  }

  function abrirWhatsApp(enlace) {
    window.open(`https://wa.me/?text=${encodeURIComponent(mensajeWhatsApp(enlace))}`, '_blank', 'noopener');
  }

  async function copiar(texto, botonCopiar) {
    const etiqueta = botonCopiar.textContent;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(texto);
      } else {
        const area = document.createElement('textarea');
        area.value = texto;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.append(area);
        area.select();
        document.execCommand('copy');
        area.remove();
      }
      botonCopiar.textContent = 'Copiado';
      setTimeout(() => { botonCopiar.textContent = etiqueta; }, 1400);
    } catch {
      window.prompt('Copia el enlace:', texto);
    }
  }

  function filaRespuesta(enlace, respuesta) {
    const item = elemento('li', 'respuesta');

    const head = elemento('div', 'respuesta-head');
    head.append(elemento('strong', '', respuesta.respondent || 'Sin nombre'));
    head.append(boton('Borrar', 'btn btn-danger btn-small', () => eliminarRespuesta(enlace, respuesta)));
    item.append(head);

    const datos = elemento('div', 'respuesta-datos');
    const personas = Number(respuesta.people) || 0;
    datos.append(elemento('span', '', `${personas} ${personas === 1 ? 'persona' : 'personas'}`));
    datos.append(elemento('span', '', `Disponible: ${rangoFechas(respuesta.availableFrom, respuesta.availableTo)}`));
    datos.append(elemento('span', '', `Actualizado: ${fecha(respuesta.updatedAt)}`));
    item.append(datos);

    const propuesta = String(respuesta.proposal || '').trim();
    if (propuesta) item.append(elemento('p', 'respuesta-propuesta', `Propuesta: ${propuesta}`));

    return item;
  }

  function tarjetaEnlace(enlace) {
    const card = elemento('article', 'family-card');
    const respuestas = respuestasDe(enlace);

    const head = elemento('div', 'family-card-head');
    head.append(elemento('h3', '', enlace.name));
    head.append(elemento('span', respuestas.length ? 'badge' : 'badge pending',
      `${respuestas.length} ${respuestas.length === 1 ? 'hogar' : 'hogares'}`));
    card.append(head);

    const linkRow = elemento('div', 'family-link');
    const input = document.createElement('input');
    input.type = 'text';
    input.readOnly = true;
    input.value = enlaceDe(enlace);
    input.setAttribute('aria-label', `Enlace de ${enlace.name}`);
    const copiarBtn = boton('Copiar', 'btn btn-quiet btn-small', () => copiar(enlaceDe(enlace), copiarBtn));
    const waBtn = boton('WhatsApp', 'btn btn-primary btn-small', () => abrirWhatsApp(enlace));
    linkRow.append(input, copiarBtn, waBtn);
    card.append(linkRow);

    if (respuestas.length) {
      const lista = elemento('ul', 'respuestas');
      for (const respuesta of respuestas) lista.append(filaRespuesta(enlace, respuesta));
      card.append(lista);
    } else {
      card.append(elemento('p', 'respuesta-vacia', 'Todavía nadie ha respondido con este enlace.'));
    }

    const actions = elemento('div', 'family-actions');
    actions.append(boton('Renombrar enlace', 'btn btn-quiet btn-small', () => renombrar(enlace)));
    actions.append(boton('Eliminar enlace', 'btn btn-danger btn-small', () => eliminarEnlace(enlace)));
    card.append(actions);

    return card;
  }

  function renderEnlaces(enlaces) {
    enlacesState = enlaces;
    guardarEnlacesCache(enlaces);
    familyList.replaceChildren();
    familyEmpty.hidden = enlaces.length > 0;

    const hogares = enlaces.reduce((suma, e) => suma + respuestasDe(e).length, 0);
    const personas = enlaces.reduce((suma, e) => suma + totalPersonas(respuestasDe(e)), 0);
    document.getElementById('stat-links').textContent = String(enlaces.length);
    document.getElementById('stat-homes').textContent = String(hogares);
    document.getElementById('stat-people').textContent = String(personas);

    listSummary.textContent = enlaces.length
      ? `${enlaces.length} ${enlaces.length === 1 ? 'enlace' : 'enlaces'} · ${hogares} ${hogares === 1 ? 'hogar' : 'hogares'} · ${personas} ${personas === 1 ? 'persona' : 'personas'}.`
      : 'Todavía no hay enlaces.';
    if (!enlaces.length) return;

    const fragment = document.createDocumentFragment();
    for (const enlace of enlaces) fragment.append(tarjetaEnlace(enlace));
    familyList.append(fragment);
  }

  function fusionarEnlaces(servidor, locales) {
    const mapa = new Map(servidor.map(enlace => [enlace.token, enlace]));
    const limite = Date.now() - 5 * 60 * 1000;
    for (const enlace of locales) {
      if (mapa.has(enlace.token)) continue;
      const creado = Date.parse(enlace.createdAt || enlace.updatedAt || '');
      if (Number.isFinite(creado) && creado > limite) mapa.set(enlace.token, enlace);
    }
    return [...mapa.values()].sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'));
  }

  async function cargarEnlaces() {
    listStatus.textContent = 'Cargando enlaces…';
    try {
      const data = await api('/api/admin/familias');
      const servidor = Array.isArray(data.familias) ? data.familias : [];
      renderEnlaces(fusionarEnlaces(servidor, enlacesState));
      listStatus.textContent = '';
    } catch (error) {
      if (adminToken) listStatus.textContent = mensajeDeError(error);
      document.getElementById('family-empty').hidden = true;
    }
  }

  function limpiarDashboard() {
    enlacesState = [];
    guardarEnlacesCache([]);
    familyList.replaceChildren();
    familyEmpty.hidden = false;
    createdBox.hidden = true;
    createdEmpty.hidden = false;
    for (const id of ['stat-links', 'stat-homes', 'stat-people']) {
      document.getElementById(id).textContent = '0';
    }
    listSummary.textContent = 'Todavía no hay enlaces.';
    listStatus.textContent = '';
    createError.textContent = '';
  }

  // ---------------------------------------------------------
  //  Acciones
  // ---------------------------------------------------------
  createForm.addEventListener('submit', async event => {
    event.preventDefault();
    createError.textContent = '';
    const nombre = newFamilyName.value.trim();
    if (!nombre) {
      createError.textContent = 'Escribe un nombre para el enlace.';
      newFamilyName.focus();
      return;
    }
    const submit = createForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    submit.textContent = 'Creando…';
    try {
      const enlace = await api('/api/admin/familias', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: nombre })
      });
      createdName.textContent = enlace.name;
      createdLink.value = enlaceDe(enlace);
      createdBox.hidden = false;
      createdEmpty.hidden = true;
      newFamilyName.value = '';
      renderEnlaces([...enlacesState.filter(item => item.token !== enlace.token), enlace]);
      listStatus.textContent = `Enlace creado para ${enlace.name}.`;
    } catch (error) {
      createError.textContent = mensajeDeError(error);
    } finally {
      submit.disabled = false;
      submit.textContent = 'Crear enlace';
    }
  });

  document.getElementById('copy-created').addEventListener('click', event => {
    copiar(createdLink.value, event.currentTarget);
  });

  document.getElementById('wa-created').addEventListener('click', () => {
    const nombre = createdName.textContent || 'el encuentro';
    const mensaje = `Hola 👋 Te comparto el enlace de ${nombre} para el Encuentro Barrera (cumpleaños de los abuelos).\n\n${createdLink.value}\n\nEntra, escribe tu nombre y apellido, cuántas personas posiblemente pueden asistir y en qué fechas están disponibles. Cada persona responde por su hogar. No necesitas contraseña ni crear cuenta.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank', 'noopener');
  });

  async function renombrar(enlace) {
    const nuevo = window.prompt('Nuevo nombre del enlace:', enlace.name);
    if (nuevo === null) return;
    const nombre = nuevo.trim();
    if (!nombre || nombre === enlace.name) return;
    try {
      const actualizado = await api(`/api/admin/familias/${enlace.token}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: nombre })
      });
      renderEnlaces(enlacesState.map(item => item.token === actualizado.token ? actualizado : item));
      listStatus.textContent = 'Nombre del enlace actualizado.';
    } catch (error) {
      listStatus.textContent = mensajeDeError(error);
    }
  }

  async function eliminarEnlace(enlace) {
    const hogares = respuestasDe(enlace).length;
    const aviso = hogares
      ? `¿Eliminar el enlace "${enlace.name}"? Su enlace dejará de funcionar y se borrarán sus ${hogares} ${hogares === 1 ? 'respuesta' : 'respuestas'}.`
      : `¿Eliminar el enlace "${enlace.name}"? Su enlace dejará de funcionar.`;
    if (!window.confirm(aviso)) return;
    try {
      await api(`/api/admin/familias/${enlace.token}`, { method: 'DELETE' });
      renderEnlaces(enlacesState.filter(item => item.token !== enlace.token));
      listStatus.textContent = `El enlace "${enlace.name}" fue eliminado.`;
    } catch (error) {
      listStatus.textContent = mensajeDeError(error);
    }
  }

  async function eliminarRespuesta(enlace, respuesta) {
    if (!window.confirm(`¿Borrar la respuesta de ${respuesta.respondent}?`)) return;
    try {
      await api(`/api/admin/respuestas/${enlace.token}/${respuesta.id}`, { method: 'DELETE' });
      const actualizado = {
        ...enlace,
        respuestas: respuestasDe(enlace).filter(r => r.id !== respuesta.id)
      };
      actualizado.hogares = actualizado.respuestas.length;
      actualizado.people = totalPersonas(actualizado.respuestas);
      renderEnlaces(enlacesState.map(item => item.token === enlace.token ? actualizado : item));
      listStatus.textContent = `Se borró la respuesta de ${respuesta.respondent}.`;
    } catch (error) {
      listStatus.textContent = mensajeDeError(error);
    }
  }

  document.getElementById('refresh-button').addEventListener('click', cargarEnlaces);

  document.getElementById('export-button').addEventListener('click', async () => {
    listStatus.textContent = 'Preparando CSV…';
    try {
      const response = await fetch('/api/admin/export', {
        headers: { 'X-Admin-Token': adminToken },
        cache: 'no-store'
      });
      if (response.status === 401) {
        cerrarSesionLocal();
        mostrarLogin('Tu sesión venció. Entra otra vez.');
        return;
      }
      if (!response.ok) throw new Error('No se pudo exportar');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'encuentro-barrera.csv';
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      listStatus.textContent = 'CSV descargado.';
    } catch (error) {
      listStatus.textContent = mensajeDeError(error);
    }
  });

  // ---------------------------------------------------------
  //  Arranque
  // ---------------------------------------------------------
  if (adminToken) {
    mostrarPanel();
    cargarEnlaces();
  } else {
    mostrarLogin();
  }
})();
