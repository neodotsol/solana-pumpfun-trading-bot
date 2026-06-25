# Testing guide

This guide is meant to be practical. If you are a developer, it helps you verify the code path. If you are a trader, it helps you understand what the bot should do in real market conditions.

## 1. Before you start

### Required software
- Node.js 18 or newer
- npm
- Git

### Required setup
- A valid Solana RPC endpoint
- A funded wallet key
- A token mint address
- A small amount of SOL for testing

## 2. Install and build

```bash
npm install
npm run build
```

If the build fails, fix the issue before running the bot.

## 3. Configure the environment

Create a `.env` file with the values you need:

```env
RPC_URL=https://api.mainnet-beta.solana.com
FUNDING_WALLET_PRIVATE_KEY=your_private_key_here
TOKEN_MINT_ADDRESS=your_token_mint_here
SLIPPAGE_BPS=50
WAIT_TIMEOUT_MS=20000
NUM_WALLETS=10

KELLY_BANKROLL_SOL=500
KELLY_PROBABILITY=0.58
KELLY_ALL_IN_PRICE=0.52
KELLY_MAX_STAKE_SOL=25
KELLY_MIN_STAKE_SOL=5
KELLY_FRACTION=0.5
```

## 4. Run the bot

```bash
npm run dev
```

You should see logs showing that the bot is connecting, loading wallets, and beginning the trading cycle.

## 5. Run the Kelly sizing test

A simple regression test for the Kelly helper is included:

```bash
npx tsx --test src/__tests__/kellyStake.test.ts
```

This confirms that the stake size follows the expected cap and floor behavior.

## 6. Manual test flow

### Test 1: Basic buy cycle
1. Start the bot.
2. Watch the logs.
3. Confirm that one wallet buys and the buy queue progresses.

Expected result:
- The bot submits a buy.
- The wallet is moved to the sell queue.
- The logs show the buy completed successfully.

### Test 2: Market pause
1. Start the bot.
2. Buy the same token from another wallet while the bot is active.
3. Watch for the bot to pause buying.

Expected result:
- The bot stops buying temporarily.
- The waiting state is logged.

### Test 3: Sell after waiting
1. Leave the external buyer in place longer than the wait timeout.
2. Check the logs.

Expected result:
- The bot begins selling from the last wallet that bought first.

### Test 4: Resume after buyer exits
1. Let the external buyer sell quickly.
2. Watch the bot resume the cycle.

Expected result:
- The bot exits waiting mode and starts buying again.

## 7. What to watch in the logs

Useful signals:
- Kelly stake calculated
- buy completed
- external buyer detected
- wait timeout reached
- sell completed
- resetting trading state

## 8. Troubleshooting

### The bot does not start
- Check the `.env` variables.
- Make sure the RPC endpoint is reachable.
- Re-run the build.

### The bot buys too aggressively
- Lower the Kelly max stake.
- Lower the bankroll or adjust the probability assumptions.

### The bot does not sell
- Confirm the wallet actually holds tokens.
- Check whether the wait timeout is too long or too short for your setup.
- Review the logs for state transitions.

## 9. Good practice for traders

- Start with low risk.
- Test on a small scale before increasing size.
- Keep an eye on slippage and wallet balances.
- Treat the bot as a tool, not as a guarantee of profit.

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
