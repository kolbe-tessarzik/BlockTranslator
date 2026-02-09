import pako from "https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako.esm.mjs";

let helper;

if (window.location.href.includes("http://localhost:")) {
  // dev; use local copy
  helper = await import('./helpers.js');
} else {
  // use cdn version
  helper = await import(`https://cdn.jsdelivr.net/gh/kolbe-tessarzik/BlockTranslator@e0f676a144210148c66923ec08128c11bda4a53f/helpers.js?${Date.now()}`);
}

const enc = new TextEncoder();
const dec = new TextDecoder();

/* --- CONFIGURATION --- */
const STATIC_DICT = [
  " the "," and "," to "," of "," in "," that "," is "," for ",
  "ing","tion","ion","ed ","ly ","er ","re ","on ","th","he","in","er"
].sort((a,b)=>b.length-a.length);

const MIN_MATCH = 4;
const MAX_MATCH = 10;
const MIN_OCCURRENCE = 2;
const MAX_DICT_ENTRIES = 200; // keep <=254 so token indices fit in one byte
const ESC = 0xFF; // escape marker for tokens (safe in UTF-8 byte stream)

/* --- Legacy static Huffman tables (old mode) --- */

const huffmanTokens = [
    " ",
    "e",
    "t",
    "o",
    "a",
    "i",
    "n",
    "s",
    "h",
    "r",
    "l",
    "\n",
    "u",
    "y",
    ".",
    "d",
    "w",
    "m",
    "g",
    "c",
    "b",
    "f",
    "'",
    ",",
    "k",
    "p",
    "!",
    "v",
    "?",
    "j",
    "z",
    "-",
    "x",
    "q",
    "\"",
    "0",
    "1",
    "2",
    "3",
    "5",
    "7",
    "8",
    "4",
    "9",
    ":",
    "6",
    "e ",
    " t",
    "th",
    "t ",
    ".\n",
    "s ",
    "ou",
    "he",
    "in",
    " a",
    " i",
    ", ",
    "re",
    " w",
    " b",
    "an",
    "on",
    "er",
    "ha",
    " s",
    " h",
    "at",
    "yo",
    " o",
    "ng",
    "it",
    "d ",
    "y ",
    "o ",
    " y",
    "n ",
    "!\n",
    ". ",
    "be",
    "ll",
    "is",
    "es",
    " m",
    " c",
    "to",
    " d",
    "r ",
    "hi",
    "a ",
    "ee",
    "ve",
    "ar",
    "st",
    " f",
    "?\n",
    "ne",
    "al",
    "g ",
    "en",
    "ea",
    "or",
    "no",
    " g",
    "we",
    " l",
    "i ",
    "u ",
    "ho",
    "ow",
    "me",
    "'s",
    "l ",
    "ur",
    "wh",
    "le",
    "\ni",
    "e.",
    " n",
    "nd",
    "se",
    "do",
    " p",
    "li",
    "ti",
    "lo",
    "te",
    "ot",
    "f ",
    "\nw",
    "ma",
    "ut",
    "\nt",
    "as",
    "co",
    "of",
    " r",
    "el",
    "ry",
    "n'",
    "ey",
    "t.",
    "go",
    "om",
    "us",
    "'t",
    "nt",
    "ca",
    "ri",
    "wa",
    "m ",
    "ke",
    "t'",
    "ta",
    "et",
    "ro",
    "so",
    "s.",
    "\ny",
    "de",
    "! ",
    "ed",
    "k ",
    " k",
    "ad",
    "w ",
    "av",
    "i'",
    "oo",
    "la",
    "ki",
    "ay",
    "ul",
    "e'",
    "ld",
    " j",
    "..",
    "ck",
    "h ",
    "\nh",
    "mo",
    "e!",
    "ge",
    "gh",
    "wi",
    "wo",
    "ye",
    " e",
    "ly",
    "rr",
    "rs",
    "ch",
    "\na",
    "ra",
    "ic",
    "ol",
    "tt",
    "ba",
    "fl",
    "ig",
    "os",
    "y.",
    "'r",
    "ns",
    "s!",
    "'m",
    "ev",
    "s,",
    "\nb",
    "ce",
    "ec",
    "pe",
    "bu",
    "fo",
    "ht",
    "ie",
    "il",
    "y,",
    "di",
    "e?",
    "na",
    "nk",
    "am",
    "bo",
    "ac",
    "io",
    "po",
    "un",
    "ss",
    "\ns",
    "bl",
    "kn",
    " u",
    "id",
    "n.",
    "ak",
    "e,",
    "sh",
    "ai",
    "if",
    "d.",
    "em",
    "ir",
    "sa",
    "si",
    "? ",
    "fe",
    "ju",
    "od",
    "rt",
    "su",
    "p ",
    "\no",
    "g.",
    "im",
    "ni",
    "t!",
    "t?",
    "tr",
    "up",
    "hu",
    "pl",
    "um",
    "my",
    "r.",
    "fr",
    "iv",
    "mi",
    "ab",
    "da",
    "oi",
    "ok",
    "u'",
    "ct",
    "tu",
    "h,",
    "pa",
    "rd",
    "\nn",
    "nc",
    "op",
    "s?",
    "t,",
    "\nm",
    "fi",
    "n,",
    "pr",
    "ap",
    "pi",
    "ik",
    "ny",
    "ov",
    "ug",
    " v",
    "ci",
    "gr",
    "nn",
    "y!",
    "gi",
    "k.",
    "o.",
    "ff",
    "gu",
    "vi",
    "fa",
    "jo",
    "l.",
    "oh",
    "ts",
    "va",
    "rk",
    "tl",
    "ob",
    "\nc",
    "ah",
    "dy",
    "ia",
    "lk",
    "n!",
    "sp",
    "cr",
    "w.",
    "\nl",
    "br",
    "hy",
    "n?",
    "o,",
    "rn",
    "sn",
    "y'",
    "'l",
    "ep",
    "ex",
    "fu",
    "r,",
    "r!",
    "sm",
    "uc",
    "ue",
    "au",
    "mp",
    "ew",
    "ga",
    "y?",
    "\nd",
    "'v",
    "ag",
    "h.",
    "oc",
    "pp",
    "qu",
    "mu",
    "wn",
    "ds",
    "?!",
    "dr",
    "l,",
    "rm",
    "sc",
    "ty",
    "ua",
    "aw",
    "g?",
    "gs",
    "lu",
    "mb",
    "yb",
    "ys",
    "zz",
    "\nr",
    "cu",
    "ks",
    "ls",
    "oe",
    "p.",
    "ui",
    "\ng",
    "bi",
    "cl",
    "eg",
    "k,",
    "mr",
    "rl",
    "uz",
    "d,",
    "dn",
    "ei",
    "m.",
    "og",
    "af",
    "az",
    "by",
    "nl",
    "du",
    "ef",
    "g,",
    "pu",
    "ru",
    "w,",
    "yi",
    "b ",
    "g!",
    "hr",
    "oy",
    "'d",
    "e-",
    "lt",
    "r?",
    "u.",
    "w!",
    "yt",
    "\nv",
    "a,",
    "tw",
    "ud",
    "\nf",
    "\np",
    " q",
    "eo",
    "ip",
    "lp",
    "m!",
    "nu",
    "ps",
    "sk",
    "tc",
    "ft",
    "m,",
    "oa",
    "u?",
    "uy",
    "ws",
    "a.",
    "ms",
    "rc",
    "sl",
    "u,",
    "zy",
    "\nk",
    "lm",
    "o!",
    "yw",
    "\nj",
    "d!",
    "d?",
    "ek",
    "mm",
    "o?",
    "pt",
    "sq",
    "sy",
    "z,",
    " \"",
    "-b",
    ",\n",
    "00",
    "b.",
    "c ",
    "ib",
    "je",
    "k!",
    "rg",
    "sw",
    "ub",
    "vo",
    "-a",
    "a!",
    "bs",
    "gl",
    "ja",
    "ky",
    "l?",
    "m?",
    "p,",
    "rp",
    "rv",
    "uf",
    "xp",
    "ze",
    "\ne",
    "0 ",
    "dd",
    "eh",
    "h!",
    "kr",
    "lf",
    "nf",
    "p!",
    "ph",
    "tg",
    "x ",
    "xt",
    "zi",
    "\nu",
    " 2",
    "-f",
    "\" ",
    "a?",
    "bb",
    "c.",
    "gn",
    "h?",
    "k?",
    "nh",
    "o'",
    "py",
    "rf",
    "wr",
    "xa",
    "xc",
    " '",
    "-c",
    "-o",
    "-t",
    "?\"",
    "'a",
    "d-",
    "eb",
    "f.",
    "iz",
    "ka",
    "lw",
    "n-",
    "p-",
    "r-",
    "rw",
    "w?",
    "wy",
    "y-",
    "yc",
    "ym",
    "\n ",
    "\n.",
    "\n\"",
    " 1",
    " 3",
    "-d",
    "-m",
    "-s",
    ".\"",
    "\"\n",
    "27",
    "30",
    "a-",
    "a'",
    "c!",
    "cc",
    "dl",
    "dv",
    "ez",
    "h-",
    "hn",
    "i,",
    "i?",
    "i.",
    "ix",
    "ko",
    "l-",
    "l!",
    "lc",
    "nb",
    "o-",
    "rh",
    "w'",
    "ya",
    "yd",
    "z!",
    " 0",
    " 8",
    "-e",
    "-g",
    "-i",
    "-k",
    "-y",
    "!!",
    ".i",
    "' ",
    "'c",
    "\"?",
    "\"t",
    "\"w",
    "09",
    "10",
    "5.",
    "7 ",
    "75",
    "90",
    "ae",
    "ax",
    "c?",
    "cs",
    "cy",
    "d'",
    "db",
    "df",
    "dm",
    "e\n",
    "f?",
    "fk",
    "gg",
    "hl",
    "hm",
    "i-",
    "jf",
    "kl",
    "kw",
    "lr",
    "m-",
    "nj",
    "ox",
    "p?",
    "t-",
    "td",
    "tn",
    "tv",
    "u!",
    "uh",
    "v?",
    "wf",
    "x,",
    "xi",
    "z ",
    "z.",
    "za",
    "zw",
    "\n3",
    "\nq",
    "  ",
    " 4",
    " 7",
    " 9",
    "-8",
    "-h",
    "-l",
    "-n",
    "-p",
    ",\"",
    ",0",
    ",h",
    ": ",
    ":1",
    ".?",
    ".a",
    ".r",
    ".u",
    "'e",
    "'n",
    "\"!",
    "\"d",
    "\"e",
    "\"h",
    "\"i",
    "\"m",
    "\"s",
    "\"y",
    "0!",
    "0.",
    "05",
    "0s",
    "1.",
    "11",
    "15",
    "18",
    "20",
    "24",
    "35",
    "3r",
    "44",
    "47",
    "4b",
    "5 ",
    "5,",
    "56",
    "6.",
    "7-",
    "8,",
    "80",
    "81",
    "83",
    "9:",
    "aj",
    "b,",
    "b!",
    "b'",
    "bj",
    "bv",
    "d\n",
    "dg",
    "dh",
    "dj",
    "dw",
    "ej",
    "eq",
    "eu",
    "f!",
    "f'",
    "fc",
    "fs",
    "g'",
    "g\"",
    "gd",
    "gt",
    "gy",
    "hh",
    "hs",
    "i!",
    "iu",
    "j-",
    "k'",
    "kb",
    "kf",
    "kh",
    "kp",
    "kt",
    "l'",
    "lv",
    "m'",
    "ml",
    "mn",
    "n:",
    "np",
    "nr",
    "nv",
    "nw",
    "nx",
    "oq",
    "oz",
    "r'",
    "rb",
    "rj",
    "s\n",
    "s-",
    "s'",
    "s\"",
    "tb",
    "tm",
    "uj",
    "uo",
    "uq",
    "v.",
    "vy",
    "w\n",
    "wb",
    "wd",
    "wg",
    "wk",
    "wl",
    "x!",
    "x.",
    "xe",
    "xh",
    "y\"",
    "yn",
    "yr",
    "z?",
    "zo"
];

