import crypto from 'node:crypto';
import {
  createSiweMessageWithRecaps,
  generateAuthSig,
  LitActionResource,
} from '@lit-protocol/auth-helpers'
import { LIT_ABILITY } from '@lit-protocol/constants'
import { AccsDefaultParams, AuthCallbackParams } from '@lit-protocol/types'
import * as LitJsSdk from '@lit-protocol/lit-node-client'
import { Wallet } from 'ethers';

export const chain = 'ethereum' as const;
const wallet = Wallet.createRandom();

export const accessControlConditions: AccsDefaultParams[] = [
  {
    contractAddress: '',
    standardContractType: '',
    chain,
    method: '',
    parameters: [':userAddress'],
    returnValueTest: {
      comparator: '=',
      value: wallet.address,
    },
  },
];

export const litNodeClient = new LitJsSdk.LitNodeClient({
  litNetwork: 'datil-dev',
  debug: true,
});

export const getSessionSigs = async (litNodeClient: LitJsSdk.LitNodeClient) => {
  return await litNodeClient.getSessionSigs({
    chain,
    resourceAbilityRequests: [
      {
        resource: new LitActionResource('*'),
        ability: LIT_ABILITY.LitActionExecution,
      },
    ],
    authNeededCallback: async ({
                                 uri,
                                 expiration,
                                 resourceAbilityRequests,
                               }: AuthCallbackParams) => {
      if (!expiration) {
        throw new Error('expiration is required');
      }

      if (!resourceAbilityRequests) {
        throw new Error('resourceAbilityRequests is required');
      }

      if (!uri) {
        throw new Error('uri is required');
      }

      const toSign = await createSiweMessageWithRecaps({
        uri: uri,
        expiration: expiration,
        resources: resourceAbilityRequests,
        walletAddress: wallet.address,
        nonce: await litNodeClient.getLatestBlockhash(),
        litNodeClient,
      });

      const authSig = await generateAuthSig({
        signer: wallet,
        toSign,
      });

      return authSig;
    },
  });
}

export const hashFile = (buffer: ArrayBuffer): Promise<string> => {
  return new Promise((resolve) => {
    const hash = crypto.createHash('sha256');
    hash.update(Buffer.from(buffer));
    resolve(hash.digest('hex'));
  });
};
