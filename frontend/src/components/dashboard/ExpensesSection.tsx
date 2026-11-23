import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ConfirmationModal } from './ConfirmationModal'
import SearchableSelect from '../SearchableSelect'

type Fund = { id: number; name: string; type: string }
type Vehicle = { id: number; name?: string; brand: string; model: string; year?: number; plate_number: string; image_url?: string; image_path?: string }
type Expense = {
  id: number
  title: string
  category: string
  vehicle_id?: number
  vehicle?: Vehicle
  expense_type?: string
  amount: number | string
  incurred_at: string
  fund_id?: number
  fund?: Fund
  reference?: string
  receipt_url?: string
  notes?: string
}
type ExpenseResponse = {
  expenses: Expense[]
  total_expenses: number
  month_expenses: number
  unit_expenses: number
  general_expenses: number
  funds: Fund[]
  vehicles: Vehicle[]
  categories: string[]
}

const money = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })
const dateNow = () => new Date().toISOString().slice(0, 16)
const generalExpenseTypes = ['Vehicle Insurance', 'Registration', 'LTO Fees', 'Cleaning & Detailing', 'Toll Fee', 'Parking', 'Fuel', 'Office Supplies', 'Utility Bills', 'Staff Salaries', 'Rent Taxes', 'Ads & Marketing', 'Transportation', 'Food', 'Personal Advance', 'Others']

const vehicleLabel = (vehicle: Vehicle) =>
  `${vehicle.name ? `${vehicle.name} - ` : ''}${vehicle.brand} ${vehicle.model}${vehicle.year ? ` (${vehicle.year})` : ''}`

const vehicleImageUrl = (vehicle: Vehicle, storageBaseUrl: string) => {
  const value = vehicle.image_url || vehicle.image_path
  if (!value) return ''
  if (value.startsWith('http')) return value
  if (value.startsWith('/')) return `${storageBaseUrl}${value}`
  return `${storageBaseUrl}/storage/${value.replace(/^storage\//, '')}`
}

