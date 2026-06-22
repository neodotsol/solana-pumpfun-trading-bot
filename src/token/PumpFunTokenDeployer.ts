import {
  Connection,
  Keypair,
  VersionedTransaction,
  TransactionMessage,
} from '@solana/web3.js';
import { openAsBlob } from "fs";
import path from 'path';

import { WalletInfo } from '../types';
import { Logger } from '../utils/logger';
import { CreateTokenMetadata } from '../pumpfun/types';
import { DESCRIPTION, mainKp, sdk, TELEGRAM, TOKEN_NAME, TOKEN_SYMBOL, TWITTER, WEBSITE, FILE } from '../config';

// Resolve file path to absolute path relative to project root
const resolveFilePath = (filePath: string): string => {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }
  // Resolve relative to project root (process.cwd() when running from project root)
  const projectRoot = process.cwd();
  return path.resolve(projectRoot, filePath);
};

// Create Token Transaction
const createTokenTx = async (newKp: Keypair) => {
  // Resolve FILE path to absolute path
  const resolvedFilePath = resolveFilePath(FILE);
  Logger.debug(`Loading file from: ${resolvedFilePath}`);

  console.log(resolvedFilePath)
  
  const tokenInfo: CreateTokenMetadata = {
    name: TOKEN_NAME,
    symbol: TOKEN_SYMBOL,
    description: DESCRIPTION,
    file: await openAsBlob(resolvedFilePath),
    twitter: TWITTER,
    telegram: TELEGRAM,
    website: WEBSITE,
  };

  console.log(tokenInfo)
  let tokenMetadata = await sdk.createTokenMetadata(tokenInfo);

  let createIx = await sdk.getCreateInstructions(
    mainKp.publicKey,
    tokenInfo.name,
    tokenInfo.symbol,
    // @ts-ignore
    tokenMetadata.metadataUri,
    newKp
  );

  return [
    createIx
  ]
}

/**
 * Deploy a token on PumpFun
 */
export async function deployToken(
  connection: Connection,
  deployerWallet: WalletInfo,
): Promise<{ mint: string }> {
  const newKp = Keypair.generate();
  Logger.info(`Deploying token on PumpFun from wallet ${deployerWallet.publicKey.substring(0, 8)}...`);
  // Logger.info(`Token name: ${name}, symbol: ${symbol}`);

  try {
    const transactions: VersionedTransaction[] = []
    const latestBlockhash = await connection.getLatestBlockhash()
    const tokenCreationIxs = await createTokenTx(newKp);
    const tokenCreationTx = new VersionedTransaction(
      new TransactionMessage({
        payerKey: mainKp.publicKey,
        recentBlockhash: latestBlockhash.blockhash,
        instructions: tokenCreationIxs
      }).compileToV0Message()
    )

    tokenCreationTx.sign([mainKp, newKp])
    transactions.push(tokenCreationTx);
    const sim = await connection.simulateTransaction(tokenCreationTx, { sigVerify: true })
    if (sim.value.err) {
      console.error(sim.value.err)
    } else {
      console.log(sim.value.logs)
      const sig = await connection.sendTransaction(tokenCreationTx)
      const confirm = await connection.confirmTransaction(sig, 'confirmed')
      if (confirm.value.err) {
        console.error(confirm.value.err)
      } else {
        console.log(`Token deployed on PumpFun: https://solscan.io/tx/${sig}`)
      }
    }

    return {
      mint: newKp.publicKey.toBase58(),
    };
  } catch (error) {
    Logger.error('Error deploying token on PumpFun:', error);
    throw error;
  }
}
