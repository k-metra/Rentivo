import { describe, expect, it } from 'vitest'
import { bookingDateTime, parseBookingDateTime } from './dashboardUtils'

describe('booking date formatting', () => {
  it('returns an em dash for missing payment dates', () => {
    expect(bookingDateTime(undefined)).toBe('—')
    expect(bookingDateTime(null)).toBe('—')
  })

  it('returns an invalid Date instead of throwing for missing values', () => {
    expect(Number.isNaN(parseBookingDateTime(undefined).getTime())).toBe(true)
  })

  it('preserves wall-clock date and time parsing', () => {
    const date = parseBookingDateTime('2026-11-22T08:30:00')
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(10)
    expect(date.getDate()).toBe(22)
  })
})
