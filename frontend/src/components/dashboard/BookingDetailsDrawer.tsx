import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { SignaturePad } from './SignaturePad'
import {
  bookingDateTime,
  bookingStatusLabel,
  rentalDurationLabel,
  vehicleBookingLabel,
} from './dashboardUtils'

const inspectionFunctionLabels = [
  'Lights',
  'Doors & Locks',
  'Wipers & Washer',
  'Airconditioner',
  'Handbrake/Parkbrake',
  'Windows/Sunroof',
  'Radio/Infotainment',
  'Horn',
  'Dashcam/Recording',
  'Fuel Cap/Door',
] as const

type BookingDetailTab = 'details' | 'extensions' | 'customer' | 'payments' | 'pre-inspection' | 'post-inspection' | 'contract'

type BookingCustomer = {
  id?: number
  name: string
  email?: string
  phone?: string
  address?: string
  identification_information?: string
}
type BookingVehicle = {
  id?: number
  name?: string
  brand: string
  model: string
  year?: number
  plate_number: string
  type?: string
  image_path?: string
  image_url?: string
  color?: string
  daily_rate?: number | string
  hourly_extension_rate?: number | string
  carwash_fee?: number | string
  fuel_type?: string
  security_deposit?: number | string
  rental_rates?: Array<{ duration_hours: number; amount: number | string; outside_amount?: number | string }>
}
type BookingPayment = {
  id: number
  amount: number | string
  method: string
  status: string
  paid_at?: string | null
  notes?: string
  creator?: { name: string }
}
type BookingExtension = {
  id: number
  previous_return_at: string
  new_return_at: string
  fee: number | string
  pricing_mode: string
  notes?: string
  undone_at?: string | null
  creator?: { name: string }
}
type InspectionMedia = {
  id: number
  section: string
  media_type: string
  url?: string
  original_name: string
  label?: string
  condition?: string
}
type BookingInspection = {
  id: number
  fuel_level: number
  odometer_reading: number
  easytrip_balance: number | string
  autosweep_balance: number | string
  functions: Record<string, boolean>
  tires: Record<string, string>
  signature_data?: string
  signer_name?: string
  status: string
  completed_at?: string
  actual_release_at?: string
  media?: InspectionMedia[]
}
type BookingPostInspection = BookingInspection & {
  actual_return_at?: string
  fuel_charge?: number | string
  rfid_charge?: number | string
  rfid_refund_credit?: number | string
  distance_traveled?: number
  allowed_mileage?: number
  excess_mileage?: number
  excess_mileage_charge?: number | string
}
type BookingDrawerBooking = {
  id: number
  reference: string
  pickup_at: string
  return_at: string
  status: string
  payment_status: string
  rental_amount: number | string
  daily_rate?: number | string
  additional_charges?: number | string
  total_amount: number | string
  destination_city?: string
  destination_province?: string
  remarks?: string
  payments?: BookingPayment[]
  extensions?: BookingExtension[]
  customer?: BookingCustomer
  vehicle?: BookingVehicle
}
type Confirmation = {
  title: string
  description: string
  confirmLabel: string
  tone: 'danger' | 'primary'
  action: () => void | Promise<void>
}

type Props = {
  selectedBooking: BookingDrawerBooking | null
  bookingDetailTab: BookingDetailTab
  setBookingDetailTab: (tab: BookingDetailTab) => void
  prefersReducedMotion: boolean | null
  onCloseBooking: () => void
  onOpenCustomers: () => void
  openBookingEdit: () => void
  openExtensionModal: () => void
  openPaymentModal: () => void
  deleteBookingPayment: (payment: BookingPayment) => void
  undoBookingExtension: () => void | Promise<void>
  setConfirmation: (confirmation: Confirmation | null) => void
  submitting: boolean
  formError: string
  inspection: BookingInspection | null
  inspectionFuel: number
  setInspectionFuel: (value: number) => void
  inspectionOdometer: string
  setInspectionOdometer: (value: string) => void
  inspectionEasytrip: string
  setInspectionEasytrip: (value: string) => void
  inspectionAutosweep: string
  setInspectionAutosweep: (value: string) => void
  inspectionFunctions: Record<string, boolean>
  setInspectionFunctions: Dispatch<SetStateAction<Record<string, boolean>>>
  inspectionTires: Record<string, string>
  setInspectionTires: Dispatch<SetStateAction<Record<string, string>>>
  inspectionSigner: string
  setInspectionSigner: (value: string) => void
  inspectionReleaseAt: string
  setInspectionReleaseAt: (value: string) => void
  exteriorFiles: File[]
  setExteriorFiles: Dispatch<SetStateAction<File[]>>
  interiorFiles: File[]
  setInteriorFiles: Dispatch<SetStateAction<File[]>>
  inspectionMediaLabels: Record<string, string>
  setInspectionMediaLabels: Dispatch<SetStateAction<Record<string, string>>>
  inspectionMediaConditions: Record<string, string>
  setInspectionMediaConditions: Dispatch<SetStateAction<Record<string, string>>>
  inspectionSignatureData: string
  setInspectionSignatureData: (value: string) => void
  saveBookingInspection: (complete: boolean) => void | Promise<void>
  postInspection: BookingPostInspection | null
  postInspectionFuel: number
  setPostInspectionFuel: (value: number) => void
  postInspectionOdometer: string
  setPostInspectionOdometer: (value: string) => void
  postInspectionEasytrip: string
  setPostInspectionEasytrip: (value: string) => void
  postInspectionAutosweep: string
  setPostInspectionAutosweep: (value: string) => void
  postInspectionFunctions: Record<string, boolean>
  setPostInspectionFunctions: Dispatch<SetStateAction<Record<string, boolean>>>
  postInspectionTires: Record<string, string>
  setPostInspectionTires: Dispatch<SetStateAction<Record<string, string>>>
  postInspectionSigner: string
  setPostInspectionSigner: (value: string) => void
  postInspectionActualReturnAt: string
  setPostInspectionActualReturnAt: (value: string) => void
  postExteriorFiles: File[]
  setPostExteriorFiles: Dispatch<SetStateAction<File[]>>
  postInteriorFiles: File[]
  setPostInteriorFiles: Dispatch<SetStateAction<File[]>>
  postInspectionSignatureData: string
  setPostInspectionSignatureData: (value: string) => void
  postMediaLabels: Record<string, string>
  setPostMediaLabels: Dispatch<SetStateAction<Record<string, string>>>
  postMediaConditions: Record<string, string>
  setPostMediaConditions: Dispatch<SetStateAction<Record<string, string>>>
  saveBookingPostInspection: (complete: boolean) => void | Promise<void>
}

function bookingPaidAmount(booking: BookingDrawerBooking) {
  return (booking.payments ?? [])
    .filter((payment) => payment.status === 'paid')
    .reduce((sum, payment) => sum + Number(payment.amount), 0)
}

function bookingBalance(booking: BookingDrawerBooking) {
  return Math.max(0, Number(booking.total_amount) - bookingPaidAmount(booking))
}

