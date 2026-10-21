import assert from 'node:assert/strict';

export async function checkDisclosureMotion(details, sibling = false) {
  const frames = await details.evaluate(async element => {
    const snapshot = () => ({ height: element.getBoundingClientRect().height, opacity: Number(getComputedStyle(element, '::details-content').opacity), next: element.closest('li')?.nextElementSibling?.getBoundingClientRect().top });
    const capture = async duration => {
      const frames = [], start = performance.now();
      do { await new Promise(requestAnimationFrame); frames.push(snapshot()); } while (performance.now() - start < duration);
      return frames;
    };
    element.open = false; await capture(360); const closed = snapshot();
    element.open = true; const opening = await capture(360), open = snapshot();
    element.open = false; const closing = await capture(90);
    element.open = true; await capture(360); const reversed = snapshot();
    element.open = false; await capture(360); const end = snapshot();
    return { closed, opening, open, closing, reversed, end, duration: getComputedStyle(element, '::details-content').transitionDuration };
  });
  assert.match(frames.duration, /0\.32s/);
  assert.ok(frames.opening.some(frame => frame.height > frames.closed.height + 1 && frame.height < frames.open.height - 1), JSON.stringify(frames));
  assert.ok(frames.opening.some(frame => frame.opacity > 0 && frame.opacity < 1), JSON.stringify(frames));
  assert.ok(frames.closing.some(frame => frame.height > frames.closed.height + 1 && frame.height < frames.open.height - 1), JSON.stringify(frames));
  assert.ok(Math.abs(frames.reversed.height - frames.open.height) < 1, JSON.stringify(frames));
  assert.ok(Math.abs(frames.end.height - frames.closed.height) < 1, JSON.stringify(frames));
  if (sibling) assert.ok(frames.opening.some(frame => frame.next > frames.closed.next + 1 && frame.next < frames.open.next - 1), JSON.stringify(frames));
}
