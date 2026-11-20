import wordmark from './assets/rentivo-wordmark.png'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'

export default function App() {
  const formRef = useRef<HTMLDivElement>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [verificationEmail, setVerificationEmail] = useState('')
  const [resent, setResent] = useState(false)
  const [verified, setVerified] = useState(false)

  useEffect(() => {
    setVerified(new URLSearchParams(window.location.search).get('verified') === '1')
  }, [])

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

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
      const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api'
      const response = await fetch(`${apiBaseUrl}/register`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      const data = await response.json()

      if (!response.ok) {
        const validationMessage = data.errors
          ? Object.values(data.errors).flat().join(' ')
          : data.message
        setError(String(validationMessage || 'We could not create your account. Please try again.'))
        return
      }

      setSuccess(`Your ${data.organization.name} workspace is ready.`)
      setVerificationEmail(payload.email)
      form.reset()
    } catch {
      setError('We could not connect to the registration service. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f6fb] text-[#17141f]">
      <header className="flex h-20 items-center justify-between border-b border-[#2c0f73]/10 bg-white px-6 sm:px-10">
        <img src={wordmark} alt="Rentivo" className="h-10 w-auto sm:h-12" />
        <button
          type="button"
          onClick={scrollToForm}
          className="rounded-lg bg-[#5b21b6] px-5 py-3 text-sm font-bold text-white shadow-[0_8px_20px_rgba(91,33,182,0.18)] transition hover:bg-[#4c1d95] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5b21b6]"
        >
          Get started
        </button>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-12 px-6 py-12 lg:grid-cols-[1fr_440px] lg:py-16">
        <div className="max-w-xl">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#5b21b6]">
            Free trial
          </p>
          <h1 className="mt-4 text-5xl font-semibold leading-[1.05] tracking-tight text-[#21142f] sm:text-6xl">
            Start Your Free Trial Today
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-[#686173]">
            Streamline your rental operations and explore the full platform with zero risk or setup hassle.
          </p>
        </div>

        <div
          ref={formRef}
          className="rounded-2xl border border-[#2c0f73]/10 bg-white p-6 shadow-[0_24px_60px_rgba(45,28,82,0.12)] sm:p-8"
        >
          {success || verified ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center text-center" role="status">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#ede9fe] text-2xl text-[#5b21b6]">
                ✓
              </div>
              <h2 className="mt-5 text-2xl font-semibold text-[#21142f]">
                {verified ? 'Email verified' : 'Verify your email'}
              </h2>
              {verified ? (
                <p className="mt-3 text-[#686173]">Your email address has been verified. You're ready to continue.</p>
              ) : (
                <p className="mt-3 text-[#686173]">
                  We sent a verification link to <strong className="font-semibold text-[#40384b]">{verificationEmail}</strong>.
                </p>
              )}
              {!verified && resent && (
                <p className="mt-3 text-sm font-medium text-[#5b21b6]" role="status">
                  Verification email resent.
                </p>
              )}
              {!verified && (
                <button
                  type="button"
                  onClick={async () => {
                    setError('')
                    setResent(false)
                    try {
                      const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api'
                      const response = await fetch(`${apiBaseUrl}/email/verification-notification`, {
                        method: 'POST',
                        headers: {
                          Accept: 'application/json',
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ email: verificationEmail }),
                      })
                      if (!response.ok) {
                        throw new Error('Unable to resend')
                      }
                      setResent(true)
                    } catch {
                      setError('We could not resend the verification email. Please try again.')
                    }
                  }}
                  className="mt-6 text-sm font-bold text-[#5b21b6] underline decoration-[#5b21b6]/30 underline-offset-4 hover:text-[#4c1d95]"
                >
                  Resend verification email
                </button>
              )}
              {error && (
                <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                  {error}
                </p>
              )}
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-semibold text-[#21142f]">Create your account</h2>
              <p className="mt-2 text-sm text-[#686173]">Start with all features included.</p>

              <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-[#40384b]">Company Name</span>
                  <input
                    name="company_name"
                    type="text"
                    required
                    autoComplete="organization"
                    placeholder="Acme Rentals"
                    className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3 outline-none transition placeholder:text-[#aaa4b4] focus:border-[#6d28d9] focus:ring-3 focus:ring-[#6d28d9]/10"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-[#40384b]">Full Name</span>
                  <input
                    name="full_name"
                    type="text"
                    required
                    autoComplete="name"
                    placeholder="Your full name"
                    className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3 outline-none transition placeholder:text-[#aaa4b4] focus:border-[#6d28d9] focus:ring-3 focus:ring-[#6d28d9]/10"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-[#40384b]">Email</span>
                  <input
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@company.com"
                    className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3 outline-none transition placeholder:text-[#aaa4b4] focus:border-[#6d28d9] focus:ring-3 focus:ring-[#6d28d9]/10"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-[#40384b]">Password</span>
                  <input
                    name="password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3 outline-none transition placeholder:text-[#aaa4b4] focus:border-[#6d28d9] focus:ring-3 focus:ring-[#6d28d9]/10"
                  />
                </label>

                {error && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="mt-2 w-full rounded-lg bg-[#5b21b6] px-5 py-3.5 font-bold text-white shadow-[0_10px_24px_rgba(91,33,182,0.18)] transition hover:bg-[#4c1d95] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? 'Creating your workspace...' : 'Start My Free Trial'}
                </button>
              </form>
            </>
          )}
        </div>
      </section>
    </main>
  )
}
