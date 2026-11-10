(() => {
  'use strict';

  const EVENT_START = '2026-12-01';
  const EVENT_END = '2027-02-15';
  const PERIOD_LABELS = {
    'dec-01-07': '1–7 dic. · Antes del cumpleaños del abuelo',
    'dec-08-15': '8–15 dic. · Cumpleaños del abuelo',
    'dec-16-23': '16–23 dic. · Antes de Navidad',
    'dec-24-25': '24–25 dic. · Navidad',
    'dec-26-30': '26–30 dic. · Entre fiestas',
    'dec-31-jan-01': '31 dic.–1 ene. · Año Nuevo',
    'jan-02-11': '2–11 ene. · Inicio de año',
    'jan-12-15': '12–15 ene. · Mediados de enero',
    'jan-16-25': '16–25 ene. · Cumpleaños de la abuela',
    'jan-26-feb-15': '26 ene.–15 feb. · Otra fecha'
  };
  const ACTIVITY_LABELS = {
    lunch: 'Almuerzo o cena familiar', picnic: 'Parrillada o picnic', cake: 'Torta, brindis y palabras',
    music: 'Música, baile y karaoke', games: 'Juegos para todas las edades', memories: 'Fotos e historias familiares',
    outing: 'Paseo o actividad fuera de casa', surprise: 'Un detalle sorpresa para los abuelos'
  };

  const token = tokenDeLaUrl();
  const modoFamilia = Boolean(token);

  const form = document.getElementById('family-form');
  const formError = document.getElementById('form-error');
  const feedback = document.getElementById('form-feedback');
  const submitButton = document.getElementById('submit-button');
  const cancelEditButton = document.getElementById('cancel-edit');
  const fromInput = document.getElementById('available-from');
  const toInput = document.getElementById('available-to');
  const nameInput = document.getElementById('family-name');
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

  let family = null;
  let records = [];

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

  function chosen(name) {
    return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map(input => input.value);
  }

  function setChoices(name, values) {
    const selected = new Set(Array.isArray(values) ? values : []);
    document.querySelectorAll(`input[name="${name}"]`).forEach(input => {
      input.checked = selected.has(input.value);
    });
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

  function formatDate(isoDate, includeYear = true) {
    if (!FamilyLogic.validISODate(isoDate)) return 'Fecha no disponible';
    return new Intl.DateTimeFormat('es-ES', {
      day: 'numeric', month: 'long', ...(includeYear ? { year: 'numeric' } : {}), timeZone: 'UTC'
    }).format(new Date(`${isoDate}T12:00:00Z`));
  }

  function dateSpan(from, to) {
    return from === to ? formatDate(from) : `${formatDate(from, false)} – ${formatDate(to)}`;
  }

  function create(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  // ---------------------------------------------------------
  //  Vista según el modo (público o panel familiar)
  // ---------------------------------------------------------
  function aplicarModo() {
    document.body.dataset.mode = modoFamilia ? 'familia' : 'publico';
    document.querySelector('.workspace').classList.toggle('home-mode', !modoFamilia);
    homeEntry.hidden = modoFamilia;
    banner.hidden = !modoFamilia;
    document.querySelector('.responses').hidden = true;
    cancelEditButton.hidden = true;

    if (modoFamilia) {
      document.getElementById('status-text').textContent = 'Panel familiar';
      notice.className = 'notice ok';
      noticeText.innerHTML = '<strong>Tu enlace es privado:</strong> con él puedes guardar y actualizar tu respuesta. Los resultados de abajo se actualizan con lo que responde toda la familia.';
      document.getElementById('footer-note').textContent = 'Tus respuestas se guardan de forma privada y solo se comparten contigo y con la organización.';
      formTitle.textContent = 'Tu respuesta';
      formHelp.textContent = 'Actualiza los datos cuando quieras. Todo queda guardado con tu enlace.';
      setBusy(true, 'Cargando…');
    } else {
      document.getElementById('status-text').textContent = 'Resultados generales';
      notice.className = 'notice';
      noticeText.innerHTML = '<strong>Acceso con enlace:</strong> cada familia entra a su propio panel con el link que le compartieron. Aquí abajo ves el resumen general de la celebración.';
      document.getElementById('footer-note').textContent = 'Cada familia administra su propia respuesta; la organización puede ver y exportar el resumen.';
    }
  }

  // ---------------------------------------------------------
  //  Resumen (sin nombres)
  // ---------------------------------------------------------
  async function cargarResumen() {
    try {
      const data = await api('/api/resumen');
      records = (Array.isArray(data.filas) ? data.filas : []).map((row, index) => ({
        id: `fila-${index}`,
        name: '',
        people: Number(row.people) || 0,
        from: row.from,
        to: row.to,
        periods: Array.isArray(row.periods) ? row.periods : [],
        activities: Array.isArray(row.activities) ? row.activities : [],
        customActivity: ''
      }));
      render();
    } catch (error) {
      if (error.status === 503) {
        notice.className = 'notice error';
        noticeText.innerHTML = '<strong>Base de datos pendiente:</strong> falta conectar el almacenamiento (KV) en Cloudflare. Mientras tanto, las respuestas no se pueden guardar.';
      }
      render();
    }
  }

  function render() {
    const totalPeople = records.reduce((sum, row) => sum + row.people, 0);
    document.getElementById('family-count').textContent = String(records.length);
    document.getElementById('people-count').textContent = String(totalPeople);
    const result = FamilyLogic.recommendBestDates(records, EVENT_START, EVENT_END);
    renderRecommendation(result, totalPeople);
    renderAvailability(result, totalPeople);
    renderRankList(document.getElementById('period-results'), FamilyLogic.countSelections(records, 'periods'), PERIOD_LABELS, 'Aún no hay votos.');
    renderRankList(document.getElementById('activity-results'), FamilyLogic.countSelections(records, 'activities'), ACTIVITY_LABELS, 'Aún no hay ideas votadas.');
  }

  function renderRecommendation(result, totalPeople) {
    const host = document.getElementById('date-recommendations');
    host.replaceChildren();
    if (!records.length || !result.bestDay) {
      host.append(create('div', 'empty-state', 'Aún no hay respuestas con disponibilidad. Guarda una para empezar a comparar fechas.'));
      return;
    }

    const dayCard = create('article', 'recommendation');
    dayCard.append(create('p', 'recommendation-label', 'Mejor opción · 1 día'));
    dayCard.append(create('p', 'recommendation-date', formatDate(result.bestDay.date)));
    const familiasDia = result.bestDay.families;
    dayCard.append(create('p', 'recommendation-meta', `${result.bestDay.people} de ${totalPeople} personas · ${familiasDia} ${familiasDia === 1 ? 'familia disponible' : 'familias disponibles'}`));
    host.append(dayCard);

    const twoDayCard = create('article', 'recommendation secondary');
    twoDayCard.append(create('p', 'recommendation-label', 'Ventana más fuerte · 2 días'));
    if (result.bestTwoDays) {
      twoDayCard.append(create('p', 'recommendation-date', dateSpan(result.bestTwoDays.from, result.bestTwoDays.to)));
      const first = result.daily.find(day => day.date === result.bestTwoDays.from);
      const second = result.daily.find(day => day.date === result.bestTwoDays.to);
      twoDayCard.append(create('p', 'recommendation-meta', `${first.people} personas el primer día y ${second.people} el segundo · suma de disponibilidad en ambos días`));
    } else {
      twoDayCard.append(create('p', 'recommendation-date', 'Faltan respuestas'));
      twoDayCard.append(create('p', 'recommendation-meta', 'Se necesita disponibilidad en dos días consecutivos.'));
    }
    host.append(twoDayCard);
  }

  function renderRankList(host, counts, labels, emptyText, limit = 4) {
    host.replaceChildren();
    const items = Object.entries(counts).map(([key, count]) => ({ key, count, label: labels[key] || key }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'es')).slice(0, limit);
    if (!items.length) {
      host.append(create('p', 'helper', emptyText));
      return;
    }
    const max = items[0].count || 1;
    for (const item of items) {
      const row = create('div', 'rank-row');
      row.setAttribute('aria-label', `${item.label}: ${item.count} ${item.count === 1 ? 'familia' : 'familias'}`);
      row.append(create('span', 'rank-name', item.label));
      row.append(create('span', 'rank-count', `${item.count} ${item.count === 1 ? 'familia' : 'familias'}`));
      const track = create('div', 'bar-track');
      track.setAttribute('aria-hidden', 'true');
      const fill = create('div', 'bar-fill');
      fill.style.width = `${Math.max(8, Math.round(item.count / max * 100))}%`;
      track.append(fill);
      row.append(track);
      host.append(row);
    }
  }

  function renderAvailability(result, totalPeople) {
    const host = document.getElementById('availability-results');
    host.replaceChildren();
    const topDays = result.daily.filter(day => day.people > 0)
      .sort((a, b) => b.people - a.people || b.families - a.families || a.date.localeCompare(b.date)).slice(0, 4);
    if (!topDays.length) {
      host.append(create('p', 'helper', 'Se mostrará al recibir respuestas.'));
      return;
    }
    const max = topDays[0].people || 1;
    for (const day of topDays) {
      const row = create('div', 'rank-row');
      row.append(create('span', 'rank-name', formatDate(day.date)));
      row.append(create('span', 'rank-count', `${day.people}/${totalPeople} personas`));
      const track = create('div', 'bar-track');
      track.setAttribute('aria-hidden', 'true');
      const fill = create('div', 'bar-fill');
      fill.style.width = `${Math.max(8, Math.round(day.people / max * 100))}%`;
      track.append(fill);
      row.append(track);
      host.append(row);
    }
  }

  // ---------------------------------------------------------
  //  Panel familiar
  // ---------------------------------------------------------
  function aplicarfamilia(datos) {
    family = datos;
    bannerName.textContent = datos.name || 'Mi familia';
    const respondida = Number(datos.people) >= 1 && FamilyLogic.validISODate(datos.from) && FamilyLogic.validISODate(datos.to);
    badge.textContent = respondida ? 'Respondida' : 'Pendiente';
    badge.classList.toggle('pending', !respondida);
    bannerHelp.textContent = respondida
      ? 'Ya tenemos tu respuesta. Puedes actualizarla cuando quieras; este enlace es personal.'
      : 'Completa el formulario de abajo. Este enlace es personal y no necesitas contraseña.';

    nameInput.value = datos.name || '';
    document.getElementById('people').value = Number(datos.people) >= 1 ? datos.people : 1;
    fromInput.value = datos.from || '';
    toInput.value = datos.to || '';
    toInput.min = fromInput.value || EVENT_START;
    document.getElementById('custom-idea').value = datos.customActivity || '';
    setChoices('periods', datos.periods);
    setChoices('activities', datos.activities);

    formTitle.textContent = respondida ? `Actualiza tu respuesta, ${datos.name}` : `Hola, ${datos.name || 'familia'}`;
    formHelp.textContent = respondida
      ? 'Estos son los datos que ya guardaste. Cambia lo que necesites y pulsa Guardar.'
      : 'Solo te tomará un minuto. Si algo cambia, puedes volver a este enlace y actualizarlo.';
    setBusy(false);
    if (respondida) {
      showFeedback('Ya registramos tu respuesta. Puedes actualizarla cuando quieras.');
    } else {
      showFeedback('Tu enlace funciona. Completa el formulario para responder.');
    }
  }

  async function cargarFamilia() {
    try {
      const datos = await api(`/api/familia/${token}`);
      aplicarfamilia(datos);
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
  //  Formularios
  // ---------------------------------------------------------
  function formData() {
    return {
      name: nameInput.value.trim(),
      people: Number(document.getElementById('people').value),
      from: fromInput.value,
      to: toInput.value,
      periods: chosen('periods'),
      activities: chosen('activities'),
      customActivity: document.getElementById('custom-idea').value.trim()
    };
  }

  function focusForError(errors) {
    const focusTargets = { name: 'family-name', people: 'people', dates: 'available-from', periods: 'period-choices', activities: 'activity-choices' };
    const target = document.getElementById(focusTargets[errors[0]]);
    if (target) target.focus();
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    clearErrors();

    if (!modoFamilia) {
      showFormError('Abre tu enlace personal para responder.');
      return;
    }

    const data = formData();
    const errors = FamilyLogic.validateResponse(data);
    if (data.periods.length > 3) errors.push('periods');
    if (data.activities.length > 3) errors.push('activities');
    if (errors.length) {
      const messages = {
        name: 'Escribe el nombre de la persona o familia.',
        people: 'Indica entre 1 y 15 personas.',
        dates: 'Revisa el tramo: las fechas deben ser válidas, estar dentro del periodo y la fecha final no puede ser anterior.',
        periods: data.periods.length > 3 ? 'Elige como máximo 3 periodos.' : 'Marca al menos un periodo preferido.',
        activities: data.activities.length > 3 ? 'Elige como máximo 3 ideas.' : 'Marca al menos una idea o escribe una propuesta propia.'
      };
      showFormError(messages[errors[0]] || 'Revisa los campos marcados.');
      focusForError(errors);
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
      showFeedback('¡Listo! Tu respuesta quedó guardada. Puedes volver a este enlace para cambiarla.');
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

  fromInput.addEventListener('change', () => {
    toInput.min = fromInput.value || EVENT_START;
    if (toInput.value && fromInput.value && toInput.value < fromInput.value) toInput.value = '';
  });

  for (const groupName of ['periods', 'activities']) {
    document.querySelectorAll(`input[name="${groupName}"]`).forEach(input => {
      input.addEventListener('change', () => {
        const checked = document.querySelectorAll(`input[name="${groupName}"]:checked`);
        if (checked.length > 3) {
          input.checked = false;
          showFeedback(groupName === 'periods' ? 'Puedes marcar hasta 3 periodos.' : 'Puedes marcar hasta 3 ideas.', 'error');
        } else {
          formError.textContent = '';
          showFeedback('');
        }
      });
    });
  }

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
  cargarResumen();
  if (modoFamilia) cargarFamilia();
})();
