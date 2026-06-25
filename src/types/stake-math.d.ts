declare module 'stake-math' {
  export function computeKellyStake(params: {
    probability: number;
    allInPrice: number;
    bankroll: number;
    maxStake: number;
    minStake: number;
    kellyFraction?: number;
  }): number;

  export function formatStakeUsd(amount: number): string;
  export function roundStake(amount: number): number;
}
