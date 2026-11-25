import { AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import PublicBookingDrawer, { type PublicVehicleProfile } from './PublicBookingDrawer'

type PublicVehiclePageData = {
  organization: { name: string; primary_color?: string; logo_url?: string | null }
  vehicle: PublicVehicleProfile['vehicle']
  requirements: string[]
  delivery_methods: string[]
  professional_driver_enabled: boolean
  reservation_fee: PublicVehicleProfile['reservation_fee']
  currency: string
}

function galleryLabel(category: string) {
  if (category === 'marketing') return 'Marketing photo'
  return category.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export default function PublicVehiclePage() {
  const { slug, vehicleId } = useParams()
  const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api'
  const [data, setData] = useState<PublicVehiclePageData | null>(null)
  const [selectedImage, setSelectedImage] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!slug || !vehicleId) {
      setError('This vehicle is unavailable.')
      setLoading(false)
      return
    }

    const controller = new AbortController()
    fetch(`${apiBaseUrl}/booking-form/${encodeURIComponent(slug)}/vehicles/${encodeURIComponent(vehicleId)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.message || 'This vehicle is unavailable.')
        const profile = result as PublicVehiclePageData
        setData(profile)
        setSelectedImage(profile.vehicle.marketing_image_url || profile.vehicle.images[0]?.image_url || '')
      })
      .catch((loadError) => {
        if (loadError instanceof Error && loadError.name === 'AbortError') return
        setError(loadError instanceof Error ? loadError.message : 'This vehicle is unavailable.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [apiBaseUrl, slug, vehicleId])

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f7f6fb]"><div className="h-10 w-10 animate-spin rounded-full border-4 border-[#ede9fe] border-t-[#5b21b6]" role="status" aria-label="Loading vehicle" /></main>
  }

  if (error || !data || !slug) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f7f6fb] px-6"><div className="max-w-md rounded-xl border border-red-100 bg-red-50 p-6 text-center text-sm text-red-700" role="alert">{error || 'This vehicle is unavailable.'}</div></main>
  }

  const { vehicle } = data
  const title = vehicle.name || `${vehicle.brand} ${vehicle.model} ${vehicle.year}`
  const gallery = [
    ...(vehicle.marketing_image_url ? [{ id: 'marketing', category: 'marketing', image_url: vehicle.marketing_image_url }] : []),
    ...vehicle.images,
  ]

  return (
    <main className="min-h-screen bg-white text-[#21142f]">
      <header className="border-b border-[#eeeaf3]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link to={`/booking/${encodeURIComponent(slug)}#fleet`} className="flex min-w-0 items-center gap-3 text-sm font-bold text-[#5b21b6] hover:underline">
            <span aria-hidden="true">←</span> Back to {data.organization.name}
          </Link>
          <span className="truncate text-sm font-bold">{data.organization.name}</span>
          <Link to={`/booking/${encodeURIComponent(slug)}/my-bookings`} className="cursor-pointer rounded-lg px-3 py-2 text-sm font-bold text-[#5b21b6] hover:bg-[#f7f6fb]">My bookings</Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-8 sm:px-8 sm:py-12 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,.7fr)]">
        <section>
          <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-2xl bg-[#f7f6fb]">
            {selectedImage
              ? <>
                  <img src={selectedImage} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-30 blur-xl" />
                  <img src={selectedImage} alt={`${title} vehicle`} className="relative z-10 h-full w-full object-contain" />
                </>
              : <p className="text-sm font-semibold text-[#8b8494]">Vehicle photos coming soon</p>}
          </div>
          {gallery.length > 1 && (
            <div className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-6">
              {gallery.map((image) => (
                <div key={image.id} className="min-w-0">
                  <button type="button" onClick={() => setSelectedImage(image.image_url)} aria-label={`View ${galleryLabel(image.category)} photo`} aria-pressed={selectedImage === image.image_url} className={`cursor-pointer w-full overflow-hidden rounded-lg border-2 ${selectedImage === image.image_url ? 'border-[#5b21b6]' : 'border-transparent'}`}>
                    <img src={image.image_url} alt="" className="h-20 w-full object-cover sm:h-24" />
                  </button>
                  <p className="mt-1 truncate text-center text-xs font-semibold text-[#686173]">{galleryLabel(image.category)}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="self-start lg:sticky lg:top-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: data.organization.primary_color || '#5b21b6' }}>Vehicle details</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-3 text-sm text-[#686173]">{[vehicle.year, vehicle.type, vehicle.color, vehicle.seat_count ? `${vehicle.seat_count} seats` : null, vehicle.transmission, vehicle.fuel_type].filter(Boolean).join(' · ')}</p>

          <div className="mt-8 rounded-xl border border-[#e5e1ed] p-5">
            <h2 className="text-sm font-bold">Rental rates</h2>
            <div className="mt-3 space-y-3">
              {vehicle.rental_rates.length > 0
                ? vehicle.rental_rates.map((rate) => (
                  <div key={rate.duration_hours} className="flex justify-between gap-3 text-sm">
                    <span className="text-[#686173]">{rate.duration_hours}-hour rate</span>
                    <strong>{data.currency} {Number(rate.amount).toLocaleString('en-PH', { maximumFractionDigits: 2 })}</strong>
                  </div>
                ))
                : <div className="flex justify-between gap-3 text-sm"><span className="text-[#686173]">Daily rate</span><strong>{data.currency} {Number(vehicle.daily_rate).toLocaleString('en-PH', { maximumFractionDigits: 2 })}</strong></div>}
            </div>
            {Number(vehicle.security_deposit ?? 0) > 0 && <p className="mt-4 border-t border-[#eeeaf3] pt-3 text-xs text-[#686173]">Refundable security deposit: {data.currency} {Number(vehicle.security_deposit).toLocaleString('en-PH', { maximumFractionDigits: 2 })}</p>}
          </div>

          <button type="button" onClick={() => setDrawerOpen(true)} className="mt-6 w-full cursor-pointer rounded-lg px-5 py-3.5 text-sm font-bold text-white transition hover:opacity-90" style={{ backgroundColor: data.organization.primary_color || '#5b21b6' }}>
            Book this vehicle
          </button>
          <p className="mt-3 text-xs leading-5 text-[#8b8494]">Your request is subject to availability and approval by the rental team.</p>
        </section>
      </div>

      <AnimatePresence>
        {drawerOpen && (
          <PublicBookingDrawer
            key="public-booking-drawer"
            apiBaseUrl={apiBaseUrl}
            slug={slug}
            data={data}
            onClose={() => setDrawerOpen(false)}
          />
        )}
      </AnimatePresence>
    </main>
  )
}
