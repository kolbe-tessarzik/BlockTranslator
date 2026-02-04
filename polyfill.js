/* polyfill.js — small, focused shims for older Safari / Opera
   - Adds safe fallbacks only when features are missing.
   - Avoids changing behavior on modern browsers.
   - Designed to keep BlockTranslator functional (grapheme counting, TextEncoder,
     and crypto.subtle.digest for SHA-256) in older engines.
*/
(function () {
  'use strict';

  // ---------------------- Object.fromEntries ----------------------
  if (!Object.fromEntries) {
    Object.fromEntries = function fromEntries(iterable) {
      return Array.from(iterable).reduce((obj, pair) => {
        if (pair) obj[pair[0]] = pair[1];
        return obj;
      }, {});
    };
  }

  // ---------------------- String.codePointAt / fromCodePoint ----------------------
  if (!String.prototype.codePointAt) {
    // simple (spec-compliant enough) polyfill
    String.prototype.codePointAt = function (pos) {
      const size = this.length;
      if (pos < 0 || pos >= size) return undefined;
      const first = this.charCodeAt(pos);
      if (first >= 0xd800 && first <= 0xdbff && size > pos + 1) {
        const second = this.charCodeAt(pos + 1);
        return ((first - 0xd800) * 0x400) + (second - 0xdc00) + 0x10000;
      }
      return first;
    };
  }

  if (!String.fromCodePoint) {
    String.fromCodePoint = function () {
      const codeUnits = [];
      for (let index = 0; index < arguments.length; ++index) {
        const codePoint = Number(arguments[index]);
        if (!isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
          throw RangeError('Invalid code point: ' + codePoint);
        }
        if (codePoint <= 0xffff) {
          codeUnits.push(codePoint);
        } else {
          const cp = codePoint - 0x10000;
          codeUnits.push((cp >> 10) + 0xd800);
          codeUnits.push((cp & 0x3ff) + 0xdc00);
        }
      }
      return String.fromCharCode.apply(null, codeUnits);
    };
  }

  // ---------------------- TextEncoder / TextDecoder (UTF-8) ----------------------
  // Lightweight UTF-8 encoder/decoder using encodeURIComponent fallback. Works
  // in engines that don't provide the native classes.
  if (typeof TextEncoder === 'undefined') {
    window.TextEncoder = function TextEncoder() {};
    TextEncoder.prototype.encode = function encode(str) {
      // encodeURIComponent -> percent-escapes UTF-8 bytes; unescape converts
      // those escapes into a 1:1 UCS-2 string whose charCodes are the bytes.
      const latin1 = typeof unescape === 'function'
        ? unescape(encodeURIComponent(str))
        : (function (s) {
            // fallback if unescape isn't present (very old/odd engines)
            const esc = encodeURIComponent(s);
            const bytes = esc.replace(/%([0-9A-F]{2})/g, function (_, p) {
              return String.fromCharCode('0x' + p);
            });
            return bytes;
          }(str));
      const u8 = new Uint8Array(latin1.length);
      for (let i = 0; i < latin1.length; ++i) u8[i] = latin1.charCodeAt(i);
      return u8;
    };
  }

  if (typeof TextDecoder === 'undefined') {
    window.TextDecoder = function TextDecoder() {};
    TextDecoder.prototype.decode = function decode(input) {
      // accept ArrayBuffer or typed arrays
      const bytes = input instanceof ArrayBuffer ? new Uint8Array(input) : input;
      let str = '';
      for (let i = 0; i < bytes.length; ++i) str += String.fromCharCode(bytes[i]);
      try {
        // reverse of the encode trick
        return decodeURIComponent(escape(str));
      } catch (err) {
        // if escape/decodeURIComponent are missing or fail, fall back to simple map
        return Array.from(str).map(function (c) { return String.fromCharCode(c.charCodeAt(0)); }).join('');
      }
    };
  }

  // ---------------------- Intl.Segmenter (minimal) ----------------------
  // Provide a light-weight grapheme-cluster segmenter so code using
  // `new Intl.Segmenter().segment(str)` can iterate over graphemes.
  // This intentionally implements only what's consumed by the app
  // (iteration over segments) and aims for correctness for combining
  // marks and basic emoji sequences.
  if (typeof Intl === 'object' && !Intl.Segmenter) {
    Intl.Segmenter = function Segmenter() {};
    Intl.Segmenter.prototype.segment = function segment(str) {
      // split into code-point aware units then merge combining marks onto
      // the preceding base character — good enough for most use-cases.
      function splitGraphemes(s) {
        const units = Array.from(s); // code points
        const out = [];
        const markRegex = /\p{M}/u;
        for (let i = 0; i < units.length; ++i) {
          const ch = units[i];
          if (markRegex.test(ch) && out.length) {
            out[out.length - 1] += ch;
          } else {
            out.push(ch);
          }
        }
        return out;
      }
      const segs = splitGraphemes(String(str || ''));
      return {
        [Symbol.iterator]: function* () {
          for (const s of segs) yield { segment: s };
        }
      };
    };
  }

  // ---------------------- crypto.subtle.digest (SHA-256 fallback) ----------------------
  // If the SubtleCrypto digest isn't available we provide a JS SHA-256 so
  // features that derive offsets from a SHA-256 (non-security-critical for
  // this app) continue to work in older browsers.
  (function () {
    const needsSubtle = !(
      window.crypto && window.crypto.subtle && typeof window.crypto.subtle.digest === 'function'
    );
    if (!needsSubtle) return;

    // Minimal SHA-256 implementation (small, dependency-free).
    // Produces a Uint8Array(32).
    function sha256Bytes(msgBytes) {
      // constants
      const K = new Uint32Array([
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967
      ]);

      function rotR(n, x) { return (x >>> n) | (x << (32 - n)); }
      function ch(x, y, z) { return (x & y) ^ (~x & z); }
      function maj(x, y, z) { return (x & y) ^ (x & z) ^ (y & z); }
      function sigma0(x) { return rotR(2, x) ^ rotR(13, x) ^ rotR(22, x); }
      function sigma1(x) { return rotR(6, x) ^ rotR(11, x) ^ rotR(25, x); }
      function gamma0(x) { return rotR(7, x) ^ rotR(18, x) ^ (x >>> 3); }
      function gamma1(x) { return rotR(17, x) ^ rotR(19, x) ^ (x >>> 10); }

      // pre-processing
      const ml = msgBytes.length * 8;
      const withOne = new Uint8Array(msgBytes.length + 1);
      withOne.set(msgBytes, 0);
      withOne[msgBytes.length] = 0x80;

      // length padding to 64-byte blocks: append zeros until length ≡ 56 mod 64
      let padLen = (64 - ((withOne.length + 8) % 64)) % 64;
      const padded = new Uint8Array(withOne.length + padLen + 8);
      padded.set(withOne);
      // append 64-bit big-endian length
      const view = new DataView(padded.buffer);
      // high 32 bits
      view.setUint32(padded.length - 8, Math.floor(ml / 0x100000000), false);
      // low 32 bits
      view.setUint32(padded.length - 4, ml >>> 0, false);

      // initial hash values
      let H0 = 0x6a09e667, H1 = 0xbb67ae85, H2 = 0x3c6ef372, H3 = 0xa54ff53a;
      let H4 = 0x510e527f, H5 = 0x9b05688c, H6 = 0x1f83d9ab, H7 = 0x5be0cd19;

      const W = new Uint32Array(64);
      for (let i = 0; i < padded.length; i += 64) {
        const chunk = new DataView(padded.buffer, i, 64);
        for (let t = 0; t < 16; ++t) W[t] = chunk.getUint32(t * 4, false);
        for (let t = 16; t < 64; ++t) W[t] = (gamma1(W[t - 2]) + W[t - 7] + gamma0(W[t - 15]) + W[t - 16]) >>> 0;

        let a = H0, b = H1, c = H2, d = H3, e = H4, f = H5, g = H6, h = H7;
        for (let t = 0; t < 64; ++t) {
          const T1 = (h + sigma1(e) + ch(e, f, g) + K[t] + W[t]) >>> 0;
          const T2 = (sigma0(a) + maj(a, b, c)) >>> 0;
          h = g; g = f; f = e; e = (d + T1) >>> 0;
          d = c; c = b; b = a; a = (T1 + T2) >>> 0;
        }

        H0 = (H0 + a) >>> 0; H1 = (H1 + b) >>> 0; H2 = (H2 + c) >>> 0; H3 = (H3 + d) >>> 0;
        H4 = (H4 + e) >>> 0; H5 = (H5 + f) >>> 0; H6 = (H6 + g) >>> 0; H7 = (H7 + h) >>> 0;
      }

      const hash = new Uint8Array(32);
      const hv = new DataView(hash.buffer);
      hv.setUint32(0, H0, false); hv.setUint32(4, H1, false); hv.setUint32(8, H2, false); hv.setUint32(12, H3, false);
      hv.setUint32(16, H4, false); hv.setUint32(20, H5, false); hv.setUint32(24, H6, false); hv.setUint32(28, H7, false);
      return hash;
    }

    // attach subtle.digest if missing
    window.crypto = window.crypto || {};
    window.crypto.subtle = window.crypto.subtle || {};
    if (!window.crypto.subtle.digest) {
      window.crypto.subtle.digest = function digest(algorithm, data) {
        return new Promise(function (resolve, reject) {
          try {
            const alg = (typeof algorithm === 'string') ? algorithm.toUpperCase() : (algorithm && algorithm.name && algorithm.name.toUpperCase());
            if (alg !== 'SHA-256') throw new Error('Only SHA-256 is supported by this fallback');
            const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : (data instanceof Uint8Array ? data : new Uint8Array(data));
            const h = sha256Bytes(bytes);
            resolve(h.buffer);
          } catch (err) { reject(err); }
        });
      };
    }
  }());

  // expose a small flag for tests / diagnostics (non-enumerable)
  try { Object.defineProperty(window, '__BT_POLYFILLS__', { value: true, configurable: true }); } catch (e) { /* silent */ }
})();
