import { Keypair, Connection, PublicKey, LAMPORTS_PER_SOL, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { WalletInfo } from '../types';
import { Logger } from '../utils/logger';
import bs58 from 'bs58';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Wallet storage file path
 */
const WALLETS_FILE_PATH = join(process.cwd(), 'wallets.json');

/**
 * Save wallets to file
 */
export function saveWallets(wallets: WalletInfo[]): void {
  try {
    // Only save publicKey and privateKey (keypair can be reconstructed)
    const walletsData = wallets.map(w => ({
      publicKey: w.publicKey,
      privateKey: w.privateKey,
    }));
    
    writeFileSync(WALLETS_FILE_PATH, JSON.stringify(walletsData, null, 2), 'utf8');
    Logger.info(`Saved ${wallets.length} wallets to ${WALLETS_FILE_PATH}`);
  } catch (error) {
    Logger.error('Error saving wallets:', error);
    throw error;
  }
}

/**
 * Load wallets from file
 */
export function loadWallets(): WalletInfo[] | null {
  try {
    if (!existsSync(WALLETS_FILE_PATH)) {
      Logger.info(`No wallets file found at ${WALLETS_FILE_PATH}`);
      return null;
    }

    const fileContent = readFileSync(WALLETS_FILE_PATH, 'utf8');
    const walletsData = JSON.parse(fileContent) as Array<{ publicKey: string; privateKey: string }>;
    
    const wallets: WalletInfo[] = walletsData.map(w => {
      const keypair = Keypair.fromSecretKey(bs58.decode(w.privateKey));
      return {
        keypair,
        publicKey: w.publicKey,
        privateKey: w.privateKey,
      };
    });

    Logger.info(`Loaded ${wallets.length} wallets from ${WALLETS_FILE_PATH}`);
    return wallets;
  } catch (error) {
    Logger.error('Error loading wallets:', error);
    return null;
  }
}

/**
 * Create N wallets
 */
export async function createWallets(count: number, saveToFile: boolean = true): Promise<WalletInfo[]> {
  Logger.info(`Creating ${count} wallets...`);
  const wallets: WalletInfo[] = [];

  for (let i = 0; i < count; i++) {
    const keypair = Keypair.generate();
    wallets.push({
      keypair,
      publicKey: keypair.publicKey.toBase58(),
      privateKey: bs58.encode(keypair.secretKey),
    });
  }

  Logger.info(`Created ${wallets.length} wallets`);
  
  if (saveToFile) {
    saveWallets(wallets);
  }
  
  return wallets;
}

/**
 * Fund wallets from central funding source
 * Funds only the difference needed to reach fundingAmountSol
 */
export async function fundWallets(
  connection: Connection,
  fundingPrivateKey: string,
  wallets: WalletInfo[],
  fundingAmountSol: number
): Promise<void> {
  Logger.info(`Checking and funding ${wallets.length} wallets to ${fundingAmountSol} SOL each...`);
  
  const fundingKeypair = Keypair.fromSecretKey(bs58.decode(fundingPrivateKey));
  const fundingBalance = await connection.getBalance(fundingKeypair.publicKey);
  
  // Calculate total amount needed by checking each wallet's balance
  let totalNeededLamports = 0;
  const walletFundingNeeds: Array<{ wallet: WalletInfo; neededLamports: number }> = [];

  for (const wallet of wallets) {
    const currentBalanceLamports = await connection.getBalance(wallet.keypair.publicKey);
    const currentBalanceSol = currentBalanceLamports / LAMPORTS_PER_SOL;
    const targetBalanceLamports = fundingAmountSol * LAMPORTS_PER_SOL;
    
    if (currentBalanceSol < fundingAmountSol) {
      const neededLamports = targetBalanceLamports - currentBalanceLamports;
      walletFundingNeeds.push({ wallet, neededLamports });
      totalNeededLamports += neededLamports;
    } else {
      Logger.info(
        `Wallet ${wallet.publicKey.substring(0, 8)}... already has sufficient balance: ` +
        `${currentBalanceSol.toFixed(4)} SOL (target: ${fundingAmountSol} SOL)`
      );
    }
  }

  // Check if funding wallet has enough balance
  if (totalNeededLamports > 0) {
    const totalNeededSol = totalNeededLamports / LAMPORTS_PER_SOL;
    
    if (fundingBalance < totalNeededLamports) {
      throw new Error(
        `Insufficient balance. Required: ${totalNeededSol.toFixed(4)} SOL, ` +
        `Available: ${(fundingBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`
      );
    }

    Logger.info(
      `Funding ${walletFundingNeeds.length} wallets with total ${totalNeededSol.toFixed(4)} SOL ` +
      `(${wallets.length - walletFundingNeeds.length} wallets already have sufficient balance)`
    );

    // Fund each wallet with only the difference needed
    for (const { wallet, neededLamports } of walletFundingNeeds) {
      try {
        const currentBalanceSol = (await connection.getBalance(wallet.keypair.publicKey)) / LAMPORTS_PER_SOL;
        const neededSol = neededLamports / LAMPORTS_PER_SOL;
        
        // Create transfer transaction for the difference
        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: fundingKeypair.publicKey,
            toPubkey: wallet.keypair.publicKey,
            lamports: neededLamports,
          })
        );

        // Send and confirm transaction
        const signature = await sendAndConfirmTransaction(
          connection,
          transaction,
          [fundingKeypair],
          { commitment: 'confirmed' }
        );

        Logger.info(
          `Funded wallet ${wallet.publicKey.substring(0, 8)}... ` +
          `+${neededSol.toFixed(4)} SOL (${currentBalanceSol.toFixed(4)} → ${fundingAmountSol.toFixed(4)} SOL). ` +
          `Signature: ${signature}`
        );
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        Logger.error(`Error funding wallet ${wallet.publicKey.substring(0, 8)}...:`, error);
        throw error;
      }
    }

    Logger.info(`Successfully funded ${walletFundingNeeds.length} wallets`);
  } else {
    Logger.info(`All wallets already have sufficient balance (${fundingAmountSol} SOL)`);
  }
}

/**
 * Get wallet balance
 */
export async function getWalletBalance(connection: Connection, publicKey: PublicKey): Promise<number> {
  const balance = await connection.getBalance(publicKey);
  return balance / LAMPORTS_PER_SOL;
}

/**
 * Get funding wallet balance
 */
export async function getFundingBalance(
  connection: Connection,
  fundingPrivateKey: string
): Promise<number> {
  const fundingKeypair = Keypair.fromSecretKey(bs58.decode(fundingPrivateKey));
  return getWalletBalance(connection, fundingKeypair.publicKey);
}
