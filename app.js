(() => {
  'use strict';

  const STORAGE_KEY = 'encuentro-familiar-demo-v1';
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

  const form = document.getElementById('family-form');
  const formError = document.getElementById('form-error');
  const feedback = document.getElementById('form-feedback');
  const submitButton = document.getElementById('submit-button');
  const cancelEditButton = document.getElementById('cancel-edit');
  const fromInput = document.getElementById('available-from');
  const toInput = document.getElementById('available-to');
  const responseRows = document.getElementById('response-rows');
  let records = loadRecords();
  let editingId = null;

  function loadRecords() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(saved)) return [];
      return saved.filter(row => row && typeof row.id === 'string' && typeof row.name === 'string' &&
        Number.isInteger(Number(row.people)) && FamilyLogic.validISODate(row.from) && FamilyLogic.validISODate(row.to) && row.from <= row.to)
        .map(row => ({
          id: row.id, name: row.name.slice(0, 70), people: Number(row.people), from: row.from, to: row.to,
          periods: Array.isArray(row.periods) ? row.periods.filter(value => Object.hasOwn(PERIOD_LABELS, value)) : [],
          activities: Array.isArray(row.activities) ? row.activities.filter(value => Object.hasOwn(ACTIVITY_LABELS, value)) : [],
          customActivity: typeof row.customActivity === 'string' ? row.customActivity.slice(0, 240) : ''
        }));
    } catch {
      return [];
    }
  }

  function storeRecords(nextRecords) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextRecords));
      return true;
    } catch {
      return false;
    }
  }

  function makeId() {
    return globalThis.crypto && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function chosen(name) {
    return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map(input => input.value);
  }

  function setChoices(name, values) {
    const selected = new Set(values);
    document.querySelectorAll(`input[name="${name}"]`).forEach(input => { input.checked = selected.has(input.value); });
  }

  function showFeedback(message, kind = 'success') {
    feedback.textContent = message;
    feedback.dataset.kind = kind === 'error' ? 'error' : 'success';
  }

  function clearErrors() {
    formError.textContent = '';
    showFeedback('');
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
    dayCard.append(create('p', 'recommendation-meta', `${result.bestDay.people} de ${totalPeople} personas · ${result.bestDay.families} familias disponibles`));
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

  function renderTable() {
    responseRows.replaceChildren();
    const empty = document.getElementById('table-empty');
    empty.hidden = records.length > 0;
    document.getElementById('export-button').disabled = records.length === 0;
    document.getElementById('response-count-label').textContent = records.length
      ? `${records.length} ${records.length === 1 ? 'familia ha' : 'familias han'} respondido en este navegador.`
      : 'Todavía no hay respuestas guardadas en este navegador.';

    for (const record of records) {
      const row = document.createElement('tr');
      const family = create('td', '', record.name);
      const people = create('td', '', String(record.people));
      const availability = create('td', '', dateSpan(record.from, record.to));
      const selectedLabels = record.periods.map(id => PERIOD_LABELS[id]).concat(record.activities.map(id => ACTIVITY_LABELS[id]));
      if (record.customActivity) selectedLabels.push(record.customActivity);
      const choices = create('td', '', selectedLabels.length ? selectedLabels.join(' · ') : '—');
      const actions = create('td');
      const actionGroup = create('div', 'row-actions');
      const editButton = create('button', 'text-button', 'Editar');
      editButton.type = 'button';
      editButton.addEventListener('click', () => beginEdit(record.id));
      const deleteButton = create('button', 'text-button delete', 'Eliminar');
      deleteButton.type = 'button';
      deleteButton.addEventListener('click', () => deleteRecord(record.id));
      actionGroup.append(editButton, deleteButton);
      actions.append(actionGroup);
      row.append(family, people, availability, choices, actions);
      responseRows.append(row);
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
    renderTable();
  }

  function normalizedName(value) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('es');
  }

  function formData() {
    return {
      name: document.getElementById('family-name').value.trim(),
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

  function beginEdit(id) {
    const record = records.find(item => item.id === id);
    if (!record) return;
    editingId = id;
    document.getElementById('family-name').value = record.name;
    document.getElementById('people').value = record.people;
    fromInput.value = record.from;
    toInput.value = record.to;
    document.getElementById('custom-idea').value = record.customActivity;
    setChoices('periods', record.periods);
    setChoices('activities', record.activities);
    submitButton.textContent = 'Actualizar respuesta';
    cancelEditButton.hidden = false;
    document.getElementById('form-title').textContent = 'Editar respuesta de ' + record.name;
    clearErrors();
    document.getElementById('family-name').focus();
    document.querySelector('.form-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function resetForm() {
    form.reset();
    editingId = null;
    submitButton.textContent = 'Guardar respuesta';
    cancelEditButton.hidden = true;
    document.getElementById('form-title').textContent = '¿Cuándo y cómo puedes celebrar?';
    toInput.min = EVENT_START;
    clearErrors();
  }

  function deleteRecord(id) {
    const record = records.find(item => item.id === id);
    if (!record || !window.confirm(`¿Eliminar la respuesta de ${record.name}?`)) return;
    const nextRecords = records.filter(item => item.id !== id);
    if (!storeRecords(nextRecords)) {
      showFeedback('No se pudo guardar el cambio en este navegador.', 'error');
      return;
    }
    records = nextRecords;
    if (editingId === id) resetForm();
    render();
    showFeedback('Respuesta eliminada.');
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    clearErrors();
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
      formError.textContent = messages[errors[0]] || 'Revisa los campos marcados.';
      focusForError(errors);
      return;
    }

    const existingByName = records.find(row => normalizedName(row.name) === normalizedName(data.name));
    const targetId = editingId || (existingByName && existingByName.id) || makeId();
    const nextRecord = { ...data, id: targetId };
    const nextRecords = records.some(row => row.id === targetId)
      ? records.map(row => row.id === targetId ? nextRecord : row)
      : [...records, nextRecord];
    if (!storeRecords(nextRecords)) {
      showFeedback('No se pudo guardar. El navegador podría tener el almacenamiento desactivado o lleno.', 'error');
      return;
    }
    const wasUpdate = Boolean(editingId || existingByName);
    records = nextRecords;
    resetForm();
    render();
    showFeedback(wasUpdate ? 'Respuesta actualizada en este navegador.' : 'Respuesta guardada en este navegador.');
  });

  cancelEditButton.addEventListener('click', resetForm);
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

  function csvCell(value) {
    let text = String(value ?? '');
    if (/^[\u0000-\u0020]*[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  }

  document.getElementById('export-button').addEventListener('click', () => {
    const headers = ['Familia', 'Personas', 'Libre desde', 'Libre hasta', 'Periodos preferidos', 'Ideas', 'Otra propuesta'];
    const lines = [headers, ...records.map(row => [
      row.name, row.people, row.from, row.to,
      row.periods.map(id => PERIOD_LABELS[id] || id).join(' | '),
      row.activities.map(id => ACTIVITY_LABELS[id] || id).join(' | '), row.customActivity
    ])].map(line => line.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF', lines], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'respuestas-encuentro-familiar.csv';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  document.getElementById('print-button').addEventListener('click', () => window.print());
  render();
})();
