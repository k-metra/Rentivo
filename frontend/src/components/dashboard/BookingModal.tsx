import { motion, useReducedMotion } from 'framer-motion'
import type { FormEvent, ReactNode, RefObject } from 'react'
import SearchableSelect from '../SearchableSelect'
import { DashboardIcon } from './DashboardIcon'

export type BookingModalCustomer = {
  id: number
  name: string
  email?: string
  phone?: string
}

export type BookingModalVehicle = {
  id: number
  name?: string
  brand: string
  model: string
  year: number
  plate_number: string
  type: string
  color?: string
  seat_count?: number
  daily_rate: number | string
  hourly_extension_rate?: number | string
  image_path?: string
  image_url?: string
  rental_rates?: Array<{
    duration_hours: number
    amount: number | string
    outside_amount?: number | string
    coverage_type?: string
    coverage_locations?: string[]
  }>
}

export type BookingFeeSummary = {
  rental: number
  outsideCharge: number
  additional: number
  total: number
  durationLabel: string
  breakdown?: Array<{ label: string; amount: number }>
}

type Props = {
  editing: boolean
  submitting: boolean
  formError: string
  formRef: RefObject<HTMLFormElement | null>
  customers: BookingModalCustomer[]
  vehicles: BookingModalVehicle[]
  provinces: string[]
  citiesByProvince: Record<string, string[]>
  selectedCustomerId: string
  selectedVehicleId: string
  quickAddOpen: boolean
  quickCustomer: { name: string; email: string; phone: string }
  calendarMonth: Date
  rangeStart: Date | null
  rangeEnd: Date | null
  pickupTime: string
  returnTime: string
  destinationProvince: string
  destinationCity: string
  customRentalRateEnabled: boolean
  customRentalRate: string
  additionalCharges: string
  remarks: string
  prefersReducedMotion: boolean
  getVehicleImageUrl: (vehicle: BookingModalVehicle) => string
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onCustomerChange: (value: string) => void
  onVehicleChange: (value: string) => void
  onQuickAddOpenChange: (value: boolean | ((current: boolean) => boolean)) => void
  onQuickCustomerChange: (value: { name: string; email: string; phone: string } | ((current: { name: string; email: string; phone: string }) => { name: string; email: string; phone: string })) => void
  onQuickAdd: () => void
  onCalendarMonthChange: (month: Date) => void
  onDateClick: (date: Date) => void
  onPickupTimeChange: (value: string) => void
  onReturnTimeChange: (value: string) => void
  onDestinationProvinceChange: (value: string) => void
  onDestinationCityChange: (value: string) => void
  onCustomRentalRateEnabledChange: (value: boolean) => void
  onCustomRentalRateChange: (value: string) => void
  onAdditionalChargesChange: (value: string) => void
  onRemarksChange: (value: string) => void
}

