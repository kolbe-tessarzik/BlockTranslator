const READY_POLL_INTERVAL_MS = 10;
const READY_TIMEOUT_MS = 1000;

const IS_WORKER = true;
self.window = self;

function createNullElement() {
  const noop = () => {};
  const classList = { add: noop, remove: noop, toggle: noop, contains: () => false };
  const style = {};
  return new Proxy({}, {
    get(_t, prop) {
      if (prop === "style") return style;
      if (prop === "classList") return classList;
      if (prop === "value") return "";
      if (prop === "checked") return false;
      if (prop === "disabled") return false;
      if (prop === "innerText" || prop === "textContent" || prop === "innerHTML") return "";
      if (
        prop === "appendChild" ||
        prop === "removeChild" ||
        prop === "addEventListener" ||
        prop === "removeEventListener" ||
        prop === "setAttribute" ||
        prop === "getAttribute" ||
        prop === "querySelector" ||
        prop === "querySelectorAll" ||
        prop === "dispatchEvent" ||
        prop === "click" ||
        prop === "focus" ||
        prop === "blur"
      ) return noop;
      if (prop === "getContext") return () => null;
      return undefined;
    },
    set() { return true; }
  });
}

const NULL_ELEMENT = createNullElement();

self.document = self.document || {};
self.document.head = self.document.head || {
  appendChild() {},
  removeChild() {}
};
self.document.body = self.document.body || {
  appendChild() {},
  removeChild() {}
};
self.document.createElement = self.document.createElement || (() => createNullElement());
self.document.getElementById = self.document.getElementById || (() => NULL_ELEMENT);
self.document.querySelector = self.document.querySelector || (() => NULL_ELEMENT);
self.document.querySelectorAll = self.document.querySelectorAll || (() => []);
self.document.addEventListener = self.document.addEventListener || (() => {});
self.document.removeEventListener = self.document.removeEventListener || (() => {});
globalThis.document = self.document;

let initPromise = null;

function serializeError(err) {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message || String(err);
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function waitForExports() {
  const start = performance.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (typeof self.encrypt === "function" && typeof self.decrypt === "function") {
        resolve();
        return;
      }
      if (performance.now() - start >= READY_TIMEOUT_MS) {
        reject(new Error("Script didn't expose encrypt/decrypt"));
        return;
      }
      setTimeout(tick, READY_POLL_INTERVAL_MS);
    };
    tick();
  });
}

function resolveModuleUrl(url) {
  try {
    return new URL(url, self.location.href).href;
  } catch (e) {
    return url;
  }
}

async function init(url) {
  if (!initPromise) {
    initPromise = (async () => {
      self.window = self;
      const resolved = resolveModuleUrl(url);
      await import(resolved);
      await waitForExports();
      return true;
    })();
  }
  return initPromise;
}

self.addEventListener("message", async (event) => {
  const msg = event.data || {};

  if (msg.type === "init") {
    try {
      await init(msg.url);
      self.postMessage({ type: "ready" });
    } catch (err) {
      self.postMessage({ type: "init-error", error: serializeError(err) });
    }
    return;
  }

  if (msg.type === "call") {
    const { id, action } = msg;
    const payload = msg.payload || {};
    const text = payload.text ?? "";
    const key = payload.key ?? "";
    try {
      if (!initPromise) {
        throw new Error("Worker not initialized");
      }
      await initPromise;
      let result;
      if (action === "encrypt") {
        result = await self.encrypt(text, key);
      } else if (action === "decrypt") {
        result = await self.decrypt(text, key);
      } else {
        throw new Error(`Unknown action: ${action}`);
      }
      self.postMessage({ type: "response", id, ok: true, result });
    } catch (err) {
      self.postMessage({ type: "response", id, ok: false, error: serializeError(err) });
    }
  }
});
