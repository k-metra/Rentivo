import { describe, expect, it } from 'vitest'
import { getPageTitle } from './pageTitle'

describe('getPageTitle', () => {
  it('uses the Rentivo brand for the home page and auth states', () => {
    expect(getPageTitle('/')).toBe('Rentivo | Vehicle Rental Management')
    expect(getPageTitle('/', '?signin=1')).toBe('Sign In | Rentivo')
    expect(getPageTitle('/', '?signup=1')).toBe('Create Account | Rentivo')
  })

  it('uses the current dashboard section', () => {
    expect(getPageTitle('/dashboard')).toBe('Overview | Rentivo')
    expect(getPageTitle('/dashboard/booking-requests')).toBe('Booking Requests | Rentivo')
    expect(getPageTitle('/dashboard/booking-requests/')).toBe('Booking Requests | Rentivo')
    expect(getPageTitle('/dashboard/settings')).toBe('Settings | Rentivo')
  })

  it('names public booking and account pages', () => {
    expect(getPageTitle('/booking/acme')).toBe('Book a Vehicle | Rentivo')
    expect(getPageTitle('/booking/acme/my-bookings')).toBe('My Bookings | Rentivo')
    expect(getPageTitle('/booking/acme/vehicles/3')).toBe('Vehicle Details | Rentivo')
    expect(getPageTitle('/contract/token')).toBe('Rental Contract | Rentivo')
  })
})
