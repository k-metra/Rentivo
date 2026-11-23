import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState, type FormEvent } from 'react'
import { provinces } from '../../data/philippines'
import { citiesByProvince } from '../../data/philippines'

type OrganizationSettings = {
  name: string
  plan: string
  phone?: string
  address?: string
  city?: string
  province?: string
  primary_color?: string
  logo_path?: string
  logo_url?: string
  e_signature_eligible?: boolean
  electronic_signature_enabled?: boolean
  online_booking_eligible?: boolean
  online_booking_enabled?: boolean
  online_booking_url?: string
  online_booking_phone?: string
  customer_requirements_expiry_months?: number
  online_booking_requirements?: Record<string, boolean> | string[]
  delivery_methods?: Record<string, boolean> | string[]
  professional_driver_enabled?: boolean
}

const requirementOptions = [
  ['primary_id', 'Primary ID'],
  ['secondary_id', 'Secondary ID'],
  ['proof_of_billing', 'Proof of Billing'],
  ['ltms_screenshots', 'LTMS Screenshots'],
  ['selfie_with_primary_id', 'Selfie with Primary ID'],
] as const

const deliveryOptions = [
  ['renter_pickup_renter_return', 'Renter Pickup & Renter Return'],
  ['renter_pickup_owner_collection', 'Renter Pickup & Owner Collection'],
  ['owner_delivery_renter_return', 'Owner Delivery & Renter Return'],
  ['owner_delivery_owner_collection', 'Owner Delivery & Owner Collection'],
] as const

