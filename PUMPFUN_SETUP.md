# PumpFun setup guide

This project is already wired to interact with PumpFun through the SDK layer in [src/pumpfun/pumpfun.ts](src/pumpfun/pumpfun.ts). For most developers, the setup is straightforward: configure your environment, fund wallets, and run the bot.

## What you need

- A working Solana RPC endpoint
- A funded wallet private key
- A token mint address if you want to trade an existing token
- Enough SOL in the funding wallet to cover wallet funding and transaction fees

## Recommended setup steps

### 1. Install dependencies

```bash
npm install
```

### 2. Create a local environment file

Create a `.env` file in the project root with values such as:

```env
RPC_URL=https://api.mainnet-beta.solana.com
FUNDING_WALLET_PRIVATE_KEY=your_private_key_here
TOKEN_MINT_ADDRESS=your_token_mint_here
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

### 3. Fund the wallets

The bot uses the wallet manager to create or load wallets and fund them with SOL. Make sure the funding wallet has enough balance before starting.

### 4. Start the bot

```bash
npm run dev
```

## How the PumpFun integration works

The current bot uses the PumpFun SDK rather than manually building raw instructions. In practice, that means:
- the bot requests buy and sell instructions from the SDK,
- signs them with the wallet keypair,
- sends them through the Solana connection,
- waits for confirmation.

This keeps the integration simpler for developers and reduces the amount of low-level plumbing you need to maintain.

## Important notes for traders

- Start with small stake sizes and small wallet funding.
- Review slippage before running live trades.
- Kelly sizing is a risk-control feature, not a guarantee.
- If the market changes quickly, the bot may pause and wait instead of forcing a trade.

## Program information

The PumpFun program ID used in the config is:

```text
6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P
```

## Troubleshooting

### The bot cannot connect to RPC
- Check that `RPC_URL` is valid.
- Make sure your network allows outbound RPC requests.

### Buy or sell transactions fail
- Confirm the wallet has enough SOL.
- Check that the mint address is correct.
- Lower the slippage if the market is moving fast.

### The bot is not buying as expected
- Verify that `TOKEN_MINT_ADDRESS` is set.
- Review the Kelly parameters to make sure they are realistic.
- Check the logs for wait or reset events.
