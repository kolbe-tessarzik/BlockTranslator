let myScript;
console.log("Script loaded!");
let jsonData = {};
window.allVersions = [];
const loadedVersions = {};
let currentVersion;
let devState = false;
let devFileInput;
let customObjectUrl;
const CUSTOM_VERSION_NAME = "Custom";

async function selectVersion(version) {
    if (jsonData[version] !== undefined) {
        await loadMyScript(version);
    } else {
        throw new Error(`Invalid version '${version}'`);
    }
}

function loadMyScript(version) {
  return new Promise(async (resolve, reject) => {
    if (!window.allVersions.includes(version)) {
      console.log(window.allVersions);
      reject(`invalid version: ${version}`);
      return;
    }
    if (loadedVersions[version]) {
      const cached = loadedVersions[version];
      window.encrypt = cached.encrypt;
      window.decrypt = cached.decrypt;
      window.cleanup = cached.cleanup;
      currentVersion = version;
      resolve();
      return;
    }
    // clear globals so we can detect the new module's exports reliably
    window.encrypt = undefined;
    window.decrypt = undefined;
    if (myScript) {
        if (window.cleanup) {
          // allow script to clean up before unloading
          await window.cleanup();
          window.cleanup = undefined;
        }
        document.head.removeChild(myScript);
    }
    myScript = document.createElement('script');
    myScript.type = "module";
    myScript.src = jsonData[version];
    myScript.onload = () => {
        const start = performance.now();
        const maxWaitMs = 1000;
        const tick = () => {
          if (window.encrypt && window.decrypt) {
            loadedVersions[version] = {
              encrypt: window.encrypt,
              decrypt: window.decrypt,
              cleanup: window.cleanup,
            };
            currentVersion = version;
            resolve();
            return;
          }
          if (performance.now() - start >= maxWaitMs) {
            reject("Script didn't expose the right functions");
            return;
          }
          setTimeout(tick, 10);
        };
        tick();
    };
    myScript.onerror = reject;
    document.head.appendChild(myScript);
  });

}

function addVersion(name, url) {
  jsonData[name] = url;
  if (!window.allVersions.includes(name)) {
    window.allVersions.push(name);
  }
}

window.managerJSLoaded = true;

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

Object.defineProperty(window, 'dev', {
  configurable: true,
  get() { return devState; },
  set(val) {
    const next = Boolean(val);
    devState = next;
    if (next) activateDevMode();
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
