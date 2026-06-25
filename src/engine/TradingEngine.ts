import { Connection, PublicKey, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { WalletInfo, TradingState } from '../types';
import { buyAmountSol, slippageBps, sdk, waitTimeoutMs, kellyBankrollSol, kellyProbability, kellyAllInPrice, kellyMaxStakeSol, kellyMinStakeSol, kellyFraction } from '../config';
import { Logger } from '../utils/logger';
import { calculateKellyBuyAmountSol, formatKellyStakeForLogs } from '../utils/kellyStake';
import { hasSomeoneBought, hasSomeoneSold } from '../monitor/MarketMonitor';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { calculateWithSlippageBuy } from '../pumpfun/util';
import Big from 'ts-arithmetic-helper';

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Reset trading state to start buying again
 */
function resetTradingState(
  state: TradingState,
): { state: TradingState; buyQueue: number[] } {
  Logger.info('Resetting trading state...');
  
  const newState: TradingState = {
    ...state,
    isWaiting: false,
    isBuying: false,
    lastBuyerWalletIndex: null,
    lastBuyerTimestamp: null,
  };
  
  // Reset buy queue with wallets that have sold or never acted
  const newBuyQueue = state.wallets
    .map((_, index) => index)
    .filter(index => {
      const action = state.walletActions.get(index);
      return action === 'sell' || action === undefined;
    });
  
  return { state: newState, buyQueue: newBuyQueue };
}

/**
 * Execute buy using PumpFunSDK
 */
async function executeBuyWithSDK(
  connection: Connection,
  wallet: WalletInfo,
  tokenMint: string,
  buyAmountSol: number,
  slippageBps: number
): Promise<string> {
  const mint = new PublicKey(tokenMint);
  const buyer = wallet.keypair.publicKey;
  const buyAmountSolBig = Big(buyAmountSol).mul('1000000000');
  const buyAmountSolBigInt = BigInt(buyAmountSolBig.toString());
  const slippageBpsBigInt = BigInt(slippageBps);

  Logger.info(`[PUMPFUN BUY] Starting buy operation`, {
    wallet: buyer.toBase58().substring(0, 8) + '...',
    tokenMint: tokenMint.substring(0, 8) + '...',
    buyAmountSol,
    slippageBps,
    buyAmountLamports: buyAmountSolBigInt.toString()
  });

  // Get bonding curve account for the actual mint to calculate buy amount
  const bondingCurveAccount = await sdk.getBondingCurveAccount(mint, 'confirmed');
  if (!bondingCurveAccount) {
    Logger.error(`[PUMPFUN BUY] Bonding curve account not found`, { tokenMint });
    throw new Error(`Bonding curve account not found for mint: ${tokenMint}`);
  }

  Logger.debug(`[PUMPFUN BUY] Bonding curve account retrieved`, {
    mint: tokenMint.substring(0, 8) + '...'
  });

  // // Calculate buy amount (tokens to receive)
  // const buyAmount = bondingCurveAccount.getBuyPrice(buyAmountSolBigInt);
  
  // // Calculate max SOL amount with slippage (for slippage protection)
  // const buyAmountWithSlippage = calculateWithSlippageBuy(buyAmountSolBigInt, slippageBpsBigInt);
  
  // // Get global account for fee recipient
  // const globalAccount = await sdk.getGlobalAccount('confirmed');

  Logger.debug(`[PUMPFUN BUY] Getting buy instructions from SDK`, {
    buyer: buyer.toBase58().substring(0, 8) + '...',
    mint: tokenMint.substring(0, 8) + '...',
    buyAmountSol,
    slippageBps
  });

  const buyIxs = await sdk.getBuyIxsBySolAmount(
    buyer,
    mint,
    buyAmountSolBigInt,
    slippageBpsBigInt,
    'confirmed'
  );
  // Get buy instructions from SDK
  // const buyIxs = await sdk.getBuyIxs(
  //   buyer,
  //   mint,
  //   globalAccount.feeRecipient,
  //   buyAmount,
  //   buyAmountWithSlippage,
  //   'confirmed'
  // );

  Logger.debug(`[PUMPFUN BUY] Buy instructions generated`, {
    instructionCount: buyIxs.length
  });

  // Build and send transaction
  const latestBlockhash = await connection.getLatestBlockhash('confirmed');
  const messageV0 = new TransactionMessage({
    payerKey: buyer,
    recentBlockhash: latestBlockhash.blockhash,
    instructions: buyIxs,
  }).compileToV0Message();

  const versionedTx = new VersionedTransaction(messageV0);
  versionedTx.sign([wallet.keypair]);

  Logger.info(`[PUMPFUN BUY] Sending transaction`, {
    wallet: buyer.toBase58().substring(0, 8) + '...',
    blockhash: latestBlockhash.blockhash.substring(0, 8) + '...',
    instructionCount: buyIxs.length
  });

  const signature = await connection.sendTransaction(versionedTx, {
    skipPreflight: false,
    maxRetries: 3,
  });

  Logger.info(`[PUMPFUN BUY] Transaction sent, waiting for confirmation`, {
    signature,
    wallet: buyer.toBase58().substring(0, 8) + '...'
  });

  // Wait for confirmation
  await connection.confirmTransaction(signature, 'confirmed');
  
  Logger.info(`[PUMPFUN BUY] Buy completed successfully`, {
    signature,
    wallet: buyer.toBase58().substring(0, 8) + '...',
    tokenMint: tokenMint.substring(0, 8) + '...',
    buyAmountSol,
    slippageBps,
    explorerUrl: `https://solscan.io/tx/${signature}`
  });

  return signature;
}

/**
 * Execute a buy order
 */
async function executeBuy(
  connection: Connection,
  state: TradingState,
  buyQueue: number[],
  sellQueue: number[]
): Promise<{ buyQueue: number[]; sellQueue: number[]; state: TradingState }> {
  if (buyQueue.length === 0) {
    Logger.warn('No wallets available for buying');
    return { buyQueue, sellQueue, state };
  }

  const walletIndex = buyQueue.shift()!;
  const wallet = state.wallets[walletIndex];

  // Double-check no one bought before executing
  const ourWalletAddresses = state.wallets.map(w => w.publicKey);
  const someoneBought = await hasSomeoneBought(connection, state.tokenMint!, ourWalletAddresses);
  
  if (someoneBought) {
    // Someone bought while we were queued - put back in queue and wait
    buyQueue.unshift(walletIndex);
    const newState: TradingState = {
      ...state,
      isWaiting: true,
      isBuying: false,
      lastBuyerTimestamp: Date.now(),
    };
    Logger.info('Someone bought while preparing buy - aborting and waiting');
    return { buyQueue, sellQueue, state: newState };
  }

  try {
    Logger.info(`Executing buy with wallet ${walletIndex} (${wallet.publicKey.substring(0, 8)}...)`);

    const computedBuyAmountSol = calculateKellyBuyAmountSol({
      bankrollSol: kellyBankrollSol,
      probability: kellyProbability,
      allInPrice: kellyAllInPrice,
      maxStakeSol: kellyMaxStakeSol,
      minStakeSol: kellyMinStakeSol,
      kellyFraction,
    });

    Logger.info(`[KELLY] Calculated buy amount`, {
      walletIndex,
      stakeSol: computedBuyAmountSol,
      formattedStake: formatKellyStakeForLogs(computedBuyAmountSol),
      bankrollSol: kellyBankrollSol,
      probability: kellyProbability,
      allInPrice: kellyAllInPrice,
    });
    
    const signature = await executeBuyWithSDK(
      connection,
      wallet,
      state.tokenMint!,
      computedBuyAmountSol,
      slippageBps
    );

    // Update wallet action tracking
    const newWalletActions = new Map(state.walletActions);
    newWalletActions.set(walletIndex, 'buy');
    
    const newState: TradingState = {
      ...state,
      walletActions: newWalletActions,
      lastBuyerWalletIndex: walletIndex,
      lastBuyerTimestamp: Date.now(),
      isBuying: true,
    };

    // Add to sell queue
    const newSellQueue = [...sellQueue, walletIndex];

    Logger.info(`Buy executed successfully. Signature: ${signature}`);
    
    // Small delay between buys to avoid bundling
    await sleep(500);
    
    return { buyQueue, sellQueue: newSellQueue, state: newState };
  } catch (error) {
    Logger.error(`Error executing buy with wallet ${walletIndex}:`, error);
    // Put wallet back in queue for retry
    buyQueue.push(walletIndex);
    return { buyQueue, sellQueue, state };
  }
}

/**
 * Execute sell using PumpFunSDK
 */
async function executeSellWithSDK(
  connection: Connection,
  wallet: WalletInfo,
  tokenMint: string,
  slippageBps: number
): Promise<string> {
  const mint = new PublicKey(tokenMint);
  const seller = wallet.keypair.publicKey;
  
  Logger.info(`[PUMPFUN SELL] Starting sell operation`, {
    wallet: seller.toBase58().substring(0, 8) + '...',
    tokenMint: tokenMint.substring(0, 8) + '...',
    slippageBps
  });

  // Get user's token account balance
  const userTokenAccount = await getAssociatedTokenAddress(mint, seller);
  Logger.debug(`[PUMPFUN SELL] Checking token account balance`, {
    tokenAccount: userTokenAccount.toBase58().substring(0, 8) + '...',
    wallet: seller.toBase58().substring(0, 8) + '...'
  });

  const tokenAccountInfo = await connection.getTokenAccountBalance(userTokenAccount);
  const sellTokenAmount = BigInt(tokenAccountInfo.value.amount);
  const slippageBpsBigInt = BigInt(slippageBps);

  Logger.info(`[PUMPFUN SELL] Token balance retrieved`, {
    wallet: seller.toBase58().substring(0, 8) + '...',
    tokenAmount: sellTokenAmount.toString(),
    tokenAmountUI: tokenAccountInfo.value.uiAmount,
    decimals: tokenAccountInfo.value.decimals
  });

  if (sellTokenAmount === BigInt(0)) {
    Logger.error(`[PUMPFUN SELL] No tokens to sell`, {
      wallet: seller.toBase58().substring(0, 8) + '...',
      tokenMint: tokenMint.substring(0, 8) + '...',
      tokenAccount: userTokenAccount.toBase58().substring(0, 8) + '...'
    });
    throw new Error('No tokens to sell');
  }

  Logger.info(`[PUMPFUN SELL] Executing sell via SDK`, {
    wallet: seller.toBase58().substring(0, 8) + '...',
    tokenMint: tokenMint.substring(0, 8) + '...',
    sellTokenAmount: sellTokenAmount.toString(),
    slippageBps
  });

  // Use SDK sell method
  const result = await sdk.sell(
    wallet.keypair,
    mint,
    sellTokenAmount,
    slippageBpsBigInt
  );

  if (!result.success || !result.signature) {
    Logger.error(`[PUMPFUN SELL] Sell transaction failed`, {
      wallet: seller.toBase58().substring(0, 8) + '...',
      tokenMint: tokenMint.substring(0, 8) + '...',
      error: result.error?.toString() || 'Unknown error',
      success: result.success
    });
    throw new Error(result.error?.toString() || 'Sell transaction failed');
  }

  Logger.info(`[PUMPFUN SELL] Sell completed successfully`, {
    signature: result.signature,
    wallet: seller.toBase58().substring(0, 8) + '...',
    tokenMint: tokenMint.substring(0, 8) + '...',
    sellTokenAmount: sellTokenAmount.toString(),
    slippageBps,
    explorerUrl: `https://solscan.io/tx/${result.signature}`
  });

  return result.signature;
}

/**
 * Execute a sell order
 */
async function executeSell(
  connection: Connection,
  state: TradingState,
  buyQueue: number[],
  sellQueue: number[]
): Promise<{ buyQueue: number[]; sellQueue: number[]; state: TradingState }> {
  if (sellQueue.length === 0) {
    Logger.warn('No wallets available for selling');
    // If no more wallets to sell, check if we should resume buying
    const ourWalletAddresses = state.wallets.map(w => w.publicKey);
    const someoneBought = await hasSomeoneBought(connection, state.tokenMint!, ourWalletAddresses);
    
    if (!someoneBought) {
      // No external buyer, reset and start buying again
      const reset = resetTradingState(state);
      return { ...reset, sellQueue: [] };
    }
    // Still waiting for external buyer to sell
    return { buyQueue, sellQueue, state };
  }

  // Sell from the last wallet that bought (LIFO)
  const walletIndex = sellQueue.pop()!;
  const wallet = state.wallets[walletIndex];

  try {
    Logger.info(`Executing sell with wallet ${walletIndex} (${wallet.publicKey.substring(0, 8)}...)`);
    
    const signature = await executeSellWithSDK(
      connection,
      wallet,
      state.tokenMint!,
      slippageBps
    );

    // Update wallet action tracking
    const newWalletActions = new Map(state.walletActions);
    newWalletActions.set(walletIndex, 'sell');

    Logger.info(`Sell executed successfully. Signature: ${signature}`);

    // Check if external buyer has sold
    const ourWalletAddresses = state.wallets.map(w => w.publicKey);
    const someoneBought = await hasSomeoneBought(connection, state.tokenMint!, ourWalletAddresses);
    const someoneSold = await hasSomeoneSold(connection, state.tokenMint!, ourWalletAddresses);
    
    let newState: TradingState;
    let newBuyQueue = buyQueue;
    
    if (someoneSold || !someoneBought) {
      // External buyer sold or left - resume buying if we still have wallets with tokens
      Logger.info('External buyer sold or left! Checking if we should resume buying...');
      const updatedState = { ...state, walletActions: newWalletActions };
      
      // Check if we have wallets that still hold tokens (haven't sold yet)
      const walletsWithTokens = sellQueue.length > 0 || 
        Array.from(updatedState.walletActions.values()).some(action => action === 'buy');
      
      if (walletsWithTokens) {
        // We still have wallets with tokens, resume buying
        Logger.info('Resuming buying - we still have wallets with tokens');
        const reset = resetTradingState(updatedState);
        newState = reset.state;
        newBuyQueue = reset.buyQueue;
      } else {
        // All wallets sold, reset completely
        Logger.info('All wallets sold. Resetting completely.');
        const reset = resetTradingState(updatedState);
        newState = reset.state;
        newBuyQueue = reset.buyQueue;
      }
    } else {
      // External buyer still holding - continue selling
      Logger.info('External buyer still holding. Continue selling...');
      newState = {
        ...state,
        walletActions: newWalletActions,
      };
    }

    // Small delay between sells
    await sleep(500);
    
    return { buyQueue: newBuyQueue, sellQueue, state: newState };
  } catch (error) {
    Logger.error(`Error executing sell with wallet ${walletIndex}:`, error);
    // Put wallet back in sell queue for retry
    sellQueue.push(walletIndex);
    return { buyQueue, sellQueue, state };
  }
}

/**
 * Main trading logic
 */
async function tradingLoop(
  connection: Connection,
  state: TradingState,
  buyQueue: number[],
  sellQueue: number[]
): Promise<{ state: TradingState; buyQueue: number[]; sellQueue: number[] }> {
  const ourWalletAddresses: string[] = state.wallets.map(w => w.publicKey);
  
  // Check if someone else has bought
  const someoneBought = await hasSomeoneBought(connection, state.tokenMint as string, ourWalletAddresses);
  // Check if someone else has sold
  const someoneSold = await hasSomeoneSold(connection, state.tokenMint as string, ourWalletAddresses);

  // If external buyer detected and we're not already waiting/selling
  if (someoneBought && !state.isWaiting && sellQueue.length === 0) {
    // Someone else bought - pause buying and enter waiting mode
    Logger.info('External buyer detected! Pausing buying and entering wait mode...');
    const newState: TradingState = {
      ...state,
      isWaiting: true,
      isBuying: false,
      lastBuyerTimestamp: Date.now(),
    };
    return { state: newState, buyQueue, sellQueue };
  }

  // If we're waiting for external buyer to sell
  if (state.isWaiting) {
    const waitTime = Date.now() - (state.lastBuyerTimestamp || 0);
    
    // Check if external buyer sold within timeout
    if (someoneSold) {
      // External buyer sold within timeout - resume buying
      Logger.info('External buyer sold within timeout! Resuming buying...');
      const reset = resetTradingState(state);
      return { ...reset, sellQueue };
    }
    
    if (waitTime >= waitTimeoutMs) {
      // Timeout reached - start selling
      Logger.info('Timeout reached. External buyer did not sell. Starting to sell...');
      const newState: TradingState = {
        ...state,
        isWaiting: false,
        isBuying: false,
      };
      return await executeSell(connection, newState, buyQueue, sellQueue);
    } else {
      // Still waiting
      const remainingTime = waitTimeoutMs - waitTime;
      Logger.debug(`Waiting for external buyer to sell... ${remainingTime}ms remaining`);
      return { state, buyQueue, sellQueue };
    }
  }

  // If we're in selling mode (sellQueue has items)
  if (sellQueue.length > 0) {
    // Check if external buyer sold
    if (someoneSold || !someoneBought) {
      // External buyer sold or left - resume buying if we still have wallets with tokens
      Logger.info('External buyer sold or left while we were selling. Checking if we should resume buying...');
      const walletsWithTokens = sellQueue.length > 0 || 
        Array.from(state.walletActions.values()).some(action => action === 'buy');
      
      if (walletsWithTokens) {
        // Resume buying
        const reset = resetTradingState(state);
        return { ...reset, sellQueue };
      }
    }
    // Continue selling
    return await executeSell(connection, state, buyQueue, sellQueue);
  }

  // No external buyer - keep buying
  if (!someoneBought) {
    return await executeBuy(connection, state, buyQueue, sellQueue);
  }

  return { state, buyQueue, sellQueue };
}

/**
 * Start the trading engine
 */
export async function startTradingEngine(
  connection: Connection,
  wallets: WalletInfo[],
  tokenMint: string
): Promise<void> {
  Logger.info('Starting trading engine...');

  // Initialize state
  let state: TradingState = {
    wallets,
    lastBuyerWalletIndex: null,
    lastBuyerTimestamp: null,
    isBuying: false,
    isWaiting: false,
    tokenMint,
    walletActions: new Map<number, 'buy' | 'sell'>(),
  };

  // Initialize buy queue with all wallets
  let buyQueue = wallets.map((_, index) => index);

  let sellQueue: number[] = [];
  let isRunning = true;

  // Handle graceful shutdown
  const stop = () => {
    isRunning = false;
    Logger.info('Stopping trading engine...');
  };

  process.on('SIGINT', () => {
    Logger.info('Received SIGINT, shutting down gracefully...');
    stop();
    process.exit(0);
  });

  // Main trading loop
  while (isRunning) {
    try {
      const result = await tradingLoop(connection, state, buyQueue, sellQueue);
      state = result.state;
      buyQueue = result.buyQueue;
      sellQueue = result.sellQueue;
      
      // Small delay to avoid rate limiting
      await sleep(1000);
    } catch (error) {
      Logger.error('Error in trading loop:', error);
      await sleep(5000);
    }
  }
}

