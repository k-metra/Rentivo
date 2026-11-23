export function parseBookingDateTime(value: string | null | undefined) {
  if (!value || typeof value !== 'string') return new Date(NaN)
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/)
  if (!match) {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? new Date(NaN) : date
  }
  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
  )
}

export function bookingDatePart(value: string | null | undefined) {
  const date = parseBookingDateTime(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function bookingTimePart(value: string | null | undefined) {
  const date = parseBookingDateTime(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function bookingDateTime(value: string | null | undefined) {
  const datePart = bookingDatePart(value)
  if (datePart === '—') return '—'
  const timePart = bookingTimePart(value)
  return `${datePart}${timePart ? ` ${timePart}` : ''}`
}

export function isToday(value: string) {
  const date = parseBookingDateTime(value)
  const today = new Date()
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate()
}

export function rentalDurationLabel(start: string, end: string) {
  const durationHours = Math.max(
    0,
    Math.ceil(
      (parseBookingDateTime(end).getTime() - parseBookingDateTime(start).getTime()) / 3600000,
    ),
  )
  const days = Math.floor(durationHours / 24)
  const hours = durationHours % 24
  const parts: string[] = []
  if (days > 0) parts.push(`${days} ${days === 1 ? 'day' : 'days'}`)
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`)
  return parts.join(' ') || '0 hours'
}

export function bookingStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: 'Pending',
    confirmed: 'Upcoming',
    upcoming: 'Upcoming',
    pre_inspection: 'For pre-inspection',
    active: 'Ongoing',
    ongoing: 'Ongoing',
    complete: 'Complete',
    completed: 'Complete',
    cancelled: 'Cancelled',
    rejected: 'Rejected',
  }
  return labels[status]
    ?? status.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase())
}

export function vehicleBookingLabel(vehicle?: {
  name?: string
  brand: string
  model: string
  year?: number
}) {
  if (!vehicle) return 'Vehicle unavailable'
  const brandModelYear = [vehicle.brand, vehicle.model, vehicle.year]
    .filter(Boolean)
    .join(' ')
  return vehicle.name ? `${vehicle.name} (${brandModelYear})` : brandModelYear
}