const huffmanTokenMap = new Map(huffmanTokens.map((token, i) => [token, i]));
const maxHuffmanTokenLen = huffmanTokens.reduce((max, token) => Math.max(max, token.length), 0);

function appendBits(buf, bits) {
  if (typeof bits !== "string" || !/^[01]+$/.test(bits)) {
    throw new Error(`Invalid bits '${bits}'`);
  }
  return buf + bits;
}

function bitsToByteArray(bits) {
  if (bits === "") return new Uint8Array([0]);
  const padding = (8 - (bits.length % 8)) % 8;
  const padded = padding ? (bits + "0".repeat(padding)) : bits;
  const bytes = new Uint8Array(1 + padded.length / 8);
  bytes[0] = padding;
  for (let i = 0; i < padded.length; i += 8) {
    bytes[1 + i / 8] = parseInt(padded.slice(i, i + 8), 2);
  }
  return bytes;
}

function byteArrayToBits(bytes) {
  if (bytes.length === 0) return "";
  const padding = bytes[0];
  let bits = "";
  for (let i = 1; i < bytes.length; i++) {
    bits += helper.numToBits(bytes[i], 8);
  }
  return padding ? bits.slice(0, -padding) : bits;
}

function bytesToBits(bytes) {
  let bits = "";
  for (const byte of bytes) {
    bits += helper.numToBits(byte, 8);
  }
  return bits;
}

