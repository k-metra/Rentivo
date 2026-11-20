import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import wordmark from '../assets/rentivo-wordmark.png'
import SearchableSelect from '../components/SearchableSelect'
import { citiesByProvince, provinces } from '../data/philippines'

const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api'
const draftKey = 'rentivo_onboarding_draft'

const steps = [
  { title: 'Company profile', description: 'Add the basics about your rental business.' },
  { title: 'Business location', description: 'Tell us where and how customers can reach you.' },
  { title: 'Rental preferences', description: 'Set the defaults that fit your operations.' },
]

const socialPlatforms = ['Facebook', 'Instagram', 'TikTok', 'LinkedIn', 'YouTube', 'X', 'Other']

interface Draft {
  company_name: string
  phone: string
  address: string
  province: string
  city: string
  timezone: string
  currency: string
  rental_unit: string
  tax_name: string
  tax_rate: string
  social_pages: Array<{ platform: string; url: string }>
}

const defaultDraft: Draft = {
  company_name: localStorage.getItem('rentivo_pending_company') ?? '',
  phone: '',
  address: '',
  province: '',
  city: '',
  timezone: 'UTC',
  currency: 'USD',
  rental_unit: 'day',
  tax_name: '',
  tax_rate: '',
  social_pages: [{ platform: '', url: '' }],
}

function readDraft(): Draft {
  try {
    const stored = localStorage.getItem(draftKey)
    if (!stored) return defaultDraft
    const parsed = JSON.parse(stored) as Partial<Draft>
    return {
      ...defaultDraft,
      ...parsed,
      social_pages: Array.isArray(parsed.social_pages) && parsed.social_pages.length
        ? parsed.social_pages
        : defaultDraft.social_pages,
    }
  } catch {
    return defaultDraft
  }
}

