const copy = value => structuredClone(value);
export function sameLocation(first, second) {
  return first.view === second.view && first.project === second.project && (first.view !== 'document' || first.document === second.document);
}
export default class NavigationHistory {
  constructor(location, limit = 100) { this.limit = limit; this.reset(location); }
  reset(location) { this.entries = [{ location: copy(location), presentation: {} }]; this.index = 0; }
  remember(presentation) { this.entries[this.index].presentation = copy(presentation); }
  visit(location) {
    if (sameLocation(this.entries[this.index].location, location)) return false;
    this.entries = this.entries.slice(0, this.index + 1);
    this.entries.push({ location: copy(location), presentation: {} });
    if (this.entries.length > this.limit) this.entries.shift();
    this.index = this.entries.length - 1; return true;
  }
  move(direction, valid = () => true) {
    if (direction !== -1 && direction !== 1) throw new Error('History direction must be -1 or 1.');
    for (let index = this.index + direction; index >= 0 && index < this.entries.length; index += direction) {
      if (!valid(this.entries[index].location)) continue;
      this.index = index; return copy(this.entries[index]);
    }
    return null;
  }
}
