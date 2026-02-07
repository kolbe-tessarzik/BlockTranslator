const UNICODE_STARTS = [
  0x21,   // '!'
  0xE000  // Private Use Area
];

const UNICODE_RANGES = [
  0xD7FF - 0x21 + 1,
  0xFFFD - 0xE000 + 1
];

const TOTAL_CHARS = UNICODE_RANGES[0] + UNICODE_RANGES[1];

function encodeVersion(major, minor, patch, bit) {
  if (
    minor < 0 || minor > 31 ||
    patch < 0 || patch > 31 ||
    major < 0 || major > 15 ||
    (bit !== 0 && bit !== 1)
  ) {
    throw new RangeError(`Value out of range: ${major}.${minor}.${patch} ${bit}`);
  }

  const value =
    (bit << 14) |
    (minor   << 9)  |
    (patch   << 4)  |
    major;

  if (value >= TOTAL_CHARS) {
    throw new RangeError("Encoded value overflow");
  }

  let codePoint = value;
  if (codePoint < UNICODE_RANGES[0]) {
    codePoint += UNICODE_STARTS[0];
  } else {
    codePoint = codePoint - UNICODE_RANGES[0] + UNICODE_STARTS[1];
  }

  return String.fromCodePoint(codePoint);
}

function decodeVersion(char) {
  const cp = char.codePointAt(0);

  let value;
  if (cp >= 0x21 && cp <= 0xD7FF) {
    value = cp - 0x21;
  } else if (cp >= 0xE000 && cp <= 0xFFFD) {
    value = cp - 0xE000 + UNICODE_RANGES[0];
  } else {
    throw new Error("Invalid encoded character");
  }

  return {
    bit: (value >> 14) & 1,
    major:   value & 15,
    minor:   (value >> 9)  & 31,
    patch:   (value >> 4)  & 31,
  };
}

function encodeVersionScript(version) {
    const delimiters = /[ .]+/; // Splits on either a dot or a forward slash
    const list = version.split(delimiters);
    if (list.length !== 4) {
        throw new Error("Invalid name");
    }
    const name = list[0];
    return encodeVersion(... list.slice(1), name == "Fatal" ? 1 : 0);
}

function getVersionScript(char) {
    const ver = decodeVersion(char);
    return `${ver.bit ? "Fatal" : "Kolbe"} ${ver.major}.${ver.minor}.${ver.patch}`;
}

async function loadInitialScript() {
    while (!window.managerJSLoaded) {

    }
    addVersion("Latest", "codec.js");
    loadMyScript("Latest");
}

loadInitialScript();
