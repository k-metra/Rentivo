import { motion, useReducedMotion } from 'framer-motion'
import type { ChangeEvent, FormEvent, RefObject } from 'react'
import { useEffect, useState } from 'react'
import SearchableSelect from '../SearchableSelect'

export type VehicleModalVehicle = {
  id: number
  partner_id?: number | null
  partner?: { id: number; name: string; first_name?: string; middle_name?: string; last_name?: string }
  name?: string
  brand: string
  model: string
  year: number
  color?: string
  plate_number: string
  seat_count?: number
  type: string
  carwash_fee?: number | string
  security_deposit?: number | string
  hourly_extension_rate?: number | string
  mileage_limit?: number
  mileage_limit_unit?: 'rental' | 'day'
  excess_mileage_rate?: number | string
  transmission?: string
  fuel_type?: string
  status: string
  rental_rates?: Array<{
    duration_hours: number
    amount: number | string
    outside_amount?: number | string
  }>
}

type Coverage = {
  type: 'all' | 'province' | 'region'
  locations: string[]
}

type Props = {
  mode: 'create' | 'view' | 'edit'
  vehicle: VehicleModalVehicle | null
  imagePreview: string
  selectedDurations: number[]
  coverageByDuration: Record<number, Coverage>
  outsideCharges: Record<number, string>
  provinces: string[]
  partners: Array<{ id: number; name: string; first_name?: string; middle_name?: string; last_name?: string }>
  submitting: boolean
  formError: string
  formRef: RefObject<HTMLFormElement | null>
  prefersReducedMotion: boolean | null
  onClose: () => void
  onEdit: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onChange: (event: ChangeEvent<HTMLFormElement>) => void
  onSetMode: (mode: 'create' | 'view' | 'edit') => void
  onSetDurations: (value: number[] | ((current: number[]) => number[])) => void
  onSetCoverage: (value: Record<number, Coverage> | ((current: Record<number, Coverage>) => Record<number, Coverage>)) => void
  onSetOutsideCharges: (value: Record<number, string> | ((current: Record<number, string>) => Record<number, string>)) => void
  onImageChange: (event: ChangeEvent<HTMLInputElement>) => void
}