function bitsToBytesExact(bits) {
  if (bits.length % 8 !== 0) {
    throw new Error("Compressed bitstream is not byte-aligned");
  }
  const out = new Uint8Array(bits.length / 8);
  for (let i = 0; i < bits.length; i += 8) {
    out[i / 8] = parseInt(bits.slice(i, i + 8), 2);
  }
  return out;
}

function bitToBool(char) {
  if (char !== "0" && char !== "1") {
    throw new Error(`bitToBool required binary value; '${char}' is invalid`);
  }
  return (char == "1");
}

/* --- BLOCK_CHARS / keyed alphabet --- */
let BLOCK_CHARS = null;
function buildBlockChars() {
  if (BLOCK_CHARS) return BLOCK_CHARS;
  const out = [];
  const reCcCf = /[\p{Cc}\p{Cf}]/u;
  const reMnMe = /\p{Mn}|\p{Me}/u;
  for (let cp = 0x21; cp <= 0xFFFD; cp++) {
    if (cp >= 0xD800 && cp <= 0xDFFF) { cp = 0xDFFF; continue; }
    try {
      const ch = String.fromCodePoint(cp);
      if (/\s/.test(ch)) continue;
      if (reCcCf.test(ch)) continue;
      if (reMnMe.test(ch)) continue;
      out.push(ch);
    } catch (e) {
      // ignore invalid codepoints
    }
  }
  BLOCK_CHARS = out;
  return out;
}

