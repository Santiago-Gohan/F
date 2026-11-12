(() => {
  'use strict';

  const token = tokenDeLaUrl();
  const modoFamilia = Boolean(token);

  const form = document.getElementById('family-form');
  const thankYou = document.getElementById('thank-you');
  const thanksName = document.getElementById('thanks-name');
  const editResponse = document.getElementById('edit-response');
  const formError = document.getElementById('form-error');
  const feedback = document.getElementById('form-feedback');
  const submitButton = document.getElementById('submit-button');
  const respondentInput = document.getElementById('respondent');
  const peopleInput = document.getElementById('people');
  const fromInput = document.getElementById('available-from');
  const toInput = document.getElementById('available-to');
  const proposalInput = document.getElementById('proposal');
  const formTitle = document.getElementById('form-title');
  const formHelp = document.getElementById('form-help');
  const notice = document.getElementById('mode-notice');
  const noticeText = document.getElementById('mode-notice-text');
  const banner = document.getElementById('family-banner');
  const bannerName = document.getElementById('family-banner-name');
  const bannerHelp = document.getElementById('family-banner-help');
  const badge = document.getElementById('family-badge');
  const homeEntry = document.getElementById('home-entry');
  const linkForm = document.getElementById('link-form');
  const linkInput = document.getElementById('link-input');
  const linkError = document.getElementById('link-error');
  const summaryPanel = document.getElementById('summary-panel');
  const summaryList = document.getElementById('summary-list');
  const summaryFamilies = document.getElementById('summary-families');
  const summaryPeople = document.getElementById('summary-people');
  const summaryEmpty = document.getElementById('summary-empty');

  let respuestaLocal = null;
  let resumenFilas = [];

  // ---------------------------------------------------------
  //  Utilidades
  // ---------------------------------------------------------
  function tokenDeLaUrl() {
    const match = location.pathname.match(/^\/f\/([A-Za-z0-9-]{8,64})\/?$/);
    return match ? match[1] : null;
  }

  function tokenDeTexto(valor) {
    const raw = String(valor || '').trim();
    const match = raw.match(/\/f\/([A-Za-z0-9-]{8,64})/);
    if (match) return match[1];
    return /^[A-Za-z0-9-]{8,64}$/.test(raw) ? raw : null;
  }

  async function api(path, options = {}) {
    const response = await fetch(path, {
      cache: 'no-store',
      ...options,
      headers: { accept: 'application/json', ...(options.headers || {}) }
    });
    let body = null;
    try { body = await response.json(); } catch { body = null; }
    if (!response.ok) {
      const error = new Error((body && body.error) || `Error ${response.status}`);
      error.status = response.status;
      error.body = body;
      throw error;
    }
    return body;
  }

  function mensajeDeError(error, porDefecto) {
    if (!error || !error.status) return 'No pudimos conectar con el servidor. Revisa tu internet e intenta de nuevo.';
    if (error.status === 503) return 'La base de datos todavía no está conectada. La organización debe activarla.';
    if (error.status === 404) return 'Este enlace ya no está disponible. Pídele uno nuevo a la organización.';
    if (error.status === 401 || error.status === 403) return 'No tienes permiso para esta acción.';
    return (error.body && error.body.error) || porDefecto;
  }

  function showFeedback(message, kind = 'success') {
    feedback.textContent = message;
    feedback.dataset.kind = kind === 'error' ? 'error' : 'success';
  }

  function showFormError(message) {
    formError.textContent = message;
  }

  function clearErrors() {
    formError.textContent = '';
    showFeedback('');
  }

  function setBusy(busy, label) {
    submitButton.disabled = busy;
    submitButton.textContent = busy ? (label || 'Guardando…') : 'Guardar respuesta';
  }

  function respondida(datos) {
    return Boolean(datos && typeof datos.respondent === 'string' && datos.respondent.trim()) &&
      Number(datos.people) >= 1;
  }

  // ---------------------------------------------------------
  //  Vista según el modo (público o panel familiar)
  // ---------------------------------------------------------
  function aplicarModo() {
    document.body.dataset.mode = modoFamilia ? 'familia' : 'publico';
    document.querySelector('.workspace').classList.toggle('home-mode', !modoFamilia);
    homeEntry.hidden = modoFamilia;
    banner.hidden = !modoFamilia;

    if (modoFamilia) {
      document.getElementById('status-text').textContent = 'Panel familiar';
      notice.className = 'notice ok';
      noticeText.innerHTML = '<strong>Tu enlace es privado:</strong> con él puedes guardar y actualizar tu respuesta.';
      document.getElementById('footer-note').textContent = 'Tus respuestas se guardan de forma privada y solo se comparten contigo y con la organización.';
      setBusy(true, 'Cargando…');
    } else {
      summaryPanel.hidden = true;
      document.getElementById('status-text').textContent = 'Familia Barrera';
      notice.className = 'notice';
      noticeText.innerHTML = '<strong>Acceso con enlace:</strong> cada familia entra a su propio panel con el link que le compartieron.';
      document.getElementById('footer-note').textContent = 'Cada familia administra su propia respuesta; la organización puede ver y exportar el resumen.';
    }
  }

  // ---------------------------------------------------------
  //  Participación (solo para familias con enlace)
  // ---------------------------------------------------------
  function fechaRespuesta(iso) {
    const fecha = new Date(iso);
    if (!Number.isFinite(fecha.getTime())) return '';
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(fecha);
  }

  function fechaDisponible(iso) {
    if (!iso) return '';
    const fecha = new Date(`${iso}T00:00:00`);
    if (!Number.isFinite(fecha.getTime())) return '';
    return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' }).format(fecha);
  }

  function rangoDisponible(desde, hasta) {
    const a = fechaDisponible(desde);
    const b = fechaDisponible(hasta);
    if (!a || !b) return '';
    return a === b ? a : `${a} – ${b}`;
  }

  function renderResumen(filas) {
    if (!modoFamilia) {
      summaryPanel.hidden = true;
      return;
    }
    const lista = filas.filter(f => f && String(f.respondent || '').trim() && Number(f.people) >= 1);
    summaryFamilies.textContent = String(lista.length);
    summaryPeople.textContent = String(lista.reduce((suma, f) => suma + Number(f.people), 0));
    summaryList.replaceChildren();

    for (const fila of lista) {
      const item = document.createElement('li');
      item.className = 'summary-item';
      const info = document.createElement('div');
      const nombre = document.createElement('strong');
      nombre.textContent = String(fila.respondent).trim();
      info.append(nombre);
      const fecha = fechaRespuesta(fila.updatedAt);
      if (fecha) {
        const detalle = document.createElement('small');
        detalle.textContent = `Respondió el ${fecha}`;
        info.append(detalle);
      }
      const rango = rangoDisponible(fila.availableFrom, fila.availableTo);
      if (rango) {
        const detalle = document.createElement('small');
        detalle.textContent = `Disponible ${rango}`;
        info.append(detalle);
      }
      const cantidad = document.createElement('span');
      const personas = Number(fila.people);
      cantidad.textContent = `${personas} ${personas === 1 ? 'persona' : 'personas'}`;
      item.append(info, cantidad);
      summaryList.append(item);
    }

    summaryEmpty.hidden = lista.length > 0;
    summaryPanel.hidden = lista.length === 0;
  }

  function combinarResumen(filas) {
    const mapa = new Map();
    const todas = respuestaLocal ? [...filas, respuestaLocal] : filas;
    for (const fila of todas) {
      const clave = String(fila && fila.respondent || '').trim().toLowerCase();
      if (!clave || Number(fila.people) < 1) continue;
      const previa = mapa.get(clave);
      if (!previa || String(fila.updatedAt || '') > String(previa.updatedAt || '')) mapa.set(clave, fila);
    }
    return [...mapa.values()].sort((a, b) => String(a.respondent).localeCompare(String(b.respondent), 'es'));
  }

  async function cargarResumen() {
    if (!modoFamilia) return;
    if (respuestaLocal) {
      resumenFilas = combinarResumen([...resumenFilas, respuestaLocal]);
      renderResumen(resumenFilas);
    }
    try {
      const data = await api('/api/resumen');
      resumenFilas = combinarResumen(Array.isArray(data.filas) ? data.filas : []);
      renderResumen(resumenFilas);
    } catch {
      // El resumen es informativo; si falla, la encuesta sigue funcionando.
    }
  }

  // ---------------------------------------------------------
  //  Panel familiar
  // ---------------------------------------------------------
  function mostrarAgradecimiento(datos) {
    thanksName.textContent = datos.respondent || '';
    form.hidden = true;
    thankYou.hidden = false;
    formTitle.textContent = '¡Gracias por responder!';
    formHelp.textContent = 'Tu respuesta quedó guardada.';
    setBusy(false);
    showFeedback('');
  }

  function mostrarFormulario(editando, nombreFamilia) {
    form.hidden = false;
    thankYou.hidden = true;
    formTitle.textContent = editando ? 'Actualiza tu respuesta' : `Hola, ${nombreFamilia || 'familia'}`;
    formHelp.textContent = editando
      ? 'Cambia lo que necesites y pulsa Guardar.'
      : 'Escribe tu nombre y apellido, cuántas personas posiblemente pueden asistir y en qué fechas.';
    setBusy(false);
    if (!editando) showFeedback('Tu enlace funciona. Completa los datos para responder.');
  }

  function aplicarfamilia(datos) {
    bannerName.textContent = datos.name || 'Mi familia';
    const lista = respondida(datos);
    badge.textContent = lista ? 'Respondida' : 'Pendiente';
    badge.classList.toggle('pending', !lista);
    bannerHelp.textContent = lista
      ? 'Ya tenemos tu respuesta. Puedes actualizarla cuando quieras; este enlace es personal.'
      : 'Completa tus datos abajo. Este enlace es personal y no necesitas contraseña.';

    respondentInput.value = datos.respondent || '';
    peopleInput.value = Number(datos.people) >= 1 ? String(datos.people) : '';
    fromInput.value = datos.availableFrom || '';
    toInput.value = datos.availableTo || '';
    proposalInput.value = datos.proposal || '';

    if (lista) mostrarAgradecimiento(datos);
    else mostrarFormulario(false, datos.name);
  }

  async function cargarFamilia() {
    try {
      const datos = await api(`/api/familia/${token}`);
      aplicarfamilia(datos);
      if (respondida(datos)) {
        respuestaLocal = {
          respondent: datos.respondent,
          people: Number(datos.people),
          availableFrom: datos.availableFrom || '',
          availableTo: datos.availableTo || '',
          updatedAt: datos.updatedAt
        };
      }
    } catch (error) {
      setBusy(true, 'No disponible');
      bannerHelp.textContent = 'No pudimos cargar tu panel.';
      badge.textContent = 'Sin acceso';
      badge.classList.add('pending');
      notice.className = 'notice error';
      noticeText.innerHTML = '<strong>No pudimos abrir tu panel:</strong> ' + mensajeDeError(error, 'Revisa el enlace e intenta de nuevo.');
      showFormError(mensajeDeError(error, 'Enlace no válido.'));
    }
  }

  // ---------------------------------------------------------
  //  Formulario
  // ---------------------------------------------------------
  form.addEventListener('submit', async event => {
    event.preventDefault();
    clearErrors();

    if (!modoFamilia) {
      showFormError('Abre tu enlace personal para responder.');
      return;
    }

    const data = {
      respondent: respondentInput.value.trim(),
      people: Number(peopleInput.value),
      availableFrom: fromInput.value,
      availableTo: toInput.value,
      proposal: proposalInput.value.trim()
    };
    const errors = FamilyLogic.validateResponse(data);
    if (errors.length) {
      const messages = {
        respondent: 'Escribe tu nombre y apellido.',
        people: 'Indica una cantidad entre 1 y 30 personas.',
        availableFrom: 'Indica desde qué fecha están disponibles.',
        availableTo: 'Indica hasta qué fecha están disponibles (debe ser igual o posterior al inicio).'
      };
      showFormError(messages[errors[0]] || 'Revisa los datos.');
      const campo = errors[0] === 'respondent' ? respondentInput
        : errors[0] === 'people' ? peopleInput
        : errors[0] === 'availableFrom' ? fromInput
        : toInput;
      campo.focus();
      return;
    }

    setBusy(true);
    try {
      const guardada = await api(`/api/familia/${token}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data)
      });
      aplicarfamilia(guardada);
      respuestaLocal = {
        respondent: guardada.respondent,
        people: Number(guardada.people),
        availableFrom: guardada.availableFrom || '',
        availableTo: guardada.availableTo || '',
        updatedAt: guardada.updatedAt
      };
      await cargarResumen();
    } catch (error) {
      const campos = error.body && error.body.campos;
      showFormError(campos && campos.length
        ? 'Revisa los campos marcados: ' + campos.join(', ')
        : mensajeDeError(error, 'No se pudo guardar la respuesta.'));
      showFeedback('No se pudo guardar. Intenta otra vez.', 'error');
    } finally {
      setBusy(false);
    }
  });

  editResponse.addEventListener('click', () => {
    mostrarFormulario(true, bannerName.textContent);
    clearErrors();
    respondentInput.focus();
  });

  linkForm.addEventListener('submit', event => {
    event.preventDefault();
    linkError.textContent = '';
    const destino = tokenDeTexto(linkInput.value);
    if (!destino) {
      linkError.textContent = 'Ese enlace no parece válido. Copia el link completo que te compartieron.';
      linkInput.focus();
      return;
    }
    location.href = `/f/${destino}`;
  });

  // ---------------------------------------------------------
  //  Arranque
  // ---------------------------------------------------------
  aplicarModo();
  if (modoFamilia) {
    cargarFamilia().then(cargarResumen);
  }
})();