export function VehicleModal({
  mode,
  vehicle,
  imagePreview,
  selectedDurations,
  coverageByDuration,
  outsideCharges,
  provinces,
  partners,
  submitting,
  formError,
  formRef,
  prefersReducedMotion,
  onClose,
  onEdit,
  onSubmit,
  onChange,
  onSetMode,
  onSetDurations,
  onSetCoverage,
  onSetOutsideCharges,
  onImageChange,
}: Props) {
  const reduceMotion = useReducedMotion() || prefersReducedMotion
  const [vehicleType, setVehicleType] = useState(vehicle?.type || 'Sedan')
  const [transmission, setTransmission] = useState(vehicle?.transmission || 'Automatic')
  const [fuelType, setFuelType] = useState(vehicle?.fuel_type || 'Unleaded 91')
  const [vehicleStatus, setVehicleStatus] = useState(vehicle?.status || 'available')
  const [partnerId, setPartnerId] = useState(String(vehicle?.partner_id ?? ''))
  const [mileageUnit, setMileageUnit] = useState(vehicle?.mileage_limit_unit || 'rental')

  useEffect(() => {
    setVehicleType(vehicle?.type || 'Sedan')
    setTransmission(vehicle?.transmission || 'Automatic')
    setFuelType(vehicle?.fuel_type || 'Unleaded 91')
    setVehicleStatus(vehicle?.status || 'available')
    setPartnerId(String(vehicle?.partner_id ?? ''))
    setMileageUnit(vehicle?.mileage_limit_unit || 'rental')
  }, [vehicle, mode])
  const partnerName = (partner?: { name?: string; first_name?: string; middle_name?: string; last_name?: string } | null) =>
    partner?.name || [partner?.first_name, partner?.middle_name, partner?.last_name].filter(Boolean).join(' ') || 'No partner'

  const renderDurationCoverage = (duration: number) => {
    const coverage = coverageByDuration[duration] ?? { type: 'all' as const, locations: [] as string[] }
    const existingRate = vehicle?.rental_rates?.find((rate) => rate.duration_hours === duration)
    return (
      <div key={duration} className="space-y-3 rounded-lg border border-[#eeeaf3] p-3">
        <div className="grid gap-3 sm:grid-cols-[100px_1fr_180px] sm:items-end">
          <span className="text-sm font-semibold">{duration} hours</span>
          <label>
            <span className="mb-1 block text-xs font-semibold text-[#686173]">Base rental rate</span>
            <input name={`rate_all_${duration}`} type="number" min="0" step="0.01" defaultValue={existingRate?.amount || ''} placeholder="Base amount" className="w-full rounded-lg border border-[#dcd8e6] px-4 py-2.5 outline-none focus:border-[#6d28d9]" />
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold text-[#686173]">Outside-area charge</span>
            <input value={outsideCharges[duration] ?? ''} onChange={(event) => onSetOutsideCharges((current) => ({ ...current, [duration]: event.target.value }))} type="number" min="0" step="0.01" placeholder="Additional amount" className="w-full rounded-lg border border-[#dcd8e6] px-4 py-2.5 outline-none focus:border-[#6d28d9]" />
          </label>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-[#686173]">Where the base rental rate applies</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onSetCoverage((current) => ({ ...current, [duration]: { type: 'all', locations: [] } }))} className={`cursor-pointer rounded-lg px-3 py-2 text-xs font-bold ${coverage.type === 'all' ? 'bg-[#5b21b6] text-white' : 'border border-[#dcd8e6] text-[#686173]'}`}>Everywhere</button>
            <button type="button" onClick={() => onSetCoverage((current) => ({ ...current, [duration]: { type: 'province', locations: coverage.locations } }))} className={`cursor-pointer rounded-lg px-3 py-2 text-xs font-bold ${coverage.type === 'province' ? 'bg-[#5b21b6] text-white' : 'border border-[#dcd8e6] text-[#686173]'}`}>Selected provinces</button>
          </div>
          {coverage.type === 'province' && (
            <div className="mt-3 flex flex-wrap gap-2">
              {provinces.map((province) => {
                const selected = coverage.locations.includes(province)
                return (
                  <button
                    type="button"
                    key={province}
                    onClick={() => onSetCoverage((current) => ({
                      ...current,
                      [duration]: {
                        type: 'province',
                        locations: selected ? coverage.locations.filter((item) => item !== province) : [...coverage.locations, province],
                      },
                    }))}
                    className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold ${selected ? 'border-[#5b21b6] bg-[#ede9fe] text-[#5b21b6]' : 'border-[#dcd8e6] text-[#686173] hover:border-[#c4b5fd]'}`}
                  >
                    {province}
                  </button>
                )
              })}
            </div>
          )}
        </div>
        {coverage.type !== 'all' && coverage.locations.length > 0 && (
          <p className="text-xs text-[#8b8494]">Outside these selected locations, the outside-area charge is added to the base rate.</p>
        )}
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#17141f]/55 p-2 sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={reduceMotion ? undefined : { opacity: 0, scale: 0.98 }}
        className="flex max-h-[calc(100dvh-1rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)]"
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'view' ? 'Vehicle details' : mode === 'edit' ? 'Edit vehicle' : 'Add vehicle'}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#eeeaf3] px-4 py-4 sm:px-6">
          <h2 className="text-lg font-bold sm:text-xl">{mode === 'view' ? 'Vehicle details' : mode === 'edit' ? 'Edit vehicle' : 'Add vehicle'}</h2>
          <button type="button" onClick={onClose} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-2xl text-[#8b8494] hover:bg-[#f7f6fb]" aria-label="Close">×</button>
        </div>

        <form ref={formRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5 sm:px-6" onSubmit={onSubmit} onChange={onChange}>
          {mode === 'view' && vehicle && (
            <div className="space-y-6">
              {imagePreview && <img src={imagePreview} alt={vehicle.name || `${vehicle.brand} ${vehicle.model}`} className="h-52 w-full rounded-xl bg-[#f7f6fb] object-contain" />}
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  ['Name', vehicle.name || `${vehicle.brand} ${vehicle.model} ${vehicle.year}`],
                  ['Plate number', vehicle.plate_number],
                  ['Brand', vehicle.brand],
                  ['Model', vehicle.model],
                  ['Year', String(vehicle.year)],
                  ['Color', vehicle.color || '—'],
                  ['Seat count', String(vehicle.seat_count ?? '—')],
                  ['Vehicle type', vehicle.type],
                  ['Transmission', vehicle.transmission || '—'],
                  ['Fuel type', vehicle.fuel_type || '—'],
                  ['Mileage limit', vehicle.mileage_limit ? `${vehicle.mileage_limit} km / ${vehicle.mileage_limit_unit === 'day' ? 'day' : 'entire rental'}` : 'Unlimited'],
                  ['Excess mileage rate', vehicle.excess_mileage_rate ? `₱${Number(vehicle.excess_mileage_rate).toLocaleString('en-PH')}/km` : 'Not set'],
                  ['Security deposit', vehicle.security_deposit ? `₱${Number(vehicle.security_deposit).toLocaleString('en-PH')}` : '—'],
                  ['Carwash fee', `₱${Number(vehicle.carwash_fee ?? 200).toLocaleString('en-PH')}`],
                  ['Hourly extension', vehicle.hourly_extension_rate ? `₱${Number(vehicle.hourly_extension_rate).toLocaleString('en-PH')}/hour` : '—'],
                  ['Partner', partnerName(vehicle.partner)],
                  ['Status', vehicle.status],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-[#f7f6fb] p-4">
                    <p className="text-xs text-[#8b8494]">{label}</p>
                    <p className="mt-1 text-sm font-bold text-[#21142f]">{value}</p>
                  </div>
                ))}
              </div>
              {vehicle.rental_rates && vehicle.rental_rates.length > 0 && (
                <div className="rounded-xl border border-[#e5e1ed] p-4">
                  <h3 className="text-sm font-bold">Rental rates</h3>
                  <div className="mt-3 space-y-2">
                    {vehicle.rental_rates.map((rate) => (
                      <div key={`${rate.duration_hours}-${rate.amount}`} className="flex justify-between rounded-lg bg-[#faf9fc] px-3 py-2 text-sm">
                        <span className="font-semibold">{rate.duration_hours} hours</span>
                        <span>₱{Number(rate.amount).toLocaleString('en-PH')}{Number(rate.outside_amount || 0) > 0 ? ` + ₱${Number(rate.outside_amount).toLocaleString('en-PH')} outside coverage` : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <button type="button" onClick={() => { onSetMode('edit'); onEdit() }} className="w-full cursor-pointer rounded-lg bg-[#5b21b6] px-5 py-3 font-bold text-white hover:bg-[#4c1d95]">Edit vehicle</button>
            </div>
          )}

          {mode !== 'view' && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label><span className="mb-2 block text-sm font-semibold">Name <span className="font-normal text-[#8b8494]">(optional)</span></span><input name="name" defaultValue={vehicle?.name || ''} placeholder="Uses Brand Model Year if blank" className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3 outline-none focus:border-[#6d28d9]" /></label>
                <label><span className="mb-2 block text-sm font-semibold">Brand</span><input name="brand" required defaultValue={vehicle?.brand || ''} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3 outline-none focus:border-[#6d28d9]" /></label>
                <label><span className="mb-2 block text-sm font-semibold">Model</span><input name="model" required defaultValue={vehicle?.model || ''} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3 outline-none focus:border-[#6d28d9]" /></label>
                <label><span className="mb-2 block text-sm font-semibold">Year</span><input name="year" type="number" min="1900" max="2100" required defaultValue={vehicle?.year || new Date().getFullYear()} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3 outline-none focus:border-[#6d28d9]" /></label>
                <label><span className="mb-2 block text-sm font-semibold">Color</span><input name="color" defaultValue={vehicle?.color || ''} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3 outline-none focus:border-[#6d28d9]" /></label>
                <label><span className="mb-2 block text-sm font-semibold">Plate number</span><input name="plate_number" required defaultValue={vehicle?.plate_number || ''} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3 outline-none focus:border-[#6d28d9]" /></label>
                <label><span className="mb-2 block text-sm font-semibold">Seat count</span><input name="seat_count" type="number" min="1" max="99" required defaultValue={vehicle?.seat_count || 4} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3 outline-none focus:border-[#6d28d9]" /></label>
                <div><span className="mb-2 block text-sm font-semibold">Vehicle type</span><SearchableSelect name="type" value={vehicleType} required placeholder="Select vehicle type" options={['Sedan','Motorcycle','Motorcycle 400CC+','AUV','SUV','Crossover','MPV','Van','Pickup','Hatchback']} onChange={setVehicleType} /></div>
                <div><span className="mb-2 block text-sm font-semibold">Transmission</span><SearchableSelect name="transmission" value={transmission} required placeholder="Select transmission" options={['Automatic','Manual']} onChange={setTransmission} /></div>
                <div><span className="mb-2 block text-sm font-semibold">Fuel type</span><SearchableSelect name="fuel_type" value={fuelType} required placeholder="Select fuel type" options={['Unleaded 91','Premium 95','Premium 98','Diesel','EV']} onChange={setFuelType} /></div>
                <div><span className="mb-2 block text-sm font-semibold">Status</span><SearchableSelect name="status" value={vehicleStatus} placeholder="Select status" options={[{ value: 'available', label: 'Available' }, { value: 'rented', label: 'Rented' }, { value: 'maintenance', label: 'Maintenance' }]} onChange={setVehicleStatus} /></div>
                <div><span className="mb-2 block text-sm font-semibold">Partner <span className="font-normal text-[#8b8494]">(optional)</span></span><SearchableSelect name="partner_id" value={partnerId} placeholder="No partner" options={[{ value: '', label: 'No partner' }, ...partners.map((partner) => ({ value: String(partner.id), label: partnerName(partner), searchText: `${partner.name ?? ''} ${partner.first_name ?? ''} ${partner.middle_name ?? ''} ${partner.last_name ?? ''}` }))]} onChange={setPartnerId} /></div>
                <label><span className="mb-2 block text-sm font-semibold">Security deposit <span className="font-normal text-[#8b8494]">(optional)</span></span><input name="security_deposit" type="number" min="0" step="0.01" defaultValue={vehicle?.security_deposit || ''} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3 outline-none focus:border-[#6d28d9]" /></label>
                <label><span className="mb-2 block text-sm font-semibold">Carwash fee</span><input name="carwash_fee" type="number" min="0" step="0.01" required defaultValue={vehicle?.carwash_fee ?? 200} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3 outline-none focus:border-[#6d28d9]" /></label>
                <label><span className="mb-2 block text-sm font-semibold">Hourly extension rate</span><input name="hourly_extension_rate" type="number" min="0" step="0.01" defaultValue={vehicle?.hourly_extension_rate || ''} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3 outline-none focus:border-[#6d28d9]" /></label>
                <div className="grid gap-2 sm:grid-cols-[1fr_120px_1fr]">
                  <label><span className="mb-2 block text-sm font-semibold">Mileage limit (km)</span><input name="mileage_limit" type="number" min="0" defaultValue={vehicle?.mileage_limit || ''} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3 outline-none focus:border-[#6d28d9]" /></label>
                  <div><span className="mb-2 block text-sm font-semibold">Applies to</span><SearchableSelect name="mileage_limit_unit" value={mileageUnit} placeholder="Select period" options={[{ value: 'rental', label: 'Entire rental' }, { value: 'day', label: 'Per day' }]} onChange={(value) => setMileageUnit(value === 'day' ? 'day' : 'rental')} /></div>
                  <label><span className="mb-2 block text-sm font-semibold">Excess mileage rate / km</span><input name="excess_mileage_rate" type="number" min="0" step="0.01" defaultValue={vehicle?.excess_mileage_rate || ''} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3 outline-none focus:border-[#6d28d9]" /></label>
                </div>
              </div>

              <div className="rounded-xl border border-[#e5e1ed] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><h3 className="text-sm font-bold text-[#21142f]">Rental rates</h3><p className="mt-1 text-xs text-[#8b8494]">Enable the durations this vehicle supports.</p></div>
                  <div className="flex gap-2">
                    {[6,12,24].map((duration) => (
                      <label key={duration} className={`cursor-pointer rounded-lg border px-3 py-2 text-xs font-bold ${selectedDurations.includes(duration) ? 'border-[#5b21b6] bg-[#ede9fe] text-[#5b21b6]' : 'border-[#dcd8e6] text-[#686173]'}`}>
                        <input type="checkbox" className="sr-only" checked={selectedDurations.includes(duration)} onChange={() => onSetDurations((current) => current.includes(duration) ? current.filter((value) => value !== duration) : [...current, duration].sort((a, b) => a - b))} />
                        {duration} hours
                      </label>
                    ))}
                  </div>
                </div>
                {selectedDurations.length > 0 && <div className="mt-4 grid gap-3">{selectedDurations.map(renderDurationCoverage)}</div>}
              </div>

              <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
                <label><span className="mb-2 block text-sm font-semibold">Vehicle image</span><input name="image" type="file" accept="image/jpeg,image/png,image/webp" onChange={onImageChange} className="block w-full rounded-lg border border-[#dcd8e6] px-3 py-2.5 text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-[#ede9fe] file:px-3 file:py-2 file:font-bold file:text-[#5b21b6]" /></label>
                {imagePreview && <img src={imagePreview} alt="Vehicle preview" className="h-32 w-full rounded-lg object-contain" />}
              </div>
              <div>
                <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold"><input name="remove_background" type="checkbox" value="1" className="h-4 w-4 accent-[#5b21b6]" />Remove the image background with remove.bg</label>
                <p className="mt-2 text-xs text-[#8b8494]">If background removal keeps failing, visit <a href="https://www.remove.bg/" target="_blank" rel="noreferrer" className="font-bold text-[#5b21b6] underline">remove.bg</a> for account or API support.</p>
              </div>

              {formError && <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}
              <div className="sticky bottom-[-1.25rem] z-20 -mx-4 border-t border-[#eeeaf3] bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
                <button type="submit" disabled={submitting} className="w-full cursor-pointer rounded-lg bg-[#5b21b6] px-5 py-3 font-bold text-white shadow-[0_8px_20px_rgba(91,33,182,0.12)] transition hover:bg-[#4c1d95] disabled:cursor-not-allowed disabled:opacity-60">{submitting ? 'Saving...' : mode === 'edit' ? 'Save changes' : 'Save'}</button>
              </div>
            </div>
          )}
        </form>
      </motion.div>
    </motion.div>
  )
}
