# Architecture Overview

## Component Structure

```
┌─────────────────────────────────────────────────────────────┐
│                        Main Entry                           │
│                         (index.ts)                          │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   Wallet     │ │    Token     │ │   Trading    │
│   Manager    │ │   Deployer   │ │   Engine     │
└──────┬───────┘ └──────────────┘ └──────┬───────┘
       │                                  │
       │                                  │
       ▼                                  ▼
┌──────────────┐                  ┌──────────────┐
│   Jupiter    │                  │   Market     │
│   Client     │                  │   Monitor    │
└──────────────┘                  └──────────────┘
```

## Data Flow

### Initialization Phase
1. **WalletManager** creates 100 wallets
2. **WalletManager** funds each wallet with 0.22 SOL from central wallet
3. **TokenDeployer** deploys token to first wallet (or uses existing)Token 
4. **TradingEngine** initializes with wallets and token mint

### Trading Phase
1. **TradingEngine** checks **MarketMonitor** for external buyers
2. If no external buyer:
   - **TradingEngine** executes buy via **JupiterClient**
   - Updates wallet state
   - Adds wallet to sell queue
3. If external buyer detected:
   - **TradingEngine** enters wait mode
   - After timeout, executes sell via **JupiterClient**
   - Continues selling until external buyer leaves or wallets exhausted

## State Machine

```
[IDLE] ──buy──> [BUYING] ──external_buyer──> [WAITING]
  ↑                                              │
  │                                              │
  └──────────external_buyer_left─────────────────┘
                      │
                      │ timeout
                      ▼
                 [SELLING]
                      │
                      │
                      └──> [IDLE] (if buyer left)
                           [WAITING] (if still holding)
```

## Key Design Decisions

### 1. No Transaction Bundling
- Each transaction is sent individually
- Small delays (500ms) between transactions
- Prevents MEV bots from bundling with our transactions

### 2. Tight Slippage
- Default: 50 bps (0.5%)
- Configurable via environment variable
- Prevents frontrunning and MEV attacks

### 3. Sequential Execution
- Buy queue: FIFO (first wallet buys first)
- Sell queue: LIFO (last wallet that bought sells first)
- Ensures predictable execution order

### 4. Market Monitoring
- Checks recent transactions on token mint
- Filters out our own transactions
- Detects external buyers within 1 minute window

### 5. Wait and Sell Strategy
- 20 second timeout (configurable)
- Sells from last wallet that bought
- Continues selling until external buyer leaves
- Resets to buying when external buyer exits

## Error Handling

- Transaction failures: Wallet returned to queue for retry
- Network errors: Exponential backoff with retries
- Insufficient balance: Checked before funding phase
- Invalid quotes: Transaction aborted, wallet returned to queue

## Performance Considerations

- Non-blocking: Uses async/await throughout
- Rate limiting: Delays between transactions
- Connection pooling: Single connection instance reused
- Transaction confirmation: Uses 'confirmed' commitment level

## Security Considerations

- Private keys: Stored in memory only, never logged
- Environment variables: Sensitive data in .env file
- Transaction signing: Done locally, never exposed
- Slippage protection: Prevents unfavorable swaps
