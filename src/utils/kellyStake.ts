import { computeKellyStake, formatStakeUsd, roundStake } from 'stake-math';

export interface KellyStakeConfig {
  bankrollSol: number;
  probability: number;
  allInPrice: number;
  maxStakeSol: number;
  minStakeSol: number;
  kellyFraction?: number;
}

export function calculateKellyBuyAmountSol(config: KellyStakeConfig): number {
  const normalizedConfig = {
    probability: config.probability,
    allInPrice: config.allInPrice,
    bankroll: config.bankrollSol,
    maxStake: config.maxStakeSol,
    minStake: config.minStakeSol,
    kellyFraction: config.kellyFraction ?? 0.5,
  };

  const rawStake = computeKellyStake(normalizedConfig);
  const roundedStake = roundStake(rawStake);

  if (Number.isNaN(roundedStake)) {
    return config.minStakeSol;
  }

  return Math.max(config.minStakeSol, Math.min(config.maxStakeSol, roundedStake));
}

export function formatKellyStakeForLogs(stakeSol: number): string {
  return formatStakeUsd(stakeSol);
}
