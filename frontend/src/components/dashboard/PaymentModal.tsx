import { motion } from 'framer-motion'
import type { FormEvent } from 'react'

type Props = {
  reference: string
  total: number
  paid: number
  balance: number
  amount: string
  method: string
  paidAt: string
  notes: string
  funds: Array<{ id: number; name: string; type: string }>
  fundId: string
  submitting: boolean
  error: string
  prefersReducedMotion: boolean
  onAmountChange: (value: string) => void
  onMethodChange: (value: string) => void
  onPaidAtChange: (value: string) => void
  onNotesChange: (value: string) => void
  onFundChange: (value: string) => void
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export function PaymentModal(props: Props) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[75] flex items-center justify-center bg-[#17141f]/55 p-4">
      <motion.form
        initial={props.prefersReducedMotion ? false : { opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={props.prefersReducedMotion ? undefined : { opacity: 0, scale: 0.98 }}
        onSubmit={props.onSubmit}
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-label="Record payment"
      >
        <div className="flex items-center justify-between">
          <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5b21b6]">{props.reference}</p><h2 className="mt-2 text-xl font-bold">Record payment</h2></div>
          <button type="button" onClick={props.onClose} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-2xl text-[#8b8494] hover:bg-[#f7f6fb]" aria-label="Close payment">×</button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-[#f7f6fb] p-3"><p className="text-[10px] text-[#8b8494]">Total</p><p className="mt-1 text-sm font-bold">₱{props.total.toLocaleString('en-PH')}</p></div>
          <div className="rounded-lg bg-[#f7f6fb] p-3"><p className="text-[10px] text-[#8b8494]">Paid</p><p className="mt-1 text-sm font-bold text-[#16a34a]">₱{props.paid.toLocaleString('en-PH')}</p></div>
          <div className="rounded-lg bg-[#f7f6fb] p-3"><p className="text-[10px] text-[#8b8494]">Balance</p><p className="mt-1 text-sm font-bold text-red-600">₱{props.balance.toLocaleString('en-PH')}</p></div>
        </div>
        <div className="mt-5 space-y-4">
          <label className="block"><span className="mb-2 block text-sm font-semibold">Amount</span><input type="number" min="0.01" step="0.01" max={props.balance} required value={props.amount} onChange={(event) => props.onAmountChange(event.target.value)} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label>
          <label className="block"><span className="mb-2 block text-sm font-semibold">Payment method</span><select value={props.method} onChange={(event) => props.onMethodChange(event.target.value)} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3"><option>Cash</option><option>Bank transfer</option><option>GCash</option><option>Credit / Debit card</option><option>Check</option><option>Other</option></select></label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Fund <span className="font-normal text-[#8b8494]">(optional)</span></span>
            <select value={props.fundId} onChange={(event) => props.onFundChange(event.target.value)} className="w-full cursor-pointer rounded-lg border border-[#dcd8e6] px-4 py-3">
              <option value="">No fund selected</option>
              {props.funds.map((fund) => <option key={fund.id} value={String(fund.id)}>{fund.name} · {fund.type}</option>)}
            </select>
          </label>
          <label className="block"><span className="mb-2 block text-sm font-semibold">Payment date & time</span><input type="datetime-local" required value={props.paidAt} onChange={(event) => props.onPaidAtChange(event.target.value)} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label>
          <label className="block"><span className="mb-2 block text-sm font-semibold">Notes <span className="font-normal text-[#8b8494]">(optional)</span></span><textarea rows={2} value={props.notes} onChange={(event) => props.onNotesChange(event.target.value)} className="w-full resize-y rounded-lg border border-[#dcd8e6] px-4 py-3" /></label>
          {props.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{props.error}</p>}
        </div>
        <div className="mt-6 flex gap-3"><button type="button" onClick={props.onClose} className="flex-1 cursor-pointer rounded-lg border border-[#dcd8e6] px-4 py-3 text-sm font-bold text-[#686173]">Cancel</button><button type="submit" disabled={props.submitting} className="flex-1 cursor-pointer rounded-lg bg-[#5b21b6] px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">{props.submitting ? 'Saving...' : 'Record payment'}</button></div>
      </motion.form>
    </motion.div>
  )
}
