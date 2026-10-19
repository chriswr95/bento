import { test } from 'node:test';
import assert from 'node:assert/strict';
import profile from '../prototype/profile.js';
const person = { version: 1, firstName: 'Makena', lastName: 'Wright', birthday: '2000-02-29' };
test('birthday greetings use the local calendar date including leap years', () => {
  assert.equal(profile.greeting(person, new Date(2028, 1, 29)), 'hbd Makena!');
  assert.equal(profile.greeting(person, new Date(2027, 1, 28)), 'Hello, Makena');
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
