/* dsh-fast-open client bundle — pure CSS render optimization. */
window.__ModuleLoader__.load({
  id: 'dsh-fast-open',
  factory(require) {
    const STYLE_ID = 'dsh-fast-open-style'
    // One stylesheet, injected on boot. No observers, no per-render JS work:
    // transcript rows that are off-screen skip layout and paint.
    const CSS = [
      '[data-chat-flow] > *{content-visibility:auto;contain-intrinsic-size:auto 320px;}',
      '[data-chat-flow]{overflow-anchor:auto;}',
    ].join('\n')

    function inject() {
      if (document.getElementById(STYLE_ID)) return
      const style = document.createElement('style')
      style.id = STYLE_ID
      style.textContent = CSS
      ;(document.head || document.documentElement).appendChild(style)
    }

    return {
      name: 'dsh-fast-open',
      inject: [],
      apply() {
        inject()
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', inject, { once: true })
        }
      },
    }
  },
})
