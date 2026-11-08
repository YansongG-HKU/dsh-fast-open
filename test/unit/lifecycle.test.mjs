import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import fs from 'node:fs'

test('client unload removes only its owned style and DOM listener, then reloads cleanly', () => {
  const styles=new Map(),listeners=new Map();let plugin,cleanup
  const document={readyState:'loading',getElementById:id=>styles.get(id),createElement:()=>({remove(){styles.delete(this.id)}}),head:{appendChild(s){styles.set(s.id,s)}},addEventListener(n,fn){listeners.set(n,fn)},removeEventListener(n,fn){if(listeners.get(n)===fn)listeners.delete(n)}}
  vm.runInNewContext(fs.readFileSync(new URL('../../client.js',import.meta.url),'utf8'),{document,window:{__ModuleLoader__:{load(m){plugin=m.factory(()=>{})}}}})
  const ctx={effect(fn){cleanup=fn()}}
  plugin.apply(ctx);assert.equal(styles.size,1);assert.equal(listeners.size,1)
  cleanup();assert.equal(styles.size,0);assert.equal(listeners.size,0)
  plugin.apply(ctx);assert.equal(styles.size,1);cleanup();assert.equal(styles.size,0)
})
