const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateDailyAvailability, recommendBestDates, countSelections, validateResponse } = require('./family-logic.js');

test('suma asistentes y familias solo en los días dentro de su disponibilidad', () => {
  const rows = [
    { people: 4, from: '2026-12-08', to: '2026-12-10' },
    { people: 2, from: '2026-12-09', to: '2026-12-11' }
  ];
  assert.deepEqual(calculateDailyAvailability(rows, '2026-12-08', '2026-12-11'), [
    { date: '2026-12-08', people: 4, families: 1 },
    { date: '2026-12-09', people: 6, families: 2 },
    { date: '2026-12-10', people: 6, families: 2 },
    { date: '2026-12-11', people: 2, families: 1 }
  ]);
});

test('recomienda un día y una ventana consecutiva de dos días con más asistentes', () => {
  const rows = [
    { people: 4, from: '2026-12-08', to: '2026-12-10' },
    { people: 2, from: '2026-12-09', to: '2026-12-11' }
  ];
  const result = recommendBestDates(rows, '2026-12-08', '2026-12-11');
  assert.deepEqual(result.bestDay, { date: '2026-12-09', people: 6, families: 2 });
  assert.deepEqual(result.bestTwoDays, { from: '2026-12-09', to: '2026-12-10', personDays: 12, minPeople: 6, families: 2 });
});

test('usa los votos de periodo para desempatar días con igual disponibilidad', () => {
  const rows = [{ people: 2, from: '2026-12-07', to: '2026-12-08', periods: ['dec-08-15'] }];
  const result = recommendBestDates(rows, '2026-12-07', '2026-12-08');
  assert.equal(result.bestDay.date, '2026-12-08');
});

test('cuenta una selección por familia, para periodos e ideas', () => {
  const rows = [
    { periods: ['dec-08-15'], activities: ['lunch', 'photos'] },
    { periods: ['dec-08-15', 'jan-16-25'], activities: ['lunch'] }
  ];
  assert.deepEqual(countSelections(rows, 'periods'), { 'dec-08-15': 2, 'jan-16-25': 1 });
  assert.deepEqual(countSelections(rows, 'activities'), { lunch: 2, photos: 1 });
});

test('valida campos requeridos, rango de fechas y selección mínima', () => {
  const errors = validateResponse({ name: '   ', people: 0, from: '2027-01-15', to: '2027-01-10', periods: [], activities: [] });
  assert.deepEqual(errors, ['name', 'people', 'dates', 'periods', 'activities']);
});
