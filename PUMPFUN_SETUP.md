# PumpFun Integration Setup

## Important Notes

The current implementation includes placeholder functions for PumpFun buy/sell/create instructions. To make this fully functional, you need to:

1. **Obtain PumpFun IDL**: Get the official PumpFun program IDL (Interface Definition Language) from:
   - PumpFun's official documentation
   - SolanaFM or other Solana explorers
   - PumpFun's GitHub repository (if available)

2. **Update Instruction Builders**: Replace the placeholder `buildBuyInstruction`, `buildSellInstruction`, and `buildCreateInstruction` methods in:
   - `src/dex/PumpFunClient.ts`
   - `src/token/PumpFunTokenDeployer.ts`

## Implementation Example

Once you have the IDL, you can use Anchor to build instructions:

```typescript
import { Program, AnchorProvider, Idl } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';

// Load IDL (you'll need to save it as a JSON file)
import pumpfunIdl from './pumpfun-idl.json';

// Create program instance
const program = new Program(
  pumpfunIdl as Idl,
  new PublicKey(config.pumpfunProgramId),
  provider
);

// Build buy instruction
const buyIx = await program.methods
  .buy({
    amountSol: new BN(amountLamports),
    minTokensOut: new BN(minTokensOut),
  })
  .accounts({
    globalConfig: globalConfigPDA,
    feeRecipient: feeRecipient,
    mint: mint,
    bondingCurve: bondingCurvePDA,
    userTokenAccount: userTokenAccount,
    payer: payer,
    systemProgram: SystemProgram.programId,
    tokenProgram: TOKEN_PROGRAM_ID,
    eventAuthority: eventAuthorityPDA,
    // ... other required accounts
  })
  .instruction();
```

## Program ID

- **Mainnet**: `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`

**Note**: This bot is configured for mainnet only.

## Resources

- PumpFun Documentation: Check PumpFun's official website/docs
- Solana Stack Exchange: Search for PumpFun program IDs and instructions
- Anchor Documentation: https://www.anchor-lang.com/
