import { Connection, PublicKey } from '@solana/web3.js';
import { Logger } from '../utils/logger';

/**
 * Check if someone else has bought (by monitoring recent transactions)
 * This is a simplified check - in production you'd want to use a more robust method
 * like monitoring DEX events or using a transaction indexer
 */
export async function hasSomeoneBought(
  connection: Connection,
  tokenMint: string,
  ourWallets: string[]
): Promise<boolean> {
  try {
    // Get recent signatures for the token mint
    const signatures = await connection.getSignaturesForAddress(
      new PublicKey(tokenMint),
      { limit: 10 }
    );

    if (signatures.length === 0) {
      return false;
    }

    // Check the most recent transaction
    const latestSig = signatures[0];
    
    // Parse transaction to check if it's a buy from someone else
    const tx = await connection.getTransaction(latestSig.signature, {
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) {
      return false;
    }

    // Check if transaction is from one of our wallets
    // Use getAccountKeys() for versioned transactions
    const accountKeys = tx.transaction.message.getAccountKeys();
    const txSigner = accountKeys.staticAccountKeys[0]?.toBase58();
    
    if (txSigner && ourWallets.includes(txSigner)) {
      // It's our transaction, not someone else's
      return false;
    }

    // If it's a recent transaction (within last minute) and not from us, someone bought
    const txTime = latestSig.blockTime ? latestSig.blockTime * 1000 : 0;
    const now = Date.now();
    
    if (now - txTime < 60000) { // Within last minute
      return true;
    }

    return false;
  } catch (error) {
    Logger.error('Error checking if someone bought:', error);
    return false;
  }
}

/**
 * Check if someone else has sold (by monitoring recent sell transactions)
 */
export async function hasSomeoneSold(
  connection: Connection,
  tokenMint: string,
  ourWallets: string[]
): Promise<boolean> {
  try {
    // Get recent signatures for the token mint
    const signatures = await connection.getSignaturesForAddress(
      new PublicKey(tokenMint),
      { limit: 10 }
    );

    if (signatures.length === 0) {
      return false;
    }

    // Check the most recent transaction
    const latestSig = signatures[0];
    
    // Parse transaction to check if it's a sell from someone else
    const tx = await connection.getTransaction(latestSig.signature, {
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) {
      return false;
    }

    // Check if transaction is from one of our wallets
    const accountKeys = tx.transaction.message.getAccountKeys();
    const txSigner = accountKeys.staticAccountKeys[0]?.toBase58();
    
    if (txSigner && ourWallets.includes(txSigner)) {
      // It's our transaction, not someone else's
      return false;
    }

    // Check if it's a recent transaction (within last minute) and not from us
    const txTime = latestSig.blockTime ? latestSig.blockTime * 1000 : 0;
    const now = Date.now();
    
    // Check if transaction is a sell (simplified - in production, parse instruction discriminator)
    // For now, if it's a recent transaction from external wallet, assume it could be a sell
    if (now - txTime < 60000) { // Within last minute
      return true;
    }

    return false;
  } catch (error) {
    Logger.error('Error checking if someone sold:', error);
    return false;
  }
}
