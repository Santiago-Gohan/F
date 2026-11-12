(function (root) {
  'use strict';

  function isoValida(valor) {
    if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
    const fecha = new Date(valor + 'T00:00:00Z');
    return Number.isFinite(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
  }

  function validateResponse(response) {
    const errors = [];
    const data = response || {};
    const people = Number(data.people);
    const from = typeof data.availableFrom === 'string' ? data.availableFrom.trim() : '';
    const to = typeof data.availableTo === 'string' ? data.availableTo.trim() : '';

    if (typeof data.respondent !== 'string' || !data.respondent.trim()) errors.push('respondent');
    if (!Number.isInteger(people) || people < 1 || people > 30) errors.push('people');
    if (!isoValida(from)) errors.push('availableFrom');
    if (!isoValida(to)) errors.push('availableTo');
    if (isoValida(from) && isoValida(to) && from > to) errors.push('availableTo');

    return errors;
  }

  const api = { validateResponse, isoValida };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FamilyLogic = api;
})(globalThis);
