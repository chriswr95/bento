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

function greeting(profile, today = new Date()) {
  const birthday = isBirthdayDate(profile.birthday) && profile.birthday.slice(5) === dateKey(today).slice(5);
  return birthday ? `hbd ${profile.firstName}!` : `Hello, ${profile.firstName}`;
}

export default Object.freeze({ key, read, write, validate, greeting, dateKey });
