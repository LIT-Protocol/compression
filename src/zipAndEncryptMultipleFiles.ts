import process from 'node:process';
import { readFileSync } from 'fs';

import {
  accessControlConditions,
  chain,
  getSessionSigs,
  hashFile,
  litNodeClient,
} from './utils';
import { zipAndEncryptFiles, decryptZippedFiles } from './lib/zipper';

const packageJsonFilename = 'package.json';
const packageLockJsonFilename = 'package-lock.json';
const tsconfigJsonFilename = 'tsconfig.json';
const files = {
  [packageJsonFilename]: new File([readFileSync(packageJsonFilename)], packageJsonFilename),
  [packageLockJsonFilename]: new File([readFileSync(packageLockJsonFilename)], packageLockJsonFilename),
  [tsconfigJsonFilename]: new File([readFileSync(tsconfigJsonFilename)], tsconfigJsonFilename),
}

async function main() {
  await litNodeClient.connect();
  const sessionSigs = await getSessionSigs(litNodeClient);

  const encryptRes = await zipAndEncryptFiles(
    Object.values(files),
    {
      accessControlConditions,
      chain,
      sessionSigs,
    },
    litNodeClient
  );

  console.log('encryptRes', encryptRes);

  // -- assertions
  if (!encryptRes.ciphertext) {
    throw new Error(`Expected "ciphertext" in encryptRes`);
  }

  if (!encryptRes.dataToEncryptHash) {
    throw new Error(`Expected "dataToEncryptHash" to in encryptRes`);
  }

  const decryptedRes = await decryptZippedFiles(
    {
      accessControlConditions,
      ciphertext: encryptRes.ciphertext,
      chain,
      dataToEncryptHash: encryptRes.dataToEncryptHash,
      sessionSigs,
    },
    litNodeClient
  );

  for (const file of Object.values(files)) {
    const decryptedFile = decryptedRes[file.name];
    if (!decryptedFile) {
      throw new Error(`Expected decryptedRes.${file.name} to be defined`);
    }

    const fileBuffer = await file.arrayBuffer();
    const decryptedFileBuffer = await decryptedFile.arrayBuffer();
    if (fileBuffer.byteLength !== decryptedFileBuffer.byteLength) {
      throw new Error(
        `Expected fileBuffer.byteLength to be ${fileBuffer.byteLength}, but got ${decryptedFileBuffer.byteLength}`
      );
    }

    const originalHash = await hashFile(fileBuffer);
    const decryptedHash = await hashFile(decryptedFileBuffer);
    if (originalHash !== decryptedHash) {
      throw new Error(`File hashes do not match! Original: ${originalHash}, Decrypted: ${decryptedHash}`);
    }

    console.log('file validated:', file.name);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => litNodeClient.disconnect());