async function getKeyedChars(key) {
  if (!BLOCK_CHARS) BLOCK_CHARS = buildBlockChars();
  if (!key) return BLOCK_CHARS;
  const off = await helper.sha256ToOffset(key, BLOCK_CHARS.length);
  return BLOCK_CHARS.slice(off).concat(BLOCK_CHARS.slice(0, off));
}

/* --- Dynamic dictionary (digger) --- */
function findCandidates(text, sampleLimit = 200000) {
  const s = (text.length > sampleLimit) ? text.slice(0, sampleLimit) : text;
  const counts = new Map();

  for (let L = MIN_MATCH; L <= MAX_MATCH; L++) {
    const seen = new Map();
    for (let i = 0; i + L <= s.length; i++) {
      const sub = s.slice(i, i + L);
      const v = (seen.get(sub) || 0) + 1;
      seen.set(sub, v);
    }
    for (const [sub, cnt] of seen.entries()) {
      if (cnt >= MIN_OCCURRENCE) {
        counts.set(sub, (counts.get(sub) || 0) + cnt);
      }
    }
  }

  const candidates = [];
  for (const [sub, cnt] of counts.entries()) {
    const len = sub.length;
    const savingPer = len - 3; // ESC + 1-byte index (3 bytes)
    const estSavings = cnt * savingPer - (2 + len); // dict storage cost
    if (estSavings > 0) candidates.push({ sub, cnt, len, estSavings });
  }

  candidates.sort((a,b)=>b.estSavings - a.estSavings);
  return candidates.slice(0, MAX_DICT_ENTRIES);
}

function buildDynamicDict(text) {
  const candidates = findCandidates(text);
  const dict = candidates.map(c => c.sub);
  const merged = dict.concat(STATIC_DICT.filter(s => !dict.includes(s)));
  return merged.slice(0, 254);
}

/* --- Tokenize / detokenize using ESC + single-byte index --- */
function tokenizeWithDict(str, dict) {
  const out = [];
  let i = 0;
  while (i < str.length) {
    let matched = false;
    for (let j = 0; j < dict.length; j++) {
      const d = dict[j];
      if (str.startsWith(d, i)) {
        out.push(ESC, j);
        i += d.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    const cp = str.codePointAt(i);
    const ch = String.fromCodePoint(cp);
    const bs = enc.encode(ch);
    for (const b of bs) out.push(b);
    i += ch.length;
  }
  return new Uint8Array(out);
}

function detokenizeFromBytesWithDict(bytes, dict) {
  const result = [];
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b === ESC) {
      if (i + 1 >= bytes.length) throw new Error("Truncated token stream");
      const idx = bytes[++i];
      if (idx >= dict.length) throw new Error("Invalid token index");
      const chunk = enc.encode(dict[idx]);
      for (const cb of chunk) result.push(cb);
    } else {
      result.push(b);
    }
  }
  return dec.decode(new Uint8Array(result));
}

/* --- Huffman coding (canonical) --- */
function buildHuffmanLengths(bytes) {
  const freq = new Uint32Array(256);
  for (const b of bytes) freq[b]++;

  const nodes = [];
  for (let s = 0; s < 256; s++) {
    if (freq[s] > 0) nodes.push({ sym: s, w: freq[s] });
  }
  if (nodes.length === 0) return {};

  if (nodes.length === 1) {
    return { lengths: { [nodes[0].sym]: 1 } };
  }

  const pq = nodes.slice();
  pq.sort((a,b)=>a.w - b.w);
  while (pq.length > 1) {
    const a = pq.shift();
    const b = pq.shift();
    const parent = { w: a.w + b.w, left: a, right: b };
    let inserted = false;
    for (let i = 0; i < pq.length; i++) {
      if (parent.w <= pq[i].w) { pq.splice(i, 0, parent); inserted = true; break; }
    }
    if (!inserted) pq.push(parent);
  }
  const root = pq[0];

  const lengths = {};
  function walk(n, depth) {
    if (!n) return;
    if (n.sym !== undefined) {
      lengths[n.sym] = depth;
      return;
    }
    walk(n.left, depth + 1);
    walk(n.right, depth + 1);
  }
  walk(root, 0);

  return { lengths };
}

