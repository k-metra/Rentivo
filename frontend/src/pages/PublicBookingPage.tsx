import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { citiesByProvince, provinces } from '../data/philippines'

type PublicData = {
  website_tier: 'basic' | 'full'
  organization: {
    name: string
    address?: string
    city?: string
    province?: string
    primary_color?: string
    logo_url?: string
    hero_title?: string
    hero_subtitle?: string
    banner_url?: string
  }
  fleet: PublicVehicle[]
  requirements: string[]
  delivery_methods: string[]
  professional_driver_enabled: boolean
  contact_number?: string
  reservation_fee: { amount: number; deductible: boolean; instructions?: string | null; qr_url?: string | null } | null
  currency: string
}

type PublicVehicle = {
  id: number
  name?: string
  brand: string
  model: string
  year?: number
  color?: string
  seat_count?: number
  type?: string
  transmission?: string
  fuel_type?: string
  image_url?: string
  marketing_image_url?: string
  estimated_rental_amount?: number | string
}

const requirementLabels: Record<string, string> = {
  primary_id: 'Primary ID',
  secondary_id: 'Secondary ID',
  proof_of_billing: 'Proof of billing',
  ltms_screenshots: 'LTMS screenshots',
  selfie_with_primary_id: 'Selfie with primary ID',
}

const deliveryLabels: Record<string, string> = {
  renter_pickup_renter_return: 'Renter pickup and renter return',
  renter_pickup_owner_collection: 'Renter pickup and owner collection',
  owner_delivery_renter_return: 'Owner delivery and renter return',
  owner_delivery_owner_collection: 'Owner delivery and owner collection',
}

