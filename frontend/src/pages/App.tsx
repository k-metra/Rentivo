import heroImage from '../assets/rentivo-dashboard-devices-mockup.png'
import organizedBookingsImage from '../assets/from-chaos-to-organized-bookings.png'
import workflowBookingImage from '../assets/workflow-booking.png'
import workflowPreparationImage from '../assets/workflow-preparation.png'
import workflowOperationsImage from '../assets/workflow-operations.png'
import workflowCompletionImage from '../assets/workflow-completion.png'
import branchNetworkImage from '../assets/rentivo-branch-network.png'
import dashboardOrbitImage from '../assets/rentivo-dashboard-orbit.png'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import OnboardingPage from './OnboardingPage'
import DashboardPage from './DashboardPage'
import PricingPage from './PricingPage'
import PublicHeader from '../components/PublicHeader'
import PublicBookingPage from './PublicBookingPage'
import PublicVehiclePage from './PublicVehiclePage'
import PublicCustomerBookingsPage from './PublicCustomerBookingsPage'
import SuperAdminPage from './SuperAdminPage'
import PublicContractPage from './PublicContractPage'
import LegalPage from './LegalPage'
import ForgotPasswordPage from './ForgotPasswordPage'
import ResetPasswordPage from './ResetPasswordPage'
import { appSiteUrl, isDashboardHost, isSplitHostDeployment, publicSiteUrl } from '../config/siteUrls'
import { getPageTitle } from '../utils/pageTitle'

const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api'

const homeFeatures = [
  {
    icon: '01',
    title: 'Manage your fleet',
    description: 'Keep vehicles, rental rates, availability, and maintenance details organized in one place.',
  },
  {
    icon: '02',
    title: 'Stay on top of bookings',
    description: 'Coordinate upcoming rentals, pickup and return schedules, statuses, and customer details.',
  },
  {
    icon: '03',
    title: 'Know your customers',
    description: 'Build complete customer profiles with requirements, attachments, notes, and booking history.',
  },
  {
    icon: '04',
    title: 'Track payments and finances',
    description: 'Record payments, monitor revenue, and keep funds, expenses, and commissions visible.',
  },
  {
    icon: '05',
    title: 'Create digital contracts',
    description: 'Generate reusable contract templates and collect secure two-party electronic signatures.',
  },
  {
    icon: '06',
    title: 'Make informed decisions',
    description: 'Turn your rental activity into clear reports that help you understand performance and growth.',
  },
] as const

const workflowStages = [
  {
    number: '01',
    title: 'Booking',
    headline: 'Every reservation starts organized.',
    image: workflowBookingImage,
    bullets: [
      'Create and manage customer bookings.',
      'Check vehicle availability.',
      'Assign vehicles to reservations.',
      'Monitor upcoming departures.',
    ],
  },
  {
    number: '02',
    title: 'Preparation',
    headline: 'Everything ready before the keys change hands.',
    image: workflowPreparationImage,
    bullets: [
      'Access customer information.',
      'Generate rental agreements.',
      'Prepare contracts for signing.',
      'Review payment status and booking details.',
    ],
  },
  {
    number: '03',
    title: 'Rental Operations',
    headline: 'Stay on top of every active rental.',
    image: workflowOperationsImage,
    bullets: [
      'Monitor ongoing rentals.',
      'Track vehicle releases and returns.',
      'Manage operational statuses.',
      'Keep rental schedules organized.',
    ],
  },
  {
    number: '04',
    title: 'Completion',
    headline: 'Close every rental with confidence.',
    image: workflowCompletionImage,
    bullets: [
      'Process vehicle returns.',
      'Review outstanding balances.',
      'Record payments and expenses.',
      'Keep transaction records accessible.',
    ],
  },
] as const

const advantageBenefits = [
  {
    title: 'One centralized workspace',
    description: 'Keep bookings, fleet, customers, contracts, and finances connected.',
  },
  {
    title: 'Better operational visibility',
    description: "Know what's happening across your rental business without chasing information.",
  },
  {
    title: 'Less administrative overhead',
    description: 'Reduce repetitive work and keep everyday operations organized.',
  },
] as const

