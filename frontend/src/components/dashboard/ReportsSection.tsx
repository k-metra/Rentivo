import { motion, useReducedMotion } from 'framer-motion'
import { useMemo, useState } from 'react'
import type { Booking, BookingSource, Partner, Payment, Vehicle } from '../../pages/dashboardTypes'
import SearchableSelect from '../SearchableSelect'

type Props = {
  activeSection: string
  bookings: Booking[]
  payments: Payment[]
  vehicles: Vehicle[]
  partners: Partner[]
  bookingSources: BookingSource[]
}

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })

function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const csv = rows
    .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
    .join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const partnerLabel = (partner: Partner) =>
  partner.name || [partner.first_name, partner.middle_name, partner.last_name].filter(Boolean).join(' ')

export function ReportsSection({ activeSection, bookings, payments, vehicles, partners }: Props) {
  const prefersReducedMotion = useReducedMotion()
  const [commissionPeriod, setCommissionPeriod] = useState<'today' | 'month' | 'year' | 'all' | 'custom'>('month')
  const [commissionPartner, setCommissionPartner] = useState('')
  const [commissionPartnerSearch, setCommissionPartnerSearch] = useState('')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const paidPayments = payments.filter((payment) => payment.status === 'paid')

  const commissionData = useMemo(() => {
    const now = new Date()
    const inPeriod = (value?: string | null) => {
      if (!value) return commissionPeriod === 'all'
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return false
      if (commissionPeriod === 'today') return date.toDateString() === now.toDateString()
      if (commissionPeriod === 'month') return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
      if (commissionPeriod === 'year') return date.getFullYear() === now.getFullYear()
      if (commissionPeriod === 'custom') {
        if (!customStart && !customEnd) return true
        const start = customStart ? new Date(`${customStart}T00:00:00`) : null
        const end = customEnd ? new Date(`${customEnd}T23:59:59`) : null
        return (!start || date >= start) && (!end || date <= end)
      }
      return true
    }

    const paidRows = bookings.map((booking) => {
      const paid = (booking.payments ?? []).filter((payment) => payment.status === 'paid')
      const paidAmount = paid.reduce((sum, payment) => sum + Number(payment.amount), 0)
      const latestPaidAt = paid
        .map((payment) => payment.paid_at)
        .filter((value): value is string => Boolean(value))
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
      const isFullyPaid = booking.payment_status === 'paid' || paidAmount + 0.001 >= Number(booking.total_amount)
      if (!isFullyPaid) return null
      const periodDate = latestPaidAt || (booking as Booking & { pickup_at?: string }).pickup_at
      if (!periodDate || !inPeriod(periodDate)) return null
      const vehicle = booking.vehicle
      const vehicleRecord = vehicles.find((item) => item.id === vehicle?.id)
      const vehiclePartner = vehicle?.partner
        || vehicleRecord?.partner
        || (vehicle?.partner_id
          ? partners.find((partner) => partner.id === vehicle.partner_id)
          : vehicleRecord?.partner_id
            ? partners.find((partner) => partner.id === vehicleRecord.partner_id)
            : null)
      if (!vehiclePartner) return null
      const partner = partners.find((item) => item.id === vehiclePartner.id)
      if (!partner) return null
      if (commissionPartner && String(partner.id) !== commissionPartner) return null
      const revenue = Number(booking.total_amount)
      const partnerIncome = revenue * (Number(partner.commission_rate) / 100)
      return { booking, partner, vehicle, revenue, partnerIncome, companyIncome: revenue - partnerIncome }
    }).filter((row): row is NonNullable<typeof row> => Boolean(row))

    const partnerRows = partners
      .filter((partner) => !commissionPartner || String(partner.id) === commissionPartner)
      .map((partner) => {
        const rows = paidRows.filter((row) => row.partner.id === partner.id)
        return {
          partner,
          revenue: rows.reduce((sum, row) => sum + row.revenue, 0),
          partnerIncome: rows.reduce((sum, row) => sum + row.partnerIncome, 0),
          companyIncome: rows.reduce((sum, row) => sum + row.companyIncome, 0),
          bookingCount: rows.length,
          vehicleCount: new Set(rows.map((row) => row.vehicle?.id).filter(Boolean)).size,
        }
      })
      .filter((row) => row.bookingCount > 0)
      .sort((a, b) => b.revenue - a.revenue)

    const vehicleRows = paidRows.reduce<Array<{ vehicle: NonNullable<typeof paidRows[number]>['vehicle']; partner: Partner; revenue: number; partnerIncome: number; companyIncome: number; bookingCount: number }>>((rows, row) => {
      const id = row.vehicle?.id
      const existing = id ? rows.find((item) => item.vehicle?.id === id) : undefined
      if (existing) {
        existing.revenue += row.revenue
        existing.partnerIncome += row.partnerIncome
        existing.companyIncome += row.companyIncome
        existing.bookingCount += 1
      } else {
        rows.push({ vehicle: row.vehicle, partner: row.partner, revenue: row.revenue, partnerIncome: row.partnerIncome, companyIncome: row.companyIncome, bookingCount: 1 })
      }
      return rows
    }, []).sort((a, b) => b.revenue - a.revenue)

    const tieUpRevenue = partnerRows.reduce((sum, row) => sum + row.revenue, 0)
    const partnerIncome = partnerRows.reduce((sum, row) => sum + row.partnerIncome, 0)
    const companyCommission = partnerRows.reduce((sum, row) => sum + row.companyIncome, 0)
    return { paidRows, partnerRows, vehicleRows, tieUpRevenue, partnerIncome, companyCommission }
  }, [bookings, commissionPartner, commissionPeriod, customEnd, customStart, partners, vehicles])

  if (activeSection === 'Fleet Utilization Report') {
    const rows = vehicles.map((vehicle) => {
      const vehicleBookings = bookings.filter((booking) =>
        booking.vehicle?.id === vehicle.id &&
        ['pending','confirmed','upcoming','pre_inspection','ongoing','active','complete','completed'].includes(booking.status),
      )
      const bookedDays = vehicleBookings.reduce((sum, booking) => {
        const start = new Date(booking.pickup_at)
        const end = new Date(booking.return_at)
        return sum + Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000))
      }, 0)
      const utilization = Math.min(100, Math.round((bookedDays / 30) * 100))
      return { vehicle, bookingCount: vehicleBookings.length, bookedDays, idleDays: Math.max(0, 30 - bookedDays), utilization }
    })
    const average = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.utilization, 0) / rows.length) : 0
    const exportRows: Array<Array<string | number>> = [
      ['Vehicle','Plate','Bookings','Booked days','Idle days','Utilization'],
      ...rows.map((row) => [row.vehicle.name || `${row.vehicle.brand} ${row.vehicle.model}`, row.vehicle.plate_number, row.bookingCount, row.bookedDays, row.idleDays, `${row.utilization}%`]),
    ]
    return (
      <motion.section initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-2xl font-semibold">Fleet Utilization Report</h2><p className="mt-1 text-sm text-[#8b8494]">Vehicle activity across the current 30-day period</p></div>
          <button type="button" onClick={() => downloadCsv('fleet-utilization.csv', exportRows)} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-4 py-2.5 text-sm font-bold text-[#686173]">Export CSV</button>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-[#2c0f73]/10 bg-white p-5"><p className="text-sm text-[#8b8494]">Average utilization</p><p className="mt-2 text-2xl font-bold">{average}%</p></div>
          <div className="rounded-xl border border-[#2c0f73]/10 bg-white p-5"><p className="text-sm text-[#8b8494]">Active vehicles</p><p className="mt-2 text-2xl font-bold">{vehicles.filter((vehicle) => vehicle.status !== 'maintenance').length}</p></div>
          <div className="rounded-xl border border-[#2c0f73]/10 bg-white p-5"><p className="text-sm text-[#8b8494]">Rental bookings</p><p className="mt-2 text-2xl font-bold">{bookings.length}</p></div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-[#2c0f73]/10 bg-white">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead><tr className="border-b border-[#eeeaf3] text-[10px] uppercase tracking-widest text-[#8b8494]"><th className="p-4">Vehicle</th><th className="p-4">Plate</th><th className="p-4 text-right">Bookings</th><th className="p-4 text-right">Booked days</th><th className="p-4 text-right">Idle days</th><th className="p-4 text-right">Utilization</th></tr></thead>
            <tbody>{rows.map((row) => <tr key={row.vehicle.id} className="border-b border-[#f3f1f6] last:border-0"><td className="p-4 font-semibold">{row.vehicle.name || `${row.vehicle.brand} ${row.vehicle.model}`}</td><td className="p-4 text-[#686173]">{row.vehicle.plate_number}</td><td className="p-4 text-right">{row.bookingCount}</td><td className="p-4 text-right">{row.bookedDays}</td><td className="p-4 text-right">{row.idleDays}</td><td className="p-4 text-right font-bold text-[#5b21b6]">{row.utilization}%</td></tr>)}</tbody>
          </table>
        </div>
      </motion.section>
    )
  }

  if (activeSection === 'Income Flow Report') {
    const inflow = paidPayments.reduce((sum, payment) => sum + Number(payment.amount), 0)
    const cash = paidPayments.filter((payment) => payment.method.toLowerCase().includes('cash')).reduce((sum, payment) => sum + Number(payment.amount), 0)
    const exportRows: Array<Array<string | number>> = [
      ['Date','Customer','Method','Type','Amount'],
      ...paidPayments.map((payment) => [payment.paid_at ? new Date(payment.paid_at).toLocaleString() : '—', payment.booking?.customer?.name ?? '—', payment.method, 'Income', Number(payment.amount)]),
    ]
    return (
      <motion.section initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-2xl font-semibold">Income Flow Report</h2><p className="mt-1 text-sm text-[#8b8494]">Recorded payment inflows across the workspace</p></div>
          <button type="button" onClick={() => downloadCsv('income-flow.csv', exportRows)} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-4 py-2.5 text-sm font-bold text-[#686173]">Export CSV</button>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-[#2c0f73]/10 bg-white p-5"><p className="text-sm text-[#8b8494]">Total income</p><p className="mt-2 text-2xl font-bold text-[#16a34a]">{peso.format(inflow)}</p></div>
          <div className="rounded-xl border border-[#2c0f73]/10 bg-white p-5"><p className="text-sm text-[#8b8494]">Transactions</p><p className="mt-2 text-2xl font-bold">{paidPayments.length}</p></div>
          <div className="rounded-xl border border-[#2c0f73]/10 bg-white p-5"><p className="text-sm text-[#8b8494]">Cash income</p><p className="mt-2 text-2xl font-bold">{peso.format(cash)}</p></div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-[#2c0f73]/10 bg-white">
          <table className="w-full min-w-[780px] text-left text-sm"><thead><tr className="border-b border-[#eeeaf3] text-[10px] uppercase tracking-widest text-[#8b8494]"><th className="p-4">Date</th><th className="p-4">Customer</th><th className="p-4">Method</th><th className="p-4 text-right">Amount</th></tr></thead><tbody>{paidPayments.map((payment) => <tr key={payment.id} className="border-b border-[#f3f1f6] last:border-0"><td className="p-4 text-[#686173]">{payment.paid_at ? new Date(payment.paid_at).toLocaleString() : '—'}</td><td className="p-4">{payment.booking?.customer?.name ?? '—'}</td><td className="p-4">{payment.method}</td><td className="p-4 text-right font-bold text-[#16a34a]">+{peso.format(Number(payment.amount))}</td></tr>)}</tbody></table>
        </div>
      </motion.section>
    )
  }

  if (activeSection === 'Revenue') {
    const rows = vehicles.map((vehicle) => {
      const vehicleBookings = bookings.filter((booking) => booking.vehicle?.id === vehicle.id)
      const bookingRevenue = vehicleBookings.reduce((sum, booking) => sum + Number(booking.total_amount), 0)
      const collected = vehicleBookings.reduce((sum, booking) => sum + (booking.payments ?? []).filter((payment) => payment.status === 'paid').reduce((paid, payment) => paid + Number(payment.amount), 0), 0)
      return { vehicle, bookingCount: vehicleBookings.length, bookingRevenue, collected, outstanding: Math.max(0, bookingRevenue - collected) }
    })
    const bookingRevenue = rows.reduce((sum, row) => sum + row.bookingRevenue, 0)
    const collected = rows.reduce((sum, row) => sum + row.collected, 0)
    const outstanding = rows.reduce((sum, row) => sum + row.outstanding, 0)
    const exportRows: Array<Array<string | number>> = [['Vehicle','Plate','Bookings','Booking revenue','Collected','Outstanding'], ...rows.map((row) => [row.vehicle.name || `${row.vehicle.brand} ${row.vehicle.model}`, row.vehicle.plate_number, row.bookingCount, row.bookingRevenue, row.collected, row.outstanding])]
    return (
      <motion.section initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-2xl font-semibold">Vehicle Revenue</h2><p className="mt-1 text-sm text-[#8b8494]">Booking value, collected payments, and outstanding balances by vehicle</p></div>
          <button type="button" onClick={() => downloadCsv('vehicle-revenue.csv', exportRows)} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-4 py-2.5 text-sm font-bold text-[#686173]">Export CSV</button>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-[#2c0f73]/10 bg-white p-5"><p className="text-sm text-[#8b8494]">Booking revenue</p><p className="mt-2 text-2xl font-bold">{peso.format(bookingRevenue)}</p></div>
          <div className="rounded-xl border border-[#2c0f73]/10 bg-white p-5"><p className="text-sm text-[#8b8494]">Collected</p><p className="mt-2 text-2xl font-bold text-[#16a34a]">{peso.format(collected)}</p></div>
          <div className="rounded-xl border border-[#2c0f73]/10 bg-white p-5"><p className="text-sm text-[#8b8494]">Outstanding</p><p className="mt-2 text-2xl font-bold text-[#b45309]">{peso.format(outstanding)}</p></div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-[#2c0f73]/10 bg-white">
          <table className="w-full min-w-[900px] text-left text-sm"><thead><tr className="border-b border-[#eeeaf3] text-[10px] uppercase tracking-widest text-[#8b8494]"><th className="p-4">Vehicle</th><th className="p-4">Plate</th><th className="p-4 text-right">Bookings</th><th className="p-4 text-right">Booking revenue</th><th className="p-4 text-right">Collected</th><th className="p-4 text-right">Outstanding</th></tr></thead><tbody>{rows.map((row) => <tr key={row.vehicle.id} className="border-b border-[#f3f1f6] last:border-0"><td className="p-4 font-semibold">{row.vehicle.name || `${row.vehicle.brand} ${row.vehicle.model}`}</td><td className="p-4 text-[#686173]">{row.vehicle.plate_number}</td><td className="p-4 text-right">{row.bookingCount}</td><td className="p-4 text-right font-semibold">{peso.format(row.bookingRevenue)}</td><td className="p-4 text-right text-[#16a34a]">{peso.format(row.collected)}</td><td className="p-4 text-right text-[#b45309]">{peso.format(row.outstanding)}</td></tr>)}</tbody></table>
        </div>
      </motion.section>
    )
  }

  const filteredPartnerRows = commissionData.partnerRows.filter((row) =>
    partnerLabel(row.partner).toLowerCase().includes(commissionPartnerSearch.toLowerCase()),
  )
  const exportRows: Array<Array<string | number>> = [
    ['Partner','Commission','Paid bookings','Tie-up revenue','Partner income','Company commission'],
    ...commissionData.partnerRows.map((row) => [
      partnerLabel(row.partner),
      `${Number(row.partner.commission_rate).toLocaleString('en-PH')}%`,
      row.bookingCount,
      row.revenue,
      row.partnerIncome,
      row.companyIncome,
    ]),
  ]
  const topPartners = commissionData.partnerRows.slice(0, 5)
  const maxPartnerRevenue = Math.max(1, ...topPartners.map((row) => row.revenue))

  return (
    <motion.section initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-2xl font-semibold">Commissions Report</h2><p className="mt-1 text-sm text-[#8b8494]">Partner earnings from fully paid partner bookings.</p></div>
        <button type="button" onClick={() => downloadCsv('commissions.csv', exportRows)} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-4 py-2.5 text-sm font-bold text-[#686173]">Export CSV</button>
      </div>

      <div className="rounded-xl border border-[#2c0f73]/10 bg-white p-5">
        <div className="grid gap-4 md:grid-cols-[minmax(220px,1fr)_minmax(360px,1.6fr)]">
          <div><p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#8b8494]">Partner</p><SearchableSelect name="commission_partner" value={commissionPartner} placeholder="All partners" options={[{ value: '', label: 'All partners' }, ...partners.map((partner) => ({ value: String(partner.id), label: partnerLabel(partner), searchText: `${partner.type} ${partner.email ?? ''}` }))]} onChange={setCommissionPartner} /></div>
          <div><p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#8b8494]">Reporting period</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-5">{[
            ['today', 'Today'],
            ['month', 'This Month'],
            ['year', 'This Year'],
            ['all', 'All Time'],
            ['custom', 'Custom'],
          ].map(([value, label]) => <button type="button" key={value} onClick={() => setCommissionPeriod(value as typeof commissionPeriod)} className={`cursor-pointer rounded-lg border px-3 py-3 text-xs font-bold ${commissionPeriod === value ? 'border-[#5b21b6] bg-[#ede9fe] text-[#5b21b6]' : 'border-[#dcd8e6] text-[#686173] hover:border-[#c4b5fd]'}`}>{label}</button>)}</div></div>
        </div>
        {commissionPeriod === 'custom' && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label><span className="mb-2 block text-xs font-bold text-[#686173]">Start date</span><input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} className="w-full rounded-lg border border-[#dcd8e6] px-3 py-2.5 text-sm" /></label>
            <label><span className="mb-2 block text-xs font-bold text-[#686173]">End date</span><input type="date" value={customEnd} min={customStart || undefined} onChange={(event) => setCustomEnd(event.target.value)} className="w-full rounded-lg border border-[#dcd8e6] px-3 py-2.5 text-sm" /></label>
          </div>
        )}
        <p className="mt-4 text-xs text-[#8b8494]">{commissionData.partnerRows.reduce((sum, row) => sum + row.bookingCount, 0)} fully paid partner booking(s) matched</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[#2c0f73]/10 bg-white p-5"><p className="text-sm text-[#8b8494]">Tie-Up Revenue</p><p className="mt-2 text-2xl font-bold">{peso.format(commissionData.tieUpRevenue)}</p><p className="mt-2 text-xs text-[#8b8494]">Revenue from fully paid partner bookings</p></div>
        <div className="rounded-xl border border-[#2c0f73]/10 bg-white p-5"><p className="text-sm text-[#8b8494]">Partner Income</p><p className="mt-2 text-2xl font-bold text-[#16a34a]">{peso.format(commissionData.partnerIncome)}</p><p className="mt-2 text-xs text-[#8b8494]">Allocated by each partner rate</p></div>
        <div className="rounded-xl border border-[#2c0f73]/10 bg-white p-5"><p className="text-sm text-[#8b8494]">Company Commission</p><p className="mt-2 text-2xl font-bold text-[#b45309]">{peso.format(commissionData.companyCommission)}</p><p className="mt-2 text-xs text-[#8b8494]">Revenue retained by the company</p></div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-xl border border-[#2c0f73]/10 bg-white p-5">
          <div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">Commission Distribution</h3><p className="mt-1 text-xs text-[#8b8494]">Partner income vs company share</p></div></div>
          {commissionData.partnerRows.length ? (
            <div className="mt-6 flex items-center justify-center">
              <div className="relative flex h-44 w-44 items-center justify-center rounded-full" style={{ background: `conic-gradient(#5b21b6 0 ${commissionData.partnerIncome + commissionData.companyCommission > 0 ? (commissionData.partnerIncome / (commissionData.partnerIncome + commissionData.companyCommission)) * 100 : 0}%, #e4b341 ${commissionData.partnerIncome + commissionData.companyCommission > 0 ? (commissionData.partnerIncome / (commissionData.partnerIncome + commissionData.companyCommission)) * 100 : 0}% 100%)` }}>
                <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-white text-center"><span className="text-[10px] uppercase tracking-wider text-[#8b8494]">Partner income</span><strong className="mt-1 text-sm">{peso.format(commissionData.partnerIncome)}</strong></div>
              </div>
            </div>
          ) : <div className="py-12 text-center text-sm text-[#8b8494]">No commission data for this period</div>}
        </div>
        <div className="rounded-xl border border-[#2c0f73]/10 bg-white p-5">
          <div className="flex items-center justify-between"><div><h3 className="font-bold">Top Partner Performance</h3><p className="mt-1 text-xs text-[#8b8494]">Highest tie-up revenue partners</p></div><span className="text-xs text-[#8b8494]">Top {topPartners.length}</span></div>
          {topPartners.length ? <div className="mt-5 space-y-4">{topPartners.map((row) => <div key={row.partner.id}><div className="mb-2 flex justify-between gap-3 text-sm"><span className="font-semibold">{partnerLabel(row.partner)}</span><strong>{peso.format(row.revenue)}</strong></div><div className="h-2 overflow-hidden rounded-full bg-[#ede9fe]"><div className="h-full rounded-full bg-[#5b21b6]" style={{ width: `${(row.revenue / maxPartnerRevenue) * 100}%` }} /></div><p className="mt-1 text-xs text-[#8b8494]">{row.bookingCount} paid booking(s) · {row.partner.commission_rate}% commission</p></div>)}</div> : <div className="py-12 text-center text-sm text-[#8b8494]">No partner performance data</div>}
        </div>
      </div>

      <div className="rounded-xl border border-[#2c0f73]/10 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold">Partner Summary</h3><p className="mt-1 text-xs text-[#8b8494]">Revenue, income, and company share grouped by partner</p></div><div className="w-full sm:w-72"><input value={commissionPartnerSearch} onChange={(event) => setCommissionPartnerSearch(event.target.value)} placeholder="Search partners" className="w-full rounded-lg border border-[#dcd8e6] px-4 py-2.5 text-sm" /></div></div>
        {filteredPartnerRows.length ? <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b border-[#eeeaf3] text-[10px] uppercase tracking-widest text-[#8b8494]"><th className="p-4">Partner</th><th className="p-4">Commission</th><th className="p-4 text-right">Paid bookings</th><th className="p-4 text-right">Tie-up revenue</th><th className="p-4 text-right">Partner income</th><th className="p-4 text-right">Company share</th></tr></thead><tbody>{filteredPartnerRows.map((row) => <tr key={row.partner.id} className="border-b border-[#f3f1f6] last:border-0"><td className="p-4 font-semibold">{partnerLabel(row.partner)}</td><td className="p-4">{Number(row.partner.commission_rate).toLocaleString('en-PH')}%</td><td className="p-4 text-right">{row.bookingCount}</td><td className="p-4 text-right font-semibold">{peso.format(row.revenue)}</td><td className="p-4 text-right text-[#16a34a]">{peso.format(row.partnerIncome)}</td><td className="p-4 text-right text-[#b45309]">{peso.format(row.companyIncome)}</td></tr>)}</tbody></table></div> : <div className="py-12 text-center text-sm text-[#8b8494]">No partners match the selected filters.</div>}
      </div>

      <div className="rounded-xl border border-[#2c0f73]/10 bg-white p-5">
        <div><h3 className="font-bold">Vehicle Commission Breakdown</h3><p className="mt-1 text-xs text-[#8b8494]">Partner vehicle revenue and commission totals</p></div>
        {commissionData.vehicleRows.length ? <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead><tr className="border-b border-[#eeeaf3] text-[10px] uppercase tracking-widest text-[#8b8494]"><th className="p-4">Vehicle</th><th className="p-4">Partner</th><th className="p-4 text-right">Paid bookings</th><th className="p-4 text-right">Revenue</th><th className="p-4 text-right">Partner income</th><th className="p-4 text-right">Company share</th></tr></thead><tbody>{commissionData.vehicleRows.map((row) => <tr key={row.vehicle?.id ?? partnerLabel(row.partner)} className="border-b border-[#f3f1f6] last:border-0"><td className="p-4 font-semibold">{row.vehicle ? [row.vehicle.name, row.vehicle.brand, row.vehicle.model, row.vehicle.year].filter(Boolean).join(' · ') : 'Vehicle unavailable'}</td><td className="p-4">{partnerLabel(row.partner)}</td><td className="p-4 text-right">{row.bookingCount}</td><td className="p-4 text-right font-semibold">{peso.format(row.revenue)}</td><td className="p-4 text-right text-[#16a34a]">{peso.format(row.partnerIncome)}</td><td className="p-4 text-right text-[#b45309]">{peso.format(row.companyIncome)}</td></tr>)}</tbody></table></div> : <div className="py-12 text-center text-sm text-[#8b8494]">No vehicle commission data matches the selected filters.</div>}
      </div>
    </motion.section>
  )
}