function optionLabel(value: string, labels: Record<string, string>) {
  return labels[value] ?? value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function localDateTimeValue() {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

function matchesVehicleSearch(vehicle: PublicVehicle, query: string) {
  const search = query.trim().toLowerCase()
  if (!search) return true

  return [
    vehicle.name,
    vehicle.brand,
    vehicle.model,
    vehicle.year,
    vehicle.color,
    vehicle.seat_count,
    vehicle.type,
    vehicle.transmission,
    vehicle.fuel_type,
  ].some((value) => String(value ?? '').toLowerCase().includes(search))
}

export default function PublicBookingPage() {
  const { slug } = useParams()
  const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api'
  const [data, setData] = useState<PublicData | null>(null)
  const [vehicles, setVehicles] = useState<PublicVehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [availabilityLoading, setAvailabilityLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [availabilityError, setAvailabilityError] = useState('')
  const [reference, setReference] = useState('')
  const [pickupAt, setPickupAt] = useState('')
  const [returnAt, setReturnAt] = useState('')
  const [destinationProvince, setDestinationProvince] = useState('')
  const [destinationCity, setDestinationCity] = useState('')
  const [fleetSearch, setFleetSearch] = useState('')
  const [availableVehicleSearch, setAvailableVehicleSearch] = useState('')
  const [preferredVehicleId, setPreferredVehicleId] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [facebookProfile, setFacebookProfile] = useState('')
  const [referralSource, setReferralSource] = useState('')
  const [deliveryMethod, setDeliveryMethod] = useState('')
  const [professionalDriver, setProfessionalDriver] = useState(false)
  const [remarks, setRemarks] = useState('')
  const [documents, setDocuments] = useState<Record<string, File | null>>({})
  const [paymentProof, setPaymentProof] = useState<File | null>(null)
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false)
  const [confirmationMessage, setConfirmationMessage] = useState('')
  const primaryColor = data?.organization.primary_color || '#5b21b6'
  const selectedVehicle = vehicles.find((vehicle) => String(vehicle.id) === vehicleId)
  const preferredVehicle = data?.fleet.find((vehicle) => String(vehicle.id) === preferredVehicleId)
    ?? vehicles.find((vehicle) => String(vehicle.id) === preferredVehicleId)
  const preferredVehicleName = preferredVehicle?.name || (preferredVehicle ? `${preferredVehicle.brand} ${preferredVehicle.model}` : 'Selected vehicle')
  const filteredFleet = (data?.fleet ?? []).filter((vehicle) => matchesVehicleSearch(vehicle, fleetSearch))
  const filteredAvailableVehicles = vehicles.filter((vehicle) => matchesVehicleSearch(vehicle, availableVehicleSearch))
  const fullWebsite = data?.website_tier === 'full'
  const reservationFeeExceedsRental = Boolean(
    data?.reservation_fee?.deductible
    && selectedVehicle
    && Number(data.reservation_fee.amount) > Number(selectedVehicle.estimated_rental_amount),
  )

  const chooseVehicle = (id: number) => {
    const selectedId = String(id)
    setPreferredVehicleId(selectedId)
    setVehicleId(vehicles.some((vehicle) => String(vehicle.id) === selectedId) ? selectedId : '')
    setAvailableVehicleSearch('')
  }

  useEffect(() => {
    if (!slug) {
      setError('This online booking form is unavailable.')
      setLoading(false)
      return
    }

    const controller = new AbortController()
    fetch(`${apiBaseUrl}/booking-form/${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.message || 'Online booking form unavailable')
        setData(result as PublicData)
      })
      .catch((loadError) => {
        if (loadError instanceof Error && loadError.name === 'AbortError') return
        setError(loadError instanceof Error ? loadError.message : 'Online booking form unavailable')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [apiBaseUrl, slug])

  useEffect(() => {
    if (!slug || !data || !pickupAt || !returnAt) {
      setVehicles([])
      setVehicleId('')
      setAvailabilityError('')
      return
    }

    if (new Date(returnAt).getTime() <= new Date(pickupAt).getTime()) {
      setVehicles([])
      setVehicleId('')
      setAvailabilityError('Choose a return time after pickup.')
      return
    }

    const controller = new AbortController()
    const params = new URLSearchParams({ pickup_at: pickupAt, return_at: returnAt })
    if (destinationProvince) params.set('destination_province', destinationProvince)
    setAvailabilityLoading(true)
    setAvailabilityError('')
    fetch(`${apiBaseUrl}/booking-form/${encodeURIComponent(slug)}/availability?${params}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.message || 'Unable to check vehicle availability.')
        const availableVehicles = (result.vehicles ?? []) as PublicVehicle[]
        setVehicles(availableVehicles)
        setVehicleId((current) => {
          if (availableVehicles.some((vehicle) => String(vehicle.id) === preferredVehicleId)) {
            return preferredVehicleId
          }
          return availableVehicles.some((vehicle) => String(vehicle.id) === current) ? current : ''
        })
      })
      .catch((loadError) => {
        if (loadError instanceof Error && loadError.name === 'AbortError') return
        setVehicles([])
        setVehicleId('')
        setAvailabilityError(loadError instanceof Error ? loadError.message : 'Unable to check vehicle availability.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setAvailabilityLoading(false)
      })

    return () => controller.abort()
  }, [apiBaseUrl, data, destinationProvince, pickupAt, preferredVehicleId, returnAt, slug])

  const submitRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!slug || !data || !selectedVehicle) return
    setSubmitting(true)
    setError('')

    const formData = new FormData()
    formData.set('customer_name', customerName)
    formData.set('customer_email', customerEmail)
    formData.set('customer_phone', customerPhone)
    formData.set('customer_address', customerAddress)
    formData.set('customer_facebook_profile', facebookProfile)
    formData.set('referral_source', referralSource)
    formData.set('vehicle_id', String(selectedVehicle.id))
    formData.set('pickup_at', pickupAt)
    formData.set('return_at', returnAt)
    formData.set('destination_province', destinationProvince)
    formData.set('destination_city', destinationCity)
    formData.set('delivery_method', deliveryMethod)
    formData.set('professional_driver', professionalDriver ? '1' : '0')
    formData.set('remarks', remarks)
    formData.set('privacy_acknowledged', privacyAcknowledged ? '1' : '0')
    Object.entries(documents).forEach(([category, file]) => {
      if (file) formData.set(`documents[${category}]`, file)
    })
    if (paymentProof) formData.set('reservation_payment_proof', paymentProof)

    try {
      const response = await fetch(`${apiBaseUrl}/booking-form/${encodeURIComponent(slug)}/requests`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: formData,
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to submit your booking request.')
      setReference(result.reference as string)
      setConfirmationMessage(result.message as string)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit your booking request.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f7f6fb]"><div className="h-10 w-10 animate-spin rounded-full border-4 border-[#ede9fe] border-t-[#5b21b6]" role="status" aria-label="Loading booking form" /></main>
  }

  if (error && !data) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f7f6fb] px-6"><div className="max-w-md rounded-xl border border-red-100 bg-red-50 p-6 text-center text-sm text-red-700" role="alert">{error}</div></main>
  }

  if (!data) return null

  return (
    <main className={`min-h-screen ${fullWebsite ? 'bg-white text-[#21142f]' : 'bg-[#f7f6fb] px-4 py-8 sm:px-6 sm:py-12'}`}>
      {fullWebsite && (
        <>
          <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8" aria-label="Main navigation">
            <a href="#" className="flex min-w-0 items-center gap-3" aria-label={`${data.organization.name} home`}>
              {data.organization.logo_url
                ? <img src={data.organization.logo_url} alt="" className="h-11 w-11 rounded-lg object-contain" />
                : <span className="flex h-11 w-11 items-center justify-center rounded-lg text-lg font-bold text-white" style={{ backgroundColor: primaryColor }} aria-hidden="true">{data.organization.name.slice(0, 1).toUpperCase()}</span>}
              <span className="truncate text-base font-bold">{data.organization.name}</span>
            </a>
            <div className="hidden items-center gap-7 text-sm font-semibold text-[#686173] md:flex">
              <a className="hover:text-[#21142f]" href="#fleet">Our fleet</a>
              <a className="hover:text-[#21142f]" href="#how-it-works">How it works</a>
              {data.contact_number && <a className="hover:text-[#21142f]" href={`tel:${data.contact_number}`}>Contact</a>}
            </div>
            <Link to={`/booking/${encodeURIComponent(slug ?? '')}/my-bookings`} className="cursor-pointer rounded-lg px-3 py-2 text-sm font-bold text-[#5b21b6] hover:bg-[#f7f6fb]">My bookings</Link>
            <a href="#fleet" className="cursor-pointer rounded-lg px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90" style={{ backgroundColor: primaryColor }}>Book a vehicle</a>
          </nav>

          <section
            className="relative isolate flex min-h-[440px] items-center overflow-hidden bg-[#21142f] bg-cover bg-center sm:min-h-[520px]"
            style={{
              backgroundImage: data.organization.banner_url
                ? `linear-gradient(90deg, rgba(20, 15, 35, .9) 0%, rgba(20, 15, 35, .58) 58%, rgba(20, 15, 35, .28) 100%), url("${data.organization.banner_url}")`
                : `linear-gradient(120deg, ${primaryColor}, #21142f)`,
            }}
          >
            <div className="mx-auto w-full max-w-7xl px-6 py-20 sm:px-10 lg:px-14">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/75">A better way to get there</p>
              <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-tight tracking-tight text-white sm:text-6xl">
                {data.organization.hero_title || 'Find the right ride for your next journey.'}
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/85 sm:text-lg">
                {data.organization.hero_subtitle || 'Explore our fleet, choose your dates, and send a booking request in minutes.'}
              </p>
              <a href="#fleet" className="mt-8 inline-flex cursor-pointer items-center justify-center rounded-lg bg-white px-6 py-3.5 text-sm font-bold text-[#21142f] transition hover:bg-white/90">Explore vehicles</a>
            </div>
          </section>

          <section id="fleet" className="mx-auto max-w-7xl scroll-mt-8 px-6 py-16 sm:px-10 sm:py-20">
            <div className="flex flex-wrap items-end justify-between gap-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: primaryColor }}>Choose your ride</p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Our fleet</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#686173]">Browse our vehicles and check availability for your travel dates.</p>
              </div>
              <a href="#fleet" className="cursor-pointer text-sm font-bold hover:underline" style={{ color: primaryColor }}>Choose a vehicle</a>
            </div>
            {data.fleet.length > 0 && (
              <label className="mt-7 block max-w-lg text-sm font-semibold text-[#40384b]">
                Search vehicles
                <input
                  type="search"
                  value={fleetSearch}
                  onChange={(event) => setFleetSearch(event.target.value)}
                  placeholder="Search by make, model, type, or seats"
                  className="mt-2 w-full rounded-lg border border-[#dcd8e6] bg-white px-4 py-3 outline-none focus:border-[#6d28d9]"
                />
              </label>
            )}
            {data.fleet.length > 0 ? (
              filteredFleet.length > 0 ? (
                <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredFleet.map((vehicle) => (
                    <article
                      key={vehicle.id}
                      className="overflow-hidden rounded-2xl border border-[#e5e1ed] bg-white shadow-[0_8px_24px_rgba(45,28,82,0.05)]"
                      style={{ borderColor: preferredVehicleId === String(vehicle.id) ? primaryColor : undefined }}
                    >
                    {vehicle.marketing_image_url
                      ? <img src={vehicle.marketing_image_url} alt="" className="h-52 w-full bg-[#f7f6fb] object-cover" />
                      : <div className="flex h-52 items-center justify-center bg-[#f7f6fb] text-sm font-semibold text-[#8b8494]">Vehicle photo coming soon</div>}
                    <div className="p-5">
                      <h3 className="text-lg font-bold">{vehicle.name || `${vehicle.brand} ${vehicle.model}`}</h3>
                      <p className="mt-1 text-sm text-[#686173]">{[vehicle.year, vehicle.type, vehicle.seat_count ? `${vehicle.seat_count} seats` : null, vehicle.transmission].filter(Boolean).join(' · ') || 'Rental vehicle'}</p>
                      <p className="mt-4 text-sm font-semibold" style={{ color: primaryColor }}>Check dates for a rental estimate</p>
                      <Link
                        to={`/booking/${encodeURIComponent(slug ?? '')}/vehicles/${vehicle.id}`}
                        className="mt-4 inline-flex cursor-pointer rounded-lg px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
                        style={{ backgroundColor: primaryColor }}
                      >
                        View vehicle
                      </Link>
                    </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="mt-8 rounded-xl border border-dashed border-[#dcd8e6] bg-[#f7f6fb] px-5 py-8 text-center text-sm text-[#686173]">
                  No vehicles match “{fleetSearch}”. Try another make, model, or vehicle type.
                </p>
              )
            ) : (
              <div className="mt-8 rounded-2xl border border-dashed border-[#dcd8e6] bg-[#f7f6fb] px-6 py-10 text-center">
                <h3 className="font-bold">Our fleet is being updated</h3>
                <p className="mt-2 text-sm text-[#686173]">Please check back soon for available vehicles.</p>
              </div>
            )}
          </section>

          <section id="how-it-works" className="scroll-mt-8 bg-[#f7f6fb] px-6 py-16 sm:px-10 sm:py-20">
            <div className="mx-auto max-w-7xl">
              <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: primaryColor }}>Simple online booking</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Plan your rental in four steps</h2>
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ['01', 'Choose a vehicle and dates', 'Review the vehicle profile and see which dates are available.'],
                  ['02', 'Add your details', 'Share your contact information and delivery preference.'],
                  ['03', 'Upload requirements', 'Attach the documents requested by the rental business.'],
                  ['04', 'Review and submit', 'Review any reservation-fee instructions and acknowledge the privacy notice.'],
                ].map(([number, title, description]) => (
                  <article key={number} className="rounded-2xl border border-[#e5e1ed] bg-white p-6">
                    <p className="text-sm font-bold" style={{ color: primaryColor }}>{number}</p>
                    <h3 className="mt-3 font-bold">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#686173]">{description}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </>
      )}

      {!fullWebsite && <motion.div
        id="booking-form"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className={fullWebsite
          ? 'mx-auto max-w-5xl scroll-mt-8 px-4 py-14 sm:px-6 sm:py-20'
          : 'mx-auto max-w-4xl overflow-hidden rounded-2xl border border-[#2c0f73]/10 bg-white shadow-[0_24px_60px_rgba(45,28,82,0.12)]'}
      >
        {!fullWebsite && (
          <header className="p-6 sm:p-9" style={{ borderTop: `5px solid ${primaryColor}` }}>
            <div className="flex items-center gap-4">
              {data.organization.logo_url
                ? <img src={data.organization.logo_url} alt={`${data.organization.name} logo`} className="h-16 w-16 rounded-xl object-contain" />
                : <div className="flex h-16 w-16 items-center justify-center rounded-xl text-xl font-bold text-white" style={{ backgroundColor: primaryColor }}>{data.organization.name.slice(0, 1).toUpperCase()}</div>}
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: primaryColor }}>Online booking</p>
                <h1 className="mt-1 text-2xl font-bold text-[#21142f]">{data.organization.name}</h1>
                {(data.contact_number || data.organization.address) && (
                  <p className="mt-1 text-sm text-[#686173]">
                    {[data.contact_number, data.organization.address, data.organization.city, data.organization.province].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
            </div>
            <Link to={`/booking/${encodeURIComponent(slug ?? '')}/my-bookings`} className="mt-4 inline-flex cursor-pointer rounded-lg border border-[#dcd8e6] px-4 py-2.5 text-sm font-bold text-[#5b21b6] hover:bg-[#f7f6fb]">My bookings</Link>
            <p className="mt-6 max-w-2xl text-sm leading-6 text-[#686173]">
              Choose your rental dates and vehicle, then send a request to the rental team. Your booking is not confirmed until the company approves it. If a reservation fee is configured, follow the payment instructions and upload proof.
            </p>
          </header>
        )}

        {reference ? (
          <section className="border-t border-[#eeeaf3] px-6 py-10 sm:px-9" role="status">
            <div className="mx-auto max-w-xl rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center sm:p-8">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-xl font-bold text-emerald-700" aria-hidden="true">✓</div>
              <h2 className="mt-4 text-xl font-bold text-emerald-950">Request received</h2>
              <p className="mt-2 text-sm leading-6 text-emerald-900">{confirmationMessage}</p>
              <p className="mt-5 text-xs font-bold uppercase tracking-widest text-emerald-800">Request reference</p>
              <p className="mt-1 text-lg font-bold text-emerald-950">{reference}</p>
              {data.contact_number && <p className="mt-4 text-sm text-emerald-900">Questions? Contact {data.contact_number}.</p>}
            </div>
          </section>
        ) : (
          <form onSubmit={submitRequest} className={`space-y-8 ${fullWebsite ? 'rounded-2xl border border-[#e5e1ed] bg-white px-6 py-7 shadow-[0_12px_36px_rgba(45,28,82,0.07)] sm:px-9 sm:py-9' : 'border-t border-[#eeeaf3] px-6 py-7 sm:px-9 sm:py-9'}`}>
            {fullWebsite && (
              <div>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: primaryColor }}>Start your request</p>
                <h2 className="mt-1 text-2xl font-bold text-[#21142f]">Check availability and book</h2>
                <p className="mt-2 text-sm leading-6 text-[#686173]">Choose your dates and vehicle, then send your request. The rental team will confirm the booking details with you. No payment is collected at this stage.</p>
              </div>
            )}
            {error && <p className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}

            <section aria-labelledby="dates-heading">
              <div className="mb-4">
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: primaryColor }}>Step 1</p>
                <h2 id="dates-heading" className="mt-1 text-lg font-bold text-[#21142f]">Rental dates and destination</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold text-[#40384b]">
                  Pickup date and time
                  <input type="datetime-local" value={pickupAt} onChange={(event) => setPickupAt(event.target.value)} required min={localDateTimeValue()} className="mt-2 w-full rounded-lg border border-[#dcd8e6] px-3 py-3 outline-none focus:border-[#6d28d9]" />
                </label>
                <label className="text-sm font-semibold text-[#40384b]">
                  Return date and time
                  <input type="datetime-local" value={returnAt} onChange={(event) => setReturnAt(event.target.value)} required min={pickupAt || localDateTimeValue()} className="mt-2 w-full rounded-lg border border-[#dcd8e6] px-3 py-3 outline-none focus:border-[#6d28d9]" />
                </label>
                <label className="text-sm font-semibold text-[#40384b]">
                  Destination province
                  <select value={destinationProvince} onChange={(event) => { setDestinationProvince(event.target.value); setDestinationCity('') }} required className="mt-2 w-full rounded-lg border border-[#dcd8e6] bg-white px-3 py-3 outline-none focus:border-[#6d28d9]">
                    <option value="">Select province</option>
                    {provinces.map((province) => <option key={province} value={province}>{province}</option>)}
                  </select>
                </label>
                <label className="text-sm font-semibold text-[#40384b]">
                  Destination city
                  <select value={destinationCity} onChange={(event) => setDestinationCity(event.target.value)} required disabled={!destinationProvince} className="mt-2 w-full rounded-lg border border-[#dcd8e6] bg-white px-3 py-3 outline-none focus:border-[#6d28d9] disabled:cursor-not-allowed disabled:bg-[#f7f6fb]">
                    <option value="">Select city</option>
                    {(citiesByProvince[destinationProvince] ?? []).map((city) => <option key={city} value={city}>{city}</option>)}
                  </select>
                </label>
              </div>

              <div className="mt-6" aria-live="polite">
                {availabilityLoading && <p className="text-sm text-[#686173]">Checking vehicles for those dates…</p>}
                {availabilityError && <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">{availabilityError}</p>}
                {preferredVehicleId && (!pickupAt || !returnAt) && (
                  <p className="mb-3 rounded-lg border border-[#e5e1ed] bg-[#f7f6fb] px-4 py-3 text-sm text-[#40384b]" role="status">
                    {preferredVehicleName} selected. Choose your rental dates to check availability.
                  </p>
                )}
                {preferredVehicleId && pickupAt && returnAt && !availabilityLoading && !availabilityError && !vehicles.some((vehicle) => String(vehicle.id) === preferredVehicleId) && (
                  <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
                    {preferredVehicleName} is unavailable for those dates. Choose a different date range or select another vehicle below.
                  </p>
                )}
                {!availabilityLoading && !availabilityError && pickupAt && returnAt && vehicles.length === 0 && !preferredVehicleId && (
                  <p className="rounded-lg border border-[#e5e1ed] bg-[#f7f6fb] px-4 py-3 text-sm text-[#686173]">No vehicles are available for this date range. Try different dates or contact the rental team.</p>
                )}
                {vehicles.length > 0 && (
                  <fieldset>
                    <legend className="mb-3 text-sm font-bold text-[#40384b]">Available vehicles</legend>
                    {selectedVehicle && (
                      <p className="mb-4 rounded-lg border border-[#ddd6fe] bg-[#f5f3ff] px-4 py-3 text-sm text-[#40384b]" role="status">
                        Selected for your request: <strong>{selectedVehicle.name || `${selectedVehicle.brand} ${selectedVehicle.model}`}</strong>
                      </p>
                    )}
                    <label className="mb-4 block max-w-lg text-sm font-semibold text-[#40384b]">
                      Search available vehicles
                      <input
                        type="search"
                        value={availableVehicleSearch}
                        onChange={(event) => setAvailableVehicleSearch(event.target.value)}
                        placeholder="Search by make, model, type, or seats"
                        className="mt-2 w-full rounded-lg border border-[#dcd8e6] px-4 py-3 outline-none focus:border-[#6d28d9]"
                      />
                    </label>
                    <div className="grid gap-3 md:grid-cols-2">
                      {filteredAvailableVehicles.map((vehicle) => {
                        const selected = vehicleId === String(vehicle.id)
                        return (
                          <button
                            type="button"
                            key={vehicle.id}
                            aria-pressed={selected}
                            onClick={() => chooseVehicle(vehicle.id)}
                            className={`flex w-full cursor-pointer gap-4 rounded-xl border p-4 text-left transition hover:border-[#a78bfa] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${selected ? 'bg-[#f7f3ff]' : 'border-[#e5e1ed] bg-white'}`}
                            style={{ borderColor: selected ? primaryColor : undefined }}
                          >
                            {vehicle.marketing_image_url
                              ? <img src={vehicle.marketing_image_url} alt="" className="h-20 w-24 shrink-0 rounded-lg bg-[#f7f6fb] object-cover" />
                              : <div className="flex h-20 w-24 shrink-0 items-center justify-center rounded-lg bg-[#f7f6fb] text-xs font-semibold text-[#8b8494]">Vehicle</div>}
                            <span className="min-w-0 flex-1">
                              <span className="block font-bold text-[#21142f]">{vehicle.name || `${vehicle.brand} ${vehicle.model}`}</span>
                              <span className="mt-1 block text-xs text-[#686173]">{[vehicle.year, vehicle.type, vehicle.seat_count ? `${vehicle.seat_count} seats` : null, vehicle.transmission].filter(Boolean).join(' · ')}</span>
                              <span className="mt-2 block text-sm font-bold" style={{ color: primaryColor }}>{data.currency} {Number(vehicle.estimated_rental_amount).toLocaleString('en-PH', { maximumFractionDigits: 2 })} estimated</span>
                            </span>
                          </button>
                        )
                      })}
                    </div>
                    {filteredAvailableVehicles.length === 0 && (
                      <p className="rounded-lg border border-dashed border-[#dcd8e6] px-4 py-5 text-sm text-[#686173]">No available vehicles match that search. Try another search.</p>
                    )}
                    <p className="mt-2 text-xs text-[#8b8494]">Final pricing and availability will be confirmed by the rental team.</p>
                  </fieldset>
                )}
              </div>
            </section>

            <section aria-labelledby="contact-heading" className="border-t border-[#eeeaf3] pt-7">
              <div className="mb-4">
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: primaryColor }}>Step 2</p>
                <h2 id="contact-heading" className="mt-1 text-lg font-bold text-[#21142f]">Your details and preferences</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold text-[#40384b] sm:col-span-2">
                  Full name
                  <input autoComplete="name" value={customerName} onChange={(event) => setCustomerName(event.target.value)} required maxLength={255} className="mt-2 w-full rounded-lg border border-[#dcd8e6] px-3 py-3 outline-none focus:border-[#6d28d9]" />
                </label>
                <label className="text-sm font-semibold text-[#40384b]">
                  Email
                  <input type="email" autoComplete="email" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} required maxLength={255} className="mt-2 w-full rounded-lg border border-[#dcd8e6] px-3 py-3 outline-none focus:border-[#6d28d9]" />
                </label>
                <label className="text-sm font-semibold text-[#40384b]">
                  Contact number
                  <input type="tel" autoComplete="tel" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} required maxLength={255} className="mt-2 w-full rounded-lg border border-[#dcd8e6] px-3 py-3 outline-none focus:border-[#6d28d9]" />
                </label>
                <label className="text-sm font-semibold text-[#40384b]">
                  Facebook profile link <span className="font-normal text-[#8b8494]">(optional)</span>
                  <input type="url" value={facebookProfile} onChange={(event) => setFacebookProfile(event.target.value)} maxLength={255} placeholder="https://facebook.com/…" className="mt-2 w-full rounded-lg border border-[#dcd8e6] px-3 py-3 outline-none focus:border-[#6d28d9]" />
                </label>
                <label className="text-sm font-semibold text-[#40384b] sm:col-span-2">
                  Home address
                  <textarea autoComplete="street-address" value={customerAddress} onChange={(event) => setCustomerAddress(event.target.value)} required maxLength={2000} rows={2} className="mt-2 w-full resize-y rounded-lg border border-[#dcd8e6] px-3 py-3 outline-none focus:border-[#6d28d9]" />
                </label>
                <label className="text-sm font-semibold text-[#40384b] sm:col-span-2">
                  How did you find us?
                  <input value={referralSource} onChange={(event) => setReferralSource(event.target.value)} required maxLength={255} placeholder="e.g. Facebook, a friend, or Google" className="mt-2 w-full rounded-lg border border-[#dcd8e6] px-3 py-3 outline-none focus:border-[#6d28d9]" />
                </label>
                <fieldset className="sm:col-span-2">
                  <legend className="text-sm font-semibold text-[#40384b]">Delivery and collection</legend>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {data.delivery_methods.map((method) => (
                      <label key={method} className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#e5e1ed] p-3 text-sm text-[#40384b]">
                        <input type="radio" name="delivery_method" value={method} checked={deliveryMethod === method} onChange={() => setDeliveryMethod(method)} required className="mt-0.5 accent-[#5b21b6]" />
                        <span>{optionLabel(method, deliveryLabels)}</span>
                      </label>
                    ))}
                  </div>
                  {data.delivery_methods.length === 0 && <p className="mt-2 text-sm text-amber-800">Contact the rental team to arrange pickup and return.</p>}
                </fieldset>
                {data.professional_driver_enabled && (
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#e5e1ed] p-3 text-sm text-[#40384b] sm:col-span-2">
                    <input type="checkbox" checked={professionalDriver} onChange={(event) => setProfessionalDriver(event.target.checked)} className="mt-0.5 accent-[#5b21b6]" />
                    <span><span className="block font-semibold">Request a professional driver</span><span className="mt-1 block text-xs text-[#8b8494]">The rental team will confirm availability and any additional fee.</span></span>
                  </label>
                )}
              </div>

              <label className="mt-6 block text-sm font-semibold text-[#40384b]">
                Additional notes <span className="font-normal text-[#8b8494]">(optional)</span>
                <textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} maxLength={5000} rows={3} className="mt-2 w-full resize-y rounded-lg border border-[#dcd8e6] px-3 py-3 outline-none focus:border-[#6d28d9]" />
              </label>
            </section>

            <section aria-labelledby="requirements-heading" className="border-t border-[#eeeaf3] pt-7">
              <div className="mb-4">
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: primaryColor }}>Step 3</p>
                <h2 id="requirements-heading" className="mt-1 text-lg font-bold text-[#21142f]">Upload requirements</h2>
                <p className="mt-1 text-xs text-[#8b8494]">Accepted formats: JPG, PNG, or PDF. Maximum 10 MB per file.</p>
              </div>
              {data.requirements.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {data.requirements.map((requirement) => (
                    <label key={requirement} className="text-sm font-semibold text-[#40384b]">
                      {optionLabel(requirement, requirementLabels)}
                      <input type="file" accept=".jpg,.jpeg,.png,.pdf" required onChange={(event) => setDocuments((current) => ({ ...current, [requirement]: event.target.files?.[0] ?? null }))} className="mt-2 block w-full text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-[#ede9fe] file:px-3 file:py-2 file:text-xs file:font-bold file:text-[#5b21b6]" />
                    </label>
                  ))}
                </div>
              ) : <p className="rounded-lg border border-[#e5e1ed] bg-[#f7f6fb] p-4 text-sm text-[#686173]">No customer documents are required for this request.</p>}
            </section>

            <section aria-labelledby="payment-heading" className="border-t border-[#eeeaf3] pt-7">
              <div className="mb-4">
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: primaryColor }}>Step 4</p>
                <h2 id="payment-heading" className="mt-1 text-lg font-bold text-[#21142f]">Reservation fee and privacy notice</h2>
              </div>
              {selectedVehicle && <div className="mb-4 rounded-xl border border-[#e5e1ed] bg-[#faf9fc] p-4 text-sm">
                <div className="flex justify-between gap-3"><span>Estimated rental total</span><strong>{data.currency} {Number(selectedVehicle.estimated_rental_amount).toLocaleString('en-PH', { maximumFractionDigits: 2 })}</strong></div>
                {data.reservation_fee && <div className="mt-2 flex justify-between gap-3"><span>Reservation fee due now</span><strong>{data.currency} {Number(data.reservation_fee.amount).toLocaleString('en-PH', { maximumFractionDigits: 2 })}</strong></div>}
                {data.reservation_fee && <div className="mt-2 flex justify-between gap-3 border-t border-[#e5e1ed] pt-2 font-bold"><span>{data.reservation_fee.deductible ? 'Estimated rental balance after fee' : 'Estimated total including fee'}</span><strong>{data.currency} {Number(data.reservation_fee.deductible ? Math.max(0, Number(selectedVehicle.estimated_rental_amount) - Number(data.reservation_fee.amount)) : Number(selectedVehicle.estimated_rental_amount) + Number(data.reservation_fee.amount)).toLocaleString('en-PH', { maximumFractionDigits: 2 })}</strong></div>}
              </div>}
              {reservationFeeExceedsRental && <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="alert">The configured reservation fee exceeds this rental estimate. Please contact the rental business.</p>}
              {data.reservation_fee ? (
                <div className="space-y-4 rounded-xl border border-[#e5e1ed] bg-[#faf9fc] p-4">
                  <div>
                    <p className="text-sm font-bold">Reservation fee: {data.currency} {Number(data.reservation_fee.amount).toLocaleString('en-PH', { maximumFractionDigits: 2 })}</p>
                    <p className="mt-1 text-xs text-[#686173]">{data.reservation_fee.deductible ? 'Deductible from the total rental cost.' : 'Added to the total rental cost.'}</p>
                  </div>
                  {data.reservation_fee.instructions && <p className="whitespace-pre-wrap rounded-lg bg-white p-3 text-sm leading-6 text-[#40384b]">{data.reservation_fee.instructions}</p>}
                  {data.reservation_fee.qr_url && <img src={data.reservation_fee.qr_url} alt="Reservation fee payment QR code" className="h-52 w-52 rounded-lg border border-[#e5e1ed] bg-white object-contain p-2" />}
                  <label className="block text-sm font-semibold text-[#40384b]">
                    Upload payment screenshot or proof
                    <input type="file" accept=".jpg,.jpeg,.png,.pdf" required onChange={(event) => setPaymentProof(event.target.files?.[0] ?? null)} className="mt-2 block w-full text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-[#ede9fe] file:px-3 file:py-2 file:text-xs file:font-bold file:text-[#5b21b6]" />
                  </label>
                  <p className="text-xs leading-5 text-[#686173]">Your proof is reviewed by the rental business. The fee is not considered paid until staff verifies it.</p>
                </div>
              ) : (
                <p className="rounded-xl border border-[#e5e1ed] bg-[#f7f6fb] p-4 text-sm text-[#40384b]">No reservation fee is required for this booking request.</p>
              )}
              <div className="mt-4 rounded-xl border border-[#e5e1ed] p-4 text-sm leading-6 text-[#40384b]">
                <p className="font-bold">Your privacy matters</p>
                <p className="mt-1">The information and documents you provide may be used by the rental business for booking verification, identity validation, rental processing, fraud prevention, and other legitimate purposes related to your rental transaction.</p>
                <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-bold text-[#5b21b6] underline">Privacy Notice</a>
              </div>
              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-[#e5e1ed] bg-[#faf9fc] p-4 text-sm leading-6 text-[#40384b]">
                <input type="checkbox" checked={privacyAcknowledged} onChange={(event) => setPrivacyAcknowledged(event.target.checked)} required className="mt-1 h-4 w-4 shrink-0 accent-[#5b21b6]" />
                <span>I acknowledge that I have read and understood the Privacy Notice regarding the collection and processing of the personal information and documents I provide for this rental transaction.</span>
              </label>
            </section>

            {data.delivery_methods.length === 0 && <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Contact the rental team before submitting to arrange pickup and return.</p>}
            <div className="flex flex-col-reverse gap-3 border-t border-[#eeeaf3] pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-[#8b8494]">Your request is not confirmed until the rental team reviews it.</p>
              <button
                type="submit"
                disabled={submitting || availabilityLoading || !selectedVehicle || data.delivery_methods.length === 0 || !privacyAcknowledged || Boolean(data.reservation_fee && !paymentProof) || !data.requirements.every((requirement) => documents[requirement]) || reservationFeeExceedsRental}
                className="cursor-pointer rounded-lg px-5 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: primaryColor }}
              >
                {submitting ? 'Sending request…' : 'Request this vehicle'}
              </button>
            </div>
          </form>
        )}
      </motion.div>}
      {fullWebsite && (
        <footer className="border-t border-[#eeeaf3] px-6 py-8">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 text-sm text-[#686173] sm:flex-row sm:items-center sm:justify-between">
            <p className="font-bold text-[#21142f]">{data.organization.name}</p>
            <p>{[data.contact_number, data.organization.address, data.organization.city, data.organization.province].filter(Boolean).join(' · ') || 'Contact us to plan your rental.'}</p>
          </div>
        </footer>
      )}
    </main>
  )
}
