import { Keypair, PublicKey, Connection } from '@solana/web3.js';
import base58 from 'bs58';
import dotenv from 'dotenv';
import { PumpFunSDK } from '../pumpfun/pumpfun';
import { AnchorProvider } from '@coral-xyz/anchor';
import NodeWallet from '@coral-xyz/anchor/dist/cjs/nodewallet';

dotenv.config();

// Network configuration (mainnet only)
export const rpcUrl = process.env.RPC_URL || ''
export const fundingWalletPrivateKey = process.env.FUNDING_WALLET_PRIVATE_KEY || ''
export const mainKp: Keypair = Keypair.fromSecretKey(base58.decode(fundingWalletPrivateKey))
const wallet = new NodeWallet(mainKp)
export const tokenMintAddress = process.env.TOKEN_MINT_ADDRESS || ''
export const commitment = "confirmed"

// Initialize connection
export const connection: Connection = new Connection(rpcUrl, 'confirmed');
export const sdk = new PumpFunSDK(new AnchorProvider(connection, wallet, { commitment }));

// Trading parameters
export const slippageBps = parseInt(process.env.SLIPPAGE_BPS || '50') // 0.5% slippage
export const buyAmountSol = parseFloat(process.env.BUY_AMOUNT_SOL || '0.01')
export const waitTimeoutMs = parseInt(process.env.WAIT_TIMEOUT_MS || '20000') // 20 seconds

// Wallet configuration
export const numWallets = parseInt(process.env.NUM_WALLETS || '10')
export const fundingAmountSol = 0.022 // 0.022 SOL per wallet

// DEX configuration
export const dexType = 'pumpfun' as 'pumpfun' | 'jupiter' | 'raydium'
export const PUMPFUN_PROGRAM_ID = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P')


// Token Meta Data
export const TOKEN_NAME = "Testt"
export const TOKEN_SYMBOL = "TESTT"
export const DESCRIPTION = "Testt token"
export const TOKEN_SHOW_NAME = "Testt"
export const TOKEN_CREATE_ON = "yesterday"
export const TWITTER = "https://x.com"
export const TELEGRAM = "https://t.me/"
export const WEBSITE = "https://website.com"
export const FILE = "src/img/test.png"

export const JITO_FEE = 0.0001

// Export config object for backward compatibility
export const config = {
  rpcUrl,
  fundingWalletPrivateKey,
  tokenMintAddress,
  slippageBps,
  buyAmountSol,
  waitTimeoutMs,
  numWallets,
  fundingAmountSol,
  dexType,
  pumpfunProgramId: PUMPFUN_PROGRAM_ID.toBase58(),
};
