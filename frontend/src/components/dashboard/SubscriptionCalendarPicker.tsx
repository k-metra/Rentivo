import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'

type Props = {
  value: string
  time: string
  onChange: (date: string, time: string) => void
}

const pad = (value: number) => String(value).padStart(2, '0')

export function SubscriptionCalendarPicker({ value, time, onChange }: Props) {
  const initial = value ? new Date(`${value}T12:00:00`) : new Date()
  const [month, setMonth] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1))
  const [open, setOpen] = useState(false)
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1)
  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0)
  const startOffset = monthStart.getDay()
  const days = useMemo(() => Array.from({ length: monthEnd.getDate() }, (_, index) => index + 1), [monthEnd])
  const dateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  const display = value
    ? new Date(`${value}T${time || '12:00'}:00`).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : 'Select start date and time'

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((current) => !current)} className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-[#dcd8e6] bg-white px-4 py-3 text-left text-sm">
        <span>{display}</span><span className="text-[#8b8494]">▦</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -4, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.98 }} className="absolute z-40 mt-2 w-full min-w-[280px] rounded-xl border border-[#dcd8e6] bg-white p-3 shadow-[0_16px_40px_rgba(45,28,82,0.16)]">
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="cursor-pointer rounded-lg px-3 py-2 text-lg">‹</button>
              <p className="text-sm font-bold">{month.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}</p>
              <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="cursor-pointer rounded-lg px-3 py-2 text-lg">›</button>
            </div>
            <div className="mt-3 grid grid-cols-7 gap-1">
              {['S','M','T','W','T','F','S'].map((day, index) => <span key={`${day}-${index}`} className="text-center text-[10px] font-bold text-[#aaa4b4]">{day}</span>)}
              {Array.from({ length: startOffset }, (_, index) => <span key={`blank-${index}`} />)}
              {days.map((day) => {
                const date = new Date(month.getFullYear(), month.getMonth(), day)
                const selected = value === dateKey(date)
                return (
                  <button type="button" key={day} onClick={() => { onChange(dateKey(date), time || '12:00'); setOpen(false) }} className={`cursor-pointer rounded-lg py-2 text-xs font-semibold ${selected ? 'bg-[#5b21b6] text-white' : 'text-[#686173] hover:bg-[#f7f6fb]'}`}>{day}</button>
                )
              })}
            </div>
            <label className="mt-3 block"><span className="mb-1 block text-xs font-semibold text-[#686173]">Time</span><input type="time" value={time} onChange={(event) => onChange(value, event.target.value)} className="w-full rounded-lg border border-[#dcd8e6] px-3 py-2 text-sm" /></label>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
