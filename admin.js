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
  let familiasState = leerFamiliasCache();

  function leerFamiliasCache() {
    try {
      const datos = JSON.parse(sessionStorage.getItem(STORAGE_FAMILIAS) || '[]');
      return Array.isArray(datos) ? datos.filter(f => f && typeof f.token === 'string') : [];
    } catch {
      return [];
    }
  }

  function guardarFamiliasCache(familias) {
    try { sessionStorage.setItem(STORAGE_FAMILIAS, JSON.stringify(familias)); } catch { /* sin caché */ }
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
    const clave = adminKey.value;
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
      await cargarFamilias();
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
  function respondio(familia) {
    return Boolean(familia && String(familia.respondent || '').trim()) && Number(familia.people) >= 1;
  }

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

  function enlaceDe(familia) {
    return `${location.origin}/f/${familia.token}`;
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

  function mensajeWhatsApp(familia) {
    return `Hola 👋 Te comparto tu enlace personal para el Encuentro Barrera (cumpleaños de los abuelos).\n\n${enlaceDe(familia)}\n\nEntra, escribe tu nombre y apellido, cuántas personas posiblemente pueden asistir y en qué fechas están disponibles. No necesitas contraseña ni crear cuenta.`;
  }

  function abrirWhatsApp(familia) {
    window.open(`https://wa.me/?text=${encodeURIComponent(mensajeWhatsApp(familia))}`, '_blank', 'noopener');
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

  function tarjetaFamilia(familia) {
    const card = elemento('article', 'family-card');
    const respondida = respondio(familia);

    const head = elemento('div', 'family-card-head');
    head.append(elemento('h3', '', familia.name));
    head.append(elemento('span', respondida ? 'badge' : 'badge pending', respondida ? 'Respondió' : 'Pendiente'));
    card.append(head);

    const meta = elemento('dl', 'family-meta');
    const datos = [
      ['Quién responde', respondida ? familia.respondent : 'Sin responder'],
      ['Personas', respondida ? String(familia.people) : '-'],
      ['Disponible', respondida ? rangoFechas(familia.availableFrom, familia.availableTo) : '-'],
      ['Actualizado', fecha(familia.updatedAt)]
    ];
    for (const [clave, valor] of datos) {
      const bloque = elemento('div');
      bloque.append(elemento('dt', '', clave));
      bloque.append(elemento('dd', '', valor));
      meta.append(bloque);
    }

    const propuesta = respondida ? (familia.proposal || '').trim() : '';
    const bloquePropuesta = elemento('div', 'wide');
    bloquePropuesta.append(elemento('dt', '', 'Propuesta para el evento'));
    bloquePropuesta.append(elemento('dd', '', respondida ? (propuesta || 'Sin propuesta') : '-'));
    meta.append(bloquePropuesta);
    card.append(meta);

    const linkRow = elemento('div', 'family-link');
    const input = document.createElement('input');
    input.type = 'text';
    input.readOnly = true;
    input.value = enlaceDe(familia);
    input.setAttribute('aria-label', `Enlace de ${familia.name}`);
    const copiarBtn = boton('Copiar', 'btn btn-quiet btn-small', () => copiar(enlaceDe(familia), copiarBtn));
    const waBtn = boton('WhatsApp', 'btn btn-primary btn-small', () => abrirWhatsApp(familia));
    linkRow.append(input, copiarBtn, waBtn);
    card.append(linkRow);

    const actions = elemento('div', 'family-actions');
    actions.append(boton('Renombrar', 'btn btn-quiet btn-small', () => renombrar(familia)));
    actions.append(boton('Eliminar', 'btn btn-danger btn-small', () => eliminar(familia)));
    card.append(actions);

    return card;
  }

  function renderFamilias(familias) {
    familiasState = familias;
    guardarFamiliasCache(familias);
    familyList.replaceChildren();
    familyEmpty.hidden = familias.length > 0;
    const respondidas = familias.filter(respondio);
    const personas = respondidas.reduce((suma, f) => suma + Number(f.people), 0);
    document.getElementById('stat-total').textContent = String(familias.length);
    document.getElementById('stat-answered').textContent = String(respondidas.length);
    document.getElementById('stat-pending').textContent = String(familias.length - respondidas.length);
    document.getElementById('stat-people').textContent = String(personas);
    listSummary.textContent = familias.length
      ? `${familias.length} ${familias.length === 1 ? 'hogar creado' : 'hogares creados'} · ${respondidas.length} ${respondidas.length === 1 ? 'respondió' : 'respondieron'}.`
      : 'Todavía no hay hogares.';
    if (!familias.length) return;

    const fragment = document.createDocumentFragment();
    for (const familia of familias) fragment.append(tarjetaFamilia(familia));
    familyList.append(fragment);
  }

  function fusionarFamilias(servidor, locales) {
    const mapa = new Map(servidor.map(familia => [familia.token, familia]));
    const limite = Date.now() - 5 * 60 * 1000;
    for (const familia of locales) {
      const enServidor = mapa.get(familia.token);
      if (enServidor) {
        if (String(familia.updatedAt || '') > String(enServidor.updatedAt || '')) mapa.set(familia.token, familia);
        continue;
      }
      const creada = Date.parse(familia.createdAt || familia.updatedAt || '');
      if (Number.isFinite(creada) && creada > limite) mapa.set(familia.token, familia);
    }
    return [...mapa.values()].sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'));
  }

  async function cargarFamilias() {
    listStatus.textContent = 'Cargando hogares…';
    try {
      const data = await api('/api/admin/familias');
      const servidor = Array.isArray(data.familias) ? data.familias : [];
      renderFamilias(fusionarFamilias(servidor, familiasState));
      listStatus.textContent = '';
    } catch (error) {
      if (adminToken) listStatus.textContent = mensajeDeError(error);
      document.getElementById('family-empty').hidden = true;
    }
  }

  function limpiarDashboard() {
    familiasState = [];
    guardarFamiliasCache([]);
    familyList.replaceChildren();
    familyEmpty.hidden = false;
    createdBox.hidden = true;
    createdEmpty.hidden = false;
    for (const id of ['stat-total', 'stat-answered', 'stat-pending', 'stat-people']) {
      document.getElementById(id).textContent = '0';
    }
    listSummary.textContent = 'Todavía no hay hogares.';
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
      createError.textContent = 'Escribe el nombre del hogar.';
      newFamilyName.focus();
      return;
    }
    const submit = createForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    submit.textContent = 'Creando…';
    try {
      const familia = await api('/api/admin/familias', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: nombre })
      });
      createdName.textContent = familia.name;
      createdLink.value = enlaceDe(familia);
      createdBox.hidden = false;
      createdEmpty.hidden = true;
      newFamilyName.value = '';
      renderFamilias([...familiasState.filter(item => item.token !== familia.token), familia]);
      listStatus.textContent = `Enlace creado para ${familia.name}.`;
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
    const nombre = createdName.textContent || 'Hogar';
    const mensaje = `Hola 👋 Te comparto el enlace personal de ${nombre} para el Encuentro Barrera.\n\n${createdLink.value}\n\nEntra, escribe tu nombre y apellido, cuántas personas posiblemente pueden asistir y en qué fechas están disponibles. No necesitas contraseña ni crear cuenta.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank', 'noopener');
  });

  async function renombrar(familia) {
    const nuevo = window.prompt('Nuevo nombre del hogar:', familia.name);
    if (nuevo === null) return;
    const nombre = nuevo.trim();
    if (!nombre || nombre === familia.name) return;
    try {
      const actualizada = await api(`/api/admin/familias/${familia.token}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: nombre })
      });
      renderFamilias(familiasState.map(item => item.token === actualizada.token ? actualizada : item));
      listStatus.textContent = 'Nombre actualizado.';
    } catch (error) {
      listStatus.textContent = mensajeDeError(error);
    }
  }

  async function eliminar(familia) {
    if (!window.confirm(`¿Eliminar a ${familia.name}? Su enlace dejará de funcionar y su respuesta se borrará.`)) return;
    try {
      await api(`/api/admin/familias/${familia.token}`, { method: 'DELETE' });
      renderFamilias(familiasState.filter(item => item.token !== familia.token));
      listStatus.textContent = `${familia.name} fue eliminado.`;
    } catch (error) {
      listStatus.textContent = mensajeDeError(error);
    }
  }

  document.getElementById('refresh-button').addEventListener('click', cargarFamilias);

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
    cargarFamilias();
  } else {
    mostrarLogin();
  }
})();
