declare module "node:zlib" {
  export function deflateRawSync(data: Uint8Array): Uint8Array;
}
