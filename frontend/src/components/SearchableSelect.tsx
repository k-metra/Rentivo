import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

interface SearchableSelectProps {
  name: string
  value: string
  options: Array<string | { value: string; label: string; searchText?: string }>
  placeholder: string
  disabled?: boolean
  required?: boolean
  renderOption?: (option: { value: string; label: string }) => ReactNode
  renderValue?: (option: { value: string; label: string }) => ReactNode
  onChange: (value: string) => void
}

export default function SearchableSelect({
  name,
  value,
  options,
  placeholder,
  disabled = false,
  required = false,
  renderOption,
  renderValue,
  onChange,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listboxId = useId()
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    return () => document.removeEventListener('mousedown', closeOnOutsideClick)
  }, [])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const normalizedOptions = options.map((option) =>
    typeof option === 'string' ? { value: option, label: option } : option,
  )
  const filteredOptions = normalizedOptions.filter((option) =>
    `${option.label} ${option.searchText ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()),
  )
  const selectedOption = normalizedOptions.find((option) => option.value === value)

  return (
    <div ref={containerRef} className="relative">
      <input type="hidden" name={name} value={value} required={required} />
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => {
          setOpen((current) => !current)
          setSearch('')
        }}
        className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-[#dcd8e6] bg-white px-4 py-3 text-left outline-none transition hover:border-[#bdb4cd] focus:border-[#6d28d9] focus:ring-3 focus:ring-[#6d28d9]/10 disabled:cursor-not-allowed disabled:bg-[#f7f6fb] disabled:text-[#aaa4b4]"
      >
        <span className={value ? 'text-[#40384b]' : 'text-[#aaa4b4]'}>
          {selectedOption
            ? (renderValue ? renderValue(selectedOption) : selectedOption.label)
            : placeholder}
        </span>
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={`h-4 w-4 text-[#686173] transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="m6 8 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <AnimatePresence>
        {open && !disabled && (
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-[#dcd8e6] bg-white p-2 shadow-[0_16px_40px_rgba(45,28,82,0.16)]"
          >
            <div className="relative mb-2">
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b8495]">
                <circle cx="8.5" cy="8.5" r="4.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="m12 12 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search..."
                className="w-full rounded-lg border border-[#edeaf2] bg-[#faf9fc] py-2 pl-9 pr-3 text-sm text-[#40384b] outline-none focus:border-[#6d28d9]"
              />
            </div>
            <div id={listboxId} role="listbox" className="max-h-52 overflow-y-auto">
              {filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={value === option.value}
                  onClick={() => {
                    onChange(option.value)
                    setOpen(false)
                    setSearch('')
                  }}
                  className={`flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition ${
                    value === option.value
                      ? 'bg-[#ede9fe] font-semibold text-[#5b21b6]'
                      : 'text-[#40384b] hover:bg-[#f7f6fb]'
                  }`}
                >
                  {renderOption ? renderOption(option) : <span>{option.label}</span>}
                  {value === option.value && (
                    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
                      <path d="m5 10 3 3 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              ))}
              {filteredOptions.length === 0 && (
                <p className="px-3 py-4 text-center text-sm text-[#8b8495]">No matches found</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
