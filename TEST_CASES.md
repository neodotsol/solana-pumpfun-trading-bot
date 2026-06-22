# Trading Bot Test Cases

This document outlines comprehensive test cases for the Solana Trading Bot.

## Test Categories

### 1. Unit Tests (Component Level)

#### 1.1 Queue Management Tests
- **Test**: Buy queue initialization
  - **Input**: 10 wallets
  - **Expected**: buyQueue = [0,1,2,3,4,5,6,7,8,9]
  
- **Test**: Wallet removal from buy queue after successful buy
  - **Input**: buyQueue = [0,1,2], wallet 0 buys successfully
  - **Expected**: buyQueue = [1,2], sellQueue = [0]
  
- **Test**: Wallet retry after failed buy
  - **Input**: buyQueue = [0,1,2], wallet 0 buy fails
  - **Expected**: buyQueue = [1,2,0] (wallet pushed to end)

#### 1.2 State Management Tests
- **Test**: State reset after sell
  - **Input**: walletActions = {0: 'sell', 1: 'buy'}
  - **Expected**: After reset, wallet 0 in buyQueue, wallet 1 not in buyQueue

- **Test**: External buyer detection state change
  - **Input**: isBuying = true, external buyer detected
  - **Expected**: isWaiting = true, isBuying = false

### 2. Integration Tests (Flow Level)

#### 2.1 Sequential Buying Flow
```
Test Case: 10 wallets buy sequentially
Steps:
1. Initialize with 10 wallets
2. Start trading engine
3. Verify: Wallet 0 buys first
4. Verify: Wallet 1 buys second
5. Continue until all wallets bought
6. Verify: sellQueue contains all 10 wallets in order

Expected Result:
- buyQueue: [0,1,2,3,4,5,6,7,8,9] → []
- sellQueue: [] → [0,1,2,3,4,5,6,7,8,9]
- Each buy has 500ms delay
- All transactions succeed
```

#### 2.2 External Buyer Detection Flow
```
Test Case: External buyer interrupts buying
Steps:
1. Bot is buying with wallet 0
2. External buyer buys token
3. Verify: Bot detects external buyer
4. Verify: Bot enters waiting mode
5. Verify: buyQueue preserved
6. Verify: lastBuyerTimestamp set

Expected Result:
- isWaiting = true
- isBuying = false
- buyQueue unchanged
- Bot waits for external buyer to sell
```

#### 2.3 Wait Timeout Flow
```
Test Case: External buyer doesn't sell within timeout
Steps:
1. Bot enters waiting mode
2. Wait 20 seconds (waitTimeoutMs)
3. External buyer still hasn't sold
4. Verify: Bot starts selling
5. Verify: Sells in LIFO order

Expected Result:
- After 20s timeout, isWaiting = false
- Bot starts selling from sellQueue
- Last wallet to buy sells first
```

#### 2.4 External Buyer Sells Early Flow
```
Test Case: External buyer sells before timeout
Steps:
1. Bot enters waiting mode
2. External buyer sells after 5 seconds
3. Verify: Bot detects external buyer sold
4. Verify: Bot resumes buying immediately
5. Verify: Wallets that sold are back in buyQueue

Expected Result:
- Bot detects someoneSold = true
- resetTradingState called
- Wallets with action='sell' added to buyQueue
- Bot resumes buying
```

#### 2.5 LIFO Selling Flow
```
Test Case: Sell in Last-In-First-Out order
Steps:
1. 3 wallets buy: [0, 1, 2]
2. sellQueue = [0, 1, 2]
3. Start selling
4. Verify: Wallet 2 sells first (last bought)
5. Verify: Wallet 1 sells second
6. Verify: Wallet 0 sells last

Expected Result:
- sellQueue.pop() removes last element first
- Selling order: 2 → 1 → 0
```

### 3. Edge Case Tests

#### 3.1 Empty Queue Handling
```
Test Case: Empty buy queue
Input: buyQueue = []
Expected: 
- Logger.warn('No wallets available for buying')
- Function returns without error
- No buy attempt made
```

#### 3.2 No Tokens to Sell
```
Test Case: Wallet has no tokens
Input: Token balance = 0
Expected:
- Error: 'No tokens to sell'
- Wallet removed from sellQueue
- Bot continues with next wallet
```

#### 3.3 Buy Failure Recovery
```
Test Case: Buy transaction fails
Input: Network error or insufficient balance
Expected:
- Error logged
- Wallet added back to end of buyQueue
- Next wallet in queue tries
- Failed wallet retries later
```

#### 3.4 Concurrent Buy Prevention
```
Test Case: Someone buys during buy preparation
Input: hasSomeoneBought returns true right before executing
Expected:
- Buy aborted
- Wallet unshifted back to front of queue
- isWaiting set to true
- No transaction sent
```

#### 3.5 All Wallets Sold Reset
```
Test Case: All wallets sold, no external buyer
Input: All walletActions = 'sell', sellQueue = []
Expected:
- resetTradingState called
- All wallets added back to buyQueue
- Bot starts buying again
```

