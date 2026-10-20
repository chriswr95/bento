const key = 'bento.prototype.profile.v1';
const defaults = { version: 1, firstName: 'Makena', lastName: '', birthday: '' };

function dateKey(date = new Date()) {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function isBirthdayDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0, 4)) < 1) return false;
  const date = new Date(value + 'T12:00:00');
  return !Number.isNaN(date.valueOf()) && dateKey(date) === value;
}

function validate(value, today = new Date()) {
  return value?.version === 1 && typeof value.firstName === 'string'
    && value.firstName.trim().length > 0 && value.firstName.length <= 80
    && typeof value.lastName === 'string' && value.lastName.length <= 80
    && typeof value.birthday === 'string'
    && (!value.birthday || (isBirthdayDate(value.birthday) && value.birthday <= dateKey(today)));
}

function read(storage) {
  try {
    const saved = JSON.parse((storage ?? globalThis.localStorage).getItem(key));
    if (validate(saved)) return saved;
  } catch { /* Missing, corrupt, or unavailable storage uses an editable default. */ }
  return { ...defaults };
}

function write(value, storage) {
  if (!validate(value)) throw new Error('Enter a first name and a valid birthday, or leave birthday blank.');
  const profile = { version: 1, firstName: value.firstName.trim(), lastName: value.lastName.trim(), birthday: value.birthday };
  try {
    (storage ?? globalThis.localStorage).setItem(key, JSON.stringify(profile));
    return { profile, saved: true };
  } catch {
    return { profile, saved: false };
  }
}

const greetings = {
  morning: ['Good morning, {name}', 'Morning, {name}', 'Ready for the day, {name}?', 'A fresh start, {name}'],
  afternoon: ['Good afternoon, {name}', 'Hello, {name}', 'Good to see you, {name}', 'Welcome, {name}'],
  evening: ['Good evening, {name}', 'Evening, {name}', 'A moment to reflect, {name}', 'Welcome, {name}'],
  night: ['Hello, {name}', 'Good to see you, {name}', 'A quiet moment, {name}', 'At your own pace, {name}']
};
function greeting(profile, today = new Date()) {
  const birthday = isBirthdayDate(profile.birthday) && profile.birthday.slice(5) === dateKey(today).slice(5);
  if (birthday) return `hbd ${profile.firstName}!`;
  const hour = today.getHours();
  const period = hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 17 ? 'afternoon' : hour >= 17 && hour < 22 ? 'evening' : 'night';
  const phrases = greetings[period];
  // Use the local civil date and hour so rerenders/restarts do not shuffle the copy.
  const day = Math.floor(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / 86_400_000);
  return phrases[(day + hour) % phrases.length].replace('{name}', () => profile.firstName);
}

export default Object.freeze({ key, read, write, validate, greeting, dateKey });
