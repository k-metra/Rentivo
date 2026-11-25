import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

type CustomerBooking = {
  reference: string
  vehicle: string
  pickup_at: string | null
  return_at: string | null
  status: string
  payment_status: string
  total_amount: number | string
}

type CustomerRequest = {
  reference: string
  vehicle: string
  pickup_at: string | null
  return_at: string | null
  status: string
  decline_reason: string | null
}

type PortalData = {
  organization_name: string
  currency: string
  bookings: CustomerBooking[]
  requests: CustomerRequest[]
}

const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api'

function formatDate(value: string | null) {
  return value
    ? new Date(value).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Not available'
}

function formatAmount(value: number | string, currency: string) {
  return `${currency} ${Number(value).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`
}

function displayStatus(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export default function PublicCustomerBookingsPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const sessionStorageKey = slug ? `rentivo_customer_portal_${slug}` : ''
  const [email, setEmail] = useState('')
  const [magicToken, setMagicToken] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '')
  const [sessionToken, setSessionToken] = useState(() => sessionStorageKey ? localStorage.getItem(sessionStorageKey) ?? '' : '')
  const [portalData, setPortalData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(Boolean(sessionToken))
  const [sending, setSending] = useState(false)
  const [redeeming, setRedeeming] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!slug || !sessionToken || magicToken) {
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    fetch(`${apiBaseUrl}/booking-form/${encodeURIComponent(slug)}/customer-bookings`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${sessionToken}` },
    })
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) {
          if (response.status === 401) {
            localStorage.removeItem(sessionStorageKey)
            setSessionToken('')
            setPortalData(null)
            setError('Your sign-in session expired. Request a new link to continue.')
            return
          }
          throw new Error(result.message || 'Unable to load your bookings.')
        }
        if (active) setPortalData(result as PortalData)
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load your bookings.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [magicToken, sessionStorageKey, sessionToken, slug])

  const requestAccessLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!slug) return
    setSending(true)
    setError('')
    setMessage('')

    try {
      const response = await fetch(`${apiBaseUrl}/booking-form/${encodeURIComponent(slug)}/customer-access-links`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const result = await response.json()
      if (!response.ok) {
        const validationMessage = result.errors ? Object.values(result.errors).flat().join(' ') : result.message
        throw new Error(String(validationMessage || 'Unable to send a sign-in link.'))
      }
      setMessage(String(result.message || 'If we find bookings for that email, we will send a secure sign-in link.'))
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to send a sign-in link.')
    } finally {
      setSending(false)
    }
  }

  const redeemAccessLink = async () => {
    if (!slug || !magicToken) return
    setRedeeming(true)
    setError('')

    try {
      const response = await fetch(`${apiBaseUrl}/booking-form/${encodeURIComponent(slug)}/customer-sessions`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: magicToken }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'This sign-in link is invalid or expired. Request a new one.')
      localStorage.setItem(sessionStorageKey, String(result.token))
      setSessionToken(String(result.token))
      setMagicToken('')
      setMessage('')
      navigate(`/booking/${encodeURIComponent(slug)}/my-bookings`, { replace: true })
    } catch (redeemError) {
      setError(redeemError instanceof Error ? redeemError.message : 'Unable to sign in with this link.')
    } finally {
      setRedeeming(false)
    }
  }

  const requestAnotherLink = () => {
    if (!slug) return
    setMagicToken('')
    setError('')
    navigate(`/booking/${encodeURIComponent(slug)}/my-bookings`, { replace: true })
  }

  const signOut = async () => {
    if (!slug || !sessionToken) return
    setSigningOut(true)
    setError('')

    try {
      const response = await fetch(`${apiBaseUrl}/booking-form/${encodeURIComponent(slug)}/customer-sessions`, {
        method: 'DELETE',
        headers: { Accept: 'application/json', Authorization: `Bearer ${sessionToken}` },
      })
      if (!response.ok && response.status !== 401) throw new Error('The portal session could not be revoked.')
      localStorage.removeItem(sessionStorageKey)
      setSessionToken('')
      setPortalData(null)
      setMessage('You have been signed out.')
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : 'Unable to sign out securely.')
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f6fb] px-4 py-8 text-[#21142f] sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          {slug
            ? <Link to={`/booking/${encodeURIComponent(slug)}`} className="cursor-pointer text-sm font-bold text-[#5b21b6] hover:underline">← Back to booking website</Link>
            : <span />}
          {portalData && <button type="button" onClick={() => void signOut()} disabled={signingOut} className="cursor-pointer rounded-lg border border-[#dcd8e6] bg-white px-4 py-2 text-sm font-bold text-[#5b21b6] disabled:cursor-not-allowed disabled:opacity-60">{signingOut ? 'Signing out…' : 'Sign out'}</button>}
        </div>

        <section className="rounded-2xl border border-[#2c0f73]/10 bg-white p-6 shadow-[0_24px_60px_rgba(45,28,82,0.08)] sm:p-9">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#5b21b6]">Customer portal</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{portalData ? `Your bookings with ${portalData.organization_name}` : 'My bookings'}</h1>
          <p className="mt-3 text-sm leading-6 text-[#686173]">
            Sign in with a secure link sent to the email address used for your booking. No password is needed.
          </p>

          {error && <p className="mt-5 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}
          {message && <p className="mt-5 rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-sm leading-6 text-[#166534]" role="status">{message}</p>}

          {magicToken ? (
            <div className="mt-7 rounded-xl border border-[#e5e1ed] bg-[#fbfaff] p-5">
              <h2 className="text-lg font-bold">Continue to your bookings</h2>
              <p className="mt-2 text-sm leading-6 text-[#686173]">This secure link will be used once to sign you in. Your session will remain active on this device for 30 days.</p>
              <button type="button" onClick={() => void redeemAccessLink()} disabled={redeeming} className="mt-5 cursor-pointer rounded-lg bg-[#5b21b6] px-5 py-3 text-sm font-bold text-white hover:bg-[#4c1d95] disabled:cursor-not-allowed disabled:opacity-60">{redeeming ? 'Signing you in…' : 'Continue to my bookings'}</button>
              <button type="button" onClick={requestAnotherLink} className="ml-3 cursor-pointer rounded-lg px-4 py-3 text-sm font-bold text-[#5b21b6] hover:bg-[#ede9fe]">Request a new link</button>
            </div>
          ) : loading ? (
            <div className="mt-7 h-32 animate-pulse rounded-xl bg-[#f7f6fb]" role="status" aria-label="Loading bookings" />
          ) : portalData ? (
            <div className="mt-7 space-y-8">
              <section aria-labelledby="booking-history-heading">
                <h2 id="booking-history-heading" className="text-lg font-bold">Bookings</h2>
                {portalData.bookings.length ? (
                  <div className="mt-3 space-y-3">
                    {portalData.bookings.map((booking) => (
                      <article key={booking.reference} className="rounded-xl border border-[#e5e1ed] p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="font-bold">{booking.vehicle}</h3>
                            <p className="mt-1 text-xs text-[#8b8494]">Booking reference: {booking.reference}</p>
                          </div>
                          <span className="rounded-full bg-[#ede9fe] px-3 py-1 text-xs font-bold text-[#5b21b6]">{displayStatus(booking.status)}</span>
                        </div>
                        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                          <div><dt className="text-xs text-[#8b8494]">Pickup</dt><dd className="mt-1 font-semibold">{formatDate(booking.pickup_at)}</dd></div>
                          <div><dt className="text-xs text-[#8b8494]">Return</dt><dd className="mt-1 font-semibold">{formatDate(booking.return_at)}</dd></div>
                          <div><dt className="text-xs text-[#8b8494]">Payment</dt><dd className="mt-1 font-semibold">{displayStatus(booking.payment_status)}</dd></div>
                          <div><dt className="text-xs text-[#8b8494]">Booking total</dt><dd className="mt-1 font-semibold">{formatAmount(booking.total_amount, portalData.currency)}</dd></div>
                        </dl>
                      </article>
                    ))}
                  </div>
                ) : <p className="mt-3 rounded-xl bg-[#f7f6fb] p-4 text-sm text-[#686173]">No bookings to show yet.</p>}
              </section>

              {portalData.requests.length > 0 && (
                <section aria-labelledby="booking-requests-heading">
                  <h2 id="booking-requests-heading" className="text-lg font-bold">Booking requests</h2>
                  <div className="mt-3 space-y-3">
                    {portalData.requests.map((request) => (
                      <article key={request.reference} className="rounded-xl border border-[#e5e1ed] p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="font-bold">{request.vehicle}</h3>
                            <p className="mt-1 text-xs text-[#8b8494]">Request reference: {request.reference}</p>
                          </div>
                          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">{displayStatus(request.status)}</span>
                        </div>
                        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                          <div><dt className="text-xs text-[#8b8494]">Requested pickup</dt><dd className="mt-1 font-semibold">{formatDate(request.pickup_at)}</dd></div>
                          <div><dt className="text-xs text-[#8b8494]">Requested return</dt><dd className="mt-1 font-semibold">{formatDate(request.return_at)}</dd></div>
                        </dl>
                        {request.decline_reason && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">Update: {request.decline_reason}</p>}
                      </article>
                    ))}
                  </div>
                </section>
              )}
            </div>
          ) : (
            <form className="mt-7 space-y-5" onSubmit={(event) => void requestAccessLink(event)}>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold">Email address</span>
                <input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3 outline-none focus:border-[#6d28d9] focus:ring-3 focus:ring-[#6d28d9]/10" />
              </label>
              <button type="submit" disabled={sending || !slug} className="w-full cursor-pointer rounded-lg bg-[#5b21b6] px-5 py-3.5 font-bold text-white hover:bg-[#4c1d95] disabled:cursor-not-allowed disabled:opacity-60">{sending ? 'Sending sign-in link…' : 'Email me a sign-in link'}</button>
            </form>
          )}
        </section>
      </div>
    </main>
  )
}
