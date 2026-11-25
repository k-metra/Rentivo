import { motion, useReducedMotion } from 'framer-motion'
import { useMemo, useState, type ReactNode } from 'react'
import { bookingDateTime, parseBookingDateTime, vehicleBookingLabel } from './dashboardUtils'
import { DashboardIcon } from './DashboardIcon'
import { useSubscriptionReadOnly } from './SubscriptionReadOnlyContext'

type Booking = {
  id: number
  reference: string
  pickup_at: string
  return_at: string
  status: string
  total_amount: number | string
  payments?: Array<{ status: string; amount: number | string }>
  customer?: { id?: number; name: string }
  vehicle?: {
    id?: number
    name?: string
    brand: string
    model: string
    year?: number
    plate_number: string
    image_path?: string
    image_url?: string
  }
}

type Vehicle = {
  id: number
  name?: string
  brand: string
  model: string
  year: number
  plate_number: string
  status: string
  image_path?: string
  image_url?: string
}

type Props = {
  bookings: Booking[]
  vehicles: Vehicle[]
  getVehicleImageUrl: (vehicle: Vehicle | Booking['vehicle']) => string
  onOpenBooking: (booking: Booking) => void
  onEditBooking: (booking: Booking) => void
  onOpenVehicles: () => void
}

const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 2,
})

const pageSize = 5

function localDateValue(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function addDays(value: string, amount: number) {
  const date = new Date(`${value}T12:00:00`)
  date.setDate(date.getDate() + amount)
  return localDateValue(date)
}

function dateLabel(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-PH', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function sameDay(value: string, day: string) {
  const storedDate = value.match(/^(\d{4}-\d{2}-\d{2})/)
  if (storedDate) return storedDate[1] === day
  return localDateValue(parseBookingDateTime(value)) === day
}

function SectionCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`overflow-hidden rounded-xl border border-[#2c0f73]/10 bg-white ${className}`}>{children}</section>
}

