import { motion } from 'framer-motion'
import type { FormEvent } from 'react'

type Props = {
  reference: string
  returnAt: string
  pricingMode: 'hourly' | 'twelve_hour'
  fee: string
  submitting: boolean
  error: string
  prefersReducedMotion: boolean
  onReturnAtChange: (value: string) => void
  onPricingModeChange: (value: 'hourly' | 'twelve_hour') => void
  onFeeChange: (value: string) => void
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export function ExtensionModal(props: Props) {
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
        aria-label="Extend booking"
      >
        <div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5b21b6]">{props.reference}</p><h2 className="mt-2 text-xl font-bold">Extend booking</h2></div><button type="button" onClick={props.onClose} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-2xl text-[#8b8494] hover:bg-[#f7f6fb]" aria-label="Close extension">×</button></div>
        <div className="mt-5 space-y-4">
          <label className="block"><span className="mb-2 block text-sm font-semibold">New return date & time</span><input type="datetime-local" required value={props.returnAt} onChange={(event) => props.onReturnAtChange(event.target.value)} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label>
          <label className="block"><span className="mb-2 block text-sm font-semibold">Pricing mode</span><select value={props.pricingMode} onChange={(event) => props.onPricingModeChange(event.target.value as 'hourly' | 'twelve_hour')} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3"><option value="hourly">Hourly extension</option><option value="twelve_hour">12-hour rental tier</option></select></label>
          <label className="block"><span className="mb-2 block text-sm font-semibold">Extension fee</span><input type="number" min="0" step="0.01" required value={props.fee} onChange={(event) => props.onFeeChange(event.target.value)} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label>
          {props.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{props.error}</p>}
        </div>
        <div className="mt-6 flex gap-3"><button type="button" onClick={props.onClose} className="flex-1 cursor-pointer rounded-lg border border-[#dcd8e6] px-4 py-3 text-sm font-bold text-[#686173]">Cancel</button><button type="submit" disabled={props.submitting} className="flex-1 cursor-pointer rounded-lg bg-[#5b21b6] px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">{props.submitting ? 'Saving...' : 'Extend booking'}</button></div>
      </motion.form>
    </motion.div>
  )
}
