export abstract class Compressor {
  abstract addFile(
    name: string,
    content: string | Uint8Array
  ): void;
  abstract getFile(path: string, type: 'string'): Promise<string | null>;
  abstract getFile(path: string, type: 'blob'): Promise<Blob | null>;
  abstract getFiles(type: 'blob'): Promise<{ [key: string]: Blob }>;
  abstract generateArrayBuffer(): Promise<Uint8Array>;
}