function buildCanonicalCodes(lengthsMap) {
  const items = Object.entries(lengthsMap).map(([s,l]) => ({ sym: Number(s), len: l }));
  items.sort((a,b) => a.len - b.len || a.sym - b.sym);
  const codes = {};
  let code = 0;
  let prevLen = 0;
  for (const it of items) {
    if (it.len !== prevLen) {
      code <<= (it.len - prevLen);
      prevLen = it.len;
    }
    codes[it.sym] = { code: code, len: it.len };
    code++;
  }
  const byLen = {};
  for (const symStr in codes) {
    const s = Number(symStr);
    const { code: c, len } = codes[s];
    if (!byLen[len]) byLen[len] = new Map();
    byLen[len].set(c, s);
  }
  return { codes, byLen };
}

function huffmanEncodeWithBitlen(bytes, codes) {
  const out = [];
  let cur = 0;
  let nbits = 0;
  let totalBits = 0;
  for (const b of bytes) {
    const e = codes[b];
    if (!e) throw new Error("Missing Huffman code for symbol: " + b);
    const { code, len } = e;
    totalBits += len;
    for (let k = len - 1; k >= 0; k--) {
      const bit = (code >> k) & 1;
      cur = (cur << 1) | bit;
      nbits++;
      if (nbits === 8) {
        out.push(cur & 0xFF);
        cur = 0; nbits = 0;
      }
    }
  }
  if (nbits > 0) {
    cur = cur << (8 - nbits);
    out.push(cur & 0xFF);
  }
  return { bytes: new Uint8Array(out), bitLen: totalBits };
}

function huffmanDecodeFromBits(bytes, bitLen, byLen) {
  const out = [];
  let acc = 0;
  let accLen = 0;
  let bitsConsumed = 0;
  for (let i = 0; i < bytes.length; i++) {
    let val = bytes[i];
    for (let b = 7; b >= 0; b--) {
      if (bitsConsumed >= bitLen) break;
      const bit = (val >> b) & 1;
      acc = (acc << 1) | bit;
      accLen++;
      bitsConsumed++;
      const mp = byLen[accLen];
      if (mp && mp.has(acc)) {
        out.push(mp.get(acc));
        acc = 0;
        accLen = 0;
      }
    }
  }
  return new Uint8Array(out);
}

/* --- framing helpers --- */
function u32(n){ return [(n>>24)&0xFF,(n>>16)&0xFF,(n>>8)&0xFF,n&0xFF]; }

function makeFrameRaw(dict, huffEntries, dataBitLen, dataBytes) {
  const dictEncoded = dict.map(s => enc.encode(s));
  let dictBytesLen = 0;
  for (const d of dictEncoded) dictBytesLen += d.length;
  const huffEntriesLen = huffEntries.length;
  const headerLen = 2 + dict.length*2 + (huffEntriesLen?2 + (huffEntriesLen*2):2) + 4;
  const totalLen = headerLen + dictBytesLen + dataBytes.length;
  const out = new Uint8Array(totalLen);
  let p = 0;
  out[p++] = (dict.length >> 8) & 0xFF;
  out[p++] = dict.length & 0xFF;
  for (const b of dictEncoded) {
    out[p++] = (b.length >> 8) & 0xFF;
    out[p++] = b.length & 0xFF;
    out.set(b, p); p += b.length;
  }
  out[p++] = (huffEntriesLen >> 8) & 0xFF;
  out[p++] = huffEntriesLen & 0xFF;
  for (const h of huffEntries) {
    out[p++] = h.sym & 0xFF;
    out[p++] = h.len & 0xFF;
  }
  out.set(u32(dataBitLen), p); p += 4;
  out.set(dataBytes, p); p += dataBytes.length;
  return out;
}