export function SettingsSection() {
  const prefersReducedMotion = useReducedMotion()
  const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api'
  const storageBaseUrl = apiBaseUrl.replace(/\/api\/?$/, '')
  const token = localStorage.getItem('rentivo_access_token') ?? ''
  const authHeaders = { Accept: 'application/json', Authorization: `Bearer ${token}` }

  const [tab, setTab] = useState<'profile' | 'signature' | 'booking'>('profile')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [copied, setCopied] = useState(false)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [province, setProvince] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#5b21b6')
  const [logo, setLogo] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState('')
  const [plan, setPlan] = useState('Growth')
  const [eSignatureEligible, setESignatureEligible] = useState(false)
  const [eSignatureEnabled, setESignatureEnabled] = useState(false)
  const [onlineEligible, setOnlineEligible] = useState(false)
  const [onlineEnabled, setOnlineEnabled] = useState(false)
  const [onlineUrl, setOnlineUrl] = useState('')
  const [onlinePhone, setOnlinePhone] = useState('')
  const [expiryMonths, setExpiryMonths] = useState(12)
  const [requirements, setRequirements] = useState<Record<string, boolean>>({
    primary_id: true,
    secondary_id: true,
    proof_of_billing: true,
    ltms_screenshots: true,
    selfie_with_primary_id: true,
  })
  const [deliveryMethods, setDeliveryMethods] = useState<Record<string, boolean>>({
    renter_pickup_renter_return: true,
    renter_pickup_owner_collection: true,
    owner_delivery_renter_return: true,
    owner_delivery_owner_collection: true,
  })
  const [professionalDriver, setProfessionalDriver] = useState(false)

  useEffect(() => {
    fetch(`${apiBaseUrl}/dashboard/settings`, { headers: authHeaders })
      .then(async (response) => {
        const data = await response.json() as OrganizationSettings
        if (!response.ok) throw new Error('Unable to load settings')
        setName(data.name ?? '')
        setPhone(data.phone ?? '')
        setAddress(data.address ?? '')
        setCity(data.city ?? '')
        setProvince(data.province ?? '')
        setPrimaryColor(data.primary_color ?? '#5b21b6')
        setPlan(data.plan ?? 'Growth')
        setESignatureEligible(Boolean(data.e_signature_eligible))
        setESignatureEnabled(Boolean(data.electronic_signature_enabled))
        setOnlineEligible(Boolean(data.online_booking_eligible))
        setOnlineEnabled(Boolean(data.online_booking_enabled))
        setOnlineUrl(data.online_booking_url ?? '')
        setOnlinePhone(data.online_booking_phone ?? '')
        setExpiryMonths(data.customer_requirements_expiry_months ?? 12)
        const loadedRequirements = Array.isArray(data.online_booking_requirements)
          ? data.online_booking_requirements
          : Object.entries(data.online_booking_requirements ?? {}).filter(([, enabled]) => enabled).map(([key]) => key)
        setRequirements({
          primary_id: loadedRequirements.includes('primary_id'),
          secondary_id: loadedRequirements.includes('secondary_id'),
          proof_of_billing: loadedRequirements.includes('proof_of_billing'),
          ltms_screenshots: loadedRequirements.includes('ltms_screenshots'),
          selfie_with_primary_id: loadedRequirements.includes('selfie_with_primary_id'),
        })
        const loadedDelivery = Array.isArray(data.delivery_methods)
          ? data.delivery_methods
          : Object.entries(data.delivery_methods ?? {}).filter(([, enabled]) => enabled).map(([key]) => key)
        setDeliveryMethods({
          renter_pickup_renter_return: loadedDelivery.includes('renter_pickup_renter_return'),
          renter_pickup_owner_collection: loadedDelivery.includes('renter_pickup_owner_collection'),
          owner_delivery_renter_return: loadedDelivery.includes('owner_delivery_renter_return'),
          owner_delivery_owner_collection: loadedDelivery.includes('owner_delivery_owner_collection'),
        })
        setProfessionalDriver(Boolean(data.professional_driver_enabled))
        const url = data.logo_url
          ? (data.logo_url.startsWith('http') ? data.logo_url : `${storageBaseUrl}${data.logo_url}`)
          : data.logo_path
            ? `${storageBaseUrl}/storage/${data.logo_path.replace(/^\/+/, '').replace(/^storage\//, '')}`
            : ''
        setLogoPreview(url)
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Unable to load settings'))
      .finally(() => setLoading(false))
  }, [])

  const save = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const form = new FormData()
      form.set('name', name)
      form.set('phone', phone)
      form.set('address', address)
      form.set('city', city)
      form.set('province', province)
      form.set('primary_color', primaryColor)
      form.set('electronic_signature_enabled', eSignatureEnabled ? '1' : '0')
      form.set('online_booking_enabled', onlineEnabled ? '1' : '0')
      form.set('customer_requirements_expiry_months', String(expiryMonths))
      form.set('online_booking_phone', onlinePhone)
      Object.entries(requirements).forEach(([key, enabled]) => {
        if (enabled) form.append('online_booking_requirements[]', key)
      })
      Object.entries(deliveryMethods).forEach(([key, enabled]) => {
        if (enabled) form.append('delivery_methods[]', key)
      })
      form.set('professional_driver_enabled', professionalDriver ? '1' : '0')
      if (logo) form.set('logo', logo)

      const response = await fetch(`${apiBaseUrl}/dashboard/settings`, {
        method: 'POST',
        headers: authHeaders,
        body: form,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to save settings')
      setSuccess('Settings saved successfully.')
      setLogo(null)
      if (data.logo_url) {
        setLogoPreview(data.logo_url.startsWith('http') ? data.logo_url : `${storageBaseUrl}${data.logo_url}`)
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save settings')
    } finally {
      setSaving(false)
    }
  }

  const copyLink = async () => {
    if (!onlineUrl) return
    try {
      await navigator.clipboard.writeText(onlineUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Unable to copy the booking link.')
    }
  }

  if (loading) {
    return <div className="grid gap-4 sm:grid-cols-2">{[1, 2, 3, 4].map((key) => <div key={key} className="h-32 animate-pulse rounded-xl bg-white" />)}</div>
  }

  return (
    <motion.section initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold text-[#21142f]">Settings</h2>
        <p className="mt-1 text-sm text-[#8b8494]">Manage your workspace profile and rental experience.</p>
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border border-[#2c0f73]/10 bg-white p-2">
        {([
          ['profile', 'Profile Settings'],
          ['signature', 'Electronic Signature'],
          ['booking', 'Online Booking Form'],
        ] as const).map(([key, label]) => (
          <button
            type="button"
            key={key}
            onClick={() => { setTab(key); setError(''); setSuccess('') }}
            className={`cursor-pointer rounded-lg px-4 py-2.5 text-sm font-bold transition ${tab === key ? 'bg-[#ede9fe] text-[#5b21b6]' : 'text-[#686173] hover:bg-[#f7f6fb]'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}
      {success && <p className="rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-sm font-semibold text-[#15803d]" role="status">{success}</p>}

      <form onSubmit={save} className="rounded-xl border border-[#2c0f73]/10 bg-white p-5 sm:p-6">
        {tab === 'profile' && (
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <span className="mb-2 block text-sm font-semibold">Company logo</span>
              <div className="flex flex-wrap items-center gap-4">
                {logoPreview
                  ? <img src={logoPreview} alt={`${name || 'Company'} logo`} className="h-20 w-20 rounded-xl border border-[#e5e1ed] object-contain" />
                  : <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-[#5b21b6] text-2xl font-bold text-white">{name.slice(0, 1).toUpperCase() || 'C'}</div>}
                <label className="cursor-pointer">
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
                    const file = event.target.files?.[0] ?? null
                    setLogo(file)
                    if (file) setLogoPreview(URL.createObjectURL(file))
                  }} className="block text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-[#ede9fe] file:px-3 file:py-2 file:text-xs file:font-bold file:text-[#5b21b6]" />
                </label>
              </div>
            </div>

            <label className="sm:col-span-2"><span className="mb-2 block text-sm font-semibold">Company name</span><input value={name} onChange={(event) => setName(event.target.value)} required className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3 outline-none focus:border-[#6d28d9]" /></label>
            <label><span className="mb-2 block text-sm font-semibold">Contact number</span><input value={phone} onChange={(event) => setPhone(event.target.value)} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3 outline-none focus:border-[#6d28d9]" /></label>
            <label><span className="mb-2 block text-sm font-semibold">Primary color</span><div className="flex gap-2"><input type="color" value={primaryColor} onChange={(event) => setPrimaryColor(event.target.value)} className="h-12 w-16 cursor-pointer rounded-lg border border-[#dcd8e6] bg-white p-1" /><input value={primaryColor} onChange={(event) => setPrimaryColor(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-[#dcd8e6] px-4 py-3 outline-none focus:border-[#6d28d9]" /></div></label>
            <label className="sm:col-span-2"><span className="mb-2 block text-sm font-semibold">Company address</span><textarea rows={3} value={address} onChange={(event) => setAddress(event.target.value)} className="w-full resize-y rounded-lg border border-[#dcd8e6] px-4 py-3 outline-none focus:border-[#6d28d9]" /></label>
            <label><span className="mb-2 block text-sm font-semibold">Province</span><select value={province} onChange={(event) => { setProvince(event.target.value); setCity('') }} className="w-full cursor-pointer rounded-lg border border-[#dcd8e6] px-4 py-3 outline-none focus:border-[#6d28d9]"><option value="">Select province</option>{provinces.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label><span className="mb-2 block text-sm font-semibold">City</span><select value={city} onChange={(event) => setCity(event.target.value)} disabled={!province} className="w-full cursor-pointer rounded-lg border border-[#dcd8e6] px-4 py-3 outline-none focus:border-[#6d28d9] disabled:cursor-not-allowed disabled:bg-[#f7f6fb]"><option value="">Select city</option>{province ? (citiesByProvince[province] ?? []).map((item) => <option key={item}>{item}</option>) : null}</select></label>
          </div>
        )}

        {tab === 'signature' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-[#e5e1ed] p-5">
              <div>
                <p className="text-sm font-bold">Electronic signatures</p>
                <p className="mt-1 max-w-xl text-sm text-[#686173]">Enable electronic signatures for new contracts. Existing issued contracts keep their original signing mode.</p>
              </div>
              <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${plan === 'Solo' ? 'bg-[#f3f4f6] text-[#686173]' : 'bg-[#ede9fe] text-[#6d28d9]'}`}>{plan} plan</span>
            </div>
            {!eSignatureEligible ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">Electronic signatures are available on Growth plans and above. Upgrade your plan to enable this feature.</div>
            ) : (
              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-[#e5e1ed] p-5">
                <span><span className="block text-sm font-bold">Enable electronic signatures</span><span className="mt-1 block text-xs text-[#8b8494]">New contracts can use a digital signing workflow.</span></span>
                <input type="checkbox" checked={eSignatureEnabled} onChange={(event) => setESignatureEnabled(event.target.checked)} className="h-5 w-5 accent-[#5b21b6]" />
              </label>
            )}
          </div>
        )}

        {tab === 'booking' && (
          <div className="space-y-6">
            {!onlineEligible ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">The online booking form is available on Professional plans and above. Upgrade your plan to enable this feature.</div>
            ) : (
              <>
                <div className="rounded-xl border border-[#e5e1ed] p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div><p className="text-sm font-bold">Online booking form</p><p className="mt-1 text-xs text-[#8b8494]">Public link for customer bookings</p></div>
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-bold"><span>{onlineEnabled ? 'Enabled' : 'Disabled'}</span><input type="checkbox" checked={onlineEnabled} onChange={(event) => setOnlineEnabled(event.target.checked)} className="h-5 w-5 accent-[#5b21b6]" /></label>
                  </div>
                  {onlineUrl && <div className="mt-4 flex gap-2"><input value={onlineUrl} readOnly className="min-w-0 flex-1 rounded-lg border border-[#dcd8e6] bg-[#f7f6fb] px-3 py-2.5 text-sm" /><button type="button" onClick={copyLink} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-4 py-2.5 text-sm font-bold text-[#5b21b6]">{copied ? 'Copied!' : 'Copy link'}</button></div>}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label><span className="mb-2 block text-sm font-semibold">Customer requirements expire after</span><div className="flex items-center gap-2"><input type="number" min="1" max="120" value={expiryMonths} onChange={(event) => setExpiryMonths(Number(event.target.value))} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /><span className="text-sm text-[#686173]">months</span></div></label>
                  <label><span className="mb-2 block text-sm font-semibold">Contact number</span><input value={onlinePhone} onChange={(event) => setOnlinePhone(event.target.value)} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label>
                </div>
                <div className="rounded-xl border border-[#e5e1ed] p-5">
                  <h3 className="text-sm font-bold">Required customer documents</h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">{requirementOptions.map(([key, label]) => <label key={key} className="flex cursor-pointer items-center justify-between rounded-lg bg-[#f7f6fb] px-4 py-3 text-sm"><span>{label}</span><input type="checkbox" checked={requirements[key]} onChange={(event) => setRequirements((current) => ({ ...current, [key]: event.target.checked }))} className="h-4 w-4 accent-[#5b21b6]" /></label>)}</div>
                </div>
                <div className="rounded-xl border border-[#e5e1ed] p-5">
                  <h3 className="text-sm font-bold">Delivery & collection methods</h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">{deliveryOptions.map(([key, label]) => <label key={key} className="flex cursor-pointer items-center justify-between rounded-lg bg-[#f7f6fb] px-4 py-3 text-sm"><span>{label}</span><input type="checkbox" checked={deliveryMethods[key]} onChange={(event) => setDeliveryMethods((current) => ({ ...current, [key]: event.target.checked }))} className="h-4 w-4 accent-[#5b21b6]" /></label>)}</div>
                </div>
                <label className="flex cursor-pointer items-center justify-between rounded-xl border border-[#e5e1ed] p-5"><span><span className="block text-sm font-bold">Professional driver service</span><span className="mt-1 block text-xs text-[#8b8494]">Offer a driver option during online booking.</span></span><input type="checkbox" checked={professionalDriver} onChange={(event) => setProfessionalDriver(event.target.checked)} className="h-5 w-5 accent-[#5b21b6]" /></label>
              </>
            )}
          </div>
        )}

        <div className="mt-6 flex justify-end border-t border-[#eeeaf3] pt-5">
          <button type="submit" disabled={saving} className="cursor-pointer rounded-lg bg-[#5b21b6] px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">{saving ? 'Saving...' : 'Save settings'}</button>
        </div>
      </form>
    </motion.section>
  )
}
