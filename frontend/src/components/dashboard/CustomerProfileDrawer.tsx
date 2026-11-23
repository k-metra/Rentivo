import { motion } from 'framer-motion'

type Attachment = {
  id: number
  category: string
  file_path: string
  original_name: string
  url?: string
}

type Booking = {
  id: number
  reference: string
  pickup_at: string
  return_at: string
  payment_status: string
  rental_amount: number | string
  status: string
  total_amount: number | string
  vehicle?: { name?: string; brand: string; model: string; year?: number; plate_number: string }
}

type Customer = {
  id: number
  name: string
  email?: string
  phone?: string
  address?: string
  date_of_birth?: string
  referral_source?: string
  social_profile_url?: string
  license_number?: string
  license_expiry?: string
  identification_information?: string
  notes?: string
  archived_at?: string | null
  bookings_count?: number
  bookings?: Booking[]
  attachments?: Attachment[]
}

type Props = {
  customer: Customer
  storageBaseUrl: string
  prefersReducedMotion: boolean
  vehicleLabel: (vehicle: NonNullable<Booking['vehicle']>) => string
  bookingDateTime: (value: string) => string
  bookingStatusLabel: (status: string) => string
  onClose: () => void
  onEdit: (customer: Customer) => void
  onOpenBooking: (booking: Booking) => void
}

export function CustomerProfileDrawer(props: Props) {
  const customer = props.customer
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[65] bg-[#17141f]/40 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) props.onClose() }}>
      <motion.aside initial={props.prefersReducedMotion ? false : { x: '100%' }} animate={{ x: 0 }} exit={props.prefersReducedMotion ? undefined : { x: '100%' }} transition={{ duration: 0.28, ease: 'easeOut' }} className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col bg-white shadow-[-24px_0_60px_rgba(45,28,82,0.16)]" role="dialog" aria-modal="true" aria-label={`${customer.name} profile`}>
        <div className="flex shrink-0 items-start justify-between border-b border-[#eeeaf3] px-5 py-5 sm:px-7">
          <div className="flex items-center gap-4"><div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#ede9fe] text-lg font-bold text-[#6d28d9]">{customer.name.slice(0, 1).toUpperCase()}</div><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#5b21b6]">Customer profile</p><h2 className="mt-1 text-2xl font-semibold text-[#21142f]">{customer.name}</h2></div></div>
          <button type="button" onClick={props.onClose} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-2xl text-[#8b8494] hover:bg-[#f7f6fb]" aria-label="Close customer profile">×</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2"><span className={`rounded-full px-3 py-1.5 text-xs font-bold ${customer.archived_at ? 'bg-[#f3f4f6] text-[#686173]' : 'bg-[#dcfce7] text-[#15803d]'}`}>{customer.archived_at ? 'Archived' : 'Active customer'}</span><span className="rounded-full bg-[#ede9fe] px-3 py-1.5 text-xs font-bold text-[#6d28d9]">{customer.bookings_count ?? customer.bookings?.length ?? 0} bookings</span></div>
            <button type="button" onClick={() => props.onEdit(customer)} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-4 py-2.5 text-sm font-bold text-[#5b21b6] hover:bg-[#f7f6fb]">Edit customer</button>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[['Email', customer.email ?? '—'], ['Phone', customer.phone ?? '—'], ['Date of birth', customer.date_of_birth ? new Date(customer.date_of_birth).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'], ['Referral source', customer.referral_source ? customer.referral_source.replaceAll('_', ' ') : '—'], ['Address', customer.address ?? '—'], ['Social profile', customer.social_profile_url ?? '—']].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-[#f7f6fb] p-4"><p className="text-xs font-semibold text-[#8b8494]">{label}</p>{label === 'Social profile' && customer.social_profile_url ? <a href={customer.social_profile_url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-sm font-bold text-[#5b21b6] underline">{value}</a> : <p className="mt-1 whitespace-pre-wrap text-sm font-bold text-[#21142f]">{value}</p>}</div>
            ))}
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[['License number', customer.license_number ?? '—'], ['License expiry', customer.license_expiry ? new Date(customer.license_expiry).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—']].map(([label, value]) => <div key={label} className="rounded-xl border border-[#e5e1ed] p-4"><p className="text-xs text-[#8b8494]">{label}</p><p className="mt-1 text-sm font-bold">{value}</p></div>)}
            {customer.identification_information && <div className="rounded-xl border border-[#e5e1ed] p-4 sm:col-span-2"><p className="text-xs text-[#8b8494]">Identification information</p><p className="mt-2 whitespace-pre-wrap text-sm">{customer.identification_information}</p></div>}
            {customer.notes && <div className="rounded-xl border border-[#e5e1ed] p-4 sm:col-span-2"><p className="text-xs text-[#8b8494]">Notes</p><p className="mt-2 whitespace-pre-wrap text-sm">{customer.notes}</p></div>}
          </div>
          <div className="mt-6"><h3 className="font-bold text-[#21142f]">Requirements</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">
            {[['license', "Driver's License"], ['ltms', 'LTMS Portal Screenshots'], ['proof_of_billing', 'Proof of Billing'], ['secondary_id', 'Secondary ID'], ['selfie_license', "Selfie with Driver's License"]].map(([category, label]) => {
              const attachments = (customer.attachments ?? []).filter((attachment) => attachment.category === category)
              return <div key={category} className="rounded-xl border border-[#e5e1ed] p-4"><p className="text-sm font-bold">{label}</p>{attachments.length ? <div className="mt-3 space-y-2">{attachments.map((attachment) => <a key={attachment.id} href={attachment.url ?? `${props.storageBaseUrl}/storage/${attachment.file_path}`} target="_blank" rel="noreferrer" className="flex cursor-pointer items-center justify-between rounded-lg bg-[#f7f6fb] px-3 py-2 text-xs font-semibold text-[#5b21b6] hover:bg-[#ede9fe]"><span className="max-w-[220px] truncate">{attachment.original_name}</span><span>View</span></a>)}</div> : <p className="mt-2 text-xs text-[#8b8494]">Not attached</p>}</div>
            })}
          </div></div>
          <div className="mt-6"><h3 className="font-bold text-[#21142f]">Booking history</h3><div className="mt-3 space-y-3">
            {(customer.bookings ?? []).length ? (customer.bookings ?? []).map((booking) => <button type="button" key={booking.id} onClick={() => props.onOpenBooking(booking)} className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-[#e5e1ed] p-4 text-left transition hover:border-[#c4b5fd] hover:bg-[#faf9fc]"><div className="min-w-0"><p className="text-sm font-bold text-[#21142f]">{booking.reference}</p><p className="mt-1 text-xs text-[#686173]">{booking.vehicle ? props.vehicleLabel(booking.vehicle) : 'Vehicle unavailable'} · {props.bookingDateTime(booking.pickup_at)}</p></div><div className="shrink-0 text-right"><span className="rounded-full bg-[#ede9fe] px-2.5 py-1 text-[10px] font-bold text-[#6d28d9]">{props.bookingStatusLabel(booking.status)}</span><p className="mt-2 text-sm font-bold">₱{Number(booking.total_amount).toLocaleString('en-PH')}</p></div></button>) : <div className="rounded-xl border border-dashed border-[#dcd8e6] px-5 py-10 text-center text-sm text-[#8b8494]">No booking history.</div>}
          </div></div>
        </div>
      </motion.aside>
    </motion.div>
  )
}
