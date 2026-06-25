# Test cases for developers and traders

This file turns the bot behavior into a practical checklist. Use it to confirm that the trading flow is working as expected before running larger live trades.

## 1. Core smoke tests

### A. Bot starts correctly
- Start the bot with a valid `.env` file.
- Expected result: the bot logs that it connected to the RPC and begins loading wallets.

### B. Wallets load and fund
- Make sure the wallets are created or loaded successfully.
- Expected result: wallet balances are available and the engine can begin trading.

### C. Buy flow runs
- Start the bot with a token mint configured.
- Expected result: one wallet executes a buy, the buy queue advances, and the sell queue grows.

## 2. Kelly sizing tests

### A. Kelly stake is computed
- Use the sample values from the config.
- Expected result: the bot logs the calculated stake amount and keeps it within the min/max limits.

### B. Max stake cap is respected
- Set a high probability and a large bankroll.
- Expected result: the computed stake does not exceed the configured maximum.

### C. Minimum stake floor is respected
- Use a low-probability setup or a small bankroll.
- Expected result: the calculated stake does not fall below the configured minimum.

## 3. Market reaction tests

### A. No external buyer
- Let the bot run without another buyer entering the market.
- Expected result: the bot continues buying in sequence.

### B. External buyer appears
- Buy the token manually from another wallet while the bot is trading.
- Expected result: the bot pauses buying and enters a wait state.

### C. External buyer leaves quickly
- Let the buyer sell soon after entering.
- Expected result: the bot resumes buying without waiting for the full timeout.

### D. External buyer stays longer
- Leave the buyer in place for longer than the configured wait timeout.
- Expected result: the bot begins selling from the most recently bought wallet first.

## 4. Sell-flow tests

### A. LIFO selling order
- Confirm that the last wallet that bought sells first.
- Expected result: the sell order is reversed relative to the buy order.

### B. Empty sell queue
- Run the sell path when there are no wallets left to sell.
- Expected result: the bot resets and prepares to buy again if the market conditions allow it.

### C. Wallet has no tokens to sell
- Simulate a wallet without the expected token balance.
- Expected result: the bot logs the failure and proceeds safely.

## 5. Error handling tests

### A. RPC failure
- Force a bad RPC endpoint or temporary network issue.
- Expected result: the bot logs the error and does not corrupt its queue state.

### B. Buy transaction fails
- Use a wallet with too little SOL or an invalid mint.
- Expected result: the bot logs the error and retries later.

### C. Sell transaction fails
- Use a wallet with no tokens or a temporary account issue.
- Expected result: the bot logs the failure and continues carefully.

## 6. Trader-focused checklist

For traders, the most important questions are:
- Did the bot buy at the expected size?
- Did it pause when another buyer appeared?
- Did it avoid a risky over-size trade?
- Did it exit or reset in a controlled way after the trade cycle?

## 7. Recommended test order

1. Start with a dry run using small funds.
2. Validate Kelly sizing.
3. Verify buy flow.
4. Verify wait flow.
5. Verify sell flow.
6. Review logs and transaction hashes.

## 8. Useful log signs

Look for these log messages:
- buy started and buy completed,
- Kelly stake calculated,
- external buyer detected,
- wait timeout reached,
- sell completed,
- reset trading state.
