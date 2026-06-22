# Trading Bot Testing Guide

This guide provides step-by-step instructions for testing the Solana Trading Bot.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Pre-Testing Checklist](#pre-testing-checklist)
4. [Manual Testing Procedures](#manual-testing-procedures)
5. [Test Scenarios](#test-scenarios)
6. [Monitoring & Verification](#monitoring--verification)
7. [Troubleshooting](#troubleshooting)
8. [Test Results Template](#test-results-template)

---

## Prerequisites

### Required Software
- Node.js (v18+)
- npm or yarn
- Git
- Solana CLI (optional, for wallet management)

### Required Accounts
- Solana wallet with sufficient SOL (for funding test wallets)
- RPC endpoint access (devnet or mainnet)
- Test token deployed (or use existing token)

### Required Knowledge
- Basic understanding of Solana transactions
- Understanding of bonding curves
- Familiarity with command line

---

## Environment Setup

### Step 1: Clone and Install

```bash
# Navigate to project directory
cd "d:\WorkPlace\Solana Trading Bot"

# Install dependencies
npm install

# Build the project
npm run build
```

### Step 2: Configure Environment Variables

Create or update `.env` file:

```env
# Network Configuration
RPC_URL=https://api.devnet.solana.com
# OR for mainnet: RPC_URL=https://api.mainnet-beta.solana.com

# Wallet Configuration
FUNDING_WALLET_PRIVATE_KEY=your_funding_wallet_private_key_here
NUM_WALLETS=10

# Token Configuration
TOKEN_MINT_ADDRESS=your_token_mint_address_here

# Trading Parameters
BUY_AMOUNT_SOL=0.1
SLIPPAGE_BPS=50
WAIT_TIMEOUT_MS=20000

# Optional: Custom RPC (if using private RPC)
# RPC_URL=https://your-custom-rpc-endpoint.com
```

### Step 3: Create Test Wallets

```bash
# Run wallet creation script (if available)
# Or use the WalletManager to create wallets
npm run dev
# Then use wallet creation function in code
```

**Manual Wallet Creation:**
1. Use Solana CLI: `solana-keygen new -o wallets/wallet0.json`
2. Or use the `createWallets()` function in `WalletManager.ts`

### Step 4: Fund Test Wallets

**Option A: Using WalletManager**
```typescript
import { fundWallets, loadWallets } from './src/wallet/WalletManager';
import { connection, fundingWalletPrivateKey, fundingAmountSol } from './src/config';

const wallets = loadWallets();
await fundWallets(connection, fundingWalletPrivateKey, wallets, fundingAmountSol);
```

**Option B: Manual Funding**
```bash
# Fund each wallet manually
solana transfer <wallet-address> 0.22 --url devnet
```

**Required Balance per Wallet:**
- Minimum: `buyAmountSol + transaction fees` (≈ 0.11 SOL)
- Recommended: 0.22 SOL per wallet
- For 10 wallets: ~2.2 SOL total needed

---

## Pre-Testing Checklist

Before starting tests, verify:

- [ ] Environment variables configured correctly
- [ ] `.env` file exists and has correct values
- [ ] RPC endpoint is accessible
- [ ] Test wallets created (check `wallets.json`)
- [ ] All wallets funded with sufficient SOL
- [ ] Token mint address is correct
- [ ] Token exists and bonding curve is initialized
- [ ] Funding wallet has enough SOL
- [ ] Project builds without errors (`npm run build`)
- [ ] No syntax errors in code

**Quick Verification:**
```bash
# Check wallet file exists
ls wallets.json

# Check environment variables
node -e "require('dotenv').config(); console.log(process.env.TOKEN_MINT_ADDRESS)"

# Test RPC connection
node -e "const { Connection } = require('@solana/web3.js'); const conn = new Connection(process.env.RPC_URL); conn.getVersion().then(v => console.log('RPC OK:', v))"
```

---

## Manual Testing Procedures

### Test 1: Basic Sequential Buying

**Objective:** Verify all wallets buy tokens sequentially

**Steps:**
1. Start the bot:
   ```bash
   npm run dev
   ```

2. Monitor console output:
   ```
   Starting trading engine...
   Executing buy with wallet 0 (AbCdEfGh...)
   Buy executed successfully. Signature: <tx-signature>
   Executing buy with wallet 1 (XyZaBcDe...)
   Buy executed successfully. Signature: <tx-signature>
   ...
   ```

3. Verify on Solana Explorer:
   - Go to: `https://solscan.io/` (or `https://explorer.solana.com/`)
   - Search for transaction signatures
   - Verify each wallet bought tokens
   - Check token balances

**Expected Results:**
- ✅ All 10 wallets execute buy transactions
- ✅ Each buy has ~500ms delay between them
- ✅ buyQueue shrinks: [0-9] → []
- ✅ sellQueue grows: [] → [0-9]
- ✅ All transactions confirm successfully

**Verification Commands:**
```bash
# Check transaction count (should see 10 buy transactions)
# Monitor logs for: "Buy executed successfully" (10 times)
```

---

### Test 2: External Buyer Detection

**Objective:** Verify bot pauses when external buyer buys

**Prerequisites:**
- Bot is running and buying tokens
- Have another wallet ready to buy manually

**Steps:**
1. Start bot and let it buy with first few wallets
2. **While bot is buying**, use another wallet to buy the token manually:
   ```bash
   # Use Solana CLI or another tool to buy token
   # Or use Phantom/Solflare wallet
   ```

3. Monitor bot logs:
   ```
   External buyer detected! Pausing buying and entering wait mode...
   Waiting for external buyer to sell... <remaining-time>ms remaining
   ```

4. Verify state:
   - Bot should stop buying
   - `isWaiting` should be `true`
   - buyQueue should be preserved

**Expected Results:**
- ✅ Bot detects external buyer immediately
- ✅ Bot enters waiting mode
- ✅ No more buy attempts while waiting
- ✅ buyQueue preserved (not cleared)

**Verification:**
- Check logs for "External buyer detected"
- Verify no new buy transactions from bot wallets
- Check `isWaiting` state in logs

---

### Test 3: Wait Timeout

**Objective:** Verify bot starts selling after timeout

**Prerequisites:**
- Bot is in waiting mode (from Test 2)
- External buyer does NOT sell

**Steps:**
1. Ensure bot is waiting (from Test 2)
2. **Do NOT sell** the external buyer's tokens
3. Wait 20+ seconds (waitTimeoutMs)
4. Monitor logs:
   ```
   Timeout reached. External buyer did not sell. Starting to sell...
   Executing sell with wallet 9 (last wallet)...
   Sell executed successfully. Signature: <tx-signature>
   ```

**Expected Results:**
- ✅ After 20 seconds, bot starts selling
- ✅ Sells in LIFO order (last wallet first)
- ✅ `isWaiting` becomes `false`
- ✅ Selling proceeds normally

**Verification:**
- Check timestamp: wait time ≥ 20000ms
- Verify sell transactions start
- Check sell order is LIFO (9 → 8 → 7...)

---

### Test 4: External Buyer Sells Early

**Objective:** Verify bot resumes buying when external buyer sells

**Prerequisites:**
- Bot is in waiting mode
- External buyer has tokens

**Steps:**
1. Bot is waiting (from Test 2)
2. **Sell** external buyer's tokens (within 20 seconds)
3. Monitor logs:
   ```
   External buyer sold within timeout! Resuming buying...
   Resetting trading state...
   Executing buy with wallet X...
   ```

**Expected Results:**
- ✅ Bot detects external buyer sold
- ✅ Bot immediately resumes buying
- ✅ Wallets that sold are back in buyQueue
- ✅ No timeout occurs

**Verification:**
- Check logs for "External buyer sold within timeout"
- Verify buy transactions resume
- Check buyQueue is repopulated

---

### Test 5: LIFO Selling Order

**Objective:** Verify selling happens in Last-In-First-Out order

**Prerequisites:**
- Multiple wallets have bought tokens
- Bot is selling (from timeout or manual trigger)

**Steps:**
1. Ensure 3+ wallets have bought: wallets 0, 1, 2
2. sellQueue = [0, 1, 2] (wallet 2 bought last)
3. Trigger selling (timeout or external buyer)
4. Monitor sell order:
   ```
   Executing sell with wallet 2 (last bought)...
   Executing sell with wallet 1...
   Executing sell with wallet 0...
   ```

**Expected Results:**
- ✅ Wallet 2 sells first (last bought)
- ✅ Wallet 1 sells second
- ✅ Wallet 0 sells last
- ✅ Order: 2 → 1 → 0

**Verification:**
- Check transaction timestamps
- Verify sell order matches buy order (reversed)

---

### Test 6: Error Recovery

**Objective:** Verify bot handles errors gracefully

**Test 6A: Buy Failure**
1. Create scenario where buy fails:
   - Insufficient balance
   - Network error
   - Invalid token mint
2. Monitor logs:
   ```
   Error executing buy with wallet X: <error>
   ```
3. Verify:
   - Error is logged
   - Wallet is added back to buyQueue
   - Bot continues with next wallet

**Test 6B: Sell Failure**
1. Create scenario where sell fails:
   - No tokens to sell
   - Network error
2. Monitor logs:
   ```
   Error executing sell with wallet X: <error>
   ```
3. Verify:
   - Error is logged
   - Wallet is added back to sellQueue
   - Bot continues with next wallet

**Expected Results:**
- ✅ Errors are caught and logged
- ✅ Bot continues operation
- ✅ Failed wallets are retried
- ✅ No state corruption

---

### Test 7: Complete Reset Cycle

**Objective:** Verify complete reset after all wallets sell

**Steps:**
1. All wallets buy tokens
2. All wallets sell tokens
3. No external buyer present
4. Monitor logs:
   ```
   All wallets sold. Resetting completely.
   Resetting trading state...
   Executing buy with wallet 0...
   ```

**Expected Results:**
- ✅ resetTradingState is called
- ✅ All wallets added back to buyQueue
- ✅ Bot starts buying again
- ✅ Complete cycle repeats

**Verification:**
- Check buyQueue is repopulated with all wallets
- Verify buy transactions start again
- Check walletActions are reset appropriately

---

## Test Scenarios

### Scenario A: Happy Path (Full Cycle)
```
1. Start bot → 10 wallets buy sequentially
2. External buyer buys → Bot waits
3. External buyer sells (within timeout) → Bot resumes
4. All wallets sell → Bot resets
5. Repeat cycle
```

**Duration:** ~5-10 minutes  
**Success Criteria:** All steps complete without errors

---

### Scenario B: Timeout Path
```
1. Start bot → 10 wallets buy
2. External buyer buys → Bot waits
3. Wait 25 seconds → Bot times out
4. Bot sells all wallets (LIFO)
5. Bot resets → Starts buying again
```

**Duration:** ~3-5 minutes  
**Success Criteria:** Timeout triggers, selling proceeds

---

### Scenario C: Error Recovery
```
1. Start bot → Wallet 0 buy fails
2. Bot continues → Wallets 1-9 buy successfully
3. Wallet 0 retries → Eventually succeeds or skipped
4. All wallets sell → Bot resets
```

**Duration:** ~5-7 minutes  
**Success Criteria:** Errors handled, bot continues

---

### Scenario D: Rapid External Buyers
```
1. Bot buying → External buyer 1 buys
2. Bot waits → External buyer 2 buys
3. Bot still waiting → External buyers sell
4. Bot resumes → Continues buying
```

**Duration:** ~3-5 minutes  
**Success Criteria:** Bot handles multiple external buyers

---

## Monitoring & Verification

### Real-Time Monitoring

**Console Logs:**
```bash
# Run bot and monitor output
npm run dev

# Look for key indicators:
# - "Executing buy with wallet X"
# - "Buy executed successfully"
# - "External buyer detected"
# - "Timeout reached"
# - "Sell executed successfully"
```

**Solana Explorer:**
- Monitor transactions: `https://solscan.io/`
- Check wallet balances
- Verify transaction confirmations
- Check token balances

**Key Metrics to Monitor:**
- Transaction success rate
- Time between transactions
- Queue lengths (buyQueue, sellQueue)
- Error frequency
- State transitions

---

### Verification Checklist

After each test, verify:

- [ ] All expected transactions executed
- [ ] Transaction signatures are valid
- [ ] Token balances updated correctly
- [ ] SOL balances updated correctly
- [ ] No unexpected errors
- [ ] State transitions correct
- [ ] Queue management correct
- [ ] Logs match expected behavior

---

## Troubleshooting

### Common Issues

#### Issue 1: "No wallets available for buying"
**Cause:** buyQueue is empty  
**Solution:**
- Check if wallets have sold
- Verify resetTradingState is called
- Check walletActions map

#### Issue 2: "Bonding curve account not found"
**Cause:** Invalid token mint address  
**Solution:**
- Verify TOKEN_MINT_ADDRESS in .env
- Check token exists on network
- Verify bonding curve is initialized

#### Issue 3: "Insufficient balance"
**Cause:** Wallet doesn't have enough SOL  
**Solution:**
- Fund wallets: `fundWallets()`
- Check fundingAmountSol is sufficient
- Verify funding wallet has SOL

#### Issue 4: "Transaction failed"
**Cause:** Network issues or invalid transaction  
**Solution:**
- Check RPC endpoint
- Verify network connectivity
- Check transaction on explorer
- Review error logs

#### Issue 5: Bot stuck in waiting mode
**Cause:** External buyer detection not clearing  
**Solution:**
- Check hasSomeoneBought logic
- Verify external buyer actually sold
- Check timeout is working
- Manually trigger sell if needed

#### Issue 6: Rate limiting errors
**Cause:** Too many requests to RPC  
**Solution:**
- Increase delays (sleep times)
- Use private RPC endpoint
- Reduce number of wallets
- Check RPC rate limits

---

### Debug Mode

Enable detailed logging:

```typescript
// In TradingEngine.ts, add more Logger.debug() calls
Logger.debug(`Current state:`, {
  buyQueue,
  sellQueue,
  isWaiting,
  isBuying,
  walletActions: Array.from(state.walletActions.entries())
});
```

---

## Test Results Template

Use this template to document test results:

```markdown
## Test Results - [Date]

### Test 1: Sequential Buying
- **Status:** ✅ Pass / ❌ Fail
- **Duration:** X minutes
- **Transactions:** 10/10 successful
- **Issues:** None / [List issues]
- **Notes:** [Additional notes]

### Test 2: External Buyer Detection
- **Status:** ✅ Pass / ❌ Fail
- **Detection Time:** X seconds
- **State Transition:** Correct / Incorrect
- **Issues:** None / [List issues]
- **Notes:** [Additional notes]

### Test 3: Wait Timeout
- **Status:** ✅ Pass / ❌ Fail
- **Timeout Duration:** X seconds (expected: 20s)
- **Selling Started:** Yes / No
- **Issues:** None / [List issues]
- **Notes:** [Additional notes]

### Overall Assessment
- **Total Tests:** X/Y passed
- **Critical Issues:** [List]
- **Recommendations:** [List]
```

---

## Quick Reference

### Key Commands
```bash
# Start bot
npm run dev

# Build project
npm run build

# Check wallet balances (custom script)
node check-balances.js

# Monitor transactions
# Use Solana Explorer or custom monitoring tool
```

### Key Files
- `src/engine/TradingEngine.ts` - Main trading logic
- `src/config/index.ts` - Configuration
- `src/monitor/MarketMonitor.ts` - Market monitoring
- `wallets.json` - Wallet storage
- `.env` - Environment variables

### Key Functions to Test
- `startTradingEngine()` - Main entry point
- `executeBuy()` - Buy execution
- `executeSell()` - Sell execution
- `tradingLoop()` - Main loop
- `resetTradingState()` - State reset

---

## Next Steps

After completing tests:

1. **Document Results:** Fill out test results template
2. **Report Issues:** Create issues for any bugs found
3. **Optimize:** Adjust delays, timeouts based on results
4. **Scale Testing:** Test with more wallets, different scenarios
5. **Production Readiness:** Verify all critical paths work

---

## Support

If you encounter issues:
1. Check logs for error messages
2. Verify environment setup
3. Review troubleshooting section
4. Check Solana network status
5. Verify RPC endpoint is working

For additional help, refer to:
- `TEST_CASES.md` - Detailed test cases
- `README.md` - Project documentation
- `ARCHITECTURE.md` - System architecture