export function calculateBookingFeeSummary(
  vehicle: BookingModalVehicle | undefined,
  pickupAt: Date | null,
  returnAt: Date | null,
  pickupTime: string,
  returnTime: string,
  destinationProvince: string,
  customRentalRateEnabled: boolean,
  customRentalRate: string,
  additionalCharges: string,
): BookingFeeSummary {
  if (!vehicle || !pickupAt || !returnAt) {
    const additional = Number(additionalCharges || 0)
    return { rental: 0, outsideCharge: 0, additional, total: additional, durationLabel: '' }
  }
  const pickup = new Date(pickupAt)
  const returnDate = new Date(returnAt)
  const [pickupHour, pickupMinute] = pickupTime.split(':').map(Number)
  const [returnHour, returnMinute] = returnTime.split(':').map(Number)
  pickup.setHours(pickupHour || 0, pickupMinute || 0, 0, 0)
  returnDate.setHours(returnHour || 0, returnMinute || 0, 0, 0)
  const durationHours = Math.max(1, Math.ceil((returnDate.getTime() - pickup.getTime()) / 3600000))
  const rates = vehicle.rental_rates ?? []
  const twelve = rates.find((rate) => rate.duration_hours === 12)
  const twentyFour = rates.find((rate) => rate.duration_hours === 24)

  const amountWithCoverage = (rate?: typeof rates[number]) => {
    if (!rate) return { base: 0, outside: 0 }
    let outside = 0
    if (rate.coverage_type === 'province' && destinationProvince && !(rate.coverage_locations ?? []).includes(destinationProvince)) {
      outside = Number(rate.outside_amount ?? 0)
    }
    return { base: Number(rate.amount), outside }
  }

  let rental = 0
  let outsideCharge = 0
  const breakdown: Array<{ label: string; amount: number }> = []
  if (customRentalRateEnabled) {
    rental = Number(customRentalRate || 0)
    breakdown.push({ label: 'Custom rental rate', amount: rental })
  } else if (durationHours <= 12) {
    const amount = amountWithCoverage(twelve)
    rental = amount.base || Number(twentyFour?.amount ?? vehicle.daily_rate ?? 0) / 2
    outsideCharge = amount.outside
    breakdown.push({ label: '12-hour rental rate', amount: rental })
  } else if (durationHours <= 24) {
    const amount = amountWithCoverage(twentyFour)
    rental = amount.base || Number(vehicle.daily_rate ?? 0)
    outsideCharge = amount.outside
    breakdown.push({ label: '24-hour rental rate', amount: rental })
  } else {
    const fullDays = Math.floor(durationHours / 24)
    const remainder = durationHours % 24
    const daily = amountWithCoverage(twentyFour)
    const dailyBase = daily.base || Number(vehicle.daily_rate ?? 0)
    rental = fullDays * dailyBase
    outsideCharge = fullDays * daily.outside
    if (fullDays > 0) breakdown.push({ label: `${fullDays} × 24-hour rate`, amount: fullDays * dailyBase })
    if (remainder > 0) {
      if (remainder === 12) {
        const twelveAmount = amountWithCoverage(twelve)
        const remainderAmount = twelveAmount.base || dailyBase / 2
        rental += remainderAmount
        outsideCharge += twelveAmount.outside
        breakdown.push({ label: '1 × 12-hour remainder', amount: remainderAmount })
      } else if (remainder < 12) {
        const hourlyAmount = remainder * Number(vehicle.hourly_extension_rate ?? 0)
        rental += hourlyAmount
        breakdown.push({ label: `${remainder} × hourly extension`, amount: hourlyAmount })
      } else {
        const twelveAmount = amountWithCoverage(twelve)
        const twelveRemainderAmount = twelveAmount.base || dailyBase / 2
        rental += twelveRemainderAmount
        outsideCharge += twelveAmount.outside
        breakdown.push({ label: '1 × 12-hour remainder', amount: twelveRemainderAmount })
        const extraHours = remainder - 12
        const hourlyAmount = extraHours * Number(vehicle.hourly_extension_rate ?? 0)
        rental += hourlyAmount
        breakdown.push({ label: `${extraHours} × hourly extension`, amount: hourlyAmount })
      }
    }
  }

  const additional = Number(additionalCharges || 0)
  const fullDays = Math.floor(durationHours / 24)
  const remainingHours = durationHours % 24
  const durationParts: string[] = []
  if (fullDays > 0) durationParts.push(`${fullDays} ${fullDays === 1 ? 'day' : 'days'}`)
  if (remainingHours > 0) durationParts.push(`${remainingHours} ${remainingHours === 1 ? 'hour' : 'hours'}`)
  return {
    rental,
    outsideCharge,
    additional,
    total: rental + outsideCharge + additional,
    durationLabel: durationParts.join(' ') || '0 hours',
    breakdown,
  }
}

