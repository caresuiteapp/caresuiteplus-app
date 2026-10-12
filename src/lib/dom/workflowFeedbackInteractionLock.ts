type BackgroundLock = { originalInert: boolean; owners: Set<symbol> };

const backgroundLocks = new WeakMap<HTMLElement, BackgroundLock>();
const documentDialogs = new WeakMap<Document, Map<symbol, HTMLElement>>();

/** Keep concurrent loaders locked until their last owner has finished. */
export function acquireWorkflowFeedbackInteractionLock(doc: Document, host: HTMLElement) {
  const owner = Symbol('workflow-feedback');
  const dialogs = documentDialogs.get(doc) ?? new Map<symbol, HTMLElement>();
  documentDialogs.set(doc, dialogs);
  dialogs.set(owner, host);

  const siblings = Array.from(doc.body.children).filter(
    (node): node is HTMLElement => node instanceof HTMLElement &&
      node !== host && !node.hasAttribute('data-caresuite-workflow-feedback'),
  );
  for (const node of siblings) {
    let lock = backgroundLocks.get(node);
    if (!lock) {
      lock = { originalInert: node.inert, owners: new Set() };
      backgroundLocks.set(node, lock);
    }
    lock.owners.add(owner);
    node.inert = true;
  }

  let released = false;
  return {
    isTopmost: () => {
      const connected = Array.from(dialogs.values()).filter(node => node.isConnected);
      return !released && connected[connected.length - 1] === host;
    },
    release: () => {
      if (released) return;
      released = true;
      dialogs.delete(owner);
      for (const node of siblings) {
        const lock = backgroundLocks.get(node);
        if (!lock || !lock.owners.delete(owner)) continue;
        if (lock.owners.size > 0) {
          node.inert = true;
        } else {
          node.inert = lock.originalInert;
          backgroundLocks.delete(node);
        }
      }
      if (dialogs.size === 0) documentDialogs.delete(doc);
    },
  };
}
