import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { ConfirmationModal } from './ConfirmationModal'

type Role = {
  id: number
  name: string
  description?: string
  permissions: string[]
  is_owner: boolean
  is_active: boolean
  memberships_count?: number
}

const permissionGroups: Record<string, string[]> = {
  'Access Control': ['Roles Create', 'Roles Delete', 'Roles Update', 'Roles View', 'Users Create', 'Users Deactivate', 'Users Update', 'Users View'],
  Bookings: ['Bookings Cancel', 'Generate and Manage Booking Contracts', 'Sign booking contracts for the company', 'Bookings Create', 'Bookings Delete', 'Bookings Payments', 'Bookings Print', 'Bookings Update', 'Bookings View'],
  Calendar: ['Calendar View'],
  Customers: ['Customers Create', 'Customers Delete', 'Customers Requirements', 'Customers Update', 'Customers View'],
  Dashboard: ['Dashboard View'],
  Finance: ['Expenses Create', 'Expenses Delete', 'Expenses Export', 'Expenses Update', 'Expenses View', 'Funds Create', 'Funds Delete', 'Funds Update', 'Funds View'],
  Fleet: ['Vehicle Documents Create', 'Vehicle Documents Delete', 'Vehicle Documents Update', 'Vehicle Documents View', 'Vehicle Create', 'Vehicle Delete', 'Vehicle Update', 'Vehicle View'],
  Partners: ['Partners Create', 'Partners Delete', 'Partners Tokens', 'Partners Update', 'Partners View'],
  Reports: ['Reports Financial', 'Reports View'],
  Reservations: ['Reservations Approve', 'Reservations Cancel', 'Reservations Update', 'Reservations View'],
  Settings: ['Settings Update', 'Settings View'],
  Subscription: ['Subscription Manage', 'Subscription View'],
}