export function BookingModal(props: Props) {
  const prefersReducedMotion = useReducedMotion() || props.prefersReducedMotion
  const dateKey = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  const vehicle = props.vehicles.find((item) => String(item.id) === props.selectedVehicleId)
  const summary = calculateBookingFeeSummary(
    vehicle,
    props.rangeStart,
    props.rangeEnd,
    props.pickupTime,
    props.returnTime,
    props.destinationProvince,
    props.customRentalRateEnabled,
    props.customRentalRate,
    props.additionalCharges,
  )

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#17141f]/55 p-2 sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) props.onClose()
      }}
    >
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.98 }}
        className="flex max-h-[calc(100dvh-1rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)]"
        role="dialog"
        aria-modal="true"
        aria-label={props.editing ? 'Edit booking' : 'New booking'}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#eeeaf3] px-4 py-4 sm:px-6">
          <h2 className="text-lg font-bold sm:text-xl">{props.editing ? 'Edit booking' : 'New booking'}</h2>
          <button type="button" onClick={props.onClose} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-2xl text-[#8b8494] hover:bg-[#f7f6fb]" aria-label="Close">×</button>
        </div>
        <form ref={props.formRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5 sm:px-6" onSubmit={props.onSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold">Customer</span>
                <button type="button" onClick={() => props.onQuickAddOpenChange((current) => !current)} className="cursor-pointer text-xs font-bold text-[#5b21b6] hover:underline">+ Quick add customer</button>
              </div>
              <SearchableSelect
                name="customer_id"
                value={props.selectedCustomerId}
                required
                placeholder="Search and select a customer"
                options={props.customers.map((customer) => ({ value: String(customer.id), label: customer.name, searchText: `${customer.email ?? ''} ${customer.phone ?? ''}` }))}
                renderValue={(option) => {
                  const customer = props.customers.find((item) => String(item.id) === option.value)
                  return <span><strong>{option.label}</strong>{customer?.phone ? <small className="ml-2 text-[#8b8494]">{customer.phone}</small> : null}</span>
                }}
                renderOption={(option) => {
                  const customer = props.customers.find((item) => String(item.id) === option.value)
                  return <span className="flex min-w-0 flex-col"><strong>{option.label}</strong><small className="truncate text-[#8b8494]">{customer?.email || customer?.phone || 'Customer'}</small></span>
                }}
                onChange={props.onCustomerChange}
              />
              {props.quickAddOpen && (
                <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-xl border border-[#e5e1ed] bg-[#faf9fc] p-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <input value={props.quickCustomer.name} onChange={(event) => props.onQuickCustomerChange((current) => ({ ...current, name: event.target.value }))} placeholder="Full name" className="rounded-lg border border-[#dcd8e6] px-3 py-2.5 text-sm" />
                    <input value={props.quickCustomer.email} onChange={(event) => props.onQuickCustomerChange((current) => ({ ...current, email: event.target.value }))} placeholder="Email (optional)" type="email" className="rounded-lg border border-[#dcd8e6] px-3 py-2.5 text-sm" />
                    <input value={props.quickCustomer.phone} onChange={(event) => props.onQuickCustomerChange((current) => ({ ...current, phone: event.target.value }))} placeholder="Phone (optional)" className="rounded-lg border border-[#dcd8e6] px-3 py-2.5 text-sm" />
                  </div>
                  <button type="button" onClick={props.onQuickAdd} disabled={props.submitting} className="mt-3 cursor-pointer rounded-lg bg-[#5b21b6] px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">{props.submitting ? 'Adding...' : 'Add and select customer'}</button>
                </motion.div>
              )}
            </div>

            <div>
              <span className="mb-2 block text-sm font-semibold">Vehicle</span>
              <SearchableSelect
                name="vehicle_id"
                value={props.selectedVehicleId}
                required
                placeholder="Search and select a vehicle"
                options={props.vehicles.map((vehicle) => ({ value: String(vehicle.id), label: `${vehicle.brand} ${vehicle.model} ${vehicle.year}`, searchText: `${vehicle.name ?? ''} ${vehicle.plate_number} ${vehicle.type} ${vehicle.color ?? ''}` }))}
                renderValue={(option) => {
                  const vehicle = props.vehicles.find((item) => String(item.id) === option.value)
                  return <span className="flex items-center gap-2"><span className="flex h-8 w-10 items-center justify-center overflow-hidden rounded-md bg-[#f7f6fb]">{vehicle && props.getVehicleImageUrl(vehicle) ? <img src={props.getVehicleImageUrl(vehicle)} alt="" className="h-full w-full object-cover" /> : <DashboardIcon name="car" size={16} />}</span><strong>{option.label}</strong></span>
                }}
                renderOption={(option) => {
                  const vehicle = props.vehicles.find((item) => String(item.id) === option.value)
                  return <span className="flex items-center gap-3"><span className="flex h-10 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[#eeeaf3] bg-[#f7f6fb]">{vehicle && props.getVehicleImageUrl(vehicle) ? <img src={props.getVehicleImageUrl(vehicle)} alt="" className="h-full w-full object-cover" /> : <DashboardIcon name="car" size={18} />}</span><span className="flex min-w-0 flex-col"><strong>{option.label}</strong><small className="text-[#8b8494]">{vehicle?.plate_number} · {vehicle?.type}{vehicle?.seat_count ? ` · ${vehicle.seat_count} seats` : ''}</small></span></span>
                }}
                onChange={props.onVehicleChange}
              />
            </div>

            <div className="rounded-xl border border-[#e5e1ed] p-4 md:col-span-2">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div><span className="block text-sm font-semibold">Rental date & time</span><p className="mt-1 text-xs text-[#8b8494]">Click a start date, then an end date. Click again to reset.</p></div>
                <div className="flex items-center justify-between gap-1 sm:justify-end">
                  <button type="button" onClick={() => props.onCalendarMonthChange(new Date(props.calendarMonth.getFullYear(), props.calendarMonth.getMonth() - 1, 1))} className="cursor-pointer rounded px-2 py-1 text-lg">‹</button>
                  <span className="px-2 text-xs font-bold">{props.calendarMonth.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}</span>
                  <button type="button" onClick={() => props.onCalendarMonthChange(new Date(props.calendarMonth.getFullYear(), props.calendarMonth.getMonth() + 1, 1))} className="cursor-pointer rounded px-2 py-1 text-lg">›</button>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-7 gap-1">
                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((day) => <span key={day} className="py-1 text-center text-[10px] font-bold uppercase text-[#aaa4b4]">{day}</span>)}
                {(() => {
                  const start = new Date(props.calendarMonth.getFullYear(), props.calendarMonth.getMonth(), 1)
                  const end = new Date(props.calendarMonth.getFullYear(), props.calendarMonth.getMonth() + 1, 0)
                  const cells: ReactNode[] = []
                  for (let index = 0; index < start.getDay(); index += 1) cells.push(<span key={`blank-${index}`} />)
                  for (let day = 1; day <= end.getDate(); day += 1) {
                    const date = new Date(props.calendarMonth.getFullYear(), props.calendarMonth.getMonth(), day)
                    const selectedStart = props.rangeStart && dateKey(date) === dateKey(props.rangeStart)
                    const selectedEnd = props.rangeEnd && dateKey(date) === dateKey(props.rangeEnd)
                    const inRange = props.rangeStart && props.rangeEnd && date > props.rangeStart && date < props.rangeEnd
                    cells.push(<button type="button" key={day} onClick={() => props.onDateClick(date)} className={`cursor-pointer rounded-lg py-2 text-xs font-semibold transition ${selectedStart || selectedEnd ? 'bg-[#5b21b6] text-white' : inRange ? 'bg-[#ede9fe] text-[#5b21b6]' : 'text-[#686173] hover:bg-[#f7f6fb]'}`}>{day}</button>)
                  }
                  return cells
                })()}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label><span className="mb-1 block text-xs font-semibold text-[#686173]">Pickup time</span><input type="time" value={props.pickupTime} onChange={(event) => props.onPickupTimeChange(event.target.value)} className="w-full rounded-lg border border-[#dcd8e6] px-3 py-2.5 text-sm" /></label>
                <label><span className="mb-1 block text-xs font-semibold text-[#686173]">Return time</span><input type="time" value={props.returnTime} onChange={(event) => props.onReturnTimeChange(event.target.value)} className="w-full rounded-lg border border-[#dcd8e6] px-3 py-2.5 text-sm" /></label>
              </div>
              <input type="hidden" name="pickup_at" value={props.rangeStart ? `${dateKey(props.rangeStart)}T${props.pickupTime}` : ''} />
              <input type="hidden" name="return_at" value={(props.rangeEnd ?? props.rangeStart) ? `${dateKey((props.rangeEnd ?? props.rangeStart) as Date)}T${props.returnTime}` : ''} />
              {(!props.rangeStart || !props.rangeEnd) && <p className="mt-3 text-xs font-semibold text-amber-700">Select {props.rangeStart ? 'an end date' : 'a start and end date'}.</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 md:col-span-2">
              <label><span className="mb-2 block text-sm font-semibold">Destination province <span className="font-normal text-[#8b8494]">(optional)</span></span><SearchableSelect name="destination_province" value={props.destinationProvince} placeholder="Select province" options={props.provinces} onChange={props.onDestinationProvinceChange} /></label>
              <label><span className="mb-2 block text-sm font-semibold">Destination city <span className="font-normal text-[#8b8494]">(optional)</span></span><SearchableSelect name="destination_city" value={props.destinationCity} placeholder={props.destinationProvince ? 'Select city' : 'Select province first'} disabled={!props.destinationProvince} options={props.destinationProvince ? (props.citiesByProvince[props.destinationProvince] ?? []) : []} onChange={props.onDestinationCityChange} /></label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 md:col-span-2">
              <div>
                <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={props.customRentalRateEnabled} onChange={(event) => { props.onCustomRentalRateEnabledChange(event.target.checked); if (event.target.checked && !props.customRentalRate) props.onCustomRentalRateChange('0') }} className="h-4 w-4 accent-[#5b21b6]" />Set a custom rental rate</label>
                {props.customRentalRateEnabled && <input name="rental_amount" type="number" min="0" step="0.01" value={props.customRentalRate} onChange={(event) => props.onCustomRentalRateChange(event.target.value)} required className="mt-3 w-full rounded-lg border border-[#dcd8e6] px-4 py-3" placeholder="Custom amount" />}
                {!props.customRentalRateEnabled && <input type="hidden" name="rental_amount" value="0" />}
              </div>
              <label><span className="mb-2 block text-sm font-semibold">Additional charges</span><input name="additional_charges" type="number" min="0" step="0.01" value={props.additionalCharges} onChange={(event) => props.onAdditionalChargesChange(event.target.value)} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label>
            </div>

            <div className="md:col-span-2 rounded-xl border border-[#e5e1ed] bg-[#faf9fc] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-bold text-[#21142f]">Booking fee summary</h4>{summary.durationLabel && <span className="rounded-full bg-[#ede9fe] px-2.5 py-1 text-[10px] font-bold text-[#6d28d9]">{summary.durationLabel}</span>}</div>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div className="sm:col-span-2 rounded-lg border border-[#eeeaf3] bg-white p-3">
                  <div className="flex justify-between gap-3"><span className="font-semibold text-[#40384b]">Rental amount</span><strong>₱{summary.rental.toLocaleString('en-PH')}</strong></div>
                  <div className="mt-2 space-y-1.5">{(summary.breakdown ?? []).map((item) => <div key={item.label} className="flex justify-between gap-3 text-xs"><span className="text-[#686173]">{item.label}</span><span className="font-semibold">₱{item.amount.toLocaleString('en-PH')}</span></div>)}</div>
                </div>
                {summary.outsideCharge > 0 && <div className="flex justify-between gap-3"><span className="text-[#686173]">Outside-area charge</span><strong className="text-[#b45309]">₱{summary.outsideCharge.toLocaleString('en-PH')}</strong></div>}
                <div className="flex justify-between gap-3"><span className="text-[#686173]">Additional charges</span><strong>₱{summary.additional.toLocaleString('en-PH')}</strong></div>
                <div className="flex justify-between gap-3 border-t border-[#e5e1ed] pt-2 sm:border-t-0 sm:border-l sm:pl-4"><span className="font-semibold text-[#40384b]">Estimated total</span><strong className="text-lg text-[#5b21b6]">₱{summary.total.toLocaleString('en-PH')}</strong></div>
              </div>
            </div>

            <label className="block md:col-span-2"><span className="mb-2 block text-sm font-semibold">Optional remarks</span><textarea name="remarks" rows={2} value={props.remarks} onChange={(event) => props.onRemarksChange(event.target.value)} className="w-full resize-y rounded-lg border border-[#dcd8e6] px-4 py-3" placeholder="Pickup instructions, customer notes, or special requests..." /></label>
          </div>

          {props.formError && <p className="sticky bottom-20 z-10 mt-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{props.formError}</p>}
          <div className="sticky bottom-[-1.25rem] z-20 mt-4 -mx-4 border-t border-[#eeeaf3] bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
            <button type="submit" disabled={props.submitting} className="w-full cursor-pointer rounded-lg bg-[#5b21b6] px-5 py-3 font-bold text-white shadow-[0_8px_20px_rgba(91,33,182,0.12)] transition hover:bg-[#4c1d95] disabled:cursor-not-allowed disabled:opacity-60">{props.submitting ? 'Saving...' : props.editing ? 'Save changes' : 'Save'}</button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
