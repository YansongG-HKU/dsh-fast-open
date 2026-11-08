import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const client = readFileSync(join(root, 'client.js'), 'utf8')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

test('client bundle is a web client module for the DSH module loader', () => {
  assert.match(client, /window\.__ModuleLoader__\.load\(/)
  assert.match(client, /id: 'dsh-fast-open'/)
  assert.equal(pkg.dsh.client.platform, 'web')
  assert.equal(pkg.dsh.client.immediately, true)
})

test('timeline rows get content-visibility with an intrinsic size', () => {
  assert.match(client, /\[data-chat-flow\] > \*/)
  assert.match(client, /content-visibility:\s*auto/)
  assert.match(client, /contain-intrinsic-size:\s*auto\s+320px/)
})

test('optimization is pure CSS: no DOM observers or per-mutation work', () => {
  assert.doesNotMatch(client, /MutationObserver/)
  assert.doesNotMatch(client, /querySelectorAll/)
  assert.match(client, /createElement\('style'\)/)
})

test('host half is inert and the bundle patch inserts one row', () => {
  const host = readFileSync(join(root, 'index.js'), 'utf8')
  const patch = readFileSync(join(root, 'cordis.patch.yml'), 'utf8')
  assert.match(host, /export const name = 'dsh-fast-open'/)
  assert.match(patch, /id: dsh-fast-open/)
})