### 4. Error Handling Tests

#### 4.1 Network Errors
```
Test Case: RPC connection fails
Input: Connection error during buy
Expected:
- Error caught and logged
- Wallet retried
- Bot continues operation
```

#### 4.2 Transaction Failures
```
Test Case: Transaction fails to confirm
Input: Transaction sent but not confirmed
Expected:
- Error thrown
- Wallet retried
- No state corruption
```

#### 4.3 SDK Errors
```
Test Case: SDK method throws error
Input: getBondingCurveAccount returns null
Expected:
- Error: 'Bonding curve account not found'
- Transaction not attempted
- Error logged
```

### 5. Performance Tests

#### 5.1 Rate Limiting
```
Test Case: Verify delays prevent rate limiting
Input: Multiple rapid operations
Expected:
- 500ms delay between buys
- 500ms delay between sells
- 1000ms delay in main loop
- No RPC rate limit errors
```

#### 5.2 Queue Efficiency
```
Test Case: Large number of wallets
Input: 100 wallets
Expected:
- Queue operations efficient
- No memory leaks
- State maintained correctly
```

### 6. Manual Test Scenarios

#### Scenario 1: Happy Path
```
1. Start bot with 10 wallets
2. All wallets buy tokens (0.1 SOL each)
3. External buyer buys token
4. Bot waits 20 seconds
5. External buyer sells
6. Bot resumes buying
7. All wallets sell
8. Bot resets and starts again
```

#### Scenario 2: Timeout Path
```
1. Bot buys with all wallets
2. External buyer buys
3. Bot waits
4. External buyer doesn't sell (wait 25 seconds)
5. Bot times out and starts selling
6. All wallets sell (LIFO)
7. Bot resets
```

#### Scenario 3: Error Recovery
```
1. One wallet has insufficient balance
2. Bot tries to buy with that wallet
3. Buy fails
4. Bot continues with other wallets
5. Failed wallet retries later
6. Eventually succeeds or gets skipped
```

#### Scenario 4: Rapid External Buyers
```
1. Bot is buying
2. Multiple external buyers buy rapidly
3. Bot pauses and waits
4. External buyers sell
5. Bot resumes buying
```

#### Scenario 5: Partial Sell
```
1. Bot buys with all wallets
2. External buyer buys
3. Bot starts selling (3 wallets sold)
4. External buyer sells mid-way
5. Bot resumes buying with remaining 7 wallets
```

## Test Execution Guide

### Prerequisites
1. Set up test environment variables
2. Fund test wallets
3. Deploy test token
4. Configure RPC endpoint

### Running Tests

#### Unit Tests (if Jest configured)
```bash
npm test
```

#### Manual Testing
1. Set `TOKEN_MINT_ADDRESS` in `.env`
2. Ensure wallets are funded
3. Run: `npm run dev`
4. Monitor logs for expected behavior
5. Verify transactions on Solana explorer

### Expected Logs

#### Successful Buy
```
Executing buy with wallet 0 (AbCdEfGh...)
Buy executed successfully. Signature: <tx-signature>
```

#### External Buyer Detected
```
External buyer detected! Pausing buying and entering wait mode...
```

#### Wait Timeout
```
Timeout reached. External buyer did not sell. Starting to sell...
```

#### Resume Buying
```
External buyer sold within timeout! Resuming buying...
Resetting trading state...
```

## Test Data Requirements

### Wallet Setup
- 10 test wallets
- Each wallet funded with 0.22 SOL minimum
- Wallets stored in `wallets.json`

### Token Setup
- Test token deployed on devnet/mainnet
- Token mint address configured
- Bonding curve initialized

### Environment Variables
```env
RPC_URL=https://api.devnet.solana.com
TOKEN_MINT_ADDRESS=<your-token-mint>
FUNDING_WALLET_PRIVATE_KEY=<funding-wallet-key>
BUY_AMOUNT_SOL=0.1
SLIPPAGE_BPS=50
WAIT_TIMEOUT_MS=20000
NUM_WALLETS=10
```

## Success Criteria

### Functional Requirements
- ✅ All wallets buy sequentially
- ✅ External buyer detection works
- ✅ Wait timeout triggers selling
- ✅ LIFO selling order maintained
- ✅ State resets correctly
- ✅ Error handling works

### Non-Functional Requirements
- ✅ No rate limiting errors
- ✅ No memory leaks
- ✅ Graceful error recovery
- ✅ Logging is informative
- ✅ Performance acceptable

## Known Issues & Limitations

1. **Balance Checking**: Currently no balance check before buy (could add)
2. **Partial Sells**: Currently sells all tokens (could implement partial)
3. **Rate Limiting**: Fixed delays may need adjustment based on RPC
4. **Error Recovery**: Some errors may need manual intervention

## Future Test Improvements

1. Add automated unit tests with mocks
2. Add integration tests with testnet
3. Add performance benchmarks
4. Add stress tests with many wallets
5. Add chaos engineering tests
