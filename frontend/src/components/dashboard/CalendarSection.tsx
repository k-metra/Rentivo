import { motion, useReducedMotion } from 'framer-motion'
import { parseBookingDateTime } from './dashboardUtils'
import { DashboardIcon } from './DashboardIcon'

type Booking = {
  id: number
  reference: string
  pickup_at: string
  return_at: string
  status: string
  customer?: { name: string }
  vehicle?: {
    name?: string
    brand: string
    model: string
    year?: number
    plate_number: string
    image_path?: string
    image_url?: string
  }
}

type CalendarSectionProps = {
  bookings: Booking[]
  month: Date
  onMonthChange: (month: Date) => void
  onNewBooking: () => void
  onOpenBooking: (booking: Booking) => void
  getVehicleImageUrl: (vehicle: Booking['vehicle']) => string
}

export function CalendarSection({
  bookings,
  month,
  onMonthChange,
  onNewBooking,
  onOpenBooking,
  getVehicleImageUrl,
}: CalendarSectionProps) {
  const prefersReducedMotion = useReducedMotion()
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1)
  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0)
  const startOffset = monthStart.getDay()
  const days = Array.from({ length: monthEnd.getDate() }, (_, index) => index + 1)

  return (
    <motion.section
      initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-[#2c0f73]/10 bg-white p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-[#21142f]">Calendar</h2>
          <p className="mt-1 text-sm text-[#8b8494]">Vehicle pickups and rental activity</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-3 py-2 text-sm">‹</button>
          <button type="button" onClick={() => onMonthChange(new Date())} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-3 py-2 text-xs font-bold">Today</button>
          <button type="button" onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-3 py-2 text-sm">›</button>
          <button type="button" onClick={onNewBooking} className="ml-2 cursor-pointer rounded-lg bg-[#5b21b6] px-4 py-2.5 text-sm font-bold text-white">
            <span className="mr-1">+</span>New booking
          </button>
        </div>
      </div>

      <h3 className="mt-6 text-lg font-bold">
        {month.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}
      </h3>

      <div className="mt-4 grid grid-cols-7 overflow-hidden rounded-xl border border-[#eeeaf3]">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="border-b border-[#eeeaf3] bg-[#faf9fc] px-2 py-2 text-center text-[11px] font-bold uppercase text-[#aaa4b4]">{day}</div>
        ))}
        {Array.from({ length: startOffset }, (_, index) => (
          <div key={`empty-${index}`} className="min-h-24 border-b border-r border-[#f3f1f6] bg-[#faf9fc]" />
        ))}
        {days.map((day) => {
          const dateKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const releaseBookings = bookings.filter((booking) => {
            const storedDate = booking.pickup_at.match(/^(\d{4}-\d{2}-\d{2})/)
            return storedDate ? storedDate[1] === dateKey : parseBookingDateTime(booking.pickup_at).toISOString().slice(0, 10) === dateKey
          })
          const returnBookings = bookings.filter((booking) => {
            const storedDate = booking.return_at.match(/^(\d{4}-\d{2}-\d{2})/)
            return storedDate ? storedDate[1] === dateKey : parseBookingDateTime(booking.return_at).toISOString().slice(0, 10) === dateKey
          })
          const now = new Date()
          const isCalendarToday = now.getFullYear() === month.getFullYear() && now.getMonth() === month.getMonth() && now.getDate() === day
          return (
            <div key={day} className={`min-h-24 border-b border-r border-[#f3f1f6] p-2 ${isCalendarToday ? 'bg-[#f4effc]' : 'bg-white'}`}>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${isCalendarToday ? 'bg-[#5b21b6] font-bold text-white' : 'text-[#686173]'}`}>{day}</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {releaseBookings.slice(0, 3).map((booking) => (
                  <button type="button" key={`pickup-${booking.id}`} onClick={() => onOpenBooking(booking)} title={`Departure: ${booking.reference}`} aria-label={`Departure: ${booking.reference}`} className="inline-flex h-8 w-10 cursor-pointer items-center justify-center rounded text-[#5b21b6] focus:outline-none focus:ring-2 focus:ring-[#5b21b6] md:h-10 md:w-14">
                    {getVehicleImageUrl(booking.vehicle) ? <img src={getVehicleImageUrl(booking.vehicle)} alt="" className="h-full w-full object-contain" /> : <DashboardIcon name="car" size={15} />}
                  </button>
                ))}
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {returnBookings.slice(0, 3).map((booking) => (
                  <button type="button" key={`return-${booking.id}`} onClick={() => onOpenBooking(booking)} title={`Return: ${booking.reference}`} aria-label={`Return: ${booking.reference}`} className="inline-flex h-8 w-10 cursor-pointer items-center justify-center rounded text-[#5b21b6] focus:outline-none focus:ring-2 focus:ring-[#5b21b6] md:h-10 md:w-14">
                    {getVehicleImageUrl(booking.vehicle) ? <img src={getVehicleImageUrl(booking.vehicle)} alt="" className="h-full w-full object-contain" /> : <DashboardIcon name="car" size={15} />}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </motion.section>
  )
}
