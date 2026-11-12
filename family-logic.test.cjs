const test = require('node:test');
const assert = require('node:assert/strict');
const { validateResponse } = require('./family-logic.js');

const FECHAS = { availableFrom: '2026-12-08', availableTo: '2026-12-15' };

test('acepta nombre, cantidad y fechas válidas', () => {
  assert.deepEqual(validateResponse({ respondent: 'Yerly', people: 4, ...FECHAS }), []);
});

test('rechaza el nombre vacío y una cantidad inválida', () => {
  assert.deepEqual(validateResponse({ respondent: '   ', people: 0, ...FECHAS }), ['respondent', 'people']);
});

test('rechaza cantidades fuera del rango permitido', () => {
  assert.deepEqual(validateResponse({ respondent: 'Mayo', people: 31, ...FECHAS }), ['people']);
  assert.deepEqual(validateResponse({ respondent: 'Berleyna', people: 1.5, ...FECHAS }), ['people']);
});

test('exige las fechas de disponibilidad', () => {
  assert.deepEqual(validateResponse({ respondent: 'Mayo', people: 3 }), ['availableFrom', 'availableTo']);
});

test('rechaza fechas mal formadas o invertidas', () => {
  assert.deepEqual(validateResponse({
    respondent: 'Mayo', people: 3, availableFrom: '2026-13-01', availableTo: '2026-12-15'
  }), ['availableFrom']);
  assert.deepEqual(validateResponse({
    respondent: 'Mayo', people: 3, availableFrom: '2026-12-20', availableTo: '2026-12-15'
  }), ['availableTo']);
});
