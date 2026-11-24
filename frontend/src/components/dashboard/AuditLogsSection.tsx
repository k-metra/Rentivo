import { useEffect, useState } from 'react'

type AuditLog = {
  id: number
  user_name?: string
  user_email?: string
  module: string
  action: string
  http_method: string
  ip_address: string
  user_agent?: string
  target_type?: string
  target_id?: string
  metadata?: Record<string, unknown>
  response_status: number
  created_at: string
}

export function AuditLogsSection() {
  const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api'
  const token = localStorage.getItem('rentivo_access_token')
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [module, setModule] = useState('')
  const [page, setPage] = useState(1)
  const [integrity, setIntegrity] = useState<'verified' | 'tampered'>('verified')
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, per_page: 25, total: 0 })

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), per_page: '25' })
    if (search) params.set('search', search)
    if (module) params.set('module', module)
    fetch(`${apiBaseUrl}/dashboard/audit-logs?${params}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.message || 'Unable to load audit logs.')
        setLogs(result.logs ?? [])
        setPagination(result.pagination ?? { current_page: 1, last_page: 1, per_page: 25, total: 0 })
        setIntegrity(result.integrity === 'tampered' ? 'tampered' : 'verified')
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Unable to load audit logs.'))
      .finally(() => setLoading(false))
  }, [apiBaseUrl, token, search, module, page])

  const modules = ['Dashboard', 'Settings', 'Vehicles', 'Bookings', 'Payments', 'Customers', 'Users', 'Roles', 'Partners', 'Funds', 'Expenses', 'Booking Sources', 'Contracts']

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5b21b6]">Security</p>
          <h2 className="mt-1 text-2xl font-bold">Audit Logs</h2>
          <p className="mt-1 text-sm text-[#8b8494]">Accountable changes across workspace modules.</p>
        </div>
        <div className={`rounded-lg border px-3 py-2 text-xs font-bold ${integrity === 'verified' ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
          Hash chain: {integrity === 'verified' ? 'Verified' : 'Tampering detected'}
        </div>
      </div>

      <div className="grid gap-3 rounded-xl border border-[#dcd8e6] bg-white p-4 sm:grid-cols-[1fr_220px]">
        <label>
          <span className="mb-2 block text-xs font-bold text-[#686173]">Search</span>
          <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="User, action, IP, target..." className="w-full rounded-lg border border-[#dcd8e6] px-3 py-2.5 text-sm" />
        </label>
        <label>
          <span className="mb-2 block text-xs font-bold text-[#686173]">Module</span>
          <select value={module} onChange={(event) => { setModule(event.target.value); setPage(1) }} className="w-full rounded-lg border border-[#dcd8e6] px-3 py-2.5 text-sm">
            <option value="">All modules</option>
            {modules.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="overflow-hidden rounded-xl border border-[#dcd8e6] bg-white">
        {loading ? (
          <div className="p-10 text-center text-sm text-[#8b8494]">Loading audit logs...</div>
        ) : logs.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#8b8494]">No audit activity found.</div>
        ) : (
          <div className="divide-y divide-[#eeeaf3]">
            {logs.map((log) => (
              <article key={log.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[44px_1fr_auto] sm:px-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ede9fe] text-sm font-bold text-[#6d28d9]">
                  {(log.user_name || log.user_email || 'S').slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm"><strong>{log.user_name || log.user_email || 'System'}</strong> <span className="text-[#686173]">{log.action.toLowerCase()}</span>{log.target_type && <> <strong>{log.target_type}</strong>{log.target_id ? ` #${log.target_id}` : ''}</>}</p>
                  <p className="mt-1 text-xs text-[#8b8494]">{log.module} · {log.http_method} · IP {log.ip_address}{log.response_status ? ` · ${log.response_status}` : ''}</p>
                  {log.user_agent && <p className="mt-1 truncate text-[11px] text-[#aaa4b4]" title={log.user_agent}>{log.user_agent}</p>}
                </div>
                <time className="text-xs font-semibold text-[#686173] sm:text-right">{new Date(log.created_at).toLocaleString()}</time>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[#8b8494]">{pagination.total} total entries · Page {pagination.current_page} of {pagination.last_page}</p>
        <div className="flex gap-2">
          <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-3 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50">Previous</button>
          <button type="button" disabled={page >= pagination.last_page} onClick={() => setPage((current) => Math.min(pagination.last_page, current + 1))} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-3 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50">Next</button>
        </div>
      </div>
    </section>
  )
}
