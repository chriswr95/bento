export const colorNames = Object.freeze(['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink']);
export const validColor = value => colorNames.includes(value);
export const colorLabel = value => value[0].toUpperCase() + value.slice(1);
export function automaticColor(identity) {
  let hash = 2166136261;
  for (const character of String(identity)) hash = Math.imul(hash ^ character.codePointAt(0), 16777619);
  return colorNames[(hash >>> 0) % colorNames.length];
}
export const recordColor = record => validColor(record?.color) ? record.color : automaticColor(record?.id || 'document');
export const tagColor = (workspace, tag) => Object.hasOwn(workspace.tagColors || {}, tag) ? workspace.tagColors[tag] : automaticColor(tag);
const channels = color => color.slice(1).match(/../g).map(hex => parseInt(hex, 16));
const hex = values => '#' + values.map(value => Math.round(value).toString(16).padStart(2, '0')).join('');
export function mixColor(first, second, amount) { return hex(channels(first).map((value, index) => value * (1 - amount) + channels(second)[index] * amount)); }
function luminance(color) {
  return channels(color).map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((total, value, index) => total + value * [0.2126, 0.7152, 0.0722][index], 0);
}
export function contrastRatio(first, second) { const a = luminance(first), b = luminance(second); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); }
export function colorPair(color, paper) {
  const background = mixColor(paper, color, 0.14), target = luminance(background) > 0.18 ? '#000000' : '#ffffff';
  let foreground = color;
  for (let step = 1; contrastRatio(foreground, background) < 4.5 && step <= 20; step++) foreground = mixColor(color, target, step / 20);
  return { foreground, background };
}
function hsl(hue, saturation, lightness) {
  const channel = index => { const k = (index + hue / 30) % 12, a = saturation * Math.min(lightness, 1 - lightness); return 255 * (lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))); };
  return hex([channel(0), channel(8), channel(4)]);
}
export function paletteAccents(palette, dark) {
  if (palette.accents) return palette.accents;
  const rgb = channels(palette.accent).map(value => value / 255), max = Math.max(...rgb), min = Math.min(...rgb);
  const saturation = Math.min(0.8, 0.52 + (max - min) * 0.35);
  return Object.fromEntries(colorNames.map((name, index) => [name, hsl([0, 28, 48, 125, 174, 216, 269, 326][index], saturation, dark ? 0.74 : 0.43)]));
}
export function colorPicker(selected, attribute, label = 'Color') {
  return `<div class="b-color-picker" role="group" aria-label="${label}">${colorNames.map(name => `<button type="button" class="b-color-swatch" data-color="${name}" ${attribute}="${name}" aria-label="${colorLabel(name)}" title="${colorLabel(name)}" aria-pressed="${selected === name}"><span aria-hidden="true">${selected === name ? '✓' : ''}</span></button>`).join('')}<button type="button" class="b-color-auto" ${attribute}="automatic" aria-pressed="${!validColor(selected)}">Automatic</button></div>`;
}
