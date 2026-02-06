/**
 * Calculates the maturity percentage based on a raw score.
 * Formula: Math.round(rawScore / 20)
 * Assuming raw score is in range 0-2000 and percentage 0-100.
 */
export function calculateMaturityPercentage(rawScore: number | null | undefined): number {
    if (!rawScore) return 0;
    return Math.round(Number(rawScore));
}
