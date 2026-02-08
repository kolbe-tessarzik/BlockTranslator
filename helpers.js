/**
 * @param {string} bits - binary string ("0"/"1")
 * @param {string[]} alphabet - unique Unicode characters
 * @returns {string}
 */
function encodeBinaryString(bits, alphabet) {
    if (bits == "") return "";
    if (!/^[01]*$/.test(bits)) {
        throw new Error("Input must be a binary string");
    }

    const base = BigInt(alphabet.length);

    // Prefix sentinel bit
    let value = 1n;
    for (const b of bits) {
        value = (value << 1n) | BigInt(b);
    }

    // Base convert
    let out = "";
    if (value === 0n) {
        return alphabet[0];
    }

    while (value > 0n) {
        const r = value % base;
        out = alphabet[Number(r)] + out;
        value /= base;
    }

    return out;
}

/**
 * @param {string} str
 * @param {string[]} alphabet
 * @returns {string} binary string
 */
function decodeBinaryString(str, alphabet) {
  if (str == "") return "";
    const base = BigInt(alphabet.length);
    const index = new Map(alphabet.map((c, i) => [c, BigInt(i)]));

    // Decode Unicode to BigInt
    let value = 0n;
    for (const ch of str) {
        const v = index.get(ch);
        if (v === undefined) {
            throw new Error("Invalid character");
        }
        value = value * base + v;
    }

    // Convert to bits
    let bits = value.toString(2);

    // Remove sentinel "1"
    if (bits[0] !== "1") {
        throw new Error("Invalid encoding");
    }

    return bits.slice(1);
}
