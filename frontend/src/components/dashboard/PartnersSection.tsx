import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useMemo, useState, type FormEvent } from 'react'
import type { Partner } from '../../pages/dashboardTypes'
import { ConfirmationModal } from './ConfirmationModal'

type Props = {
  partners: Partner[]
  onChanged: () => void | Promise<void>
}

export function PartnersSection({ partners, onChanged }: Props) {
  const prefersReducedMotion = useReducedMotion()
  const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api'
  const token = localStorage.getItem('rentivo_access_token') ?? ''
  const authHeaders = { Accept: 'application/json', Authorization: `Bearer ${token}` }
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Partner | null>(null)
  const [selected, setSelected] = useState<Partner | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmation, setConfirmation] = useState<Partner | null>(null)
  const [confirming, setConfirming] = useState(false)

  const [name, setName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [commissionRate, setCommissionRate] = useState('0')
  const [status, setStatus] = useState<'active' | 'inactive'>('active')
  const [notes, setNotes] = useState('')

  const filtered = useMemo(() => partners.filter((partner) => {
    const searchable = `${partner.name} ${partner.first_name ?? ''} ${partner.middle_name ?? ''} ${partner.last_name ?? ''} ${partner.email ?? ''} ${partner.phone ?? ''} ${partner.address ?? ''}`.toLowerCase()
    return searchable.includes(search.toLowerCase()) && (statusFilter === 'all' || partner.status === statusFilter)
  }), [partners, search, statusFilter])

  const reset = () => {
    setEditing(null)
    setName('')
    setFirstName('')
    setMiddleName('')
    setLastName('')
    setEmail('')
    setPhone('')
    setAddress('')
    setCommissionRate('0')
    setStatus('active')
    setNotes('')
    setError('')
  }

  const openCreate = () => {
    reset()
    setModalOpen(true)
  }

  const openEdit = (partner: Partner) => {
    setEditing(partner)
    setName(partner.name)
    setFirstName(partner.first_name ?? '')
    setMiddleName(partner.middle_name ?? '')
    setLastName(partner.last_name ?? '')
    setEmail(partner.email ?? '')
    setPhone(partner.phone ?? '')
    setAddress(partner.address ?? '')
    setCommissionRate(String(partner.commission_rate ?? 0))
    setStatus(partner.status === 'inactive' ? 'inactive' : 'active')
    setNotes(partner.notes ?? '')
    setError('')
    setModalOpen(true)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        name,
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        email: email || null,
        phone: phone || null,
        address: address || null,
        notes: notes || null,
        commission_rate: Number(commissionRate || 0),
        status,
      }
      const response = await fetch(editing ? `${apiBaseUrl}/dashboard/partners/${editing.id}` : `${apiBaseUrl}/dashboard/partners`, {
        method: editing ? 'PUT' : 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to save partner')
      setModalOpen(false)
      reset()
      await onChanged()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save partner')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (partner: Partner) => {
    try {
      const response = await fetch(`${apiBaseUrl}/dashboard/partners/${partner.id}`, { method: 'DELETE', headers: authHeaders })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to delete partner')
      if (selected?.id === partner.id) setSelected(null)
      await onChanged()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete partner')
    }
  }

  const displayName = (partner: Partner) => partner.name || [partner.first_name, partner.middle_name, partner.last_name].filter(Boolean).join(' ')

  return (
    <motion.section initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-[#2c0f73]/10 bg-white p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Partners</h2>
        <button type="button" onClick={openCreate} className="cursor-pointer rounded-lg bg-[#5b21b6] px-4 py-3 text-sm font-bold text-white">+ Add partner</button>
      </div>
      {error && <p className="mt-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="mb-5 mt-5 flex flex-col gap-3 sm:flex-row">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search partner name, email, or phone" className="w-full flex-1 rounded-lg border border-[#dcd8e6] px-3 py-2.5 text-sm outline-none focus:border-[#6d28d9]" />
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-3 py-2.5 text-sm"><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left">
          <thead><tr className="border-b border-[#eeeaf3] text-[11px] font-bold uppercase text-[#aaa4b4]"><th className="pb-3">Partner</th><th className="pb-3">Contact</th><th className="pb-3">Commission</th><th className="pb-3">Status</th><th className="pb-3 text-right">Actions</th></tr></thead>
          <tbody>
            {filtered.map((partner) => (
              <tr key={partner.id} className="border-b border-[#f3f1f6] last:border-0">
                <td className="py-4"><button type="button" onClick={() => setSelected(partner)} className="cursor-pointer text-left"><span className="block text-sm font-bold text-[#21142f] hover:text-[#5b21b6]">{displayName(partner)}</span><span className="mt-0.5 block max-w-[220px] truncate text-xs text-[#8b8494]">{partner.address || 'No address'}</span></button></td>
                <td className="py-4 text-sm">{partner.email || partner.phone || '—'}{partner.phone && partner.email && <span className="mt-1 block text-xs text-[#8b8494]">{partner.phone}</span>}</td>
                <td className="py-4 text-sm font-bold">{Number(partner.commission_rate).toLocaleString('en-PH')}%</td>
                <td className="py-4"><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${partner.status === 'active' ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#f3f4f6] text-[#686173]'}`}>{partner.status}</span></td>
                <td className="py-4"><div className="flex justify-end gap-2"><button type="button" onClick={() => setSelected(partner)} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-3 py-2 text-xs font-bold text-[#40384b]">Profile</button><button type="button" onClick={() => openEdit(partner)} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-3 py-2 text-xs font-bold text-[#5b21b6]">Edit</button><button type="button" onClick={() => setConfirmation(partner)} className="cursor-pointer rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600">Delete</button></div></td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={5} className="py-10 text-center text-sm text-[#8b8494]">No partners match your search.</td></tr>}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {modalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-[#17141f]/55 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false) }}>
            <motion.form initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} onSubmit={submit} className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl sm:p-6" role="dialog" aria-modal="true" aria-label={editing ? 'Edit partner' : 'Add partner'}>
              <div className="flex items-center justify-between"><h2 className="text-xl font-bold">{editing ? 'Edit partner' : 'Add partner'}</h2><button type="button" onClick={() => setModalOpen(false)} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-2xl text-[#8b8494] hover:bg-[#f7f6fb]" aria-label="Close">×</button></div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2"><span className="mb-2 block text-sm font-semibold">Display name</span><input name="name" required value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label>
                <label><span className="mb-2 block text-sm font-semibold">First name</span><input value={firstName} onChange={(event) => setFirstName(event.target.value)} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label>
                <label><span className="mb-2 block text-sm font-semibold">Middle name</span><input value={middleName} onChange={(event) => setMiddleName(event.target.value)} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label>
                <label><span className="mb-2 block text-sm font-semibold">Last name</span><input value={lastName} onChange={(event) => setLastName(event.target.value)} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label>
                <label><span className="mb-2 block text-sm font-semibold">Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label>
                <label><span className="mb-2 block text-sm font-semibold">Phone</span><input value={phone} onChange={(event) => setPhone(event.target.value)} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label>
                <label className="sm:col-span-2"><span className="mb-2 block text-sm font-semibold">Address</span><textarea rows={3} value={address} onChange={(event) => setAddress(event.target.value)} className="w-full resize-y rounded-lg border border-[#dcd8e6] px-4 py-3" /></label>
                <label><span className="mb-2 block text-sm font-semibold">Commission rate (%)</span><input type="number" min="0" max="100" step="0.01" value={commissionRate} onChange={(event) => setCommissionRate(event.target.value)} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label>
                <label><span className="mb-2 block text-sm font-semibold">Status</span><select value={status} onChange={(event) => setStatus(event.target.value as 'active' | 'inactive')} className="w-full cursor-pointer rounded-lg border border-[#dcd8e6] px-4 py-3"><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
                <label className="sm:col-span-2"><span className="mb-2 block text-sm font-semibold">Notes</span><textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} className="w-full resize-y rounded-lg border border-[#dcd8e6] px-4 py-3" /></label>
              </div>
              {error && <p className="mt-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setModalOpen(false)} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-4 py-3 text-sm font-bold text-[#686173]">Cancel</button><button type="submit" disabled={saving} className="cursor-pointer rounded-lg bg-[#5b21b6] px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">{saving ? 'Saving...' : editing ? 'Save changes' : 'Save partner'}</button></div>
            </motion.form>
          </motion.div>
        )}

        {selected && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[65] bg-[#17141f]/40 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null) }}>
            <motion.aside initial={prefersReducedMotion ? false : { x: '100%' }} animate={{ x: 0 }} exit={prefersReducedMotion ? undefined : { x: '100%' }} transition={{ duration: 0.28, ease: 'easeOut' }} className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col bg-white shadow-[-24px_0_60px_rgba(45,28,82,0.16)]" role="dialog" aria-modal="true" aria-label={`${displayName(selected)} profile`}>
              <div className="flex shrink-0 items-start justify-between border-b border-[#eeeaf3] px-5 py-5 sm:px-7"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#5b21b6]">Partner profile</p><h2 className="mt-1 text-2xl font-semibold">{displayName(selected)}</h2></div><button type="button" onClick={() => setSelected(null)} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-2xl text-[#8b8494] hover:bg-[#f7f6fb]" aria-label="Close">×</button></div>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-7">
                <div className="flex items-center justify-between gap-3"><span className={`rounded-full px-3 py-1.5 text-xs font-bold ${selected.status === 'active' ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#f3f4f6] text-[#686173]'}`}>{selected.status}</span><button type="button" onClick={() => { setSelected(null); openEdit(selected) }} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-4 py-2.5 text-sm font-bold text-[#5b21b6] hover:bg-[#f7f6fb]">Edit partner</button></div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {[['Email', selected.email ?? '—'], ['Phone', selected.phone ?? '—'], ['Commission', `${Number(selected.commission_rate).toLocaleString('en-PH')}%`], ['Address', selected.address ?? '—']].map(([label, value]) => <div key={label} className="rounded-xl bg-[#f7f6fb] p-4"><p className="text-xs font-semibold text-[#8b8494]">{label}</p><p className="mt-1 whitespace-pre-wrap text-sm font-bold text-[#21142f]">{value}</p></div>)}
                  {selected.notes && <div className="rounded-xl border border-[#e5e1ed] p-4 sm:col-span-2"><p className="text-xs text-[#8b8494]">Notes</p><p className="mt-2 whitespace-pre-wrap text-sm">{selected.notes}</p></div>}
                </div>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>{confirmation && (
        <ConfirmationModal
          title={`Delete ${confirmation.name}?`}
          description="This permanently removes the partner profile. This action cannot be undone."
          confirmLabel="Delete partner"
          tone="danger"
          confirming={confirming}
          prefersReducedMotion={Boolean(prefersReducedMotion)}
          onCancel={() => setConfirmation(null)}
          onConfirm={async () => {
            setConfirming(true)
            try {
              await remove(confirmation)
            } finally {
              setConfirming(false)
              setConfirmation(null)
            }
          }}
        />
      )}</AnimatePresence>
    </motion.section>
  )
}
