let helper;

if (window.location.href.includes("http://localhost:")) {
  // dev; use local copy
  helper = await import('./helpers.js');
} else {
  // use cdn version
  helper = await import('https://cdn.jsdelivr.net/gh/kolbe-tessarzik/BlockTranslator@main/helpers.js?force=1');
}

const blockChars = (() => {
  const out = [];

  for (let cp = 0x21; cp <= 0x10FFFF; cp++) {
    // skip surrogates
    if (cp >= 0xD800 && cp <= 0xDFFF) continue;

    try {
      const ch = String.fromCodePoint(cp);

      // reject whitespace
      if (/\s/.test(ch)) continue;

      // reject control / format
      if (/[\p{Cc}\p{Cf}]/u.test(ch)) continue;

      // reject combining marks
      if (/\p{Mn}|\p{Me}/u.test(ch)) continue;

      out.push(ch);
    } catch (e) {
      // some codepoints may throw in older environments — ignore
    }
  }

  return out;
})();

const huffmanCodes = [
  "0000",
  "00010",
  "00011",
  "00100",
  "00101",
  "00110",
  "00111",
  "01000",
  "01001",
  "01010",
  "01011",
  "01100",
  "01101",
  "01110",
  "01111",
  "10000",
  "10001",
  "10010",
  "10011",
  "10100",
  "10101",
  "10110",
  "10111",
  "11000",
  "11001",
  "11010",
  "11011",
  "11100",
  "11101",
  "11110",
  "11111",
];

const huffmanTokens = [
  ' ', 'e', 't', '\n', 'a', 'o', 'i', 'n', 's', 'h', 'r', 'd', 'l', 'c', 'u', 'm', 'w',
  'f', 'g', 'y', 'p', '.\n', '?\n', '!\n', 'th', 'he', 'in', 'er', 'an', 're', 'on'
];

const huffmanTokenMap = new Map(huffmanTokens.map((token, i) => [token, i]));
const maxHuffmanTokenLen = huffmanTokens.reduce((max, token) => Math.max(max, token.length), 0);

function appendBits(buf, bits) {
  if (typeof bits !== "string" || !/^[01]+$/.test(bits)) {
    throw new Error(`Invalid bits '${bits}'`);
  }
  return buf + bits;
}

function encode(text, key) {
  console.log("Encoding . . .");
  let buf = "";
  const chars = Array.from(text);
  for (let i = 0; i < chars.length; i++) {
    let matched = false;
    const maxLen = Math.min(maxHuffmanTokenLen, chars.length - i);

    for (let len = maxLen; len >= 1; len--) {
      const token = chars.slice(i, i + len).join("");
      const index = huffmanTokenMap.get(token);
      if (index !== undefined) {
        // encode with huffman (token can be multi-char)
        buf = appendBits(buf, "1");
        const code = huffmanCodes[index];
        if (code === undefined) {
          throw new Error(`Missing Huffman code for token '${token}'`);
        }
        buf = appendBits(buf, code);
        i += len - 1;
        matched = true;
        break;
      }
    }

    if (matched) continue;

    const char = chars[i];
    // not in compression index, encode literally
    buf = appendBits(buf, "0"); // 0 for not huffman
    if (char.codePointAt(0) < 256) {
      // sign that char is packed in one byte
      buf = appendBits(buf, "0");
      const encoded = helper.numToBits(char.charCodeAt(0), 8);
      buf = appendBits(buf, encoded);
    } else {
      // sign that char is packed in 21 bits
      buf = appendBits(buf, "1");
      buf = appendBits(buf, helper.numToBits(char.codePointAt(0), 21));
    }
  }
  // now apply shift for encryption
  const shift = helper.sha256ToOffset(key, blockChars.length);
  const part1 = blockChars.slice(shift);
  const part2 = blockChars.slice(0, shift);
  // const shiftedChars = part1.concat(part2);
  const shiftedChars = blockChars;
  const ret = helper.encodeBinaryString(buf, shiftedChars);
  return ret;
}

function bitToBool(char) {
  if (char !== "0" && char !== "1") {
    throw new Error(`bitToBool required binary value; '${char}' is invalid`);
  } else {
    return (char == "1");
  }
}

async function decode(str, key) {
  // apply shift for decryption
  // const shift = await sha256ToOffset(key, blockChars.length);
  // const part1 = blockChars.slice(shift);
  // const part2 = blockChars.slice(0, shift);
  // const shiftedChars = part1.concat(part2);
  const shiftedChars = blockChars;
  const bits = helper.decodeBinaryString(str, shiftedChars);


  let result = "";


  for (var i = 0; i < bits.length; i++) {
    const isHuffman = bitToBool(bits[i]);
    if (!isHuffman) {
      i++;
      // literal encoding
      const charLen = bitToBool(bits[i]) ? 21 : 8;
      i++;
      // read charLen bits of code
      result += String.fromCodePoint(helper.bitsToNum(bits.slice(i, i+charLen)));
      i += charLen - 1;
    } else {
      // huffman encoding
      let readHuffmanBits = "";
      while (huffmanCodes.indexOf(readHuffmanBits) === -1) {
        i++;
        if (i >= bits.length) {
          throw new Error("Truncated Huffman code in stream");
        }
        readHuffmanBits += bits[i];
      }
      result += huffmanTokens[huffmanCodes.indexOf(readHuffmanBits)];
    }
  }
  return result;
}

window.encrypt = encode;
window.decrypt = decode;
