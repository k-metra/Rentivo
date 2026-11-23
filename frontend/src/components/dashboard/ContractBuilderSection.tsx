import { motion, useReducedMotion } from 'framer-motion'

type ContractBuilderSectionProps = {
  title: string
  content: string
  onTitleChange: (title: string) => void
  onContentChange: (content: string) => void
  onSave: () => void
}

export function ContractBuilderSection({
  title,
  content,
  onTitleChange,
  onContentChange,
  onSave,
}: ContractBuilderSectionProps) {
  const prefersReducedMotion = useReducedMotion()
  return (
    <motion.section
      initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid gap-6 xl:grid-cols-[300px_1fr]"
    >
      <aside className="h-fit rounded-xl border border-[#2c0f73]/10 bg-white p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-[#8b8494]">Agreement fields</p>
        <div className="mt-4 space-y-2">
          {['Customer name', 'Vehicle', 'Pickup date', 'Return date', 'Rental amount', 'Security deposit', 'Terms & conditions', 'Signature'].map((field) => (
            <button
              type="button"
              key={field}
              onClick={() => onContentChange(`${content}\n\n${field}: ____________________`)}
              className="w-full cursor-pointer rounded-lg border border-[#e5e1ed] px-3 py-2.5 text-left text-sm font-semibold text-[#686173] transition hover:border-[#c4b5fd] hover:bg-[#f7f6fb] hover:text-[#5b21b6]"
            >
              + {field}
            </button>
          ))}
        </div>
      </aside>

      <div className="rounded-xl border border-[#2c0f73]/10 bg-white p-5 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold">Contract Builder</h2>
            <p className="mt-1 text-sm text-[#8b8494]">Build a rental agreement for this workspace</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => window.print()} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-4 py-2.5 text-sm font-bold text-[#686173] hover:bg-[#f7f6fb]">Print</button>
            <button type="button" onClick={onSave} className="cursor-pointer rounded-lg bg-[#5b21b6] px-4 py-2.5 text-sm font-bold text-white">Save template</button>
          </div>
        </div>
        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Template title</span>
            <input value={title} onChange={(event) => onTitleChange(event.target.value)} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3 outline-none focus:border-[#6d28d9]" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Agreement content</span>
            <textarea value={content} onChange={(event) => onContentChange(event.target.value)} rows={18} className="w-full resize-y rounded-lg border border-[#dcd8e6] px-4 py-3 leading-7 outline-none focus:border-[#6d28d9]" />
          </label>
        </div>
      </div>
    </motion.section>
  )
}