export default function OnboardingPage() {
  const prefersReducedMotion = useReducedMotion()
  const initialStep = Number(new URLSearchParams(window.location.search).get('step') ?? '1')
  const [step, setStep] = useState(Math.min(3, Math.max(1, initialStep)) - 1)
  const [direction, setDirection] = useState(1)
  const [draft, setDraft] = useState<Draft>(readDraft)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [complete, setComplete] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    localStorage.setItem(draftKey, JSON.stringify(draft))
  }, [draft])

  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('step', String(step + 1))
    window.history.replaceState({}, '', url)
  }, [step])

  const updateDraft = (field: keyof Draft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  const move = (nextStep: number) => {
    if (nextStep > step) {
      if (step === 0 && !draft.company_name.trim()) {
        setError('Enter your company name.')
        return
      }
      if (step === 1 && (!draft.province || !draft.city)) {
        setError('Select a province and city.')
        return
      }
      if (step === 2 && (!draft.timezone || !draft.currency || !draft.rental_unit)) {
        setError('Complete your rental preferences.')
        return
      }
    }
    setError('')
    setDirection(nextStep > step ? 1 : -1)
    setStep(nextStep)
  }

  const updateSocialPage = (index: number, field: 'platform' | 'url', value: string) => {
    setDraft((current) => ({
      ...current,
      social_pages: current.social_pages.map((page, pageIndex) =>
        pageIndex === index ? { ...page, [field]: value } : page,
      ),
    }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const formData = new FormData()
      formData.set('company_name', draft.company_name)
      formData.set('phone', draft.phone)
      formData.set('address', draft.address)
      formData.set('province', draft.province)
      formData.set('city', draft.city)
      formData.set('country', 'Philippines')
      formData.set('timezone', draft.timezone)
      formData.set('currency', draft.currency)
      formData.set('rental_unit', draft.rental_unit)
      formData.set('tax_name', draft.tax_name)
      formData.set('tax_rate', draft.tax_rate)
      formData.set('social_pages', JSON.stringify(draft.social_pages.filter((page) => page.platform && page.url)))

      const logo = formRef.current?.querySelector<HTMLInputElement>('input[name="logo"]')?.files?.[0]
      if (logo) formData.set('logo', logo)

      const response = await fetch(`${apiBaseUrl}/onboarding`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${localStorage.getItem('rentivo_access_token') ?? ''}`,
        },
        body: formData,
      })
      const data = await response.json()

      if (!response.ok) {
        const validationMessage = data.errors
          ? Object.values(data.errors).flat().join(' ')
          : data.message
        setError(String(validationMessage || 'We could not save your company details.'))
        return
      }

      setComplete(true)
      localStorage.removeItem(draftKey)
      localStorage.removeItem('rentivo_pending_email')
      localStorage.removeItem('rentivo_pending_company')
    } catch {
      setError('We could not save your company details. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const cityOptions = draft.province ? (citiesByProvince[draft.province] ?? []) : []

  return (
    <main className="min-h-screen bg-[#f7f6fb] text-[#17141f]">
      <header className="flex h-20 items-center border-b border-[#2c0f73]/10 bg-white px-6 sm:px-10">
        <img src={wordmark} alt="Rentivo" className="h-10 w-auto sm:h-12" />
      </header>

      <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center px-6 py-10 sm:py-16">
        <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="w-full rounded-2xl border border-[#2c0f73]/10 bg-white p-6 shadow-[0_24px_60px_rgba(45,28,82,0.12)] sm:p-10 lg:p-12">
          {!complete ? (
            <>
              <div className="mb-8">
                <div className="mb-3 flex items-center justify-between text-sm">
                  <span className="font-bold text-[#5b21b6]">Step {step + 1} of {steps.length}</span>
                  <span className="text-[#686173]">{steps[step].title}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[#ede9fe]">
                  <motion.div className="h-full rounded-full bg-[#5b21b6]" animate={{ width: `${((step + 1) / steps.length) * 100}%` }} transition={{ duration: prefersReducedMotion ? 0 : 0.35 }} />
                </div>
              </div>

              <form ref={formRef} onSubmit={handleSubmit}>
                <AnimatePresence mode="wait" custom={direction}>
                  <motion.div
                    key={step}
                    custom={direction}
                    initial={prefersReducedMotion ? false : { opacity: 0, x: direction * 32 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={prefersReducedMotion ? undefined : { opacity: 0, x: direction * -32 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                  >
                    <h1 className="text-3xl font-semibold tracking-tight text-[#21142f] sm:text-4xl">{steps[step].title}</h1>
                    <p className="mt-3 text-[#686173]">{steps[step].description}</p>

                    {step === 0 && (
                      <div className="mt-8 grid gap-5 sm:grid-cols-2">
                        <label className="block sm:col-span-2">
                          <span className="mb-2 block text-sm font-semibold text-[#40384b]">Company Name</span>
                          <input
                            name="company_name"
                            type="text"
                            required
                            value={draft.company_name}
                            onChange={(event) => updateDraft('company_name', event.target.value)}
                            className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3 outline-none transition focus:border-[#6d28d9] focus:ring-3 focus:ring-[#6d28d9]/10"
                          />
                        </label>
                        <label className="block sm:col-span-2">
                          <span className="mb-2 block text-sm font-semibold text-[#40384b]">Company Logo <span className="font-normal text-[#8b8495]">(optional)</span></span>
                          <input name="logo" type="file" accept="image/jpeg,image/png,image/webp" className="block w-full cursor-pointer text-sm text-[#686173] file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-[#ede9fe] file:px-4 file:py-2.5 file:text-sm file:font-bold file:text-[#5b21b6]" />
                        </label>
                      </div>
                    )}

                    {step === 1 && (
                      <div className="mt-8 grid gap-5 sm:grid-cols-2">
                        <label className="block">
                          <span className="mb-2 block text-sm font-semibold text-[#40384b]">Phone</span>
                          <input name="phone" type="tel" autoComplete="tel" value={draft.phone} onChange={(event) => updateDraft('phone', event.target.value)} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3 outline-none transition focus:border-[#6d28d9]" />
                        </label>
                        <div>
                          <span className="mb-2 block text-sm font-semibold text-[#40384b]">Province</span>
                          <SearchableSelect
                            name="province"
                            value={draft.province}
                            options={provinces}
                            placeholder="Select province"
                            required
                            onChange={(province) => {
                              setDraft((current) => ({
                                ...current,
                                province,
                                city: '',
                              }))
                            }}
                          />
                        </div>
                        <label className="block sm:col-span-2">
                          <span className="mb-2 block text-sm font-semibold text-[#40384b]">Business Address</span>
                          <input name="address" type="text" autoComplete="street-address" value={draft.address} onChange={(event) => updateDraft('address', event.target.value)} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3 outline-none transition focus:border-[#6d28d9]" />
                        </label>
                        <div>
                          <span className="mb-2 block text-sm font-semibold text-[#40384b]">City</span>
                          <SearchableSelect
                            name="city"
                            value={draft.city}
                            options={cityOptions}
                            placeholder={draft.province ? 'Select city' : 'Select a province first'}
                            disabled={!draft.province}
                            required={Boolean(draft.province)}
                            onChange={(city) => updateDraft('city', city)}
                          />
                        </div>
                        <div>
                          <span className="mb-2 block text-sm font-semibold text-[#40384b]">Country</span>
                          <input type="text" value="Philippines" disabled className="w-full cursor-not-allowed rounded-lg border border-[#dcd8e6] bg-[#f7f6fb] px-4 py-3 text-[#686173]" />
                        </div>

                        <fieldset className="sm:col-span-2">
                          <legend className="mb-3 text-sm font-semibold text-[#40384b]">Social Pages <span className="font-normal text-[#8b8495]">(optional)</span></legend>
                          <div className="space-y-3">
                            {draft.social_pages.map((page, index) => (
                              <div key={index} className="grid gap-3 sm:grid-cols-[180px_1fr_auto]">
                                <SearchableSelect
                                  name={`social_platform_${index}`}
                                  value={page.platform}
                                  options={socialPlatforms}
                                  placeholder="Select page"
                                  onChange={(platform) => updateSocialPage(index, 'platform', platform)}
                                />
                                <input
                                  type="url"
                                  value={page.url}
                                  onChange={(event) => updateSocialPage(index, 'url', event.target.value)}
                                  placeholder="https://..."
                                  className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3 outline-none transition placeholder:text-[#aaa4b4] focus:border-[#6d28d9]"
                                />
                                <button
                                  type="button"
                                  disabled={draft.social_pages.length === 1}
                                  onClick={() => setDraft((current) => ({ ...current, social_pages: current.social_pages.filter((_, pageIndex) => pageIndex !== index) }))}
                                  className="cursor-pointer rounded-lg border border-[#dcd8e6] px-3 text-[#686173] transition hover:border-red-200 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                                  aria-label={`Remove social page ${index + 1}`}
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                          <button type="button" onClick={() => setDraft((current) => ({ ...current, social_pages: [...current.social_pages, { platform: '', url: '' }] }))} className="mt-3 cursor-pointer text-sm font-bold text-[#5b21b6] hover:text-[#4c1d95]">
                            + Add another social page
                          </button>
                        </fieldset>
                      </div>
                    )}

                    {step === 2 && (
                      <div className="mt-8 grid gap-5 sm:grid-cols-2">
                        <div>
                          <span className="mb-2 block text-sm font-semibold text-[#40384b]">Timezone</span>
                          <SearchableSelect name="timezone" value={draft.timezone} options={['UTC', 'Asia/Manila']} placeholder="Select timezone" required onChange={(timezone) => updateDraft('timezone', timezone)} />
                        </div>
                        <div>
                          <span className="mb-2 block text-sm font-semibold text-[#40384b]">Currency</span>
                          <SearchableSelect name="currency" value={draft.currency} options={['USD', 'EUR', 'GBP', 'PHP', 'SGD']} placeholder="Select currency" required onChange={(currency) => updateDraft('currency', currency)} />
                        </div>
                        <div className="sm:col-span-2">
                          <span className="mb-2 block text-sm font-semibold text-[#40384b]">Default Rental Unit</span>
                          <SearchableSelect name="rental_unit" value={draft.rental_unit} options={['hour', 'day', 'week', 'month']} placeholder="Select rental unit" required onChange={(rentalUnit) => updateDraft('rental_unit', rentalUnit)} />
                        </div>
                        <label className="block">
                          <span className="mb-2 block text-sm font-semibold text-[#40384b]">Tax Name <span className="font-normal text-[#8b8495]">(optional)</span></span>
                          <input name="tax_name" type="text" value={draft.tax_name} onChange={(event) => updateDraft('tax_name', event.target.value)} placeholder="Sales tax" className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3 outline-none transition placeholder:text-[#aaa4b4] focus:border-[#6d28d9]" />
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-sm font-semibold text-[#40384b]">Tax Rate <span className="font-normal text-[#8b8495]">(%)</span></span>
                          <input name="tax_rate" type="number" min="0" max="100" step="0.01" value={draft.tax_rate} onChange={(event) => updateDraft('tax_rate', event.target.value)} placeholder="0.00" className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3 outline-none transition placeholder:text-[#aaa4b4] focus:border-[#6d28d9]" />
                        </label>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>

                {error && <p className="mt-6 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
                <div className="mt-8 flex justify-between gap-4 border-t border-[#edeaf2] pt-6">
                  <button type="button" onClick={() => move(step - 1)} disabled={step === 0} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-5 py-3 font-bold text-[#40384b] transition hover:bg-[#f7f6fb] disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
                  {step < steps.length - 1 ? (
                    <button type="button" onClick={() => move(step + 1)} className="cursor-pointer rounded-lg bg-[#5b21b6] px-6 py-3 font-bold text-white shadow-[0_8px_20px_rgba(91,33,182,0.18)] transition hover:bg-[#4c1d95]">Next</button>
                  ) : (
                    <button type="submit" disabled={isSubmitting} className="cursor-pointer rounded-lg bg-[#5b21b6] px-6 py-3 font-bold text-white shadow-[0_8px_20px_rgba(91,33,182,0.18)] transition hover:bg-[#4c1d95] disabled:cursor-not-allowed disabled:opacity-60">{isSubmitting ? 'Saving setup...' : 'Complete Onboarding'}</button>
                  )}
                </div>
              </form>
            </>
          ) : (
            <motion.div initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="flex min-h-[440px] flex-col items-center justify-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#ede9fe] text-3xl text-[#5b21b6]">✓</div>
              <h1 className="mt-6 text-3xl font-semibold text-[#21142f]">Your workspace is ready</h1>
              <p className="mt-3 max-w-md text-[#686173]">Rentivo is configured and ready for your rental operations.</p>
              <a href="/dashboard" className="mt-6 cursor-pointer rounded-lg bg-[#5b21b6] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#4c1d95]">Go to Dashboard</a>
            </motion.div>
          )}
        </motion.div>
      </section>
    </main>
  )
}
