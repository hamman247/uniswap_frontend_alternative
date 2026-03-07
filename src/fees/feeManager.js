/**
 * Fee Manager — 5 basis point fee on every swap
 */
import { FEE_CONFIG } from '../config/contracts.js';

const BPS_DENOMINATOR = 10000n;

export class FeeManager {
    constructor() {
        this.feeBps = BigInt(FEE_CONFIG.feeBps);
        this.feeRecipient = FEE_CONFIG.feeRecipient;
    }

    /**
     * Calculate the fee amount from an input amount
     * @param {bigint} amountIn — raw token amount (wei)
     * @returns {{ fee: bigint, amountAfterFee: bigint }}
     */
    calculateFee(amountIn) {
        const fee = (amountIn * this.feeBps) / BPS_DENOMINATOR;
        const amountAfterFee = amountIn - fee;
        return { fee, amountAfterFee };
    }

    /**
     * Calculate fee from a human-readable number
     * @param {number} amount
     * @param {number} decimals
     * @returns {{ feeHuman: number, amountAfterFeeHuman: number, feeBps: number }}
     */
    calculateFeeHuman(amount, decimals) {
        const feeRate = Number(this.feeBps) / Number(BPS_DENOMINATOR);
        const feeHuman = amount * feeRate;
        const amountAfterFeeHuman = amount - feeHuman;
        return {
            feeHuman,
            amountAfterFeeHuman,
            feeBps: Number(this.feeBps),
        };
    }

    /**
     * Return the fee rate as a percentage string
     */
    getFeePercentage() {
        return `${(Number(this.feeBps) / 100).toFixed(2)}%`;
    }

    /**
     * Return a static description
     */
    getFeeDescription() {
        return `${this.feeBps} bps (${this.getFeePercentage()}) interface fee`;
    }
}

export const feeManager = new FeeManager();
