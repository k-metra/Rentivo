import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState, type FormEvent } from 'react'
import type {
  BookingSource,
  Customer,
  Partner,
  Payment,
  Summary,
  Vehicle,
  WorkspaceUser,
} from '../../pages/dashboardTypes'
import { RolesSection } from './RolesSection'
import SearchableSelect from '../SearchableSelect'
import { ConfirmationModal } from './ConfirmationModal'

type DataSectionsProps = {
  activeSection: string
  customers: Customer[]
  payments: Payment[]
  partners: Partner[]
  bookingSources: BookingSource[]
  workspaceUsers: WorkspaceUser[]
  vehicles: Vehicle[]
  summary: Summary | null
  onOpenCustomerCreate: () => void
  onOpenCustomerEdit: (customer: Customer) => void
  onOpenCustomerProfile: (customer: Customer) => void
  onArchiveCustomer: (customer: Customer) => void
  onDeleteCustomer: (customer: Customer) => void
  onOpenPartner: () => void
  onOpenBookingSource: () => void
  onUsersChanged?: () => void
}

export function DataSections({
  activeSection,
  customers,
  payments,
  partners,
  bookingSources,
  workspaceUsers,
  vehicles,
  summary,
  onOpenCustomerCreate,
  onOpenCustomerEdit,
  onOpenCustomerProfile,
  onArchiveCustomer,
  onDeleteCustomer,
  onOpenPartner,
  onOpenBookingSource,
  onUsersChanged,
}: DataSectionsProps) {
  const prefersReducedMotion = useReducedMotion()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sourceStats, setSourceStats] = useState<Array<{ source: string; label: string; customers: number; bookings: number; revenue: number }>>([])
  const [sourceStatsLoading, setSourceStatsLoading] = useState(false)
  const [customRoles, setCustomRoles] = useState<Array<{ id: number; name: string }>>([])
  const [addUserOpen, setAddUserOpen] = useState(false)
  const [addUserName, setAddUserName] = useState('')
  const [addUserEmail, setAddUserEmail] = useState('')
  const [addUserPassword, setAddUserPassword] = useState('')
  const [addUserPasswordConfirmation, setAddUserPasswordConfirmation] = useState('')
  const [addUserRoleId, setAddUserRoleId] = useState('')
  const [addUserSaving, setAddUserSaving] = useState(false)
  const [addUserError, setAddUserError] = useState('')
  const [editUser, setEditUser] = useState<WorkspaceUser | null>(null)
  const [editUserName, setEditUserName] = useState('')
  const [editUserEmail, setEditUserEmail] = useState('')
  const [editUserPassword, setEditUserPassword] = useState('')
  const [editUserPasswordConfirmation, setEditUserPasswordConfirmation] = useState('')
  const [editUserRoleId, setEditUserRoleId] = useState('')
  const [editUserSaving, setEditUserSaving] = useState(false)
  const [editUserError, setEditUserError] = useState('')
  const [deleteUserConfirmation, setDeleteUserConfirmation] = useState<WorkspaceUser | null>(null)
  const [deleteUserSaving, setDeleteUserSaving] = useState(false)

  useEffect(() => {
    if (activeSection !== 'Users') return
    const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api'
    const token = localStorage.getItem('rentivo_access_token') ?? ''
    fetch(`${apiBaseUrl}/dashboard/roles`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    }).then(async (response) => {
      const data = await response.json()
      if (response.ok) setCustomRoles((data.roles ?? []).filter((role: { is_active: boolean }) => role.is_active))
    }).catch(() => setCustomRoles([]))
  }, [activeSection])

  useEffect(() => {
    if (activeSection !== 'Booking Sources') return
    const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api'
    const token = localStorage.getItem('rentivo_access_token') ?? ''
    setSourceStatsLoading(true)
    fetch(`${apiBaseUrl}/dashboard/booking-sources/stats`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.message || 'Unable to load booking source statistics')
        setSourceStats(Array.isArray(data.stats) ? data.stats : [])
      })
      .catch(() => setSourceStats([]))
      .finally(() => setSourceStatsLoading(false))
  }, [activeSection])

  const toolbar = (placeholder: string, statusOptions: string[] = []) => (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row">
      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={placeholder}
        className="w-full flex-1 rounded-lg border border-[#dcd8e6] bg-white py-2.5 px-3 text-sm outline-none focus:border-[#6d28d9]"
      />
      {statusOptions.length > 0 && (
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="cursor-pointer rounded-lg border border-[#dcd8e6] bg-white px-3 py-2.5 text-sm text-[#686173]"
        >
          <option value="all">All statuses</option>
          {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
      )}
    </div>
  )

  if (activeSection === 'Customers') {
    const filtered = customers.filter((customer) =>
      `${customer.name} ${customer.email ?? ''} ${customer.phone ?? ''} ${customer.address ?? ''}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    return (
      <motion.section initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-[#2c0f73]/10 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold">Customers</h2>
          <button type="button" onClick={onOpenCustomerCreate} className="cursor-pointer rounded-lg bg-[#5b21b6] px-4 py-3 text-sm font-bold text-white">+ Add customer</button>
        </div>
        {toolbar('Search name, email, phone, or address')}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left">
            <thead><tr className="border-b border-[#eeeaf3] text-[11px] font-bold uppercase text-[#aaa4b4]"><th className="pb-3">Name</th><th className="pb-3">Email</th><th className="pb-3">Phone</th><th className="pb-3">Address</th><th className="pb-3">Bookings</th><th className="pb-3 text-right">Actions</th></tr></thead>
            <tbody>
              {filtered.map((customer) => (
                <tr key={customer.id} className="border-b border-[#f3f1f6] last:border-0">
                  <td className="py-4 text-sm font-bold">{customer.name}{customer.archived_at && <span className="ml-2 rounded-full bg-[#f3f4f6] px-2 py-0.5 text-[10px] text-[#686173]">Archived</span>}</td>
                  <td className="py-4 text-sm">{customer.email || '—'}</td>
                  <td className="py-4 text-sm">{customer.phone || '—'}</td>
                  <td className="py-4 text-sm text-[#686173]">{customer.address || '—'}</td>
                  <td className="py-4 text-sm">{customer.bookings_count ?? 0}</td>
                  <td className="py-4">
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => onOpenCustomerProfile(customer)} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-3 py-2 text-xs font-bold text-[#40384b]">Profile</button>
                      <button type="button" onClick={() => onOpenCustomerEdit(customer)} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-3 py-2 text-xs font-bold text-[#5b21b6]">Edit</button>
                      <button type="button" onClick={() => onArchiveCustomer(customer)} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-3 py-2 text-xs font-bold text-[#686173]">{customer.archived_at ? 'Restore' : 'Archive'}</button>
                      {(customer.bookings_count ?? 0) === 0 && <button type="button" onClick={() => onDeleteCustomer(customer)} className="cursor-pointer rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600">Delete</button>}
                    </div>
                  </td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan={6} className="py-10 text-center text-sm text-[#8b8494]">No customers match your search.</td></tr>}
            </tbody>
          </table>
        </div>
      </motion.section>
    )
  }

  if (activeSection === 'Funds') {
    const filtered = payments.filter((payment) =>
      `${payment.booking?.customer?.name ?? ''} ${payment.method} ${payment.status}`.toLowerCase().includes(search.toLowerCase())
      && (statusFilter === 'all' || payment.status === statusFilter),
    )
    const paid = payments.filter((payment) => payment.status === 'paid').reduce((total, payment) => total + Number(payment.amount), 0)
    const cash = payments.filter((payment) => payment.status === 'paid' && payment.method.toLowerCase().includes('cash')).reduce((total, payment) => total + Number(payment.amount), 0)
    return (
      <motion.section initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-[#2c0f73]/10 bg-white p-5"><p className="text-sm text-[#8b8494]">Collected funds</p><p className="mt-2 text-2xl font-bold">₱{paid.toLocaleString('en-PH')}</p></div>
          <div className="rounded-xl border border-[#2c0f73]/10 bg-white p-5"><p className="text-sm text-[#8b8494]">Cash received</p><p className="mt-2 text-2xl font-bold">₱{cash.toLocaleString('en-PH')}</p></div>
          <div className="rounded-xl border border-[#2c0f73]/10 bg-white p-5"><p className="text-sm text-[#8b8494]">Transactions</p><p className="mt-2 text-2xl font-bold">{payments.length}</p></div>
        </div>
        <div className="rounded-xl border border-[#2c0f73]/10 bg-white p-5 sm:p-6">
          <h2 className="text-2xl font-semibold">Funds</h2>
          {toolbar('Search customer or payment method', ['paid','pending','failed','refunded'])}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left">
              <thead><tr className="border-b border-[#eeeaf3] text-[11px] font-bold uppercase text-[#aaa4b4]"><th className="pb-3">Customer</th><th className="pb-3">Amount</th><th className="pb-3">Method</th><th className="pb-3">Status</th><th className="pb-3">Date</th></tr></thead>
              <tbody>
                {filtered.map((payment) => (
                  <tr key={payment.id} className="border-b border-[#f3f1f6] last:border-0">
                    <td className="py-4 text-sm">{payment.booking?.customer?.name || '—'}</td>
                    <td className="py-4 text-sm font-bold">₱{Number(payment.amount).toLocaleString('en-PH')}</td>
                    <td className="py-4 text-sm">{payment.method}</td>
                    <td className="py-4 text-sm">{payment.status}</td>
                    <td className="py-4 text-sm text-[#686173]">{payment.paid_at ? new Date(payment.paid_at).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
                {!filtered.length && <tr><td colSpan={5} className="py-10 text-center text-sm text-[#8b8494]">No payments match your filters.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </motion.section>
    )
  }

  if (activeSection === 'Partners') {
    const filtered = partners.filter((partner) =>
      `${partner.name} ${partner.type} ${partner.email ?? ''} ${partner.phone ?? ''}`
        .toLowerCase()
        .includes(search.toLowerCase())
      && (statusFilter === 'all' || partner.status === statusFilter),
    )
    return (
      <motion.section initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-[#2c0f73]/10 bg-white p-5 sm:p-6">
        <div className="flex items-center justify-between"><h2 className="text-2xl font-semibold">Partners</h2><button type="button" onClick={onOpenPartner} className="cursor-pointer rounded-lg bg-[#5b21b6] px-4 py-3 text-sm font-bold text-white">+ Add partner</button></div>
        {toolbar('Search partner name, type, email, or phone', ['active','inactive'])}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left">
            <thead><tr className="border-b border-[#eeeaf3] text-[11px] font-bold uppercase text-[#aaa4b4]"><th className="pb-3">Partner</th><th className="pb-3">Type</th><th className="pb-3">Contact</th><th className="pb-3">Commission</th><th className="pb-3">Status</th></tr></thead>
            <tbody>{filtered.map((partner) => <tr key={partner.id} className="border-b border-[#f3f1f6] last:border-0"><td className="py-4 text-sm font-bold">{partner.name}</td><td className="py-4 text-sm">{partner.type}</td><td className="py-4 text-sm">{partner.email || partner.phone || '—'}</td><td className="py-4 text-sm font-bold">{Number(partner.commission_rate).toLocaleString('en-PH')}%</td><td className="py-4"><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${partner.status === 'active' ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#f3f4f6] text-[#686173]'}`}>{partner.status}</span></td></tr>)}</tbody>
          </table>
        </div>
      </motion.section>
    )
  }

  if (activeSection === 'Booking Sources') {
    const filtered = bookingSources.filter((source) =>
      `${source.name} ${source.type}`.toLowerCase().includes(search.toLowerCase())
      && (statusFilter === 'all' || source.status === statusFilter),
    )
    return (
      <motion.section initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-[#2c0f73]/10 bg-white p-5 sm:p-6">
        <div className="flex items-center justify-between"><div><h2 className="text-2xl font-semibold">Booking Sources</h2><p className="mt-1 text-sm text-[#8b8494]">Referral performance and configured sources</p></div><button type="button" onClick={onOpenBookingSource} className="cursor-pointer rounded-lg bg-[#5b21b6] px-4 py-3 text-sm font-bold text-white">+ Add source</button></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {sourceStatsLoading ? (
            [1,2,3,4,5].map((key) => <div key={key} className="h-28 animate-pulse rounded-xl bg-[#f7f6fb]" />)
          ) : sourceStats.map((stat) => (
            <div key={stat.source} className="rounded-xl border border-[#e5e1ed] p-4">
              <p className="text-sm font-bold text-[#40384b]">{stat.label}</p>
              <p className="mt-3 text-xl font-bold text-[#5b21b6]">₱{Number(stat.revenue).toLocaleString('en-PH')}</p>
              <div className="mt-2 flex justify-between text-xs text-[#8b8494]"><span>{stat.customers} customers</span><span>{stat.bookings} bookings</span></div>
            </div>
          ))}
        </div>
        <div className="mt-6">
          <h3 className="text-sm font-bold text-[#40384b]">Configured sources</h3>
        </div>
        {toolbar('Search source name or type', ['active','inactive'])}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left">
            <thead><tr className="border-b border-[#eeeaf3] text-[11px] font-bold uppercase text-[#aaa4b4]"><th className="pb-3">Source</th><th className="pb-3">Type</th><th className="pb-3">Commission</th><th className="pb-3">Status</th></tr></thead>
            <tbody>{filtered.map((source) => <tr key={source.id} className="border-b border-[#f3f1f6] last:border-0"><td className="py-4 text-sm font-bold">{source.name}</td><td className="py-4 text-sm">{source.type}</td><td className="py-4 text-sm font-bold">{Number(source.commission_rate).toLocaleString('en-PH')}%</td><td className="py-4"><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${source.status === 'active' ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#f3f4f6] text-[#686173]'}`}>{source.status}</span></td></tr>)}</tbody>
          </table>
        </div>
      </motion.section>
    )
  }

  if (activeSection === 'Users') {
    const filtered = workspaceUsers.filter((user) => `${user.name} ${user.email} ${user.role}`.toLowerCase().includes(search.toLowerCase()))
    const userLimit = summary?.limits?.users === undefined ? 10 : summary.limits.users
    const userLimitReached = userLimit !== null && workspaceUsers.length >= userLimit
    const openEditUser = (user: WorkspaceUser) => {
      setEditUser(user)
      setEditUserName(user.name)
      setEditUserEmail(user.email)
      setEditUserPassword('')
      setEditUserPasswordConfirmation('')
      setEditUserRoleId(String(user.role_id ?? ''))
      setEditUserError('')
    }
    const submitEditUser = async (event: FormEvent) => {
      event.preventDefault()
      if (!editUser) return
      setEditUserSaving(true)
      setEditUserError('')
      try {
        const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api'
        const token = localStorage.getItem('rentivo_access_token') ?? ''
        const response = await fetch(`${apiBaseUrl}/dashboard/users/${editUser.id}`, {
          method: 'PATCH',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            name: editUserName,
            email: editUserEmail,
            password: editUserPassword || undefined,
            password_confirmation: editUserPasswordConfirmation || undefined,
            role_id: editUser.role === 'owner' ? undefined : Number(editUserRoleId),
          }),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.message || 'Unable to update user')
        setEditUser(null)
        onUsersChanged?.()
      } catch (saveError) {
        setEditUserError(saveError instanceof Error ? saveError.message : 'Unable to update user')
      } finally {
        setEditUserSaving(false)
      }
    }
    const deleteUser = async (user: WorkspaceUser) => {
      setDeleteUserSaving(true)
      try {
        const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api'
        const token = localStorage.getItem('rentivo_access_token') ?? ''
        const response = await fetch(`${apiBaseUrl}/dashboard/users/${user.id}`, {
          method: 'DELETE',
          headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.message || 'Unable to delete user')
        setDeleteUserConfirmation(null)
        setEditUser(null)
        onUsersChanged?.()
      } catch (deleteError) {
        setEditUserError(deleteError instanceof Error ? deleteError.message : 'Unable to delete user')
      } finally {
        setDeleteUserSaving(false)
      }
    }
    const openAddUser = () => {
      setAddUserName('')
      setAddUserEmail('')
      setAddUserPassword('')
      setAddUserPasswordConfirmation('')
      setAddUserRoleId('')
      setAddUserError('')
      setAddUserOpen(true)
    }
    const submitAddUser = async (event: FormEvent) => {
      event.preventDefault()
      setAddUserSaving(true)
      setAddUserError('')
      try {
        const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api'
        const token = localStorage.getItem('rentivo_access_token') ?? ''
        const response = await fetch(`${apiBaseUrl}/dashboard/users`, {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            name: addUserName,
            email: addUserEmail,
            password: addUserPassword,
            password_confirmation: addUserPasswordConfirmation,
            role_id: Number(addUserRoleId),
          }),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.message || 'Unable to add user')
        setAddUserOpen(false)
        onUsersChanged?.()
      } catch (createError) {
        setAddUserError(createError instanceof Error ? createError.message : 'Unable to add user')
      } finally {
        setAddUserSaving(false)
      }
    }
    return (
      <motion.section initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-[#2c0f73]/10 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-semibold">Users</h2><p className="mt-1 text-sm text-[#8b8494]">{userLimit === null ? 'Unlimited users' : `${workspaceUsers.length} of ${userLimit} users used`}</p></div><button type="button" onClick={openAddUser} disabled={userLimitReached} className="cursor-pointer rounded-lg bg-[#5b21b6] px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50" title={userLimitReached ? 'This plan has reached its user limit.' : undefined}>+ Add user</button></div>
        {toolbar('Search name, email, or role', ['owner','staff','manager'])}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left">
            <thead><tr className="border-b border-[#eeeaf3] text-[11px] font-bold uppercase text-[#aaa4b4]"><th className="pb-3">Name</th><th className="pb-3">Email</th><th className="pb-3">Role</th><th className="pb-3 text-right">Actions</th></tr></thead>
            <tbody>{filtered.map((user) => <tr key={user.id} className="border-b border-[#f3f1f6] last:border-0"><td className="py-4 text-sm font-bold">{user.name}</td><td className="py-4 text-sm">{user.email}</td><td className="py-4"><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${user.role === 'owner' ? 'bg-[#ede9fe] text-[#6d28d9]' : 'bg-[#f3f4f6] text-[#686173]'}`}>{user.role === 'owner' ? 'Owner · Untamperable' : user.role}</span></td><td className="py-4 text-right"><button type="button" onClick={() => openEditUser(user)} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-3 py-2 text-xs font-bold text-[#5b21b6]">View / Edit</button></td></tr>)}</tbody>
          </table>
        </div>
        <AnimatePresence>{addUserOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] flex items-center justify-center bg-[#17141f]/55 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setAddUserOpen(false) }}>
            <motion.form initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.97, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} onSubmit={submitAddUser} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" aria-label="Add user">
              <div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5b21b6]">Organization access</p><h3 className="mt-2 text-xl font-bold">Add user</h3></div><button type="button" onClick={() => setAddUserOpen(false)} className="cursor-pointer text-2xl text-[#8b8494]" aria-label="Close">×</button></div>
              <div className="mt-5 grid gap-4">
                <label><span className="mb-2 block text-sm font-semibold">Full name</span><input value={addUserName} onChange={(event) => setAddUserName(event.target.value)} required className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label>
                <label><span className="mb-2 block text-sm font-semibold">Email</span><input type="email" value={addUserEmail} onChange={(event) => setAddUserEmail(event.target.value)} required className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label>
                <div className="grid gap-3 sm:grid-cols-2"><label><span className="mb-2 block text-sm font-semibold">Password</span><input type="password" value={addUserPassword} onChange={(event) => setAddUserPassword(event.target.value)} required minLength={8} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label><label><span className="mb-2 block text-sm font-semibold">Confirm password</span><input type="password" value={addUserPasswordConfirmation} onChange={(event) => setAddUserPasswordConfirmation(event.target.value)} required minLength={8} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label></div>
                <div><span className="mb-2 block text-sm font-semibold">Role</span><SearchableSelect name="add_user_role" value={addUserRoleId} placeholder="Select a role" required options={customRoles.map((role) => ({ value: String(role.id), label: role.name }))} onChange={setAddUserRoleId} /></div>
                {addUserError && <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{addUserError}</p>}
              </div>
              <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setAddUserOpen(false)} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-4 py-3 text-sm font-bold text-[#686173]">Cancel</button><button type="submit" disabled={addUserSaving} className="cursor-pointer rounded-lg bg-[#5b21b6] px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">{addUserSaving ? 'Adding...' : 'Add user'}</button></div>
            </motion.form>
          </motion.div>
        )}</AnimatePresence>
        <AnimatePresence>{editUser && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] flex justify-end bg-[#17141f]/55" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditUser(null) }}>
            <motion.form initial={prefersReducedMotion ? false : { x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ duration: 0.24, ease: 'easeOut' }} onSubmit={submitEditUser} className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-[-24px_0_60px_rgba(45,28,82,0.16)]" role="dialog" aria-modal="true" aria-label="Edit user">
              <div className="flex items-start justify-between border-b border-[#eeeaf3] pb-5"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5b21b6]">User profile</p><h3 className="mt-2 text-xl font-bold">{editUser.name}</h3></div><button type="button" onClick={() => setEditUser(null)} className="cursor-pointer text-2xl text-[#8b8494]" aria-label="Close">×</button></div>
              <div className="mt-6 grid gap-5">
                <label><span className="mb-2 block text-sm font-semibold">Full name</span><input value={editUserName} onChange={(event) => setEditUserName(event.target.value)} required className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label>
                <label><span className="mb-2 block text-sm font-semibold">Email</span><input type="email" value={editUserEmail} onChange={(event) => setEditUserEmail(event.target.value)} required className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label>
                <div><span className="mb-2 block text-sm font-semibold">Role</span>{editUser.role === 'owner' ? <div className="rounded-lg border border-[#dcd8e6] bg-[#faf9fc] px-4 py-3"><p className="font-bold text-[#6d28d9]">Owner</p><p className="mt-1 text-xs text-[#8b8494]">The Owner role is untamperable and has all permissions.</p></div> : <SearchableSelect name="edit_user_role" value={editUserRoleId} placeholder="Select a role" required options={customRoles.map((role) => ({ value: String(role.id), label: role.name }))} onChange={setEditUserRoleId} />}</div>
                <div className="grid gap-3 sm:grid-cols-2"><label><span className="mb-2 block text-sm font-semibold">New password <span className="font-normal text-[#8b8494]">(optional)</span></span><input type="password" value={editUserPassword} onChange={(event) => setEditUserPassword(event.target.value)} minLength={editUserPassword ? 8 : undefined} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label><label><span className="mb-2 block text-sm font-semibold">Confirm password</span><input type="password" value={editUserPasswordConfirmation} onChange={(event) => setEditUserPasswordConfirmation(event.target.value)} minLength={editUserPassword ? 8 : undefined} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label></div>
                {editUserError && <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{editUserError}</p>}
              </div>
              <div className="mt-8 flex items-center justify-between gap-3">
                {editUser.role !== 'owner'
                  ? <button type="button" onClick={() => setDeleteUserConfirmation(editUser)} className="cursor-pointer rounded-lg border border-red-200 px-4 py-3 text-sm font-bold text-red-600">Delete user</button>
                  : <span />}
                <div className="flex gap-3"><button type="button" onClick={() => setEditUser(null)} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-4 py-3 text-sm font-bold text-[#686173]">Cancel</button><button type="submit" disabled={editUserSaving} className="cursor-pointer rounded-lg bg-[#5b21b6] px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">{editUserSaving ? 'Saving...' : 'Save changes'}</button></div>
              </div>
            </motion.form>
          </motion.div>
        )}</AnimatePresence>
        {deleteUserConfirmation && (
          <ConfirmationModal
            title={`Delete ${deleteUserConfirmation.name}?`}
            description="This removes the user from this organization. Their user account may remain available if it belongs to another organization."
            confirmLabel="Delete user"
            tone="danger"
            confirming={deleteUserSaving}
            prefersReducedMotion={Boolean(prefersReducedMotion)}
            onCancel={() => setDeleteUserConfirmation(null)}
            onConfirm={() => deleteUser(deleteUserConfirmation)}
          />
        )}
      </motion.section>
    )
  }

  if (activeSection === 'Roles') {
    return <RolesSection />
  }

  if (['Fleet Utilization Report','Income Flow Report','Revenue','Commissions'].includes(activeSection)) {
    const paidPayments = payments.filter((payment) => payment.status === 'paid')
    const totalRevenue = paidPayments.reduce((total, payment) => total + Number(payment.amount), 0)
    const partnerCommissions = partners.reduce((total, partner) => total + (totalRevenue * Number(partner.commission_rate) / 100), 0)
    const sourceCommissions = bookingSources.reduce((total, source) => total + (totalRevenue * Number(source.commission_rate) / 100), 0)
    return (
      <motion.section initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="rounded-xl border border-[#2c0f73]/10 bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-semibold">{activeSection}</h2><p className="mt-1 text-sm text-[#8b8494]">Workspace performance at a glance</p></div><button type="button" onClick={() => window.print()} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-4 py-2.5 text-sm font-bold text-[#686173]">Export / Print</button></div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg bg-[#f7f6fb] p-5"><p className="text-sm text-[#8b8494]">{activeSection === 'Fleet Utilization Report' ? 'Fleet utilization' : 'Total revenue'}</p><p className="mt-2 text-2xl font-bold">{activeSection === 'Fleet Utilization Report' ? `${summary?.stats.fleet_utilization ?? 0}%` : `₱${totalRevenue.toLocaleString('en-PH')}`}</p></div>
            <div className="rounded-lg bg-[#f7f6fb] p-5"><p className="text-sm text-[#8b8494]">{activeSection === 'Commissions' ? 'Partner exposure' : 'Monthly revenue'}</p><p className="mt-2 text-2xl font-bold">{activeSection === 'Commissions' ? `₱${partnerCommissions.toLocaleString('en-PH')}` : `₱${(summary?.stats.month_revenue ?? 0).toLocaleString('en-PH')}`}</p></div>
            <div className="rounded-lg bg-[#f7f6fb] p-5"><p className="text-sm text-[#8b8494]">{activeSection === 'Income Flow Report' ? 'Collected payments' : 'Active bookings'}</p><p className="mt-2 text-2xl font-bold">{activeSection === 'Income Flow Report' ? paidPayments.length : summary?.stats.active_bookings ?? 0}</p></div>
            <div className="rounded-lg bg-[#f7f6fb] p-5"><p className="text-sm text-[#8b8494]">{activeSection === 'Commissions' ? 'Source exposure' : 'Vehicles'}</p><p className="mt-2 text-2xl font-bold">{activeSection === 'Commissions' ? `₱${sourceCommissions.toLocaleString('en-PH')}` : vehicles.length}</p></div>
          </div>
        </div>
      </motion.section>
    )
  }

  return null
}
