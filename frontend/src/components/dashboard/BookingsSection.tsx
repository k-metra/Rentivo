import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { bookingDateTime, bookingStatusLabel, rentalDurationLabel, vehicleBookingLabel } from './dashboardUtils'
import { DashboardIcon } from './DashboardIcon'
import SearchableSelect from '../SearchableSelect'

export type BookingSectionItem = {
  id: number
  reference: string
  pickup_at: string
  return_at: string
  status: string
  total_amount: number | string
  payment_status: string
  rental_amount: number | string
  custom_rental_rate?: boolean
  additional_charges?: number | string
  destination_city?: string
  destination_province?: string
  remarks?: string
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

type Props = {
  title: string
  bookings: BookingSectionItem[]
  onNew: () => void
  onDetails: (booking: BookingSectionItem, initialTab?: 'details' | 'extensions' | 'customer' | 'payments' | 'pre-inspection' | 'post-inspection') => void
  onEdit: (booking: BookingSectionItem) => void
  onStatusChange: (booking: BookingSectionItem, status: 'confirmed' | 'upcoming' | 'pre_inspection' | 'ongoing' | 'active' | 'complete' | 'completed' | 'cancelled') => void
  getVehicleImageUrl: (vehicle: BookingSectionItem['vehicle']) => string
}

export function BookingsSection({ title, bookings, onNew, onDetails, onEdit, onStatusChange, getVehicleImageUrl }: Props) {
  const prefersReducedMotion = useReducedMotion()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [bookingSort, setBookingSort] = useState<'priority' | 'latest' | 'oldest'>('priority')
  const [actionsBookingId, setActionsBookingId] = useState<number | null>(null)
  const [actionsPosition, setActionsPosition] = useState<{ top: number; left: number } | null>(null)
  useEffect(() => {
    if (actionsBookingId === null) return
    const closeMenu = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('[aria-label^="Actions for"]') && !target.closest('[data-booking-actions-menu]')) {
        setActionsBookingId(null)
        setActionsPosition(null)
      }
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActionsBookingId(null)
        setActionsPosition(null)
      }
    }
    const attachTimer = window.setTimeout(() => {
      document.addEventListener('mousedown', closeMenu)
    }, 0)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.clearTimeout(attachTimer)
      document.removeEventListener('mousedown', closeMenu)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [actionsBookingId])
  const filtered = useMemo(() => {
    const rows = bookings.filter((booking) => {
    const searchable = `${booking.reference} ${booking.customer?.name ?? ''} ${booking.vehicle?.name ?? ''} ${booking.vehicle?.brand ?? ''} ${booking.vehicle?.model ?? ''} ${booking.vehicle?.year ?? ''} ${booking.vehicle?.plate_number ?? ''}`.toLowerCase()
    return searchable.includes(search.toLowerCase()) && (statusFilter === 'all' || booking.status === statusFilter)
    })
    if (bookingSort === 'latest') {
      return [...rows].sort((left, right) => new Date(right.pickup_at).getTime() - new Date(left.pickup_at).getTime() || right.id - left.id)
    }
    if (bookingSort === 'oldest') {
      return [...rows].sort((left, right) => new Date(left.pickup_at).getTime() - new Date(right.pickup_at).getTime() || left.id - right.id)
    }
    return rows
  }, [bookings, search, statusFilter, bookingSort])

  const actionsBooking = actionsBookingId === null ? null : filtered.find((booking) => booking.id === actionsBookingId)

  return (
    <>
    <motion.section
      initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-[#2c0f73]/10 bg-white p-5 sm:p-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">{title}</h2>
        <button type="button" onClick={onNew} className="cursor-pointer rounded-lg bg-[#5b21b6] px-4 py-3 text-sm font-bold text-white">
          <span className="mr-1">+</span>New booking
        </button>
      </div>

      <div className="mb-5 mt-5 flex flex-col gap-3 sm:flex-row">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search reference, customer, or vehicle" className="w-full flex-1 rounded-lg border border-[#dcd8e6] px-3 py-2.5 text-sm outline-none focus:border-[#6d28d9]" />
        <div className="w-full sm:w-48"><SearchableSelect name="booking_status_filter" value={statusFilter} placeholder="All statuses" options={[{ value: 'all', label: 'All statuses' }, ...['pending','upcoming','pre_inspection','ongoing','complete','cancelled','rejected'].map((status) => ({ value: status, label: bookingStatusLabel(status) }))]} onChange={setStatusFilter} /></div>
        <div className="w-full sm:w-56"><SearchableSelect name="booking_sort" value={bookingSort} placeholder="Priority & closest departure" options={[{ value: 'priority', label: 'Priority & closest departure' }, { value: 'latest', label: 'Latest departure' }, { value: 'oldest', label: 'Oldest departure' }]} onChange={(value) => setBookingSort(value as typeof bookingSort)} /></div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left">
          <thead>
            <tr className="border-b border-[#eeeaf3] text-[11px] font-bold uppercase text-[#aaa4b4]">
              <th className="w-[100px] pb-3 pr-3">Reference</th>
              <th className="w-[150px] pb-3 pr-3">Customer</th>
              <th className="w-[210px] pb-3 pr-3">Vehicle</th>
              <th className="w-[220px] pb-3 pr-3">Dates</th>
              <th className="w-[90px] pb-3 pr-3">Status</th>
              <th className="w-[150px] pb-3 pr-3">Billing</th>
              <th className="w-[70px] pb-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((booking) => {
              const paid = (booking.payments ?? []).filter((payment) => payment.status === 'paid').reduce((sum, payment) => sum + Number(payment.amount), 0)
              const balance = Math.max(0, Number(booking.total_amount) - paid)
              return (
                <tr key={booking.id} className="border-b border-[#f3f1f6] last:border-0">
                  <td className="py-3 pr-3 text-xs font-bold">{booking.reference}</td>
                  <td className="py-3 pr-3 text-xs">{booking.customer?.name ?? '—'}</td>
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-9 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[#eeeaf3] bg-[#f7f6fb]">
                        {getVehicleImageUrl(booking.vehicle) ? <img src={getVehicleImageUrl(booking.vehicle)} alt="" className="h-full w-full object-cover" /> : <DashboardIcon name="car" size={16} />}
                      </span>
                      <span className="max-w-[170px] text-xs font-semibold leading-4 text-[#40384b]">{vehicleBookingLabel(booking.vehicle)}</span>
                    </div>
                  </td>
                  <td className="py-3 pr-3 text-xs">
                    <div className="leading-5">
                      <span className="block text-[#686173]">Departure: {bookingDateTime(booking.pickup_at)}</span>
                      <span className="block text-[#686173]">Return: {bookingDateTime(booking.return_at)}</span>
                      <span className="mt-1 inline-block rounded-full bg-[#ede9fe] px-2 py-0.5 text-[9px] font-semibold text-[#6d28d9]">{rentalDurationLabel(booking.pickup_at, booking.return_at)}</span>
                    </div>
                  </td>
                  <td className="py-3 pr-3"><span className="rounded-full bg-[#ede9fe] px-2 py-1 text-[10px] font-bold text-[#6d28d9]">{bookingStatusLabel(booking.status)}</span></td>
                  <td className="py-3 pr-3">
                    <div className="w-[145px] space-y-0.5 text-xs">
                      <div className="flex justify-between gap-2"><span className="text-[#686173]">Total</span><strong>₱{Number(booking.total_amount).toLocaleString('en-PH')}</strong></div>
                      <div className="flex justify-between gap-2"><span className="text-[#686173]">Paid</span><strong className="text-[#16a34a]">₱{paid.toLocaleString('en-PH')}</strong></div>
                      <div className="flex justify-between gap-2"><span className="text-[#686173]">Balance</span><strong className={balance > 0 ? 'text-red-600' : 'text-[#16a34a]'}>₱{balance.toLocaleString('en-PH')}</strong></div>
                    </div>
                  </td>
                  <td className="relative py-3 text-right">
                    <button
                      type="button"
                      aria-label={`Actions for ${booking.reference}`}
                      aria-expanded={actionsBookingId === booking.id}
                      onClick={(event) => {
                        if (actionsBookingId === booking.id) {
                          setActionsBookingId(null)
                          setActionsPosition(null)
                          return
                        }
                        const rect = event.currentTarget.getBoundingClientRect()
                        const menuWidth = 176
                        const menuHeight = 220
                        const left = Math.min(window.innerWidth - menuWidth - 8, Math.max(8, rect.right - menuWidth))
                        const openAbove = rect.bottom + menuHeight > window.innerHeight - 8
                        const top = openAbove ? Math.max(8, rect.top - menuHeight - 6) : rect.bottom + 6
                        setActionsPosition({ top, left })
                        setActionsBookingId(booking.id)
                      }}
                      className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[#dcd8e6] px-3 py-2 text-xs font-bold leading-none text-[#40384b] hover:bg-[#f7f6fb]"
                    >
                      <span>Actions</span>
                      <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={`h-3.5 w-3.5 shrink-0 transition-transform ${actionsBookingId === booking.id ? 'rotate-180' : ''}`}>
                        <path d="m6 8 4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </td>
                </tr>
              )
            })}
            {!filtered.length && <tr><td colSpan={7} className="py-10 text-center text-sm text-[#8b8494]">No bookings match your filters.</td></tr>}
          </tbody>
        </table>
      </div>
    </motion.section>
    {actionsBooking && actionsPosition && createPortal(
      <motion.div
        key={`booking-actions-${actionsBooking.id}`}
        data-booking-actions-menu
        initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.96, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.14 }}
        style={{ position: 'fixed', top: actionsPosition.top, left: actionsPosition.left, zIndex: 1000 }}
        className="w-44 overflow-hidden rounded-xl border border-[#dcd8e6] bg-white p-1 text-left shadow-[0_16px_40px_rgba(45,28,82,0.18)]"
      >
          <button type="button" onClick={() => { setActionsBookingId(null); setActionsPosition(null); onDetails(actionsBooking) }} className="w-full cursor-pointer rounded-lg px-3 py-2.5 text-xs font-semibold text-[#40384b] hover:bg-[#f7f6fb]">View details</button>
          <button type="button" onClick={() => { setActionsBookingId(null); setActionsPosition(null); onEdit(actionsBooking) }} className="w-full cursor-pointer rounded-lg px-3 py-2.5 text-xs font-semibold text-[#5b21b6] hover:bg-[#ede9fe]">Edit booking</button>
          {['confirmed','upcoming'].includes(actionsBooking.status) && (
            <button type="button" onClick={() => { setActionsBookingId(null); setActionsPosition(null); onDetails(actionsBooking, 'pre-inspection') }} className="w-full cursor-pointer rounded-lg px-3 py-2.5 text-xs font-semibold text-[#15803d] hover:bg-[#dcfce7]">Start pre-inspection</button>
          )}
          {!['completed','complete','cancelled','rejected'].includes(actionsBooking.status) && (
            <button type="button" onClick={() => { setActionsBookingId(null); setActionsPosition(null); onStatusChange(actionsBooking, 'cancelled') }} className="w-full cursor-pointer rounded-lg px-3 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50">Cancel</button>
          )}
      </motion.div>,
      document.body,
    )}
    </>
  )
}
