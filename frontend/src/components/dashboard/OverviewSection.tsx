import { motion, type Variants } from 'framer-motion'
import { DashboardIcon, type DashboardIconName } from './DashboardIcon'
import { useSubscriptionReadOnly } from './SubscriptionReadOnlyContext'

type Summary = {
  organization: { name: string; currency: string }
  stats: {
    month_revenue: number
    revenue_change: number
    active_bookings: number
    fleet_utilization: number
    total_customers: number
    total_vehicles: number
    rented_vehicles: number
    available_vehicles: number
    service_vehicles: number
  }
  upcoming_bookings: Array<{
    id: number
    reference: string
    pickup_at: string
    status: string
    customer?: { name: string }
    vehicle?: {
      name?: string
      brand: string
      model: string
      year?: number
      image_path?: string
      image_url?: string
    }
  }>
  recent_activity: Array<{ title: string; text: string; time: string }>
  revenue_by_month: Array<{ period: string; value: number }>
}

type OverviewSectionProps = {
  summary: Summary | null
  prefersReducedMotion: boolean | null
  stats: Array<{
    label: string
    value: string
    change: string
    detail: string
    icon: DashboardIconName
    tone: string
  }>
  stagger: Variants
  item: Variants
  onNewBooking: () => void
  onViewBookings: () => void
}

