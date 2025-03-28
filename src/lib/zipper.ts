import {
  decryptToFile,
  decryptToUint8Array,
  encryptFile,
  encryptUint8Array,
} from '@lit-protocol/encryption';
import { isBrowser, log } from '@lit-protocol/misc';
import {
  DecryptRequest,
  DecryptRequestBase,
  EncryptResponse,
  EncryptStringRequest,
  ILitNodeClient,
  MultipleAccessControlConditions,
  SessionSigsMap,
  SessionSigsOrAuthSig,
} from '@lit-protocol/types';
import {
  uint8arrayFromString,
  uint8arrayToString,
} from '@lit-protocol/uint8arrays';
import JSZip from 'jszip';

import { Compressor } from './compressor';

export interface DecryptZipFileWithMetadata {
  decryptedFile: Uint8Array;
  metadata: MetadataForFile;
}

export interface MetadataForFile {
  name: string | any;
  type: string | any;
  size: string | number | any;
  accessControlConditions: any[] | any;
  evmContractConditions: any[] | any;
  solRpcConditions: any[] | any;
  unifiedAccessControlConditions: any[] | any;
  chain: string;
  dataToEncryptHash: string;
}

export interface EncryptFileAndZipWithMetadataProps
  extends MultipleAccessControlConditions {
  sessionSigs: SessionSigsMap;
  chain: string;
  file: File;
  readme?: string;
}

export type DecryptZipFileWithMetadataProps = SessionSigsOrAuthSig & {
  file: Blob | Uint8Array;
}

class JsZipper extends Compressor {
  private zip: JSZip;

  constructor(zip?: JSZip) {
    super();
    this.zip = zip ?? new JSZip();
  }

  async load(data: ArrayBuffer | Blob | Uint8Array) {
    await this.zip.loadAsync(data);
  }

  addFile(
    path: string,
    content: string | Uint8Array
  ): void {
    this.zip.file(path, content);
  }

  async getFile(path: string, type: 'string'): Promise<string | null>;
  async getFile(path: string, type: 'blob'): Promise<Blob | null>;
  async getFile(path: string, type: 'string' | 'blob') {
    const file = this.zip.file(path);
    if (!file) {
      return null;
    }
    return await file.async(type);
  }

  async getFiles(type: 'blob'): Promise<{ [key: string]: Blob }> {
    const files = this.zip.files;
    const result: { [key: string]: Blob } = {};
    for (const file of Object.values(files)) {
      result[file.name] = await file.async(type);
    }
    return result;
  }

  async generateArrayBuffer() {
    if (isBrowser()) {
      const zipBlob = await this.zip.generateAsync({ type: 'blob' });
      return new Uint8Array(await zipBlob.arrayBuffer());
    } else {
      return this.zip.generateAsync({ type: 'nodebuffer' });
    }
  }
}

/**
 * Zip and encrypt a string. This is used to encrypt any string that is to be locked via the Lit Protocol.
 *
 * @param { EncryptStringRequest } params - The params required to encrypt a string
 * @param { ILitNodeClient } litNodeClient - The Lit Node Client
 *
 * @returns { Promise<EncryptResponse> } - The encrypted string and the hash of the string
 */
export const zipAndEncryptString = async (
  params: EncryptStringRequest,
  litNodeClient: ILitNodeClient
): Promise<EncryptResponse> => {
  const zipper = new JsZipper();
  zipper.addFile('string.txt', params.dataToEncrypt);

  return encryptUint8Array(
    {
      ...params,
      dataToEncrypt: await zipper.generateArrayBuffer(),
    },
    litNodeClient
  );
};

/**
 * Decrypt and unzip a zip that was created using encryptZip, zipAndEncryptString, or zipAndEncryptFiles.
 *
 * @param { DecryptRequest } params - The params required to decrypt a string
 * @param { ILitNodeClient } litNodeClient - The Lit Node Client
 *
 * @returns { Promise<string> } - The decrypted string
 */
export const decryptZippedString = async (
  params: DecryptRequest,
  litNodeClient: ILitNodeClient
): Promise<string> => {
  const decryptedZip = await decryptToUint8Array(params, litNodeClient);

  const zipper = new JsZipper();
  await zipper.load(decryptedZip);

  const stringFile = await zipper.getFile('string.txt', 'string');

  if (!stringFile) {
    throw new Error('zip does not include string.txt');
  }

  return stringFile;
};

/**
 * Encrypt a single file and then zip it up with the metadata.
 *
 * @param { EncryptFileAndZipWithMetadataProps } params - The params required to encrypt a file and zip it up with the metadata
 * @param { ILitNodeClient } litNodeClient - The Lit Node Client
 *
 * @returns { Promise<any> } - The encrypted zip file and the hash of the zip file
 *
 */
