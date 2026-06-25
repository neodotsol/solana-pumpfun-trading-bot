import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculateKellyBuyAmountSol } from '../utils/kellyStake';

describe('calculateKellyBuyAmountSol', () => {
  it('caps the stake at the configured max stake when the Kelly result exceeds it', () => {
    const stake = calculateKellyBuyAmountSol({
      bankrollSol: 500,
      probability: 0.58,
      allInPrice: 0.52,
      maxStakeSol: 25,
      minStakeSol: 5,
      kellyFraction: 0.5,
    });

    assert.equal(stake, 25);
  });
});
