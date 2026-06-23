import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getPenaltyRateForDuration,
  computeBondSlashBreakdown,
  getPenaltyRate,
  computeWithdrawBreakdown,
  calcUnlockDate,
} from './bondPenalty'
import type { MockBond, BondStatus } from './bondPenalty'

describe('bondPenalty core helper tests', () => {
  describe('getPenaltyRateForDuration', () => {
    it('returns correct rates for standard tiers', () => {
      expect(getPenaltyRateForDuration(30)).toBe(0.2)
      expect(getPenaltyRateForDuration(90)).toBe(0.15)
      expect(getPenaltyRateForDuration(180)).toBe(0.1)
    })

    it('returns default rate for custom or unknown tiers', () => {
      expect(getPenaltyRateForDuration(45)).toBe(0.2)
      expect(getPenaltyRateForDuration(0)).toBe(0.2)
      expect(getPenaltyRateForDuration(-10)).toBe(0.2)
    })
  })

  describe('computeBondSlashBreakdown', () => {
    it('computes breakdown for 30-day lock correctly', () => {
      const breakdown = computeBondSlashBreakdown(1000, 30)
      expect(breakdown.bondAmount).toBe('1,000 USDC')
      expect(breakdown.penaltyPercent).toBe(20)
      expect(breakdown.penaltyAmount).toBe('200 USDC')
      expect(breakdown.resultingBalance).toBe('800 USDC')
      expect(breakdown.penaltyUsdc).toBe(200)
      expect(breakdown.resultingUsdc).toBe(800)
    })

    it('computes breakdown for 90-day lock correctly', () => {
      const breakdown = computeBondSlashBreakdown(1000, 90)
      expect(breakdown.bondAmount).toBe('1,000 USDC')
      expect(breakdown.penaltyPercent).toBe(15)
      expect(breakdown.penaltyAmount).toBe('150 USDC')
      expect(breakdown.resultingBalance).toBe('850 USDC')
      expect(breakdown.penaltyUsdc).toBe(150)
      expect(breakdown.resultingUsdc).toBe(850)
    })

    it('computes breakdown for 180-day lock correctly', () => {
      const breakdown = computeBondSlashBreakdown(500, 180)
      expect(breakdown.bondAmount).toBe('500 USDC')
      expect(breakdown.penaltyPercent).toBe(10)
      expect(breakdown.penaltyAmount).toBe('50 USDC')
      expect(breakdown.resultingBalance).toBe('450 USDC')
      expect(breakdown.penaltyUsdc).toBe(50)
      expect(breakdown.resultingUsdc).toBe(450)
    })
  })

  describe('getPenaltyRate', () => {
    it('returns correct rates depending on the status', () => {
      expect(getPenaltyRate('locked')).toBe(0.2)
      expect(getPenaltyRate('grace-period')).toBe(0.1)
      expect(getPenaltyRate('active')).toBe(0)
    })

    it('returns 0 for unknown statuses as fallback', () => {
      expect(getPenaltyRate('unknown' as unknown as BondStatus)).toBe(0)
    })
  })

  describe('computeWithdrawBreakdown', () => {
    it('computes zero-penalty breakdown for active bond', () => {
      const bond: MockBond = { id: 1, amountUsdc: 1000, status: 'active' }
      const breakdown = computeWithdrawBreakdown(bond)
      expect(breakdown.bondAmount).toBe('1,000 USDC')
      expect(breakdown.penaltyPercent).toBe(0)
      expect(breakdown.penaltyAmount).toBe('0 USDC')
      expect(breakdown.resultingBalance).toBe('1,000 USDC')
      expect(breakdown.penaltyUsdc).toBe(0)
    })

    it('computes 10% penalty for grace-period bond', () => {
      const bond: MockBond = { id: 2, amountUsdc: 500, status: 'grace-period' }
      const breakdown = computeWithdrawBreakdown(bond)
      expect(breakdown.bondAmount).toBe('500 USDC')
      expect(breakdown.penaltyPercent).toBe(10)
      expect(breakdown.penaltyAmount).toBe('50 USDC')
      expect(breakdown.resultingBalance).toBe('450 USDC')
      expect(breakdown.penaltyUsdc).toBe(50)
    })

    it('computes 20% penalty for locked bond', () => {
      const bond: MockBond = { id: 3, amountUsdc: 2500, status: 'locked' }
      const breakdown = computeWithdrawBreakdown(bond)
      expect(breakdown.bondAmount).toBe('2,500 USDC')
      expect(breakdown.penaltyPercent).toBe(20)
      expect(breakdown.penaltyAmount).toBe('500 USDC')
      expect(breakdown.resultingBalance).toBe('2,000 USDC')
      expect(breakdown.penaltyUsdc).toBe(500)
    })
  })

  describe('calcUnlockDate', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      // Fix date to Jun 23, 2026
      const systemTime = new Date('2026-06-23T12:00:00Z')
      vi.setSystemTime(systemTime)
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('returns correctly offset locale-formatted unlock date', () => {
      const result = calcUnlockDate(30)
      const expected = new Date(new Date('2026-06-23T12:00:00Z').getTime() + 30 * 24 * 60 * 60 * 1000)
      const expectedStr = expected.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
      expect(result).toBe(expectedStr)
    })
  })
})
