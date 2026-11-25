import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { ConfirmationModal } from './ConfirmationModal'
import { useSubscriptionReadOnly } from './SubscriptionReadOnlyContext'

type Fund = {
  id: number
  name: string
  type: 'cash' | 'bank' | 'e-wallet' | 'other'
  opening_balance: number | string
  account_name?: string
  account_number?: string
  qr_code_url?: string
  notes?: string
  balance: number | string
}

type FundTransaction = {
  id: number
  fund_id: number
  type: 'inflow' | 'outflow'
  transacted_at: string
  amount: number | string
  description: string
  notes?: string
  transfer_reference?: string
  payment?: { provider?: string }
  fund?: { id: number; name: string; type: string }
}

type FundsResponse = {
  funds: Fund[]
  transactions: FundTransaction[]
  total_balance: number
  total_inflows: number
  total_outflows: number
}

const money = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })
const dateNow = () => new Date().toISOString().slice(0, 16)
const dateLabel = (value: string) => new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })

export function FundsSection() {
  const prefersReducedMotion = useReducedMotion()
  const subscriptionReadOnly = useSubscriptionReadOnly()
  const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api'
  const storageBaseUrl = apiBaseUrl.replace(/\/api\/?$/, '')
  const token = localStorage.getItem('rentivo_access_token') ?? ''
  const headers = { Accept: 'application/json', Authorization: `Bearer ${token}` }

  const [data, setData] = useState<FundsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [fundFilter, setFundFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [sort, setSort] = useState('date_latest')
  const [modal, setModal] = useState<'fund' | 'transaction' | 'transfer' | null>(null)
  const [editingFund, setEditingFund] = useState<Fund | null>(null)
  const [editingTransaction, setEditingTransaction] = useState<FundTransaction | null>(null)
  const [selectedTransaction, setSelectedTransaction] = useState<FundTransaction | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmation, setConfirmation] = useState<{ title: string; description: string; confirmLabel: string; action: () => void | Promise<void> } | null>(null)
  const [confirming, setConfirming] = useState(false)

  const [name, setName] = useState('')
  const [fundType, setFundType] = useState<'cash' | 'bank' | 'e-wallet' | 'other'>('cash')
  const [opening, setOpening] = useState('0')
  const [accountName, setAccountName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [qrCode, setQrCode] = useState<File | null>(null)
  const [fundNotes, setFundNotes] = useState('')

  const [transactionType, setTransactionType] = useState<'inflow' | 'outflow'>('inflow')
  const [transactionFund, setTransactionFund] = useState('')
  const [transactedAt, setTransactedAt] = useState(dateNow())
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [transactionNotes, setTransactionNotes] = useState('')

  const [sourceFund, setSourceFund] = useState('')
  const [destinationFund, setDestinationFund] = useState('')
  const [transferDate, setTransferDate] = useState(dateNow())
  const [transferAmount, setTransferAmount] = useState('')
  const [transferNotes, setTransferNotes] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ sort })
      if (search.trim()) params.set('search', search.trim())
      if (fundFilter) params.set('fund_id', fundFilter)
      if (typeFilter) params.set('type', typeFilter)
      const response = await fetch(`${apiBaseUrl}/dashboard/funds?${params}`, { headers })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to load funds')
      setData(result)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load funds')
    } finally {
      setLoading(false)
    }
  }, [apiBaseUrl, fundFilter, search, sort, typeFilter, token])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250)
    return () => window.clearTimeout(timer)
  }, [load])

  const resetFund = () => {
    setEditingFund(null)
    setName('')
    setFundType('cash')
    setOpening('0')
    setAccountName('')
    setAccountNumber('')
    setQrCode(null)
    setFundNotes('')
  }

  const resetTransaction = () => {
    setEditingTransaction(null)
    setTransactionType('inflow')
    setTransactionFund(data?.funds[0] ? String(data.funds[0].id) : '')
    setTransactedAt(dateNow())
    setAmount('')
    setDescription('')
    setTransactionNotes('')
  }

  const resetTransfer = () => {
    setSourceFund(data?.funds[0] ? String(data.funds[0].id) : '')
    setDestinationFund(data?.funds[1] ? String(data.funds[1].id) : '')
    setTransferDate(dateNow())
    setTransferAmount('')
    setTransferNotes('')
  }

  const submitFund = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const form = new FormData()
      form.append('name', name)
      form.append('type', fundType)
      form.append('opening_balance', opening)
      form.append('account_name', accountName)
      form.append('account_number', accountNumber)
      form.append('notes', fundNotes)
      if (qrCode) form.append('qr_code', qrCode)
      const response = await fetch(editingFund ? `${apiBaseUrl}/dashboard/funds/${editingFund.id}` : `${apiBaseUrl}/dashboard/funds`, {
        method: 'POST',
        headers,
        body: form,
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to save fund')
      setModal(null)
      resetFund()
      await load()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save fund')
    } finally {
      setSaving(false)
    }
  }

  const submitTransaction = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        fund_id: Number(transactionFund),
        type: transactionType,
        transacted_at: transactedAt,
        amount: Number(amount),
        description,
        notes: transactionNotes,
      }
      const response = await fetch(editingTransaction
        ? `${apiBaseUrl}/dashboard/fund-transactions/${editingTransaction.id}`
        : `${apiBaseUrl}/dashboard/funds/${transactionFund}/transactions`, {
        method: editingTransaction ? 'PATCH' : 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to save transaction')
      setModal(null)
      resetTransaction()
      await load()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save transaction')
    } finally {
      setSaving(false)
    }
  }

  const submitTransfer = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const response = await fetch(`${apiBaseUrl}/dashboard/fund-transfers`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_fund_id: Number(sourceFund),
          destination_fund_id: Number(destinationFund),
          transacted_at: transferDate,
          amount: Number(transferAmount),
          notes: transferNotes,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to transfer funds')
      setModal(null)
      resetTransfer()
      await load()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to transfer funds')
    } finally {
      setSaving(false)
    }
  }

  const deleteItem = async (url: string, message: string, close = false) => {
    setConfirmation({
      title: 'Confirm deletion',
      description: message,
      confirmLabel: 'Delete',
      action: async () => {
        try {
          const response = await fetch(url, { method: 'DELETE', headers })
          const result = await response.json()
          if (!response.ok) throw new Error(result.message || 'Unable to delete')
          if (close) setSelectedTransaction(null)
          await load()
        } catch (deleteError) {
          setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete')
        }
      },
    })
  }

  const cards = useMemo(() => data ? [
    ['Total Balance', data.total_balance],
    ['Total Inflows', data.total_inflows],
    ['Total Outflows', data.total_outflows],
  ] : [], [data])

  const isTransfer = (transaction: FundTransaction) =>
    Boolean(transaction.transfer_reference || transaction.description.startsWith('Transfer to ') || transaction.description.startsWith('Transfer from '))

  if (loading && !data) {
    return <div className="grid gap-4 sm:grid-cols-3">{[1,2,3].map((key) => <div key={key} className="h-28 animate-pulse rounded-xl bg-white" />)}</div>
  }

  return (
    <motion.section initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row">
        <div><h2 className="text-2xl font-semibold">Funds</h2><p className="mt-1 text-sm text-[#8b8494]">Manage fund accounts, deposits, withdrawals, and running balances.</p></div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={subscriptionReadOnly} onClick={() => { resetFund(); setModal('fund') }} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-4 py-3 text-sm font-bold text-[#40384b] disabled:cursor-not-allowed disabled:opacity-50">+ Add fund</button>
          <button type="button" disabled={subscriptionReadOnly} onClick={() => { resetTransfer(); setModal('transfer') }} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-4 py-3 text-sm font-bold text-[#40384b] disabled:cursor-not-allowed disabled:opacity-50">Transfer funds</button>
          <button type="button" disabled={subscriptionReadOnly} onClick={() => { resetTransaction(); setModal('transaction') }} className="cursor-pointer rounded-lg bg-[#5b21b6] px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">+ Add transaction</button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map(([label, value]) => (
          <div key={label as string} className="rounded-xl border border-[#2c0f73]/10 bg-white p-5">
            <p className="text-sm text-[#8b8494]">{label as string}</p>
            <p className="mt-2 text-2xl font-bold text-[#5b21b6]">{money.format(Number(value))}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[#2c0f73]/10 bg-white p-5 sm:p-6">
        <h3 className="font-bold">Fund accounts</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data?.funds.map((fund) => (
            <article key={fund.id} className="rounded-xl border border-[#e5e1ed] p-4">
              <div className="flex justify-between gap-3">
                <div><h4 className="font-semibold">{fund.name}</h4><p className="text-xs capitalize text-[#8b8494]">{fund.type}</p>{fund.account_name && <p className="mt-2 text-xs text-[#686173]">{fund.account_name}</p>}{fund.account_number && <p className="text-xs text-[#686173]">{fund.account_number}</p>}</div>
                <strong className="text-right text-[#5b21b6]">{money.format(Number(fund.balance))}</strong>
              </div>
              {fund.qr_code_url && <div className="mt-3 flex items-end gap-3"><img className="h-20 w-20 rounded-lg border border-[#e5e1ed] object-contain" src={fund.qr_code_url.startsWith('http') ? fund.qr_code_url : `${storageBaseUrl}${fund.qr_code_url}`} alt={`${fund.name} QR code`} /><a className="text-xs font-bold text-[#5b21b6]" href={fund.qr_code_url.startsWith('http') ? fund.qr_code_url : `${storageBaseUrl}${fund.qr_code_url}`} download={`${fund.name}-qr-code`}>Download QR</a></div>}
              {!subscriptionReadOnly && <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={() => { setEditingFund(fund); setName(fund.name); setFundType(fund.type); setOpening(String(fund.opening_balance)); setAccountName(fund.account_name ?? ''); setAccountNumber(fund.account_number ?? ''); setQrCode(null); setFundNotes(fund.notes ?? ''); setModal('fund') }} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-3 py-2 text-xs font-bold text-[#5b21b6]">Edit</button>
                <button type="button" onClick={() => void deleteItem(`${apiBaseUrl}/dashboard/funds/${fund.id}`, 'Delete this fund and all its transactions?')} className="cursor-pointer rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600">Delete</button>
              </div>}
            </article>
          ))}
          {!data?.funds.length && <p className="text-sm text-[#8b8494]">No fund accounts yet.</p>}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px_180px]">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search fund, description, or notes..." className="rounded-lg border border-[#dcd8e6] bg-white px-3 py-2.5 text-sm" />
        <select value={fundFilter} onChange={(event) => setFundFilter(event.target.value)} className="cursor-pointer rounded-lg border border-[#dcd8e6] bg-white px-3 py-2.5 text-sm"><option value="">All funds</option>{data?.funds.map((fund) => <option value={fund.id} key={fund.id}>{fund.name}</option>)}</select>
        <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="cursor-pointer rounded-lg border border-[#dcd8e6] bg-white px-3 py-2.5 text-sm"><option value="">All types</option><option value="inflow">Inflows</option><option value="outflow">Outflows</option></select>
        <select value={sort} onChange={(event) => setSort(event.target.value)} className="cursor-pointer rounded-lg border border-[#dcd8e6] bg-white px-3 py-2.5 text-sm"><option value="date_latest">Date: Latest</option><option value="date_oldest">Date: Oldest</option><option value="amount_asc">Amount: Ascending</option><option value="amount_desc">Amount: Descending</option><option value="type_inflow">Type: Inflows</option><option value="type_outflow">Type: Outflows</option></select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#2c0f73]/10 bg-white">
        <table className="w-full min-w-[780px] text-left text-sm">
          <thead><tr className="border-b border-[#eeeaf3] text-[10px] uppercase tracking-widest text-[#8b8494]"><th className="p-4">Date</th><th className="p-4">Fund</th><th className="p-4">Type</th><th className="p-4">Description</th><th className="p-4 text-right">Amount</th><th className="p-4 text-right">Actions</th></tr></thead>
          <tbody>
            {data?.transactions.length ? data.transactions.map((transaction) => (
              <tr key={transaction.id} className="border-b border-[#f3f1f6] last:border-0">
                <td className="whitespace-nowrap p-4 text-[#686173]">{dateLabel(transaction.transacted_at)}</td>
                <td className="p-4">{transaction.fund?.name}</td>
                <td className={`p-4 font-semibold ${transaction.type === 'inflow' ? 'text-[#16a34a]' : 'text-red-600'}`}>{transaction.type}</td>
                <td className="p-4 text-[#686173]">{transaction.description}</td>
                <td className="p-4 text-right font-semibold">{money.format(Number(transaction.amount))}</td>
                <td className="whitespace-nowrap p-4 text-right">
                  <button type="button" onClick={() => setSelectedTransaction(transaction)} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-3 py-2 text-xs font-bold text-[#40384b]">View</button>
                </td>
              </tr>
            )) : <tr><td colSpan={6} className="p-8 text-center text-[#8b8494]">No transactions found.</td></tr>}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {!subscriptionReadOnly && modal === 'fund' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-[#17141f]/55 p-4">
            <motion.form initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} onSubmit={submitFund} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
              <h2 className="text-2xl font-semibold">{editingFund ? 'Edit fund' : 'Add fund'}</h2>
              <div className="mt-5 space-y-4">
                <label className="block text-sm font-semibold">Fund name<input required value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-lg border border-[#dcd8e6] px-3 py-2.5" /></label>
                <label className="block text-sm font-semibold">Fund type<select value={fundType} onChange={(event) => setFundType(event.target.value as typeof fundType)} className="mt-2 w-full cursor-pointer rounded-lg border border-[#dcd8e6] px-3 py-2.5"><option value="cash">Cash</option><option value="bank">Bank</option><option value="e-wallet">E-wallet</option><option value="other">Other</option></select></label>
                <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-semibold">Account name (optional)<input value={accountName} onChange={(event) => setAccountName(event.target.value)} className="mt-2 w-full rounded-lg border border-[#dcd8e6] px-3 py-2.5" /></label><label className="block text-sm font-semibold">Account number (optional)<input value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} className="mt-2 w-full rounded-lg border border-[#dcd8e6] px-3 py-2.5" /></label></div>
                <label className="block text-sm font-semibold">
                  QR code image (optional)
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => setQrCode(event.target.files?.[0] ?? null)}
                    className="mt-2 block w-full cursor-pointer rounded-lg border border-dashed border-[#dcd8e6] bg-[#faf9fc] px-3 py-2.5 text-sm text-[#686173] file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-[#ede9fe] file:px-3 file:py-2 file:text-xs file:font-bold file:text-[#5b21b6]"
                  />
                  {qrCode && <span className="mt-2 block truncate text-xs font-normal text-[#686173]">{qrCode.name}</span>}
                  {editingFund?.qr_code_url && !qrCode && <img className="mt-3 h-24 w-24 rounded-lg border border-[#e5e1ed] object-contain" src={editingFund.qr_code_url.startsWith('http') ? editingFund.qr_code_url : `${storageBaseUrl}${editingFund.qr_code_url}`} alt="Current QR code" />}
                </label>
                <label className="block text-sm font-semibold">Opening balance<input required min="0" step="0.01" type="number" value={opening} onChange={(event) => setOpening(event.target.value)} className="mt-2 w-full rounded-lg border border-[#dcd8e6] px-3 py-2.5" /></label>
                <label className="block text-sm font-semibold">Notes<textarea value={fundNotes} onChange={(event) => setFundNotes(event.target.value)} className="mt-2 w-full rounded-lg border border-[#dcd8e6] px-3 py-2.5" /></label>
              </div>
              <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setModal(null)} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-4 py-2.5 text-sm font-bold">Cancel</button><button type="submit" disabled={saving} className="cursor-pointer rounded-lg bg-[#5b21b6] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? 'Saving...' : 'Save fund'}</button></div>
            </motion.form>
          </motion.div>
        )}

        {!subscriptionReadOnly && modal === 'transaction' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-[#17141f]/55 p-4">
            <motion.form initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} onSubmit={submitTransaction} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
              <h2 className="text-2xl font-semibold">{editingTransaction ? 'Edit transaction' : 'Add transaction'}</h2>
              <div className="mt-5 space-y-4">
                <label className="block text-sm font-semibold">Fund<select required value={transactionFund} onChange={(event) => setTransactionFund(event.target.value)} className="mt-2 w-full cursor-pointer rounded-lg border border-[#dcd8e6] px-3 py-2.5"><option value="">Select fund</option>{data?.funds.map((fund) => <option value={fund.id} key={fund.id}>{fund.name}</option>)}</select></label>
                <fieldset><legend className="text-sm font-semibold">Transaction type</legend><div className="mt-2 flex gap-5 text-sm"><label className="cursor-pointer"><input type="radio" checked={transactionType === 'inflow'} onChange={() => setTransactionType('inflow')} className="mr-2 accent-[#5b21b6]" />Inflow</label><label className="cursor-pointer"><input type="radio" checked={transactionType === 'outflow'} onChange={() => setTransactionType('outflow')} className="mr-2 accent-[#5b21b6]" />Outflow</label></div></fieldset>
                <label className="block text-sm font-semibold">Date and time<input type="datetime-local" required value={transactedAt} onChange={(event) => setTransactedAt(event.target.value)} className="mt-2 w-full rounded-lg border border-[#dcd8e6] px-3 py-2.5" /></label>
                <label className="block text-sm font-semibold">Description<input required value={description} onChange={(event) => setDescription(event.target.value)} className="mt-2 w-full rounded-lg border border-[#dcd8e6] px-3 py-2.5" /></label>
                <label className="block text-sm font-semibold">Amount<input required min="0.01" step="0.01" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-2 w-full rounded-lg border border-[#dcd8e6] px-3 py-2.5" /></label>
                <label className="block text-sm font-semibold">Notes<textarea value={transactionNotes} onChange={(event) => setTransactionNotes(event.target.value)} className="mt-2 w-full rounded-lg border border-[#dcd8e6] px-3 py-2.5" /></label>
              </div>
              <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setModal(null)} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-4 py-2.5 text-sm font-bold">Cancel</button><button type="submit" disabled={saving} className="cursor-pointer rounded-lg bg-[#5b21b6] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? 'Saving...' : 'Save transaction'}</button></div>
            </motion.form>
          </motion.div>
        )}

        {!subscriptionReadOnly && modal === 'transfer' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-[#17141f]/55 p-4">
            <motion.form initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} onSubmit={submitTransfer} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
              <h2 className="text-2xl font-semibold">Transfer funds</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold">From<select required value={sourceFund} onChange={(event) => setSourceFund(event.target.value)} className="mt-2 w-full cursor-pointer rounded-lg border border-[#dcd8e6] px-3 py-2.5"><option value="">Select fund</option>{data?.funds.map((fund) => <option value={fund.id} key={fund.id}>{fund.name}</option>)}</select></label>
                <label className="block text-sm font-semibold">To<select required value={destinationFund} onChange={(event) => setDestinationFund(event.target.value)} className="mt-2 w-full cursor-pointer rounded-lg border border-[#dcd8e6] px-3 py-2.5"><option value="">Select fund</option>{data?.funds.map((fund) => <option value={fund.id} key={fund.id}>{fund.name}</option>)}</select></label>
                <label className="block text-sm font-semibold sm:col-span-2">Date and time<input type="datetime-local" required value={transferDate} onChange={(event) => setTransferDate(event.target.value)} className="mt-2 w-full rounded-lg border border-[#dcd8e6] px-3 py-2.5" /></label>
                <label className="block text-sm font-semibold sm:col-span-2">Amount<input required min="0.01" step="0.01" type="number" value={transferAmount} onChange={(event) => setTransferAmount(event.target.value)} className="mt-2 w-full rounded-lg border border-[#dcd8e6] px-3 py-2.5" /></label>
                <label className="block text-sm font-semibold sm:col-span-2">Notes<textarea value={transferNotes} onChange={(event) => setTransferNotes(event.target.value)} className="mt-2 w-full rounded-lg border border-[#dcd8e6] px-3 py-2.5" /></label>
              </div>
              <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setModal(null)} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-4 py-2.5 text-sm font-bold">Cancel</button><button type="submit" disabled={saving} className="cursor-pointer rounded-lg bg-[#5b21b6] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? 'Saving...' : 'Transfer funds'}</button></div>
            </motion.form>
          </motion.div>
        )}

        {selectedTransaction && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] flex items-center justify-center bg-[#17141f]/55 p-4">
            <motion.div initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
              <div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-widest text-[#5b21b6]">Transaction details</p><h2 className="mt-2 text-2xl font-semibold">{selectedTransaction.description}</h2></div><button type="button" onClick={() => setSelectedTransaction(null)} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-2xl text-[#8b8494] hover:bg-[#f7f6fb]">×</button></div>
              <dl className="mt-6 space-y-3 text-sm"><div><dt className="text-xs text-[#8b8494]">Fund</dt><dd>{selectedTransaction.fund?.name}</dd></div><div><dt className="text-xs text-[#8b8494]">Date</dt><dd>{dateLabel(selectedTransaction.transacted_at)}</dd></div><div><dt className="text-xs text-[#8b8494]">Type</dt><dd className="capitalize">{selectedTransaction.type}</dd></div><div><dt className="text-xs text-[#8b8494]">Amount</dt><dd className="text-xl font-bold text-[#5b21b6]">{money.format(Number(selectedTransaction.amount))}</dd></div><div><dt className="text-xs text-[#8b8494]">Notes</dt><dd className="whitespace-pre-wrap text-[#686173]">{selectedTransaction.notes || '—'}</dd></div></dl>
              {!subscriptionReadOnly && <div className="mt-6 flex justify-end gap-3">{selectedTransaction.payment?.provider || isTransfer(selectedTransaction) ? <span className="self-center text-xs font-semibold text-[#15803d]">{isTransfer(selectedTransaction) ? 'Transfer entries cannot be edited or deleted separately.' : 'Payment transaction cannot be deleted.'}</span> : <><button type="button" onClick={() => void deleteItem(`${apiBaseUrl}/dashboard/fund-transactions/${selectedTransaction.id}`, 'Delete this transaction?', true)} className="cursor-pointer rounded-lg px-4 py-2 text-sm font-bold text-red-600">Delete</button><button type="button" onClick={() => { setEditingTransaction(selectedTransaction); setTransactionType(selectedTransaction.type); setTransactionFund(String(selectedTransaction.fund_id)); setTransactedAt(selectedTransaction.transacted_at.slice(0,16)); setAmount(String(selectedTransaction.amount)); setDescription(selectedTransaction.description); setTransactionNotes(selectedTransaction.notes ?? ''); setSelectedTransaction(null); setModal('transaction') }} className="cursor-pointer rounded-lg bg-[#5b21b6] px-4 py-2 text-sm font-bold text-white">Edit</button></>}</div>}
            </motion.div>
          </motion.div>
        )}
        {confirmation && (
          <ConfirmationModal
            title={confirmation.title}
            description={confirmation.description}
            confirmLabel={confirmation.confirmLabel}
            tone="danger"
            confirming={confirming}
            prefersReducedMotion={Boolean(prefersReducedMotion)}
            onCancel={() => setConfirmation(null)}
            onConfirm={async () => {
              setConfirming(true)
              try {
                await confirmation.action()
              } finally {
                setConfirming(false)
                setConfirmation(null)
              }
            }}
          />
        )}
      </AnimatePresence>
    </motion.section>
  )
}