export function OverviewSection({
  summary,
  prefersReducedMotion,
  stats,
  stagger,
  item,
  onNewBooking,
  onViewBookings,
}: OverviewSectionProps) {
  const subscriptionReadOnly = useSubscriptionReadOnly()
  return (
    <>
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"
      >
        <div>
          <p className="text-sm font-medium text-[#8b8494]">
            {new Intl.DateTimeFormat('en-PH', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            }).format(new Date())}
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#21142f] sm:text-4xl">
            Good morning, Admin <span aria-hidden="true">👋</span>
          </h2>
          <p className="mt-2 text-sm text-[#686173]">
            Here&apos;s what&apos;s happening with your rental business today.
          </p>
        </div>
        <button
          type="button"
          onClick={onNewBooking}
          disabled={subscriptionReadOnly}
          title={subscriptionReadOnly ? 'Renew your subscription to make changes.' : undefined}
          className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg bg-[#5b21b6] px-4 py-3 text-sm font-bold text-white hover:bg-[#4c1d95] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <DashboardIcon name="plus" size={18} />
          New booking
        </button>
      </motion.div>

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="visible"
        className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {stats.map((stat) => (
          <motion.div
            variants={item}
            key={stat.label}
            className="rounded-xl border border-[#2c0f73]/10 bg-white p-5"
          >
            <div className="flex items-start justify-between">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.tone === 'purple' ? 'bg-[#ede9fe] text-[#6d28d9]' : stat.tone === 'blue' ? 'bg-[#dbeafe] text-[#2563eb]' : stat.tone === 'orange' ? 'bg-[#ffedd5] text-[#ea580c]' : 'bg-[#dcfce7] text-[#15803d]'}`}>
                <DashboardIcon name={stat.icon} size={20} />
              </div>
              {stat.change && (
                <span className="rounded-full bg-[#f0fdf4] px-2 py-1 text-[11px] font-bold text-[#16a34a]">
                  {stat.change}
                </span>
              )}
            </div>
            <p className="mt-5 text-sm font-medium text-[#686173]">{stat.label}</p>
            <p className="mt-1 text-2xl font-semibold text-[#21142f]">{stat.value}</p>
            <p className="mt-1 text-xs text-[#aaa4b4]">{stat.detail}</p>
          </motion.div>
        ))}
      </motion.div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,1fr)]">
        <motion.section
          initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-[#2c0f73]/10 bg-white p-5 sm:p-6"
        >
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-bold">Revenue overview</h3>
              <p className="mt-1 text-sm text-[#8b8494]">Monthly revenue performance</p>
            </div>
          </div>
          <div className="mt-7 flex h-52 items-end gap-3">
            {(summary?.revenue_by_month ?? []).map((month) => {
              const max = Math.max(...(summary?.revenue_by_month ?? []).map((item) => item.value), 1)
              return (
                <div key={month.period} className="flex h-full flex-1 items-end">
                  <div
                    title={`${month.period}: ₱${month.value.toLocaleString('en-PH')}`}
                    className="w-full rounded-t-md bg-[#7c3aed]"
                    style={{ height: `${Math.max(8, (month.value / max) * 100)}%` }}
                  />
                </div>
              )
            })}
            {!summary?.revenue_by_month?.length && (
              <p className="m-auto text-sm text-[#8b8494]">No revenue data yet.</p>
            )}
          </div>
        </motion.section>

        <motion.section
          initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-[#2c0f73]/10 bg-white p-5 sm:p-6"
        >
          <div>
            <h3 className="font-bold">Fleet overview</h3>
            <p className="mt-1 text-sm text-[#8b8494]">Current vehicle availability</p>
          </div>
          <div className="mt-7 flex items-center gap-7">
            <div
              className="relative flex h-32 w-32 shrink-0 items-center justify-center rounded-full"
              style={{ background: `conic-gradient(#7c3aed 0 ${summary?.stats.fleet_utilization ?? 0}%, #ede9fe ${summary?.stats.fleet_utilization ?? 0}% 100%)` }}
            >
              <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-white">
                <span className="text-2xl font-semibold">{summary?.stats.fleet_utilization ?? 0}%</span>
                <span className="text-[10px] text-[#8b8494]">utilized</span>
              </div>
            </div>
            <div className="space-y-3 text-sm">
              <p><span className="text-[#686173]">On rental</span> <strong className="ml-3">{summary?.stats.rented_vehicles ?? 0}</strong></p>
              <p><span className="text-[#686173]">Available</span> <strong className="ml-3">{summary?.stats.available_vehicles ?? 0}</strong></p>
              <p><span className="text-[#686173]">In service</span> <strong className="ml-3">{summary?.stats.service_vehicles ?? 0}</strong></p>
            </div>
          </div>
          <div className="mt-7 border-t border-[#eeeaf3] pt-4 text-sm">
            <span className="text-[#686173]">Total fleet</span>
            <strong className="float-right">{summary?.stats.total_vehicles ?? 0} vehicles</strong>
          </div>
        </motion.section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,1fr)]">
        <motion.section className="rounded-xl border border-[#2c0f73]/10 bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold">Upcoming bookings</h3>
              <p className="mt-1 text-sm text-[#8b8494]">Your next scheduled rentals</p>
            </div>
            <button type="button" onClick={onViewBookings} className="cursor-pointer text-xs font-bold text-[#5b21b6]">View all</button>
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left">
              <thead>
                <tr className="border-b border-[#eeeaf3] text-[11px] uppercase text-[#aaa4b4]">
                  <th className="pb-3">Customer</th>
                  <th className="pb-3">Vehicle</th>
                  <th className="pb-3">Rental dates</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {summary?.upcoming_bookings.map((booking) => (
                  <tr key={booking.id} className="border-b border-[#f3f1f6] last:border-0">
                    <td className="py-4 text-sm font-semibold">{booking.customer?.name ?? '—'}</td>
                    <td className="py-4 text-sm">{booking.vehicle ? `${booking.vehicle.brand} ${booking.vehicle.model}` : '—'}</td>
                    <td className="py-4 text-sm">{new Date(booking.pickup_at).toLocaleDateString()}</td>
                    <td className="py-4">
                      <span className="rounded-full bg-[#ede9fe] px-2.5 py-1 text-[11px] font-bold text-[#6d28d9]">{booking.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!summary?.upcoming_bookings.length && (
              <p className="py-8 text-center text-sm text-[#8b8494]">No upcoming bookings.</p>
            )}
          </div>
        </motion.section>

        <motion.section className="rounded-xl border border-[#2c0f73]/10 bg-white p-5 sm:p-6">
          <div>
            <h3 className="font-bold">Recent activity</h3>
            <p className="mt-1 text-sm text-[#8b8494]">Latest workspace updates</p>
          </div>
          <div className="mt-5 space-y-5">
            {summary?.recent_activity.map((activity, index) => (
              <div key={`${activity.title}-${index}`} className="flex gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#dcfce7] text-[#15803d]">
                  <DashboardIcon name="wallet" size={17} />
                </div>
                <div>
                  <p className="text-sm font-semibold">{activity.title}</p>
                  <p className="text-xs text-[#8b8494]">{activity.text}</p>
                </div>
                <span className="ml-auto text-[11px] text-[#aaa4b4]">{activity.time}</span>
              </div>
            ))}
          </div>
          {!summary?.recent_activity.length && (
            <p className="py-8 text-center text-sm text-[#8b8494]">No recent activity.</p>
          )}
        </motion.section>
      </div>
    </>
  )
}
