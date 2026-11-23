import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'

type PublicData = {
  organization: { name: string; address?: string; city?: string; province?: string; logo_url?: string }
  requirements: Record<string, boolean>
  delivery_methods: Record<string, boolean>
  professional_driver_enabled: boolean
  contact_number?: string
}

export default function PublicBookingPage() {
  const { slug } = useParams()
  const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api'
  const [data, setData] = useState<PublicData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`${apiBaseUrl}/booking-form/${slug}`)
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.message || 'Online booking form unavailable')
        setData(result)
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Online booking form unavailable'))
  }, [apiBaseUrl, slug])

  if (error) return <main className="flex min-h-screen items-center justify-center bg-[#f7f6fb] px-6"><div className="max-w-md rounded-xl border border-red-100 bg-red-50 p-6 text-center text-sm text-red-700">{error}</div></main>
  if (!data) return <main className="flex min-h-screen items-center justify-center bg-[#f7f6fb]"><div className="h-10 w-10 animate-spin rounded-full border-4 border-[#ede9fe] border-t-[#5b21b6]" /></main>

  return (
    <main className="min-h-screen bg-[#f7f6fb] px-6 py-12">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-3xl rounded-2xl border border-[#2c0f73]/10 bg-white p-6 shadow-[0_24px_60px_rgba(45,28,82,0.12)] sm:p-10">
        <div className="flex items-center gap-4">
          {data.organization.logo_url ? <img src={data.organization.logo_url} alt="" className="h-16 w-16 rounded-xl object-contain" /> : <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#5b21b6] text-xl font-bold text-white">{data.organization.name.slice(0, 1).toUpperCase()}</div>}
          <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#5b21b6]">Online booking</p><h1 className="mt-1 text-2xl font-bold text-[#21142f]">{data.organization.name}</h1>{data.contact_number && <p className="mt-1 text-sm text-[#686173]">{data.contact_number}</p>}</div>
        </div>
        <div className="mt-8 rounded-xl border border-[#e5e1ed] p-5">
          <h2 className="font-bold">Booking form</h2>
          <p className="mt-2 text-sm text-[#686173]">Online booking is enabled for this workspace. Customer vehicle selection and booking submission will be completed here.</p>
        </div>
      </motion.div>
    </main>
  )
}
