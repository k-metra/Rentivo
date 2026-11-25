import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import PublicHeader from '../components/PublicHeader'

const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setMessage('')
    setIsSubmitting(true)

    try {
      const response = await fetch(`${apiBaseUrl}/forgot-password`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await response.json()

      if (!response.ok) {
        const validationMessage = data.errors
          ? Object.values(data.errors).flat().join(' ')
          : data.message
        setError(String(validationMessage || 'We could not send a reset link. Please try again.'))
        return
      }

      setMessage(String(data.message || 'If an account exists for that email, a password reset link has been sent.'))
    } catch {
      setError('We could not connect to the password reset service. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#f7f6fb] text-[#17141f]">
      <PublicHeader />
      <section className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-md rounded-2xl border border-[#2c0f73]/10 bg-white p-8 shadow-[0_24px_60px_rgba(45,28,82,0.12)] sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#5b21b6]">Account recovery</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#21142f]">Forgot your password?</h1>
          <p className="mt-3 text-sm leading-6 text-[#686173]">
            Enter the email address associated with your account. If it’s registered, we’ll send you a link to reset your password.
          </p>

          <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#40384b]">Email</span>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
                className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3 outline-none transition placeholder:text-[#aaa4b4] focus:border-[#6d28d9] focus:ring-3 focus:ring-[#6d28d9]/10"
              />
            </label>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
            {message && <p className="rounded-lg bg-[#f3f0ff] px-3 py-3 text-sm leading-6 text-[#40384b]" role="status">{message}</p>}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full cursor-pointer rounded-lg bg-[#5b21b6] px-5 py-3.5 font-bold text-white shadow-[0_10px_24px_rgba(91,33,182,0.18)] transition hover:bg-[#4c1d95] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Sending link...' : 'Send password reset link'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[#686173]">
            Remembered it? <Link to="/?signin=1" className="cursor-pointer font-bold text-[#5b21b6] underline underline-offset-4">Back to sign in</Link>
          </p>
        </div>
      </section>
      <footer className="border-t border-[#2c0f73]/10 bg-[#21142f] px-6 py-6 text-center text-sm text-[#c4b5fd]">
        <Link to="/privacy-policy" className="cursor-pointer transition hover:text-white">Privacy Policy</Link>
        <span className="mx-3" aria-hidden="true">·</span>
        <Link to="/terms-and-conditions" className="cursor-pointer transition hover:text-white">Terms and Conditions</Link>
      </footer>
    </main>
  )
}