function BookingList({
  title,
  description,
  bookings,
  emptyMessage,
  getVehicleImageUrl,
  onOpenBooking,
}: {
  title: string
  description: string
  bookings: Booking[]
  emptyMessage: string
  getVehicleImageUrl: Props['getVehicleImageUrl']
  onOpenBooking: (booking: Booking) => void
}) {
  return (
    <SectionCard>
      <div className="flex items-start justify-between gap-4 border-b border-[#eeeaf3] p-5">
        <div><h2 className="text-xl font-semibold">{title}</h2><p className="mt-1 text-sm text-[#8b8494]">{description}</p></div>
        <span className="rounded-full bg-[#ede9fe] px-2.5 py-1 text-xs font-bold text-[#6d28d9]">{bookings.length}</span>
      </div>
      {bookings.length === 0 ? (
        <div className="flex min-h-48 flex-col items-center justify-center p-6 text-center">
          <span className="text-[#5b21b6]" aria-hidden="true"><DashboardIcon name="calendar" size={28} /></span>
          <p className="mt-3 font-semibold">{emptyMessage}</p>
          <p className="mt-1 text-sm text-[#8b8494]">Nothing is scheduled for this date.</p>
        </div>
      ) : (
        <div className="divide-y divide-[#f3f1f6]">
          {bookings.map((booking) => (
            <button type="button" onClick={() => onOpenBooking(booking)} className="flex w-full cursor-pointer items-center gap-3 p-4 text-left transition hover:bg-[#faf9fc] sm:gap-4" key={booking.id}>
              <div className="flex h-12 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#eeeaf3] bg-[#f7f6fb]">
                {getVehicleImageUrl(booking.vehicle) ? <img className="h-full w-full object-cover" src={getVehicleImageUrl(booking.vehicle)} alt="" /> : <DashboardIcon name="car" size={18} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{booking.customer?.name ?? 'Customer'}</p>
                <p className="truncate text-xs text-[#8b8494]">{vehicleBookingLabel(booking.vehicle)} · {booking.reference}</p>
                <p className="mt-1 text-xs text-[#686173]">{bookingDateTime(booking.pickup_at)}</p>
              </div>
              <span className="text-[#8b8494]" aria-hidden="true">›</span>
            </button>
          ))}
        </div>
      )}
    </SectionCard>
  )
}

export function RentalOperationsSection({ bookings, vehicles, getVehicleImageUrl, onOpenBooking, onEditBooking, onOpenVehicles }: Props) {
  const subscriptionReadOnly = useSubscriptionReadOnly()
  const prefersReducedMotion = useReducedMotion()
  const [selectedDate, setSelectedDate] = useState(localDateValue())
  const [page, setPage] = useState(1)
  const today = localDateValue()

  const operationalBookings = useMemo(
    () => bookings.filter((booking) => !['cancelled', 'rejected'].includes(booking.status)),
    [bookings],
  )
  const releases = useMemo(
    () => operationalBookings.filter((booking) => sameDay(booking.pickup_at, selectedDate)),
    [operationalBookings, selectedDate],
  )
  const returns = useMemo(
    () => operationalBookings.filter((booking) => sameDay(booking.return_at, selectedDate)),
    [operationalBookings, selectedDate],
  )
  const receivables = useMemo(() => bookings.filter((booking) => {
    const paid = (booking.payments ?? []).filter((payment) => payment.status === 'paid').reduce((sum, payment) => sum + Number(payment.amount), 0)
    const balance = Math.max(0, Number(booking.total_amount) - paid)
    return ['pending', 'confirmed', 'upcoming', 'pre_inspection', 'ongoing', 'active', 'complete', 'completed'].includes(booking.status) && balance > 0
  }), [bookings])
  const outstandingTotal = receivables.reduce((sum, booking) => {
    const paid = (booking.payments ?? []).filter((payment) => payment.status === 'paid').reduce((total, payment) => total + Number(payment.amount), 0)
    return sum + Math.max(0, Number(booking.total_amount) - paid)
  }, 0)

  const now = new Date()
  const currentBookings = operationalBookings.filter((booking) => {
    const pickup = parseBookingDateTime(booking.pickup_at)
    const returnDate = parseBookingDateTime(booking.return_at)
    return pickup <= now && returnDate > now
  })
  const unavailableIds = new Set(currentBookings.map((booking) => booking.vehicle?.id).filter((id): id is number => Boolean(id)))
  const unavailableVehicles = vehicles.filter((vehicle) => vehicle.status !== 'available' || unavailableIds.has(vehicle.id))
  const availableCount = Math.max(0, vehicles.length - unavailableVehicles.length)
  const totalPages = Math.max(1, Math.ceil(receivables.length / pageSize))
  const visibleReceivables = receivables.slice((page - 1) * pageSize, page * pageSize)
  const isTodaySelected = selectedDate === today

  const setOperationsDate = (value: string) => {
    setSelectedDate(value)
    setPage(1)
  }

  return (
    <motion.section initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-[#8b8494]">{isTodaySelected ? 'Today' : 'Selected date'}</p>
          <p className="text-xl font-semibold">{dateLabel(selectedDate)}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="h-11 w-11 cursor-pointer rounded-lg border border-[#dcd8e6] bg-white text-lg text-[#686173] hover:border-[#5b21b6] hover:text-[#5b21b6]" onClick={() => setOperationsDate(addDays(selectedDate, -1))} aria-label="Previous day">‹</button>
          <input type="date" className="h-11 cursor-pointer rounded-lg border border-[#dcd8e6] bg-white px-3 text-sm font-semibold outline-none focus:border-[#6d28d9]" value={selectedDate} onChange={(event) => setOperationsDate(event.target.value)} aria-label="Select operations date" />
          <button type="button" className="h-11 w-11 cursor-pointer rounded-lg border border-[#dcd8e6] bg-white text-lg text-[#686173] hover:border-[#5b21b6] hover:text-[#5b21b6]" onClick={() => setOperationsDate(addDays(selectedDate, 1))} aria-label="Next day">›</button>
          {!isTodaySelected && <button type="button" className="h-11 cursor-pointer rounded-lg border border-[#5b21b6] px-4 text-sm font-semibold text-[#5b21b6] hover:bg-[#ede9fe]" onClick={() => setOperationsDate(today)}>Today</button>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Releases', releases.length, 'Scheduled for selected date', 'calendar'],
          ['Returns', returns.length, 'Expected on selected date', 'calendar'],
          ['Receivables', peso.format(outstandingTotal), `${receivables.length} outstanding booking${receivables.length === 1 ? '' : 's'}`, 'wallet'],
          ['Available now', `${availableCount} of ${vehicles.length}`, 'Vehicles currently available', 'car'],
        ].map(([label, value, note, icon]) => (
          <div className="rounded-xl border border-[#2c0f73]/10 bg-white p-5" key={String(label)}>
            <div className="flex items-start justify-between gap-3"><p className="text-[10px] font-bold uppercase tracking-[1.8px] text-[#8b8494]">{label}</p><span className="text-[#5b21b6]" aria-hidden="true"><DashboardIcon name={icon as 'calendar' | 'wallet' | 'car'} size={18} /></span></div>
            <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
            <p className="mt-2 text-xs text-[#8b8494]">{note}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <BookingList title="Scheduled Releases" description="Vehicles scheduled to go out." bookings={releases} emptyMessage="No scheduled releases" getVehicleImageUrl={getVehicleImageUrl} onOpenBooking={onOpenBooking} />
        <BookingList title="Scheduled Returns" description="Vehicles expected back." bookings={returns} emptyMessage="No scheduled returns" getVehicleImageUrl={getVehicleImageUrl} onOpenBooking={onOpenBooking} />
      </div>

      <SectionCard>
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#eeeaf3] p-5">
          <div><h2 className="text-xl font-semibold">Fleet Status</h2><p className="mt-1 text-sm text-[#8b8494]">Current vehicle availability across your fleet.</p></div>
          <span className="flex items-center gap-2 text-xs text-[#8b8494]"><span className="h-2 w-2 rounded-full bg-[#16a34a]" /> Live availability</span>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          {[
            ['Total fleet', vehicles.length, 'text-[#21142f]'],
            ['Available', availableCount, 'text-[#16a34a]'],
            ['Unavailable', unavailableVehicles.length, 'text-[#21142f]'],
          ].map(([label, value, color]) => <div key={String(label)} className="rounded-lg bg-[#f7f6fb] p-4"><p className="text-[10px] font-bold uppercase tracking-[1.5px] text-[#8b8494]">{label}</p><p className={`mt-2 text-3xl font-semibold ${color}`}>{value}</p></div>)}
        </div>
        {unavailableVehicles.length === 0 ? (
          <div className="mx-5 mb-5 rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] p-6 text-center text-sm font-semibold text-[#15803d]">All vehicles are currently available</div>
        ) : (
          <div className="mx-5 mb-5 divide-y divide-[#f3f1f6] overflow-hidden rounded-lg border border-[#e5e1ed]">
            {unavailableVehicles.map((vehicle) => {
              const booking = currentBookings.find((item) => item.vehicle?.id === vehicle.id)
              return (
                <button type="button" onClick={() => booking ? onOpenBooking(booking) : onOpenVehicles()} className="flex w-full cursor-pointer items-center justify-between gap-4 p-4 text-left transition hover:bg-[#faf9fc]" key={vehicle.id}>
                  <div><p className="text-sm font-semibold">{vehicleBookingLabel(vehicle)}</p><p className="mt-1 text-xs text-[#8b8494]">{vehicle.plate_number} · {booking ? `Booked by ${booking.customer?.name ?? 'customer'}` : 'Unavailable in fleet settings'}</p></div>
                  <span className="text-[#5b21b6]" aria-hidden="true">›</span>
                </button>
              )
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard>
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#eeeaf3] p-5">
          <div><h2 className="text-xl font-semibold">Outstanding Balances</h2><p className="mt-1 text-sm text-[#8b8494]">Bookings with remaining receivables.</p></div>
          <div className="text-right"><p className="text-xs text-[#8b8494]">Total outstanding</p><p className="mt-1 text-xl font-semibold text-[#b45309]">{peso.format(outstandingTotal)}</p></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-[#eeeaf3] bg-[#faf9fc] text-[10px] uppercase tracking-widest text-[#8b8494]"><tr><th className="px-5 py-3">Vehicle</th><th className="px-5 py-3">Renter</th><th className="px-5 py-3">Rental period</th><th className="px-5 py-3">Balance</th><th className="px-5 py-3 text-right">Action</th></tr></thead>
            <tbody>
              {visibleReceivables.length === 0 ? (
                <tr><td className="p-8 text-center text-sm text-[#8b8494]" colSpan={5}>No outstanding balances.</td></tr>
              ) : visibleReceivables.map((booking) => {
                const paid = (booking.payments ?? []).filter((payment) => payment.status === 'paid').reduce((sum, payment) => sum + Number(payment.amount), 0)
                const balance = Math.max(0, Number(booking.total_amount) - paid)
                return (
                  <tr className="border-b border-[#f3f1f6] last:border-0 hover:bg-[#faf9fc]" key={booking.id}>
                    <td className="px-5 py-4 font-semibold">{vehicleBookingLabel(booking.vehicle)}<span className="mt-1 block text-xs font-normal text-[#8b8494]">{booking.vehicle?.plate_number ?? '—'}</span></td>
                    <td className="px-5 py-4">{booking.customer?.name ?? 'Customer'}</td>
                    <td className="px-5 py-4 text-xs text-[#686173]"><span className="block">{bookingDateTime(booking.pickup_at)} – {bookingDateTime(booking.return_at)}</span><span className="mt-1 block text-[#8b8494]">{booking.reference}</span></td>
                    <td className="px-5 py-4 font-semibold text-[#b45309]">{peso.format(balance)}</td>
                    <td className="px-5 py-4 text-right">{!subscriptionReadOnly && <button type="button" onClick={() => onEditBooking(booking)} className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-[#dcd8e6] px-3 text-xs font-semibold text-[#686173] hover:border-[#5b21b6] hover:text-[#5b21b6]">Edit booking</button>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eeeaf3] p-4 text-xs text-[#8b8494]">
          <span>Showing {receivables.length === 0 ? 0 : (page - 1) * pageSize + 1} to {Math.min(page * pageSize, receivables.length)} of {receivables.length} results</span>
          <div className="flex items-center gap-1"><button type="button" className="h-8 w-8 cursor-pointer rounded-lg border border-[#dcd8e6] disabled:cursor-not-allowed disabled:opacity-40" disabled={page === 1} onClick={() => setPage((value) => value - 1)} aria-label="Previous balances page">‹</button><span className="px-2 font-semibold text-[#686173]">{page} / {totalPages}</span><button type="button" className="h-8 w-8 cursor-pointer rounded-lg border border-[#dcd8e6] disabled:cursor-not-allowed disabled:opacity-40" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} aria-label="Next balances page">›</button></div>
        </div>
      </SectionCard>
    </motion.section>
  )
}