export function ExpensesSection() {
  const prefersReducedMotion = useReducedMotion()
  const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api'
  const storageBaseUrl = apiBaseUrl.replace(/\/api\/?$/, '')
  const token = localStorage.getItem('rentivo_access_token') ?? ''
  const headers = { Accept: 'application/json', Authorization: `Bearer ${token}` }
  const [data, setData] = useState<ExpenseResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [sort, setSort] = useState('date_latest')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [confirmation, setConfirmation] = useState<Expense | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [title, setTitle] = useState('')
  const [expenseCategory, setExpenseCategory] = useState<'unit-related' | 'general'>('unit-related')
  const [vehicleId, setVehicleId] = useState('')
  const [expenseType, setExpenseType] = useState('')
  const [amount, setAmount] = useState('')
  const [incurredAt, setIncurredAt] = useState(dateNow())
  const [fundId, setFundId] = useState('')
  const [reference, setReference] = useState('')
  const [receipt, setReceipt] = useState<File | null>(null)
  const [notes, setNotes] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ sort })
      if (search.trim()) params.set('search', search.trim())
      if (categoryFilter) params.set('category', categoryFilter)
      const response = await fetch(`${apiBaseUrl}/dashboard/expenses?${params}`, { headers })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to load expenses')
      setData(result)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load expenses')
    } finally {
      setLoading(false)
    }
  }, [apiBaseUrl, categoryFilter, search, sort, token])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250)
    return () => window.clearTimeout(timer)
  }, [load])

  const resetForm = () => {
    setEditing(null)
    setTitle('')
    setExpenseCategory('unit-related')
    setVehicleId('')
    setExpenseType('')
    setAmount('')
    setIncurredAt(dateNow())
    setFundId('')
    setReference('')
    setReceipt(null)
    setNotes('')
  }

  const openCreate = () => {
    resetForm()
    setModalOpen(true)
  }

  const openEdit = (expense: Expense) => {
    setEditing(expense)
    setTitle(expense.title)
    setExpenseCategory(expense.category === 'unit-related' ? 'unit-related' : 'general')
    setVehicleId(expense.vehicle_id ? String(expense.vehicle_id) : '')
    setExpenseType(expense.expense_type ?? '')
    setAmount(String(expense.amount))
    setIncurredAt(expense.incurred_at.slice(0, 16))
    setFundId(expense.fund_id ? String(expense.fund_id) : '')
    setReference(expense.reference ?? '')
    setReceipt(null)
    setNotes(expense.notes ?? '')
    setModalOpen(true)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const form = new FormData()
      form.append('title', title)
      form.append('category', expenseCategory)
      if (expenseCategory === 'unit-related') form.append('vehicle_id', vehicleId)
      if (expenseCategory === 'general') form.append('expense_type', expenseType)
      form.append('amount', amount)
      form.append('incurred_at', incurredAt)
      form.append('fund_id', fundId)
      form.append('reference', reference)
      form.append('notes', notes)
      if (receipt) form.append('receipt', receipt)
      const response = await fetch(editing ? `${apiBaseUrl}/dashboard/expenses/${editing.id}` : `${apiBaseUrl}/dashboard/expenses`, {
        method: 'POST',
        headers,
        body: form,
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to save expense')
      setModalOpen(false)
      resetForm()
      await load()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save expense')
    } finally {
      setSaving(false)
    }
  }

  const deleteExpense = async (expense: Expense) => {
    setConfirming(true)
    try {
      const response = await fetch(`${apiBaseUrl}/dashboard/expenses/${expense.id}`, { method: 'DELETE', headers })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to delete expense')
      setConfirmation(null)
      await load()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete expense')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <motion.section initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-2xl font-semibold">Expenses</h2><p className="mt-1 text-sm text-[#8b8494]">Track operating costs and receipts</p></div>
        <button type="button" onClick={openCreate} className="cursor-pointer rounded-lg bg-[#5b21b6] px-4 py-2.5 text-sm font-bold text-white">Add expense</button>
      </div>
      {error && <p className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[#2c0f73]/10 bg-white p-5"><p className="text-sm text-[#8b8494]">Total expenses</p><p className="mt-2 text-2xl font-bold text-[#b91c1c]">{money.format(Number(data?.total_expenses ?? 0))}</p></div>
        <div className="rounded-xl border border-[#2c0f73]/10 bg-white p-5"><p className="text-sm text-[#8b8494]">Unit-Related</p><p className="mt-2 text-2xl font-bold">{money.format(Number(data?.unit_expenses ?? 0))}</p></div>
        <div className="rounded-xl border border-[#2c0f73]/10 bg-white p-5"><p className="text-sm text-[#8b8494]">General Expense</p><p className="mt-2 text-2xl font-bold">{money.format(Number(data?.general_expenses ?? 0))}</p></div>
      </div>
      <div className="rounded-xl border border-[#2c0f73]/10 bg-white p-5">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_180px]">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search expenses, reference, unit..." className="rounded-lg border border-[#dcd8e6] px-4 py-2.5 text-sm" />
          <SearchableSelect name="category_filter" value={categoryFilter} placeholder="All categories" options={[{ value: '', label: 'All categories' }, { value: 'unit-related', label: 'Unit-Related' }, { value: 'general', label: 'General Expense' }]} onChange={setCategoryFilter} />
          <SearchableSelect name="expense_sort" value={sort} placeholder="Sort expenses" options={[{ value: 'date_latest', label: 'Newest first' }, { value: 'date_oldest', label: 'Oldest first' }, { value: 'amount_desc', label: 'Highest amount' }, { value: 'amount_asc', label: 'Lowest amount' }]} onChange={setSort} />
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead><tr className="border-b border-[#eeeaf3] text-[10px] uppercase tracking-widest text-[#8b8494]"><th className="p-4">Expense</th><th className="p-4">Category</th><th className="p-4">Unit / Expense Type</th><th className="p-4">Date</th><th className="p-4">Fund</th><th className="p-4 text-right">Amount</th><th className="p-4 text-right">Actions</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="p-8 text-center text-[#8b8494]">Loading expenses...</td></tr> : data?.expenses.map((expense) => (
                <tr key={expense.id} className="border-b border-[#f3f1f6] last:border-0">
                  <td className="p-4"><p className="font-semibold">{expense.title}</p>{expense.reference && <p className="mt-1 text-xs text-[#8b8494]">{expense.reference}</p>}</td>
                  <td className="p-4"><span className="rounded-full bg-[#f1eef6] px-2 py-1 text-xs font-semibold text-[#686173]">{expense.category === 'unit-related' ? 'Unit-Related' : 'General Expense'}</span></td>
                  <td className="p-4 text-[#686173]">{expense.category === 'unit-related' ? (expense.vehicle ? vehicleLabel(expense.vehicle) : '—') : (expense.expense_type || '—')}</td>
                  <td className="p-4 text-[#686173]">{new Date(expense.incurred_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</td>
                  <td className="p-4 text-[#686173]">{expense.fund?.name || 'No fund'}</td>
                  <td className="p-4 text-right font-bold text-[#b91c1c]">-{money.format(Number(expense.amount))}</td>
                  <td className="p-4 text-right"><div className="flex justify-end gap-2">{expense.receipt_url && <a href={expense.receipt_url.startsWith('http') ? expense.receipt_url : `${storageBaseUrl}${expense.receipt_url}`} target="_blank" rel="noreferrer" className="cursor-pointer rounded-lg border border-[#dcd8e6] px-2.5 py-1.5 text-xs font-bold text-[#686173]">Receipt</a>}<button type="button" onClick={() => openEdit(expense)} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-2.5 py-1.5 text-xs font-bold text-[#5b21b6]">Edit</button><button type="button" onClick={() => setConfirmation(expense)} className="cursor-pointer rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-bold text-red-600">Delete</button></div></td>
                </tr>
              ))}
              {!loading && !data?.expenses.length && <tr><td colSpan={7} className="p-8 text-center text-[#8b8494]">No expenses found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <AnimatePresence>{modalOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] flex items-center justify-center bg-[#17141f]/55 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false) }}>
          <motion.form initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.97, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} onSubmit={submit} className="max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" aria-label={editing ? 'Edit expense' : 'Add expense'}>
            <div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5b21b6]">Operating cost</p><h3 className="mt-2 text-xl font-bold">{editing ? 'Edit expense' : 'Add expense'}</h3></div><button type="button" onClick={() => setModalOpen(false)} className="cursor-pointer text-2xl text-[#8b8494]" aria-label="Close">×</button></div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2"><span className="mb-2 block text-sm font-semibold">Expense title</span><input value={title} onChange={(event) => setTitle(event.target.value)} required className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" placeholder="e.g. Vehicle oil change" /></label>
              <fieldset className="sm:col-span-2"><legend className="mb-2 block text-sm font-semibold">Expense category</legend><div className="grid gap-3 sm:grid-cols-2"><label className={`cursor-pointer rounded-xl border p-4 ${expenseCategory === 'unit-related' ? 'border-[#5b21b6] bg-[#ede9fe] ring-2 ring-[#c4b5fd]' : 'border-[#dcd8e6]'}`}><input type="radio" name="expense-category" checked={expenseCategory === 'unit-related'} onChange={() => setExpenseCategory('unit-related')} className="mr-2" />Unit-Related</label><label className={`cursor-pointer rounded-xl border p-4 ${expenseCategory === 'general' ? 'border-[#5b21b6] bg-[#ede9fe] ring-2 ring-[#c4b5fd]' : 'border-[#dcd8e6]'}`}><input type="radio" name="expense-category" checked={expenseCategory === 'general'} onChange={() => setExpenseCategory('general')} className="mr-2" />General Expense</label></div></fieldset>
              {expenseCategory === 'unit-related'
                ? <div className="sm:col-span-2"><span className="mb-2 block text-sm font-semibold">Select unit</span><SearchableSelect name="vehicle_id" value={vehicleId} placeholder="Search and select a unit" required options={(data?.vehicles ?? []).map((vehicle) => ({ value: String(vehicle.id), label: vehicleLabel(vehicle), searchText: `${vehicle.plate_number} ${vehicle.name ?? ''} ${vehicle.brand} ${vehicle.model} ${vehicle.year ?? ''}` }))} onChange={setVehicleId} renderOption={(option) => { const vehicle = data?.vehicles.find((item) => String(item.id) === option.value); if (!vehicle) return <span>{option.label}</span>; const image = vehicleImageUrl(vehicle, storageBaseUrl); return <span className="flex min-w-0 items-center gap-3">{image ? <img src={image} alt="" className="h-12 w-16 shrink-0 rounded-lg object-cover" /> : <span className="flex h-12 w-16 shrink-0 items-center justify-center rounded-lg bg-[#ede9fe] text-[#5b21b6]">🚗</span>}<span className="min-w-0"><span className="block truncate font-semibold">{vehicleLabel(vehicle)}</span><span className="mt-1 block text-xs text-[#8b8494]">{vehicle.plate_number} · Unit details</span></span></span> }} renderValue={(option) => { const vehicle = data?.vehicles.find((item) => String(item.id) === option.value); if (!vehicle) return <span>{option.label}</span>; const image = vehicleImageUrl(vehicle, storageBaseUrl); return <span className="flex min-w-0 items-center gap-3">{image ? <img src={image} alt="" className="h-9 w-12 shrink-0 rounded-md object-cover" /> : <span className="flex h-9 w-12 shrink-0 items-center justify-center rounded-md bg-[#ede9fe] text-[#5b21b6]">🚗</span>}<span className="min-w-0"><span className="block truncate font-semibold">{vehicleLabel(vehicle)}</span><span className="block truncate text-xs text-[#8b8494]">{vehicle.plate_number}</span></span></span> }} /></div>
                : <div className="sm:col-span-2"><span className="mb-2 block text-sm font-semibold">General expense category</span><SearchableSelect name="expense_type" value={expenseType} placeholder="Choose a category" required options={generalExpenseTypes.map((item) => ({ value: item, label: item }))} onChange={setExpenseType} /></div>}
              <label><span className="mb-2 block text-sm font-semibold">Amount</span><input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label>
              <label><span className="mb-2 block text-sm font-semibold">Date and time</span><input type="datetime-local" value={incurredAt} onChange={(event) => setIncurredAt(event.target.value)} required className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label>
              <div><span className="mb-2 block text-sm font-semibold">Fund account <span className="font-normal text-[#8b8494]">(optional)</span></span><SearchableSelect name="fund_id" value={fundId} placeholder="No fund" options={[{ value: '', label: 'No fund' }, ...(data?.funds ?? []).map((fund) => ({ value: String(fund.id), label: fund.name, searchText: fund.type }))]} onChange={setFundId} /></div>
              <label><span className="mb-2 block text-sm font-semibold">Reference number</span><input value={reference} onChange={(event) => setReference(event.target.value)} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label>
              <div className="block"><span className="mb-2 block text-sm font-semibold">Receipt / invoice <span className="font-normal text-[#8b8494]">(optional)</span></span><input id="expense-receipt" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={(event) => setReceipt(event.target.files?.[0] ?? null)} className="hidden" /><label htmlFor="expense-receipt" className="flex cursor-pointer items-center justify-between rounded-lg border border-dashed border-[#bdb4cd] bg-[#faf9fc] px-4 py-3 text-sm transition hover:border-[#6d28d9] hover:bg-[#f4f1fa]"><span className={receipt ? 'truncate font-semibold text-[#40384b]' : 'text-[#8b8494]'}>{receipt ? receipt.name : 'Choose file'}</span><span className="ml-3 shrink-0 rounded-md bg-[#ede9fe] px-3 py-1.5 text-xs font-bold text-[#5b21b6]">Browse</span></label></div>
              <label className="sm:col-span-2"><span className="mb-2 block text-sm font-semibold">Notes <span className="font-normal text-[#8b8494]">(optional)</span></span><textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label>
            </div>
            <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setModalOpen(false)} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-4 py-3 text-sm font-bold text-[#686173]">Cancel</button><button type="submit" disabled={saving} className="cursor-pointer rounded-lg bg-[#5b21b6] px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">{saving ? 'Saving...' : editing ? 'Save changes' : 'Add expense'}</button></div>
          </motion.form>
        </motion.div>
      )}</AnimatePresence>
      {confirmation && <ConfirmationModal title="Delete expense?" description={`This will permanently delete ${confirmation.title} and remove its linked fund transaction.`} confirmLabel="Delete expense" tone="danger" confirming={confirming} prefersReducedMotion={Boolean(prefersReducedMotion)} onCancel={() => setConfirmation(null)} onConfirm={() => deleteExpense(confirmation)} />}
    </motion.section>
  )
}
