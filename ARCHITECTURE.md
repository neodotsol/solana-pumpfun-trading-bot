# Architecture Overview

This bot is a PumpFun trading assistant that watches a token, places buys, and reacts when another buyer enters the market. The design is intentionally simple so developers can understand the flow quickly and traders can see what the bot is doing at each step.

## What the bot does

The bot:
- creates or loads wallet accounts,
- funds them with SOL,
- watches the token market for external buying activity,
- buys in a controlled sequence,
- pauses when another buyer appears,
- sells from the last wallet that bought when the market turns,
- uses Kelly-based position sizing to keep stake sizes more disciplined.

## Main components

### 1. Entry point
- [src/index.ts](src/index.ts)
- Starts the bot, loads wallets, and launches the trading engine.

### 2. Configuration
- [src/config/index.ts](src/config/index.ts)
- Holds RPC settings, wallet settings, slippage, buy size, and Kelly parameters.

### 3. Wallet manager
- [src/wallet/WalletManager.ts](src/wallet/WalletManager.ts)
- Creates, saves, loads, and funds wallets.

### 4. Trading engine
- [src/engine/TradingEngine.ts](src/engine/TradingEngine.ts)
- Runs the buy/sell loop, tracks queues, and reacts to market activity.

### 5. PumpFun integration
- [src/pumpfun/pumpfun.ts](src/pumpfun/pumpfun.ts)
- Handles the SDK-based buy and sell transactions.

### 6. Market monitor
- [src/monitor/MarketMonitor.ts](src/monitor/MarketMonitor.ts)
- Detects whether another wallet has bought or sold the token.

### 7. Kelly sizing helper
- [src/utils/kellyStake.ts](src/utils/kellyStake.ts)
- Converts the probability and price assumptions into a capped buy amount.

## Simple data flow

### Startup
1. The bot loads wallet information from disk or creates new wallets.
2. It funds each wallet with a small amount of SOL.
3. It starts the trading engine with the selected token mint.

### Buy cycle
1. The engine checks whether someone else has already bought the token.
2. If no one else has bought, it selects the next wallet from the buy queue.
3. It calculates a Kelly-based stake size using the configured inputs.
4. The bot submits a buy through the PumpFun SDK.
5. The wallet is moved to the sell queue.

### Wait-and-sell cycle
1. If another buyer appears, the bot stops buying and enters a waiting state.
2. If the buyer leaves quickly, the bot resumes buying.
3. If the buyer remains, the bot eventually starts selling from the most recently bought wallet first.

## State flow

```text
START -> LOAD WALLETS -> FUND WALLETS -> BUYING -> WAITING -> SELLING -> RESET -> BUYING
```

## Why this design works

### Clear execution order
- Wallets buy in a predictable order.
- Wallets sell in reverse order so the bot can rotate positions smoothly.

### Risk control
- Slippage is configurable.
- Kelly sizing helps keep the position size disciplined.
- Minimum and maximum stake limits prevent extreme exposure.

### Easy debugging
- Logging is emitted for each buy, sell, wait, and reset event.
- Queue state is visible in the engine flow.

## Risk notes for traders

- This bot is a trading tool, not a guarantee of profit.
- Use small test sizes first.
- Always review your wallet balance, slippage, and market conditions before running live trades.
- Kelly sizing should be treated as a risk-management input, not as a promise of success.
