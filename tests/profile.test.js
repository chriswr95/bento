import { test } from 'node:test';
import assert from 'node:assert/strict';
import profile from '../prototype/profile.js';
const person = { version: 1, firstName: 'Makena', lastName: 'Wright', birthday: '2000-02-29' };
test('birthday greetings use the local calendar date including leap years', () => {
  assert.equal(profile.greeting(person, new Date(2028, 1, 29)), 'hbd Makena!');
  assert.notEqual(profile.greeting(person, new Date(2027, 1, 28)), 'hbd Makena!');
  assert.equal(profile.dateKey(new Date(2028, 0, 2)), '2028-01-02');
});
test('profile validation rejects impossible dates, future birthdays and blank names', () => {
  const today = new Date(2026, 9, 19); assert.equal(profile.validate(person, today), true);
  for (const change of [{ birthday: '2001-02-29' }, { birthday: '2027-01-01' }, { firstName: '  ' }, { lastName: 'x'.repeat(81) }]) assert.equal(profile.validate({ ...person, ...change }, today), false);
});
test('corrupt profile storage falls back safely and failed writes retain the profile for this session', () => {
  assert.equal(profile.read({ getItem: () => '{' }).firstName, 'Makena');
  const result = profile.write({ ...person, firstName: ' Makena ' }, { setItem() { throw new Error('Storage unavailable'); } });
  assert.equal(result.saved, false); assert.equal(result.profile.firstName, 'Makena');
});

test('greetings use local time periods, rotate hourly and stay stable within the hour', () => {
  const periods = [
    [[5, 6, 7, 8, 9, 10, 11], /^(Good morning|Morning|Ready for the day|A fresh start), Makena\??$/, 4],
    [[12, 13, 14, 15, 16], /^(Good afternoon|Hello|Good to see you|Welcome), Makena$/, 4],
    [[17, 18, 19, 20, 21], /^(Good evening|Evening|Welcome), Makena$/, 3],
    [[22, 23, 0, 1, 2, 3, 4], /^(Hello|Good to see you|At your own pace), Makena$/, 3]
  ];
  for (const [hours, pattern, count] of periods) {
    const results = hours.map(hour => profile.greeting(person, new Date(2026, 9, 20, hour)));
    for (const result of results) assert.match(result, pattern);
    assert.equal(new Set(results).size, count);
  }
  assert.equal(profile.greeting(person, new Date(2026, 9, 20, 8)), profile.greeting(person, new Date(2026, 9, 20, 8, 59, 59)));
  assert.notEqual(profile.greeting(person, new Date(2026, 9, 20, 8)), profile.greeting(person, new Date(2026, 9, 20, 9)));
  assert.notEqual(profile.greeting(person, new Date(2026, 9, 20, 8)), profile.greeting(person, new Date(2026, 9, 21, 8)));
  for (const hour of [0, 5, 12, 17, 22, 23]) assert.equal(profile.greeting(person, new Date(2028, 1, 29, hour)), 'hbd Makena!');
});
test('greeting names remain literal even when they contain replacement syntax', () => {
  assert.match(profile.greeting({ ...person, firstName: '$& <Sam>' }, new Date(2026, 9, 20, 8)), /\$& <Sam>/);
});

test('rare nicknames are restricted to Makena Wong, stable hourly, and never change the profile', () => {
  const makena = { ...person, lastName: 'Wong', birthday: '' }, original = structuredClone(makena);
  const counts = { Thumper: 0, 'Mak Attack': 0 };
  let ordinary = 0;
  for (let hour = 0; hour < 24 * 365; hour++) {
    const date = new Date(2026, 0, 1, hour);
    const text = profile.greeting(makena, date);
    assert.doesNotMatch(text, /A moment to reflect|A quiet moment/);
    const nickname = Object.keys(counts).find(name => text.includes(name));
    if (!nickname) { ordinary++; continue; }
    counts[nickname]++;
    const later = new Date(date); later.setMinutes(59, 59);
    assert.equal(profile.greeting(makena, later), text);
    assert.equal(profile.greeting({ ...makena }, date), text);
    assert.match(profile.greeting({ ...makena, birthday: profile.dateKey(date) }, date), new RegExp(`^hbd ${nickname}!$`));
    for (const person of [{ ...makena, lastName: 'Wright' }, { ...makena, lastName: '' }, { ...makena, firstName: 'Sam' }, { ...makena, firstName: 'Makena Wong', lastName: '' }]) {
      assert.doesNotMatch(profile.greeting(person, date), /Thumper|Mak Attack/);
    }
    assert.ok(profile.greeting({ ...makena, firstName: ' makena ', lastName: ' WONG ' }, date).includes(nickname));
  }
  const total = ordinary + counts.Thumper + counts['Mak Attack'];
  assert.ok((total - ordinary) / total > 0.04 && (total - ordinary) / total < 0.06);
  assert.ok(counts.Thumper > 100 && counts['Mak Attack'] > 100);
  assert.deepEqual(makena, original);
});
