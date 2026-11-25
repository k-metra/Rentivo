import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { citiesByProvince, provinces } from '../data/philippines'
import { optimizeImageForUpload } from '../utils/optimizeImageForUpload'

type RentalRate = { duration_hours: number; amount: number | string; outside_amount?: number | string }
type GalleryImage = { id: number; category: string; image_url: string }
const MAX_BOOKING_PDF_BYTES = 1800 * 1024
const MAX_BOOKING_ATTACHMENT_BYTES = 7 * 1024 * 1024

export type PublicVehicleProfile = {
  organization: { name: string; primary_color?: string; logo_url?: string | null }
  vehicle: {
    id: number
    name?: string | null
    brand: string
    model: string
    year: number
    color?: string | null
    seat_count?: number | null
    type?: string | null
    transmission?: string | null
    fuel_type?: string | null
    daily_rate: number | string
    security_deposit?: number | string | null
    hourly_extension_rate?: number | string | null
    image_url?: string | null
    marketing_image_url?: string | null
    images: GalleryImage[]
    rental_rates: RentalRate[]
  }
  requirements: string[]
  delivery_methods: string[]
  professional_driver_enabled: boolean
  reservation_fee: { amount: number; deductible: boolean; instructions?: string | null; qr_url?: string | null } | null
  currency: string
}

type Quote = {
  rental_amount: number
  daily_rate: number
  security_deposit: number
  breakdown: Array<{ label: string; amount: number }>
}

type BookedRange = { start: string; end: string }

const requirementLabels: Record<string, string> = {
  primary_id: 'Primary ID',
  secondary_id: 'Secondary ID',
  proof_of_billing: 'Proof of billing',
  ltms_screenshots: 'LTMS screenshots',
  selfie_with_primary_id: 'Selfie with primary ID',
}

const deliveryLabels: Record<string, string> = {
  renter_pickup_renter_return: 'Renter pickup & renter return',
  renter_pickup_owner_collection: 'Renter pickup & owner collection',
  owner_delivery_renter_return: 'Owner delivery & renter return',
  owner_delivery_owner_collection: 'Owner delivery & owner collection',
}

