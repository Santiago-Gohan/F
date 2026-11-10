(function (root) {
  'use strict';

  const DAY = 24 * 60 * 60 * 1000;

  function validISODate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  function dateRange(start, end) {
    if (!validISODate(start) || !validISODate(end) || start > end) return [];
    const first = new Date(`${start}T00:00:00Z`).getTime();
    const last = new Date(`${end}T00:00:00Z`).getTime();
    const dates = [];
    for (let time = first; time <= last; time += DAY) dates.push(new Date(time).toISOString().slice(0, 10));
    return dates;
  }

  function calculateDailyAvailability(rows, start, end) {
    const days = dateRange(start, end).map(date => ({ date, people: 0, families: 0 }));
    if (!days.length || !Array.isArray(rows)) return days;
    const byDate = new Map(days.map(day => [day.date, day]));
    for (const row of rows) {
      if (!row || !validISODate(row.from) || !validISODate(row.to) || row.from > row.to) continue;
      const people = Number(row.people);
      if (!Number.isInteger(people) || people < 1) continue;
      for (const date of dateRange(row.from, row.to)) {
        const day = byDate.get(date);
        if (day) { day.people += people; day.families += 1; }
      }
    }
    return days;
  }

  function preferenceVotesOn(date, rows) {
    const periods = [
      ['dec-01-07', '2026-12-01', '2026-12-07'], ['dec-08-15', '2026-12-08', '2026-12-15'],
      ['dec-16-23', '2026-12-16', '2026-12-23'], ['dec-24-25', '2026-12-24', '2026-12-25'],
      ['dec-26-30', '2026-12-26', '2026-12-30'], ['dec-31-jan-01', '2026-12-31', '2027-01-01'],
      ['jan-02-11', '2027-01-02', '2027-01-11'], ['jan-12-15', '2027-01-12', '2027-01-15'],
      ['jan-16-25', '2027-01-16', '2027-01-25'], ['jan-26-feb-15', '2027-01-26', '2027-02-15']
    ];
    const period = periods.find(([, from, to]) => date >= from && date <= to);
    if (!period || !Array.isArray(rows)) return 0;
    return rows.filter(row => row && Array.isArray(row.periods) && row.periods.includes(period[0])).length;
  }

  function recommendBestDates(rows, start, end) {
    const daily = calculateDailyAvailability(rows, start, end);
    const eligible = daily.filter(day => day.people > 0);
    const orderedDays = [...eligible].sort((a, b) =>
      b.people - a.people || b.families - a.families ||
      preferenceVotesOn(b.date, rows) - preferenceVotesOn(a.date, rows) || a.date.localeCompare(b.date)
    );
    const bestDay = orderedDays[0] || null;
    let bestTwoDays = null;
    for (let i = 0; i < daily.length - 1; i += 1) {
      const first = daily[i];
      const second = daily[i + 1];
      if (!first.people || !second.people) continue;
      const candidate = {
        from: first.date, to: second.date, personDays: first.people + second.people,
        minPeople: Math.min(first.people, second.people), families: Math.min(first.families, second.families)
      };
      if (!bestTwoDays || candidate.personDays > bestTwoDays.personDays ||
          (candidate.personDays === bestTwoDays.personDays && candidate.minPeople > bestTwoDays.minPeople) ||
          (candidate.personDays === bestTwoDays.personDays && candidate.minPeople === bestTwoDays.minPeople && candidate.from < bestTwoDays.from)) bestTwoDays = candidate;
    }
    return { daily, bestDay, bestTwoDays };
  }

  function countSelections(rows, field) {
    const counts = Object.create(null);
    if (!Array.isArray(rows)) return {};
    for (const row of rows) {
      const selections = row && Array.isArray(row[field]) ? row[field] : [];
      for (const value of new Set(selections.filter(item => typeof item === 'string' && item.trim()))) counts[value] = (counts[value] || 0) + 1;
    }
    return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
  }

  function validateResponse(response) {
    const errors = [];
    const data = response || {};
    const people = Number(data.people);
    if (typeof data.name !== 'string' || !data.name.trim()) errors.push('name');
    if (!Number.isInteger(people) || people < 1 || people > 15) errors.push('people');
    if (!validISODate(data.from) || !validISODate(data.to) || data.from > data.to || data.from < '2026-12-01' || data.to > '2027-02-15') errors.push('dates');
    if (!Array.isArray(data.periods) || data.periods.length < 1) errors.push('periods');
    const hasActivities = Array.isArray(data.activities) && data.activities.length > 0;
    const hasCustomIdea = typeof data.customActivity === 'string' && data.customActivity.trim().length > 0;
    if (!hasActivities && !hasCustomIdea) errors.push('activities');
    return errors;
  }

  const api = { calculateDailyAvailability, recommendBestDates, countSelections, validateResponse, validISODate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FamilyLogic = api;
})(globalThis);
