import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { SignaturePad } from '../components/dashboard/SignaturePad'

type PublicContract = {
  title: string
  resolved_html: string
  status: string
  signed_at?: string | null
  renter_name?: string
  renter_signer_name?: string
  renter_signature_data?: string
  staff_signer_name?: string
  staff_signature_data?: string
}

export default function PublicContractPage() {
  const { token } = useParams()
  const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api'
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pin, setPin] = useState('')
  const [contract, setContract] = useState<PublicContract | null>(null)
  const [signModalOpen, setSignModalOpen] = useState(false)
  const [signerName, setSignerName] = useState('')
  const [signature, setSignature] = useState('')
  const [reviewConfirmed, setReviewConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch(`${apiBaseUrl}/contracts/${token}`)
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.message || 'Contract unavailable')
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Contract unavailable'))
      .finally(() => setLoading(false))
  }, [apiBaseUrl, token])

  const verifyContract = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    if (!/^\d{6}$/.test(pin)) {
      setError('Enter the 6-digit PIN.')
      return
    }
    try {
      const response = await fetch(`${apiBaseUrl}/contracts/${token}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ pin }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to open contract.')
      setContract(result.contract)
      setSignerName(result.contract.renter_name || '')
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : 'Unable to open contract.')
    }
  }

  const submitSignature = async () => {
    if (!signature || signature.length < 100) {
      setError('Add your signature before submitting.')
      return
    }
    if (!signerName.trim()) {
      setError('Enter the signer name.')
      return
    }
    if (!reviewConfirmed) {
      setError('Confirm that you reviewed the contract before signing.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const response = await fetch(`${apiBaseUrl}/contracts/${token}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          pin,
          renter_signer_name: signerName.trim(),
          signature_data: signature,
          review_confirmed: true,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to sign contract.')
      setContract(result.contract)
      setSignModalOpen(false)
    } catch (signError) {
      setError(signError instanceof Error ? signError.message : 'Unable to sign contract.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f7f6fb]"><div className="h-10 w-10 animate-spin rounded-full border-4 border-[#ede9fe] border-t-[#5b21b6]" /></main>
  }

  if (error && !contract) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f7f6fb] px-6"><div className="max-w-md rounded-xl border border-red-100 bg-red-50 p-6 text-center text-sm text-red-700">{error}</div></main>
  }

  if (!contract) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f6fb] px-6">
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md rounded-2xl border border-[#2c0f73]/10 bg-white p-6 shadow-[0_24px_60px_rgba(45,28,82,0.12)] sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#5b21b6]">Private contract</p>
          <h1 className="mt-2 text-2xl font-bold">Enter the 6-digit PIN</h1>
          <p className="mt-2 text-sm text-[#686173]">Use the PIN sent by the rental company to review this contract.</p>
          <form onSubmit={verifyContract} className="mt-6">
            <input
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              className="w-full rounded-xl border border-[#dcd8e6] px-4 py-4 text-center text-2xl font-bold tracking-[0.35em] outline-none focus:border-[#6d28d9]"
            />
            {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <button type="submit" className="mt-5 w-full cursor-pointer rounded-xl bg-[#5b21b6] px-4 py-3.5 font-bold text-white">Review Contract</button>
          </form>
        </motion.section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#eceaf0] px-4 py-8">
      <section className="mx-auto max-w-[210mm]">
        <div className="mb-4 flex items-center justify-between rounded-xl border border-[#dcd8e6] bg-white p-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5b21b6]">{contract.status === 'signed' ? 'Fully signed contract' : contract.status === 'renter_signed' ? 'Renter signed · awaiting staff' : 'Review contract'}</p>
            <h1 className="mt-1 text-lg font-bold">{contract.title}</h1>
          </div>
          {contract.status === 'issued' && (
            <button type="button" onClick={() => setSignModalOpen(true)} className="cursor-pointer rounded-lg bg-[#5b21b6] px-4 py-2.5 text-sm font-bold text-white">Sign Contract</button>
          )}
        </div>
        {contract.status === 'signed' && (
          <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">Contract fully signed by renter and staff.</div>
        )}
        <article
          className="min-h-[297mm] bg-white p-[20mm] text-sm shadow-[0_18px_50px_rgba(45,28,82,0.16)]"
          dangerouslySetInnerHTML={{ __html: contract.resolved_html }}
        />
        {contract.status === 'signed' && contract.renter_signature_data && (
          <div className="mt-4 rounded-xl border border-[#dcd8e6] bg-white p-5">
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#686173]">Renter signature</p>
                <img src={contract.renter_signature_data} alt={`Renter signature for ${contract.renter_signer_name || contract.renter_name || 'renter'}`} className="mt-3 h-20 max-w-full object-contain object-left" />
                <p className="mt-2 border-t border-[#dcd8e6] pt-2 text-sm font-semibold">{contract.renter_signer_name || contract.renter_name || 'Renter'}</p>
              </div>
              {contract.staff_signature_data && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#686173]">Staff signature</p>
                  <img src={contract.staff_signature_data} alt={`Staff signature for ${contract.staff_signer_name || 'staff representative'}`} className="mt-3 h-20 max-w-full object-contain object-left" />
                  <p className="mt-2 border-t border-[#dcd8e6] pt-2 text-sm font-semibold">{contract.staff_signer_name || 'Staff / Authorized Representative'}</p>
                </div>
              )}
            </div>
            {contract.signed_at && <p className="mt-4 text-xs text-[#8b8494]">Fully signed {new Date(contract.signed_at).toLocaleString()}</p>}
          </div>
        )}
      </section>

      {signModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#17141f]/55 p-4" role="dialog" aria-modal="true">
          <motion.section initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5b21b6]">Digital signature</p><h2 className="mt-1 text-xl font-bold">Sign {contract.title}</h2></div>
              <button type="button" onClick={() => setSignModalOpen(false)} className="h-9 w-9 cursor-pointer rounded-full text-xl text-[#686173] hover:bg-[#f7f6fb]" aria-label="Close">×</button>
            </div>
            <label className="mt-5 block"><span className="mb-2 block text-sm font-semibold">Signer name</span><input value={signerName} onChange={(event) => setSignerName(event.target.value)} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label>
            <div className="mt-5"><SignaturePad value={signature} onChange={setSignature} /></div>
            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-lg border border-[#dcd8e6] p-4">
              <input type="checkbox" checked={reviewConfirmed} onChange={(event) => setReviewConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[#5b21b6]" />
              <span className="text-sm leading-6 text-[#40384b]">I confirm that I reviewed this contract and agree to sign the terms shown above.</span>
            </label>
            {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setSignModalOpen(false)} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-4 py-2.5 text-sm font-bold">Cancel</button>
              <button type="button" disabled={submitting} onClick={() => void submitSignature()} className="cursor-pointer rounded-lg bg-[#5b21b6] px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">{submitting ? 'Signing...' : 'Submit Signature'}</button>
            </div>
          </motion.section>
        </div>
      )}
    </main>
  )
}
