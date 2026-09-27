import { test } from 'node:test';
import assert from 'node:assert/strict';
import { browserSupport, localNetworkPermission } from '../src/app/lib/direct.js';

const nav = (brands) => ({ userAgentData: brands ? { brands } : undefined });

test('Direct mode: Chrome and Edge from 147, others get a clear reason', () => {
  assert.equal(browserSupport(nav([{ brand: 'Chromium', version: '154' }, { brand: 'Google Chrome', version: '154' }])), 'ok');
  assert.equal(browserSupport(nav([{ brand: 'Chromium', version: '147' }, { brand: 'Microsoft Edge', version: '147' }])), 'ok');
  assert.equal(browserSupport(nav([{ brand: 'Chromium', version: '141' }])), 'update');
  assert.equal(browserSupport(nav(null)), 'browser', 'Safari and Firefox have no userAgentData');
  assert.equal(browserSupport(undefined), 'browser');
});

test('Direct mode: permission read under either name, unknown stays null', async () => {
  const query = (known) => ({ permissions: { query: async ({ name }) => (known.includes(name) ? { state: 'granted', name } : Promise.reject(new TypeError('unknown'))) } });
  assert.equal((await localNetworkPermission(query(['local-network']))).name, 'local-network');
  assert.equal((await localNetworkPermission(query(['local-network-access']))).name, 'local-network-access');
  assert.equal(await localNetworkPermission(query([])), null);
});