function parseFrameRaw(frameBytes) {
  let p = 0;
  if (frameBytes.length < 6) throw new Error("Frame too small");
  const dictCount = (frameBytes[p++]<<8) | frameBytes[p++];
  const dict = [];
  for (let i = 0; i < dictCount; i++) {
    const ln = (frameBytes[p++]<<8) | frameBytes[p++];
    const slice = frameBytes.slice(p, p + ln);
    dict.push(dec.decode(slice));
    p += ln;
  }
  const huffCount = (frameBytes[p++]<<8) | frameBytes[p++];
  const huffEntries = [];
  for (let i = 0; i < huffCount; i++) {
    const sym = frameBytes[p++];
    const len = frameBytes[p++];
    huffEntries.push({ sym, len });
  }
  const dataBitLen = (frameBytes[p++]<<24) | (frameBytes[p++]<<16) | (frameBytes[p++]<<8) | frameBytes[p++];
  const data = frameBytes.slice(p);
  return { dict, huffEntries, dataBitLen, data };
}

/* --- bitpack keyed chars --- */
function encodeBytesToChars(bytes, keyedChars) {
  const bitsPerChar = Math.floor(Math.log2(keyedChars.length));
  if (bitsPerChar <= 0) throw new Error("charset too small");
  let buf = 0n;
  let bits = 0n;
  let out = "";
  const mask = (1 << bitsPerChar) - 1;
  for (let i = 0; i < bytes.length; i++) {
    buf = (buf << 8n) | BigInt(bytes[i]);
    bits += 8n;
    while (bits >= BigInt(bitsPerChar)) {
      bits -= BigInt(bitsPerChar);
      const idx = Number((buf >> bits) & BigInt(mask));
      out += keyedChars[idx];
    }
  }
  if (bits > 0n) {
    const idx = Number((buf << (BigInt(bitsPerChar) - bits)) & BigInt(mask));
    out += keyedChars[idx];
  }
  return out;
}

function decodeCharsToBytes(str, keyedChars) {
  const map = Object.fromEntries(keyedChars.map((c, i) => [c, i]));
  const bitsPerChar = Math.floor(Math.log2(keyedChars.length));
  let buf = 0n;
  let bits = 0n;
  const out = [];
  const mask = (1 << bitsPerChar) - 1;
  for (let i = 0; i < str.length;) {
    const code = str.codePointAt(i);
    const ch = String.fromCodePoint(code);
    i += ch.length;
    const idx = map[ch];
    if (idx === undefined) throw new Error("Invalid encoded character during decode");
    buf = (buf << BigInt(bitsPerChar)) | BigInt(idx);
    bits += BigInt(bitsPerChar);
    while (bits >= 8n) {
      bits -= 8n;
      const byte = Number((buf >> bits) & 0xFFn);
      out.push(byte);
    }
  }
  return new Uint8Array(out);
}

/* --- XOR helper --- */
function xorBytesWithKey(u8, keyStr) {
  if (!keyStr) return u8;
  const k = enc.encode(keyStr);
  if (k.length === 0) return u8;
  const out = new Uint8Array(u8.length);
  for (let i = 0; i < u8.length; i++) out[i] = u8[i] ^ k[i % k.length];
  return out;
}

/* --- HIGH LEVEL: encode / decode --- */
const MODE_SIMPLE = 0;
const MODE_ADVANCED = 1;
const MODE_RAW = 2;
const MODE_OLD = 3;

function buildTokenHuffmanLengths(counts) {
  const nodes = [];
  for (const [idx, weight] of counts.entries()) {
    if (weight > 0) nodes.push({ sym: idx, w: weight });
  }
  if (nodes.length === 0) return {};
  if (nodes.length === 1) {
    return { lengths: { [nodes[0].sym]: 1 } };
  }

  const pq = nodes.slice();
  pq.sort((a, b) => a.w - b.w);
  while (pq.length > 1) {
    const a = pq.shift();
    const b = pq.shift();
    const parent = { w: a.w + b.w, left: a, right: b };
    let inserted = false;
    for (let i = 0; i < pq.length; i++) {
      if (parent.w <= pq[i].w) { pq.splice(i, 0, parent); inserted = true; break; }
    }
    if (!inserted) pq.push(parent);
  }

  const root = pq[0];
  const lengths = {};
  function walk(n, depth) {
    if (!n) return;
    if (n.sym !== undefined) {
      lengths[n.sym] = depth;
      return;
    }
    walk(n.left, depth + 1);
    walk(n.right, depth + 1);
  }
  walk(root, 0);
  return { lengths };
}

function legacyTokenize(text) {
  const items = [];
  const counts = new Map();
  const chars = Array.from(text);
  for (let i = 0; i < chars.length; i++) {
    let matched = false;
    const maxLen = Math.min(maxHuffmanTokenLen, chars.length - i);
    for (let len = maxLen; len >= 1; len--) {
      const token = chars.slice(i, i + len).join("");
      const index = huffmanTokenMap.get(token);
      if (index !== undefined) {
        items.push({ t: index });
        counts.set(index, (counts.get(index) || 0) + 1);
        i += len - 1;
        matched = true;
        break;
      }
    }
    if (!matched) {
      items.push({ c: chars[i] });
    }
  }
  return { items, counts };
}

