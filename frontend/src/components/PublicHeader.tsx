import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import wordmark from '../assets/rentivo-purple-wing-logo.png'

type PublicUser = {
  id: number
  name: string
  email: string
  role?: string
}

export default function PublicHeader() {
  const prefersReducedMotion = useReducedMotion()
  const navigate = useNavigate()
  const [user, setUser] = useState<PublicUser | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const token = localStorage.getItem('rentivo_access_token')
  const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api'

  useEffect(() => {
    if (!token) {
      setUser(null)
      return
    }
    fetch(`${apiBaseUrl}/user`, { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } })
      .then((response) => {
        if (!response.ok) throw new Error('Invalid session')
        return response.json()
      })
      .then((data: PublicUser) => setUser(data))
      .catch(() => {
        localStorage.removeItem('rentivo_access_token')
        setUser(null)
      })
  }, [apiBaseUrl, token])

  useEffect(() => {
    if (!menuOpen) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [menuOpen])

  const signOut = async () => {
    if (token) {
      await fetch(`${apiBaseUrl}/logout`, {
        method: 'POST',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      }).catch(() => undefined)
    }
    localStorage.removeItem('rentivo_access_token')
    localStorage.removeItem('rentivo_pending_company')
    setUser(null)
    setMenuOpen(false)
    navigate('/')
  }

  const initials = user?.name
    ?.split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'AD'

  return (
    <motion.header
      initial={prefersReducedMotion ? false : { opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="relative z-40 flex h-20 items-center justify-between border-b border-[#2c0f73]/10 bg-white px-6 sm:px-10"
    >
      <Link to="/" aria-label="Rentivo home">
        <img src={wordmark} alt="Rentivo" className="h-10 w-auto sm:h-12" />
      </Link>
      <nav aria-label="Primary navigation" className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 md:flex">
        <Link to="/" className="text-sm font-semibold text-[#40384b] transition hover:text-[#5b21b6]">Home</Link>
        <Link to="/pricing" className="text-sm font-semibold text-[#40384b] transition hover:text-[#5b21b6]">Pricing</Link>
        <Link to="/#features" className="text-sm font-semibold text-[#40384b] transition hover:text-[#5b21b6]">Features</Link>
      </nav>
      <div className="flex items-center gap-3">
        {user ? (
          <div className="relative">
            <button type="button" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-haspopup="menu" className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#e5e1ed] bg-white py-1.5 pl-1.5 pr-3 text-left transition hover:bg-[#f7f6fb]">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ede9fe] text-xs font-bold text-[#6d28d9]">{initials}</span>
              <span className="hidden max-w-32 sm:block">
                <span className="block truncate text-sm font-bold text-[#21142f]">{user.name}</span>
                <span className="block truncate text-[11px] text-[#8b8494]">{localStorage.getItem('rentivo_pending_company') || 'Rentivo workspace'}</span>
              </span>
            </button>
            <AnimatePresence>
              {menuOpen && (
                <motion.div initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.98 }} transition={{ duration: 0.16 }} role="menu" className="absolute right-0 top-[calc(100%+10px)] w-64 overflow-hidden rounded-xl border border-[#2c0f73]/10 bg-white p-2 shadow-[0_18px_50px_rgba(45,28,82,0.16)]">
                  <div className="border-b border-[#eeeaf3] px-3 py-3">
                    <p className="truncate text-sm font-bold text-[#21142f]">{user.name}</p>
                    <p className="mt-0.5 truncate text-xs text-[#8b8494]">{user.email}</p>
                  </div>
                  <Link to="/dashboard" role="menuitem" onClick={() => setMenuOpen(false)} className="mt-1 flex cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold text-[#40384b] transition hover:bg-[#f7f6fb] hover:text-[#5b21b6]">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ede9fe] text-[#6d28d9]">▦</span>
                    Dashboard
                  </Link>
                  <button type="button" role="menuitem" onClick={signOut} className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold text-[#686173] transition hover:bg-red-50 hover:text-red-700">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f7f6fb]">↪</span>
                    Sign out
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <>
            <Link to="/?signin=1" className="cursor-pointer rounded-lg px-4 py-3 text-sm font-bold text-[#40384b] transition hover:bg-[#f7f6fb]">Sign in</Link>
            <Link to="/?signup=1" className="cursor-pointer rounded-lg bg-[#5b21b6] px-5 py-3 text-sm font-bold text-white shadow-[0_8px_20px_rgba(91,33,182,0.18)] transition hover:bg-[#4c1d95]">Get started</Link>
          </>
        )}
      </div>
    </motion.header>
  )
}
