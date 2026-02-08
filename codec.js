import {encodeBinaryString, decodeBinaryString, numToBits, bitsToNum, sha256ToOffset} from 'https://cdn.jsdelivr.net/gh/kolbe-tessarzik/BlockTranslator@main/helpers.js?force=1';

window.console.log = () => {};

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
  "0",
  "10",
  "110",
  "1110",
  "11110",
  "111110",
  "1111110",
  "11111110",
  "111111110",
  "1111111110",
  "1111111111",
];

const huffmanChars = [
  ' ',  // most frequent
  'e', 't', 'a', 'o', 'i', 'n', 's', 'h', 'r', '\n'
];

function encode(text, key) {
  console.log("Encoding . . .");
  let buf = "";
  for (const char of text) {
    console.log(`Hit char ${char}`);
    const index = huffmanChars.indexOf(char);
    if (index === -1) {
      // not in compression index, encode literally
      buf += "0"; // 0 for not huffman
      if (char.codePointAt(0) < 256) {
        // sign that char is packed in one byte
        buf += "0";
        const encoded = numToBits(char.charCodeAt(0), 8);
        console.log(`Encoding ${char} literally: ${encoded}`);
        buf += encoded;
      } else {
        // sign that char is packed in 21 bits
        buf += "1";
        buf += numToBits(char.codePointAt(0), 21);
      }
    } else {
      console.log(`Found ${char} at index ${index}, encoding with code ${huffmanCodes[index]}`);
      // encode with huffman
      buf += "1";
      buf += huffmanCodes[index];
      console.log(`Current buffer: ${buf}`);
    }
  }
  // now apply shift for encryption
  const shift = sha256ToOffset(key, blockChars.length);
  const part1 = blockChars.slice(shift);
  const part2 = blockChars.slice(0, shift);
  // const shiftedChars = part1.concat(part2);
  const shiftedChars = blockChars;
  const ret = encodeBinaryString(buf, shiftedChars);
  console.log("Complete!:", buf);
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
  console.log("Hello world");
  // apply shift for decryption
  // const shift = await sha256ToOffset(key, blockChars.length);
  // const part1 = blockChars.slice(shift);
  // const part2 = blockChars.slice(0, shift);
  // const shiftedChars = part1.concat(part2);
  const shiftedChars = blockChars;
  const bits = decodeBinaryString(str, shiftedChars);
  console.log("Starting buffer:", bits);

  console.log(bits);

  let result = "";

  console.log(bits.length);

  for (var i = 0; i < bits.length; i++) {
    console.log("Running loop");
    const isHuffman = bitToBool(bits[i]);
    console.log(`isHuffman: ${isHuffman}`);
    if (!isHuffman) {
      i++;
      // literal encoding
      const charLen = bitToBool(bits[i]) ? 21 : 8;
      i++;
      // read charLen bits of code
      result += String.fromCharCode(bitsToNum(bits.slice(i, i+charLen)));
      i += charLen - 1;
    } else {
      // huffman encoding
      let readHuffmanBits = "";
      while (huffmanCodes.indexOf(readHuffmanBits) === -1) {
        i++;
        readHuffmanBits += bits[i];
      }
      result += huffmanChars[huffmanCodes.indexOf(readHuffmanBits)];
    }
  }
  console.log(result);
  return result;
}

window.encrypt = encode;
window.decrypt = decode;
