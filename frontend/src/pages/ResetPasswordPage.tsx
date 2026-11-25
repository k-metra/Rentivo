import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import PublicHeader from '../components/PublicHeader'

const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [email, setEmail] = useState(searchParams.get('email') ?? '')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [isComplete, setIsComplete] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const response = await fetch(`${apiBaseUrl}/reset-password`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          email,
          password,
          password_confirmation: passwordConfirmation,
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        const validationMessage = data.errors
          ? Object.values(data.errors).flat().join(' ')
          : data.message
        setError(String(validationMessage || 'We could not reset your password. Request a new reset link and try again.'))
        return
      }

      setIsComplete(true)
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
          {isComplete ? (
            <div className="text-center" role="status">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#ede9fe] text-2xl font-bold text-[#5b21b6]" aria-hidden="true">✓</div>
              <h1 className="mt-5 text-3xl font-semibold tracking-tight text-[#21142f]">Password updated</h1>
              <p className="mt-3 text-sm leading-6 text-[#686173]">Your password has been reset. Sign in with your new password to continue.</p>
              <Link to="/?signin=1" className="mt-7 inline-flex cursor-pointer items-center justify-center rounded-lg bg-[#5b21b6] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#4c1d95]">
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#5b21b6]">Account recovery</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#21142f]">Choose a new password</h1>
              {!token && (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-3 text-sm leading-6 text-amber-800" role="alert">
                  This reset link is incomplete. Request a new password reset link to continue.
                </p>
              )}
              <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-[#40384b]">Email</span>
                  <input
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3 outline-none transition focus:border-[#6d28d9] focus:ring-3 focus:ring-[#6d28d9]/10"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-[#40384b]">New password</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3 outline-none transition focus:border-[#6d28d9] focus:ring-3 focus:ring-[#6d28d9]/10"
                  />
                  <span className="mt-1 block text-xs text-[#8b8494]">Use at least 8 characters.</span>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-[#40384b]">Confirm new password</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    value={passwordConfirmation}
                    onChange={(event) => setPasswordConfirmation(event.target.value)}
                    className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3 outline-none transition focus:border-[#6d28d9] focus:ring-3 focus:ring-[#6d28d9]/10"
                  />
                </label>
                {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
                <button
                  type="submit"
                  disabled={isSubmitting || !token}
                  className="w-full cursor-pointer rounded-lg bg-[#5b21b6] px-5 py-3.5 font-bold text-white shadow-[0_10px_24px_rgba(91,33,182,0.18)] transition hover:bg-[#4c1d95] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? 'Updating password...' : 'Reset password'}
                </button>
              </form>
              <p className="mt-6 text-center text-sm text-[#686173]">
                Need a new link? <Link to="/forgot-password" className="cursor-pointer font-bold text-[#5b21b6] underline underline-offset-4">Request another</Link>
              </p>
            </>
          )}
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
