# Solana Trading Bot

A sophisticated Solana trading bot that implements a multi-wallet trading strategy with MEV protection.

## Features

- **Multi-Wallet Management**: Creates and funds 100 wallets from a central funding source
- **Token Deployment**: Deploys a new token or uses an existing one
- **Smart Trading Strategy**:
  - Buys when no one else has bought
  - Waits when someone else buys
  - Sells after timeout if other buyer doesn't sell
  - Restarts buying when other buyer leaves
- **MEV Protection**: Tight slippage settings and non-bundled transactions
- **PumpFun Integration**: Uses PumpFun DEX for token trading

## Requirements

- Node.js 18+
- Solana wallet with sufficient SOL for funding (100 wallets × 0.22 SOL = 22 SOL minimum)

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure:

```env
RPC_URL=https://api.mainnet-beta.solana.com
FUNDING_WALLET_PRIVATE_KEY=your_base58_private_key
TOKEN_MINT_ADDRESS=  # Leave empty to deploy new token on PumpFun
SLIPPAGE_BPS=50  # 0.5% slippage
BUY_AMOUNT_SOL=0.1
SELL_AMOUNT_SOL=0.1
WAIT_TIMEOUT_MS=20000  # 20 seconds
NUM_WALLETS=100
```

**Important**: This bot is configured for **mainnet only**. Ensure you have sufficient SOL in your funding wallet (100 wallets × 0.22 SOL = 22 SOL minimum).

## Usage

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

## Architecture

```
src/
├── config/          # Configuration management
├── wallet/          # Wallet creation and funding
├── token/           # Token deployment (PumpFun)
├── dex/             # DEX integration (PumpFun)
├── monitor/         # Market monitoring
├── engine/          # Trading engine logic
├── utils/           # Utilities (logger)
└── types/           # TypeScript types
```

## Trading Strategy

1. **Initial State**: All wallets are ready to buy
2. **Buy Phase**: Continuously buy until someone else buys
3. **Wait Phase**: When someone else buys, wait 20 seconds
4. **Sell Phase**: If timeout reached, sell from last wallet that bought
5. **Repeat**: Continue selling until other buyer leaves or wallets run out
6. **Reset**: When other buyer leaves, restart buying phase

## Important Notes

- **Never buys if someone else already bought** - Checks market state before each buy
- **No transaction bundling** - Each transaction is sent individually
- **Tight slippage** - Prevents MEV and frontrunning
- **Sequential execution** - Small delays between transactions prevent bundling

## PumpFun Setup

1. Obtain PumpFun's official IDL (Interface Definition Language)
2. Update the instruction builders in `PumpFunClient.ts` and `PumpFunTokenDeployer.ts`
3. See `PUMPFUN_SETUP.md` for detailed instructions

## Security

- Keep your `.env` file secure and never commit it
- Use a dedicated funding wallet with only the required amount
- Monitor your bot's activity regularly
- Consider using a custom RPC endpoint for better reliability
- **This bot runs on mainnet** - use with caution and test thoroughly

## WorkFlow

- No external buyer → keep buying
- External buyer detected → pause buying, enter wait mode
- External buyer sells within 20s → resume buying
- External buyer doesn't sell within 20s → start selling
- While selling → keep selling until external buyer sells
- External buyer sells → resume buying (if wallets still have tokens)

## License

MIT
