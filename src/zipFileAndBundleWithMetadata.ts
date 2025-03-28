import process from 'node:process';
import { readFileSync } from 'fs';

import {
  accessControlConditions,
  chain,
  getSessionSigs,
  hashFile,
  litNodeClient,
} from './utils';
import { encryptFileAndZipWithMetadata, decryptZipFileWithMetadata } from './lib/zipper';

const file = new File([readFileSync('./src/zipFileAndBundleWithMetadata.ts')], 'zipFileAndBundleWithMetadata.ts');

async function main() {
  await litNodeClient.connect();
  const sessionSigs = await getSessionSigs(litNodeClient);

  const encryptRes = await encryptFileAndZipWithMetadata(
    {
      accessControlConditions,
      chain,
      file,
      sessionSigs,
    },
    litNodeClient
  );

  const decryptedRes = await decryptZipFileWithMetadata(
    {
      file: encryptRes,
      sessionSigs,
    },
    litNodeClient
  );

  if (decryptedRes?.metadata.chain !== chain) {
    throw new Error(
      `Expected decryptedRes.metadata.chain to be ${chain}, but got ${decryptedRes?.metadata.chain}`
    );
  }

  if (file.name !== decryptedRes?.metadata.name) {
    throw new Error(
      `Expected decryptedRes.metadata.name to be ${file.name}, but got ${decryptedRes.metadata.name}`
    );
  }

  const fileText = await file.arrayBuffer();
  const decryptedFileText = decryptedRes.decryptedFile.buffer;
  if (fileText.byteLength !== decryptedFileText.byteLength) {
    throw new Error(
      `Expected decryptedFileText.byteLength to be ${fileText.byteLength}, but got ${decryptedFileText.byteLength}`
    );
  }

  const originalHash = await hashFile(fileText);
  const decryptedHash = await hashFile(decryptedFileText);
  if (originalHash !== decryptedHash) {
    throw new Error(`File hashes do not match! Original: ${originalHash}, Decrypted: ${decryptedHash}`);
  }

  console.log('file validated:', file.name);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => litNodeClient.disconnect());