export function RolesSection() {
  const prefersReducedMotion = useReducedMotion()
  const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api'
  const token = localStorage.getItem('rentivo_access_token') ?? ''
  const headers = { Accept: 'application/json', Authorization: `Bearer ${token}` }
  const [roles, setRoles] = useState<Role[]>([])
  const [owner, setOwner] = useState<Role | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Role | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [permissions, setPermissions] = useState<string[]>([])
  const [confirmation, setConfirmation] = useState<Role | null>(null)
  const [confirming, setConfirming] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`${apiBaseUrl}/dashboard/roles`, { headers })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to load roles')
      setRoles(data.roles ?? [])
      setOwner(data.owner ?? null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load roles')
    } finally {
      setLoading(false)
    }
  }, [apiBaseUrl, token])

  useEffect(() => { void load() }, [load])

  const allPermissions = useMemo(() => Object.values(permissionGroups).flat(), [])
  const filtered = roles.filter((role) => `${role.name} ${role.description ?? ''}`.toLowerCase().includes(search.toLowerCase()))

  const resetForm = (role: Role | null = null) => {
    setEditing(role)
    setName(role?.name ?? '')
    setDescription(role?.description ?? '')
    setPermissions(role?.permissions ?? [])
  }

  const openCreate = () => {
    resetForm()
    setModalOpen(true)
  }

  const openEdit = (role: Role) => {
    resetForm(role)
    setModalOpen(true)
  }

  const togglePermission = (permission: string) => {
    setPermissions((current) => current.includes(permission) ? current.filter((item) => item !== permission) : [...current, permission])
  }

  const toggleGroup = (groupPermissions: string[]) => {
    const everySelected = groupPermissions.every((permission) => permissions.includes(permission))
    setPermissions((current) => everySelected
      ? current.filter((permission) => !groupPermissions.includes(permission))
      : Array.from(new Set([...current, ...groupPermissions])))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const response = await fetch(editing ? `${apiBaseUrl}/dashboard/roles/${editing.id}` : `${apiBaseUrl}/dashboard/roles`, {
        method: editing ? 'PATCH' : 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, permissions }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to save role')
      setModalOpen(false)
      resetForm()
      await load()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save role')
    } finally {
      setSaving(false)
    }
  }

  const deleteRole = async (role: Role) => {
    setConfirming(true)
    try {
      const response = await fetch(`${apiBaseUrl}/dashboard/roles/${role.id}`, { method: 'DELETE', headers })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to delete role')
      setConfirmation(null)
      await load()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete role')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <motion.section initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-2xl font-semibold">Roles</h2><p className="mt-1 text-sm text-[#8b8494]">Create roles and control workspace permissions.</p></div>
        <button type="button" onClick={openCreate} className="cursor-pointer rounded-lg bg-[#5b21b6] px-4 py-2.5 text-sm font-bold text-white">+ Create role</button>
      </div>
      {error && <p className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}
      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search roles" className="w-full rounded-lg border border-[#dcd8e6] px-4 py-2.5 text-sm sm:max-w-sm" />

      {owner && (
        <div className="rounded-xl border border-[#dcd8e6] bg-[#faf9fc] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h3 className="text-lg font-bold">Owner</h3><span className="rounded-full bg-[#ede9fe] px-2.5 py-1 text-[10px] font-bold text-[#5b21b6]">SYSTEM ROLE</span></div><p className="mt-1 text-sm text-[#686173]">{owner.description}</p></div><span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#15803d]">{owner.memberships_count ?? 0} owner account(s)</span></div>
          <p className="mt-4 text-xs font-semibold text-[#8b8494]">All permissions · Cannot be edited or deleted</p>
        </div>
      )}

      {loading ? <div className="rounded-xl border border-[#2c0f73]/10 bg-white p-8 text-center text-sm text-[#8b8494]">Loading roles...</div> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((role) => (
            <div key={role.id} className="rounded-xl border border-[#2c0f73]/10 bg-white p-5">
              <div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">{role.name}</h3><p className="mt-1 min-h-10 text-sm text-[#686173]">{role.description || 'No description'}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${role.is_active ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#f3f4f6] text-[#686173]'}`}>{role.is_active ? 'Active' : 'Inactive'}</span></div>
              <p className="mt-4 text-xs font-semibold text-[#8b8494]">{role.permissions.length} of {allPermissions.length} permissions · {role.memberships_count ?? 0} user(s)</p>
              <div className="mt-4 flex gap-2"><button type="button" onClick={() => openEdit(role)} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-3 py-2 text-xs font-bold text-[#5b21b6]">Edit permissions</button><button type="button" onClick={() => setConfirmation(role)} className="cursor-pointer rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600">Delete</button></div>
            </div>
          ))}
          {!filtered.length && <div className="col-span-full rounded-xl border border-dashed border-[#dcd8e6] bg-white py-12 text-center text-sm text-[#8b8494]">No custom roles found.</div>}
        </div>
      )}

      <AnimatePresence>{modalOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] flex items-center justify-center bg-[#17141f]/55 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false) }}>
          <motion.form initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.97, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} onSubmit={submit} className="max-h-[calc(100dvh-2rem)] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" aria-label={editing ? 'Edit role' : 'Create role'}>
            <div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5b21b6]">Access control</p><h3 className="mt-2 text-xl font-bold">{editing ? 'Edit role' : 'Create role'}</h3></div><button type="button" onClick={() => setModalOpen(false)} className="cursor-pointer text-2xl text-[#8b8494]" aria-label="Close">×</button></div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label><span className="mb-2 block text-sm font-semibold">Role name</span><input value={name} onChange={(event) => setName(event.target.value)} required maxLength={100} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" placeholder="e.g. Operations Manager" /></label>
              <label><span className="mb-2 block text-sm font-semibold">Description</span><input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" placeholder="Brief role summary" /></label>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {Object.entries(permissionGroups).map(([group, groupPermissions]) => {
                const everySelected = groupPermissions.every((permission) => permissions.includes(permission))
                return (
                  <div key={group} className="rounded-xl border border-[#e5e1ed] p-4">
                    <button type="button" onClick={() => toggleGroup(groupPermissions)} className="flex w-full cursor-pointer items-center justify-between text-left"><span className="text-sm font-bold">{group}</span><span className={`text-xs font-bold ${everySelected ? 'text-[#5b21b6]' : 'text-[#8b8494]'}`}>{everySelected ? 'Clear' : 'Select all'}</span></button>
                    <div className="mt-3 space-y-2">
                      {groupPermissions.map((permission) => (
                        <label key={permission} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm text-[#40384b] hover:bg-[#faf9fc]"><input type="checkbox" checked={permissions.includes(permission)} onChange={() => togglePermission(permission)} className="h-4 w-4 accent-[#5b21b6]" /><span>{permission}</span></label>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setModalOpen(false)} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-4 py-3 text-sm font-bold text-[#686173]">Cancel</button><button type="submit" disabled={saving} className="cursor-pointer rounded-lg bg-[#5b21b6] px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">{saving ? 'Saving...' : editing ? 'Save role' : 'Create role'}</button></div>
          </motion.form>
        </motion.div>
      )}</AnimatePresence>
      {confirmation && <ConfirmationModal title="Delete role?" description={`This permanently deletes the ${confirmation.name} role. It cannot be deleted while users are assigned to it.`} confirmLabel="Delete role" tone="danger" confirming={confirming} prefersReducedMotion={Boolean(prefersReducedMotion)} onCancel={() => setConfirmation(null)} onConfirm={() => deleteRole(confirmation)} />}
    </motion.section>
  )
}
