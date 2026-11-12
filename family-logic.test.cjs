const test = require('node:test');
const assert = require('node:assert/strict');
const { validateResponse } = require('./family-logic.js');

test('acepta un nombre y una cantidad válidos', () => {
  assert.deepEqual(validateResponse({ respondent: 'Yerly', people: 4 }), []);
});

test('rechaza el nombre vacío y una cantidad inválida', () => {
  assert.deepEqual(validateResponse({ respondent: '   ', people: 0 }), ['respondent', 'people']);
});

test('rechaza cantidades fuera del rango permitido', () => {
  assert.deepEqual(validateResponse({ respondent: 'Mayo', people: 31 }), ['people']);
  assert.deepEqual(validateResponse({ respondent: 'Berleyna', people: 1.5 }), ['people']);
});
