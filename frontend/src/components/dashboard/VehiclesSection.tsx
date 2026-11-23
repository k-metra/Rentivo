import { motion, useReducedMotion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { DashboardIcon } from './DashboardIcon'

type VehicleRentalRate = {
  duration_hours: number
  amount: number | string
  outside_amount?: number | string
}

export type VehicleSectionItem = {
  id: number
  partner_id?: number | null
  partner?: { id: number; name: string; first_name?: string; middle_name?: string; last_name?: string }
  name?: string
  brand: string
  model: string
  year: number
  plate_number: string
  type: string
  daily_rate: number | string
  security_deposit?: number | string
  hourly_extension_rate?: number | string
  mileage_limit?: number
  mileage_limit_unit?: 'rental' | 'day'
  excess_mileage_rate?: number | string
  transmission?: string
  fuel_type?: string
  color?: string
  seat_count?: number
  status: string
  rental_rates?: VehicleRentalRate[]
  image_url?: string
  image_path?: string
}

type Props = {
  vehicles: VehicleSectionItem[]
  onCreate: () => void
  onView: (vehicle: VehicleSectionItem) => void
  onEdit: (vehicle: VehicleSectionItem) => void
  getVehicleImageUrl: (vehicle: VehicleSectionItem) => string
}

export function VehiclesSection({ vehicles, onCreate, onView, onEdit, getVehicleImageUrl }: Props) {
  const prefersReducedMotion = useReducedMotion()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const filtered = useMemo(() => vehicles.filter((vehicle) => {
    const searchable = `${vehicle.name ?? ''} ${vehicle.brand} ${vehicle.model} ${vehicle.year} ${vehicle.plate_number} ${vehicle.type} ${vehicle.color ?? ''}`.toLowerCase()
    return searchable.includes(search.toLowerCase()) && (statusFilter === 'all' || vehicle.status === statusFilter)
  }), [vehicles, search, statusFilter])

  const partnerName = (vehicle: VehicleSectionItem) =>
    vehicle.partner?.name || [vehicle.partner?.first_name, vehicle.partner?.middle_name, vehicle.partner?.last_name].filter(Boolean).join(' ') || 'No partner'

  return (
    <motion.section
      initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-[#2c0f73]/10 bg-white p-5 sm:p-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Vehicles</h2>
        <button type="button" onClick={onCreate} className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#5b21b6] px-4 py-3 text-sm font-bold text-white hover:bg-[#4c1d95]">
          <DashboardIcon name="plus" size={18} />Add vehicle
        </button>
      </div>
      <div className="mb-5 mt-5 flex flex-col gap-3 sm:flex-row">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, plate, brand, or model" className="w-full flex-1 rounded-lg border border-[#dcd8e6] px-3 py-2.5 text-sm outline-none focus:border-[#6d28d9]" />
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-3 py-2.5 text-sm">
          <option value="all">All statuses</option>
          <option value="available">Available</option>
          <option value="rented">Rented</option>
          <option value="maintenance">Maintenance</option>
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left">
          <thead><tr className="border-b border-[#eeeaf3] text-[11px] font-bold uppercase text-[#aaa4b4]"><th className="pb-3">Vehicle</th><th className="pb-3">Plate</th><th className="pb-3">Details</th><th className="pb-3">Rate</th><th className="pb-3">Status</th><th /></tr></thead>
          <tbody>
            {filtered.map((vehicle) => (
              <tr key={vehicle.id} className="border-b border-[#f3f1f6] last:border-0">
                <td className="py-4">
                  <button type="button" onClick={() => onView(vehicle)} className="flex cursor-pointer items-center gap-3 text-left">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#eeeaf3] bg-[#f7f6fb]">
                      {getVehicleImageUrl(vehicle) ? <img src={getVehicleImageUrl(vehicle)} alt="" className="h-full w-full object-cover" /> : <DashboardIcon name="car" size={20} />}
                    </span>
                    <span><p className="text-sm font-bold text-[#21142f] hover:text-[#5b21b6]">{vehicle.name || `${vehicle.brand} ${vehicle.model} ${vehicle.year}`}</p><p className="mt-0.5 text-xs text-[#8b8494]">{vehicle.brand} {vehicle.model} {vehicle.year}</p></span>
                  </button>
                </td>
                <td className="py-4 text-sm font-semibold">{vehicle.plate_number}</td>
                <td className="py-4 text-sm text-[#686173]"><span className="block">{vehicle.type}{vehicle.color ? ` · ${vehicle.color}` : ''}{vehicle.seat_count ? ` · ${vehicle.seat_count} seats` : ''}</span><span className="mt-1 block text-xs">Partner: {partnerName(vehicle)}</span></td>
                <td className="py-4 text-sm">
                  <div className="space-y-1">
                    {vehicle.rental_rates?.length ? vehicle.rental_rates.map((rate) => (
                      <p key={`${rate.duration_hours}-${rate.amount}`}>
                        <span className="font-bold">{rate.duration_hours}h:</span> ₱{Number(rate.amount).toLocaleString('en-PH')}
                        {Number(rate.outside_amount || 0) > 0 ? <span className="block text-[11px] text-[#8b8494]">+ ₱{Number(rate.outside_amount).toLocaleString('en-PH')} outside</span> : null}
                      </p>
                    )) : <span className="text-[#8b8494]">No rates set</span>}
                  </div>
                </td>
                <td className="py-4"><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${vehicle.status === 'available' ? 'bg-[#dcfce7] text-[#15803d]' : vehicle.status === 'rented' ? 'bg-[#ede9fe] text-[#6d28d9]' : 'bg-[#fef3c7] text-[#b45309]'}`}>{vehicle.status}</span></td>
                <td className="py-4 text-right"><button type="button" onClick={() => onEdit(vehicle)} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-3 py-2 text-xs font-bold text-[#5b21b6]">Edit</button></td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={6} className="py-10 text-center text-sm text-[#8b8494]">No vehicles match your filters.</td></tr>}
          </tbody>
        </table>
      </div>
    </motion.section>
  )
}
