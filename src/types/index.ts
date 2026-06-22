export interface WalletInfo {
  keypair: any; // Keypair from @solana/web3.js
  publicKey: string;
  privateKey: string;
}

export interface TradingState {
  wallets: WalletInfo[];
  lastBuyerWalletIndex: number | null;
  lastBuyerTimestamp: number | null;
  isBuying: boolean;
  isWaiting: boolean;
  tokenMint: string | null;
  walletActions: Map<number, 'buy' | 'sell'>; // Track wallet actions by index
}

export interface SwapParams {
  walletIndex: number;
  amount: number;
  isBuy: boolean;
  slippageBps: number;
}

export interface TokenInfo {
  mint: string;
  decimals: number;
  supply: number;
}
