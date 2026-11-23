import heroImage from '../assets/rentivo-dashboard-devices-mockup.png'
import organizedBookingsImage from '../assets/from-chaos-to-organized-bookings.png'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Navigate, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom'
import OnboardingPage from './OnboardingPage'
import DashboardPage from './DashboardPage'
import PricingPage from './PricingPage'
import PublicHeader from '../components/PublicHeader'
import PublicBookingPage from './PublicBookingPage'
import SuperAdminPage from './SuperAdminPage'

const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api'

function HomePage() {
  const prefersReducedMotion = useReducedMotion()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [verificationEmail, setVerificationEmail] = useState('')
  const [resent, setResent] = useState(false)
  const [verified, setVerified] = useState(false)
  const [isSignupOpen, setIsSignupOpen] = useState(false)
  const [isSignInOpen, setIsSignInOpen] = useState(false)
  const [signInError, setSignInError] = useState('')
  const [signInVerificationRequired, setSignInVerificationRequired] = useState(false)
  const [signInVerificationSent, setSignInVerificationSent] = useState(false)
  const [resendingSignInVerification, setResendingSignInVerification] = useState(false)

  useEffect(() => {
    const isVerified = searchParams.get('verified') === '1'
    const signInRequested = searchParams.get('signin') === '1'
    const signUpRequested = searchParams.get('signup') === '1'
    setVerified(isVerified)
    setIsSignInOpen(signInRequested)
    setIsSignupOpen(isVerified || signUpRequested)
    if (isVerified) {
      setVerificationEmail(localStorage.getItem('rentivo_pending_email') ?? '')
    }
  }, [searchParams])

  const closeSignIn = () => {
    setIsSignInOpen(false)
    setSignInVerificationRequired(false)
    setSignInVerificationSent(false)
    setSignInError('')
    const params = new URLSearchParams(searchParams)
    params.delete('signin')
    setSearchParams(params, { replace: true })
  }

  const closeSignUp = () => {
    setIsSignupOpen(false)
    const params = new URLSearchParams(searchParams)
    params.delete('signup')
    params.delete('verified')
    setSearchParams(params, { replace: true })
  }

  useEffect(() => {
    if (!isSignupOpen && !isSignInOpen) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeSignIn()
        closeSignUp()
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleEscape)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isSignupOpen, isSignInOpen])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSuccess('')
    setIsSubmitting(true)

    const form = event.currentTarget
    const formData = new FormData(form)
    const payload = {
      company_name: String(formData.get('company_name') ?? ''),
      name: String(formData.get('full_name') ?? ''),
      email: String(formData.get('email') ?? ''),
      password: String(formData.get('password') ?? ''),
    }

    try {
      const response = await fetch(`${apiBaseUrl}/register`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()

      if (!response.ok) {
        const validationMessage = data.errors
          ? Object.values(data.errors).flat().join(' ')
          : data.message
        setError(String(validationMessage || 'We could not create your account.'))
        return
      }

      setSuccess(`Your ${data.organization.name} workspace is ready.`)
      setVerificationEmail(payload.email)
      localStorage.setItem('rentivo_access_token', data.token)
      localStorage.setItem('rentivo_pending_email', payload.email)
      localStorage.setItem('rentivo_pending_company', payload.company_name)
      form.reset()
    } catch {
      setError('We could not connect to the registration service. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const resendVerification = async () => {
    setError('')
    setResent(false)
    try {
      const response = await fetch(`${apiBaseUrl}/email/verification-notification`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: verificationEmail }),
      })
      if (!response.ok) throw new Error('Unable to resend')
      setResent(true)
    } catch {
      setError('We could not resend the verification email. Please try again.')
    }
  }

  const resendSignInVerification = async () => {
    setSignInError('')
    setSignInVerificationSent(false)
    setResendingSignInVerification(true)
    try {
      const response = await fetch(`${apiBaseUrl}/email/verification-notification`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: verificationEmail }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to resend')
      setSignInVerificationSent(true)
    } catch (resendError) {
      setSignInError(resendError instanceof Error ? resendError.message : 'We could not resend the verification email. Please try again.')
    } finally {
      setResendingSignInVerification(false)
    }
  }

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSignInError('')
    setSignInVerificationRequired(false)
    setSignInVerificationSent(false)
    setIsSubmitting(true)

    const formData = new FormData(event.currentTarget)
    const email = String(formData.get('email') ?? '')

    try {
      const response = await fetch(`${apiBaseUrl}/login`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password: String(formData.get('password') ?? ''),
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        setSignInError(String(data.message || 'We could not sign you in.'))
        if (response.status === 403 && data.email_verification_required) {
          setVerificationEmail(email)
          setSignInVerificationRequired(true)
        }
        return
      }

      localStorage.setItem('rentivo_access_token', data.token)
      localStorage.setItem('rentivo_pending_email', email)
      localStorage.setItem('rentivo_pending_company', data.organization?.name ?? '')

      if (data.is_superadmin) {
        navigate('/rentivo-control')
        return
      }

      if (data.onboarding_completed) {
        navigate('/dashboard')
      } else {
        navigate('/onboarding')
      }
    } catch {
      setSignInError('We could not connect to the sign-in service. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f6fb] text-[#17141f]">
      <PublicHeader />

      <section id="home" className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-[1fr_620px]">
        <motion.div initial={prefersReducedMotion ? false : { opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.55, delay: 0.08 }} className="max-w-xl">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#5b21b6]">Fleet operations</p>
          <h1 className="mt-4 text-5xl font-semibold leading-[1.05] tracking-tight text-[#21142f] sm:text-6xl">Rental operations, organized.</h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-[#686173]">Rentivo brings fleet, booking, customer, payment, and POS workflows into one independent SaaS workspace.</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => setIsSignupOpen(true)} className="cursor-pointer rounded-lg bg-[#5b21b6] px-6 py-3.5 text-sm font-bold text-white shadow-[0_10px_24px_rgba(91,33,182,0.18)] transition hover:bg-[#4c1d95]">
              Start your free trial
            </button>
            <a href="/pricing" className="cursor-pointer rounded-lg border border-[#dcd8e6] bg-white px-6 py-3.5 text-sm font-bold text-[#5b21b6] transition hover:border-[#c4b5fd] hover:bg-[#f7f6fb]">
              View Pricing
            </a>
          </div>
        </motion.div>
        <motion.img initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.94, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} whileHover={prefersReducedMotion ? undefined : { scale: 1.03, y: -4 }} transition={{ duration: 0.7, delay: 0.12 }} src={heroImage} alt="" className="mx-auto w-full max-w-[620px]" />
      </section>

      <section className="overflow-hidden border-y border-[#2c0f73]/10 bg-white py-20 sm:py-28">
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.55 }}
          className="mx-auto grid max-w-6xl items-center gap-10 px-6 lg:grid-cols-2 lg:gap-16"
        >
          <motion.div
            whileHover={prefersReducedMotion ? undefined : { x: 6 }}
            transition={{ type: 'spring', stiffness: 180, damping: 18 }}
            className="order-2 max-w-xl lg:order-2 lg:pl-6"
          >
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#5b21b6]">Less administration. More control.</p>
            <h2 className="mt-4 text-4xl font-semibold leading-[1.08] tracking-tight text-[#21142f] sm:text-5xl">Say goodbye to scattered spreadsheets.</h2>
            <p className="mt-6 text-lg leading-8 text-[#686173]">
              Managing a rental business shouldn't mean jumping between spreadsheets, chat conversations, paper contracts, and disconnected tools.
            </p>
            <p className="mt-4 text-lg leading-8 text-[#686173]">
              Rentivo brings your entire operation together, giving you one organized workspace to manage your fleet, bookings, customers, and finances without the unnecessary complexity.
            </p>
            <p className="mt-7 text-lg font-bold text-[#21142f]">Everything connected. Nothing scattered.</p>
          </motion.div>
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.65, delay: 0.08 }}
            whileHover={prefersReducedMotion ? undefined : { scale: 1.025, rotate: -0.35, y: -4 }}
            className="order-1 lg:order-1 lg:-ml-24 lg:w-[calc(100%+6rem)]"
          >
            <img
              src={organizedBookingsImage}
              alt="Rentivo bookings dashboard replacing scattered spreadsheets and paper contracts"
              className="w-full scale-[1.08] cursor-pointer rounded-2xl object-contain drop-shadow-[0_24px_50px_rgba(45,28,82,0.12)] transition-transform duration-500"
            />
          </motion.div>
        </motion.div>
      </section>

      <AnimatePresence>
        {isSignInOpen && (
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#17141f]/55 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="signin-title"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeSignIn()
            }}
          >
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.96, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              transition={{ duration: 0.28 }}
              className="relative w-full max-w-md rounded-2xl bg-white p-8 shadow-[0_30px_100px_rgba(23,20,31,0.35)] sm:p-10"
            >
              <button
                type="button"
                onClick={closeSignIn}
                className="absolute right-4 top-4 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-xl text-[#686173] hover:bg-[#f7f6fb] hover:text-[#21142f]"
                aria-label="Close sign-in"
              >
                x
              </button>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#5b21b6]">Welcome back</p>
              <h2 id="signin-title" className="mt-3 text-3xl font-semibold tracking-tight text-[#21142f]">Sign in to Rentivo</h2>
              <form className="mt-7 space-y-5" onSubmit={handleSignIn}>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-[#40384b]">Email</span>
                  <input name="email" type="email" required autoComplete="email" placeholder="you@company.com" className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3 outline-none transition placeholder:text-[#aaa4b4] focus:border-[#6d28d9] focus:ring-3 focus:ring-[#6d28d9]/10" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-[#40384b]">Password</span>
                  <input name="password" type="password" required autoComplete="current-password" placeholder="Your password" className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3 outline-none transition placeholder:text-[#aaa4b4] focus:border-[#6d28d9] focus:ring-3 focus:ring-[#6d28d9]/10" />
                </label>
                {signInError && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                    {signInError}
                  </p>
                )}
                {signInVerificationRequired && (
                  <div className="rounded-lg border border-[#e5e1ed] bg-[#faf9fc] px-3 py-3 text-sm">
                    <p className="text-[#686173]">Your email address is not verified.</p>
                    {signInVerificationSent ? (
                      <p className="mt-2 font-semibold text-[#5b21b6]">Verification email resent to {verificationEmail}.</p>
                    ) : (
                      <button
                        type="button"
                        onClick={resendSignInVerification}
                        disabled={resendingSignInVerification}
                        className="mt-2 cursor-pointer text-sm font-bold text-[#5b21b6] underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {resendingSignInVerification ? 'Resending...' : 'Resend verification email'}
                      </button>
                    )}
                  </div>
                )}
                <button type="submit" disabled={isSubmitting} className="w-full cursor-pointer rounded-lg bg-[#5b21b6] px-5 py-3.5 font-bold text-white shadow-[0_10px_24px_rgba(91,33,182,0.18)] transition hover:bg-[#4c1d95] disabled:cursor-not-allowed disabled:opacity-60">
                  {isSubmitting ? 'Signing in...' : 'Sign in'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSignupOpen && (
          <motion.div initial={prefersReducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-[#17141f]/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="signup-title" onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeSignUp()
          }}>
            <motion.div initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.96, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: 10 }} transition={{ duration: 0.28 }} className="relative grid max-h-[calc(100vh-2rem)] w-full max-w-5xl overflow-y-auto rounded-2xl border border-white/20 bg-[#f7f6fb] shadow-[0_30px_100px_rgba(23,20,31,0.35)] lg:grid-cols-[1fr_440px]">
              <button type="button" onClick={closeSignUp} className="absolute right-4 top-4 z-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white text-xl text-[#686173] shadow-sm hover:text-[#21142f]" aria-label="Close registration">x</button>
              <div className="hidden flex-col justify-center px-16 py-14 lg:flex">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#5b21b6]">Free trial</p>
                <h2 id="signup-title" className="mt-4 text-5xl font-semibold leading-[1.05] tracking-tight text-[#21142f]">Start Your Free Trial Today</h2>
                <p className="mt-6 text-lg leading-8 text-[#686173]">Streamline your rental operations and explore the full platform with zero risk or setup hassle.</p>
              </div>
              <div className="m-4 rounded-xl bg-white p-8 shadow-[0_16px_40px_rgba(45,28,82,0.10)] sm:p-10 lg:m-5">
                {success || verified ? (
                  <div className="flex min-h-[420px] flex-col items-center justify-center text-center" role="status">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#ede9fe] text-2xl text-[#5b21b6]">✓</div>
                    <h2 className="mt-5 text-2xl font-semibold text-[#21142f]">{verified ? 'Email verified' : 'Verify your email'}</h2>
                    {verified ? (
                      <>
                        <p className="mt-3 text-[#686173]">Your email address has been verified. You're ready to continue.</p>
                        <button
                          type="button"
                          onClick={() => {
                            const token = localStorage.getItem('rentivo_access_token')
                            window.location.href = token ? '/onboarding' : '/?signin=1'
                          }}
                          className="mt-6 cursor-pointer rounded-lg bg-[#5b21b6] px-6 py-3.5 text-sm font-bold text-white shadow-[0_10px_24px_rgba(91,33,182,0.18)] transition hover:bg-[#4c1d95]"
                        >
                          Continue to Onboarding
                        </button>
                      </>
                    ) : (
                      <p className="mt-3 text-[#686173]">We sent a verification link to <strong className="font-semibold text-[#40384b]">{verificationEmail}</strong>.</p>
                    )}
                    {!verified && resent && <p className="mt-3 text-sm font-medium text-[#5b21b6]">Verification email resent.</p>}
                    {!verified && <button type="button" onClick={resendVerification} className="mt-6 cursor-pointer text-sm font-bold text-[#5b21b6] underline underline-offset-4">Resend verification email</button>}
                    {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
                  </div>
                ) : (
                  <>
                    <h2 className="text-2xl font-semibold text-[#21142f]">Create your account</h2>
                    <p className="mt-2 text-sm text-[#686173]">Start with all features included.</p>
                    <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                      {[
                        ['company_name', 'Company Name', 'text', 'organization', 'Acme Rentals'],
                        ['full_name', 'Full Name', 'text', 'name', 'Your full name'],
                        ['email', 'Email', 'email', 'email', 'you@company.com'],
                        ['password', 'Password', 'password', 'new-password', 'At least 8 characters'],
                      ].map(([name, label, type, autocomplete, placeholder]) => (
                        <label className="block" key={name}>
                          <span className="mb-2 block text-sm font-semibold text-[#40384b]">{label}</span>
                          <input name={name} type={type} required minLength={name === 'password' ? 8 : undefined} autoComplete={autocomplete} placeholder={placeholder} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3 outline-none transition placeholder:text-[#aaa4b4] focus:border-[#6d28d9] focus:ring-3 focus:ring-[#6d28d9]/10" />
                        </label>
                      ))}
                      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
                      <button type="submit" disabled={isSubmitting} className="mt-2 w-full cursor-pointer rounded-lg bg-[#5b21b6] px-5 py-3.5 font-bold text-white shadow-[0_10px_24px_rgba(91,33,182,0.18)] transition hover:bg-[#4c1d95] disabled:cursor-not-allowed disabled:opacity-60">
                        {isSubmitting ? 'Creating your workspace...' : 'Start My Free Trial'}
                      </button>
                    </form>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/booking/:slug" element={<PublicBookingPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/rentivo-control" element={<SuperAdminPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/dashboard/*" element={<DashboardPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
