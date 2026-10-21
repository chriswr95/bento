export function welcome() {
  return `<section class="b-welcome" aria-label="Welcome to Bento">
    <div class="b-welcome-copy"><p class="b-eyebrow">A calmer place to work</p><h1>Your projects, notes, and next steps.</h1>
      <p class="b-welcome-intro">From the first meeting note to the last follow-up, keep your work connected.</p>
      <button type="button" class="b-button b-primary b-welcome-start" data-files="example">Try an example workspace <span aria-hidden="true">→</span></button>
      <p class="b-welcome-hint">Two fictional projects. A short, hands-on tour.</p>
      <div class="b-welcome-options"><button type="button" data-files="create">New workspace</button><span aria-hidden="true">·</span><button type="button" data-files="open">Open workspace</button></div>
      <p class="b-welcome-local">Choose an empty folder for the example or a new workspace.<br>Your work stays in that folder as Markdown. No account needed.</p>
    </div>
    <div class="b-welcome-art" aria-hidden="true"><div class="b-welcome-tray">
      <div class="b-welcome-project"><span class="b-welcome-dot"></span><small>THE PROJECT</small><h2>Creekside path</h2><p>A clear path forward.</p><span class="b-welcome-chip">In progress</span></div>
      <div class="b-welcome-note"><small>THE MEETING</small><h2>Weekly coordination</h2><div class="b-welcome-rule"></div><div class="b-welcome-rule b-short"></div><p>Decisions made.<br>Next steps captured.</p></div>
      <div class="b-welcome-todos"><small>THE NEXT STEPS</small><p><span>✓</span> Review the plan</p><p><span class="b-welcome-empty"></span> Send the follow-up</p><div class="b-welcome-tomorrow">Tomorrow, already a little clearer.</div></div>
    </div><img src="assets/bento-256.png" alt="" class="b-welcome-icon"></div>
  </section>`;
}
