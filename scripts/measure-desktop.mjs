// Connect only to an existing loopback Electron diagnostic endpoint.
// Does not restart DSH, change plugin configuration, authenticate, or send prompts.
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

export function parseArgs(argv) {
  const args = Object.fromEntries(argv.map(v => {
    const i = v.indexOf('=')
    if (!v.startsWith('--') || i < 3) throw new Error('Use --name=value arguments')
    return [v.slice(2, i), v.slice(i + 1)]
  }))
  const endpoint = new URL(args.endpoint || 'http://127.0.0.1:9334')
  if (endpoint.protocol !== 'http:' || !['127.0.0.1', '[::1]'].includes(endpoint.hostname) || endpoint.username || endpoint.password) throw new Error('Endpoint must be loopback HTTP without credentials')
  if (!args.title) throw new Error('--title is required')
  const timeout = Number(args.timeout || 30000)
  if (!Number.isFinite(timeout) || timeout < 1000 || timeout > 120000) throw new Error('Timeout must be 1000–120000 ms')
  return { ...args, endpoint: endpoint.origin, timeout }
}

async function connect(url) {
  const ws = new WebSocket(url)
  const pending = new Map()
  let id = 0
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('WebSocket open timeout')), 5000)
    ws.onopen = () => { clearTimeout(timer); resolve() }
    ws.onerror = () => { clearTimeout(timer); reject(new Error('WebSocket connection failed')) }
  })
  const fail = error => { for (const p of pending.values()) { clearTimeout(p.timer); p.reject(error) } pending.clear() }
  ws.onclose = () => fail(new Error('Diagnostic connection closed'))
  ws.onmessage = e => {
    const m = JSON.parse(String(e.data)), p = pending.get(m.id)
    if (!p) return
    pending.delete(m.id); clearTimeout(p.timer)
    m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result)
  }
  return {
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const key = ++id
        const timer = setTimeout(() => { pending.delete(key); reject(new Error(`CDP timeout: ${method}`)) }, 10000)
        pending.set(key, { resolve, reject, timer })
        ws.send(JSON.stringify({ id: key, method, params }))
      })
    },
    close() { fail(new Error('Measurement finished')); ws.close() },
  }
}

export async function measure(args) {
  const targets = await fetch(args.endpoint + '/json/list', { signal: AbortSignal.timeout(5000) }).then(r => r.json())
  const pages = targets.filter(t => t.type === 'page' && t.url?.startsWith('dsh-app://app/'))
  if (pages.length !== 1) throw new Error(`Expected one DSH desktop page; found ${pages.length}`)
  const client = await connect(pages[0].webSocketDebuggerUrl)
  const evaluate = async expression => {
    const r = await client.send('Runtime.evaluate', { expression, returnByValue: true })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ': ' + r.result?.description)
    return r.result.value
  }
  try {
    const start = await evaluate(`(() => {
      const title = ${JSON.stringify(args.title)};
      const rows = [...document.querySelectorAll('[role="treeitem"]')].filter(e => e.textContent.includes(title) && e.textContent.length < title.length + 100);
      if (rows.length !== 1) throw new Error('Target session must be uniquely visible in sidebar');
      const current = document.title.includes(title);
      window.__dshDesktopMeasure?.observer?.disconnect();
      const state = { start: performance.now(), longTasks: [], observer: null, previousText: document.querySelector('[data-chat-flow]')?.textContent || '' };
      state.observer = new PerformanceObserver(list => { for (const e of list.getEntries()) state.longTasks.push(e.duration) });
      state.observer.observe({ type: 'longtask' });
      window.__dshDesktopMeasure = state;
      rows[0].click();
      return { alreadySelected: current, plugin: !!document.getElementById('dsh-fast-open-style') };
    })()`)
    if (start.alreadySelected) throw new Error('Target was already selected; navigate elsewhere before measuring')
    const deadline = Date.now() + args.timeout
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 100))
      const sample = await evaluate(`(() => {
        const flow = document.querySelector('[data-chat-flow]');
        const state = window.__dshDesktopMeasure;
        const loading = [...document.querySelectorAll('[data-chat-flow], [role="status"]')].some(e => e.textContent.includes('载入历史…'));
        return { elapsedMs: performance.now() - state.start, loading, changed: !!flow && flow.textContent !== state.previousText, textLength: flow?.textContent.length || 0, rows: flow?.children.length || 0,
          title: document.title, plugin: !!document.getElementById('dsh-fast-open-style'), longTasks: state.longTasks };
      })()`)
      if (!sample.loading && sample.changed && sample.textLength > 200 && sample.title.includes(args.title)) {
        const css = await evaluate(`(() => { const rows = [...document.querySelectorAll('[data-chat-flow] > *')]; return { timelineChildren: rows.length, cvApplied: rows.filter(e => getComputedStyle(e).contentVisibility === 'auto').length } })()`)
        return { measuredAt: new Date().toISOString(), label: args.label || 'unlabeled', environment: 'Electron desktop', pollingMs: 100, ...sample, ...css }
      }
    }
    throw new Error('Session content did not become visible before timeout')
  } finally {
    try { await evaluate('window.__dshDesktopMeasure?.observer?.disconnect()') } catch {}
    client.close()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = parseArgs(process.argv.slice(2)), result = await measure(args)
    if (args.out) fs.appendFileSync(args.out, JSON.stringify(result) + '\n')
    console.log(JSON.stringify(result))
  } catch (e) { console.error(e.message); process.exitCode = 1 }
}
