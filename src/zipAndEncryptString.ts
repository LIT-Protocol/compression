import process from 'node:process';

import {
  accessControlConditions,
  chain,
  getSessionSigs,
  litNodeClient,
} from './utils';
import { zipAndEncryptString, decryptZippedString } from './lib/zipper';

const message = 'Hello World!';

async function main() {
  await litNodeClient.connect();
  const sessionSigs = await getSessionSigs(litNodeClient);

  const encryptRes = await zipAndEncryptString(
    {
      dataToEncrypt: message,
      accessControlConditions,
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

  const decryptedMessage = await decryptZippedString(
    {
      accessControlConditions,
      ciphertext: encryptRes.ciphertext,
      chain,
      dataToEncryptHash: encryptRes.dataToEncryptHash,
      sessionSigs,
    },
    litNodeClient
  );

  if (message !== decryptedMessage) {
    throw new Error(
      `decryptedMessage should be ${message} but received ${decryptedMessage}`
    );
  }

  console.log('decryptedMessage validated:', decryptedMessage);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => litNodeClient.disconnect());
