let myScript;

let jsonData = {};
window.allVersions = [];

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
    if (myScript) {
        if (cleanup) {
          // allow script to clean up before unloading
          await cleanup();
          cleanup = undefined;
        }
        document.head.removeChild(myScript);
    }
    myScript = document.createElement('script');
    myScript.type = "module";
    myScript.src = jsonData[version];
    myScript.onload = () => {
        if (encrypt && decrypt) {
          resolve();
        } else {
          reject("Script didn't expose the right functions");
        }
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

async function loadStuff() {
  const response = await fetch(`https://cdn.jsdelivr.net/gh/kolbe-tessarzik/BlockTranslatorCrossVersion@main/versions.json?force=1`);

  jsonData = {...jsonData, ... JSON.parse(await response.text()) };
  window.allVersions = Array.from(Object.keys(jsonData));
}

loadStuff().then(() => console.log(window.allVersions));
