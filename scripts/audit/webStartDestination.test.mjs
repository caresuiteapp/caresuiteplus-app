import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldOfferWebStartChoice } from '../../src/components/brand/webStartDestinationPolicy.ts';

test('plain root entry offers the destination choice', () => {
  assert.equal(shouldOfferWebStartChoice({ pathname: '/' }), true);
  assert.equal(shouldOfferWebStartChoice({ pathname: '' }), true);
});

test('marketing parameters and page anchors keep the destination choice', () => {
  assert.equal(shouldOfferWebStartChoice({
    pathname: '/', search: '?utm_source=campaign&utm_medium=email', hash: '#features',
  }), true);
  assert.equal(shouldOfferWebStartChoice({ pathname: '/', search: '?type=marketing' }), true);
});

test('each role login retains its existing deep link', () => {
  for (const pathname of ['/auth/business-login', '/auth/employee-portal-login', '/auth/client-login']) {
    assert.equal(shouldOfferWebStartChoice({ pathname }), false);
  }
});

test('TV pairing and mobile confirmation bypass the destination choice', () => {
  assert.equal(shouldOfferWebStartChoice({ pathname: '/device/tv' }), false);
  assert.equal(shouldOfferWebStartChoice({ pathname: '/device/confirm', search: '?code=example' }), false);
});

test('portal, software and password setup deep links stay accessible', () => {
  for (const pathname of [
    '/portal/employee', '/portal/client', '/business', '/office',
    '/auth/employee-first-login', '/auth/reset-password',
    '/liquid-command/access/reset-password', '/landingpage',
  ]) {
    assert.equal(shouldOfferWebStartChoice({ pathname }), false);
  }
});

test('root authentication credentials bypass in either query or hash', () => {
  for (const key of ['code', 'access_token', 'refresh_token', 'token_hash']) {
    assert.equal(shouldOfferWebStartChoice({ pathname: '/', search: `?${key}=example` }), false);
    assert.equal(shouldOfferWebStartChoice({ pathname: '/', hash: `#${key}=example` }), false);
  }
});

test('authentication action types preserve callback handling', () => {
  for (const type of ['recovery', 'invite', 'signup', 'magiclink', 'email_change']) {
    assert.equal(shouldOfferWebStartChoice({ pathname: '/', search: `?type=${type}` }), false);
    assert.equal(shouldOfferWebStartChoice({ pathname: '/', hash: `#type=${type}` }), false);
  }
});

test('authentication error and incomplete callback parameters do not get hidden', () => {
  for (const key of ['error', 'error_code', 'error_description', 'code', 'access_token']) {
    assert.equal(shouldOfferWebStartChoice({ pathname: '/', search: `?${key}=` }), false);
    assert.equal(shouldOfferWebStartChoice({ pathname: '/', hash: `#${key}=` }), false);
  }
});

test('callback location is not consumed or modified during policy evaluation', () => {
  const location = Object.freeze({ pathname: '/', search: '?code=example', hash: '#type=recovery' });
  const original = { ...location };
  assert.equal(shouldOfferWebStartChoice(location), false);
  assert.deepEqual(location, original);
});
