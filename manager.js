let myScript;
console.log("Script loaded!");
let jsonData = {};
window.allVersions = [];
const loadedVersions = {};
let currentVersion;

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
  window.allVersions.push(name);
}

window.managerJSLoaded = true;

async function loadDataForCache(url) {
  const response = await fetch(url);
  await response.text();
}

async function loadStuff() {
  // &${Date.now()} is to bust cache
  console.log("Fetching versions . . .");
  const response = await fetch(`https://cdn.jsdelivr.net/gh/kolbe-tessarzik/BlockTranslatorCrossVersion@main/versions.json?force=1&${Date.now()}`, {cache: "no-store"});

  jsonData = {...jsonData, ... (await response.json()) };
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
