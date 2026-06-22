import { Keypair } from '@solana/web3.js';
import { fundingWalletPrivateKey, connection, rpcUrl, numWallets, fundingAmountSol } from './config';
import { Logger } from './utils/logger';
import { createWallets, fundWallets, loadWallets, saveWallets } from './wallet/WalletManager';
import { deployToken } from './token/PumpFunTokenDeployer';
import { startTradingEngine } from './engine/TradingEngine';
import { WalletInfo } from './types';
import bs58 from 'bs58';

Logger.info(`Connected to Solana RPC: ${rpcUrl}`);

async function main() {
  try {
    Logger.info('=== Solana Trading Bot Starting ===');

    // Step 1: Create or load wallets
    let wallets: WalletInfo[] | null = loadWallets();

    if (!wallets || wallets.length === 0) {
      Logger.info(`Creating ${numWallets} wallets...`);
      wallets = await createWallets(numWallets, true);
      Logger.info(`Created ${wallets.length} wallets`);
    }

    // // Step 2: Fund wallets
    Logger.info(`Funding wallets with ${fundingAmountSol} SOL each...`);
    await fundWallets(connection, fundingWalletPrivateKey, wallets, fundingAmountSol);
    Logger.info('All wallets funded');

    // Step 3: Deploy token on PumpFun (if not provided)
    let tokenMint: string;
    // Use funding wallet to deploy token
    const fundingKeypair = Keypair.fromSecretKey(bs58.decode(fundingWalletPrivateKey));
    const fundingWallet: WalletInfo = {
      keypair: fundingKeypair,
      publicKey: fundingKeypair.publicKey.toBase58(),
      privateKey: fundingWalletPrivateKey,
    };

    // Logger.info(`Deploying new token on PumpFun using funding wallet ${fundingWallet.publicKey.substring(0, 8)}...`);
    // const tokenInfo = await deployToken(connection, fundingWallet);
    // tokenMint = tokenInfo.mint;
    // Logger.info(`Token deployed on PumpFun: ${tokenMint}`);

    // await startTradingEngine(connection, wallets, tokenMint);
  } catch (error) {
    Logger.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
