import { describe, expect, it } from 'vitest'
import { calculateBookingFeeSummary } from './BookingModal'

const vehicle = {
  id: 1,
  brand: 'Toyota',
  model: 'Vios',
  year: 2026,
  plate_number: 'ABC 123',
  type: 'Sedan',
  daily_rate: 3000,
  hourly_extension_rate: 250,
  rental_rates: [
    { duration_hours: 12, amount: 1500 },
    { duration_hours: 24, amount: 3000 },
  ],
}

describe('calculateBookingFeeSummary', () => {
  it('charges 24 hours plus a 12-hour remainder as the 12-hour tier', () => {
    const summary = calculateBookingFeeSummary(
      vehicle,
      new Date('2026-11-22T08:00:00'),
      new Date('2026-11-23T20:00:00'),
      '08:00',
      '20:00',
      '',
      false,
      '',
      '0',
    )

    expect(summary.rental).toBe(4500)
    expect(summary.breakdown).toEqual([
      { label: '1 × 24-hour rate', amount: 3000 },
      { label: '1 × 12-hour remainder', amount: 1500 },
    ])
  })

  it('charges 24 hours plus 12 hours plus 1 hour as 24 hours, 12 hours, and hourly extension', () => {
    const summary = calculateBookingFeeSummary(
      vehicle,
      new Date('2026-11-22T08:00:00'),
      new Date('2026-11-23T21:00:00'),
      '08:00',
      '21:00',
      '',
      false,
      '',
      '0',
    )

    expect(summary.rental).toBe(4750)
  })
})