function formatContractMoney(value: number) {
  return `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function rentalDays(start: string, end: string) {
  const startDate = new Date(start)
  const endDate = new Date(end)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return '0'
  return String(Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000)))
}

const stripContractImages = (html: string) =>
  html
    .replace(/<picture\b[^>]*>[\s\S]*?<\/picture>/gi, '')
    .replace(/<img\b[^>]*\/?>/gi, '')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, '')

function resolvedContractHtml(template: string, booking: BookingDrawerBooking, inspection?: BookingInspection | null) {
  const paid = bookingPaidAmount(booking)
  const total = Number(booking.total_amount)
  const extensions = booking.extensions ?? []
  const extensionHours = extensions
    .filter((extension) => !extension.undone_at)
    .reduce((sum, extension) => sum + Math.max(0, Math.round((new Date(extension.new_return_at).getTime() - new Date(extension.previous_return_at).getTime()) / 3600000)), 0)
  const extensionFee = extensions
    .filter((extension) => !extension.undone_at)
    .reduce((sum, extension) => sum + Number(extension.fee), 0)
  const vehicle = booking.vehicle as (BookingVehicle & { carwash_fee?: number | string; daily_rate?: number | string }) | undefined
  const resolvedDailyRate = Number(booking.daily_rate ?? 0)
  const values: Record<string, string> = {
    date_today: bookingDateTime(new Date().toISOString()),
    date_created: bookingDateTime((booking as BookingDrawerBooking & { created_at?: string }).created_at),
    booking_remarks: booking.remarks || '—',
    renter_name: booking.customer?.name || '—',
    renter_address: (booking.customer as BookingCustomer & { address?: string }).address || '—',
    renter_contact_number: (booking.customer as BookingCustomer & { phone?: string }).phone || '—',
    renter_email_address: (booking.customer as BookingCustomer & { email?: string }).email || '—',
    rental_start_date_time: bookingDateTime(booking.pickup_at),
    rental_end_date_time: bookingDateTime(booking.return_at),
    destination: [booking.destination_city, booking.destination_province].filter(Boolean).join(', ') || '—',
    vehicle_brand: vehicle?.brand || '—',
    vehicle_name: vehicle?.name || '—',
    vehicle_model: vehicle?.model || '—',
    vehicle_plate_number: vehicle?.plate_number || '—',
    vehicle_color: vehicle?.color || '—',
    vehicle_year: vehicle?.year ? String(vehicle.year) : '—',
    vehicle_fuel_type: vehicle?.fuel_type || '—',
    rental_daily_rate: formatContractMoney(resolvedDailyRate),
    rental_days_rented: rentalDays(booking.pickup_at, booking.return_at),
    rental_extend_hours: String(extensionHours),
    rental_hourly_extension_fee: formatContractMoney(Number(vehicle?.hourly_extension_rate ?? extensionFee)),
    total_rent_due: formatContractMoney(total),
    security_deposit: formatContractMoney(Number((vehicle as (BookingVehicle & { security_deposit?: number | string }) | undefined)?.security_deposit ?? 0)),
    discounts_if_any: '—',
    autosweep_rfid_balance: formatContractMoney(Number((inspection as BookingInspection & { autosweep_balance?: number | string })?.autosweep_balance ?? 0)),
    easytrip_rfid_balance: formatContractMoney(Number((inspection as BookingInspection & { easytrip_balance?: number | string })?.easytrip_balance ?? 0)),
    carwash_fee: formatContractMoney(Number(vehicle?.carwash_fee ?? 200)),
    payment_summary_overall_total_due: formatContractMoney(total),
    paid_amount: formatContractMoney(paid),
    balance: formatContractMoney(bookingBalance(booking)),
    renter_signature: inspection?.signature_data
      ? `<div><img src="${inspection.signature_data}" alt="Renter signature" style="display:block;width:220px;height:64px;object-fit:contain;object-position:left bottom" /><div style="margin-top:6px;font-size:12px;border-top:1px solid #17141f;width:220px;padding-top:4px">Renter signature</div></div>`
      : '<div style="width:220px;height:64px;border-bottom:1px solid #17141f"></div><div style="margin-top:6px;font-size:12px">Renter signature</div>',
    staff_signature: '<div style="width:220px;height:64px;border-bottom:1px solid #17141f"></div><div style="margin-top:6px;font-size:12px">Staff / authorized representative signature</div>',
  }

  let resolved = stripContractImages(template)
  Object.entries(values).forEach(([key, value]) => {
    resolved = resolved.replaceAll(`{{${key}}}`, value)
  })
  return resolved
}

export function BookingDetailsDrawer(props: Props) {
  const {
    selectedBooking,
    bookingDetailTab,
    setBookingDetailTab,
    prefersReducedMotion,
    onCloseBooking,
    onOpenCustomers,
    openBookingEdit,
    openExtensionModal,
    openPaymentModal,
    deleteBookingPayment,
    undoBookingExtension,
    setConfirmation,
    submitting,
    formError,
    inspection,
    inspectionFuel,
    setInspectionFuel,
    inspectionOdometer,
    setInspectionOdometer,
    inspectionEasytrip,
    setInspectionEasytrip,
    inspectionAutosweep,
    setInspectionAutosweep,
    inspectionFunctions,
    setInspectionFunctions,
    inspectionTires,
    setInspectionTires,
    inspectionSigner,
    setInspectionSigner,
    inspectionReleaseAt,
    setInspectionReleaseAt,
    exteriorFiles,
    setExteriorFiles,
    interiorFiles,
    setInteriorFiles,
    inspectionMediaLabels,
    setInspectionMediaLabels,
    inspectionMediaConditions,
    setInspectionMediaConditions,
    inspectionSignatureData,
    setInspectionSignatureData,
    saveBookingInspection,
    postInspection,
    postInspectionFuel,
    setPostInspectionFuel,
    postInspectionOdometer,
    setPostInspectionOdometer,
    postInspectionEasytrip,
    setPostInspectionEasytrip,
    postInspectionAutosweep,
    setPostInspectionAutosweep,
    postInspectionFunctions,
    setPostInspectionFunctions,
    postInspectionTires,
    setPostInspectionTires,
    postInspectionSigner,
    setPostInspectionSigner,
    postInspectionActualReturnAt,
    setPostInspectionActualReturnAt,
    postExteriorFiles,
    setPostExteriorFiles,
    postInteriorFiles,
    setPostInteriorFiles,
    postInspectionSignatureData,
    setPostInspectionSignatureData,
    postMediaLabels,
    setPostMediaLabels,
    postMediaConditions,
    setPostMediaConditions,
    saveBookingPostInspection,
  } = props

  const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api'
  const authToken = localStorage.getItem('rentivo_access_token')
  const authHeaders = {
    Accept: 'application/json',
    Authorization: `Bearer ${authToken}`,
  }
  const [issuedContract, setIssuedContract] = useState<null | {
    id: number
    status: string
    signed_at?: string | null
    resolved_html?: string
    renter_signature_data?: string
    renter_signer_name?: string
    staff_signature_data?: string
    staff_signer_name?: string
    expires_at?: string | null
  }>(null)
  const [contractShareUrl, setContractShareUrl] = useState('')
  const [contractPin, setContractPin] = useState('')
  const [contractPinVisible, setContractPinVisible] = useState(false)
  const [contractCopyNotice, setContractCopyNotice] = useState('')
  const [contractIssueError, setContractIssueError] = useState('')
  const [contractIssuing, setContractIssuing] = useState(false)
  const [staffSignModalOpen, setStaffSignModalOpen] = useState(false)
  const [staffSignerName, setStaffSignerName] = useState('')
  const [staffSignatureData, setStaffSignatureData] = useState('')
  const [staffReviewConfirmed, setStaffReviewConfirmed] = useState(false)
  const [staffSigning, setStaffSigning] = useState(false)

  useEffect(() => {
    if (!selectedBooking) return
    setIssuedContract(null)
    setContractShareUrl('')
    setContractPin('')
    setContractPinVisible(false)
    setContractCopyNotice('')
    setContractIssueError('')
    void fetch(`${apiBaseUrl}/dashboard/bookings/${selectedBooking.id}/contract`, { headers: authHeaders })
      .then(async (response) => {
        if (!response.ok) return
        const result = await response.json()
        setIssuedContract(result.contract ?? null)
        setContractShareUrl(result.share_url ?? '')
      })
  }, [selectedBooking?.id])

  const generateContractLink = async () => {
    if (!selectedBooking) return
    setContractIssuing(true)
    setContractIssueError('')
    try {
      const template = localStorage.getItem('rentivo_contract_content') || '<p>Vehicle Rental Agreement</p>'
      const title = localStorage.getItem('rentivo_contract_title') || 'Vehicle Rental Agreement'
      const response = await fetch(`${apiBaseUrl}/dashboard/bookings/${selectedBooking.id}/contract`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          template_html: template,
          resolved_html: resolvedContractHtml(template, selectedBooking, inspection),
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to generate the contract link.')
      setIssuedContract(result.contract)
      setContractShareUrl(result.share_url)
      setContractPin(result.pin)
      setContractPinVisible(false)
    } catch (issueError) {
      setContractIssueError(issueError instanceof Error ? issueError.message : 'Unable to generate the contract link.')
    } finally {
      setContractIssuing(false)
    }
  }

  const signContractAsStaff = async () => {
      if (!selectedBooking) return
      if (!staffSignerName.trim()) {
        setContractIssueError('Enter the staff signer name.')
        return
      }
      if (staffSignatureData.length < 100) {
        setContractIssueError('Add the staff signature before submitting.')
        return
      }
      if (!staffReviewConfirmed) {
        setContractIssueError('Confirm that you reviewed the contract before signing.')
        return
      }
      setStaffSigning(true)
      setContractIssueError('')
      try {
        const response = await fetch(`${apiBaseUrl}/dashboard/bookings/${selectedBooking.id}/contract/staff-sign`, {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            staff_signer_name: staffSignerName.trim(),
            staff_signature_data: staffSignatureData,
            staff_review_confirmed: true,
          }),
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.message || 'Unable to sign the contract.')
        setIssuedContract(result.contract)
        setStaffSignModalOpen(false)
        setStaffSignatureData('')
        setStaffReviewConfirmed(false)
      } catch (signError) {
        setContractIssueError(signError instanceof Error ? signError.message : 'Unable to sign the contract.')
      } finally {
        setStaffSigning(false)
      }
  }

  const revokeContract = async () => {
      if (!selectedBooking) return
      setContractIssuing(true)
      setContractIssueError('')
      try {
        const response = await fetch(`${apiBaseUrl}/dashboard/bookings/${selectedBooking.id}/contract/revoke`, {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.message || 'Unable to revoke the contract.')
        setIssuedContract(result.contract)
        setContractShareUrl('')
        setContractPin('')
      } catch (revokeError) {
        setContractIssueError(revokeError instanceof Error ? revokeError.message : 'Unable to revoke the contract.')
      } finally {
        setContractIssuing(false)
      }
  }

  const downloadContract = () => {
    if (!selectedBooking) return
    const template = localStorage.getItem('rentivo_contract_content') || '<p>Vehicle Rental Agreement</p>'
    const title = localStorage.getItem('rentivo_contract_title') || 'Vehicle Rental Agreement'
    const html = issuedContract?.status === 'signed' && issuedContract.resolved_html
      ? issuedContract.resolved_html
      : resolvedContractHtml(template, selectedBooking, inspection)
    const signatureHtml = issuedContract?.status === 'signed' && issuedContract.renter_signature_data
      ? `<section style="margin-top:24px;padding-top:16px;border-top:1px solid #dcd8e6"><div style="display:flex;gap:40px"><div><p style="font-size:12px;font-weight:700;text-transform:uppercase;color:#686173">Renter signature</p><img src="${issuedContract.renter_signature_data}" alt="Renter signature" style="display:block;margin-top:12px;width:220px;height:80px;object-fit:contain;object-position:left" /><p style="margin-top:8px;padding-top:8px;border-top:1px solid #dcd8e6;font-weight:700">${issuedContract.renter_signer_name || selectedBooking.customer?.name || 'Renter'}</p></div>${issuedContract.staff_signature_data ? `<div><p style="font-size:12px;font-weight:700;text-transform:uppercase;color:#686173">Staff signature</p><img src="${issuedContract.staff_signature_data}" alt="Staff signature" style="display:block;margin-top:12px;width:220px;height:80px;object-fit:contain;object-position:left" /><p style="margin-top:8px;padding-top:8px;border-top:1px solid #dcd8e6;font-weight:700">${issuedContract.staff_signer_name || 'Staff / Authorized Representative'}</p></div>` : ''}</div>${issuedContract.signed_at ? `<p style="margin-top:12px;font-size:12px;color:#8b8494">Fully signed ${new Date(issuedContract.signed_at).toLocaleString()}</p>` : ''}</section>`
      : ''
    const margins = (() => {
      try {
        return JSON.parse(localStorage.getItem('rentivo_contract_margins') || '{"top":20,"right":20,"bottom":20,"left":20}')
      } catch {
        return { top: 20, right: 20, bottom: 20, left: 20 }
      }
    })()
    const printWindow = window.open('', '_blank', 'width=900,height=1100')
    if (!printWindow) return
    printWindow.document.write(`<!doctype html><html><head><title>${title}</title><style>@page{size:A4;margin:0}body{margin:0;font-family:Poppins,Arial,sans-serif}.contract-sheet{box-sizing:border-box;width:210mm;min-height:297mm;padding:${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm}table{border-collapse:collapse;width:100%}th,td{border:1px solid #d1d5db;padding:8px}.contract-page-break{page-break-after:always;height:1px}</style></head><body><article class="contract-sheet"><h1>${title}</h1>${html}${signatureHtml}</article></body></html>`)
    printWindow.document.close()
  }

  return (
      <AnimatePresence>
        {selectedBooking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-[#17141f]/40 backdrop-blur-[2px]"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) onCloseBooking()
            }}
          >
            <motion.aside
              initial={prefersReducedMotion ? false : { x: '100%' }}
              animate={{ x: 0 }}
              exit={prefersReducedMotion ? undefined : { x: '100%' }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col bg-white shadow-[-24px_0_60px_rgba(45,28,82,0.16)]"
              role="dialog"
              aria-modal="true"
              aria-label={`Booking ${selectedBooking.reference}`}
            >
              <div className="flex shrink-0 items-start justify-between border-b border-[#eeeaf3] px-5 py-5 sm:px-7">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#5b21b6]">Booking {selectedBooking.reference}</p>
                  <h2 className="mt-2 text-2xl font-semibold text-[#21142f]">{selectedBooking.customer?.name ?? 'Customer'}</h2>
                </div>
                <button type="button" onClick={() => onCloseBooking()} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-2xl text-[#8b8494] hover:bg-[#f7f6fb]" aria-label="Close booking details">×</button>
              </div>
              <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-[#eeeaf3] px-5 pt-3 sm:px-7">
                {([
                  ['details', 'Booking Details'],
                  ['extensions', 'Extensions'],
                  ['customer', 'Customer Profile'],
                  ['payments', 'Payments'],
                  ['pre-inspection', 'Pre-inspection'],
                  ['post-inspection', 'Post-inspection'],
                  ['contract', 'Contract'],
                ] as const).map(([tab, label]) => (
                  <button
                    type="button"
                    key={tab}
                    onClick={() => setBookingDetailTab(tab)}
                    className={`cursor-pointer whitespace-nowrap border-b-2 px-3 py-3 text-sm font-bold transition ${bookingDetailTab === tab ? 'border-[#5b21b6] text-[#5b21b6]' : 'border-transparent text-[#8b8494] hover:text-[#40384b]'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-7">
                {bookingDetailTab === 'details' && (
                  <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="rounded-full bg-[#ede9fe] px-3 py-1.5 text-xs font-bold text-[#6d28d9]">{bookingStatusLabel(selectedBooking.status)}</span>
                      <button type="button" onClick={openBookingEdit} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-4 py-2.5 text-sm font-bold text-[#5b21b6] hover:bg-[#f7f6fb]">Edit booking</button>
                    </div>
                    {(() => {
                      const preFunctions = (inspection?.functions ?? {}) as Record<string, boolean>
                      const postFunctions = (postInspection?.functions ?? {}) as Record<string, boolean>
                      const changedFunctions = inspectionFunctionLabels.filter((label) =>
                        (preFunctions[label] ?? true) === true &&
                        (postFunctions[label] ?? true) === false
                      )
                      const tireSeverity: Record<string, number> = { good: 0, low_tread: 1, flat_damaged: 2 }
                      const preTires = (inspection?.tires ?? {}) as Record<string, string>
                      const postTires = (postInspection?.tires ?? {}) as Record<string, string>
                      const changedTires = Object.keys(postTires).filter((position) => {
                        const before = tireSeverity[preTires[position] ?? 'good'] ?? 0
                        const after = tireSeverity[postTires[position] ?? 'good'] ?? 0
                        return after > before
                      })
                      const damagedMedia = (postInspection?.media ?? []).filter((media) =>
                        media.section === 'exterior' || media.section === 'interior'
                      ).filter((media) => media.condition === 'fair' || media.condition === 'damaged')
                      if (!changedFunctions.length && !changedTires.length && !damagedMedia.length) {
                        return (
                          <div className="rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] p-4 text-sm font-semibold text-[#15803d]">
                            No new function, tire, or visual damage differences recorded.
                          </div>
                        )
                      }
                      return (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {changedFunctions.length > 0 && (
                            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                              <p className="text-xs font-bold uppercase tracking-wide text-red-700">Function damage</p>
                              <div className="mt-3 space-y-2">
                                {changedFunctions.map((label) => (
                                  <div key={label} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm">
                                    <span className="font-semibold">{label}</span>
                                    <span className="text-xs font-bold text-red-600">Now unavailable</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {changedTires.length > 0 && (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                              <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Tire damage</p>
                              <div className="mt-3 space-y-2">
                                {changedTires.map((position) => (
                                  <div key={position} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm">
                                    <span className="font-semibold">{position}</span>
                                    <span className="text-xs font-bold text-amber-700">
                                      {postTires[position] === 'flat_damaged' ? 'Flat / Damaged' : 'Low tread'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {damagedMedia.length > 0 && (
                            <div className="rounded-xl border border-[#e5e1ed] p-4 sm:col-span-2">
                              <p className="text-xs font-bold uppercase tracking-wide text-[#686173]">Visual damage</p>
                              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                {damagedMedia.map((media) => (
                                  <a key={media.id} href={media.url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg bg-[#f7f6fb] px-3 py-2 text-xs">
                                    <span className="max-w-[180px] truncate font-semibold">{media.label || media.original_name}</span>
                                    <span className={`font-bold ${media.condition === 'damaged' ? 'text-red-600' : 'text-amber-700'}`}>{media.condition === 'damaged' ? 'Damaged' : 'Fair'}</span>
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })()}
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        ['Customer', selectedBooking.customer?.name ?? '—'],
                        ['Vehicle', selectedBooking.vehicle ? vehicleBookingLabel(selectedBooking.vehicle) : '—'],
                        ['Plate number', selectedBooking.vehicle?.plate_number ?? '—'],
                        ['Pickup', bookingDateTime(selectedBooking.pickup_at)],
                        ['Return', bookingDateTime(selectedBooking.return_at)],
                        ['Duration', rentalDurationLabel(selectedBooking.pickup_at, selectedBooking.return_at)],
                        ['Destination province', selectedBooking.destination_province ?? '—'],
                        ['Destination city', selectedBooking.destination_city ?? '—'],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-xl bg-[#f7f6fb] p-4">
                          <p className="text-xs font-semibold text-[#8b8494]">{label}</p>
                          <p className="mt-1 text-sm font-bold text-[#21142f]">{value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-[#e5e1ed] p-4"><p className="text-xs text-[#8b8494]">Total</p><p className="mt-2 text-lg font-bold text-[#5b21b6]">₱{Number(selectedBooking.total_amount).toLocaleString('en-PH')}</p></div>
                      <div className="rounded-xl border border-[#e5e1ed] p-4"><p className="text-xs text-[#8b8494]">Paid</p><p className="mt-2 text-lg font-bold text-[#16a34a]">₱{bookingPaidAmount(selectedBooking).toLocaleString('en-PH')}</p></div>
                      <div className="rounded-xl border border-[#e5e1ed] p-4"><p className="text-xs text-[#8b8494]">Balance</p><p className="mt-2 text-lg font-bold text-red-600">₱{bookingBalance(selectedBooking).toLocaleString('en-PH')}</p></div>
                    </div>
                    <div className="rounded-xl border border-[#e5e1ed] p-4">
                      <p className="text-xs font-semibold text-[#8b8494]">Remarks</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-[#40384b]">{selectedBooking.remarks || 'No remarks.'}</p>
                    </div>
                  </motion.div>
                )}

                {bookingDetailTab === 'extensions' && (
                  <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div><h3 className="font-bold text-[#21142f]">Rental extensions</h3><p className="mt-1 text-sm text-[#8b8494]">Return-date changes and extension fees.</p></div>
                      {['active', 'ongoing', 'confirmed'].includes(selectedBooking.status) && <button type="button" onClick={openExtensionModal} className="cursor-pointer rounded-lg bg-[#5b21b6] px-4 py-2.5 text-sm font-bold text-white">Add extension</button>}
                    </div>
                    {(selectedBooking.extensions ?? []).filter((extension) => !extension.undone_at).length > 0 && (
                      <button type="button" disabled={submitting} onClick={() => setConfirmation({
                        title: 'Undo latest extension?',
                        description: 'The latest return date and extension fee will be reverted.',
                        confirmLabel: 'Undo extension',
                        tone: 'danger',
                        action: undoBookingExtension,
                      })} className="cursor-pointer text-xs font-bold text-red-600 disabled:cursor-not-allowed disabled:opacity-50">Undo latest extension</button>
                    )}
                    <div className="space-y-3">
                      {(selectedBooking.extensions ?? []).length ? (selectedBooking.extensions ?? []).map((extension) => (
                        <div key={extension.id} className={`rounded-xl border p-4 ${extension.undone_at ? 'border-[#eeeaf3] bg-[#faf9fc] opacity-70' : 'border-[#c4b5fd] bg-[#faf9fc]'}`}>
                          <div className="flex flex-wrap justify-between gap-2">
                            <p className="text-sm font-bold">{bookingDateTime(extension.previous_return_at)} → {bookingDateTime(extension.new_return_at)}</p>
                            <span className="text-sm font-bold text-[#5b21b6]">₱{Number(extension.fee).toLocaleString('en-PH')}</span>
                          </div>
                          <p className="mt-2 text-xs text-[#8b8494]">{extension.pricing_mode === 'twelve_hour' ? '12-hour pricing' : 'Hourly pricing'} · {extension.creator?.name ?? 'Staff'}{extension.undone_at ? ' · Undone' : ''}</p>
                          {extension.notes && <p className="mt-2 text-sm">{extension.notes}</p>}
                        </div>
                      )) : <div className="rounded-xl border border-dashed border-[#dcd8e6] px-5 py-10 text-center text-sm text-[#8b8494]">No extensions have been recorded.</div>}
                    </div>
                  </motion.div>
                )}

                {bookingDetailTab === 'payments' && (
                  <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-[#e5e1ed] p-4"><p className="text-xs text-[#8b8494]">Total</p><p className="mt-2 text-xl font-bold text-[#5b21b6]">₱{Number(selectedBooking.total_amount).toLocaleString('en-PH')}</p></div>
                      <div className="rounded-xl border border-[#e5e1ed] p-4"><p className="text-xs text-[#8b8494]">Paid</p><p className="mt-2 text-xl font-bold text-[#16a34a]">₱{bookingPaidAmount(selectedBooking).toLocaleString('en-PH')}</p></div>
                      <div className="rounded-xl border border-[#e5e1ed] p-4"><p className="text-xs text-[#8b8494]">Balance</p><p className="mt-2 text-xl font-bold text-red-600">₱{bookingBalance(selectedBooking).toLocaleString('en-PH')}</p></div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div><h3 className="font-bold text-[#21142f]">Payment history</h3><p className="mt-1 text-sm text-[#8b8494]">Recorded payments for this booking.</p></div>
                      {bookingBalance(selectedBooking) > 0 && (
                        <button type="button" onClick={openPaymentModal} className="cursor-pointer rounded-lg bg-[#5b21b6] px-4 py-2.5 text-sm font-bold text-white">Add payment</button>
                      )}
                    </div>
                    <div className="space-y-3">
                      {(selectedBooking.payments ?? []).length ? (selectedBooking.payments ?? []).map((payment) => (
                        <div key={payment.id} className="rounded-xl border border-[#e5e1ed] p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div><p className="text-lg font-bold text-[#16a34a]">₱{Number(payment.amount).toLocaleString('en-PH')}</p><p className="mt-1 text-xs text-[#8b8494]">{payment.method} · {bookingDateTime(payment.paid_at)}</p></div>
                            <button type="button" onClick={() => deleteBookingPayment(payment)} className="cursor-pointer rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600">Delete</button>
                          </div>
                          <div className="mt-3 flex flex-wrap justify-between gap-2 border-t border-[#eeeaf3] pt-3 text-xs text-[#8b8494]"><span>Collected by {payment.creator?.name ?? 'Staff'}</span>{payment.notes && <span className="max-w-full text-[#686173]">{payment.notes}</span>}</div>
                        </div>
                      )) : (
                        <div className="rounded-xl border border-dashed border-[#dcd8e6] px-5 py-10 text-center text-sm text-[#8b8494]">No payments have been recorded.</div>
                      )}
                    </div>
                  </motion.div>
                )}

                {bookingDetailTab === 'pre-inspection' && (
                  <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div><h3 className="font-bold text-[#21142f]">Pre-inspection</h3><p className="mt-1 text-sm text-[#8b8494]">Record the vehicle condition before release.</p></div>
                      {inspection?.status && <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${inspection.status === 'completed' ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#fef3c7] text-[#b45309]'}`}>{inspection.status === 'completed' ? 'Completed' : 'Draft'}</span>}
                    </div>
                    {inspection?.status === 'completed' ? (
                      <div className="space-y-4">
                        <div className="rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] p-4 text-sm font-semibold text-[#15803d]">Completed and read-only. These details cannot be changed.</div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl border border-[#e5e1ed] p-4"><p className="text-xs text-[#8b8494]">Fuel level</p><p className="mt-2 text-lg font-bold">{inspection.fuel_level}%</p></div>
                          <div className="rounded-xl border border-[#e5e1ed] p-4"><p className="text-xs text-[#8b8494]">Odometer</p><p className="mt-2 text-lg font-bold">{Number(inspection.odometer_reading).toLocaleString('en-PH')} km</p></div>
                          <div className="rounded-xl border border-[#e5e1ed] p-4"><p className="text-xs text-[#8b8494]">Easytrip balance</p><p className="mt-2 text-lg font-bold">₱{Number(inspection.easytrip_balance).toLocaleString('en-PH')}</p></div>
                          <div className="rounded-xl border border-[#e5e1ed] p-4"><p className="text-xs text-[#8b8494]">Autosweep balance</p><p className="mt-2 text-lg font-bold">₱{Number(inspection.autosweep_balance).toLocaleString('en-PH')}</p></div>
                        </div>

                        {(['exterior', 'interior'] as const).map((section) => {
                          const media = (inspection.media ?? []).filter((item) => item.section === section)
                          return (
                            <section key={section} className="rounded-xl border border-[#e5e1ed] p-4">
                              <div className="flex items-center justify-between"><h4 className="text-sm font-bold capitalize">{section}</h4>{section === 'interior' && <span className="text-xs text-[#8b8494]">Optional</span>}</div>
                              {media.length ? (
                                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                  {media.map((item) => (
                                    <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-[#e5e1ed] bg-[#f7f6fb] hover:border-[#c4b5fd]">
                                      {item.media_type === 'photo' && item.url
                                        ? <img src={item.url} alt={item.label || item.original_name} className="h-32 w-full object-cover" />
                                        : <div className="flex h-32 items-center justify-center text-xs font-bold text-[#5b21b6]">Video</div>}
                                      <div className="p-3"><p className="truncate text-xs font-bold">{item.label || item.original_name}</p><p className="mt-1 text-[10px] capitalize text-[#8b8494]">{item.condition || 'Good'}</p></div>
                                    </a>
                                  ))}
                                </div>
                              ) : <p className="mt-3 text-sm text-[#8b8494]">No {section} media recorded.</p>}
                            </section>
                          )
                        })}

                        <section className="rounded-xl border border-[#e5e1ed] p-4">
                          <h4 className="text-sm font-bold">Functions</h4>
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {Object.entries(inspection.functions ?? {}).map(([label, working]) => (
                              <div key={label} className="flex items-center justify-between rounded-lg bg-[#f7f6fb] px-3 py-3 text-sm"><span className="font-semibold">{label}</span><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${working ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-red-50 text-red-600'}`}>{working ? 'Working' : 'Unavailable'}</span></div>
                            ))}
                            {!Object.keys(inspection.functions ?? {}).length && <p className="text-sm text-[#8b8494]">No function checks recorded.</p>}
                          </div>
                        </section>

                        <section className="rounded-xl border border-[#e5e1ed] p-4">
                          <h4 className="text-sm font-bold">Tires</h4>
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {Object.entries(inspection.tires ?? {}).map(([position, condition]) => (
                              <div key={position} className="flex items-center justify-between rounded-lg bg-[#f7f6fb] px-3 py-3 text-sm"><span className="font-semibold">{position}</span><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${condition === 'good' ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#fef3c7] text-[#b45309]'}`}>{condition === 'low_tread' ? 'Low tread' : condition === 'flat_damaged' ? 'Flat / Damaged' : 'Good'}</span></div>
                            ))}
                            {!Object.keys(inspection.tires ?? {}).length && <p className="text-sm text-[#8b8494]">No tire checks recorded.</p>}
                          </div>
                        </section>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl border border-[#e5e1ed] p-4"><p className="text-xs text-[#8b8494]">Actual release</p><p className="mt-2 text-sm font-bold">{inspection.actual_release_at ? bookingDateTime(inspection.actual_release_at) : '—'}</p></div>
                          <div className="rounded-xl border border-[#e5e1ed] p-4"><p className="text-xs text-[#8b8494]">Renter signature</p><p className="mt-2 text-sm font-bold">{inspection.signer_name || '—'}</p>{inspection.signature_data && <img src={inspection.signature_data} alt="Renter signature" className="mt-3 h-20 max-w-full object-contain object-left" />}</div>
                        </div>
                      </div>
                    ) : (
                    <>
                    <section className="rounded-xl border border-[#e5e1ed] p-4">
                      <h4 className="text-sm font-bold">Odometer</h4>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <label className="sm:col-span-2"><span className="mb-2 flex justify-between text-sm font-semibold"><span>Fuel level</span><strong className="text-[#5b21b6]">{inspectionFuel}%</strong></span><input type="range" min="0" max="100" step="5" value={inspectionFuel} onChange={(event) => setInspectionFuel(Number(event.target.value))} className="w-full accent-[#5b21b6]" /><span className="mt-1 flex justify-between text-[10px] text-[#8b8494]"><span>0%</span><span>50%</span><span>100%</span></span></label>
                        <label><span className="mb-2 block text-sm font-semibold">Odometer reading (KM)</span><input type="number" min="0" value={inspectionOdometer} onChange={(event) => setInspectionOdometer(event.target.value)} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label>
                        <div className="grid grid-cols-2 gap-3">
                          <label><span className="mb-2 block text-xs font-semibold">Easytrip balance</span><input type="number" min="0" step="0.01" value={inspectionEasytrip} onChange={(event) => setInspectionEasytrip(event.target.value)} className="w-full rounded-lg border border-[#dcd8e6] px-3 py-3" /></label>
                          <label><span className="mb-2 block text-xs font-semibold">Autosweep balance</span><input type="number" min="0" step="0.01" value={inspectionAutosweep} onChange={(event) => setInspectionAutosweep(event.target.value)} className="w-full rounded-lg border border-[#dcd8e6] px-3 py-3" /></label>
                        </div>
                      </div>
                    </section>

                    {(['exterior','interior'] as const).map((section) => {
                      const files = section === 'exterior' ? exteriorFiles : interiorFiles
                      const setFiles = section === 'exterior' ? setExteriorFiles : setInteriorFiles
                      const existing = (inspection?.media ?? []).filter((media) => media.section === section)
                      return (
                        <section key={section} className="rounded-xl border border-[#e5e1ed] p-4">
                          <div className="flex items-center justify-between gap-3"><h4 className="text-sm font-bold capitalize">{section}</h4>{section === 'interior' && <span className="text-xs text-[#8b8494]">Optional</span>}</div>
                          <div className="mt-4 grid gap-2 sm:grid-cols-2">
                            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[#c4b5fd] bg-[#faf9fc] px-4 py-4 text-center hover:bg-[#f4effc]">
                              <span className="text-sm font-bold text-[#5b21b6]">Choose from gallery</span>
                              <span className="mt-1 text-xs text-[#8b8494]">Photos or videos</span>
                              <input type="file" accept="image/*,video/*" multiple onChange={(event) => setFiles((current) => [...current, ...Array.from(event.target.files ?? [])])} className="sr-only" />
                            </label>
                            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[#c4b5fd] bg-[#faf9fc] px-4 py-4 text-center hover:bg-[#f4effc]">
                              <span className="text-sm font-bold text-[#5b21b6]">Open device camera</span>
                              <span className="mt-1 text-xs text-[#8b8494]">Capture directly</span>
                              <input type="file" accept="image/*,video/*" capture="environment" onChange={(event) => setFiles((current) => [...current, ...Array.from(event.target.files ?? [])])} className="sr-only" />
                            </label>
                          </div>
                          {existing.length > 0 && <div className="mt-3 grid gap-2 sm:grid-cols-2">{existing.map((media) => <a key={media.id} href={media.url} target="_blank" rel="noreferrer" className="rounded-lg bg-[#f7f6fb] px-3 py-2 text-xs font-semibold text-[#5b21b6] hover:bg-[#ede9fe]"><span className="block truncate">{media.label || media.original_name}</span><span className="mt-1 block text-[10px] capitalize text-[#8b8494]">{media.condition || 'Good'}</span></a>)}</div>}
                          {files.length > 0 && <div className="mt-3 grid gap-3 sm:grid-cols-2">{files.map((file, index) => {
                            const key = `${section}-${index}`
                            return <div key={`${file.name}-${index}`} className="rounded-lg border border-[#eeeaf3] p-3"><p className="truncate text-xs font-bold">{file.name}</p><label className="mt-2 block"><span className="mb-1 block text-[10px] text-[#8b8494]">Label</span><input value={inspectionMediaLabels[key] ?? ''} onChange={(event) => setInspectionMediaLabels((current) => ({ ...current, [key]: event.target.value }))} placeholder="Example: Front bumper" className="w-full rounded-lg border border-[#dcd8e6] px-3 py-2 text-xs" /></label><label className="mt-2 block"><span className="mb-1 block text-[10px] text-[#8b8494]">Condition</span><select value={inspectionMediaConditions[key] ?? 'good'} onChange={(event) => setInspectionMediaConditions((current) => ({ ...current, [key]: event.target.value }))} className="w-full rounded-lg border border-[#dcd8e6] px-3 py-2 text-xs"><option value="good">Good</option><option value="fair">Fair</option><option value="damaged">Damaged</option></select></label></div>
                          })}</div>}
                        </section>
                      )
                    })}

                    <section className="rounded-xl border border-[#e5e1ed] p-4">
                      <h4 className="text-sm font-bold">Functions</h4>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {inspectionFunctionLabels.map((label) => <label key={label} className="flex cursor-pointer items-center gap-3 rounded-lg bg-[#f7f6fb] px-3 py-3 text-sm"><input type="checkbox" checked={inspectionFunctions[label] ?? true} onChange={(event) => setInspectionFunctions((current) => ({ ...current, [label]: event.target.checked }))} className="h-4 w-4 accent-[#5b21b6]" /><span>{label}</span></label>)}
                      </div>
                    </section>

                    <section className="rounded-xl border border-[#e5e1ed] p-4">
                      <h4 className="text-sm font-bold">Tires</h4>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {(selectedBooking.vehicle?.type?.startsWith('Motorcycle') ? ['Front','Rear'] : ['Front Left','Front Right','Rear Left','Rear Right']).map((position) => <label key={position} className="block"><span className="mb-2 block text-xs font-semibold">{position}</span><select value={inspectionTires[position] ?? 'good'} onChange={(event) => setInspectionTires((current) => ({ ...current, [position]: event.target.value }))} className="w-full rounded-lg border border-[#dcd8e6] px-3 py-2.5 text-sm"><option value="good">Good</option><option value="low_tread">Low tread</option><option value="flat_damaged">Flat / Damaged</option></select></label>)}
                      </div>
                    </section>

                    <section className="rounded-xl border border-[#e5e1ed] p-4">
                      <h4 className="text-sm font-bold">Confirmation</h4>
                      <p className="mt-2 text-sm leading-6 text-[#686173]">I confirm that I personally inspected this vehicle and agree that the recorded mileage, fuel level, functions, and visual condition accurately represent it at the time of inspection.</p>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <label><span className="mb-2 block text-sm font-semibold">Renter name</span><input value={inspectionSigner} onChange={(event) => setInspectionSigner(event.target.value)} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label>
                        <label><span className="mb-2 block text-sm font-semibold">Actual release date & time</span><input type="datetime-local" value={inspectionReleaseAt} onChange={(event) => setInspectionReleaseAt(event.target.value)} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label>
                      </div>
                      <div className="mt-4">
                        <SignaturePad value={inspectionSignatureData} onChange={setInspectionSignatureData} />
                      </div>
                    </section>

                    {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}
                    <div className="sticky bottom-0 flex gap-3 border-t border-[#eeeaf3] bg-white py-3"><button type="button" disabled={submitting} onClick={() => saveBookingInspection(false)} className="flex-1 cursor-pointer rounded-lg border border-[#dcd8e6] px-4 py-3 text-sm font-bold text-[#686173] disabled:cursor-not-allowed disabled:opacity-60">Save inspection</button><button type="button" disabled={submitting} onClick={() => setConfirmation({
                      title: 'Complete pre-inspection?',
                      description: 'Once completed, pre-inspection details and the renter signature cannot be changed. The rental will become Ongoing.',
                      confirmLabel: 'Complete pre-inspection',
                      tone: 'primary',
                      action: () => saveBookingInspection(true),
                    })} className="flex-1 cursor-pointer rounded-lg bg-[#5b21b6] px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">{submitting ? 'Saving...' : 'Complete inspection'}</button></div>
                    </>
                    )}
                  </motion.div>
                )}

                {bookingDetailTab === 'post-inspection' && (
                  <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div><h3 className="font-bold text-[#21142f]">Post-inspection</h3><p className="mt-1 text-sm text-[#8b8494]">Record the vehicle condition at return.</p></div>
                      {postInspection?.status && <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${postInspection.status === 'completed' ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#fef3c7] text-[#b45309]'}`}>{postInspection.status === 'completed' ? 'Completed' : 'Draft'}</span>}
                    </div>
                    {postInspection?.status === 'completed' ? (
                      <div className="space-y-4">
                        <div className="rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] p-4 text-sm font-semibold text-[#15803d]">Completed and read-only. These details cannot be changed.</div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl border border-[#e5e1ed] p-4"><p className="text-xs text-[#8b8494]">Fuel</p><p className="mt-2 text-sm font-bold">{postInspection.fuel_level}% returned</p>{inspection && <p className="mt-1 text-xs text-[#686173]">{inspection.fuel_level}% before · Missing {Math.max(0, inspection.fuel_level - postInspection.fuel_level)}%</p>}</div>
                          <div className="rounded-xl border border-[#e5e1ed] p-4"><p className="text-xs text-[#8b8494]">Fuel adjustment</p><p className="mt-2 text-lg font-bold text-red-600">₱{Number(postInspection.fuel_charge ?? 0).toLocaleString('en-PH')}</p></div>
                          <div className="rounded-xl border border-[#e5e1ed] p-4">
                            <p className="text-xs text-[#8b8494]">RFID balances & adjustments</p>
                            {(() => {
                              const easytripBefore = Number(inspection?.easytrip_balance ?? 0)
                              const easytripAfter = Number(postInspection.easytrip_balance ?? 0)
                              const autosweepBefore = Number(inspection?.autosweep_balance ?? 0)
                              const autosweepAfter = Number(postInspection.autosweep_balance ?? 0)
                              const easytripInsufficient = Math.max(0, easytripBefore - easytripAfter)
                              const easytripExcess = Math.max(0, easytripAfter - easytripBefore)
                              const autosweepInsufficient = Math.max(0, autosweepBefore - autosweepAfter)
                              const autosweepExcess = Math.max(0, autosweepAfter - autosweepBefore)
                              return (
                                <div className="mt-2 space-y-2 text-sm">
                                  <div className="rounded-lg bg-[#f7f6fb] px-3 py-2">
                                    <div className="flex justify-between gap-3"><span className="font-semibold">Easytrip</span><span>₱{easytripAfter.toLocaleString('en-PH')} after</span></div>
                                    <div className="mt-1 flex justify-between gap-3 text-xs"><span className="text-[#686173]">Insufficient credit</span><strong className={easytripInsufficient > 0 ? 'text-red-600' : 'text-[#15803d]'}>₱{easytripInsufficient.toLocaleString('en-PH')}</strong></div>
                                    <div className="mt-1 flex justify-between gap-3 text-xs"><span className="text-[#686173]">Excess credit</span><strong className={easytripExcess > 0 ? 'text-[#15803d]' : 'text-[#686173]'}>₱{easytripExcess.toLocaleString('en-PH')}</strong></div>
                                  </div>
                                  <div className="rounded-lg bg-[#f7f6fb] px-3 py-2">
                                    <div className="flex justify-between gap-3"><span className="font-semibold">Autosweep</span><span>₱{autosweepAfter.toLocaleString('en-PH')} after</span></div>
                                    <div className="mt-1 flex justify-between gap-3 text-xs"><span className="text-[#686173]">Insufficient credit</span><strong className={autosweepInsufficient > 0 ? 'text-red-600' : 'text-[#15803d]'}>₱{autosweepInsufficient.toLocaleString('en-PH')}</strong></div>
                                    <div className="mt-1 flex justify-between gap-3 text-xs"><span className="text-[#686173]">Excess credit</span><strong className={autosweepExcess > 0 ? 'text-[#15803d]' : 'text-[#686173]'}>₱{autosweepExcess.toLocaleString('en-PH')}</strong></div>
                                  </div>
                                </div>
                              )
                            })()}
                          </div>
                          <div className="rounded-xl border border-[#e5e1ed] p-4"><p className="text-xs text-[#8b8494]">Mileage</p><p className="mt-2 text-sm font-bold">{Number(postInspection.distance_traveled ?? 0).toLocaleString('en-PH')} km traveled</p><p className="mt-1 text-xs text-[#686173]">{Number(postInspection.allowed_mileage ?? 0).toLocaleString('en-PH')} km allowed · {Number(postInspection.excess_mileage ?? 0).toLocaleString('en-PH')} km excess</p><p className="mt-1 text-sm font-bold text-red-600">₱{Number(postInspection.excess_mileage_charge ?? 0).toLocaleString('en-PH')} excess mileage charge</p></div>
                        </div>
                        {(() => {
                          const preFunctions = (inspection?.functions ?? {}) as Record<string, boolean>
                          const postFunctions = (postInspection.functions ?? {}) as Record<string, boolean>
                          const functionDamages = inspectionFunctionLabels.filter((label) =>
                            (preFunctions[label] ?? true) === true &&
                            (postFunctions[label] ?? true) === false
                          )
                          const tireSeverity: Record<string, number> = { good: 0, low_tread: 1, flat_damaged: 2 }
                          const preTires = (inspection?.tires ?? {}) as Record<string, string>
                          const postTires = (postInspection.tires ?? {}) as Record<string, string>
                          const tireDamages = Object.keys(postTires).filter((position) =>
                            (tireSeverity[postTires[position] ?? 'good'] ?? 0) >
                            (tireSeverity[preTires[position] ?? 'good'] ?? 0)
                          )
                          const visualDamages = (postInspection.media ?? []).filter((media) =>
                            media.condition === 'fair' || media.condition === 'damaged'
                          )

                          if (!functionDamages.length && !tireDamages.length && !visualDamages.length) {
                            return (
                              <div className="rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] p-4 text-sm font-semibold text-[#15803d]">
                                No function, tire, or visual damage differences recorded.
                              </div>
                            )
                          }

                          return (
                            <div className="grid gap-3 sm:grid-cols-2">
                              {functionDamages.length > 0 && (
                                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                                  <p className="text-xs font-bold uppercase tracking-wide text-red-700">Function damage</p>
                                  <div className="mt-3 space-y-2">
                                    {functionDamages.map((label) => (
                                      <div key={label} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm">
                                        <span className="font-semibold">{label}</span>
                                        <span className="text-xs font-bold text-red-600">Now unavailable</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {tireDamages.length > 0 && (
                                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                                  <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Tire damage</p>
                                  <div className="mt-3 space-y-2">
                                    {tireDamages.map((position) => (
                                      <div key={position} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm">
                                        <span className="font-semibold">{position}</span>
                                        <span className="text-xs font-bold text-amber-700">
                                          {postTires[position] === 'flat_damaged' ? 'Flat / Damaged' : 'Low tread'}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {visualDamages.length > 0 && (
                                <div className="rounded-xl border border-[#e5e1ed] p-4 sm:col-span-2">
                                  <p className="text-xs font-bold uppercase tracking-wide text-[#686173]">Visual damage</p>
                                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                    {visualDamages.map((media) => (
                                      <a key={media.id} href={media.url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg bg-[#f7f6fb] px-3 py-2 text-xs">
                                        <span className="max-w-[180px] truncate font-semibold">{media.label || media.original_name}</span>
                                        <span className={`font-bold ${media.condition === 'damaged' ? 'text-red-600' : 'text-amber-700'}`}>
                                          {media.condition === 'damaged' ? 'Damaged' : 'Fair'}
                                        </span>
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })()}
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl border border-[#e5e1ed] p-4"><p className="text-xs text-[#8b8494]">Returned at</p><p className="mt-2 text-sm font-bold">{postInspection.actual_return_at ? bookingDateTime(postInspection.actual_return_at) : '—'}</p></div>
                          <div className="rounded-xl border border-[#e5e1ed] p-4"><p className="text-xs text-[#8b8494]">Renter signature</p><p className="mt-2 text-sm font-bold">{postInspection.signer_name || '—'}</p>{postInspection.signature_data && <img src={postInspection.signature_data} alt="Renter signature" className="mt-3 h-20 max-w-full object-contain object-left" />}</div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <section className="rounded-xl border border-[#e5e1ed] p-4">
                          <h4 className="text-sm font-bold">Vehicle condition</h4>
                          <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            <label className="sm:col-span-2"><span className="mb-2 flex justify-between text-sm font-semibold"><span>Fuel level</span><strong className="text-[#5b21b6]">{postInspectionFuel}%</strong></span><input type="range" min="0" max="100" step="5" value={postInspectionFuel} onChange={(event) => setPostInspectionFuel(Number(event.target.value))} className="w-full accent-[#5b21b6]" /></label>
                            <label><span className="mb-2 block text-sm font-semibold">Odometer reading (KM)</span><input type="number" min="0" value={postInspectionOdometer} onChange={(event) => setPostInspectionOdometer(event.target.value)} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label>
                            <div className="grid grid-cols-2 gap-3"><label><span className="mb-2 block text-xs font-semibold">Easytrip balance</span><input type="number" min="0" step="0.01" value={postInspectionEasytrip} onChange={(event) => setPostInspectionEasytrip(event.target.value)} className="w-full rounded-lg border border-[#dcd8e6] px-3 py-3" /></label><label><span className="mb-2 block text-xs font-semibold">Autosweep balance</span><input type="number" min="0" step="0.01" value={postInspectionAutosweep} onChange={(event) => setPostInspectionAutosweep(event.target.value)} className="w-full rounded-lg border border-[#dcd8e6] px-3 py-3" /></label></div>
                          </div>
                        </section>
                        {(['exterior','interior'] as const).map((section) => {
                          const files = section === 'exterior' ? postExteriorFiles : postInteriorFiles
                          const setFiles = section === 'exterior' ? setPostExteriorFiles : setPostInteriorFiles
                          return (
                            <section key={section} className="rounded-xl border border-[#e5e1ed] p-4">
                              <div className="flex items-center justify-between"><h4 className="text-sm font-bold capitalize">{section}</h4>{section === 'interior' && <span className="text-xs text-[#8b8494]">Optional</span>}</div>
                              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                                <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[#c4b5fd] bg-[#faf9fc] px-4 py-4 text-center"><span className="text-sm font-bold text-[#5b21b6]">Choose from gallery</span><input type="file" accept="image/*,video/*" multiple onChange={(event) => setFiles((current) => [...current, ...Array.from(event.target.files ?? [])])} className="sr-only" /></label>
                                <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[#c4b5fd] bg-[#faf9fc] px-4 py-4 text-center"><span className="text-sm font-bold text-[#5b21b6]">Open device camera</span><input type="file" accept="image/*,video/*" capture="environment" onChange={(event) => setFiles((current) => [...current, ...Array.from(event.target.files ?? [])])} className="sr-only" /></label>
                              </div>
                              {files.length > 0 && (
                                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                  {files.map((file, index) => {
                                    const key = `${section}-${index}`
                                    return (
                                      <div key={`${file.name}-${index}`} className="rounded-lg border border-[#eeeaf3] p-3">
                                        <p className="truncate text-xs font-bold">{file.name}</p>
                                        <label className="mt-2 block"><span className="mb-1 block text-[10px] text-[#8b8494]">Label</span><input value={postMediaLabels[key] ?? ''} onChange={(event) => setPostMediaLabels((current) => ({ ...current, [key]: event.target.value }))} placeholder="Example: Rear bumper" className="w-full rounded-lg border border-[#dcd8e6] px-3 py-2 text-xs" /></label>
                                        <label className="mt-2 block"><span className="mb-1 block text-[10px] text-[#8b8494]">Condition</span><select value={postMediaConditions[key] ?? 'good'} onChange={(event) => setPostMediaConditions((current) => ({ ...current, [key]: event.target.value }))} className="w-full rounded-lg border border-[#dcd8e6] px-3 py-2 text-xs"><option value="good">Good</option><option value="fair">Fair</option><option value="damaged">Damaged</option></select></label>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </section>
                          )
                        })}
                        <section className="rounded-xl border border-[#e5e1ed] p-4"><h4 className="text-sm font-bold">Functions</h4><div className="mt-4 grid gap-2 sm:grid-cols-2">{inspectionFunctionLabels.map((label) => <label key={label} className="flex cursor-pointer items-center gap-3 rounded-lg bg-[#f7f6fb] px-3 py-3 text-sm"><input type="checkbox" checked={postInspectionFunctions[label] ?? true} onChange={(event) => setPostInspectionFunctions((current) => ({ ...current, [label]: event.target.checked }))} className="h-4 w-4 accent-[#5b21b6]" /><span>{label}</span></label>)}</div></section>
                        <section className="rounded-xl border border-[#e5e1ed] p-4"><h4 className="text-sm font-bold">Tires</h4><div className="mt-4 grid gap-3 sm:grid-cols-2">{(selectedBooking.vehicle?.type?.startsWith('Motorcycle') ? ['Front','Rear'] : ['Front Left','Front Right','Rear Left','Rear Right']).map((position) => <label key={position}><span className="mb-2 block text-xs font-semibold">{position}</span><select value={postInspectionTires[position] ?? 'good'} onChange={(event) => setPostInspectionTires((current) => ({ ...current, [position]: event.target.value }))} className="w-full rounded-lg border border-[#dcd8e6] px-3 py-2.5 text-sm"><option value="good">Good</option><option value="low_tread">Low tread</option><option value="flat_damaged">Flat / Damaged</option></select></label>)}</div></section>
                        <section className="rounded-xl border border-[#e5e1ed] p-4"><h4 className="text-sm font-bold">Confirmation</h4><p className="mt-2 text-sm leading-6 text-[#686173]">I confirm that the recorded mileage, fuel level, functions, and visual condition accurately represent this vehicle when it was returned.</p><div className="mt-4 grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block text-sm font-semibold">Renter name</span><input value={postInspectionSigner} onChange={(event) => setPostInspectionSigner(event.target.value)} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label><label><span className="mb-2 block text-sm font-semibold">Actual return date & time</span><input type="datetime-local" value={postInspectionActualReturnAt} onChange={(event) => setPostInspectionActualReturnAt(event.target.value)} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label></div><div className="mt-4"><SignaturePad value={postInspectionSignatureData} onChange={setPostInspectionSignatureData} /></div></section>
                        {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}
                        <div className="sticky bottom-0 flex gap-3 border-t border-[#eeeaf3] bg-white py-3"><button type="button" disabled={submitting} onClick={() => saveBookingPostInspection(false)} className="flex-1 cursor-pointer rounded-lg border border-[#dcd8e6] px-4 py-3 text-sm font-bold text-[#686173]">Save inspection</button><button type="button" disabled={submitting} onClick={() => setConfirmation({
                          title: 'Complete post-inspection?',
                          description: 'Once completed, post-inspection details and the renter signature cannot be changed. The booking will be marked Complete.',
                          confirmLabel: 'Complete post-inspection',
                          tone: 'primary',
                          action: () => saveBookingPostInspection(true),
                        })} className="flex-1 cursor-pointer rounded-lg bg-[#5b21b6] px-4 py-3 text-sm font-bold text-white">Complete inspection</button></div>
                      </>
                    )}
                  </motion.div>
                )}

                {bookingDetailTab === 'contract' && (
                  <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5b21b6]">Generated contract</p>
                        <h3 className="mt-2 text-xl font-bold">{localStorage.getItem('rentivo_contract_title') || 'Vehicle Rental Agreement'}</h3>
                        <p className="mt-1 text-sm text-[#8b8494]">Dynamic fields are resolved from this booking.</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={downloadContract} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-4 py-2.5 text-sm font-bold text-[#686173]">Print</button>
                        {issuedContract?.status === 'renter_signed' && <button type="button" onClick={() => setStaffSignModalOpen(true)} className="cursor-pointer rounded-lg border border-[#5b21b6] px-4 py-2.5 text-sm font-bold text-[#5b21b6]">Sign as Staff</button>}
                        {issuedContract && ['issued', 'renter_signed'].includes(issuedContract.status) && <button type="button" disabled={contractIssuing} onClick={() => void revokeContract()} className="cursor-pointer rounded-lg border border-red-200 px-4 py-2.5 text-sm font-bold text-red-700 disabled:cursor-not-allowed disabled:opacity-60">Revoke</button>}
                        <button type="button" disabled={contractIssuing} onClick={() => void generateContractLink()} className="cursor-pointer rounded-lg bg-[#5b21b6] px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">{contractIssuing ? 'Generating...' : issuedContract ? 'Regenerate Link' : 'Generate Private Link'}</button>
                      </div>
                    </div>
                    {(contractShareUrl || contractIssueError) && (
                      <div className="rounded-xl border border-[#dcd8e6] bg-white p-4">
                        {contractIssueError && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{contractIssueError}</p>}
                        {contractShareUrl && (
                          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_210px]">
                            <label>
                              <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#686173]">Private share link</span>
                              <div className="flex gap-2">
                                <input readOnly value={contractShareUrl} onFocus={(event) => event.target.select()} className="min-w-0 flex-1 rounded-lg border border-[#dcd8e6] px-3 py-2.5 text-sm" />
                                <button type="button" onClick={async () => { await navigator.clipboard.writeText(contractShareUrl); setContractCopyNotice('Share link copied') }} className="shrink-0 cursor-pointer rounded-lg border border-[#dcd8e6] px-3 text-xs font-bold text-[#5b21b6]" title="Copy private share link">Copy</button>
                              </div>
                            </label>
                            {contractPin && (
                              <label>
                                <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#686173]">6-digit PIN</span>
                                <div className="flex gap-2">
                                  <div className="relative min-w-0 flex-1">
                                    <input type={contractPinVisible ? 'text' : 'password'} readOnly value={contractPin} onFocus={(event) => event.target.select()} className="w-full rounded-lg border border-[#dcd8e6] px-3 py-2.5 pr-10 text-center text-lg font-bold tracking-[0.25em]" />
                                    <button type="button" onClick={() => setContractPinVisible((visible) => !visible)} className="absolute right-2 top-1/2 cursor-pointer -translate-y-1/2 rounded p-1 text-sm text-[#686173]" title={contractPinVisible ? 'Hide PIN' : 'Show PIN'} aria-label={contractPinVisible ? 'Hide PIN' : 'Show PIN'}>{contractPinVisible ? '◉' : '○'}</button>
                                  </div>
                                  <button type="button" onClick={async () => { await navigator.clipboard.writeText(contractPin); setContractCopyNotice('PIN copied') }} className="shrink-0 cursor-pointer rounded-lg border border-[#dcd8e6] px-3 text-xs font-bold text-[#5b21b6]" title="Copy PIN">Copy</button>
                                </div>
                              </label>
                            )}
                          </div>
                        )}
                        {contractCopyNotice && <p className="mt-2 text-xs font-bold text-green-700" role="status">{contractCopyNotice}</p>}
                        {contractPin && (
                          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm leading-6 text-amber-900" role="status">
                            <strong>Important:</strong> This PIN can only be viewed once. Store it somewhere safe and share it with the renter. Once you close or refresh this page, the PIN cannot be retrieved again.
                          </div>
                        )}
                        {issuedContract && (
                          <p className={`mt-3 text-xs font-bold ${issuedContract.status === 'signed' ? 'text-green-700' : issuedContract.status === 'revoked' ? 'text-red-700' : 'text-[#686173]'}`}>
                            Status: {issuedContract.status === 'signed' ? 'Fully signed' : issuedContract.status === 'renter_signed' ? 'Waiting for staff signature' : issuedContract.status === 'revoked' ? 'Revoked' : 'Waiting for renter signature'}
                          </p>
                        )}
                      </div>
                    )}
                    <div className="overflow-auto rounded-xl border border-[#dcd8e6] bg-[#eceaf0] p-4 sm:p-6">
                      <div
                        className="mx-auto min-h-[297mm] w-[210mm] max-w-full bg-white p-[20mm] text-sm shadow-[0_18px_50px_rgba(45,28,82,0.14)]"
                        dangerouslySetInnerHTML={{
                          __html: issuedContract?.status === 'signed' && issuedContract.resolved_html
                            ? issuedContract.resolved_html
                            : resolvedContractHtml(
                                localStorage.getItem('rentivo_contract_content') || '<p>This Rental Agreement is entered into between the rental company and the customer.</p>',
                                selectedBooking,
                                inspection,
                              ),
                        }}
                      />
                      {issuedContract?.status === 'signed' && issuedContract.renter_signature_data && (
                        <div className="mx-auto mt-4 w-[210mm] max-w-full rounded-xl border border-[#dcd8e6] bg-white p-6">
                          <div className="grid gap-6 sm:grid-cols-2">
                            <div>
                              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#686173]">Renter signature</p>
                              <img src={issuedContract.renter_signature_data} alt={`Renter signature for ${issuedContract.renter_signer_name || selectedBooking.customer?.name || 'renter'}`} className="mt-3 h-20 max-w-full object-contain object-left" />
                              <p className="mt-2 border-t border-[#dcd8e6] pt-2 text-sm font-semibold">{issuedContract.renter_signer_name || selectedBooking.customer?.name || 'Renter'}</p>
                            </div>
                            {issuedContract.staff_signature_data && (
                              <div>
                                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#686173]">Staff signature</p>
                                <img src={issuedContract.staff_signature_data} alt={`Staff signature for ${issuedContract.staff_signer_name || 'staff representative'}`} className="mt-3 h-20 max-w-full object-contain object-left" />
                                <p className="mt-2 border-t border-[#dcd8e6] pt-2 text-sm font-semibold">{issuedContract.staff_signer_name || 'Staff / Authorized Representative'}</p>
                              </div>
                            )}
                          </div>
                          {issuedContract.signed_at && <p className="mt-4 text-xs text-[#8b8494]">Fully signed {new Date(issuedContract.signed_at).toLocaleString()}</p>}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {bookingDetailTab === 'customer' && (
                  <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#ede9fe] text-lg font-bold text-[#6d28d9]">{(selectedBooking.customer?.name ?? 'C').slice(0, 1).toUpperCase()}</div>
                      <div><h3 className="text-xl font-bold">{selectedBooking.customer?.name ?? 'Customer'}</h3><p className="mt-1 text-sm text-[#8b8494]">Customer profile</p></div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        ['Email', selectedBooking.customer?.email ?? '—'],
                        ['Phone', selectedBooking.customer?.phone ?? '—'],
                        ['Address', selectedBooking.customer?.address ?? '—'],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-xl bg-[#f7f6fb] p-4"><p className="text-xs text-[#8b8494]">{label}</p><p className="mt-1 text-sm font-bold">{value}</p></div>
                      ))}
                    </div>
                    <button type="button" onClick={() => onOpenCustomers()} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-4 py-2.5 text-sm font-bold text-[#5b21b6] hover:bg-[#f7f6fb]">Open Customers</button>
                  </motion.div>
                )}
              </div>
            </motion.aside>
          </motion.div>
        )}

        {staffSignModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[#17141f]/55 p-4"
            role="dialog"
            aria-modal="true"
          >
            <motion.section initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5b21b6]">Staff signature</p>
                  <h2 className="mt-1 text-xl font-bold">Sign as Staff / Authorized Representative</h2>
                </div>
                <button type="button" onClick={() => setStaffSignModalOpen(false)} className="h-9 w-9 cursor-pointer rounded-full text-xl text-[#686173] hover:bg-[#f7f6fb]" aria-label="Close">×</button>
              </div>
              <label className="mt-5 block">
                <span className="mb-2 block text-sm font-semibold">Staff signer name</span>
                <input value={staffSignerName} onChange={(event) => setStaffSignerName(event.target.value)} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" />
              </label>
              <div className="mt-5"><SignaturePad value={staffSignatureData} onChange={setStaffSignatureData} /></div>
              <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-lg border border-[#dcd8e6] p-4">
                <input type="checkbox" checked={staffReviewConfirmed} onChange={(event) => setStaffReviewConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[#5b21b6]" />
                <span className="text-sm leading-6 text-[#40384b]">I confirm that I reviewed the contract and the renter signature before signing as staff.</span>
              </label>
              {contractIssueError && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{contractIssueError}</p>}
              <div className="mt-5 flex justify-end gap-3">
                <button type="button" onClick={() => setStaffSignModalOpen(false)} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-4 py-2.5 text-sm font-bold">Cancel</button>
                <button type="button" disabled={staffSigning} onClick={() => void signContractAsStaff()} className="cursor-pointer rounded-lg bg-[#5b21b6] px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">{staffSigning ? 'Signing...' : 'Submit Staff Signature'}</button>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
  )
}
