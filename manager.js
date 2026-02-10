console.log("Script loaded!");
let jsonData = {};
window.allVersions = [];
const workerControllers = {};
let devState = false;
let devFileInput;
let customObjectUrl;
const CUSTOM_VERSION_NAME = "Custom";
const WORKER_PATH = "version-worker.js";

async function selectVersion(version) {
  if (jsonData[version] !== undefined) {
    await ensureWorkerForVersion(version);
  } else {
    throw new Error(`Invalid version '${version}'`);
  }
}

function resolveVersionUrl(version) {
  const url = jsonData[version];
  if (!url) {
    throw new Error(`Invalid version '${version}'`);
  }
  return url;
}

function createWorkerController(version, url) {
  const worker = new Worker(WORKER_PATH, { type: "module" });
  const pending = new Map();
  let requestId = 1;
  let readyResolve;
  let readyReject;
  let readySettled = false;

  const ready = new Promise((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });

  function settleReady(ok, value) {
    if (readySettled) return;
    readySettled = true;
    if (ok) readyResolve();
    else readyReject(value);
  }

  function failAll(err) {
    for (const { reject } of pending.values()) {
      reject(err);
    }
    pending.clear();
  }

  worker.addEventListener("message", (event) => {
    const msg = event.data || {};
    if (msg.type === "ready") {
      settleReady(true);
      return;
    }
    if (msg.type === "init-error") {
      const err = new Error(msg.error || `Worker init failed for ${version}`);
      settleReady(false, err);
      failAll(err);
      return;
    }
    if (msg.type === "response") {
      const entry = pending.get(msg.id);
      if (!entry) return;
      pending.delete(msg.id);
      if (msg.ok) entry.resolve(msg.result);
      else entry.reject(new Error(msg.error || "Worker failed"));
    }
  });

  worker.addEventListener("error", (event) => {
    const err = event?.error || new Error(`Worker error for ${version}`);
    settleReady(false, err);
    failAll(err);
  });

  worker.postMessage({ type: "init", version, url });

  return {
    worker,
    ready,
    call(action, payload) {
      return ready.then(() => new Promise((resolve, reject) => {
        const id = requestId++;
        pending.set(id, { resolve, reject });
        worker.postMessage({ type: "call", id, action, payload });
      }));
    },
    terminate(reason) {
      worker.terminate();
      failAll(new Error(reason || "Worker terminated"));
    }
  };
}

function ensureWorkerForVersion(version) {
  const url = resolveVersionUrl(version);
  if (!workerControllers[version]) {
    workerControllers[version] = createWorkerController(version, url);
  }
  return workerControllers[version].ready.then(() => workerControllers[version]).catch((err) => {
    workerControllers[version]?.terminate("Worker init failed");
    delete workerControllers[version];
    throw err;
  });
}

async function encryptWithVersion(version, text, key) {
  const worker = await ensureWorkerForVersion(version);
  return worker.call("encrypt", { text, key });
}

async function decryptWithVersion(version, text, key) {
  const worker = await ensureWorkerForVersion(version);
  return worker.call("decrypt", { text, key });
}

function loadMyScript(version) {
  return ensureWorkerForVersion(version);
}

function addVersion(name, url) {
  const prevUrl = jsonData[name];
  jsonData[name] = url;
  if (!window.allVersions.includes(name)) {
    window.allVersions.push(name);
  }
  if (prevUrl && prevUrl !== url && workerControllers[name]) {
    workerControllers[name].terminate("Version URL updated");
    delete workerControllers[name];
  }
}

window.managerJSLoaded = true;
window.encryptWithVersion = encryptWithVersion;
window.decryptWithVersion = decryptWithVersion;
window.loadMyScript = loadMyScript;

function ensureDevFileInput() {
  if (devFileInput) return devFileInput;
  devFileInput = document.createElement('input');
  devFileInput.type = 'file';
  devFileInput.accept = '.js,.mjs,application/javascript,text/javascript';
  devFileInput.style.position = 'fixed';
  devFileInput.style.left = '-9999px';
  devFileInput.style.width = '1px';
  devFileInput.style.height = '1px';
  devFileInput.setAttribute('aria-hidden', 'true');
  devFileInput.addEventListener('change', () => {
    const file = devFileInput.files && devFileInput.files[0];
    if (!file) return;
    if (customObjectUrl) {
      URL.revokeObjectURL(customObjectUrl);
    }
    customObjectUrl = URL.createObjectURL(file);
    addVersion(CUSTOM_VERSION_NAME, customObjectUrl);
    window.dispatchEvent(new Event("versions-loaded"));
  });
  document.body.appendChild(devFileInput);
  return devFileInput;
}

function activateDevMode() {
  if (!document.body) {
    window.addEventListener('DOMContentLoaded', activateDevMode, { once: true });
    return;
  }
  const input = ensureDevFileInput();
  // Show file selector immediately on dev mode activation
  input.value = '';
  input.click();
}

function areArrsEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((value, index) => value === b[index]);
}


Object.defineProperty(window, 'dev', {
  configurable: true,
  get() { return devState; },
  set(val) {
    const next = Boolean(val);
    devState = next;
    if (!next) return;

    if (!window.devPw) {
      activateDevMode();
      return;
    }

    const pwValue = typeof window.devPw === 'string' ? window.devPw : window.devPw.value;
    if (pwValue === 'mangos') {
      activateDevMode();
    }
  }
});

async function loadDataForCache(url) {
  const response = await fetch(url);
  await response.text();
}

async function loadStuff() {
  // &${Date.now()} is to bust cache
  console.log("Fetching versions . . .");
  const response = await fetch(`https://cdn.jsdelivr.net/gh/kolbe-tessarzik/BlockTranslatorCrossVersion@main/versions.json?force=1&${Date.now()}`, {cache: "no-store"});

  const existingCustomUrl = jsonData[CUSTOM_VERSION_NAME];
  jsonData = {...jsonData, ... (await response.json()) };
  if (existingCustomUrl) {
    jsonData[CUSTOM_VERSION_NAME] = existingCustomUrl;
  }
  window.allVersions = Array.from(Object.keys(jsonData));
  for (const ver of window.allVersions) {
    // don't await, the point is just to cache for faster loading in the future
    // loadDataForCache(ver);
  }
}

loadStuff().then(() => {
  window.versionsLoaded = true;
  window.dispatchEvent(new Event("versions-loaded"));
}).catch((error) => {
  console.error('Failed to load versions:', error);
});
