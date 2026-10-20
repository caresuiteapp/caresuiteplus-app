// Uses the existing Node runtime (22.18+), without services or third-party packages.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSupportReadScope } from '../src/lib/support/supportReadScope.ts';

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('a delayed polling result cannot overwrite a newer subscription result', async () => {
  const scope = createSupportReadScope();
  const old = deferred();
  const visible = [];
  const pending = scope.run(() => old.promise, value => visible.push(value), assert.fail);
  await scope.run(async () => 'current list', value => visible.push(value), assert.fail);
  old.resolve('old list');
  await pending;
  assert.deepEqual(visible, ['current list']);
});

test('a delayed error cannot clear a newer successful result', async () => {
  const scope = createSupportReadScope();
  const old = deferred();
  const visible = [];
  const pending = scope.run(() => old.promise, assert.fail, error => visible.push(error));
  await scope.run(async () => 'current ticket', value => visible.push(value), assert.fail);
  old.reject(new Error('old request failed'));
  await pending;
  assert.deepEqual(visible, ['current ticket']);
});

test('switching filters retires both late successes and failures from the previous filter', async () => {
  for (const fails of [false, true]) {
    const previous = createSupportReadScope();
    const next = createSupportReadScope();
    const old = deferred();
    const visible = [];
    const pending = previous.run(() => old.promise, assert.fail, assert.fail);
    previous.dispose();
    await next.run(async () => 'filtered list', value => visible.push(value), assert.fail);
    if (fails) old.reject(new Error('previous filter failed'));
    else old.resolve('unfiltered list');
    await pending;
    assert.deepEqual(visible, ['filtered list']);
  }
});

test('a queued event from a closed ticket does not start another request', async () => {
  const scope = createSupportReadScope();
  scope.dispose();
  await scope.run(async () => { assert.fail('retired ticket requested again'); }, assert.fail, assert.fail);
});

test('effect reactivation never revives a request from before cleanup', async () => {
  const scope = createSupportReadScope();
  const old = deferred();
  const pending = scope.run(() => old.promise, assert.fail, assert.fail);
  scope.dispose();
  scope.activate();
  // Even before the next read starts, the previous request remains invalid.
  old.resolve('previous mount');
  await pending;
  const visible = [];
  await scope.run(async () => 'current mount', value => visible.push(value), assert.fail);
  assert.deepEqual(visible, ['current mount']);
});

test('a current error is reported and a successful retry can recover', async () => {
  const scope = createSupportReadScope();
  const visible = [];
  await scope.run(async () => { throw new Error('currently unavailable'); }, assert.fail, error => visible.push(error.message));
  await scope.run(async () => 'recovered', value => visible.push(value), assert.fail);
  assert.deepEqual(visible, ['currently unavailable', 'recovered']);
});
