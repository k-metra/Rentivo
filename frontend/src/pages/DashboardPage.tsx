import { motion, useReducedMotion } from 'framer-motion'
import wordmark from '../assets/rentivo-wordmark.png'

export default function DashboardPage() {
  const prefersReducedMotion = useReducedMotion()
  const companyName =
    localStorage.getItem('rentivo_pending_company') || 'Your Rental Company'

  return (
    <main className="min-h-screen bg-[#f7f6fb] text-[#17141f]">
      <header className="flex h-20 items-center justify-between border-b border-[#2c0f73]/10 bg-white px-6 sm:px-10">
        <img src={wordmark} alt="Rentivo" className="h-10 w-auto sm:h-12" />
        <button
          type="button"
          onClick={() => {
            localStorage.removeItem('rentivo_access_token')
            window.location.href = '/'
          }}
          className="cursor-pointer rounded-lg border border-[#dcd8e6] px-4 py-2.5 text-sm font-bold text-[#40384b] transition hover:bg-[#f7f6fb]"
        >
          Sign out
        </button>
      </header>

      <motion.section
        initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="mx-auto max-w-6xl px-6 py-12"
      >
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#5b21b6]">
          Dashboard
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[#21142f]">
          Welcome to {companyName}
        </h1>
        <p className="mt-3 text-[#686173]">
          Your rental operations workspace is ready.
        </p>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Vehicles', '0'],
            ['Customers', '0'],
            ['Bookings', '0'],
            ['Revenue', '$0.00'],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-xl border border-[#2c0f73]/10 bg-white p-6 shadow-[0_12px_32px_rgba(45,28,82,0.08)]"
            >
              <p className="text-sm font-semibold text-[#686173]">{label}</p>
              <p className="mt-3 text-3xl font-semibold text-[#21142f]">{value}</p>
            </div>
          ))}
        </div>
      </motion.section>
    </main>
  )
}
