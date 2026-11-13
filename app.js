(() => {
  'use strict';

  const token = tokenDeLaUrl();
  const modoEnlace = Boolean(token);
  const CLAVE_LOCAL = token ? `encuentro-respuesta:${token}` : '';
  const ID_VALIDO = /^[A-Za-z0-9-]{6,64}$/;

  const form = document.getElementById('family-form');
  const thankYou = document.getElementById('thank-you');
  const thanksName = document.getElementById('thanks-name');
  const editResponse = document.getElementById('edit-response');
  const addResponse = document.getElementById('add-response');
  const cancelEdit = document.getElementById('cancel-edit');
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
  const summaryHogares = document.getElementById('summary-families');
  const summaryPeople = document.getElementById('summary-people');
  const summaryEmpty = document.getElementById('summary-empty');

  let idGuardado = leerIdLocal();
  let miId = '';
  let miRespuesta = null;
  let respuestasEnlace = [];

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

  function leerIdLocal() {
    if (!CLAVE_LOCAL) return '';
    try {
      const datos = JSON.parse(localStorage.getItem(CLAVE_LOCAL) || 'null');
      const id = datos && datos.id;
      return typeof id === 'string' && ID_VALIDO.test(id) ? id : '';
    } catch {
      return '';
    }
  }

  function guardarIdLocal(id) {
    if (!CLAVE_LOCAL || !ID_VALIDO.test(String(id || ''))) return;
    try { localStorage.setItem(CLAVE_LOCAL, JSON.stringify({ id })); } catch { /* sin almacenamiento */ }
  }

  function borrarIdLocal() {
    if (!CLAVE_LOCAL) return;
    try { localStorage.removeItem(CLAVE_LOCAL); } catch { /* sin almacenamiento */ }
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
  //  Vista según el modo (público o enlace)
  // ---------------------------------------------------------
  function aplicarModo() {
    document.body.dataset.mode = modoEnlace ? 'familia' : 'publico';
    document.querySelector('.workspace').classList.toggle('home-mode', !modoEnlace);
    homeEntry.hidden = modoEnlace;
    banner.hidden = !modoEnlace;

    if (modoEnlace) {
      document.getElementById('status-text').textContent = 'Encuentro Barrera';
      notice.className = 'notice ok';
      noticeText.innerHTML = '<strong>Un solo enlace para toda la familia:</strong> cada persona escribe su nombre y guarda su propia respuesta.';
      document.getElementById('footer-note').textContent = 'Cada persona guarda su respuesta por separado y puede editarla desde el mismo dispositivo.';
      setBusy(true, 'Cargando…');
    } else {
      summaryPanel.hidden = true;
      document.getElementById('status-text').textContent = 'Familia Barrera';
      notice.className = 'notice';
      noticeText.innerHTML = '<strong>Acceso con enlace:</strong> pide el enlace del encuentro y responde por tu hogar.';
      document.getElementById('footer-note').textContent = 'Cada persona responde por su hogar; la organización puede ver y exportar el resumen.';
    }
  }

  // ---------------------------------------------------------
  //  Resumen de respuestas del enlace
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

  function fusionarListas(previas, nuevas) {
    const mapa = new Map();
    for (const fila of [...previas, ...nuevas]) {
      if (!respondida(fila)) continue;
      const clave = String(fila.respondent).trim().toLowerCase();
      if (!clave) continue;
      const previa = mapa.get(clave);
      if (!previa || String(fila.updatedAt || '') >= String(previa.updatedAt || '')) mapa.set(clave, fila);
    }
    return [...mapa.values()];
  }

  function combinarRespuestas(lista) {
    return fusionarListas(lista, miRespuesta ? [miRespuesta] : [])
      .sort((a, b) => String(a.respondent).localeCompare(String(b.respondent), 'es'));
  }

  function renderResumen(filas) {
    if (!modoEnlace) {
      summaryPanel.hidden = true;
      return;
    }
    const lista = combinarRespuestas(Array.isArray(filas) ? filas : []);
    summaryHogares.textContent = String(lista.length);
    summaryPeople.textContent = String(lista.reduce((suma, f) => suma + Number(f.people || 0), 0));
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

  // ---------------------------------------------------------
  //  Formulario y estados
  // ---------------------------------------------------------
  function rellenarFormulario(datos) {
    respondentInput.value = datos.respondent || '';
    peopleInput.value = Number(datos.people) >= 1 ? String(datos.people) : '';
    fromInput.value = datos.availableFrom || '';
    toInput.value = datos.availableTo || '';
    proposalInput.value = datos.proposal || '';
  }

  function limpiarFormulario() {
    respondentInput.value = '';
    peopleInput.value = '';
    fromInput.value = '';
    toInput.value = '';
    proposalInput.value = '';
  }

  function actualizarBadge(tieneRespuesta) {
    badge.textContent = tieneRespuesta ? 'Respondida' : 'Pendiente';
    badge.classList.toggle('pending', !tieneRespuesta);
    bannerHelp.textContent = tieneRespuesta
      ? 'Ya guardaste tu respuesta desde este dispositivo. Puedes editarla cuando quieras.'
      : 'Cada persona responde por su hogar. Escribe tu nombre y guarda tu respuesta.';
  }

  function mostrarAgradecimiento(datos) {
    thanksName.textContent = datos.respondent || '';
    form.hidden = true;
    thankYou.hidden = false;
    formTitle.textContent = '¡Gracias por responder!';
    formHelp.textContent = 'Tu respuesta quedó guardada.';
    addResponse.hidden = false;
    setBusy(false);
    clearErrors();
  }

  function mostrarFormulario(editando) {
    form.hidden = false;
    thankYou.hidden = true;
    formTitle.textContent = editando ? 'Actualiza tu respuesta' : 'Registra tu respuesta';
    formHelp.textContent = editando
      ? 'Cambia lo que necesites y pulsa Guardar respuesta.'
      : 'Escribe tu nombre y apellido, cuántas personas posiblemente pueden asistir y en qué fechas.';
    cancelEdit.hidden = !editando;
    setBusy(false);
    if (!editando) showFeedback('Completa los datos para guardar tu respuesta.');
  }

  // ---------------------------------------------------------
  //  Carga del enlace
  // ---------------------------------------------------------
  async function recargarResumen() {
    try {
      const datos = await api(`/api/familia/${token}`);
      const nuevas = Array.isArray(datos.respuestas) ? datos.respuestas : [];
      // KV puede tardar unos segundos en reflejar una respuesta nueva:
      // se conserva lo que ya estaba en pantalla y se añade lo que llegue.
      respuestasEnlace = fusionarListas(respuestasEnlace, nuevas);
      if (miRespuesta) respuestasEnlace = fusionarListas(respuestasEnlace, [miRespuesta]);
      renderResumen(respuestasEnlace);
    } catch {
      // El resumen es informativo; la encuesta sigue funcionando.
    }
  }

  async function cargarEnlace() {
    try {
      const datos = await api(`/api/familia/${token}`);
      bannerName.textContent = datos.name || 'Encuentro Barrera';
      respuestasEnlace = Array.isArray(datos.respuestas) ? datos.respuestas : [];
      renderResumen(respuestasEnlace);

      if (idGuardado) {
        try {
          const mia = await api(`/api/familia/${token}/${idGuardado}`);
          miId = idGuardado;
          miRespuesta = mia;
          respuestasEnlace = fusionarListas(respuestasEnlace, [mia]);
          renderResumen(respuestasEnlace);
          rellenarFormulario(mia);
          actualizarBadge(true);
          mostrarAgradecimiento(mia);
          return;
        } catch (error) {
          if (error.status !== 404) throw error;
          borrarIdLocal();
          idGuardado = '';
        }
      }

      miId = '';
      miRespuesta = null;
      actualizarBadge(false);
      mostrarFormulario(false);
    } catch (error) {
      setBusy(true, 'No disponible');
      bannerHelp.textContent = 'No pudimos cargar el enlace.';
      badge.textContent = 'Sin acceso';
      badge.classList.add('pending');
      notice.className = 'notice error';
      noticeText.innerHTML = '<strong>No pudimos abrir el enlace:</strong> ' + mensajeDeError(error, 'Revisa el enlace e intenta de nuevo.');
      showFormError(mensajeDeError(error, 'Enlace no válido.'));
    }
  }

  // ---------------------------------------------------------
  //  Envío del formulario
  // ---------------------------------------------------------
  form.addEventListener('submit', async event => {
    event.preventDefault();
    clearErrors();

    if (!modoEnlace) {
      showFormError('Abre el enlace del encuentro para responder.');
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
      const ruta = miId
        ? `/api/familia/${token}/${miId}`
        : `/api/familia/${token}`;
      const guardada = await api(ruta, {
        method: miId ? 'PUT' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data)
      });
      miId = guardada.id || miId;
      idGuardado = miId;
      miRespuesta = guardada;
      guardarIdLocal(miId);
      respuestasEnlace = fusionarListas(respuestasEnlace, [guardada]);
      rellenarFormulario(guardada);
      actualizarBadge(true);
      mostrarAgradecimiento(guardada);
      await recargarResumen();
    } catch (error) {
      if (error.status === 404 && miId) {
        // La respuesta ya no existe (la borró la organización): se crea una nueva.
        miId = '';
        miRespuesta = null;
        borrarIdLocal();
        idGuardado = '';
      }
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
    if (!miRespuesta) return;
    rellenarFormulario(miRespuesta);
    mostrarFormulario(true);
    clearErrors();
    respondentInput.focus();
  });

  addResponse.addEventListener('click', () => {
    miId = '';
    miRespuesta = null;
    limpiarFormulario();
    actualizarBadge(false);
    mostrarFormulario(false);
    respondentInput.focus();
  });

  cancelEdit.addEventListener('click', () => {
    if (!miRespuesta) {
      mostrarFormulario(false);
      return;
    }
    miId = idGuardado;
    rellenarFormulario(miRespuesta);
    actualizarBadge(true);
    mostrarAgradecimiento(miRespuesta);
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
  if (modoEnlace) cargarEnlace();
})();
