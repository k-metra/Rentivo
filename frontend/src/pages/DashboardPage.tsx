import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useState } from 'react'
import type { ReactNode } from 'react'
import wordmark from '../assets/rentivo-purple-wing-logo.png'

type IconName =
  | 'grid'
  | 'car'
  | 'calendar'
  | 'users'
  | 'wallet'
  | 'settings'
  | 'search'
  | 'bell'
  | 'arrow'
  | 'plus'
  | 'more'

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    car: <><path d="m5 17 1.2-5.2A2 2 0 0 1 8.15 10h7.7a2 2 0 0 1 1.95 1.8L19 17" /><path d="M4 17h16v3H4zM7 17v3m10-3v3M7 10l1-3h8l1 3" /><circle cx="7" cy="17" r="1" /><circle cx="17" cy="17" r="1" /></>,
    calendar: <><rect x="3" y="4.5" width="18" height="17" rx="2" /><path d="M16 2v5M8 2v5M3 10h18" /></>,
    users: <><circle cx="9" cy="8" r="3" /><path d="M3 20c.4-3.1 2.4-5 6-5s5.6 1.9 6 5" /><path d="M16 5.2a3 3 0 0 1 0 5.6M18 15c1.7.7 2.7 2.2 3 5" /></>,
    wallet: <><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H20v16H6.5A2.5 2.5 0 0 1 4 17.5z" /><path d="M4 7h13.5A2.5 2.5 0 0 1 20 9.5V12h-4a2 2 0 0 0 0 4h4v4" /><circle cx="16" cy="14" r=".5" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-2.6V20a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H6v-2.6h.2a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.8-1.8.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V5h2.6v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v2.6H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></>,
    bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 22h4" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  }

  return <svg aria-hidden="true" fill="none" height={size} viewBox="0 0 24 24" width={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">{paths[name]}</svg>
}

const navItems: { label: string; icon: IconName; active?: boolean }[] = [
  { label: 'Overview', icon: 'grid', active: true },
  { label: 'Bookings', icon: 'calendar' },
  { label: 'Fleet', icon: 'car' },
  { label: 'Customers', icon: 'users' },
  { label: 'Payments', icon: 'wallet' },
]

const stats = [
  { label: 'Total revenue', value: '₱248,450', change: '+12.8%', detail: 'vs. last month', icon: 'wallet' as IconName, tone: 'purple' },
  { label: 'Active bookings', value: '24', change: '+8.2%', detail: 'vs. last month', icon: 'calendar' as IconName, tone: 'blue' },
  { label: 'Fleet utilization', value: '78.4%', change: '+4.6%', detail: 'vs. last month', icon: 'car' as IconName, tone: 'orange' },
  { label: 'Total customers', value: '1,284', change: '+16.5%', detail: 'vs. last month', icon: 'users' as IconName, tone: 'green' },
]

const bookings = [
  { customer: 'Miguel Santos', initials: 'MS', vehicle: 'Toyota Fortuner', dates: 'Nov 20 - Nov 24, 2026', status: 'Active', color: 'bg-[#ede9fe] text-[#6d28d9]' },
  { customer: 'Sofia Reyes', initials: 'SR', vehicle: 'Honda City', dates: 'Nov 21 - Nov 23, 2026', status: 'Upcoming', color: 'bg-[#dbeafe] text-[#2563eb]' },
  { customer: 'Daniel Cruz', initials: 'DC', vehicle: 'Mitsubishi Xpander', dates: 'Nov 22 - Nov 27, 2026', status: 'Pending', color: 'bg-[#fef3c7] text-[#b45309]' },
]

const activities = [
  { title: 'Payment received', text: '₱18,500 from Miguel Santos', time: '12 min ago', icon: 'wallet' as IconName, tone: 'bg-[#dcfce7] text-[#15803d]' },
  { title: 'New booking created', text: 'Sofia Reyes · Honda City', time: '43 min ago', icon: 'calendar' as IconName, tone: 'bg-[#dbeafe] text-[#2563eb]' },
  { title: 'Vehicle maintenance', text: 'Toyota Vios marked for service', time: '2 hrs ago', icon: 'car' as IconName, tone: 'bg-[#fef3c7] text-[#b45309]' },
]

