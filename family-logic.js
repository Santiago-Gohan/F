(function (root) {
  'use strict';

  function validateResponse(response) {
    const errors = [];
    const data = response || {};
    const people = Number(data.people);
    if (typeof data.respondent !== 'string' || !data.respondent.trim()) errors.push('respondent');
    if (!Number.isInteger(people) || people < 1 || people > 30) errors.push('people');
    return errors;
  }

  const api = { validateResponse };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FamilyLogic = api;
})(globalThis);
