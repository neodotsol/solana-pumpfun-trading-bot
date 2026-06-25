# Solana PumpFun Trading Bot

A practical Solana trading bot for PumpFun-style markets. It uses multiple wallets, watches for external buyers, and applies a Kelly-based stake sizing approach to keep buy sizes more disciplined.

## What it does

- Creates or loads multiple wallets
- Funds wallets with SOL
- Watches the token market for incoming buyers and sellers
- Buys in a controlled sequence
- Pauses when another buyer enters the market
- Sells from the most recently purchased wallet when the market turns
- Uses Kelly-criterion sizing with configurable max/min bounds

## Main features

- Multi-wallet trading flow
- PumpFun SDK integration
- Slippage protection
- Wait-and-sell reaction logic
- Kelly-based buy sizing
- Simple logging for each trading step

## Requirements

- Node.js 18+
- npm
- A funded Solana wallet
- A working RPC endpoint
- Enough SOL for funding test wallets

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file and configure values such as:

```env
RPC_URL=https://api.mainnet-beta.solana.com
FUNDING_WALLET_PRIVATE_KEY=your_base58_private_key
TOKEN_MINT_ADDRESS=your_token_mint_address
SLIPPAGE_BPS=50
BUY_AMOUNT_SOL=0.01
WAIT_TIMEOUT_MS=20000
NUM_WALLETS=10

KELLY_BANKROLL_SOL=500
KELLY_PROBABILITY=0.58
KELLY_ALL_IN_PRICE=0.52
KELLY_MAX_STAKE_SOL=25
KELLY_MIN_STAKE_SOL=5
KELLY_FRACTION=0.5
```

## Running the bot

### Development

```bash
npm run dev
```

### Production build

```bash
npm run build
npm start
```

## Trading flow

1. The bot loads or creates wallets.
2. It funds the wallets with SOL.
3. It checks for external market activity.
4. If no one else has bought, it places a buy.
5. If another buyer appears, it pauses and waits.
6. If the buyer holds the market for too long, it starts selling from the most recently bought wallet.
7. If the buyer exits quickly, it resumes buying.

## Kelly sizing

The bot now uses a Kelly-based stake calculation through the `stake-math` package. The buy amount is capped between a minimum and maximum stake and logged for transparency.

## Project structure

```text
src/
├── config/          # Configuration values and env parsing
├── engine/          # Buy/sell trading loop
├── monitor/         # Market monitoring
├── pumpfun/         # PumpFun SDK integration
├── token/           # Token deployment helpers
├── utils/           # Shared helpers such as Kelly sizing
├── wallet/          # Wallet creation and funding
└── types/           # TypeScript types
```

## Documentation

Useful guides are included in the repository:

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [PUMPFUN_SETUP.md](PUMPFUN_SETUP.md)
- [TEST_CASES.md](TEST_CASES.md)
- [TESTING_GUIDE.md](TESTING_GUIDE.md)

## Safety notes

- Use small amounts when testing.
- Keep your private keys secure and never commit them.
- Review slippage and Kelly settings before trading live.
- This bot is a trading tool, not a guarantee of profit.

## License

MIT
