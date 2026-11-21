import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import wordmark from '../assets/rentivo-purple-wing-logo.png'
import { provinces } from '../data/philippines'

type IconName = 'grid' | 'car' | 'calendar' | 'users' | 'wallet' | 'settings' | 'search' | 'bell' | 'arrow' | 'plus' | 'more'

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    car: <><path d="m5 17 1.2-5.2A2 2 0 0 1 8.15 10h7.7a2 2 0 0 1 1.95 1.8L19 17" /><path d="M4 17h16v3H4zM7 17v3m10-3v3M7 10l1-3h8l1 3" /></>,
    calendar: <><rect x="3" y="4.5" width="18" height="17" rx="2" /><path d="M16 2v5M8 2v5M3 10h18" /></>,
    users: <><circle cx="9" cy="8" r="3" /><path d="M3 20c.4-3.1 2.4-5 6-5s5.6 1.9 6 5" /><path d="M16 5.2a3 3 0 0 1 0 5.6M18 15c1.7.7 2.7 2.2 3 5" /></>,
    wallet: <><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H20v16H6.5A2.5 2.5 0 0 1 4 17.5z" /><path d="M4 7h13.5A2.5 2.5 0 0 1 20 9.5V12h-4a2 2 0 0 0 0 4h4v4" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-2.6V20a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H6v-2.6h.2a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.8-1.8.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V5h2.6v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v2.6H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></>,
    bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 22h4" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  }
  return <svg aria-hidden="true" fill="none" height={size} viewBox="0 0 24 24" width={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">{paths[name]}</svg>
}

type Summary = {
  organization: { name: string; currency: string }
  stats: { month_revenue: number; revenue_change: number; active_bookings: number; fleet_utilization: number; total_customers: number; total_vehicles: number; rented_vehicles: number; available_vehicles: number; service_vehicles: number }
  upcoming_bookings: Array<{ id: number; reference: string; pickup_at: string; return_at: string; status: string; customer?: { name: string }; vehicle?: { brand: string; model: string } }>
  recent_activity: Array<{ title: string; text: string; time: string }>
  revenue_by_month: Array<{ period: string; value: number }>
}
type Vehicle = { id: number; brand: string; model: string; year: number; plate_number: string; type: string; daily_rate: number | string; status: string }
type Customer = { id: number; name: string; email?: string; phone?: string; address?: string }
type Booking = { id: number; reference: string; pickup_at: string; return_at: string; status: string; payment_status: string; rental_amount: number | string; total_amount: number | string; customer?: { name: string }; vehicle?: { brand: string; model: string; plate_number: string } }
type Payment = { id: number; amount: number | string; method: string; status: string; paid_at: string; booking?: { customer?: { name: string } } }
type WorkspaceUser = { id: number; name: string; email: string; role: string }

const navGroups: Array<{ label: string; items: Array<{ label: string; icon: IconName }> }> = [
  { label: 'Workspace', items: [{ label: 'Overview', icon: 'grid' }, { label: 'Calendar', icon: 'calendar' }, { label: 'Contract Builder', icon: 'arrow' }] },
  { label: 'Rental Operations', items: [{ label: 'Bookings', icon: 'calendar' }, { label: 'Rental Operations', icon: 'grid' }, { label: 'Funds', icon: 'wallet' }] },
  { label: 'People & Assets', items: [{ label: 'Partners', icon: 'users' }, { label: 'Customers', icon: 'users' }, { label: 'Vehicles', icon: 'car' }, { label: 'Booking Sources', icon: 'arrow' }] },
  { label: 'Reports & Analytics', items: [{ label: 'Fleet Utilization Report', icon: 'car' }, { label: 'Income Flow Report', icon: 'wallet' }, { label: 'Vehicle Revenue', icon: 'wallet' }, { label: 'Commissions', icon: 'users' }] },
  { label: 'Administration', items: [{ label: 'Users', icon: 'users' }, { label: 'Roles', icon: 'settings' }] },
]

