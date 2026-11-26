import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ConfirmationModal } from '../components/dashboard/ConfirmationModal'
import { SubscriptionCalendarPicker } from '../components/dashboard/SubscriptionCalendarPicker'

type BillingHistory = {
  id: number
  plan: string
  billing_cycle: string
  duration_days: number
  price: number | string
  processing_fee?: number | string
  discount?: number | string
  total_due: number | string
  status: string
  starts_at: string
  ends_at: string
  notes?: string
}

type Organization = {
  id: number
  name: string
  slug: string
  plan: string
  subscription_status: string
  trial_started_at?: string
  trial_ends_at?: string
  subscription_started_at?: string
  subscription_ends_at?: string
  users_count?: number
  accounts_to_delete_count?: number
  vehicles_count?: number
  bookings_count?: number
  owner?: { id: number; name: string; email: string }
  users?: Array<{ id: number; name: string; email: string; pivot?: { role: string } }>
  vehicles?: unknown[]
  bookings?: unknown[]
  phone?: string
  address?: string
  city?: string
  province?: string
  country?: string
  website?: string
  subscription_history?: BillingHistory[]
}

const planPrices: Record<string, number> = {
  Solo: 499,
  Growth: 799,
  Professional: 1099,
  Business: 1799,
  Enterprise: 0,
}

