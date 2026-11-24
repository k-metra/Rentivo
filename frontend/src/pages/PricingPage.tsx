import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import PublicHeader from '../components/PublicHeader'

type Plan = {
  name: string
  monthlyPrice: number | null
  fleet: string
  users: string
  highlighted?: boolean
}

const plans: Plan[] = [
  { name: 'Solo', monthlyPrice: 499, fleet: '3 vehicles', users: '1' },
  { name: 'Growth', monthlyPrice: 799, fleet: '7 vehicles', users: '3', highlighted: true },
  { name: 'Professional', monthlyPrice: 1099, fleet: '15 vehicles', users: '5' },
  { name: 'Business', monthlyPrice: 1799, fleet: '35 vehicles', users: '10' },
  { name: 'Enterprise', monthlyPrice: null, fleet: 'Custom', users: 'Custom' },
]

const featureRows: Array<[string, string, string, string, string]> = [
  ['Vehicle management', '✓', '✓', '✓', '✓'],
  ['Unlimited bookings', '✓', '✓', '✓', '✓'],
  ['Booking calendar', '✓', '✓', '✓', '✓'],
  ['Contract builder', '✓', '✓', '✓', '✓'],
  ['Rental operations', '✓', '✓', '✓', '✓'],
  ['Expense management', '✓', '✓', '✓', '✓'],
  ['Financial management', '✓', '✓', '✓', '✓'],
  ['Advanced reports', '—', '✓', '✓', '✓'],
  ['E-signatures', '—', '✓', '✓', '✓'],
  ['Customer portal', '—', '—', '✓', '✓'],
  ['Partner portal', '—', '—', '✓', '✓'],
  ['Booking website', '—', 'Basic', '✓', '✓'],
  ['Priority support', '—', '—', '✓', '✓'],
  ['Multiple branches', '—', '—', '—', '✓'],
]

const formatPrice = (price: number) => `₱${price.toLocaleString('en-PH')}`