function makeLegacyPreframe(entries, dataBytes) {
  const totalLen = 2 + entries.length * 3 + dataBytes.length;
  const out = new Uint8Array(totalLen);
  let p = 0;
  out[p++] = (entries.length >> 8) & 0xFF;
  out[p++] = entries.length & 0xFF;
  for (const e of entries) {
    out[p++] = (e.idx >> 8) & 0xFF;
    out[p++] = e.idx & 0xFF;
    out[p++] = e.len & 0xFF;
  }
  out.set(dataBytes, p);
  return out;
}

function parseLegacyPreframe(bytes) {
  if (bytes.length < 2) throw new Error("Legacy frame too small");
  let p = 0;
  const count = (bytes[p++] << 8) | bytes[p++];
  const entries = [];
  for (let i = 0; i < count; i++) {
    if (p + 3 > bytes.length) throw new Error("Legacy map truncated");
    const idx = (bytes[p++] << 8) | bytes[p++];
    const len = bytes[p++];
    entries.push({ idx, len });
  }
  const dataBytes = bytes.slice(p);
  return { entries, dataBytes };
}

function legacyEncodePayloadBytes(text) {
  const { items, counts } = legacyTokenize(text);
  const { lengths } = buildTokenHuffmanLengths(counts);
  const lengthMap = lengths || {};
  const canonical = buildCanonicalCodes(lengthMap);
  const codes = canonical.codes || {};

  const entries = Object.keys(lengthMap).map(k => ({ idx: Number(k), len: lengthMap[k] }));

  let buf = "";
  for (const item of items) {
    if (item.t !== undefined) {
      const code = codes[item.t];
      if (!code) {
        // should not happen, but fall back to literal
        const ch = huffmanTokens[item.t];
        buf = appendBits(buf, "0");
        if (ch.codePointAt(0) < 256) {
          buf = appendBits(buf, "0");
          buf = appendBits(buf, helper.numToBits(ch.charCodeAt(0), 8));
        } else {
          buf = appendBits(buf, "1");
          buf = appendBits(buf, helper.numToBits(ch.codePointAt(0), 21));
        }
        continue;
      }
      buf = appendBits(buf, "1");
      buf = appendBits(buf, helper.numToBits(code.code, code.len));
      continue;
    }
    const char = item.c;
    buf = appendBits(buf, "0");
    if (char.codePointAt(0) < 256) {
      buf = appendBits(buf, "0");
      buf = appendBits(buf, helper.numToBits(char.charCodeAt(0), 8));
    } else {
      buf = appendBits(buf, "1");
      buf = appendBits(buf, helper.numToBits(char.codePointAt(0), 21));
    }
  }

  const dataBytes = bitsToByteArray(buf);
  return makeLegacyPreframe(entries, dataBytes);
}

function legacyDecodePayloadBytes(preframeBytes) {
  const { entries, dataBytes } = parseLegacyPreframe(preframeBytes);
  const lengthsMap = {};
  for (const e of entries) lengthsMap[e.idx] = e.len;
  const canonical = buildCanonicalCodes(lengthsMap);
  const byLen = canonical.byLen || {};
  const bits = byteArrayToBits(dataBytes);
  let result = "";
  for (let i = 0; i < bits.length; i++) {
    const isHuffman = bitToBool(bits[i]);
    if (!isHuffman) {
      i++;
      const charLen = bitToBool(bits[i]) ? 21 : 8;
      i++;
      result += String.fromCodePoint(helper.bitsToNum(bits.slice(i, i + charLen)));
      i += charLen - 1;
    } else {
      let acc = 0;
      let accLen = 0;
      let matched = false;
      while (i + 1 < bits.length) {
        i++;
        acc = (acc << 1) | (bits[i] === "1" ? 1 : 0);
        accLen++;
        const mp = byLen[accLen];
        if (mp && mp.has(acc)) {
          const tokenIdx = mp.get(acc);
          result += huffmanTokens[tokenIdx];
          matched = true;
          break;
        }
      }
      if (!matched) throw new Error("Truncated Huffman code in stream");
    }
  }
  return result;
}