export default function DashboardPage() {
  const prefersReducedMotion = useReducedMotion()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('Overview')
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ Workspace: true, 'Rental Operations': true, 'People & Assets': true, 'Reports & Analytics': false, Administration: false })
  const [summary, setSummary] = useState<Summary | null>(null)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [workspaceUsers, setWorkspaceUsers] = useState<WorkspaceUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState<'booking' | 'vehicle' | 'customer' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [selectedDurations, setSelectedDurations] = useState<number[]>([24])
  const [coverageByDuration, setCoverageByDuration] = useState<Record<number, { type: 'all' | 'province' | 'region'; locations: string[] }>>({})
  const [outsideCharges, setOutsideCharges] = useState<Record<number, string>>({})
  const [vehicleImagePreview, setVehicleImagePreview] = useState('')
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const companyName = localStorage.getItem('rentivo_pending_company') || summary?.organization.name || 'Your Rental Company'
  const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api'
  const token = localStorage.getItem('rentivo_access_token')

  const authHeaders = { Accept: 'application/json', Authorization: `Bearer ${token}` }

  const reload = async () => {
    setLoading(true)
    setError('')
    try {
      const [summaryRes, vehiclesRes, customersRes, bookingsRes, paymentsRes, usersRes] = await Promise.all([
        fetch(`${apiBaseUrl}/dashboard/summary`, { headers: authHeaders }),
        fetch(`${apiBaseUrl}/dashboard/vehicles`, { headers: authHeaders }),
        fetch(`${apiBaseUrl}/dashboard/customers`, { headers: authHeaders }),
        fetch(`${apiBaseUrl}/dashboard/bookings`, { headers: authHeaders }),
        fetch(`${apiBaseUrl}/dashboard/payments`, { headers: authHeaders }),
        fetch(`${apiBaseUrl}/dashboard/users`, { headers: authHeaders }),
      ])
      if ([summaryRes, vehiclesRes, customersRes, bookingsRes, paymentsRes, usersRes].some((response) => !response.ok)) throw new Error('Unable to load workspace data.')
      setSummary(await summaryRes.json())
      setVehicles(await vehiclesRes.json())
      setCustomers(await customersRes.json())
      setBookings(await bookingsRes.json())
      setPayments(await paymentsRes.json())
      setWorkspaceUsers(await usersRes.json())
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load workspace data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (token) void reload()
    else { setLoading(false); setError('Please sign in again to access this workspace.') }
  }, [])

  const submitCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setFormError('')
    const form = event.currentTarget
    const formData = new FormData(form)
    let endpoint = ''
    if (modal === 'booking') endpoint = 'bookings'
    if (modal === 'vehicle') endpoint = 'vehicles'
    if (modal === 'customer') endpoint = 'customers'
    let body: BodyInit
    if (modal === 'vehicle') {
      const rentalRates: Array<{ duration_hours: number; location_scope: 'all' | 'province' | 'region'; province: string | null; amount: number; amount_type: 'fixed'; outside_amount: number; coverage_type: 'all' | 'province' | 'region'; coverage_locations: string[] }> = []
      selectedDurations.forEach((duration) => {
        const amount = Number(formData.get(`rate_all_${duration}`) || 0)
        if (amount <= 0) return
        const coverage = coverageByDuration[duration] ?? { type: 'all', locations: [] }
        rentalRates.push({
          duration_hours: duration,
          location_scope: coverage.type,
          province: null,
          amount,
          amount_type: 'fixed',
          outside_amount: Number(outsideCharges[duration] || 0),
          coverage_type: coverage.type,
          coverage_locations: coverage.locations,
        })
      })
      formData.set('rental_rates', JSON.stringify(rentalRates))
      body = formData
    } else {
      body = JSON.stringify(Object.fromEntries(formData.entries()))
    }
    try {
      const response = await fetch(`${apiBaseUrl}/dashboard/${endpoint}`, {
        method: 'POST',
        headers: modal === 'vehicle' ? authHeaders : { ...authHeaders, 'Content-Type': 'application/json' },
        body,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to save.')
      if (data.warning) {
        setToast({ type: 'error', message: data.warning })
        window.setTimeout(() => setToast(null), 7000)
      } else if (modal === 'vehicle') {
        setToast({ type: 'success', message: 'Vehicle created successfully.' })
        window.setTimeout(() => setToast(null), 4000)
      }
      setModal(null)
      form.reset()
      setVehicleImagePreview('')
      setSelectedDurations([24])
      setCoverageByDuration({})
      setOutsideCharges({})
      await reload()
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : 'Unable to save.')
    } finally {
      setSubmitting(false)
    }
  }

  const stats = summary ? [
    { label: 'Total revenue', value: `₱${summary.stats.month_revenue.toLocaleString('en-PH')}`, change: `${summary.stats.revenue_change >= 0 ? '+' : ''}${summary.stats.revenue_change}%`, detail: 'vs. last month', icon: 'wallet' as IconName, tone: 'purple' },
    { label: 'Active bookings', value: summary.stats.active_bookings.toString(), change: '', detail: 'currently active', icon: 'calendar' as IconName, tone: 'blue' },
    { label: 'Fleet utilization', value: `${summary.stats.fleet_utilization}%`, change: '', detail: `${summary.stats.rented_vehicles} on rental`, icon: 'car' as IconName, tone: 'orange' },
    { label: 'Total customers', value: summary.stats.total_customers.toLocaleString('en-PH'), change: '', detail: 'workspace customers', icon: 'users' as IconName, tone: 'green' },
  ] : []

  const stagger = { hidden: {}, visible: { transition: { staggerChildren: prefersReducedMotion ? 0 : 0.06 } } }
  const item = { hidden: prefersReducedMotion ? {} : { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.38 } } }

  const tableCard = (title: string, action: ReactNode, headers: string[], rows: ReactNode) => (
    <motion.section initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-[#2c0f73]/10 bg-white p-5 shadow-[0_8px_24px_rgba(45,28,82,0.05)] sm:p-6">
      <div className="flex items-center justify-between gap-4"><h2 className="text-2xl font-semibold text-[#21142f]">{title}</h2>{action}</div>
      <div className="mt-6 overflow-x-auto"><table className="w-full min-w-[700px] text-left"><thead><tr className="border-b border-[#eeeaf3] text-[11px] font-bold uppercase tracking-wider text-[#aaa4b4]">{headers.map((header) => <th key={header} className="pb-3">{header}</th>)}</tr></thead><tbody>{rows}</tbody></table></div>
    </motion.section>
  )

  const renderDurationCoverage = (duration: number) => {
    const coverage = coverageByDuration[duration] ?? { type: 'all' as const, locations: [] as string[] }
    return (
      <div key={duration} className="space-y-3 rounded-lg border border-[#eeeaf3] p-3">
        <div className="grid gap-3 sm:grid-cols-[100px_1fr_180px] sm:items-end">
          <span className="text-sm font-semibold">{duration} hours</span>
          <label><span className="mb-1 block text-xs font-semibold text-[#686173]">Base rental rate</span><input name={`rate_all_${duration}`} type="number" min="0" step="0.01" placeholder="Base amount" className="w-full rounded-lg border border-[#dcd8e6] px-4 py-2.5 outline-none focus:border-[#6d28d9]" /></label>
          <label><span className="mb-1 block text-xs font-semibold text-[#686173]">Outside-area charge</span><input value={outsideCharges[duration] ?? ''} onChange={(event) => setOutsideCharges((current) => ({ ...current, [duration]: event.target.value }))} type="number" min="0" step="0.01" placeholder="Additional amount" className="w-full rounded-lg border border-[#dcd8e6] px-4 py-2.5 outline-none focus:border-[#6d28d9]" /></label>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-[#686173]">Where the base rental rate applies</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setCoverageByDuration((current) => ({ ...current, [duration]: { type: 'all', locations: [] } }))} className={`cursor-pointer rounded-lg px-3 py-2 text-xs font-bold ${coverage.type === 'all' ? 'bg-[#5b21b6] text-white' : 'border border-[#dcd8e6] text-[#686173]'}`}>Everywhere</button>
            <button type="button" onClick={() => setCoverageByDuration((current) => ({ ...current, [duration]: { type: 'province', locations: coverage.locations } }))} className={`cursor-pointer rounded-lg px-3 py-2 text-xs font-bold ${coverage.type === 'province' ? 'bg-[#5b21b6] text-white' : 'border border-[#dcd8e6] text-[#686173]'}`}>Selected provinces</button>
          </div>
          {coverage.type === 'province' && (
            <div className="mt-3 flex flex-wrap gap-2">
              {provinces.map((province) => {
                const selected = coverage.locations.includes(province)
                return <button type="button" key={province} onClick={() => setCoverageByDuration((current) => ({ ...current, [duration]: { type: 'province', locations: selected ? coverage.locations.filter((item) => item !== province) : [...coverage.locations, province] } }))} className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold ${selected ? 'border-[#5b21b6] bg-[#ede9fe] text-[#5b21b6]' : 'border-[#dcd8e6] text-[#686173] hover:border-[#c4b5fd]'}`}>{province}</button>
              })}
            </div>
          )}
        </div>
        {coverage.type !== 'all' && coverage.locations.length > 0 && <p className="text-xs text-[#8b8494]">Outside these selected locations, the outside-area charge is added to the base rate.</p>}
      </div>
    )
  }

  const renderSection = () => {
    if (activeSection === 'Bookings' || activeSection === 'Calendar' || activeSection === 'Rental Operations') {
      return tableCard(activeSection, <button type="button" onClick={() => setModal('booking')} className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#5b21b6] px-4 py-3 text-sm font-bold text-white hover:bg-[#4c1d95]"><Icon name="plus" size={18} />New booking</button>, ['Reference','Customer','Vehicle','Dates','Status','Total'],
        bookings.length ? bookings.map((booking) => <tr key={booking.id} className="border-b border-[#f3f1f6] last:border-0"><td className="py-4 text-sm font-bold">{booking.reference}</td><td className="py-4 text-sm">{booking.customer?.name ?? '—'}</td><td className="py-4 text-sm">{booking.vehicle ? `${booking.vehicle.brand} ${booking.vehicle.model}` : '—'}</td><td className="py-4 text-sm text-[#686173]">{new Date(booking.pickup_at).toLocaleDateString()} – {new Date(booking.return_at).toLocaleDateString()}</td><td className="py-4"><span className="rounded-full bg-[#ede9fe] px-2.5 py-1 text-[11px] font-bold text-[#6d28d9]">{booking.status}</span></td><td className="py-4 text-sm font-bold">₱{Number(booking.total_amount).toLocaleString('en-PH')}</td></tr>) : <tr><td colSpan={6} className="py-10 text-center text-sm text-[#8b8494]">No bookings yet.</td></tr>)
    }
    if (activeSection === 'Vehicles') {
      return tableCard('Vehicles', <button type="button" onClick={() => setModal('vehicle')} className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#5b21b6] px-4 py-3 text-sm font-bold text-white hover:bg-[#4c1d95]"><Icon name="plus" size={18} />Add vehicle</button>, ['Vehicle','Plate','Type','Daily rate','Status'],
        vehicles.length ? vehicles.map((vehicle) => <tr key={vehicle.id} className="border-b border-[#f3f1f6] last:border-0"><td className="py-4 text-sm font-bold">{vehicle.brand} {vehicle.model}</td><td className="py-4 text-sm">{vehicle.plate_number}</td><td className="py-4 text-sm">{vehicle.type}</td><td className="py-4 text-sm">₱{Number(vehicle.daily_rate).toLocaleString('en-PH')}</td><td className="py-4"><span className="rounded-full bg-[#ede9fe] px-2.5 py-1 text-[11px] font-bold text-[#6d28d9]">{vehicle.status}</span></td></tr>) : <tr><td colSpan={5} className="py-10 text-center text-sm text-[#8b8494]">No vehicles yet.</td></tr>)
    }
    if (activeSection === 'Customers') {
      return tableCard('Customers', <button type="button" onClick={() => setModal('customer')} className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#5b21b6] px-4 py-3 text-sm font-bold text-white hover:bg-[#4c1d95]"><Icon name="plus" size={18} />Add customer</button>, ['Name','Email','Phone','Address'],
        customers.length ? customers.map((customer) => <tr key={customer.id} className="border-b border-[#f3f1f6] last:border-0"><td className="py-4 text-sm font-bold">{customer.name}</td><td className="py-4 text-sm">{customer.email || '—'}</td><td className="py-4 text-sm">{customer.phone || '—'}</td><td className="py-4 text-sm text-[#686173]">{customer.address || '—'}</td></tr>) : <tr><td colSpan={4} className="py-10 text-center text-sm text-[#8b8494]">No customers yet.</td></tr>)
    }
    if (activeSection === 'Funds') {
      return tableCard('Funds', null, ['Customer','Amount','Method','Status','Date'],
        payments.length ? payments.map((payment) => <tr key={payment.id} className="border-b border-[#f3f1f6] last:border-0"><td className="py-4 text-sm">{payment.booking?.customer?.name || '—'}</td><td className="py-4 text-sm font-bold">₱{Number(payment.amount).toLocaleString('en-PH')}</td><td className="py-4 text-sm">{payment.method}</td><td className="py-4 text-sm">{payment.status}</td><td className="py-4 text-sm text-[#686173]">{payment.paid_at ? new Date(payment.paid_at).toLocaleDateString() : '—'}</td></tr>) : <tr><td colSpan={5} className="py-10 text-center text-sm text-[#8b8494]">No payments recorded yet.</td></tr>)
    }
    if (activeSection === 'Users') {
      return tableCard('Users', null, ['Name','Email','Role'], workspaceUsers.map((user) => <tr key={user.id} className="border-b border-[#f3f1f6] last:border-0"><td className="py-4 text-sm font-bold">{user.name}</td><td className="py-4 text-sm">{user.email}</td><td className="py-4"><span className="rounded-full bg-[#ede9fe] px-2.5 py-1 text-[11px] font-bold text-[#6d28d9]">{user.role}</span></td></tr>))
    }
    if (activeSection === 'Roles') {
      return tableCard('Roles', null, ['Role','Access'], [['Owner','Full workspace access'],['Staff','Operations access']].map(([role, access]) => <tr key={role} className="border-b border-[#f3f1f6] last:border-0"><td className="py-4 text-sm font-bold">{role}</td><td className="py-4 text-sm">{access}</td></tr>))
    }
    if (['Fleet Utilization Report','Income Flow Report','Vehicle Revenue','Commissions'].includes(activeSection)) {
      return <motion.section initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-[#2c0f73]/10 bg-white p-6"><h2 className="text-2xl font-semibold">{activeSection}</h2><div className="mt-6 grid gap-4 sm:grid-cols-3"><div className="rounded-lg bg-[#f7f6fb] p-5"><p className="text-sm text-[#8b8494]">Fleet utilization</p><p className="mt-2 text-2xl font-bold">{summary?.stats.fleet_utilization ?? 0}%</p></div><div className="rounded-lg bg-[#f7f6fb] p-5"><p className="text-sm text-[#8b8494]">Monthly revenue</p><p className="mt-2 text-2xl font-bold">₱{summary?.stats.month_revenue.toLocaleString('en-PH') ?? 0}</p></div><div className="rounded-lg bg-[#f7f6fb] p-5"><p className="text-sm text-[#8b8494]">Active bookings</p><p className="mt-2 text-2xl font-bold">{summary?.stats.active_bookings ?? 0}</p></div></div></motion.section>
    }
    if (activeSection === 'Settings') {
      return <motion.section initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-[#2c0f73]/10 bg-white p-6"><h2 className="text-2xl font-semibold">Settings</h2><dl className="mt-6 grid gap-5 sm:grid-cols-2"><div className="rounded-lg bg-[#f7f6fb] p-4"><dt className="text-xs text-[#8b8494]">Workspace</dt><dd className="mt-1 font-bold">{companyName}</dd></div><div className="rounded-lg bg-[#f7f6fb] p-4"><dt className="text-xs text-[#8b8494]">Currency</dt><dd className="mt-1 font-bold">{summary?.organization.currency ?? '—'}</dd></div></dl></motion.section>
    }
    return <motion.section initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-dashed border-[#dcd8e6] bg-white px-6 py-16 text-center"><h2 className="text-xl font-semibold">{activeSection}</h2><p className="mt-2 text-sm text-[#8b8494]">No data has been configured for this module yet.</p></motion.section>
  }

  return (
    <div className="min-h-screen bg-[#f7f6fb] text-[#17141f]">
      <AnimatePresence>{sidebarOpen && <motion.button aria-label="Close navigation" className="fixed inset-0 z-30 bg-[#17141f]/35 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSidebarOpen(false)} />}</AnimatePresence>
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-[#2c0f73]/10 bg-white px-4 py-6 transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center px-3"><img src={wordmark} alt="Rentivo" className="h-10 w-auto" /></div>
        <div className="mt-8 px-3"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#aaa4b4]">Workspace</p><div className="mt-3 flex items-center gap-3 rounded-xl bg-[#f7f6fb] p-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#5b21b6] text-sm font-bold text-white">{companyName.slice(0,1).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-sm font-bold text-[#21142f]">{companyName}</p><p className="text-xs text-[#8b8494]">Admin workspace</p></div></div></div>
        <nav className="rentivo-sidebar-scroll mt-5 min-h-0 flex-1 space-y-2 overflow-y-auto pb-4">
          {navGroups.map((group) => <div key={group.label}><button type="button" onClick={() => setOpenGroups((current) => ({ ...current, [group.label]: !current[group.label] }))} className="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#aaa4b4]"><span>{group.label}</span><motion.span animate={{ rotate: openGroups[group.label] ? 90 : 0 }}>›</motion.span></button><AnimatePresence initial={false}>{openGroups[group.label] && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden"><div className="space-y-1 pt-1">{group.items.map((navItem) => <button key={navItem.label} type="button" onClick={() => { setActiveSection(navItem.label); setSidebarOpen(false) }} className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition ${activeSection === navItem.label ? 'bg-[#f0eafa] text-[#5b21b6]' : 'text-[#686173] hover:bg-[#f7f6fb] hover:text-[#21142f]'}`}><Icon name={navItem.icon} size={18} />{navItem.label}</button>)}</div></motion.div>}</AnimatePresence></div>)}
        </nav>
        <div className="mt-auto shrink-0 border-t border-[#eeeaf3] bg-white pt-4"><button type="button" onClick={() => setActiveSection('Settings')} className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold transition ${activeSection === 'Settings' ? 'bg-[#f0eafa] text-[#5b21b6]' : 'text-[#686173] hover:bg-[#f7f6fb] hover:text-[#21142f]'}`}><Icon name="settings" size={19} />Settings</button><button type="button" onClick={() => { localStorage.removeItem('rentivo_access_token'); window.location.href = '/' }} className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold text-[#686173] hover:bg-[#f7f6fb]"><span>↪</span>Sign out</button></div>
      </aside>

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-[#2c0f73]/10 bg-white/90 px-5 backdrop-blur-md sm:px-8"><div className="flex items-center gap-3"><button type="button" aria-label="Open navigation" onClick={() => setSidebarOpen(true)} className="cursor-pointer rounded-lg p-2 text-[#686173] lg:hidden"><span className="block h-0.5 w-5 bg-current shadow-[0_6px_0_currentColor,0_-6px_0_currentColor]" /></button><div className="hidden items-center gap-2 text-sm text-[#8b8494] sm:flex"><span>Workspace</span><span>/</span><strong className="font-semibold text-[#40384b]">{activeSection}</strong></div><h1 className="text-lg font-bold sm:hidden">{activeSection}</h1></div><div className="flex items-center gap-2 sm:gap-4"><button type="button" aria-label="Search" className="cursor-pointer rounded-lg p-2.5 text-[#686173] hover:bg-[#f7f6fb]"><Icon name="search" /></button><button type="button" aria-label="Notifications" className="relative cursor-pointer rounded-lg p-2.5 text-[#686173] hover:bg-[#f7f6fb]"><Icon name="bell" /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#ef4444]" /></button><div className="h-8 w-px bg-[#eeeaf3]" /><div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ede9fe] text-sm font-bold text-[#6d28d9]">AD</div></div></header>
        <main className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10">
          {loading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1,2,3,4].map((key) => <div key={key} className="h-36 animate-pulse rounded-xl bg-white" />)}</div> : error ? <div className="rounded-xl border border-red-100 bg-red-50 p-6 text-sm text-red-700" role="alert">{error}</div> : activeSection !== 'Overview' ? renderSection() : (
            <>
              <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-sm font-medium text-[#8b8494]">{new Intl.DateTimeFormat('en-PH', { weekday:'long', month:'long', day:'numeric', year:'numeric' }).format(new Date())}</p><h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#21142f] sm:text-4xl">Good morning, Admin <span aria-hidden="true">👋</span></h2><p className="mt-2 text-sm text-[#686173]">Here&apos;s what&apos;s happening with your rental business today.</p></div><button type="button" onClick={() => setModal('booking')} className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg bg-[#5b21b6] px-4 py-3 text-sm font-bold text-white hover:bg-[#4c1d95]"><Icon name="plus" size={18} />New booking</button></motion.div>
              <motion.div variants={stagger} initial="hidden" animate="visible" className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map((stat) => <motion.div variants={item} key={stat.label} className="rounded-xl border border-[#2c0f73]/10 bg-white p-5"><div className="flex items-start justify-between"><div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.tone === 'purple' ? 'bg-[#ede9fe] text-[#6d28d9]' : stat.tone === 'blue' ? 'bg-[#dbeafe] text-[#2563eb]' : stat.tone === 'orange' ? 'bg-[#ffedd5] text-[#ea580c]' : 'bg-[#dcfce7] text-[#15803d]'}`}><Icon name={stat.icon} size={20} /></div>{stat.change && <span className="rounded-full bg-[#f0fdf4] px-2 py-1 text-[11px] font-bold text-[#16a34a]">{stat.change}</span>}</div><p className="mt-5 text-sm font-medium text-[#686173]">{stat.label}</p><p className="mt-1 text-2xl font-semibold text-[#21142f]">{stat.value}</p><p className="mt-1 text-xs text-[#aaa4b4]">{stat.detail}</p></motion.div>)}</motion.div>
              <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,1fr)]">
                <motion.section initial={prefersReducedMotion ? false : { opacity:0,y:16 }} animate={{opacity:1,y:0}} className="rounded-xl border border-[#2c0f73]/10 bg-white p-5 sm:p-6"><div className="flex items-start justify-between"><div><h3 className="font-bold">Revenue overview</h3><p className="mt-1 text-sm text-[#8b8494]">Monthly revenue performance</p></div></div><div className="mt-7 flex h-52 items-end gap-3">{(summary?.revenue_by_month ?? []).map((month) => { const max = Math.max(...(summary?.revenue_by_month ?? []).map((item) => item.value),1); return <div key={month.period} className="flex h-full flex-1 items-end"><div title={`${month.period}: ₱${month.value.toLocaleString('en-PH')}`} className="w-full rounded-t-md bg-[#7c3aed]" style={{ height: `${Math.max(8,(month.value/max)*100)}%` }} /></div>})}{(!summary?.revenue_by_month?.length) && <p className="m-auto text-sm text-[#8b8494]">No revenue data yet.</p>}</div></motion.section>
                <motion.section initial={prefersReducedMotion ? false : { opacity:0,y:16 }} animate={{opacity:1,y:0}} className="rounded-xl border border-[#2c0f73]/10 bg-white p-5 sm:p-6"><div><h3 className="font-bold">Fleet overview</h3><p className="mt-1 text-sm text-[#8b8494]">Current vehicle availability</p></div><div className="mt-7 flex items-center gap-7"><div className="relative flex h-32 w-32 shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(#7c3aed 0 ${summary?.stats.fleet_utilization ?? 0}%, #ede9fe ${summary?.stats.fleet_utilization ?? 0}% 100%)` }}><div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-white"><span className="text-2xl font-semibold">{summary?.stats.fleet_utilization ?? 0}%</span><span className="text-[10px] text-[#8b8494]">utilized</span></div></div><div className="space-y-3 text-sm"><p><span className="text-[#686173]">On rental</span> <strong className="ml-3">{summary?.stats.rented_vehicles ?? 0}</strong></p><p><span className="text-[#686173]">Available</span> <strong className="ml-3">{summary?.stats.available_vehicles ?? 0}</strong></p><p><span className="text-[#686173]">In service</span> <strong className="ml-3">{summary?.stats.service_vehicles ?? 0}</strong></p></div></div><div className="mt-7 border-t border-[#eeeaf3] pt-4 text-sm"><span className="text-[#686173]">Total fleet</span><strong className="float-right">{summary?.stats.total_vehicles ?? 0} vehicles</strong></div></motion.section>
              </div>
              <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,1fr)]">
                <motion.section className="rounded-xl border border-[#2c0f73]/10 bg-white p-5 sm:p-6"><div className="flex items-center justify-between"><div><h3 className="font-bold">Upcoming bookings</h3><p className="mt-1 text-sm text-[#8b8494]">Your next scheduled rentals</p></div><button type="button" onClick={() => setActiveSection('Bookings')} className="cursor-pointer text-xs font-bold text-[#5b21b6]">View all</button></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[560px] text-left"><thead><tr className="border-b border-[#eeeaf3] text-[11px] uppercase text-[#aaa4b4]"><th className="pb-3">Customer</th><th className="pb-3">Vehicle</th><th className="pb-3">Rental dates</th><th className="pb-3">Status</th></tr></thead><tbody>{summary?.upcoming_bookings.map((booking) => <tr key={booking.id} className="border-b border-[#f3f1f6] last:border-0"><td className="py-4 text-sm font-semibold">{booking.customer?.name ?? '—'}</td><td className="py-4 text-sm">{booking.vehicle ? `${booking.vehicle.brand} ${booking.vehicle.model}` : '—'}</td><td className="py-4 text-sm">{new Date(booking.pickup_at).toLocaleDateString()}</td><td className="py-4"><span className="rounded-full bg-[#ede9fe] px-2.5 py-1 text-[11px] font-bold text-[#6d28d9]">{booking.status}</span></td></tr>)}</tbody></table>{!summary?.upcoming_bookings.length && <p className="py-8 text-center text-sm text-[#8b8494]">No upcoming bookings.</p>}</div></motion.section>
                <motion.section className="rounded-xl border border-[#2c0f73]/10 bg-white p-5 sm:p-6"><div><h3 className="font-bold">Recent activity</h3><p className="mt-1 text-sm text-[#8b8494]">Latest workspace updates</p></div><div className="mt-5 space-y-5">{summary?.recent_activity.map((activity,index) => <div key={`${activity.title}-${index}`} className="flex gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#dcfce7] text-[#15803d]"><Icon name="wallet" size={17} /></div><div><p className="text-sm font-semibold">{activity.title}</p><p className="text-xs text-[#8b8494]">{activity.text}</p></div><span className="ml-auto text-[11px] text-[#aaa4b4]">{activity.time}</span></div>)}</div>{!summary?.recent_activity.length && <p className="py-8 text-center text-sm text-[#8b8494]">No recent activity.</p>}</motion.section>
              </div>
            </>
          )}
        </main>
      </div>

      <AnimatePresence>{modal && <motion.div initial={{ opacity:0 }} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 flex items-center justify-center bg-[#17141f]/55 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null) }}><motion.div initial={prefersReducedMotion ? false : {opacity:0,scale:.96,y:12}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:.98}} className={`w-full overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl sm:p-8 ${modal === 'vehicle' ? 'max-h-[calc(100vh-2rem)] max-w-3xl' : 'max-w-lg'}`}><div className="flex items-center justify-between"><h2 className="text-xl font-bold">{modal === 'booking' ? 'New booking' : modal === 'vehicle' ? 'Add vehicle' : 'Add customer'}</h2><button type="button" onClick={() => setModal(null)} className="cursor-pointer text-xl text-[#8b8494]" aria-label="Close">×</button></div><form className="mt-6 space-y-4" onSubmit={submitCreate}>
        {modal === 'customer' && <><label className="block"><span className="mb-2 block text-sm font-semibold">Name</span><input name="name" required className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label><label className="block"><span className="mb-2 block text-sm font-semibold">Email</span><input name="email" type="email" className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label><label className="block"><span className="mb-2 block text-sm font-semibold">Phone</span><input name="phone" className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label><label className="block"><span className="mb-2 block text-sm font-semibold">Address</span><input name="address" className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label></>}
        {modal === 'vehicle' && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <label><span className="mb-2 block text-sm font-semibold">Name <span className="font-normal text-[#8b8494]">(optional)</span></span><input name="name" placeholder="Uses Brand Model Year if blank" className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3 outline-none focus:border-[#6d28d9]" /></label>
              <label><span className="mb-2 block text-sm font-semibold">Brand</span><input name="brand" required className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3 outline-none focus:border-[#6d28d9]" /></label>
              <label><span className="mb-2 block text-sm font-semibold">Model</span><input name="model" required className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3 outline-none focus:border-[#6d28d9]" /></label>
              <label><span className="mb-2 block text-sm font-semibold">Year</span><input name="year" type="number" min="1900" max="2100" required defaultValue={new Date().getFullYear()} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3 outline-none focus:border-[#6d28d9]" /></label>
              <label><span className="mb-2 block text-sm font-semibold">Color</span><input name="color" className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3 outline-none focus:border-[#6d28d9]" /></label>
              <label><span className="mb-2 block text-sm font-semibold">Plate number</span><input name="plate_number" required className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3 outline-none focus:border-[#6d28d9]" /></label>
              <label><span className="mb-2 block text-sm font-semibold">Seat count</span><input name="seat_count" type="number" min="1" max="99" required defaultValue="4" className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3 outline-none focus:border-[#6d28d9]" /></label>
              <label><span className="mb-2 block text-sm font-semibold">Vehicle type</span><select name="type" required className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3 outline-none focus:border-[#6d28d9]">{['Sedan','Motorcycle','Motorcycle 400CC+','AUV','SUV','Crossover','MPV','Van','Pickup','Hatchback'].map((type) => <option key={type}>{type}</option>)}</select></label>
              <label><span className="mb-2 block text-sm font-semibold">Transmission</span><select name="transmission" required className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3 outline-none focus:border-[#6d28d9]"><option>Automatic</option><option>Manual</option></select></label>
              <label><span className="mb-2 block text-sm font-semibold">Fuel type</span><select name="fuel_type" required className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3 outline-none focus:border-[#6d28d9]">{['Unleaded 91','Premium 95','Premium 98','Diesel','EV'].map((fuel) => <option key={fuel}>{fuel}</option>)}</select></label>
              <label><span className="mb-2 block text-sm font-semibold">Status</span><select name="status" className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3 outline-none focus:border-[#6d28d9]"><option>available</option><option>rented</option><option>maintenance</option></select></label>
              <label><span className="mb-2 block text-sm font-semibold">Security deposit <span className="font-normal text-[#8b8494]">(optional)</span></span><input name="security_deposit" type="number" min="0" step="0.01" className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3 outline-none focus:border-[#6d28d9]" /></label>
              <label><span className="mb-2 block text-sm font-semibold">Hourly extension rate</span><input name="hourly_extension_rate" type="number" min="0" step="0.01" className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3 outline-none focus:border-[#6d28d9]" /></label>
              <div className="grid grid-cols-[1fr_120px] gap-2">
                <label><span className="mb-2 block text-sm font-semibold">Mileage limit (km)</span><input name="mileage_limit" type="number" min="0" className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3 outline-none focus:border-[#6d28d9]" /></label>
                <label><span className="mb-2 block text-sm font-semibold">Applies to</span><select name="mileage_limit_unit" className="w-full rounded-lg border border-[#dcd8e6] px-3 py-3 outline-none focus:border-[#6d28d9]"><option value="rental">Entire rental</option><option value="day">Per day</option></select></label>
              </div>
            </div>

            <div className="rounded-xl border border-[#e5e1ed] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-bold text-[#21142f]">Rental rates</h3><p className="mt-1 text-xs text-[#8b8494]">Enable the durations this vehicle supports.</p></div><div className="flex gap-2">{[6,12,24].map((duration) => <label key={duration} className={`cursor-pointer rounded-lg border px-3 py-2 text-xs font-bold ${selectedDurations.includes(duration) ? 'border-[#5b21b6] bg-[#ede9fe] text-[#5b21b6]' : 'border-[#dcd8e6] text-[#686173]'}`}><input type="checkbox" className="sr-only" checked={selectedDurations.includes(duration)} onChange={() => setSelectedDurations((current) => current.includes(duration) ? current.filter((value) => value !== duration) : [...current, duration].sort((a,b) => a-b))} />{duration} hours</label>)}</div></div>
              {selectedDurations.length > 0 && (
                <div className="mt-4 grid gap-3">
                  {selectedDurations.map(renderDurationCoverage)}
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
              <label><span className="mb-2 block text-sm font-semibold">Vehicle image</span><input name="image" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; setVehicleImagePreview(file ? URL.createObjectURL(file) : '') }} className="block w-full rounded-lg border border-[#dcd8e6] px-3 py-2.5 text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-[#ede9fe] file:px-3 file:py-2 file:font-bold file:text-[#5b21b6]" /></label>
              {vehicleImagePreview && <img src={vehicleImagePreview} alt="Vehicle preview" className="h-32 w-full rounded-lg object-contain" />}
            </div>
            <div>
              <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold"><input name="remove_background" type="checkbox" value="1" className="h-4 w-4 accent-[#5b21b6]" />Remove the image background with remove.bg</label>
              <p className="mt-2 text-xs text-[#8b8494]">If background removal keeps failing, visit <a href="https://www.remove.bg/" target="_blank" rel="noreferrer" className="font-bold text-[#5b21b6] underline">remove.bg</a> for account or API support.</p>
            </div>
          </div>
        )}
        {modal === 'booking' && <><label className="block"><span className="mb-2 block text-sm font-semibold">Customer</span><select name="customer_id" required className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3"><option value="">Select customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label><label className="block"><span className="mb-2 block text-sm font-semibold">Vehicle</span><select name="vehicle_id" required className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3"><option value="">Select vehicle</option>{vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.brand} {vehicle.model} · {vehicle.plate_number}</option>)}</select></label><div className="grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block text-sm font-semibold">Pickup</span><input name="pickup_at" type="datetime-local" required className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label><label><span className="mb-2 block text-sm font-semibold">Return</span><input name="return_at" type="datetime-local" required className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label></div><div className="grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block text-sm font-semibold">Rental amount</span><input name="rental_amount" type="number" min="0" required className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label><label><span className="mb-2 block text-sm font-semibold">Additional charges</span><input name="additional_charges" type="number" min="0" defaultValue="0" className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label></div><label className="block"><span className="mb-2 block text-sm font-semibold">Status</span><select name="status" className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3"><option>pending</option><option>confirmed</option><option>active</option><option>completed</option><option>cancelled</option></select></label></>}
        {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}<button type="submit" disabled={submitting} className="w-full cursor-pointer rounded-lg bg-[#5b21b6] px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">{submitting ? 'Saving...' : 'Save'}</button>
      </form></motion.div></motion.div>}</AnimatePresence>
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0, y: 10, scale: 0.98 }}
            role={toast.type === 'error' ? 'alert' : 'status'}
            className={`fixed bottom-6 right-6 z-[60] max-w-sm rounded-xl border px-4 py-3 text-sm font-semibold shadow-[0_16px_40px_rgba(45,28,82,0.18)] ${toast.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]'}`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