function optionLabel(value: string, labels: Record<string, string>) {
  return labels[value] ?? value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function dateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

function toLocalDateTime(date: Date, time: string) {
  return `${dateKey(date)}T${time}:00`
}

function price(value: number, currency: string) {
  return `${currency} ${value.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`
}

function isValidWebUrl(value: string) {
  if (!value) return true
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

export default function PublicBookingDrawer({
  apiBaseUrl,
  slug,
  data,
  onClose,
}: {
  apiBaseUrl: string
  slug: string
  data: PublicVehicleProfile
  onClose: () => void
}) {
  const prefersReducedMotion = useReducedMotion()
  const [step, setStep] = useState(1)
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [pickupDate, setPickupDate] = useState<Date | null>(null)
  const [returnDate, setReturnDate] = useState<Date | null>(null)
  const [pickupTime, setPickupTime] = useState('09:00')
  const [returnTime, setReturnTime] = useState('09:00')
  const [bookedRanges, setBookedRanges] = useState<BookedRange[]>([])
  const [calendarLoading, setCalendarLoading] = useState(true)
  const [calendarError, setCalendarError] = useState('')
  const [destinationProvince, setDestinationProvince] = useState('')
  const [destinationCity, setDestinationCity] = useState('')
  const [deliveryMethod, setDeliveryMethod] = useState(data.delivery_methods[0] ?? '')
  const [professionalDriver, setProfessionalDriver] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [facebookProfile, setFacebookProfile] = useState('')
  const [referralSource, setReferralSource] = useState('')
  const [remarks, setRemarks] = useState('')
  const [documents, setDocuments] = useState<Record<string, File | null>>({})
  const [paymentProof, setPaymentProof] = useState<File | null>(null)
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteError, setQuoteError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [reference, setReference] = useState('')
  const [confirmationMessage, setConfirmationMessage] = useState('')
  const primaryColor = data.organization.primary_color || '#5b21b6'
  const vehicleName = data.vehicle.name || `${data.vehicle.brand} ${data.vehicle.model} ${data.vehicle.year}`

  const pickupAt = pickupDate ? toLocalDateTime(pickupDate, pickupTime) : ''
  const returnAt = returnDate ? toLocalDateTime(returnDate, returnTime) : ''
  const requiredDocumentsProvided = data.requirements.every((key) => documents[key])
  const reservationFee = data.reservation_fee

  useEffect(() => {
    const controller = new AbortController()
    fetch(`${apiBaseUrl}/booking-form/${encodeURIComponent(slug)}/vehicles/${data.vehicle.id}/calendar`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.message || 'Unable to load vehicle availability.')
        setBookedRanges(result.booked_ranges as BookedRange[])
      })
      .catch((loadError) => {
        if (loadError instanceof Error && loadError.name === 'AbortError') return
        setCalendarError(loadError instanceof Error ? loadError.message : 'Unable to load vehicle availability.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setCalendarLoading(false)
      })

    return () => controller.abort()
  }, [apiBaseUrl, slug, data.vehicle.id])

  useEffect(() => {
    if (!pickupAt || !returnAt || !destinationProvince) {
      setQuote(null)
      setQuoteError('')
      setQuoteLoading(false)
      return
    }
    if (new Date(returnAt) <= new Date(pickupAt)) {
      setQuote(null)
      setQuoteError('Return time must be after pickup.')
      setQuoteLoading(false)
      return
    }

    const controller = new AbortController()
    setQuote(null)
    setQuoteLoading(true)
    setQuoteError('')
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({
        vehicle_id: String(data.vehicle.id),
        pickup_at: pickupAt,
        return_at: returnAt,
        destination_province: destinationProvince,
      })
      fetch(`${apiBaseUrl}/booking-form/${encodeURIComponent(slug)}/estimate?${params}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          const result = await response.json()
          if (!response.ok) {
            const details = result.errors ? Object.values(result.errors as Record<string, string[]>).flat().join(' ') : ''
            throw new Error(details || result.message || 'Unable to calculate this estimate.')
          }
          setQuote(result.estimate as Quote)
        })
        .catch((quoteLoadError) => {
          if (quoteLoadError instanceof Error && quoteLoadError.name === 'AbortError') return
          setQuote(null)
          setQuoteError(quoteLoadError instanceof Error ? quoteLoadError.message : 'Unable to calculate this estimate.')
        })
        .finally(() => {
          if (!controller.signal.aborted) setQuoteLoading(false)
        })
    }, 250)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [apiBaseUrl, data.vehicle.id, destinationProvince, pickupAt, returnAt, slug])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  const occupiedDateKeys = useMemo(() => {
    const dates = new Set<string>()
    bookedRanges.forEach(({ start, end }) => {
      const current = new Date(start)
      const last = new Date(end)
      current.setHours(0, 0, 0, 0)
      last.setHours(0, 0, 0, 0)
      while (current <= last) {
        dates.add(dateKey(current))
        current.setDate(current.getDate() + 1)
      }
    })
    return dates
  }, [bookedRanges])

  const dateUnavailable = (date: Date) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return date < today || occupiedDateKeys.has(dateKey(date))
  }

  const selectDate = (date: Date) => {
    if (dateUnavailable(date)) return
    setError('')
    if (!pickupDate || returnDate) {
      setPickupDate(date)
      setReturnDate(null)
      return
    }
    if (date < pickupDate) {
      setPickupDate(date)
      setReturnDate(null)
      return
    }
    const current = new Date(pickupDate)
    current.setDate(current.getDate() + 1)
    while (current < date) {
      if (dateUnavailable(current)) {
        setError('Your selected range includes a date when this vehicle is already booked.')
        return
      }
      current.setDate(current.getDate() + 1)
    }
    setReturnDate(date)
  }

  const calendarCells = () => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1)
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0)
    const cells = []
    for (let index = 0; index < first.getDay(); index += 1) cells.push(<span key={`blank-${index}`} />)
    for (let day = 1; day <= last.getDate(); day += 1) {
      const date = new Date(month.getFullYear(), month.getMonth(), day)
      const key = dateKey(date)
      const selectedStart = pickupDate && key === dateKey(pickupDate)
      const selectedEnd = returnDate && key === dateKey(returnDate)
      const inRange = pickupDate && returnDate && date > pickupDate && date < returnDate
      const unavailable = dateUnavailable(date)
      cells.push(
        <button
          type="button"
          key={key}
          disabled={unavailable || calendarLoading}
          onClick={() => selectDate(date)}
          aria-pressed={Boolean(selectedStart || selectedEnd)}
          aria-label={`${date.toLocaleDateString('en-PH', { dateStyle: 'full' })}${unavailable && occupiedDateKeys.has(key) ? ', booked' : ''}`}
          className={`rounded-lg py-2.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${selectedStart || selectedEnd ? 'text-white' : inRange ? 'bg-[#ede9fe] text-[#5b21b6]' : unavailable ? 'cursor-not-allowed bg-[#f4f2f6] text-[#b8b2c0] line-through' : 'cursor-pointer text-[#40384b] hover:bg-[#f7f3ff]'}`}
          style={selectedStart || selectedEnd ? { backgroundColor: primaryColor } : undefined}
        >
          {day}
        </button>,
      )
    }
    return cells
  }

  const canContinue = () => {
    if (step === 1) return Boolean(pickupDate && returnDate && destinationProvince && destinationCity && deliveryMethod && quote && !quoteLoading && !calendarError)
    if (step === 2) return Boolean(
      customerName.trim()
      && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)
      && customerPhone.trim()
      && customerAddress.trim()
      && referralSource.trim()
      && isValidWebUrl(facebookProfile),
    )
    if (step === 3) return requiredDocumentsProvided
    return privacyAcknowledged && (!reservationFee || Boolean(paymentProof))
  }

  const submitRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!pickupAt || !returnAt || !quote || !canContinue() || !data.delivery_methods.length) return
    setSubmitting(true)
    setError('')
    const formData = new FormData()
    formData.set('customer_name', customerName)
    formData.set('customer_email', customerEmail)
    formData.set('customer_phone', customerPhone)
    formData.set('customer_address', customerAddress)
    formData.set('customer_facebook_profile', facebookProfile)
    formData.set('referral_source', referralSource)
    formData.set('vehicle_id', String(data.vehicle.id))
    formData.set('pickup_at', pickupAt)
    formData.set('return_at', returnAt)
    formData.set('destination_province', destinationProvince)
    formData.set('destination_city', destinationCity)
    formData.set('delivery_method', deliveryMethod)
    formData.set('professional_driver', professionalDriver ? '1' : '0')
    formData.set('remarks', remarks)
    formData.set('privacy_acknowledged', '1')
    Object.entries(documents).forEach(([category, file]) => {
      if (file) formData.set(`documents[${category}]`, file)
    })
    if (paymentProof) formData.set('reservation_payment_proof', paymentProof)

    try {
      const uploadFormData = new FormData()
      let totalAttachmentBytes = 0
      for (const [field, value] of formData.entries()) {
        if (!(value instanceof File)) {
          uploadFormData.append(field, value)
          continue
        }

        const isPdf = value.type === 'application/pdf' || value.name.toLowerCase().endsWith('.pdf')
        const isImage = value.type.startsWith('image/') || /\.(jpe?g|png)$/i.test(value.name)
        if (isPdf && value.size > MAX_BOOKING_PDF_BYTES) {
          throw new Error(`"${value.name}" is too large. PDFs must be 1.8 MB or smaller; please compress it and try again.`)
        }

        const uploadFile = isImage ? await optimizeImageForUpload(value) : value
        totalAttachmentBytes += uploadFile.size
        if (totalAttachmentBytes > MAX_BOOKING_ATTACHMENT_BYTES) {
          throw new Error('Your attachments exceed the 7 MB upload limit. Reduce the size of your PDF files and try again.')
        }
        uploadFormData.append(field, uploadFile, uploadFile.name)
      }

      const response = await fetch(`${apiBaseUrl}/booking-form/${encodeURIComponent(slug)}/requests`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: uploadFormData,
      })
      const result = await response.json()
      if (!response.ok) {
        const details = result.errors ? Object.values(result.errors as Record<string, string[]>).flat().join(' ') : ''
        throw new Error(details || result.message || 'Unable to submit your booking request.')
      }
      setReference(result.reference as string)
      setConfirmationMessage(result.message as string)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit your booking request.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={prefersReducedMotion ? undefined : { opacity: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.18 }}
      className="fixed inset-0 z-[70] flex justify-end bg-[#17141f]/55"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <motion.aside
        initial={prefersReducedMotion ? false : { x: '100%' }}
        animate={{ x: 0 }}
        exit={prefersReducedMotion ? undefined : { x: '100%' }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.28, ease: 'easeOut' }}
        className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="public-booking-title"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-[#eeeaf3] px-5 py-4 sm:px-7">
          <div className="min-w-0">
            <p className="truncate text-xs font-bold uppercase tracking-widest text-[#8b8494]">{vehicleName}</p>
            <h2 id="public-booking-title" className="mt-1 text-lg font-bold text-[#21142f]">Booking request · Step {step} of 4</h2>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-2xl text-[#8b8494] hover:bg-[#f7f6fb]" aria-label="Close booking request">×</button>
        </header>

        {reference ? (
          <section className="flex flex-1 items-center justify-center px-6 py-10" role="status">
            <div className="max-w-md rounded-2xl border border-emerald-200 bg-emerald-50 p-7 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-xl font-bold text-emerald-700" aria-hidden="true">✓</div>
              <h3 className="mt-4 text-xl font-bold text-emerald-950">Request received</h3>
              <p className="mt-2 text-sm leading-6 text-emerald-900">{confirmationMessage}</p>
              <p className="mt-5 text-xs font-bold uppercase tracking-widest text-emerald-800">Request reference</p>
              <p className="mt-1 text-lg font-bold text-emerald-950">{reference}</p>
              <button type="button" onClick={onClose} className="mt-6 cursor-pointer rounded-lg px-5 py-3 text-sm font-bold text-white" style={{ backgroundColor: primaryColor }}>Close</button>
            </div>
          </section>
        ) : (
          <>
            <div className="shrink-0 border-b border-[#eeeaf3] px-5 py-3 sm:px-7">
              <ol className="grid grid-cols-4 gap-2 text-center text-[10px] font-bold uppercase tracking-wide sm:text-xs">
                {['Dates', 'Details', 'Documents', 'Payment'].map((label, index) => (
                  <li key={label} className={index + 1 === step ? 'text-[#5b21b6]' : index + 1 < step ? 'text-emerald-700' : 'text-[#aaa4b4]'}>{String(index + 1).padStart(2, '0')} · {label}</li>
                ))}
              </ol>
            </div>

            <form onSubmit={submitRequest} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
                {error && <p className="mb-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}

                {step === 1 && (
                  <section className="space-y-5">
                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <div><h3 className="font-bold">Choose pickup and return</h3><p className="mt-1 text-xs text-[#8b8494]">Booked dates are marked and cannot be selected.</p></div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button type="button" aria-label="Previous month" disabled={month.getFullYear() === new Date().getFullYear() && month.getMonth() === new Date().getMonth()} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="cursor-pointer rounded px-2 py-1 text-lg disabled:cursor-not-allowed disabled:opacity-30">‹</button>
                          <span className="min-w-28 text-center text-xs font-bold">{month.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}</span>
                          <button type="button" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="cursor-pointer rounded px-2 py-1 text-lg">›</button>
                        </div>
                      </div>
                      {calendarLoading && <p className="mt-3 text-sm text-[#686173]">Loading booked dates…</p>}
                      {calendarError && <p className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{calendarError}</p>}
                      {!calendarError && (
                        <div className="mt-4 grid grid-cols-7 gap-1.5">
                          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day} className="py-1 text-center text-[10px] font-bold uppercase text-[#aaa4b4]">{day}</span>)}
                          {calendarCells()}
                        </div>
                      )}
                      <div className="mt-3 flex flex-wrap gap-4 text-xs text-[#686173]"><span><i className="mr-1 inline-block h-3 w-3 rounded bg-[#f4f2f6] align-[-2px]" />Booked / unavailable</span><span><i className="mr-1 inline-block h-3 w-3 rounded bg-[#ede9fe] align-[-2px]" />Selected range</span></div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <label className="text-sm font-semibold">Pickup time<input type="time" value={pickupTime} onChange={(event) => setPickupTime(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#dcd8e6] px-3 py-2.5" /></label>
                        <label className="text-sm font-semibold">Return time<input type="time" value={returnTime} onChange={(event) => setReturnTime(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#dcd8e6] px-3 py-2.5" /></label>
                      </div>
                      {(!pickupDate || !returnDate) && <p className="mt-2 text-xs font-semibold text-amber-700">Select a pickup date and a return date.</p>}
                    </div>

                    <fieldset>
                      <legend className="mb-2 text-sm font-bold">Delivery and return</legend>
                      {data.delivery_methods.length ? <div className="grid gap-2 sm:grid-cols-2">
                        {data.delivery_methods.map((method) => <label key={method} className="flex cursor-pointer items-start gap-2 rounded-lg border border-[#e5e1ed] p-3 text-sm"><input type="radio" name="delivery_method" value={method} checked={deliveryMethod === method} onChange={() => setDeliveryMethod(method)} className="mt-0.5 accent-[#5b21b6]" /><span>{optionLabel(method, deliveryLabels)}</span></label>)}
                      </div> : <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">No delivery methods are enabled. Please contact the rental business before booking.</p>}
                    </fieldset>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-sm font-semibold">Destination province<select value={destinationProvince} onChange={(event) => { setDestinationProvince(event.target.value); setDestinationCity('') }} required className="mt-1.5 w-full rounded-lg border border-[#dcd8e6] bg-white px-3 py-2.5"><option value="">Select province</option>{provinces.map((province) => <option key={province}>{province}</option>)}</select></label>
                      <label className="text-sm font-semibold">Destination city<select value={destinationCity} onChange={(event) => setDestinationCity(event.target.value)} required disabled={!destinationProvince} className="mt-1.5 w-full rounded-lg border border-[#dcd8e6] bg-white px-3 py-2.5 disabled:cursor-not-allowed disabled:bg-[#f7f6fb]"><option value="">Select city</option>{(citiesByProvince[destinationProvince] ?? []).map((city) => <option key={city}>{city}</option>)}</select></label>
                    </div>

                    <div className="rounded-xl border border-[#e5e1ed] bg-[#faf9fc] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-bold">Price estimate</h3><span className="text-xs text-[#8b8494]">Final price may vary</span></div>
                      {!pickupDate || !returnDate || !destinationProvince
                        ? <p className="mt-3 text-sm text-[#686173]">Choose your dates and destination to see the estimate.</p>
                        : quoteLoading
                          ? <p className="mt-3 text-sm text-[#686173]" role="status">Calculating estimate…</p>
                          : quoteError
                            ? <p className="mt-3 text-sm text-red-700" role="alert">{quoteError}</p>
                            : quote && <div className="mt-3 space-y-2 text-sm">
                              <div className="flex justify-between gap-3 border-b border-[#e5e1ed] pb-2"><span className="font-semibold">Daily rate</span><strong>{price(quote.daily_rate, data.currency)}</strong></div>
                              {quote.breakdown.map((line, index) => <div key={`${line.label}-${index}`} className="flex justify-between gap-3 text-xs"><span className="text-[#686173]">{line.label}</span><strong>{price(line.amount, data.currency)}</strong></div>)}
                              <div className="flex justify-between gap-3 border-t border-[#e5e1ed] pt-2"><span className="font-bold">Estimated rental total</span><strong className="text-base" style={{ color: primaryColor }}>{price(quote.rental_amount, data.currency)}</strong></div>
                              {quote.security_deposit > 0 && <p className="text-xs text-[#686173]">Refundable security deposit, separate from rental total: {price(quote.security_deposit, data.currency)}</p>}
                            </div>}
                    </div>
                  </section>
                )}

                {step === 2 && (
                  <section className="space-y-4">
                    <div><h3 className="font-bold">Contact details</h3><p className="mt-1 text-xs text-[#8b8494]">The rental business will use these details to review your request.</p></div>
                    <label className="block text-sm font-semibold">Full name<input autoComplete="name" value={customerName} onChange={(event) => setCustomerName(event.target.value)} required maxLength={255} className="mt-1.5 w-full rounded-lg border border-[#dcd8e6] px-3 py-2.5" /></label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-sm font-semibold">Contact number<input type="tel" autoComplete="tel" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} required maxLength={255} className="mt-1.5 w-full rounded-lg border border-[#dcd8e6] px-3 py-2.5" /></label>
                      <label className="text-sm font-semibold">Email address<input type="email" autoComplete="email" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} required maxLength={255} className="mt-1.5 w-full rounded-lg border border-[#dcd8e6] px-3 py-2.5" /></label>
                    </div>
                    <label className="block text-sm font-semibold">Facebook profile link <span className="font-normal text-[#8b8494]">(optional)</span><input type="url" value={facebookProfile} onChange={(event) => setFacebookProfile(event.target.value)} maxLength={255} placeholder="https://facebook.com/…" className="mt-1.5 w-full rounded-lg border border-[#dcd8e6] px-3 py-2.5" /></label>
                    <label className="block text-sm font-semibold">Home address<textarea autoComplete="street-address" value={customerAddress} onChange={(event) => setCustomerAddress(event.target.value)} required maxLength={2000} rows={2} className="mt-1.5 w-full resize-y rounded-lg border border-[#dcd8e6] px-3 py-2.5" /></label>
                    <label className="block text-sm font-semibold">How did you find us?<input value={referralSource} onChange={(event) => setReferralSource(event.target.value)} required maxLength={255} placeholder="e.g. Facebook, a friend, or Google" className="mt-1.5 w-full rounded-lg border border-[#dcd8e6] px-3 py-2.5" /></label>
                    {data.professional_driver_enabled && <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-[#e5e1ed] p-3 text-sm"><input type="checkbox" checked={professionalDriver} onChange={(event) => setProfessionalDriver(event.target.checked)} className="mt-0.5 accent-[#5b21b6]" /><span>Request a professional driver. The rental team will confirm availability and any additional fee.</span></label>}
                    <label className="block text-sm font-semibold">Additional notes <span className="font-normal text-[#8b8494]">(optional)</span><textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} maxLength={5000} rows={3} className="mt-1.5 w-full resize-y rounded-lg border border-[#dcd8e6] px-3 py-2.5" /></label>
                  </section>
                )}

                {step === 3 && (
                  <section className="space-y-4">
                    <div><h3 className="font-bold">Required documents</h3><p className="mt-1 text-xs text-[#8b8494]">JPG and PNG images are optimized before upload. PDFs must be 1.8 MB or smaller; all attachments combined must be under 7 MB.</p></div>
                    {data.requirements.length ? data.requirements.map((requirement) => (
                      <label key={requirement} className="block text-sm font-semibold">{optionLabel(requirement, requirementLabels)}
                        <input type="file" accept=".jpg,.jpeg,.png,.pdf" required={!documents[requirement]} onChange={(event) => setDocuments((current) => ({ ...current, [requirement]: event.target.files?.[0] ?? null }))} className="mt-1.5 block w-full text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-[#ede9fe] file:px-3 file:py-2 file:text-xs file:font-bold file:text-[#5b21b6]" />
                        {documents[requirement] && <span className="mt-1 block text-xs text-emerald-700">{documents[requirement]?.name}</span>}
                      </label>
                    )) : <p className="rounded-lg border border-[#e5e1ed] bg-[#f7f6fb] p-4 text-sm text-[#686173]">No customer documents are required for this booking request.</p>}
                  </section>
                )}

                {step === 4 && (
                  <section className="space-y-5">
                    <div><h3 className="font-bold">Reservation fee and privacy notice</h3><p className="mt-1 text-xs text-[#8b8494]">Review the payment instructions and acknowledge the privacy notice before submitting.</p></div>
                    {quote && <div className="rounded-xl border border-[#e5e1ed] bg-[#faf9fc] p-4 text-sm">
                      <div className="flex justify-between gap-3"><span>Estimated rental total</span><strong>{price(quote.rental_amount, data.currency)}</strong></div>
                      {reservationFee && <div className="mt-2 flex justify-between gap-3"><span>Reservation fee due now</span><strong>{price(reservationFee.amount, data.currency)}</strong></div>}
                      {reservationFee && <div className="mt-2 flex justify-between gap-3 border-t border-[#e5e1ed] pt-2 font-bold"><span>{reservationFee.deductible ? 'Estimated rental balance after fee' : 'Estimated total including fee'}</span><strong>{price(reservationFee.deductible ? Math.max(0, quote.rental_amount - reservationFee.amount) : quote.rental_amount + reservationFee.amount, data.currency)}</strong></div>}
                    </div>}
                    {reservationFee ? (
                      <div className="space-y-4 rounded-xl border border-[#e5e1ed] bg-[#faf9fc] p-4">
                        <div>
                          <p className="text-sm font-bold">Reservation fee: {price(reservationFee.amount, data.currency)}</p>
                          <p className="mt-1 text-xs text-[#686173]">{reservationFee.deductible ? 'This fee is deductible from the total rental cost.' : 'This fee is added to the total rental cost.'}</p>
                        </div>
                        {reservationFee.instructions && <p className="whitespace-pre-wrap rounded-lg bg-white p-3 text-sm leading-6 text-[#40384b]">{reservationFee.instructions}</p>}
                        {reservationFee.qr_url && <img src={reservationFee.qr_url} alt="Payment QR code" className="h-52 w-52 rounded-lg border border-[#e5e1ed] bg-white object-contain p-2" />}
                        <label className="block text-sm font-semibold">Upload payment screenshot or proof
                          <input type="file" accept=".jpg,.jpeg,.png,.pdf" required={!paymentProof} onChange={(event) => setPaymentProof(event.target.files?.[0] ?? null)} className="mt-1.5 block w-full text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-[#ede9fe] file:px-3 file:py-2 file:text-xs file:font-bold file:text-[#5b21b6]" />
                          {paymentProof && <span className="mt-1 block text-xs text-emerald-700">{paymentProof.name}</span>}
                          <span className="mt-1 block text-xs font-normal text-[#8b8494]">Images are optimized automatically. PDFs must be 1.8 MB or smaller.</span>
                        </label>
                        <p className="text-xs leading-5 text-[#686173]">Your proof will be reviewed by the rental business. The reservation fee is not considered paid until staff verifies it.</p>
                      </div>
                    ) : (
                      <p className="rounded-xl border border-[#e5e1ed] bg-[#f7f6fb] p-4 text-sm text-[#40384b]">No reservation fee is required for this booking request.</p>
                    )}
                    <div className="rounded-xl border border-[#e5e1ed] p-4 text-sm leading-6 text-[#40384b]">
                      <p className="font-bold">Your privacy matters</p>
                      <p className="mt-1">The information and documents you provide may be used by the rental business for booking verification, identity validation, rental processing, fraud prevention, and other legitimate purposes related to your rental transaction.</p>
                      <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-bold text-[#5b21b6] underline">Privacy Notice</a>
                    </div>
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#e5e1ed] bg-[#faf9fc] p-4 text-sm leading-6 text-[#40384b]">
                      <input type="checkbox" checked={privacyAcknowledged} onChange={(event) => setPrivacyAcknowledged(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-[#5b21b6]" />
                      <span>I acknowledge that I have read and understood the Privacy Notice regarding the collection and processing of the personal information and documents I provide for this rental transaction.</span>
                    </label>
                  </section>
                )}
              </div>

              <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-[#eeeaf3] bg-white px-5 py-4 sm:px-7">
                <button type="button" onClick={() => step === 1 ? onClose() : setStep((current) => current - 1)} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-4 py-2.5 text-sm font-bold text-[#686173]">{step === 1 ? 'Cancel' : 'Back'}</button>
                {step < 4
                  ? <button type="button" disabled={!canContinue()} onClick={() => { setError(''); setStep((current) => current + 1) }} className="cursor-pointer rounded-lg px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50" style={{ backgroundColor: primaryColor }}>Continue</button>
                  : <button type="submit" disabled={submitting || !canContinue() || !quote || !data.delivery_methods.length} className="cursor-pointer rounded-lg px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50" style={{ backgroundColor: primaryColor }}>{submitting ? 'Submitting…' : 'Submit booking request'}</button>}
              </footer>
            </form>
          </>
        )}
      </motion.aside>
    </motion.div>
  )
}
