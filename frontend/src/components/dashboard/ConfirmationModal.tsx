import { motion } from 'framer-motion'

type Props = {
  title: string
  description: string
  confirmLabel: string
  tone: 'danger' | 'primary'
  confirming: boolean
  prefersReducedMotion: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmationModal(props: Props) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90] flex items-center justify-center bg-[#17141f]/55 p-4" role="dialog" aria-modal="true" aria-labelledby="confirmation-title">
      <motion.div initial={props.prefersReducedMotion ? false : { opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={props.prefersReducedMotion ? undefined : { opacity: 0, scale: 0.98, y: 8 }} transition={{ duration: 0.22 }} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-[0_24px_80px_rgba(23,20,31,0.28)] sm:p-7">
        <div className={`flex h-11 w-11 items-center justify-center rounded-full ${props.tone === 'danger' ? 'bg-red-50 text-red-600' : 'bg-[#ede9fe] text-[#5b21b6]'}`}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{props.tone === 'danger' ? <><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.8 2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z" /></> : <><path d="M20 6 9 17l-5-5" /></>}</svg>
        </div>
        <h2 id="confirmation-title" className="mt-5 text-xl font-bold text-[#21142f]">{props.title}</h2>
        <p className="mt-2 text-sm leading-6 text-[#686173]">{props.description}</p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" disabled={props.confirming} onClick={props.onCancel} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-4 py-3 text-sm font-bold text-[#686173] transition hover:bg-[#f7f6fb] disabled:cursor-not-allowed disabled:opacity-60">Cancel</button>
          <button type="button" disabled={props.confirming} onClick={props.onConfirm} className={`cursor-pointer rounded-lg px-4 py-3 text-sm font-bold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${props.tone === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-[#5b21b6] hover:bg-[#4c1d95]'}`}>{props.confirming ? 'Please wait...' : props.confirmLabel}</button>
        </div>
      </motion.div>
    </motion.div>
  )
}
