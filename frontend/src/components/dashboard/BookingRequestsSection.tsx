import { useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { ConfirmationModal } from './ConfirmationModal'
import { useSubscriptionReadOnly } from './SubscriptionReadOnlyContext'

type BookingRequestDocument = {
  id: number
  category: string
  original_name: string
  mime_type: string
  size: number
  download_url: string
}

type BookingRequestItem = {
  id: number
  reference: string
  status: 'pending' | 'approved' | 'declined'
  customer_name: string
  customer_email: string
  customer_phone: string
  customer_address?: string
  customer_facebook_profile?: string
  referral_source?: string
  pickup_at: string
  return_at: string
  destination_city?: string
  destination_province?: string
  delivery_method: string
  professional_driver_requested: boolean
  remarks?: string
  quoted_rental_amount: number | string
  quoted_rental_breakdown?: Array<{ label: string; amount: number | string }>
  reservation_fee_amount?: number | string | null
  reservation_fee_deductible?: boolean
  privacy_acknowledged_at?: string | null
  decline_reason?: string
  created_at: string
  booking?: { id: number; reference: string; status: string } | null
  vehicle?: { id: number; name?: string; brand: string; model: string; year?: number; image_url?: string } | null
  documents: BookingRequestDocument[]
}

type DocumentPreview = {
  document: BookingRequestDocument
  url: string
  blob: Blob
}

type Props = {
  canApprove: boolean
  canRecordPayments: boolean
  canDecline: boolean
  onChanged: () => void
}

const deliveryLabels: Record<string, string> = {
  renter_pickup_renter_return: 'Renter pickup and renter return',
  renter_pickup_owner_collection: 'Renter pickup and owner collection',
  owner_delivery_renter_return: 'Owner delivery and renter return',
  owner_delivery_owner_collection: 'Owner delivery and owner collection',
}

const documentLabels: Record<string, string> = {
  primary_id: 'Primary ID',
  secondary_id: 'Secondary ID',
  proof_of_billing: 'Proof of billing',
  ltms_screenshots: 'LTMS screenshots',
  selfie_with_primary_id: 'Selfie with primary ID',
  reservation_payment_proof: 'Reservation payment proof',
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
}

function formatBytes(size: number) {
  return size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function displayLabel(value: string, labels: Record<string, string>) {
  return labels[value] ?? value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function BookingRequestsSection({ canApprove, canRecordPayments, canDecline, onChanged }: Props) {
  const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api'
  const token = localStorage.getItem('rentivo_access_token') ?? ''
  const subscriptionReadOnly = useSubscriptionReadOnly()
  const prefersReducedMotion = Boolean(useReducedMotion())
  const [requests, setRequests] = useState<BookingRequestItem[]>([])
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [decliningId, setDecliningId] = useState<number | null>(null)
  const [previewingDocumentId, setPreviewingDocumentId] = useState<number | null>(null)
  const [approvalConfirmation, setApprovalConfirmation] = useState<BookingRequestItem | null>(null)
  const [preview, setPreview] = useState<DocumentPreview | null>(null)
  const [declineReason, setDeclineReason] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadRequests = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`${apiBaseUrl}/dashboard/booking-requests`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to load booking requests.')
      setRequests(result.requests as BookingRequestItem[])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load booking requests.')
    } finally {
      setLoading(false)
    }
  }, [apiBaseUrl, token])

  useEffect(() => {
    void loadRequests()
  }, [loadRequests])

  useEffect(() => {
    if (!preview) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreview(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      URL.revokeObjectURL(preview.url)
    }
  }, [preview])

  const actOnRequest = async (item: BookingRequestItem, action: 'approve' | 'decline') => {
    const feeAmount = Number(item.reservation_fee_amount ?? 0)
    setProcessingId(item.id)
    setError('')
    setSuccess('')
    try {
      const response = await fetch(`${apiBaseUrl}/dashboard/booking-requests/${item.id}/${action}`, {
        method: 'POST',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(action === 'decline'
          ? { reason: declineReason }
          : { reservation_fee_confirmed: feeAmount > 0 }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || `Unable to ${action} this request.`)
      setSuccess(result.notification_sent === false
        ? result.message
        : action === 'approve'
          ? `${item.reference} was approved${result.booking?.reference ? ` as ${result.booking.reference}` : ''}.`
          : `${item.reference} was declined.`)
      if (action === 'approve') setApprovalConfirmation(null)
      setDecliningId(null)
      setDeclineReason('')
      await loadRequests()
      onChanged()
    } catch (actionError) {
      if (action === 'approve') setApprovalConfirmation(null)
      setError(actionError instanceof Error ? actionError.message : `Unable to ${action} this request.`)
    } finally {
      setProcessingId(null)
    }
  }

  const previewDocument = async (document: BookingRequestDocument) => {
    setError('')
    setPreviewingDocumentId(document.id)
    try {
      const response = await fetch(`${apiBaseUrl.replace(/\/api\/?$/, '')}${document.download_url}`, {
        headers: { Accept: '*/*', Authorization: `Bearer ${token}` },
      })
      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.message || 'Unable to preview this document.')
      }
      const blob = await response.blob()
      setPreview({ document, blob, url: URL.createObjectURL(blob) })
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : 'Unable to preview this document.')
    } finally {
      setPreviewingDocumentId(null)
    }
  }

  const downloadPreview = () => {
    if (!preview) return
    const link = window.document.createElement('a')
    link.href = preview.url
    link.download = preview.document.original_name
    link.click()
  }

  const filteredRequests = requests.filter((item) => filter === 'all' || item.status === 'pending')

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-[#21142f]">Online booking requests</h2>
          <p className="mt-1 text-sm text-[#8b8494]">Review public requests. For fee requests, verify the uploaded proof before approving; approval records the fee as an online payment.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="booking-request-filter">Request filter</label>
          <select id="booking-request-filter" value={filter} onChange={(event) => setFilter(event.target.value as 'pending' | 'all')} className="cursor-pointer rounded-lg border border-[#dcd8e6] bg-white px-3 py-2.5 text-sm font-semibold text-[#40384b]">
            <option value="pending">Pending</option>
            <option value="all">All requests</option>
          </select>
          <button type="button" onClick={() => void loadRequests()} disabled={loading} className="cursor-pointer rounded-lg border border-[#dcd8e6] bg-white px-4 py-2.5 text-sm font-bold text-[#40384b] hover:bg-[#f7f6fb] disabled:cursor-not-allowed disabled:opacity-50">
            Refresh
          </button>
        </div>
      </header>

      {error && <p className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}
      {success && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">{success}</p>}
      {subscriptionReadOnly && <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Your workspace is read-only. You can review requests, but cannot approve or decline them until your subscription is renewed.</p>}

      {loading ? (
        <div className="grid gap-4 xl:grid-cols-2" aria-label="Loading requests">
          {[1, 2].map((item) => <div key={item} className="h-64 animate-pulse rounded-xl bg-white" />)}
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#dcd8e6] bg-white px-6 py-14 text-center">
          <h3 className="text-lg font-semibold text-[#21142f]">{filter === 'pending' ? 'No pending requests' : 'No booking requests yet'}</h3>
          <p className="mt-2 text-sm text-[#8b8494]">{filter === 'pending' ? 'New requests from your public booking form will appear here.' : 'Requests submitted by customers will appear here.'}</p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredRequests.map((item) => (
            <article key={item.id} className="overflow-hidden rounded-xl border border-[#2c0f73]/10 bg-white">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eeeaf3] p-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#8b8494]">{item.reference}</p>
                  <h3 className="mt-1 text-lg font-bold text-[#21142f]">{item.customer_name}</h3>
                  <p className="mt-1 text-sm text-[#686173]">{item.customer_email} · {item.customer_phone}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${item.status === 'pending' ? 'bg-amber-50 text-amber-800' : item.status === 'approved' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>
                  {item.status}
                </span>
              </div>

              <div className="grid gap-4 p-5 sm:grid-cols-[112px_1fr]">
                {item.vehicle?.image_url
                  ? <img src={item.vehicle.image_url} alt="" className="h-24 w-full rounded-lg bg-[#f7f6fb] object-cover sm:w-28" />
                  : <div className="flex h-24 items-center justify-center rounded-lg bg-[#f7f6fb] text-xs font-semibold text-[#8b8494] sm:w-28">Vehicle</div>}
                <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                  <div><p className="text-xs text-[#8b8494]">Vehicle</p><p className="mt-1 text-sm font-semibold">{item.vehicle ? [item.vehicle.name || `${item.vehicle.brand} ${item.vehicle.model}`, item.vehicle.year].filter(Boolean).join(' · ') : 'Vehicle unavailable'}</p></div>
                  <div><p className="text-xs text-[#8b8494]">Estimated rental</p><p className="mt-1 text-sm font-semibold">₱{Number(item.quoted_rental_amount).toLocaleString('en-PH', { maximumFractionDigits: 2 })}</p></div>
                  {item.quoted_rental_breakdown?.map((line) => <div key={line.label}><p className="text-xs text-[#8b8494]">{line.label}</p><p className="mt-1 text-sm font-semibold">₱{Number(line.amount).toLocaleString('en-PH', { maximumFractionDigits: 2 })}</p></div>)}
                  {Number(item.reservation_fee_amount ?? 0) > 0 && <div><p className="text-xs text-[#8b8494]">Reservation fee</p><p className="mt-1 text-sm font-semibold">₱{Number(item.reservation_fee_amount).toLocaleString('en-PH', { maximumFractionDigits: 2 })} · {item.reservation_fee_deductible ? 'deductible' : 'added to total'}</p></div>}
                  <div><p className="text-xs text-[#8b8494]">Pickup</p><p className="mt-1 text-sm font-semibold">{formatDate(item.pickup_at)}</p></div>
                  <div><p className="text-xs text-[#8b8494]">Return</p><p className="mt-1 text-sm font-semibold">{formatDate(item.return_at)}</p></div>
                  <div><p className="text-xs text-[#8b8494]">Destination</p><p className="mt-1 text-sm font-semibold">{[item.destination_city, item.destination_province].filter(Boolean).join(', ') || 'Not specified'}</p></div>
                  <div><p className="text-xs text-[#8b8494]">Delivery</p><p className="mt-1 text-sm font-semibold">{displayLabel(item.delivery_method, deliveryLabels)}</p></div>
                  <div><p className="text-xs text-[#8b8494]">Professional driver</p><p className="mt-1 text-sm font-semibold">{item.professional_driver_requested ? 'Requested' : 'Not requested'}</p></div>
                  <div><p className="text-xs text-[#8b8494]">Submitted</p><p className="mt-1 text-sm font-semibold">{formatDate(item.created_at)}</p></div>
                  <div className="sm:col-span-2"><p className="text-xs text-[#8b8494]">Home address</p><p className="mt-1 text-sm font-semibold">{item.customer_address || 'Not provided'}</p></div>
                  <div><p className="text-xs text-[#8b8494]">Facebook profile</p><p className="mt-1 break-all text-sm font-semibold">{item.customer_facebook_profile ? <a href={item.customer_facebook_profile} target="_blank" rel="noopener noreferrer" className="text-[#5b21b6] underline">{item.customer_facebook_profile}</a> : 'Not provided'}</p></div>
                  <div><p className="text-xs text-[#8b8494]">How they found you</p><p className="mt-1 text-sm font-semibold">{item.referral_source || 'Not provided'}</p></div>
                  <div className="sm:col-span-2"><p className="text-xs text-[#8b8494]">Privacy acknowledgment</p><p className="mt-1 text-sm font-semibold">{item.privacy_acknowledged_at ? formatDate(item.privacy_acknowledged_at) : 'Not recorded'}</p></div>
                </div>
              </div>

              {item.remarks && <div className="mx-5 rounded-lg bg-[#f7f6fb] p-3 text-sm text-[#686173]"><span className="font-semibold text-[#40384b]">Customer notes: </span>{item.remarks}</div>}

              {item.documents.length > 0 && (
                <div className="px-5 pt-4">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-[#8b8494]">Customer documents</h4>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.documents.map((document) => (
                      <button key={document.id} type="button" disabled={previewingDocumentId !== null} onClick={() => void previewDocument(document)} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-3 py-2 text-left text-xs font-semibold text-[#5b21b6] hover:bg-[#f7f3ff] disabled:cursor-not-allowed disabled:opacity-60">
                        {previewingDocumentId === document.id ? 'Opening preview…' : 'Preview'}: {displayLabel(document.category, documentLabels)} · {document.original_name} <span className="text-[#8b8494]">({formatBytes(document.size)})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {item.booking && <p className="mx-5 mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Created booking {item.booking.reference} ({item.booking.status}).</p>}
              {item.decline_reason && <p className="mx-5 mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800"><span className="font-semibold">Decline reason: </span>{item.decline_reason}</p>}

              {item.status === 'pending' && (canApprove || canDecline) && (
                <div className="mt-5 border-t border-[#eeeaf3] p-5">
                  {Number(item.reservation_fee_amount ?? 0) > 0 && canApprove && !canRecordPayments && <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">You need the Bookings Payments permission to verify and record this reservation fee.</p>}
                  {decliningId === item.id && canDecline ? (
                    <div className="space-y-3">
                      <label className="block text-sm font-semibold text-[#40384b]">Reason for declining <span className="font-normal text-[#8b8494]">(optional)</span>
                        <textarea value={declineReason} onChange={(event) => setDeclineReason(event.target.value)} maxLength={1000} rows={2} className="mt-2 w-full resize-y rounded-lg border border-[#dcd8e6] px-3 py-2 outline-none focus:border-[#6d28d9]" />
                      </label>
                      <div className="flex flex-wrap justify-end gap-2">
                        <button type="button" onClick={() => { setDecliningId(null); setDeclineReason('') }} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-4 py-2 text-sm font-bold text-[#686173]">Cancel</button>
                        <button type="button" disabled={subscriptionReadOnly || processingId === item.id} onClick={() => void actOnRequest(item, 'decline')} className="cursor-pointer rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{processingId === item.id ? 'Saving…' : 'Confirm decline'}</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap justify-end gap-2">
                      {canDecline && <button type="button" disabled={subscriptionReadOnly || processingId === item.id} onClick={() => { setDecliningId(item.id); setDeclineReason('') }} className="cursor-pointer rounded-lg border border-red-200 px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50">Decline</button>}
                      {canApprove && <button type="button" disabled={subscriptionReadOnly || processingId === item.id || !item.vehicle || (Number(item.reservation_fee_amount ?? 0) > 0 && !canRecordPayments)} onClick={() => setApprovalConfirmation(item)} className="cursor-pointer rounded-lg bg-[#5b21b6] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#4c1d95] disabled:cursor-not-allowed disabled:opacity-50">Approve and create booking</button>}
                    </div>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {preview && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="booking-document-preview-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) setPreview(null)
          }}
        >
          <div className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <header className="flex items-start justify-between gap-4 border-b border-[#eeeaf3] px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <h2 id="booking-document-preview-title" className="font-bold text-[#21142f]">{displayLabel(preview.document.category, documentLabels)}</h2>
                <p className="mt-0.5 truncate text-xs text-[#8b8494]">{preview.document.original_name} · {formatBytes(preview.document.size)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button type="button" onClick={downloadPreview} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-3 py-2 text-xs font-bold text-[#5b21b6] hover:bg-[#f7f3ff]">Download</button>
                <button type="button" aria-label="Close document preview" onClick={() => setPreview(null)} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-3 py-2 text-sm font-bold text-[#686173] hover:bg-[#f7f6fb]">Close</button>
              </div>
            </header>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-[#f7f6fb] p-3 sm:p-5">
              {preview.document.mime_type.startsWith('image/') ? (
                <img src={preview.url} alt={preview.document.original_name} className="max-h-[75vh] max-w-full object-contain" />
              ) : preview.document.mime_type === 'application/pdf' || preview.document.original_name.toLowerCase().endsWith('.pdf') ? (
                <iframe src={preview.url} title={`Preview of ${preview.document.original_name}`} className="h-[75vh] w-full rounded-lg bg-white" />
              ) : (
                <p className="text-sm text-[#686173]">Preview is not available for this file type. Download the file to view it.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {approvalConfirmation && (
        <ConfirmationModal
          title={`Approve ${approvalConfirmation.reference}?`}
          description={Number(approvalConfirmation.reservation_fee_amount ?? 0) > 0
            ? `Confirm that you have reviewed the reservation-fee proof. Approving will create a booking for ${approvalConfirmation.customer_name} and record ₱${Number(approvalConfirmation.reservation_fee_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })} as an online payment.`
            : `This will create a booking for ${approvalConfirmation.customer_name} from this request.`}
          confirmLabel={Number(approvalConfirmation.reservation_fee_amount ?? 0) > 0 ? 'Approve and record fee' : 'Approve and create booking'}
          tone="primary"
          confirming={processingId === approvalConfirmation.id}
          prefersReducedMotion={prefersReducedMotion}
          onCancel={() => setApprovalConfirmation(null)}
          onConfirm={() => void actOnRequest(approvalConfirmation, 'approve')}
        />
      )}
    </section>
  )
}
