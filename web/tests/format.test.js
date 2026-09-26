import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNumber } from '../src/app/lib/format.js';
import { setLang } from '../src/app/lib/i18n.js';

test('Typed numbers: comma and point both work, in both languages', () => {
  for (const lang of ['de', 'en']) {
    setLang(lang);
    assert.equal(parseNumber('0,5'), 0.5, lang);
    assert.equal(parseNumber('0.5'), 0.5, lang);
    assert.equal(parseNumber(',5'), 0.5, lang);
    assert.equal(parseNumber('21,5 '), 21.5, lang);
    assert.equal(parseNumber('13.'), 13, lang);
    assert.equal(parseNumber('−1,2'), -1.2, 'minus sign as the app shows it');
    assert.equal(parseNumber('-1.2'), -1.2);
    assert.equal(parseNumber(''), null);
    assert.equal(parseNumber('  '), null);
    assert.ok(Number.isNaN(parseNumber('abc')));
    assert.ok(Number.isNaN(parseNumber('1,2,3')));
  }
  setLang('en');
});