function subscriptionDateTime(value?: string) {
  if (!value) return 'Not available'
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/)
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]))
    : new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'
  return date.toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function SuperAdminPage() {
  const navigate = useNavigate()
  const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api'
  const token = localStorage.getItem('rentivo_access_token') ?? ''
  const headers = { Accept: 'application/json', Authorization: `Bearer ${token}` }
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [totals, setTotals] = useState({ organizations: 0, free_trials: 0, active_subscriptions: 0 })
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [profileOrganization, setProfileOrganization] = useState<Organization | null>(null)
  const [renewalOpen, setRenewalOpen] = useState(false)
  const [historyEditingId, setHistoryEditingId] = useState<number | null>(null)
  const [renewalPlan, setRenewalPlan] = useState('Business')
  const [renewalStatus, setRenewalStatus] = useState('paid')
  const [billingCycle, setBillingCycle] = useState('monthly')
  const [durationDays, setDurationDays] = useState(30)
  const [renewalStartDate, setRenewalStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [renewalStartTime, setRenewalStartTime] = useState('12:00')
  const [renewalEndsAt, setRenewalEndsAt] = useState('')
  const [price, setPrice] = useState('1799')
  const [processingFee, setProcessingFee] = useState('0')
  const [discount, setDiscount] = useState('0')
  const [notes, setNotes] = useState('')
  const [confirmation, setConfirmation] = useState<{ organization: Organization } | { organization: Organization; historyId: number } | null>(null)
  const [confirming, setConfirming] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const userResponse = await fetch(`${apiBaseUrl}/user`, { headers })
      const user = await userResponse.json()
      if (!userResponse.ok || !user.is_superadmin) {
        navigate('/', { replace: true })
        return
      }
      const response = await fetch(`${apiBaseUrl}/superadmin/organizations`, { headers })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to load organizations')
      setOrganizations(data.organizations ?? [])
      setTotals(data.totals ?? { organizations: 0, free_trials: 0, active_subscriptions: 0 })
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load organizations')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const filtered = useMemo(() => organizations.filter((organization) =>
    `${organization.name} ${organization.slug} ${organization.plan} ${organization.subscription_status}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  ), [organizations, search])

  const openProfile = async (organization: Organization) => {
    setError('')
    try {
      const response = await fetch(`${apiBaseUrl}/superadmin/organizations/${organization.id}`, { headers })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to load organization')
      setProfileOrganization(data)
      setRenewalOpen(false)
      setHistoryEditingId(null)
      setRenewalPlan(data.plan || 'Business')
      setRenewalStatus(data.subscription_status === 'free_trial' ? 'trial' : data.subscription_status === 'expired' ? 'expired' : 'paid')
      setBillingCycle('monthly')
      setDurationDays(30)
      setRenewalStartDate(new Date().toISOString().slice(0, 10))
      setRenewalStartTime('12:00')
      setRenewalEndsAt(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 16))
      setPrice(String(planPrices[data.plan] ?? 1799))
      setProcessingFee('0')
      setDiscount('0')
      setNotes('')
    } catch (profileError) {
      setError(profileError instanceof Error ? profileError.message : 'Unable to load organization')
    }
  }

  const applyRenewalPreset = (days: number) => {
    setDurationDays(days)
    setBillingCycle(days === 30 ? 'monthly' : days === 90 ? 'quarterly' : days === 180 ? 'semiannual' : days === 365 ? 'annual' : 'custom')
    const start = renewalStartDate ? new Date(`${renewalStartDate}T${renewalStartTime || '12:00'}:00`) : new Date()
    setRenewalEndsAt(new Date(start.getTime() + days * 86400000).toISOString().slice(0, 16))
  }

  const applyCustomDuration = (value: string) => {
    const days = Math.max(1, Math.min(3650, Number.parseInt(value, 10) || 1))
    setDurationDays(days)
    setBillingCycle('custom')
    const start = renewalStartDate ? new Date(`${renewalStartDate}T${renewalStartTime || '12:00'}:00`) : new Date()
    setRenewalEndsAt(new Date(start.getTime() + days * 86400000).toISOString().slice(0, 16))
  }

  const saveRenewalHistory = async () => {
    if (!profileOrganization) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const payload = {
        plan: renewalPlan,
        billing_cycle: billingCycle,
        duration_days: durationDays,
        starts_at: `${renewalStartDate}T${renewalStartTime || '12:00'}:00`,
        ends_at: renewalEndsAt,
        price: Number(price || 0),
        processing_fee: Number(processingFee || 0),
        discount: Number(discount || 0),
        status: renewalStatus,
        notes,
      }
      const url = historyEditingId
        ? `${apiBaseUrl}/superadmin/organizations/${profileOrganization.id}/subscription-history/${historyEditingId}`
        : `${apiBaseUrl}/superadmin/organizations/${profileOrganization.id}/subscription-history`
      const response = await fetch(url, {
        method: historyEditingId ? 'PATCH' : 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to save subscription')
      setSuccess(historyEditingId ? 'Billing record updated.' : 'Payment and renewal recorded.')
      setHistoryEditingId(null)
      await openProfile(profileOrganization)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save subscription')
    } finally {
      setSaving(false)
    }
  }

  const editHistory = (history: BillingHistory) => {
    setHistoryEditingId(history.id)
    setRenewalPlan(history.plan)
    setRenewalStatus(history.status)
    setBillingCycle(history.billing_cycle)
    setDurationDays(history.duration_days)
    setRenewalStartDate(history.starts_at.slice(0, 10))
    setRenewalStartTime(history.starts_at.match(/T(\d{2}:\d{2})/)?.[1] ?? '12:00')
    setRenewalEndsAt(history.ends_at.slice(0, 16))
    setPrice(String(history.price ?? 0))
    setProcessingFee(String(history.processing_fee ?? 0))
    setDiscount(String(history.discount ?? 0))
    setNotes(history.notes ?? '')
    setRenewalOpen(true)
  }

  const deleteHistory = async (organization: Organization, historyId: number) => {
    const response = await fetch(`${apiBaseUrl}/superadmin/organizations/${organization.id}/subscription-history/${historyId}`, {
      method: 'DELETE',
      headers,
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.message || 'Unable to delete billing record')
    setSuccess('Billing record deleted.')
    await openProfile(organization)
  }

  const deleteOrganization = async (organization: Organization) => {
    setSaving(true)
    setError('')
    try {
      const response = await fetch(`${apiBaseUrl}/superadmin/organizations/${organization.id}`, { method: 'DELETE', headers })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to delete organization')
      const deletedAccounts = Number(data.deleted_user_accounts ?? 0)
      const accountMessage = deletedAccounts === 1
        ? '1 member account was also deleted.'
        : `${deletedAccounts} member accounts were also deleted.`
      setSuccess(`${organization.name} was deleted. ${accountMessage}`)
      setProfileOrganization(null)
      await load()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete organization')
    } finally {
      setSaving(false)
    }
  }

  const signOut = () => {
    localStorage.removeItem('rentivo_access_token')
    window.location.href = '/'
  }

  return (
    <main className="min-h-screen bg-[#f7f6fb] text-[#17141f]">
      <header className="flex h-20 items-center justify-between border-b border-[#2c0f73]/10 bg-white px-6 sm:px-10">
        <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#5b21b6]">Rentivo Control</p><h1 className="mt-1 text-xl font-bold">Superadmin Dashboard</h1></div>
        <button type="button" onClick={signOut} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-4 py-2.5 text-sm font-bold text-[#686173]">Sign out</button>
      </header>
      <div className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8">
        {error && <p className="mb-5 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        {success && <p className="mb-5 rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-sm font-semibold text-[#15803d]">{success}</p>}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-[#2c0f73]/10 bg-white p-5"><p className="text-sm text-[#8b8494]">Organizations</p><p className="mt-2 text-3xl font-bold">{totals.organizations}</p></div>
          <div className="rounded-xl border border-[#2c0f73]/10 bg-white p-5"><p className="text-sm text-[#8b8494]">Free trials</p><p className="mt-2 text-3xl font-bold text-[#5b21b6]">{totals.free_trials}</p></div>
          <div className="rounded-xl border border-[#2c0f73]/10 bg-white p-5"><p className="text-sm text-[#8b8494]">Active subscriptions</p><p className="mt-2 text-3xl font-bold text-[#16a34a]">{totals.active_subscriptions}</p></div>
        </div>
        <div className="mt-6 rounded-xl border border-[#2c0f73]/10 bg-white p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-bold">Organizations</h2><p className="mt-1 text-sm text-[#8b8494]">Manage plans, trials, renewals, and billing periods.</p></div><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search organization, slug, plan..." className="w-full rounded-lg border border-[#dcd8e6] px-4 py-2.5 text-sm sm:max-w-sm" /></div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead><tr className="border-b border-[#eeeaf3] text-[10px] uppercase tracking-widest text-[#8b8494]"><th className="p-4">Organization</th><th className="p-4">Plan</th><th className="p-4">Status</th><th className="p-4 text-right">Users</th><th className="p-4 text-right">Vehicles</th><th className="p-4 text-right">Bookings</th><th className="p-4">Subscription period</th><th className="p-4 text-right">Action</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={8} className="p-8 text-center text-[#8b8494]">Loading organizations...</td></tr> : filtered.map((organization) => {
                  const isTrial = organization.subscription_status === 'free_trial'
                  const startedAt = isTrial ? organization.trial_started_at : organization.subscription_started_at
                  const endsAt = isTrial ? organization.trial_ends_at : organization.subscription_ends_at
                  return (
                    <tr key={organization.id} className="border-b border-[#f3f1f6] last:border-0">
                      <td className="p-4"><button type="button" onClick={() => void openProfile(organization)} className="cursor-pointer text-left"><p className="font-bold text-[#21142f] hover:text-[#5b21b6]">{organization.name}</p><p className="mt-1 text-xs text-[#8b8494]">{organization.slug}</p></button></td>
                      <td className="p-4 font-semibold text-[#5b21b6]">{organization.plan}</td>
                      <td className="p-4"><span className="rounded-full bg-[#ede9fe] px-2 py-1 text-[10px] font-bold">{organization.subscription_status.replace('_', ' ')}</span></td>
                      <td className="p-4 text-right">{organization.users_count ?? 0}</td>
                      <td className="p-4 text-right">{organization.vehicles_count ?? 0}</td>
                      <td className="p-4 text-right">{organization.bookings_count ?? 0}</td>
                      <td className="p-4 text-xs text-[#686173]"><div className="leading-5"><span className="block">Started: {subscriptionDateTime(startedAt)}</span><span className="block">Ends: {subscriptionDateTime(endsAt)}</span></div></td>
                      <td className="p-4 text-right"><div className="flex justify-end gap-2"><button type="button" onClick={() => void openProfile(organization)} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-3 py-2 text-xs font-bold text-[#40384b]">Profile</button><button type="button" onClick={() => { void openProfile(organization); setRenewalOpen(true) }} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-3 py-2 text-xs font-bold text-[#5b21b6]">Manage</button></div></td>
                    </tr>
                  )
                })}{!loading && !filtered.length && <tr><td colSpan={8} className="p-8 text-center text-[#8b8494]">No organizations found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
        <AnimatePresence>
          {profileOrganization && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] bg-[#17141f]/40 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) setProfileOrganization(null) }}>
              <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ duration: 0.28, ease: 'easeOut' }} className="absolute inset-y-0 right-0 flex w-full max-w-3xl flex-col bg-white shadow-[-24px_0_60px_rgba(45,28,82,0.16)]" role="dialog" aria-modal="true" aria-label={`${profileOrganization.name} profile`}>
                <div className="flex items-start justify-between border-b border-[#eeeaf3] px-5 py-5 sm:px-7"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5b21b6]">Organization profile</p><h2 className="mt-2 text-2xl font-bold">{profileOrganization.name}</h2><p className="mt-1 text-sm text-[#8b8494]">{profileOrganization.slug}</p></div><button type="button" onClick={() => setProfileOrganization(null)} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-2xl text-[#8b8494] hover:bg-[#f7f6fb]">×</button></div>
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-7">
                  <div className="flex flex-wrap items-center justify-between gap-3"><span className="rounded-full bg-[#ede9fe] px-3 py-1.5 text-xs font-bold text-[#6d28d9]">{profileOrganization.plan} · {profileOrganization.subscription_status.replace('_', ' ')}</span><button type="button" onClick={() => setRenewalOpen((open) => !open)} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-4 py-2.5 text-sm font-bold text-[#5b21b6]">{renewalOpen ? 'Close renewal form' : 'Manage subscription'}</button></div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {[['Address', profileOrganization.address ?? '—'], ['City', profileOrganization.city ?? '—'], ['Province', profileOrganization.province ?? '—'], ['Country', profileOrganization.country ?? '—'], ['Phone', profileOrganization.phone ?? '—'], ['Website', profileOrganization.website ?? '—']].map(([label, value]) => <div key={label} className="rounded-xl bg-[#f7f6fb] p-4"><p className="text-xs text-[#8b8494]">{label}</p><p className="mt-1 text-sm font-bold">{value}</p></div>)}
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-[#e5e1ed] p-4"><p className="text-xs text-[#8b8494]">Users</p><p className="mt-2 text-2xl font-bold">{profileOrganization.users_count ?? profileOrganization.users?.length ?? 0}</p></div>
                    <div className="rounded-xl border border-[#e5e1ed] p-4"><p className="text-xs text-[#8b8494]">Vehicles</p><p className="mt-2 text-2xl font-bold">{profileOrganization.vehicles_count ?? (profileOrganization as Organization & { vehicles?: unknown[] }).vehicles?.length ?? 0}</p></div>
                    <div className="rounded-xl border border-[#e5e1ed] p-4"><p className="text-xs text-[#8b8494]">Bookings</p><p className="mt-2 text-2xl font-bold">{profileOrganization.bookings_count ?? (profileOrganization as Organization & { bookings?: unknown[] }).bookings?.length ?? 0}</p></div>
                  </div>
                  {renewalOpen && (
                    <div className="mt-6 rounded-xl border border-[#e5e1ed] p-5">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5b21b6]">Subscription renewal</p>
                      <h3 className="mt-1 font-bold">Record plan & payment</h3>
                      <div className="mt-4 grid gap-3 sm:grid-cols-5">{Object.entries(planPrices).map(([planName, planPrice]) => <button type="button" key={planName} onClick={() => { setRenewalPlan(planName); setPrice(String(planPrice)) }} className={`cursor-pointer rounded-xl border p-3 text-left ${renewalPlan === planName ? 'border-[#5b21b6] bg-[#ede9fe] ring-2 ring-[#c4b5fd]' : 'border-[#dcd8e6] hover:border-[#c4b5fd]'}`}><span className="block text-sm font-bold">{planName}</span><span className="mt-1 block text-xs text-[#686173]">₱{planPrice.toLocaleString('en-PH')}/mo</span></button>)}</div>
                      <div className="mt-5 grid gap-4 sm:grid-cols-2">
                        <div><span className="mb-2 block text-sm font-semibold">Subscription starts</span><SubscriptionCalendarPicker value={renewalStartDate} time={renewalStartTime} onChange={(date, time) => { setRenewalStartDate(date); setRenewalStartTime(time); const start = new Date(`${date}T${time || '12:00'}:00`); setRenewalEndsAt(new Date(start.getTime() + durationDays * 86400000).toISOString().slice(0, 16)) }} /></div>
                        <div>
                          <span className="mb-2 block text-sm font-semibold">Duration</span>
                          <div className="grid grid-cols-4 gap-2">
                            {[30, 90, 180, 365].map((days) => (
                              <button
                                type="button"
                                key={days}
                                onClick={() => applyRenewalPreset(days)}
                                className={`cursor-pointer rounded-lg border px-2 py-2.5 text-xs font-bold ${durationDays === days && billingCycle !== 'custom' ? 'border-[#5b21b6] bg-[#ede9fe] text-[#5b21b6]' : 'border-[#dcd8e6] text-[#686173]'}`}
                              >
                                {days === 30 ? '1 month' : days === 90 ? '3 months' : days === 180 ? '6 months' : '12 months'}
                              </button>
                            ))}
                          </div>
                          <label className="mt-3 block">
                            <span className="mb-2 block text-xs font-semibold text-[#686173]">Custom duration</span>
                            <div className="relative">
                              <input
                                type="number"
                                min="1"
                                max="3650"
                                value={durationDays}
                                onChange={(event) => applyCustomDuration(event.target.value)}
                                className="w-full rounded-lg border border-[#dcd8e6] px-3 py-2.5 pr-16 text-sm"
                              />
                              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#8b8494]">days</span>
                            </div>
                          </label>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <label><span className="mb-2 block text-sm font-semibold">Status</span><select value={renewalStatus} onChange={(event) => setRenewalStatus(event.target.value)} className="w-full cursor-pointer rounded-lg border border-[#dcd8e6] px-3 py-2.5 text-sm"><option value="paid">Paid</option><option value="trial">Trial</option><option value="pending">Pending</option><option value="expired">Expired</option></select></label>
                        <label><span className="mb-2 block text-sm font-semibold">Price</span><input type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} className="w-full rounded-lg border border-[#dcd8e6] px-3 py-2.5 text-sm" /></label>
                        <label><span className="mb-2 block text-sm font-semibold">Processing fee</span><input type="number" min="0" step="0.01" value={processingFee} onChange={(event) => setProcessingFee(event.target.value)} className="w-full rounded-lg border border-[#dcd8e6] px-3 py-2.5 text-sm" /></label>
                        <label><span className="mb-2 block text-sm font-semibold">Discount</span><input type="number" min="0" step="0.01" value={discount} onChange={(event) => setDiscount(event.target.value)} className="w-full rounded-lg border border-[#dcd8e6] px-3 py-2.5 text-sm" /></label>
                      </div>
                      <div className="mt-4 flex items-center justify-between rounded-lg bg-[#f7f6fb] px-4 py-3 text-sm"><span className="text-[#686173]">Ends: <strong className="text-[#21142f]">{subscriptionDateTime(renewalEndsAt)}</strong></span><strong className="text-[#5b21b6]">₱{Math.max(0, Number(price || 0) + Number(processingFee || 0) - Number(discount || 0)).toLocaleString('en-PH')}</strong></div>
                      <label className="mt-4 block"><span className="mb-2 block text-sm font-semibold">Payment / renewal notes</span><textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} className="w-full resize-y rounded-lg border border-[#dcd8e6] px-4 py-3 text-sm" placeholder="Reference number, payment method, or manual verification notes..." /></label>
                      <button type="button" disabled={saving} onClick={saveRenewalHistory} className="mt-4 w-full cursor-pointer rounded-lg bg-[#5b21b6] px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">{saving ? 'Saving...' : historyEditingId ? 'Update billing record' : 'Record payment & renewal'}</button>
                    </div>
                  )}
                <div className="mt-6"><h3 className="font-bold">Owner account</h3><div className="mt-3 space-y-2">{(profileOrganization.users ?? []).filter((user) => user.pivot?.role === 'owner').map((owner) => <div key={owner.id} className="rounded-xl border border-[#e5e1ed] p-4"><p className="font-bold">{owner.name}</p><p className="mt-1 text-sm text-[#686173]">{owner.email}</p></div>)}{!(profileOrganization.users ?? []).some((user) => user.pivot?.role === 'owner') && <p className="text-sm text-[#8b8494]">No owner account found.</p>}</div></div>
                <div className="mt-6"><h3 className="font-bold">Subscription Billing History</h3><div className="mt-3 overflow-x-auto rounded-xl border border-[#e5e1ed]"><table className="w-full min-w-[760px] text-left text-xs"><thead><tr className="border-b border-[#eeeaf3] text-[#8b8494]"><th className="p-3">Plan</th><th className="p-3">Billing cycle</th><th className="p-3 text-right">Price</th><th className="p-3 text-right">Processing fee</th><th className="p-3 text-right">Discount</th><th className="p-3 text-right">Total due</th><th className="p-3">Starts at</th><th className="p-3">Ends at</th><th className="p-3 text-right">Action</th></tr></thead><tbody>{(() => {
                  const paidRows = (profileOrganization.subscription_history ?? []).map((history) => ({
                    id: history.id as number | string,
                    plan: history.plan,
                    cycle: history.billing_cycle,
                    price: Number(history.price),
                    processingFee: Number(history.processing_fee ?? 0),
                    discount: Number(history.discount ?? 0),
                    totalDue: Number(history.total_due),
                    startsAt: history.starts_at,
                    endsAt: history.ends_at,
                    history,
                  }))
                  const rows = profileOrganization.subscription_status === 'free_trial' && profileOrganization.trial_started_at && profileOrganization.trial_ends_at
                    ? [{ id: 'free-trial' as number | string, plan: `FREE TRIAL - ${profileOrganization.plan}`, cycle: '21 days', price: 0, processingFee: 0, discount: 0, totalDue: 0, startsAt: profileOrganization.trial_started_at, endsAt: profileOrganization.trial_ends_at, history: null }, ...paidRows]
                    : paidRows
                  return rows.map((history) => <tr key={history.id} className="border-b border-[#f3f1f6] last:border-0"><td className="p-3 font-semibold">{history.plan}</td><td className="p-3 capitalize">{history.cycle}</td><td className="p-3 text-right">₱{history.price.toLocaleString('en-PH')}</td><td className="p-3 text-right">₱{history.processingFee.toLocaleString('en-PH')}</td><td className="p-3 text-right">₱{history.discount.toLocaleString('en-PH')}</td><td className="p-3 text-right font-bold">₱{history.totalDue.toLocaleString('en-PH')}</td><td className="p-3 text-[#686173]">{subscriptionDateTime(history.startsAt)}</td><td className="p-3 text-[#686173]">{subscriptionDateTime(history.endsAt)}</td><td className="p-3 text-right">{history.history ? <><button type="button" onClick={() => editHistory(history.history)} className="mr-1 cursor-pointer rounded-lg border border-[#dcd8e6] px-2 py-1.5 text-[11px] font-bold text-[#5b21b6]">Edit</button><button type="button" onClick={() => setConfirmation({ historyId: history.history.id, organization: profileOrganization })} className="cursor-pointer rounded-lg border border-red-200 px-2 py-1.5 text-[11px] font-bold text-red-600">Delete</button></> : '—'}</td></tr>)
                })()}</tbody></table></div></div>
                <button type="button" disabled={saving} onClick={() => setConfirmation({ organization: profileOrganization })} className="mt-8 w-full cursor-pointer rounded-lg border border-red-200 px-4 py-3 text-sm font-bold text-red-600 disabled:cursor-not-allowed disabled:opacity-60">Delete organization</button>
              </div>
            </motion.aside>
          </motion.div>
        )}</AnimatePresence>
        <AnimatePresence>{confirmation && (
          <ConfirmationModal
            title={'historyId' in confirmation ? 'Delete billing record?' : `Delete ${confirmation.organization.name}?`}
            description={'historyId' in confirmation
              ? 'This permanently removes this subscription billing record.'
              : `This permanently removes the organization and its data, plus ${confirmation.organization.accounts_to_delete_count ?? 0} member account${confirmation.organization.accounts_to_delete_count === 1 ? '' : 's'} used only by this organization. Accounts shared with other organizations and superadmin accounts will be kept. This action cannot be undone.`}
            confirmLabel={'historyId' in confirmation ? 'Delete record' : 'Delete organization'}
            tone="danger"
            confirming={confirming}
            prefersReducedMotion={false}
            onCancel={() => setConfirmation(null)}
            onConfirm={async () => {
              setConfirming(true)
              try {
                if ('historyId' in confirmation) await deleteHistory(confirmation.organization, confirmation.historyId)
                else await deleteOrganization(confirmation.organization)
              } finally {
                setConfirming(false)
                setConfirmation(null)
              }
            }}
          />
        )}</AnimatePresence>
    </main>
  )
}
