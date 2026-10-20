// Motion changes presentation only. Domain changes and persistence stay synchronous.
export default class Motion {
  constructor(preference = matchMedia('(prefers-reduced-motion: reduce)')) {
    this.preference = preference; this.animations = new Set(); this.completions = new Map();
    preference.addEventListener('change', () => {
      if (!preference.matches) return;
      const completions = [...this.completions.values()];
      this.cancel(); completions.forEach(finish => finish());
    });
  }
  play(element, frames, options, finished) {
    if (this.preference.matches || !element?.animate) return null;
    const animation = element.animate(frames, options);
    this.animations.add(animation);
    animation.oncancel = () => { this.animations.delete(animation); this.completions.delete(animation); };
    animation.onfinish = () => { this.animations.delete(animation); this.completions.delete(animation); finished?.(); };
    return animation;
  }
  enter(element) {
    this.play(element, [{ opacity: 0.75 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' });
  }
  complete(row, finished) {
    if (this.preference.matches || !row?.animate) return false;
    const style = getComputedStyle(row), height = row.getBoundingClientRect().height;
    const size = { height: `${height}px`, paddingTop: style.paddingTop, paddingBottom: style.paddingBottom, borderBottomWidth: style.borderBottomWidth, overflow: 'hidden' };
    row.classList.add('b-done');
    const finish = () => { if (row.isConnected) finished(); };
    const animation = this.play(row, [
      { ...size, opacity: 1 },
      { ...size, opacity: 0.65, offset: 0.45 },
      { height: '0px', paddingTop: '0px', paddingBottom: '0px', borderBottomWidth: '0px', overflow: 'hidden', opacity: 0 }
    ], { duration: 300, easing: 'ease-out' }, finish);
    if (animation) this.completions.set(animation, finish);
    return !!animation;
  }
  cancel() {
    for (const animation of this.animations) { animation.onfinish = null; animation.cancel(); }
    this.animations.clear(); this.completions.clear();
  }
}
