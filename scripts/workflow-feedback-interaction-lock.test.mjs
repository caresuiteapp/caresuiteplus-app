import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

let implementation;
try {
  implementation = await import('../src/lib/dom/workflowFeedbackInteractionLock.ts');
} catch (error) {
  if (error.code !== 'ERR_UNKNOWN_FILE_EXTENSION') throw error;
  // Node 20 uses the project's existing compiler; current Node can load TS directly.
  const ts = createRequire(import.meta.url)('typescript');
  const source = readFileSync(new URL('../src/lib/dom/workflowFeedbackInteractionLock.ts', import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  });
  implementation = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}
const { acquireWorkflowFeedbackInteractionLock } = implementation;

class TestElement {
  inert = false;
  isConnected = true;
  attributes = new Set();
  hasAttribute(name) { return this.attributes.has(name); }
}
globalThis.HTMLElement = TestElement;

function setup(count = 2) {
  const root = new TestElement();
  const hosts = Array.from({ length: count }, () => {
    const host = new TestElement();
    host.attributes.add('data-caresuite-workflow-feedback');
    return host;
  });
  const doc = { body: { children: [root, ...hosts] } };
  return { root, hosts, doc };
}

test('previous independent snapshots leave the app permanently inert after overlapping loaders', () => {
  const { root, hosts, doc } = setup();
  const oldAcquire = host => {
    const siblings = doc.body.children.filter(node => node !== host)
      .map(node => ({ node, inert: node.inert }));
    for (const { node } of siblings) node.inert = true;
    return () => { for (const { node, inert } of siblings) node.inert = inert; };
  };
  const closeFirst = oldAcquire(hosts[0]);
  const closeSecond = oldAcquire(hosts[1]);
  closeFirst();
  closeSecond();
  assert.equal(root.inert, true);
});

for (const order of [[0, 1], [1, 0]]) {
  test(`two loaders keep the app locked until both finish, order ${order}`, () => {
    const { root, hosts, doc } = setup();
    const locks = hosts.map(host => acquireWorkflowFeedbackInteractionLock(doc, host));
    assert.equal(root.inert, true);
    assert.equal(hosts.every(host => !host.inert), true);
    assert.equal(locks[0].isTopmost(), false);
    assert.equal(locks[1].isTopmost(), true);
    locks[order[0]].release();
    assert.equal(root.inert, true);
    assert.equal(locks[order[1]].isTopmost(), true);
    locks[order[1]].release();
    assert.equal(root.inert, false);
    assert.equal(locks.every(lock => !lock.isTopmost()), true);
  });
}

for (const order of [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]) {
  test(`three overlapping loaders release safely in order ${order}`, () => {
    const { root, hosts, doc } = setup(3);
    const locks = hosts.map(host => acquireWorkflowFeedbackInteractionLock(doc, host));
    order.forEach((index, step) => {
      locks[index].release();
      assert.equal(root.inert, step !== 2);
    });
  });
}

test('an existing unrelated inert state stays intact after the final release', () => {
  const { root, hosts, doc } = setup();
  root.inert = true;
  const first = acquireWorkflowFeedbackInteractionLock(doc, hosts[0]);
  const second = acquireWorkflowFeedbackInteractionLock(doc, hosts[1]);
  first.release();
  second.release();
  assert.equal(root.inert, true);
});

test('repeated cleanup cannot release another operation or corrupt the next operation', () => {
  const { root, hosts, doc } = setup();
  const first = acquireWorkflowFeedbackInteractionLock(doc, hosts[0]);
  const second = acquireWorkflowFeedbackInteractionLock(doc, hosts[1]);
  first.release();
  first.release();
  assert.equal(root.inert, true);
  second.release();
  const next = acquireWorkflowFeedbackInteractionLock(doc, hosts[0]);
  second.release();
  assert.equal(root.inert, true);
  next.release();
  assert.equal(root.inert, false);
});

test('a detached latest host stops intercepting keyboard focus from a remaining loader', () => {
  const { hosts, doc } = setup();
  const first = acquireWorkflowFeedbackInteractionLock(doc, hosts[0]);
  const second = acquireWorkflowFeedbackInteractionLock(doc, hosts[1]);
  hosts[1].isConnected = false;
  assert.equal(first.isTopmost(), true);
  assert.equal(second.isTopmost(), false);
  second.release();
  first.release();
});

test('separate documents have independent active dialogs and background locks', () => {
  const a = setup(1), b = setup(1);
  const first = acquireWorkflowFeedbackInteractionLock(a.doc, a.hosts[0]);
  const second = acquireWorkflowFeedbackInteractionLock(b.doc, b.hosts[0]);
  assert.equal(first.isTopmost(), true);
  assert.equal(second.isTopmost(), true);
  first.release();
  assert.equal(a.root.inert, false);
  assert.equal(b.root.inert, true);
  second.release();
});
