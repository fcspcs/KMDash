import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROFILES, findProfile } from '../src/app/lib/profiles.js';
import { profileToTargets, resolveTargets } from '../src/app/lib/targets.js';
import { profileSummary } from '../src/app/lib/labels.js';
import { setLang } from '../src/app/lib/i18n.js';

const at = (id, key, numKeys = 88) => resolveTargets(profileToTargets(findProfile(id), numKeys), key, { numKeys });

test('Factory profiles: unique ids, every one gives targets for 88 and 61 keys', () => {
  const ids = PROFILES.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length, 'ids are unique');
  const makers = new Set(PROFILES.map((p) => p.maker));
  for (const maker of ['C. Bechstein', 'Fazioli', 'Petrof', 'Schimmel', 'Yamaha', 'Kawai', 'Seiler', 'Mason & Hamlin', 'Blüthner', 'Steinway & Sons']) assert.ok(makers.has(maker), maker);
  for (const p of PROFILES) {
    for (const numKeys of [88, 61]) {
      const t = profileToTargets(p, numKeys);
      const any = Object.values(t.metrics).some((list) => list.length);
      assert.ok(any, `${p.id} brings targets`);
      for (const list of Object.values(t.metrics)) for (const s of list) assert.ok(s.from >= 1 && s.to <= numKeys && s.from <= s.to, `${p.id} range inside the keyboard`);
    }
    assert.ok(['official', 'secondary', 'consensus', 'estimate'].includes(p.confidence), `${p.id} confidence`);
  }
});

test('Factory profiles: slopes from bass to treble as published', () => {
  // C. Bechstein concert grand: down 52 to 48 g, up 26 to 30 g, each ±1 g
  assert.equal(at('bechstein-concert-d282', 1).d.target, 52);
  assert.equal(at('bechstein-concert-d282', 88).d.target, 48);
  assert.equal(at('bechstein-concert-d282', 1).u.min, 25);
  assert.equal(at('bechstein-concert-d282', 88).u.max, 31);
  assert.ok(Math.abs(at('bechstein-concert-d282', 44).d.target - 50) < 0.1, 'middle about 50 g');
  // Petrof German balancing: steps by the maker's key ranges
  assert.equal(at('petrof-grand-german', 20).d.target, 55);
  assert.equal(at('petrof-grand-german', 60).d.target, 51);
  assert.equal(at('petrof-grand-german', 88).d.target, 50);
  // Petrof grand: a key has to come back with 22 g
  assert.equal(at('petrof-grand', 40).u.min, 22);
  // Yamaha: key dip only
  const yamaha = profileToTargets(findProfile('yamaha-c'), 88);
  assert.equal(yamaha.metrics.d.length, 0);
  assert.deepEqual([yamaha.metrics.dip[0].min, yamaha.metrics.dip[0].max], [9.7, 10.3]);
});

test('Factory profiles: the picker says what a profile brings', () => {
  setLang('de');
  assert.equal(profileSummary(findProfile('bechstein-concert-a192')), 'Niedergewicht 52 → 48 g, Aufgewicht 26 → 30 g');
  assert.equal(profileSummary(findProfile('yamaha-u')), 'Nur Tastentiefgang, 10 mm');
  assert.equal(profileSummary(findProfile('petrof-grand')), 'Niedergewicht 50 bis 52 g, Aufgewicht ab 22 g');
  setLang('en');
  assert.equal(profileSummary(findProfile('kawai-rx')), 'Key dip only, 10.3 mm');
});
