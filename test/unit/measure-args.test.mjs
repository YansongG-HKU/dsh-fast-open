import test from 'node:test'
import assert from 'node:assert/strict'
import { parseArgs } from '../../scripts/measure-desktop.mjs'

test('desktop measurement accepts explicit loopback endpoints and title', () => {
  const args = parseArgs(['--endpoint=http://127.0.0.1:9334', '--title=a=b', '--timeout=60000'])
  assert.equal(args.title, 'a=b')
  assert.equal(args.timeout, 60000)
})

test('measurement rejects remote endpoints, credentials, missing title and invalid deadlines', () => {
  for (const arg of ['--endpoint=http://example.com', '--endpoint=http://user:pass@127.0.0.1', '--timeout=NaN', '--timeout=0']) {
    assert.throws(() => parseArgs(['--title=test', arg]))
  }
  assert.throws(() => parseArgs([]))
})