function HomePage({ authOnly = false }: { authOnly?: boolean }) {
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
  const openSignup = () => {
    if (isSplitHostDeployment && !isDashboardHost) {
      window.location.href = `${appSiteUrl}/?signup=1`
      return
    }
    setIsSignupOpen(true)
  }

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
      <div hidden={authOnly}>
        <PublicHeader />

      <section id="home" className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-[1fr_620px]">
        <motion.div initial={prefersReducedMotion ? false : { opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.55, delay: 0.08 }} className="max-w-xl">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#5b21b6]">Fleet operations</p>
          <h1 className="mt-4 text-5xl font-semibold leading-[1.05] tracking-tight text-[#21142f] sm:text-6xl">Rental operations, organized.</h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-[#686173]">Rentivo brings fleet, booking, customer, payment, and POS workflows into one independent SaaS workspace.</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button type="button" onClick={openSignup} className="cursor-pointer rounded-lg bg-[#5b21b6] px-6 py-3.5 text-sm font-bold text-white shadow-[0_10px_24px_rgba(91,33,182,0.18)] transition hover:bg-[#4c1d95]">
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

      <section id="features" className="border-b border-[#2c0f73]/10 bg-[#f7f6fb] px-6 py-20 sm:py-28">
       <div className="mx-auto max-w-6xl">
         <motion.div
           initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
           whileInView={{ opacity: 1, y: 0 }}
           viewport={{ once: true, amount: 0.3 }}
           transition={{ duration: 0.5 }}
           className="mx-auto max-w-2xl text-center"
         >
           <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#5b21b6]">Everything in one workspace</p>
           <h2 className="mt-4 text-4xl font-semibold leading-[1.08] tracking-tight text-[#21142f] sm:text-5xl">Everything you need to run rentals better.</h2>
           <p className="mt-5 text-lg leading-8 text-[#686173]">From your first booking to your month-end review, Rentivo keeps every moving part connected.</p>
         </motion.div>

         <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
           {homeFeatures.map((feature, index) => (
             <motion.article
               key={feature.title}
               initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
               whileInView={{ opacity: 1, y: 0 }}
               viewport={{ once: true, amount: 0.2 }}
               transition={{ duration: 0.45, delay: prefersReducedMotion ? 0 : index * 0.06 }}
               whileHover={prefersReducedMotion ? undefined : { y: -5 }}
               className="rounded-2xl border border-[#2c0f73]/10 bg-white p-6 shadow-[0_8px_24px_rgba(45,28,82,0.05)] transition-shadow hover:shadow-[0_16px_34px_rgba(45,28,82,0.1)]"
             >
               <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#ede9fe] text-sm font-bold text-[#5b21b6]" aria-hidden="true">{feature.icon}</div>
               <h3 className="mt-6 text-xl font-bold text-[#21142f]">{feature.title}</h3>
               <p className="mt-3 text-sm leading-7 text-[#686173]">{feature.description}</p>
             </motion.article>
           ))}
         </div>
       </div>
      </section>

      <section className="overflow-visible border-b border-[#2c0f73]/10 bg-white px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5 }}
            className="mx-auto max-w-3xl text-center"
          >
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#5b21b6]">The rental workflow</p>
            <h2 className="mt-4 text-4xl font-semibold leading-[1.08] tracking-tight text-[#21142f] sm:text-5xl">From first booking to final return.</h2>
            <p className="mt-5 text-lg leading-8 text-[#686173]">Every step of your rental operation, connected in one seamless workflow. Rentivo keeps your business organized from reservation to completion.</p>
          </motion.div>

          <div className="relative mt-14">
            <div className="absolute left-[12.5%] right-[12.5%] top-8 hidden h-px bg-[#c4b5fd] md:block" aria-hidden="true" />
            <div className="grid gap-8 md:grid-cols-4 md:gap-5">
              {workflowStages.map((stage, index) => (
                <motion.article
                  key={stage.number}
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  whileHover={prefersReducedMotion ? undefined : { zIndex: 30 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.45, delay: prefersReducedMotion ? 0 : index * 0.08 }}
                  className="relative z-10"
                >
                  <div className="flex items-center gap-3 md:block">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-8 border-white bg-[#5b21b6] text-sm font-bold text-white shadow-[0_0_0_1px_#c4b5fd]">{stage.number}</div>
                    <div className="md:mt-5">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#5b21b6]">{stage.title}</p>
                      <h3 className="mt-2 text-xl font-bold leading-tight text-[#21142f]">{stage.headline}</h3>
                    </div>
                  </div>
                  <motion.div
                    whileHover={prefersReducedMotion ? undefined : { scale: 1.7, y: -18 }}
                    transition={{ duration: 0.45, delay: 0.6, ease: 'easeOut' }}
                    className="relative mt-5 origin-center rounded-2xl border border-[#2c0f73]/10 bg-[#f7f6fb] shadow-[0_8px_24px_rgba(45,28,82,0.06)] hover:shadow-[0_28px_70px_rgba(45,28,82,0.24)]"
                  >
                    <img src={stage.image} alt={`${stage.title} workflow in Rentivo`} className="h-52 w-full rounded-2xl object-cover object-top" />
                  </motion.div>
                  <div className="mt-5">
                    <ul className="space-y-2.5 p-5 text-sm leading-5 text-[#686173]">
                      {stage.bullets.map((bullet) => (
                        <li key={bullet} className="flex gap-2">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#7c3aed]" aria-hidden="true" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.article>
              ))}
            </div>
          </div>

          <motion.p
            initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.5 }}
            className="mt-14 text-center text-xl font-bold text-[#21142f] sm:text-2xl"
          >
            One connected workflow. One organized business.
          </motion.p>
        </div>
      </section>

      <section className="overflow-hidden border-b border-[#2c0f73]/10 bg-[#f7f6fb] px-6 py-20 sm:py-28">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.55 }}
            className="max-w-xl"
          >
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#5b21b6]">Built to grow with your business</p>
            <h2 className="mt-4 text-4xl font-semibold leading-[1.08] tracking-tight text-[#21142f] sm:text-5xl">Start small. Scale without limits.</h2>
            <p className="mt-6 text-lg leading-8 text-[#686173]">Whether you're managing a handful of motorcycles or an expanding fleet across multiple branches, Rentivo gives your business the tools and visibility to keep everything running smoothly.</p>
          </motion.div>

          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, x: 24, scale: 0.96 }}
            whileInView={{ opacity: 1, x: 0, scale: 1 }}
            whileHover={prefersReducedMotion ? undefined : { scale: 1.02, y: -4 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.65, ease: 'easeOut' }}
            className="flex justify-center"
          >
            <img src={branchNetworkImage} alt="Rentivo connecting vehicles and multiple rental branches in one workspace" className="w-full max-w-2xl object-contain drop-shadow-[0_24px_50px_rgba(45,28,82,0.12)]" />
          </motion.div>
        </div>
      </section>

      <section className="border-b border-[#2c0f73]/10 bg-white px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5 }}
            className="mx-auto max-w-3xl text-center"
          >
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#5b21b6]">The Rentivo advantage</p>
            <h2 className="mt-4 text-4xl font-semibold leading-[1.08] tracking-tight text-[#21142f] sm:text-5xl">Everything in its place. Your business in control.</h2>
            <p className="mt-5 text-lg leading-8 text-[#686173]">Running a rental business involves countless moving parts. Rentivo brings them together in one centralized workspace, helping you spend less time managing administrative tasks and more time growing your business.</p>
          </motion.div>

          <div className="mt-14 grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, x: -24, scale: 0.96 }}
              whileInView={{ opacity: 1, x: 0, scale: 1 }}
              whileHover={prefersReducedMotion ? undefined : { scale: 1.02, y: -4 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.65, ease: 'easeOut' }}
              className="flex justify-center"
            >
              <img src={dashboardOrbitImage} alt="Rentivo dashboard connecting bookings, fleet, contracts, payments, and revenue" className="w-full max-w-2xl object-contain drop-shadow-[0_24px_50px_rgba(45,28,82,0.12)]" />
            </motion.div>

            <div className="space-y-5">
              {advantageBenefits.map((benefit, index) => (
                <motion.article
                  key={benefit.title}
                  initial={prefersReducedMotion ? false : { opacity: 0, x: 24 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{ duration: 0.45, delay: prefersReducedMotion ? 0 : index * 0.08 }}
                  className="rounded-2xl border border-[#2c0f73]/10 bg-[#f7f6fb] p-6 shadow-[0_8px_24px_rgba(45,28,82,0.05)]"
                >
                  <div className="flex gap-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ede9fe] text-sm font-bold text-[#5b21b6]" aria-hidden="true">0{index + 1}</span>
                    <div>
                      <h3 className="text-xl font-bold text-[#21142f]">{benefit.title}</h3>
                      <p className="mt-2 text-sm leading-7 text-[#686173]">{benefit.description}</p>
                    </div>
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative isolate overflow-hidden bg-gradient-to-br from-[#5b21b6] via-[#4c1d95] to-[#2c0f73] px-6 py-20 text-white sm:py-28">
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-30" aria-hidden="true">
          <div className="absolute -right-24 -top-32 h-96 w-96 rounded-full bg-[#c4b5fd] blur-3xl" />
          <div className="absolute -bottom-40 left-1/4 h-96 w-96 rounded-full bg-[#7c3aed] blur-3xl" />
          <div className="absolute right-[12%] top-1/2 hidden h-72 w-72 -translate-y-1/2 rotate-12 rounded-[4rem] border border-white/30 md:block" />
          <div className="absolute right-[15%] top-1/2 hidden h-48 w-48 -translate-y-1/2 rotate-12 rounded-[3rem] border border-white/20 md:block" />
        </div>

        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.55 }}
          className="relative mx-auto max-w-3xl text-center"
        >
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#ddd6fe]">Ready when you are</p>
          <h2 className="mt-4 text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">Ready to put your rental operations in order?</h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[#ede9fe]">Bring your fleet, bookings, customers, and business operations together with Rentivo.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={openSignup} className="cursor-pointer rounded-lg bg-white px-6 py-3.5 text-sm font-bold text-[#5b21b6] shadow-[0_12px_28px_rgba(23,20,31,0.2)] transition hover:bg-[#f5f3ff]">
              Start your free trial
            </button>
            <a href="/pricing" className="cursor-pointer rounded-lg border border-white/40 bg-white/10 px-6 py-3.5 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white/20">
              Explore the platform
            </a>
          </div>
        </motion.div>
      </section>

      <footer className="border-t border-[#2c0f73]/10 bg-[#21142f] px-6 py-10 text-[#ede9fe] sm:px-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-lg font-bold text-white">Rentivo</p>
            <p className="mt-1 text-sm text-[#c4b5fd]">Rental operations, organized.</p>
          </div>
          <nav aria-label="Legal navigation" className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold">
            <a href="/privacy-policy" className="cursor-pointer transition hover:text-white">Privacy Policy</a>
            <a href="/terms-and-conditions" className="cursor-pointer transition hover:text-white">Terms and Conditions</a>
          </nav>
        </div>
      </footer>
      </div>

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
                  <span className="mb-2 flex items-center justify-between gap-3 text-sm font-semibold text-[#40384b]">
                    <span>Password</span>
                    <button type="button" onClick={() => navigate('/forgot-password')} className="cursor-pointer text-xs font-bold text-[#5b21b6] underline underline-offset-4">
                      Forgot password?
                    </button>
                  </span>
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

function ExternalRedirect({ to }: { to: string }) {
  useEffect(() => {
    window.location.replace(to)
  }, [to])

  return <main className="p-6 text-center text-sm text-[#686173]">Redirecting…</main>
}

function PublicRoutes() {
  const location = useLocation()
  const authQuery = new URLSearchParams(location.search)
  const needsDashboard = location.pathname === '/' && (
    authQuery.has('signin') || authQuery.has('signup') || authQuery.has('verified')
  )

  if (needsDashboard) {
    return <ExternalRedirect to={`${appSiteUrl}${location.pathname}${location.search}${location.hash}`} />
  }

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/booking/:slug/my-bookings" element={<PublicCustomerBookingsPage />} />
      <Route path="/booking/:slug/vehicles/:vehicleId" element={<PublicVehiclePage />} />
      <Route path="/booking/:slug" element={<PublicBookingPage />} />
      <Route path="/contract/:token" element={<PublicContractPage />} />
      <Route path="/forgot-password" element={<ExternalRedirect to={`${appSiteUrl}/forgot-password`} />} />
      <Route path="/reset-password" element={<ExternalRedirect to={`${appSiteUrl}${location.pathname}${location.search}${location.hash}`} />} />
      <Route path="/privacy-policy" element={<LegalPage type="privacy" />} />
      <Route path="/terms-and-conditions" element={<LegalPage type="terms" />} />
      <Route path="/onboarding" element={<ExternalRedirect to={`${appSiteUrl}/onboarding${location.search}`} />} />
      <Route path="/rentivo-control" element={<ExternalRedirect to={`${appSiteUrl}/rentivo-control${location.search}`} />} />
      <Route path="/dashboard/*" element={<ExternalRedirect to={`${appSiteUrl}${location.pathname}${location.search}${location.hash}`} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function DashboardRoutes() {
  const location = useLocation()

  return (
    <Routes>
      <Route path="/" element={<DashboardHome />} />
      <Route path="/dashboard" element={<ProtectedDashboard />} />
      <Route path="/dashboard/*" element={<ProtectedDashboard />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/rentivo-control" element={<SuperAdminPage />} />
      <Route path="/pricing" element={<ExternalRedirect to={`${publicSiteUrl}${location.pathname}${location.search}${location.hash}`} />} />
      <Route path="/booking/*" element={<ExternalRedirect to={`${publicSiteUrl}${location.pathname}${location.search}${location.hash}`} />} />
      <Route path="/contract/*" element={<ExternalRedirect to={`${publicSiteUrl}${location.pathname}${location.search}${location.hash}`} />} />
      <Route path="/privacy-policy" element={<ExternalRedirect to={`${publicSiteUrl}${location.pathname}${location.search}${location.hash}`} />} />
      <Route path="/terms-and-conditions" element={<ExternalRedirect to={`${publicSiteUrl}${location.pathname}${location.search}${location.hash}`} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function DashboardHome() {
  const location = useLocation()
  if (!location.search) {
    return <Navigate to={localStorage.getItem('rentivo_access_token') ? '/dashboard' : '/?signin=1'} replace />
  }
  return <HomePage authOnly />
}

function ProtectedDashboard() {
  return localStorage.getItem('rentivo_access_token')
    ? <DashboardPage />
    : <Navigate to="/?signin=1" replace />
}

export default function App() {
  const location = useLocation()

  useEffect(() => {
    document.title = getPageTitle(location.pathname, location.search)
  }, [location.pathname, location.search])

  if (isSplitHostDeployment) {
    return isDashboardHost ? <DashboardRoutes /> : <PublicRoutes />
  }

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/booking/:slug/my-bookings" element={<PublicCustomerBookingsPage />} />
      <Route path="/booking/:slug/vehicles/:vehicleId" element={<PublicVehiclePage />} />
      <Route path="/booking/:slug" element={<PublicBookingPage />} />
      <Route path="/contract/:token" element={<PublicContractPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/privacy-policy" element={<LegalPage type="privacy" />} />
      <Route path="/terms-and-conditions" element={<LegalPage type="terms" />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/rentivo-control" element={<SuperAdminPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/dashboard/*" element={<DashboardPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