export default function PricingPage() {
  const [annual, setAnnual] = useState(false)
  const [contactModalOpen, setContactModalOpen] = useState(false)
  const [isAuthenticated] = useState(() => Boolean(localStorage.getItem('rentivo_access_token')))
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    if (!contactModalOpen) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setContactModalOpen(false)
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleEscape)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleEscape)
    }
  }, [contactModalOpen])

  return (
    <main className="min-h-screen bg-[#f7f6fb] text-[#17141f]">
      <PublicHeader />

      <section className="mx-auto max-w-7xl px-6 py-16 sm:py-20">
        <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.08 }} className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#5b21b6]">Simple, transparent pricing</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[#21142f] sm:text-5xl">The right plan for every rental business.</h1>
          <p className="mt-5 text-lg leading-8 text-[#686173]">Start with a 21-day free trial. No credit card required.</p>
        </motion.div>

        <section className="mx-auto mt-8 max-w-6xl rounded-2xl border border-[#ddd6fe] bg-[#f5f3ff] p-6 sm:flex sm:items-center sm:justify-between sm:gap-6" aria-labelledby="renewal-title">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#5b21b6]">Renewing your plan?</p>
            <h2 id="renewal-title" className="mt-2 text-xl font-bold text-[#21142f]">We can help with your next plan.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#686173]">Contact us with your company details and the plan you would like to avail so we can assist with your renewal or plan change.</p>
          </div>
          <button type="button" onClick={() => setContactModalOpen(true)} className="mt-5 inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg bg-[#5b21b6] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#4c1d95] sm:mt-0">Contact Us</button>
        </section>

        <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.16 }} className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <div className="relative inline-flex rounded-full border border-[#dcd8e6] bg-white p-1 shadow-sm" role="group" aria-label="Billing period">
            <button type="button" onClick={() => setAnnual(false)} className={`relative isolate cursor-pointer rounded-full px-5 py-2 text-sm font-bold transition-colors ${!annual ? 'text-white' : 'text-[#686173] hover:text-[#5b21b6]'}`}>
              {!annual && <motion.span layoutId="billing-pill" className="absolute inset-0 -z-10 rounded-full bg-[#5b21b6]" transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 30 }} />}
              <span className="relative z-10">Monthly</span>
            </button>
            <button type="button" onClick={() => setAnnual(true)} className={`relative isolate cursor-pointer rounded-full px-5 py-2 text-sm font-bold transition-colors ${annual ? 'text-white' : 'text-[#686173] hover:text-[#5b21b6]'}`}>
              {annual && <motion.span layoutId="billing-pill" className="absolute inset-0 -z-10 rounded-full bg-[#5b21b6]" transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 30 }} />}
              <span className="relative z-10">Annual</span>
            </button>
          </div>
          <span className="rounded-full bg-[#dcfce7] px-3 py-1.5 text-xs font-bold text-[#15803d]">Annual plans get 2 months free</span>
        </motion.div>

        <div className="mx-auto mt-10 grid max-w-6xl gap-5 md:grid-cols-2 xl:grid-cols-4">
          {plans.slice(0, 4).map((plan, planIndex) => {
            const annualPrice = plan.monthlyPrice === null ? null : plan.monthlyPrice * 10
            return (
              <motion.article key={plan.name} initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: prefersReducedMotion ? 0 : 0.22 + planIndex * 0.07 }} style={plan.highlighted ? { border: '2px solid #5b21b6', boxShadow: '0 0 0 3px rgba(91,33,182,0.12)' } : undefined} className={`relative flex flex-col rounded-2xl bg-white p-6 shadow-[0_8px_24px_rgba(45,28,82,0.05)] ${plan.highlighted ? '' : 'border border-[#2c0f73]/10'}`}>
                <div className="min-h-20">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-[#21142f]">{plan.name}</h2>
                    {plan.highlighted && <span className="rounded-full bg-[#5b21b6] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">Popular</span>}
                  </div>
                  <p className="mt-2 text-sm text-[#8b8494]">Manage {plan.fleet}</p>
                </div>
                <div className="mt-6">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.p key={annual ? 'annual' : 'monthly'} initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="text-3xl font-semibold tracking-tight text-[#5b21b6]">{annual ? (annualPrice === null ? 'Custom' : formatPrice(annualPrice)) : (plan.monthlyPrice === null ? 'Custom' : formatPrice(plan.monthlyPrice))}<span className="text-sm font-medium text-[#8b8494]">{annual ? ' / year' : ' / month'}</span></motion.p>
                  </AnimatePresence>
                  <AnimatePresence initial={false}>
                    {annual && plan.monthlyPrice !== null && <motion.p initial={prefersReducedMotion ? false : { opacity: 0, height: 0, y: -4 }} animate={{ opacity: 1, height: 'auto', y: 0 }} exit={prefersReducedMotion ? undefined : { opacity: 0, height: 0, y: -4 }} transition={{ duration: 0.2 }} className="mt-1 overflow-hidden text-xs font-bold text-[#16a34a]">2 months free</motion.p>}
                  </AnimatePresence>
                </div>
                {plan.monthlyPrice === null ? (
                  <p className="mt-6 min-h-[390px] border-t border-[#eeeaf3] pt-5 text-sm leading-6 text-[#686173]">Custom fleet capacity, users, branches, and support for larger operations.</p>
                ) : (
                  <ul className="mt-6 min-h-[390px] space-y-3 border-t border-[#eeeaf3] pt-5 text-sm">
                    <li className="flex gap-2"><span className="font-bold text-[#16a34a]">✓</span><span>{plan.users} {plan.users === '1' ? 'user' : 'users'}</span></li>
                    {featureRows.map(([feature, solo, growth, professional, business]) => {
                      const value = [solo, growth, professional, business][planIndex]
                      return <li key={feature} className={`flex gap-2 ${value === '—' ? 'text-[#aaa4b4] line-through' : 'text-[#686173]'}`}><span className={`font-bold ${value === '—' ? 'text-[#d1d5db]' : 'text-[#16a34a]'}`}>{value === '—' ? '×' : '✓'}</span><span>{value === '✓' ? feature : value === 'Basic' ? `${feature} (Basic)` : feature}</span></li>
                    })}
                  </ul>
                )}
                {isAuthenticated ? (
                  <button type="button" onClick={() => setContactModalOpen(true)} className={`mt-6 block w-full cursor-pointer rounded-lg px-4 py-3 text-center text-sm font-bold transition ${plan.highlighted ? 'bg-[#5b21b6] text-white hover:bg-[#4c1d95]' : 'border border-[#dcd8e6] text-[#5b21b6] hover:border-[#c4b5fd] hover:bg-[#f7f6fb]'}`}>
                    Contact Us
                  </button>
                ) : (
                  <Link to="/" className={`mt-6 block cursor-pointer rounded-lg px-4 py-3 text-center text-sm font-bold transition ${plan.highlighted ? 'bg-[#5b21b6] text-white hover:bg-[#4c1d95]' : 'border border-[#dcd8e6] text-[#5b21b6] hover:border-[#c4b5fd] hover:bg-[#f7f6fb]'}`}>
                    Start free trial
                  </Link>
                )}
              </motion.article>
            )
          })}
        </div>

        <div style={{ border: '2px solid #5b21b6', boxShadow: '0 0 0 3px rgba(91,33,182,0.12)' }} className="mx-auto mt-5 flex max-w-6xl flex-col gap-5 rounded-2xl bg-[#fbfaff] p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-[#21142f]">Enterprise</h2>
              <span className="rounded-full bg-[#ede9fe] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#6d28d9]">Custom plan</span>
            </div>
            <p className="mt-2 text-sm text-[#686173]">Custom fleet capacity, users, branches, and support for larger operations.</p>
          </div>
          <button type="button" onClick={() => setContactModalOpen(true)} className="inline-flex h-fit shrink-0 cursor-pointer items-center justify-center rounded-lg bg-[#5b21b6] px-6 py-2.5 text-center text-sm font-bold leading-5 text-white transition hover:bg-[#4c1d95] sm:ml-auto">Contact us</button>
        </div>

        <section style={{ marginTop: '96px', paddingTop: '40px' }} className="mx-auto max-w-6xl border-t border-[#eeeaf3]" aria-labelledby="comparison-title">
          <div className="mb-5">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#5b21b6]">Compare plans</p>
            <h2 id="comparison-title" className="mt-2 text-2xl font-semibold tracking-tight text-[#21142f]">Everything included at a glance.</h2>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-[#2c0f73]/10 bg-white shadow-[0_8px_24px_rgba(45,28,82,0.05)]">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#eeeaf3] bg-[#fbfaff]">
                  <th className="px-5 py-4 font-bold text-[#21142f]">Feature</th>
                  {plans.slice(0, 4).map((plan) => <th key={plan.name} className="px-5 py-4 text-center font-bold text-[#21142f]">{plan.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {featureRows.map(([feature, solo, growth, professional, business]) => (
                  <tr key={feature} className="border-b border-[#f3f1f6] last:border-0">
                    <th className="px-5 py-3.5 font-medium text-[#686173]">{feature}</th>
                    {[solo, growth, professional, business].map((value, index) => <td key={`${feature}-${index}`} className={`px-5 py-3.5 text-center font-semibold ${value === '✓' ? 'text-[#16a34a]' : value === '—' ? 'text-[#aaa4b4]' : 'text-[#40384b]'}`}>{value}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
      <AnimatePresence>
        {contactModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-[#17141f]/55 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setContactModalOpen(false) }}>
            <motion.div initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="contact-modal-title">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#5b21b6]">Rentivo support</p>
                  <h2 id="contact-modal-title" className="mt-2 text-2xl font-bold text-[#21142f]">Let’s talk about your plan</h2>
                </div>
                <button type="button" onClick={() => setContactModalOpen(false)} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-2xl text-[#8b8494] hover:bg-[#f7f6fb]" aria-label="Close contact details">×</button>
              </div>
              <p className="mt-4 text-sm leading-6 text-[#686173]">Send us your company details and the plan you would like to avail. We’ll help with renewals, upgrades, and plan changes.</p>
              <div className="mt-5 grid gap-3">
                <a href="tel:+639939928496" className="rounded-xl border border-[#e5e1ed] px-4 py-3 text-sm font-bold text-[#5b21b6] transition hover:bg-[#f7f6fb]">Call (+63) 993 992 8496</a>
                <a href="https://facebook.com/rentivoph" target="_blank" rel="noreferrer" className="rounded-xl border border-[#e5e1ed] px-4 py-3 text-sm font-bold text-[#5b21b6] transition hover:bg-[#f7f6fb]">Message us on Facebook</a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}
