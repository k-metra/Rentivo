import { motion, useReducedMotion } from 'framer-motion'
import type { FormEvent, RefObject } from 'react'

type Customer = {
  id: number
  name: string
  first_name?: string
  middle_name?: string
  last_name?: string
  email?: string
  phone?: string
  address?: string
  date_of_birth?: string
  license_number?: string
  license_expiry?: string
  identification_information?: string
  notes?: string
  referral_source?: string
  social_profile_url?: string
  attachments?: Array<{ category: string }>
}

type Props = {
  kind: 'customer' | 'partner' | 'source'
  customerId: number | null
  customer: Customer | null
  customerFiles: Record<string, File[]>
  submitting: boolean
  formRef: RefObject<HTMLFormElement | null>
  prefersReducedMotion: boolean
  onCustomerFilesChange: (category: string, files: File[]) => void
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export function CrudModal(props: Props) {
  const reduced = useReducedMotion() || props.prefersReducedMotion
  const title = props.kind === 'partner' ? 'Add partner' : props.kind === 'source' ? 'Add booking source' : props.customerId ? 'Edit customer' : 'Add customer'

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-[#17141f]/55 p-2 sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) props.onClose() }}>
      <motion.div initial={reduced ? false : { opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={reduced ? undefined : { opacity: 0, scale: 0.98 }} className="flex max-h-[calc(100dvh-1rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)]" role="dialog" aria-modal="true" aria-label={title}>
        <div className="flex shrink-0 items-center justify-between border-b border-[#eeeaf3] px-4 py-4 sm:px-6"><h2 className="text-lg font-bold sm:text-xl">{title}</h2><button type="button" onClick={props.onClose} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-2xl text-[#8b8494] hover:bg-[#f7f6fb]" aria-label="Close">×</button></div>
        <form ref={props.formRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5 sm:px-6" onSubmit={props.onSubmit}>
          {props.kind === 'customer' && (() => {
            const customer = props.customer
            const firstName = customer?.first_name ?? ''
            const middleName = customer?.middle_name ?? ''
            const lastName = customer?.last_name ?? ''
            const compositeName = [firstName, middleName, lastName].filter(Boolean).join(' ')
            const attachmentFields: Array<[string, string, string]> = [
              ['license', "Driver's License", 'Front & back'],
              ['ltms', 'LTMS Portal Screenshots', 'Screenshots'],
              ['selfie_license', "Selfie with Driver's License", 'Selfie'],
              ['proof_of_billing', 'Proof of Billing', 'Address document'],
              ['secondary_id', 'Secondary ID', 'Government or valid ID'],
            ]
            return (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2"><span className="mb-2 block text-sm font-semibold">Display name</span><input name="name" required defaultValue={customer?.name ?? compositeName} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label>
                <label><span className="mb-2 block text-sm font-semibold">First name</span><input name="first_name" defaultValue={firstName} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label>
                <label><span className="mb-2 block text-sm font-semibold">Middle name</span><input name="middle_name" defaultValue={middleName} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label>
                <label><span className="mb-2 block text-sm font-semibold">Last name</span><input name="last_name" defaultValue={lastName} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label>
                <label><span className="mb-2 block text-sm font-semibold">Date of birth</span><input name="date_of_birth" type="date" defaultValue={customer?.date_of_birth?.slice(0, 10) ?? ''} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label>
                <label><span className="mb-2 block text-sm font-semibold">Email</span><input name="email" type="email" defaultValue={customer?.email ?? ''} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label>
                <label><span className="mb-2 block text-sm font-semibold">Phone</span><input name="phone" defaultValue={customer?.phone ?? ''} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label>
                <label className="sm:col-span-2"><span className="mb-2 block text-sm font-semibold">Address</span><textarea name="address" rows={3} defaultValue={customer?.address ?? ''} className="w-full resize-y rounded-lg border border-[#dcd8e6] px-4 py-3" placeholder="House/building, street, barangay, city, province" /></label>
                <label><span className="mb-2 block text-sm font-semibold">Driver&apos;s license number</span><input name="license_number" defaultValue={customer?.license_number ?? ''} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label>
                <label><span className="mb-2 block text-sm font-semibold">License expiry</span><input name="license_expiry" type="date" defaultValue={customer?.license_expiry?.slice(0, 10) ?? ''} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label>
                <label><span className="mb-2 block text-sm font-semibold">Referral source</span><select name="referral_source" defaultValue={customer?.referral_source ?? ''} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3"><option value="">Select source</option><option value="facebook">Facebook</option><option value="tiktok">TikTok</option><option value="google_search">Google Search</option><option value="word_of_mouth">Word of Mouth</option></select></label>
                <label><span className="mb-2 block text-sm font-semibold">Social profile URL</span><input name="social_profile_url" type="url" defaultValue={customer?.social_profile_url ?? ''} placeholder="https://" className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label>
                <label className="sm:col-span-2"><span className="mb-2 block text-sm font-semibold">Identification information</span><textarea name="identification_information" rows={2} defaultValue={customer?.identification_information ?? ''} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label>
                <label className="sm:col-span-2"><span className="mb-2 block text-sm font-semibold">Notes</span><textarea name="notes" rows={3} defaultValue={customer?.notes ?? ''} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label>
                <div className="sm:col-span-2 rounded-xl border border-[#e5e1ed] p-4">
                  <h3 className="text-sm font-bold">Customer requirements</h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {attachmentFields.map(([category, label, description]) => {
                      const existing = customer?.attachments?.filter((attachment) => attachment.category === category) ?? []
                      return (
                        <label key={category} className="block rounded-lg bg-[#faf9fc] p-3">
                          <span className="block text-sm font-semibold">{label}</span><span className="mt-0.5 block text-xs text-[#8b8494]">{description}</span>
                          {existing.length > 0 && <span className="mt-2 block text-xs font-semibold text-[#15803d]">{existing.length} attached</span>}
                          <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple onChange={(event) => props.onCustomerFilesChange(category, Array.from(event.target.files ?? []))} className="mt-2 block w-full text-xs file:mr-2 file:cursor-pointer file:rounded-md file:border-0 file:bg-[#ede9fe] file:px-3 file:py-2 file:font-bold file:text-[#5b21b6]" />
                        </label>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })()}
          {props.kind === 'partner' && <>
            <label className="block"><span className="mb-2 block text-sm font-semibold">Partner name</span><input name="name" required className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label>
            <label className="block"><span className="mb-2 block text-sm font-semibold">Type</span><select name="type" className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3"><option>agency</option><option>corporate</option><option>affiliate</option><option>broker</option></select></label>
            <div className="grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block text-sm font-semibold">Email</span><input name="email" type="email" className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label><label><span className="mb-2 block text-sm font-semibold">Phone</span><input name="phone" className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label></div>
            <label className="block"><span className="mb-2 block text-sm font-semibold">Commission rate (%)</span><input name="commission_rate" type="number" min="0" max="100" step="0.01" defaultValue="0" className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label>
            <label className="block"><span className="mb-2 block text-sm font-semibold">Status</span><select name="status" className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3"><option value="active">active</option><option value="inactive">inactive</option></select></label>
          </>}
          {props.kind === 'source' && <>
            <label className="block"><span className="mb-2 block text-sm font-semibold">Source name</span><input name="name" required className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label>
            <label className="block"><span className="mb-2 block text-sm font-semibold">Type</span><select name="type" className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3"><option>direct</option><option>website</option><option>social</option><option>marketplace</option><option>referral</option></select></label>
            <label className="block"><span className="mb-2 block text-sm font-semibold">Commission rate (%)</span><input name="commission_rate" type="number" min="0" max="100" step="0.01" defaultValue="0" className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label>
            <label className="block"><span className="mb-2 block text-sm font-semibold">Status</span><select name="status" className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3"><option value="active">active</option><option value="inactive">inactive</option></select></label>
          </>}
          <div className="sticky bottom-[-1.25rem] z-20 mt-4 -mx-4 border-t border-[#eeeaf3] bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6"><button type="submit" disabled={props.submitting} className="w-full cursor-pointer rounded-lg bg-[#5b21b6] px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">{props.submitting ? 'Saving...' : props.customerId ? 'Save changes' : 'Save'}</button></div>
        </form>
      </motion.div>
    </motion.div>
  )
}