export default function DashboardPage() {
  const prefersReducedMotion = useReducedMotion()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const companyName = localStorage.getItem('rentivo_pending_company') || 'Your Rental Company'

  const stagger = {
    hidden: {},
    visible: { transition: { staggerChildren: prefersReducedMotion ? 0 : 0.06 } },
  }
  const item = {
    hidden: prefersReducedMotion ? {} : { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.38 } },
  }

  return (
    <div className="min-h-screen bg-[#f7f6fb] text-[#17141f]">
      <AnimatePresence>
        {sidebarOpen && <motion.button aria-label="Close navigation" className="fixed inset-0 z-30 bg-[#17141f]/35 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSidebarOpen(false)} />}
      </AnimatePresence>
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-[#2c0f73]/10 bg-white px-4 py-6 transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center px-3">
          <img src={wordmark} alt="Rentivo" className="h-10 w-auto" />
        </div>
        <div className="mt-10 px-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#aaa4b4]">Workspace</p>
          <div className="mt-3 flex items-center gap-3 rounded-xl bg-[#f7f6fb] p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#5b21b6] text-sm font-bold text-white">{companyName.slice(0, 1).toUpperCase()}</div>
            <div className="min-w-0"><p className="truncate text-sm font-bold text-[#21142f]">{companyName}</p><p className="text-xs text-[#8b8494]">Admin workspace</p></div>
          </div>
        </div>
        <nav className="mt-8 flex-1 space-y-1">
          {navItems.map((navItem) => <button key={navItem.label} type="button" className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold transition ${navItem.active ? 'bg-[#f0eafa] text-[#5b21b6]' : 'text-[#686173] hover:bg-[#f7f6fb] hover:text-[#21142f]'}`}><Icon name={navItem.icon} size={19} />{navItem.label}</button>)}
        </nav>
        <div className="space-y-1 border-t border-[#eeeaf3] pt-5">
          <button type="button" className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold text-[#686173] transition hover:bg-[#f7f6fb] hover:text-[#21142f]"><Icon name="settings" size={19} />Settings</button>
          <button type="button" onClick={() => { localStorage.removeItem('rentivo_access_token'); window.location.href = '/' }} className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold text-[#686173] transition hover:bg-[#f7f6fb] hover:text-[#21142f]"><span className="text-base">↪</span>Sign out</button>
        </div>
      </aside>

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-[#2c0f73]/10 bg-white/90 px-5 backdrop-blur-md sm:px-8">
          <div className="flex items-center gap-3"><button type="button" aria-label="Open navigation" onClick={() => setSidebarOpen(true)} className="cursor-pointer rounded-lg p-2 text-[#686173] hover:bg-[#f7f6fb] lg:hidden"><span className="block h-0.5 w-5 bg-current shadow-[0_6px_0_currentColor,0_-6px_0_currentColor]" /></button><div className="hidden items-center gap-2 text-sm text-[#8b8494] sm:flex"><span>Workspace</span><span>/</span><strong className="font-semibold text-[#40384b]">Overview</strong></div><h1 className="text-lg font-bold text-[#21142f] sm:hidden">Overview</h1></div>
          <div className="flex items-center gap-2 sm:gap-4"><button type="button" aria-label="Search" className="cursor-pointer rounded-lg p-2.5 text-[#686173] transition hover:bg-[#f7f6fb] hover:text-[#5b21b6]"><Icon name="search" /></button><button type="button" aria-label="Notifications" className="relative cursor-pointer rounded-lg p-2.5 text-[#686173] transition hover:bg-[#f7f6fb] hover:text-[#5b21b6]"><Icon name="bell" /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#ef4444]" /></button><div className="h-8 w-px bg-[#eeeaf3]" /><div className="flex items-center gap-2"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ede9fe] text-sm font-bold text-[#6d28d9]">AD</div><div className="hidden sm:block"><p className="text-sm font-bold text-[#21142f]">Admin</p><p className="text-xs text-[#8b8494]">Administrator</p></div></div></div>
        </header>

        <main className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10">
          <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div><p className="text-sm font-medium text-[#8b8494]">Thursday, November 20, 2026</p><h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#21142f] sm:text-4xl">Good morning, Admin <span aria-hidden="true">👋</span></h2><p className="mt-2 text-sm text-[#686173]">Here&apos;s what&apos;s happening with your rental business today.</p></div>
            <button type="button" className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg bg-[#5b21b6] px-4 py-3 text-sm font-bold text-white shadow-[0_8px_20px_rgba(91,33,182,0.18)] transition hover:bg-[#4c1d95]"><Icon name="plus" size={18} />New booking</button>
          </motion.div>

          <motion.div variants={stagger} initial="hidden" animate="visible" className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => <motion.div variants={item} key={stat.label} className="rounded-xl border border-[#2c0f73]/10 bg-white p-5 shadow-[0_8px_24px_rgba(45,28,82,0.05)]"><div className="flex items-start justify-between"><div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.tone === 'purple' ? 'bg-[#ede9fe] text-[#6d28d9]' : stat.tone === 'blue' ? 'bg-[#dbeafe] text-[#2563eb]' : stat.tone === 'orange' ? 'bg-[#ffedd5] text-[#ea580c]' : 'bg-[#dcfce7] text-[#15803d]'}`}><Icon name={stat.icon} size={20} /></div><span className="rounded-full bg-[#f0fdf4] px-2 py-1 text-[11px] font-bold text-[#16a34a]">{stat.change}</span></div><p className="mt-5 text-sm font-medium text-[#686173]">{stat.label}</p><p className="mt-1 text-2xl font-semibold tracking-tight text-[#21142f]">{stat.value}</p><p className="mt-1 text-xs text-[#aaa4b4]">{stat.detail}</p></motion.div>)}
          </motion.div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,1fr)]">
            <motion.section initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24, duration: 0.45 }} className="rounded-xl border border-[#2c0f73]/10 bg-white p-5 shadow-[0_8px_24px_rgba(45,28,82,0.05)] sm:p-6">
              <div className="flex items-start justify-between"><div><h3 className="font-bold text-[#21142f]">Revenue overview</h3><p className="mt-1 text-sm text-[#8b8494]">Monthly revenue performance</p></div><select aria-label="Revenue period" className="cursor-pointer rounded-lg border border-[#e5e1ed] bg-white px-3 py-2 text-xs font-semibold text-[#686173] outline-none focus:border-[#6d28d9]"><option>Last 6 months</option><option>Last 12 months</option></select></div>
              <div className="relative mt-8 h-[220px]"><div className="absolute inset-0 flex flex-col justify-between text-[11px] text-[#aaa4b4]"><span>₱60k</span><span>₱40k</span><span>₱20k</span><span>₱0</span></div><div className="absolute inset-0 left-10 flex flex-col justify-between"><span className="border-t border-dashed border-[#eeeaf3]" /><span className="border-t border-dashed border-[#eeeaf3]" /><span className="border-t border-dashed border-[#eeeaf3]" /><span className="border-t border-[#eeeaf3]" /></div><div className="absolute inset-x-10 bottom-5 top-3 flex items-end justify-around gap-3 sm:gap-6"><div className="absolute inset-0 opacity-80"><svg preserveAspectRatio="none" className="h-full w-full overflow-visible" viewBox="0 0 600 190"><defs><linearGradient id="revenueFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#8b5cf6" stopOpacity=".22" /><stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" /></linearGradient></defs><path d="M0 158 C42 149 53 130 100 135 S151 115 200 122 S250 92 300 102 S350 75 400 83 S450 45 500 56 S555 19 600 25 V190 H0Z" fill="url(#revenueFill)" /><path d="M0 158 C42 149 53 130 100 135 S151 115 200 122 S250 92 300 102 S350 75 400 83 S450 45 500 56 S555 19 600 25" fill="none" stroke="#7c3aed" strokeLinecap="round" strokeWidth="3" /></svg></div>{['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'].map((month) => <span key={month} className="z-10 text-[11px] text-[#aaa4b4]">{month}</span>)}</div></div>
              <div className="mt-2 flex items-center gap-2 text-xs text-[#686173]"><span className="h-2 w-2 rounded-full bg-[#7c3aed]" />Revenue <span className="ml-1 font-bold text-[#21142f]">₱248,450</span><span className="ml-auto font-semibold text-[#16a34a]">+12.8% from last month</span></div>
            </motion.section>

            <motion.section initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.31, duration: 0.45 }} className="rounded-xl border border-[#2c0f73]/10 bg-white p-5 shadow-[0_8px_24px_rgba(45,28,82,0.05)] sm:p-6">
              <div className="flex items-start justify-between"><div><h3 className="font-bold text-[#21142f]">Fleet overview</h3><p className="mt-1 text-sm text-[#8b8494]">Current vehicle availability</p></div><button type="button" className="cursor-pointer text-xs font-bold text-[#5b21b6] hover:underline">View fleet</button></div>
              <div className="mt-7 flex items-center gap-7"><div className="relative flex h-32 w-32 shrink-0 items-center justify-center rounded-full" style={{ background: 'conic-gradient(#7c3aed 0 78%, #ede9fe 78% 100%)' }}><div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-white"><span className="text-2xl font-semibold text-[#21142f]">78%</span><span className="text-[10px] text-[#8b8494]">utilized</span></div></div><div className="min-w-0 space-y-3 text-sm"><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#7c3aed]" /><span className="text-[#686173]">On rental</span><strong className="ml-auto text-[#21142f]">32</strong></div><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#c4b5fd]" /><span className="text-[#686173]">Available</span><strong className="ml-auto text-[#21142f]">7</strong></div><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#e5e1ed]" /><span className="text-[#686173]">In service</span><strong className="ml-auto text-[#21142f]">2</strong></div></div></div><div className="mt-7 border-t border-[#eeeaf3] pt-4 text-sm"><span className="text-[#686173]">Total fleet</span><strong className="float-right text-[#21142f]">41 vehicles</strong></div>
            </motion.section>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,1fr)]">
            <motion.section initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38, duration: 0.45 }} className="rounded-xl border border-[#2c0f73]/10 bg-white p-5 shadow-[0_8px_24px_rgba(45,28,82,0.05)] sm:p-6">
              <div className="flex items-center justify-between"><div><h3 className="font-bold text-[#21142f]">Upcoming bookings</h3><p className="mt-1 text-sm text-[#8b8494]">Your next scheduled rentals</p></div><button type="button" className="inline-flex cursor-pointer items-center gap-1 text-xs font-bold text-[#5b21b6] hover:underline">View all <Icon name="arrow" size={14} /></button></div>
              <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[560px] text-left"><thead><tr className="border-b border-[#eeeaf3] text-[11px] font-bold uppercase tracking-wider text-[#aaa4b4]"><th className="pb-3">Customer</th><th className="pb-3">Vehicle</th><th className="pb-3">Rental dates</th><th className="pb-3">Status</th><th /></tr></thead><tbody>{bookings.map((booking) => <tr key={booking.customer} className="border-b border-[#f3f1f6] last:border-0"><td className="py-4"><div className="flex items-center gap-3"><span className={`flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold ${booking.color}`}>{booking.initials}</span><span className="text-sm font-semibold text-[#40384b]">{booking.customer}</span></div></td><td className="py-4 text-sm text-[#686173]">{booking.vehicle}</td><td className="py-4 text-sm text-[#686173]">{booking.dates}</td><td className="py-4"><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${booking.status === 'Active' ? 'bg-[#dcfce7] text-[#15803d]' : booking.status === 'Upcoming' ? 'bg-[#dbeafe] text-[#2563eb]' : 'bg-[#fef3c7] text-[#b45309]'}`}>{booking.status}</span></td><td className="py-4 text-right"><button type="button" aria-label={`More options for ${booking.customer}`} className="cursor-pointer rounded p-1 text-[#aaa4b4] hover:bg-[#f7f6fb] hover:text-[#686173]"><Icon name="more" size={18} /></button></td></tr>)}</tbody></table></div>
            </motion.section>
            <motion.section initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.45 }} className="rounded-xl border border-[#2c0f73]/10 bg-white p-5 shadow-[0_8px_24px_rgba(45,28,82,0.05)] sm:p-6"><div className="flex items-center justify-between"><div><h3 className="font-bold text-[#21142f]">Recent activity</h3><p className="mt-1 text-sm text-[#8b8494]">Latest workspace updates</p></div><button type="button" aria-label="More activity options" className="cursor-pointer rounded p-1 text-[#aaa4b4] hover:bg-[#f7f6fb]"><Icon name="more" size={18} /></button></div><div className="mt-5 space-y-5">{activities.map((activity) => <div key={activity.title} className="flex gap-3"><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${activity.tone}`}><Icon name={activity.icon} size={17} /></div><div className="min-w-0"><p className="text-sm font-semibold text-[#40384b]">{activity.title}</p><p className="mt-0.5 truncate text-xs text-[#8b8494]">{activity.text}</p></div><span className="ml-auto shrink-0 text-[11px] text-[#aaa4b4]">{activity.time}</span></div>)}</div><button type="button" className="mt-6 w-full cursor-pointer rounded-lg border border-[#e5e1ed] py-2.5 text-xs font-bold text-[#5b21b6] transition hover:bg-[#f7f6fb]">View all activity</button></motion.section>
          </div>
        </main>
      </div>
    </div>
  )
}