export const encryptFileAndZipWithMetadata = async (
  params: EncryptFileAndZipWithMetadataProps,
  litNodeClient: ILitNodeClient
): Promise<Buffer | Uint8Array> => {
  const {
    accessControlConditions,
    evmContractConditions,
    solRpcConditions,
    unifiedAccessControlConditions,
    chain,
    file,
    readme,
  } = params;

  const { ciphertext, dataToEncryptHash } = await encryptFile(
    { ...params },
    litNodeClient
  );

  // Zip up with metadata
  const zipper = new JsZipper();
  const metadata: MetadataForFile = {
    name: file.name,
    type: file.type,
    size: file.size,
    accessControlConditions,
    evmContractConditions,
    solRpcConditions,
    unifiedAccessControlConditions,
    chain,
    dataToEncryptHash,
  };

  zipper.addFile('lit_protocol_metadata.json', JSON.stringify(metadata));
  if (readme) {
    zipper.addFile('readme.txt', readme);
  }

  zipper.addFile(
    `encryptedAssets/${file.name}`,
    uint8arrayFromString(ciphertext, 'base64')
  );

  return zipper.generateArrayBuffer();
};

/**
 * Given a zip file with metadata inside it, unzip, load the metadata, and return the decrypted file and the metadata. This zip file would have been created with the encryptFileAndZipWithMetadata function.
 *
 * @param { DecryptZipFileWithMetadataProps } params - The params required to decrypt a zip file with metadata
 * @param { ILitNodeClient } litNodeClient - The Lit Node Client
 *
 * @returns { Promise<DecryptZipFileWithMetadata> } A promise containing an object that contains decryptedFile and metadata properties. The decryptedFile is an ArrayBuffer that is ready to use, and metadata is an object that contains all the properties of the file like it's name and size and type.
 */
export const decryptZipFileWithMetadata = async (
  params: DecryptZipFileWithMetadataProps,
  litNodeClient: ILitNodeClient
): Promise<DecryptZipFileWithMetadata | undefined> => {
  const { file } = params;

  const zipper = new JsZipper();
  await zipper.load(file);

  const jsonFile = await zipper.getFile('lit_protocol_metadata.json', 'string');

  if (!jsonFile) {
    log(`Failed to read lit_protocol_metadata.json from zip file`);
    return;
  }

  const metadata: MetadataForFile = JSON.parse(jsonFile);

  log('zip metadata', metadata);

  const encryptedFile = await zipper.getFile(`encryptedAssets/${metadata.name}`, 'blob');

  if (!encryptedFile) {
    log("Failed to get 'metadata.name' from zip file");
    return;
  }

  const decryptedFile = await decryptToFile(
    {
      ...params,
      accessControlConditions: metadata.accessControlConditions,
      evmContractConditions: metadata.evmContractConditions,
      solRpcConditions: metadata.solRpcConditions,
      unifiedAccessControlConditions: metadata.unifiedAccessControlConditions,
      chain: metadata.chain,
      ciphertext: uint8arrayToString(
        new Uint8Array(await encryptedFile.arrayBuffer()),
        'base64'
      ),
      dataToEncryptHash: metadata.dataToEncryptHash,
    },
    litNodeClient
  );

  return { decryptedFile, metadata };
};

/**
 * Zip and encrypt multiple files.
 *
 * @param { Array<File> } files - The files to encrypt
 * @param { DecryptRequestBase } params - The params required to encrypt a file
 * @param { ILitNodeClient } litNodeClient - The Lit Node Client
 *
 * @returns { Promise<EncryptResponse> } - The encrypted file and the hash of the file

 */
export const zipAndEncryptFiles = async (
  files: File[],
  params: DecryptRequestBase,
  litNodeClient: ILitNodeClient
): Promise<EncryptResponse> => {
  const zipper = new JsZipper();

  for (const file of files) {
    const fileData = new Uint8Array(await file.arrayBuffer());
    zipper.addFile(`encryptedAssets/${file.name}`, fileData);
  }

  const dataToEncrypt = await zipper.generateArrayBuffer();

  return encryptUint8Array(
    {
      ...params,
      dataToEncrypt,
    },
    litNodeClient
  );
};

/**
 * Decrypt and unzip a zip that was created using zipAndEncryptFiles.
 *
 * @param { DecryptRequest } params - The params required to decrypt a string
 * @param { ILitNodeClient } litNodeClient - The Lit Node Client
 *
 * @returns { Promise<{ [key: string]: Blob }>} - The decrypted zip file
 */
export const decryptZippedFiles = async (
  params: DecryptRequest,
  litNodeClient: ILitNodeClient
): Promise<Record<string, Blob>> => {
  const decryptedData = await decryptToUint8Array(params, litNodeClient);

  const zipper = new JsZipper();
  await zipper.load(decryptedData);

  const files = await zipper.getFiles('blob');

  const result: Record<string, Blob> = {};
  for (const [key, file] of Object.entries(files)) {
    if (key === 'encryptedAssets/') {
      continue;
    }

    result[key.replace('encryptedAssets/', '')] = file;
  }

  return result;
};
