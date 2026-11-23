import { AnimatePresence, motion } from 'framer-motion'
import type { ReactNode } from 'react'
import wordmark from '../../assets/rentivo-purple-wing-logo.png'
import { DashboardIcon, type DashboardIconName } from './DashboardIcon'

export type DashboardNavItem = { label: string; icon: DashboardIconName }
export type DashboardNavGroup = { label: string; items: DashboardNavItem[] }

type DashboardShellProps = {
  children: ReactNode
  companyName: string
  activeSection: string
  navGroups: DashboardNavGroup[]
  openGroups: Record<string, boolean>
  sidebarOpen: boolean
  onToggleSidebar: (open: boolean) => void
  onToggleGroup: (label: string) => void
  onNavigate: (section: string) => void
  onSettings: () => void
  onSignOut: () => void
}

export function DashboardShell({
  children,
  companyName,
  activeSection,
  navGroups,
  openGroups,
  sidebarOpen,
  onToggleSidebar,
  onToggleGroup,
  onNavigate,
  onSettings,
  onSignOut,
}: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-[#f7f6fb] text-[#17141f]">
      <AnimatePresence>
        {sidebarOpen && (
          <motion.button
            aria-label="Close navigation"
            className="fixed inset-0 z-30 bg-[#17141f]/35 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onToggleSidebar(false)}
          />
        )}
      </AnimatePresence>

      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-[#2c0f73]/10 bg-white px-4 py-6 transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center px-3">
          <img src={wordmark} alt="Rentivo" className="h-10 w-auto" />
        </div>

        <div className="mt-8 px-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#aaa4b4]">Workspace</p>
          <div className="mt-3 flex items-center gap-3 rounded-xl bg-[#f7f6fb] p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#5b21b6] text-sm font-bold text-white">
              {companyName.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[#21142f]">{companyName}</p>
              <p className="text-xs text-[#8b8494]">Admin workspace</p>
            </div>
          </div>
        </div>

        <nav className="rentivo-sidebar-scroll mt-5 min-h-0 flex-1 space-y-2 overflow-y-auto pb-4">
          {navGroups.map((group) => (
            <div key={group.label}>
              <button
                type="button"
                onClick={() => onToggleGroup(group.label)}
                className="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#aaa4b4]"
              >
                <span>{group.label}</span>
                <motion.span animate={{ rotate: openGroups[group.label] ? 90 : 0 }}>›</motion.span>
              </button>
              <AnimatePresence initial={false}>
                {openGroups[group.label] && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-1 pt-1">
                      {group.items.map((navItem) => (
                        <button
                          key={navItem.label}
                          type="button"
                          onClick={() => onNavigate(navItem.label)}
                          className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition ${
                            activeSection === navItem.label
                              ? 'bg-[#f0eafa] text-[#5b21b6]'
                              : 'text-[#686173] hover:bg-[#f7f6fb] hover:text-[#21142f]'
                          }`}
                        >
                          <DashboardIcon name={navItem.icon} size={18} />
                          {navItem.label}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </nav>

        <div className="mt-auto shrink-0 border-t border-[#eeeaf3] bg-white pt-4">
          <button
            type="button"
            onClick={onSettings}
            className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold transition ${
              activeSection === 'Settings'
                ? 'bg-[#f0eafa] text-[#5b21b6]'
                : 'text-[#686173] hover:bg-[#f7f6fb] hover:text-[#21142f]'
            }`}
          >
            <DashboardIcon name="settings" size={19} />
            Settings
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold text-[#686173] transition hover:bg-[#f7f6fb]"
          >
            <span>↪</span>
            Sign out
          </button>
        </div>
      </aside>

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-[#2c0f73]/10 bg-white/90 px-5 backdrop-blur-md sm:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Open navigation"
              onClick={() => onToggleSidebar(true)}
              className="cursor-pointer rounded-lg p-2 text-[#686173] lg:hidden"
            >
              <span className="block h-0.5 w-5 bg-current shadow-[0_6px_0_currentColor,0_-6px_0_currentColor]" />
            </button>
            <div className="hidden items-center gap-2 text-sm text-[#8b8494] sm:flex">
              <span>Workspace</span><span>/</span><strong className="font-semibold text-[#40384b]">{activeSection}</strong>
            </div>
            <h1 className="text-lg font-bold sm:hidden">{activeSection}</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <button type="button" aria-label="Search" className="cursor-pointer rounded-lg p-2.5 text-[#686173] hover:bg-[#f7f6fb]">
              <DashboardIcon name="search" />
            </button>
            <button type="button" aria-label="Notifications" className="relative cursor-pointer rounded-lg p-2.5 text-[#686173] hover:bg-[#f7f6fb]">
              <DashboardIcon name="bell" />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#ef4444]" />
            </button>
            <div className="h-8 w-px bg-[#eeeaf3]" />
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ede9fe] text-sm font-bold text-[#6d28d9]">AD</div>
          </div>
        </header>
        {children}
      </div>
    </div>
  )
}