async function compressAndEncode(text, key) {
  const utf8 = enc.encode(text);

  // Mode 2: raw UTF-8 (no length header) for very short inputs
  let rawFrame = null;
  if (utf8.length <= 512) {
    rawFrame = new Uint8Array(1 + utf8.length);
    rawFrame[0] = MODE_RAW;
    rawFrame.set(utf8, 1);
  }

  // Mode 0: plain deflate of UTF-8 (low overhead for short inputs)
  const simpleCompressed = pako.deflate(utf8);
  const simpleFrame = new Uint8Array(1 + 4 + simpleCompressed.length);
  simpleFrame[0] = MODE_SIMPLE;
  simpleFrame.set(u32(simpleCompressed.length), 1);
  simpleFrame.set(simpleCompressed, 5);

  // Mode 1: dynamic dict + huffman + deflate (better for larger/repetitive text)
  const dynamic = buildDynamicDict(text);
  const dict = dynamic.slice(0, MAX_DICT_ENTRIES).concat(STATIC_DICT.filter(s => !dynamic.includes(s))).slice(0, 254);

  const tokenBytes = tokenizeWithDict(text, dict);

  const { lengths } = buildHuffmanLengths(tokenBytes);
  const lengthMap = lengths || {};
  const canonical = buildCanonicalCodes(lengthMap);
  const codes = canonical.codes || {};

  const huffEntries = Object.keys(lengthMap).map(k => ({ sym: Number(k), len: lengthMap[k] }));

  const { bytes: huffBytes, bitLen } = huffmanEncodeWithBitlen(tokenBytes, codes);

  const preframe = makeFrameRaw(dict, huffEntries, bitLen, huffBytes);

  const advancedCompressed = pako.deflate(preframe);
  const advancedFrame = new Uint8Array(1 + 4 + advancedCompressed.length);
  advancedFrame[0] = MODE_ADVANCED;
  advancedFrame.set(u32(advancedCompressed.length), 1);
  advancedFrame.set(advancedCompressed, 5);

  // Mode 3: legacy token stream with minimal Huffman map
  const legacyPreframe = legacyEncodePayloadBytes(text);
  const legacyCompressed = pako.deflate(legacyPreframe);
  const legacyFrame = new Uint8Array(1 + 4 + legacyCompressed.length);
  legacyFrame[0] = MODE_OLD;
  legacyFrame.set(u32(legacyCompressed.length), 1);
  legacyFrame.set(legacyCompressed, 5);

  let frame = (advancedFrame.length <= simpleFrame.length) ? advancedFrame : simpleFrame;
  if (rawFrame && rawFrame.length <= frame.length) frame = rawFrame;
  if (legacyFrame.length <= frame.length) frame = legacyFrame;
  const xored = xorBytesWithKey(frame, key);

  const keyed = await getKeyedChars(key || "");
  return encodeBytesToChars(xored, keyed);
}

async function decodeAndDecompress(str, key) {
  const keyed = await getKeyedChars(key || "");
  const bytes = decodeCharsToBytes(str, keyed);
  const descr = xorBytesWithKey(bytes, key);

  let mode = descr[0];
  let headerOffset = 1;
  // Legacy support: no mode byte, length starts at 0
  if (mode !== MODE_SIMPLE && mode !== MODE_ADVANCED && mode !== MODE_RAW && mode !== MODE_OLD) {
    mode = MODE_ADVANCED;
    headerOffset = 0;
  }

  if (mode === MODE_RAW) {
    if (descr.length < 1) throw new Error("Raw frame too small");
    const raw = descr.slice(1);
    return dec.decode(raw);
  }

  if (descr.length < headerOffset + 4) throw new Error("Frame too small");
  const clen = (descr[headerOffset]<<24)|(descr[headerOffset+1]<<16)|(descr[headerOffset+2]<<8)|descr[headerOffset+3];
  if (descr.length < headerOffset + 4 + clen) throw new Error("Frame truncated or invalid compressed length");
  const compressed = descr.slice(headerOffset + 4, headerOffset + 4 + clen);

  if (mode === MODE_OLD) {
    const preframe = pako.inflate(compressed);
    return legacyDecodePayloadBytes(preframe);
  }

  if (mode === MODE_SIMPLE) {
    const raw = pako.inflate(compressed);
    return dec.decode(raw);
  }

  const preframe = pako.inflate(compressed);
  const { dict, huffEntries, dataBitLen, data } = parseFrameRaw(preframe);

  const lengthsMap = {};
  for (const he of huffEntries) lengthsMap[he.sym] = he.len;
  const canonical = buildCanonicalCodes(lengthsMap);
  const byLen = canonical.byLen || {};

  const tokenBytes = huffmanDecodeFromBits(data, dataBitLen, byLen);
  return detokenizeFromBytesWithDict(tokenBytes, dict);
}

async function encode(text, key) {
  return compressAndEncode(String(text ?? ""), key || "");
}

async function decode(str, key) {
  if (!str) return "";
  return decodeAndDecompress(String(str ?? ""), key || "");
}

window.encrypt = encode;
window.decrypt = decode;
