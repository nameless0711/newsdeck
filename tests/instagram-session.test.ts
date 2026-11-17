import { test } from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore standalone local Windows helper
import { instagramCookies, hasSession, crypt } from '../scripts/instagram-session.mjs';

test('Instagram session accepts only secure current Instagram cookies', () => {
  const cookie = { domain: '.instagram.com', secure: true, expires: -1, value: 'synthetic', name: 'sessionid' };
  const filtered = instagramCookies([cookie, { ...cookie, name: 'ds_user_id' },
    { ...cookie, domain: 'evilinstagram.com' }, { ...cookie, secure: false },
    { ...cookie, expires: 1 }, { ...cookie, name: 'unneeded' }]);
  assert.equal(filtered.length, 2);
  assert.equal(hasSession(filtered), true);
  assert.equal(hasSession([cookie]), false);
});
test('Windows protects local session and rejects corrupted data', { skip: process.platform !== 'win32' }, async () => {
  const secret = 'synthetic session data';
  const protectedValue = await crypt(secret);
  assert.ok(!protectedValue.includes(secret));
  assert.equal(await crypt(protectedValue, true), secret);
  await assert.rejects(crypt('invalid-data', true));
});
