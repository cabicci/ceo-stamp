/**
 * Shared resvg wasm loader + Cairo font for server-side SVG rendering.
 * Used by poc-arabic-image and burn-text-on-image.
 */

import { initWasm } from "@resvg/resvg-wasm";
import RESVG_WASM_URL from "@resvg/resvg-wasm/index_bg.wasm?url";
import { CAIRO_REGULAR_BASE64 } from "./poc-cairo-font.base64";

let wasmInit: Promise<void> | null = null;
let cairoBytes: Uint8Array | null = null;

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function getCairoFontBase64(): string {
  return CAIRO_REGULAR_BASE64;
}

export function getCairoFontBytes(): Uint8Array {
  if (!cairoBytes) cairoBytes = base64ToBytes(CAIRO_REGULAR_BASE64);
  return cairoBytes;
}

export function cairoResvgFontOptions() {
  return {
    fontBuffers: [getCairoFontBytes()],
    defaultFontFamily: "Cairo",
    sansSerifFamily: "Cairo",
  };
}

async function loadResvgWasm(): Promise<WebAssembly.Module | ArrayBuffer | Uint8Array> {
  const attempts: string[] = [];

  try {
    const wasmSpecifier = "@resvg/resvg-wasm/index_bg.wasm";
    const mod: unknown = await import(/* @vite-ignore */ wasmSpecifier);
    const value = (mod as { default?: unknown })?.default ?? mod;
    if (value instanceof WebAssembly.Module) return value;
    if (value instanceof ArrayBuffer) return value;
    if (value instanceof Uint8Array) return value;
    attempts.push(`direct-import: unexpected type ${Object.prototype.toString.call(value)}`);
  } catch (err) {
    attempts.push(`direct-import: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    const { readFile } = await import("node:fs/promises");
    let filePath: string | null = null;
    try {
      const metaResolve = (import.meta as unknown as { resolve?: (s: string) => string | Promise<string> })
        .resolve;
      const resolved: string | undefined = metaResolve
        ? await metaResolve("@resvg/resvg-wasm/index_bg.wasm")
        : undefined;
      if (resolved?.startsWith("file://")) {
        filePath = new URL(resolved).pathname;
      }
    } catch {
      // ignore
    }
    if (!filePath) filePath = "/dev-server/node_modules/@resvg/resvg-wasm/index_bg.wasm";
    const buf = await readFile(filePath);
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  } catch (err) {
    attempts.push(`node-fs: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    const resolved = new URL(RESVG_WASM_URL, import.meta.url);
    const res = await fetch(resolved);
    if (!res.ok) {
      attempts.push(`fetch-url ${resolved.toString()}: ${res.status}`);
    } else {
      return await res.arrayBuffer();
    }
  } catch (err) {
    attempts.push(`fetch-url: ${err instanceof Error ? err.message : String(err)}`);
  }

  throw new Error(`Could not load resvg wasm. Attempts: ${attempts.join(" | ")}`);
}

export async function ensureResvgWasm(): Promise<void> {
  if (!wasmInit) {
    wasmInit = (async () => {
      const asset = await loadResvgWasm();
      try {
        await initWasm(asset as WebAssembly.Module);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.toLowerCase().includes("already initialized")) {
          throw err;
        }
      }
    })();
  }
  await wasmInit;
}
