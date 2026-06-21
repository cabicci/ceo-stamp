/**
 * Server-only encryption helper for sensitive data at rest.
 *
 * SECURITY:
 * - This file is .server.ts → bundler blocks it from client bundles.
 * - Uses AES-256-GCM with a 32-byte key from SESSION_ENCRYPTION_KEY.
 * - SESSION_ENCRYPTION_KEY is read inside functions (not module scope) to
 *   avoid leaking via static analysis and to defer reads to request time.
 * - We ONLY encrypt captured session artifacts (cookies / localStorage).
 *   We NEVER accept, log, or store the client's username or password.
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer {
  const raw = process.env.SESSION_ENCRYPTION_KEY;
  if (!raw) throw new Error("SESSION_ENCRYPTION_KEY is not set");
  // Accept either a 32-byte base64/hex key or any string — normalize to 32 bytes via SHA-256.
  // This keeps the key strength deterministic regardless of how the operator provided it.
  try {
    if (/^[A-Fa-f0-9]{64}$/.test(raw)) return Buffer.from(raw, "hex");
    const b64 = Buffer.from(raw, "base64");
    if (b64.length === 32) return b64;
  } catch {
    // fall through to hash
  }
  return createHash("sha256").update(raw, "utf8").digest();
}

/** Encrypt a UTF-8 plaintext. Returns base64(iv || tag || ciphertext). */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

/** Decrypt a value produced by `encrypt`. Throws on tampering. */
export function decrypt(payload: string): string {
  const key = getKey();
  const buf = Buffer.from(payload, "base64");
  if (buf.length < IV_LEN + TAG_LEN) throw new Error("Ciphertext too short");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}
