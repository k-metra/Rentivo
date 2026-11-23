import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import wordmark from '../assets/rentivo-purple-wing-logo.png'
import { provinces } from '../data/philippines'
import { citiesByProvince } from '../data/philippines'
import { DashboardIcon as Icon, type DashboardIconName as IconName } from '../components/dashboard/DashboardIcon'
import { OverviewSection } from '../components/dashboard/OverviewSection'
import { CalendarSection } from '../components/dashboard/CalendarSection'
import { ContractBuilderSection } from '../components/dashboard/ContractBuilderSection'
import { DataSections } from '../components/dashboard/DataSections'
import { VehiclesSection } from '../components/dashboard/VehiclesSection'
import { BookingsSection, type BookingSectionItem } from '../components/dashboard/BookingsSection'
import { VehicleModal } from '../components/dashboard/VehicleModal'
import { BookingModal } from '../components/dashboard/BookingModal'
import { PaymentModal } from '../components/dashboard/PaymentModal'
import { ExtensionModal } from '../components/dashboard/ExtensionModal'
import { ConfirmationModal } from '../components/dashboard/ConfirmationModal'
import { CrudModal } from '../components/dashboard/CrudModal'
import { CustomerProfileDrawer } from '../components/dashboard/CustomerProfileDrawer'
import { FundsSection } from '../components/dashboard/FundsSection'
import { ExpensesSection } from '../components/dashboard/ExpensesSection'
import { RentalOperationsSection } from '../components/dashboard/RentalOperationsSection'
import { PartnersSection } from '../components/dashboard/PartnersSection'
import { ReportsSection } from '../components/dashboard/ReportsSection'
import { SettingsSection } from '../components/dashboard/SettingsSection'
import { BookingDetailsDrawer } from '../components/dashboard/BookingDetailsDrawer'
import {
  bookingDateTime,
  bookingStatusLabel,
  parseBookingDateTime,
  vehicleBookingLabel,
} from '../components/dashboard/dashboardUtils'

type Summary = {
  organization: {
    name: string
    currency: string
    plan?: string
    subscription_status?: string
    trial_started_at?: string | null
    trial_ends_at?: string | null
    subscription_started_at?: string | null
    subscription_ends_at?: string | null
    billing_currency?: string
    logo_path?: string | null
    logo_url?: string | null
  }
  stats: { month_revenue: number; revenue_change: number; active_bookings: number; fleet_utilization: number; total_customers: number; total_vehicles: number; rented_vehicles: number; available_vehicles: number; service_vehicles: number }
  upcoming_bookings: Array<{ id: number; reference: string; pickup_at: string; return_at: string; status: string; customer?: { name: string }; vehicle?: { name?: string; brand: string; model: string; year?: number; image_path?: string; image_url?: string } }>
  recent_activity: Array<{ title: string; text: string; time: string }>
  revenue_by_month: Array<{ period: string; value: number }>
}
type Vehicle = {
  id: number
  partner_id?: number | null
  partner?: { id: number; name: string; first_name?: string; middle_name?: string; last_name?: string }
  name?: string
  brand: string
  model: string
  year: number
  color?: string
  plate_number: string
  seat_count?: number
  type: string
  daily_rate: number | string
  security_deposit?: number | string
  hourly_extension_rate?: number | string
  mileage_limit?: number
  mileage_limit_unit?: 'rental' | 'day'
  excess_mileage_rate?: number | string
  transmission?: string
  fuel_type?: string
  status: string
  image_path?: string
  image_url?: string
  rental_rates?: Array<{ duration_hours: number; amount: number | string; outside_amount?: number | string; coverage_type?: string; coverage_locations?: string[] }>
}
type CustomerAttachment = { id: number; category: string; file_path: string; original_name: string; url?: string }
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
  archived_at?: string | null
  bookings_count?: number
  bookings?: Booking[]
  attachments?: CustomerAttachment[]
}
type Booking = { id: number; reference: string; pickup_at: string; return_at: string; status: string; payment_status: string; rental_amount: number | string; custom_rental_rate?: boolean; additional_charges?: number | string; total_amount: number | string; destination_city?: string; destination_province?: string; remarks?: string; payments?: Payment[]; customer?: { id?: number; name: string }; vehicle?: { id?: number; name?: string; brand: string; model: string; year?: number; plate_number: string; image_path?: string; image_url?: string } }
type Payment = { id: number; amount: number | string; method: string; status: string; paid_at?: string | null; notes?: string; creator?: { name: string }; booking?: { customer?: { name: string } } }
type WorkspaceUser = { id: number; name: string; email: string; role: string }
type Partner = { id: number; name: string; type: string; email?: string; phone?: string; commission_rate: number | string; status: string }
type BookingSource = { id: number; name: string; type: string; commission_rate: number | string; status: string }
type BookingExtension = { id: number; previous_return_at: string; new_return_at: string; fee: number | string; pricing_mode: string; notes?: string; undone_at?: string | null; creator?: { name: string } }
type InspectionMedia = { id: number; section: string; media_type: string; url?: string; original_name: string; label?: string; condition?: string }
type BookingInspection = { id: number; fuel_level: number; odometer_reading: number; easytrip_balance: number | string; autosweep_balance: number | string; functions: Record<string, boolean>; tires: Record<string, string>; signature_data?: string; signer_name?: string; status: string; completed_at?: string; actual_release_at?: string; media?: InspectionMedia[] }
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

const defaultInspectionFunctions = (): Record<string, boolean> =>
  Object.fromEntries(inspectionFunctionLabels.map((label) => [label, true]))

const navGroups: Array<{ label: string; items: Array<{ label: string; icon: IconName }> }> = [
  { label: 'Workspace', items: [{ label: 'Overview', icon: 'grid' }, { label: 'Calendar', icon: 'calendar' }, { label: 'Contract Builder', icon: 'arrow' }] },
  { label: 'Rental Operations', items: [{ label: 'Bookings', icon: 'calendar' }, { label: 'Rental Operations', icon: 'grid' }, { label: 'Funds', icon: 'wallet' }, { label: 'Expenses', icon: 'wallet' }] },
  { label: 'People & Assets', items: [{ label: 'Partners', icon: 'users' }, { label: 'Customers', icon: 'users' }, { label: 'Vehicles', icon: 'car' }, { label: 'Booking Sources', icon: 'arrow' }] },
  { label: 'Reports & Analytics', items: [{ label: 'Fleet Utilization Report', icon: 'car' }, { label: 'Income Flow Report', icon: 'wallet' }, { label: 'Revenue', icon: 'wallet' }, { label: 'Commissions', icon: 'users' }] },
  { label: 'Administration', items: [{ label: 'Users', icon: 'users' }, { label: 'Roles', icon: 'settings' }] },
]

const sectionRouteMap: Record<string, string> = {
  Overview: 'overview',
  Calendar: 'calendar',
  'Contract Builder': 'contract-builder',
  Bookings: 'bookings',
  'Rental Operations': 'rental-operations',
  Funds: 'funds',
  Expenses: 'expenses',
  Partners: 'partners',
  Customers: 'customers',
  Vehicles: 'vehicles',
  'Booking Sources': 'booking-sources',
  'Fleet Utilization Report': 'fleet-utilization',
  'Income Flow Report': 'income-flow',
  'Revenue': 'revenue',
  Commissions: 'commissions',
  Users: 'users',
  Roles: 'roles',
  Settings: 'settings',
}

const routeSectionMap = Object.fromEntries(
  Object.entries(sectionRouteMap).map(([section, route]) => [route, section]),
) as Record<string, string>

function bookingPaidAmount(booking: Booking & { payments?: Payment[] }) {
  return (booking.payments ?? [])
    .filter((payment) => payment.status === 'paid')
    .reduce((sum, payment) => sum + Number(payment.amount), 0)
}

function bookingBalance(booking: Booking & { payments?: Payment[] }) {
  return Math.max(0, Number(booking.total_amount) - bookingPaidAmount(booking))
}

export default function DashboardPage() {
  const prefersReducedMotion = useReducedMotion()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false)
  const [headerModal, setHeaderModal] = useState<'profile' | 'subscription' | null>(null)
  const [currentUser, setCurrentUser] = useState<{ id: number; name: string; email: string } | null>(null)
  const [profileName, setProfileName] = useState('')
  const [profileEmail, setProfileEmail] = useState('')
  const [profilePassword, setProfilePassword] = useState('')
  const [profilePasswordConfirmation, setProfilePasswordConfirmation] = useState('')
  const [activeSection, setActiveSection] = useState('Overview')
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ Workspace: true, 'Rental Operations': true, 'People & Assets': true, 'Reports & Analytics': false, Administration: false })
  const [summary, setSummary] = useState<Summary | null>(null)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [workspaceUsers, setWorkspaceUsers] = useState<WorkspaceUser[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [bookingSources, setBookingSources] = useState<BookingSource[]>([])
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [contractTitle, setContractTitle] = useState(() => localStorage.getItem('rentivo_contract_title') || 'Vehicle Rental Agreement')
  const [contractContent, setContractContent] = useState(() => localStorage.getItem('rentivo_contract_content') || 'This Rental Agreement is entered into between the rental company and the customer. The vehicle shall be returned in good condition on or before the agreed return date.')
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [selectedVehicleId, setSelectedVehicleId] = useState('')
  const [quickAddCustomerOpen, setQuickAddCustomerOpen] = useState(false)
  const [quickCustomer, setQuickCustomer] = useState({ name: '', email: '', phone: '' })
  const [bookingRangeStart, setBookingRangeStart] = useState<Date | null>(null)
  const [bookingRangeEnd, setBookingRangeEnd] = useState<Date | null>(null)
  const [bookingPickupTime, setBookingPickupTime] = useState('08:00')
  const [bookingReturnTime, setBookingReturnTime] = useState('08:00')
  const [bookingDestinationProvince, setBookingDestinationProvince] = useState('')
  const [bookingDestinationCity, setBookingDestinationCity] = useState('')
  const [bookingCalendarMonth, setBookingCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [customRentalRate, setCustomRentalRate] = useState('')
  const [bookingCustomRentalRate, setBookingCustomRentalRate] = useState(false)
  const [bookingAdditionalCharges, setBookingAdditionalCharges] = useState('0')
  const [bookingRemarks, setBookingRemarks] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState<'booking' | 'vehicle' | 'customer' | 'partner' | 'source' | null>(null)
  const [editingBookingId, setEditingBookingId] = useState<number | null>(null)
  const [editingCustomerId, setEditingCustomerId] = useState<number | null>(null)
  const [showArchivedCustomers] = useState(false)
  const [customerFiles, setCustomerFiles] = useState<Record<string, File[]>>({})
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const vehicleModalClosedRef = useRef(false)
  const [confirmation, setConfirmation] = useState<{
    title: string
    description: string
    confirmLabel: string
    tone: 'danger' | 'primary'
    action: () => void | Promise<void>
  } | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<(Booking & {
    customer?: Customer
    vehicle?: Vehicle
    extensions?: BookingExtension[]
    payments?: Payment[]
  }) | null>(null)
  const [bookingDetailTab, setBookingDetailTab] = useState<'details' | 'extensions' | 'customer' | 'payments' | 'pre-inspection' | 'post-inspection'>('details')
  const [extensionModal, setExtensionModal] = useState(false)
  const [extensionReturnAt, setExtensionReturnAt] = useState('')
  const [extensionPricingMode, setExtensionPricingMode] = useState<'hourly' | 'twelve_hour'>('hourly')
  const [extensionFee, setExtensionFee] = useState('')
  const [paymentModal, setPaymentModal] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [paymentPaidAt, setPaymentPaidAt] = useState(() => new Date().toISOString().slice(0, 16))
  const [paymentNotes, setPaymentNotes] = useState('')
  const [paymentFundId, setPaymentFundId] = useState('')
  const [paymentFunds, setPaymentFunds] = useState<Array<{ id: number; name: string; type: string }>>([])
  const [inspection, setInspection] = useState<BookingInspection | null>(null)
  const [inspectionFuel, setInspectionFuel] = useState(100)
  const [inspectionOdometer, setInspectionOdometer] = useState('')
  const [inspectionEasytrip, setInspectionEasytrip] = useState('')
  const [inspectionAutosweep, setInspectionAutosweep] = useState('')
  const [inspectionFunctions, setInspectionFunctions] = useState<Record<string, boolean>>({
    'Lights': true,
    'Doors & Locks': true,
    'Wipers & Washer': true,
    'Airconditioner': true,
    'Handbrake/Parkbrake': true,
    'Windows/Sunroof': true,
    'Radio/Infotainment': true,
    'Horn': true,
    'Dashcam/Recording': true,
    'Fuel Cap/Door': true,
  })
  const [inspectionTires, setInspectionTires] = useState<Record<string, string>>({})
  const [inspectionSigner, setInspectionSigner] = useState('')
  const [inspectionReleaseAt, setInspectionReleaseAt] = useState('')
  const [exteriorFiles, setExteriorFiles] = useState<File[]>([])
  const [interiorFiles, setInteriorFiles] = useState<File[]>([])
  const [inspectionMediaLabels, setInspectionMediaLabels] = useState<Record<string, string>>({})
  const [inspectionMediaConditions, setInspectionMediaConditions] = useState<Record<string, string>>({})
  const [inspectionSignatureData, setInspectionSignatureData] = useState('')
  const [postInspection, setPostInspection] = useState<BookingPostInspection | null>(null)
  const [postInspectionFuel, setPostInspectionFuel] = useState(100)
  const [postInspectionOdometer, setPostInspectionOdometer] = useState('')
  const [postInspectionEasytrip, setPostInspectionEasytrip] = useState('')
  const [postInspectionAutosweep, setPostInspectionAutosweep] = useState('')
  const [postInspectionFunctions, setPostInspectionFunctions] = useState<Record<string, boolean>>(defaultInspectionFunctions)
  const [postInspectionTires, setPostInspectionTires] = useState<Record<string, string>>({})
  const [postInspectionSigner, setPostInspectionSigner] = useState('')
  const [postInspectionActualReturnAt, setPostInspectionActualReturnAt] = useState('')
  const [postExteriorFiles, setPostExteriorFiles] = useState<File[]>([])
  const [postInteriorFiles, setPostInteriorFiles] = useState<File[]>([])
  const [postInspectionSignatureData, setPostInspectionSignatureData] = useState('')
  const [postMediaLabels, setPostMediaLabels] = useState<Record<string, string>>({})
  const [postMediaConditions, setPostMediaConditions] = useState<Record<string, string>>({})
  const [vehicleModalMode, setVehicleModalMode] = useState<'create' | 'view' | 'edit'>('create')
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [selectedDurations, setSelectedDurations] = useState<number[]>([24])
  const [coverageByDuration, setCoverageByDuration] = useState<Record<number, { type: 'all' | 'province' | 'region'; locations: string[] }>>({})
  const [outsideCharges, setOutsideCharges] = useState<Record<number, string>>({})
  const [vehicleImagePreview, setVehicleImagePreview] = useState('')
  const [vehicleDraftImage, setVehicleDraftImage] = useState('')
  const [vehicleDraftValues, setVehicleDraftValues] = useState<Record<string, string>>({})
  const vehicleFormRef = useRef<HTMLFormElement | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const companyName = localStorage.getItem('rentivo_pending_company') || summary?.organization.name || 'Your Rental Company'
  const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api'
  const token = localStorage.getItem('rentivo_access_token')
  const storageBaseUrl = apiBaseUrl.replace(/\/api\/?$/, '')
  const companyLogoUrl = summary?.organization.logo_url
    ? (summary.organization.logo_url.startsWith('http') ? summary.organization.logo_url : `${storageBaseUrl}${summary.organization.logo_url}`)
    : summary?.organization.logo_path
      ? `${storageBaseUrl}/storage/${summary.organization.logo_path.replace(/^\/+/, '').replace(/^storage\//, '')}`
      : ''
  const userInitials = (currentUser?.name || 'Admin User')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
  const planName = summary?.organization.plan ?? 'Business'
  const planLimits: Record<string, number> = { Solo: 3, Growth: 7, Professional: 15, Business: 35, Enterprise: 9999 }
  const vehicleLimit = planLimits[planName] ?? 35
  const trialStartedAt = summary?.organization.trial_started_at
  const trialEndsAt = summary?.organization.trial_ends_at
  const subscriptionStartedAt = summary?.organization.subscription_started_at
  const subscriptionEndsAt = summary?.organization.subscription_ends_at
  const isFreeTrial = summary?.organization.subscription_status === 'free_trial'
  const subscriptionStart = isFreeTrial ? trialStartedAt : subscriptionStartedAt
  const subscriptionEnd = isFreeTrial ? trialEndsAt : subscriptionEndsAt
  const subscriptionStartLabel = subscriptionStart ? new Date(subscriptionStart).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not available'
  const subscriptionEndLabel = subscriptionEnd ? new Date(subscriptionEnd).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not available'
  const billingCycleLabel = isFreeTrial ? '21 days' : 'Monthly'
  const subscriptionStatus = summary?.organization.subscription_status
  const activeSubscriptionEnd = isFreeTrial ? trialEndsAt : subscriptionEndsAt
  const remainingSubscriptionDays = activeSubscriptionEnd
    ? Math.ceil((new Date(activeSubscriptionEnd).getTime() - Date.now()) / 86400000)
    : null
  const remainingSubscriptionLabel = remainingSubscriptionDays === null
    ? ''
    : remainingSubscriptionDays === 0
      ? 'less than a day'
      : `${remainingSubscriptionDays} ${remainingSubscriptionDays === 1 ? 'day' : 'days'}`
  const subscriptionNotice = subscriptionStatus === 'expired'
    ? {
        title: isFreeTrial ? 'Your free trial has expired' : 'Your subscription has expired',
        detail: 'Renew your plan to continue using all Rentivo workspace features.',
        urgent: true,
      }
    : remainingSubscriptionDays !== null && remainingSubscriptionDays <= 7 && remainingSubscriptionDays >= 0
      ? {
          title: isFreeTrial
            ? `Your free trial ends in ${remainingSubscriptionLabel}`
            : `Your subscription ends in ${remainingSubscriptionLabel}`,
          detail: 'Renew or change your plan to avoid an interruption.',
          urgent: remainingSubscriptionDays <= 3,
        }
      : null

  const vehicleImageUrl = (vehicle: Pick<Vehicle, 'image_path' | 'image_url'>) => {
    if (vehicle.image_url) {
      if (vehicle.image_url.startsWith('http')) return vehicle.image_url
      if (vehicle.image_url.startsWith('/')) return `${storageBaseUrl}${vehicle.image_url}`
    }
    if (!vehicle.image_path) return ''
    if (vehicle.image_path.startsWith('http')) return vehicle.image_path
    const normalizedPath = vehicle.image_path.replace(/^\/+/, '').replace(/^storage\//, '')
    return `${storageBaseUrl}/storage/${normalizedPath}`
  }

  const authHeaders = { Accept: 'application/json', Authorization: `Bearer ${token}` }

  const reload = async () => {
    setLoading(true)
    setError('')
    try {
      const [summaryRes, vehiclesRes, customersRes, bookingsRes, paymentsRes, usersRes, partnersRes, sourcesRes] = await Promise.all([
        fetch(`${apiBaseUrl}/dashboard/summary`, { headers: authHeaders }),
        fetch(`${apiBaseUrl}/dashboard/vehicles`, { headers: authHeaders }),
        fetch(`${apiBaseUrl}/dashboard/customers${showArchivedCustomers ? '?include_archived=1' : ''}`, { headers: authHeaders }),
        fetch(`${apiBaseUrl}/dashboard/bookings`, { headers: authHeaders }),
        fetch(`${apiBaseUrl}/dashboard/payments`, { headers: authHeaders }),
        fetch(`${apiBaseUrl}/dashboard/users`, { headers: authHeaders }),
        fetch(`${apiBaseUrl}/dashboard/partners`, { headers: authHeaders }),
        fetch(`${apiBaseUrl}/dashboard/booking-sources`, { headers: authHeaders }),
      ])
      if ([summaryRes, vehiclesRes, customersRes, bookingsRes, paymentsRes, usersRes, partnersRes, sourcesRes].some((response) => !response.ok)) throw new Error('Unable to load workspace data.')
      setSummary(await summaryRes.json())
      setVehicles(await vehiclesRes.json())
      setCustomers(await customersRes.json())
      setBookings(await bookingsRes.json())
      setPayments(await paymentsRes.json())
      setWorkspaceUsers(await usersRes.json())
      setPartners(await partnersRes.json())
      setBookingSources(await sourcesRes.json())
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load workspace data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (token) void reload()
    else { setLoading(false); setError('Please sign in again to access this workspace.') }
  }, [])

  useEffect(() => {
    if (!token) return
    fetch(`${apiBaseUrl}/user`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error('Unable to load user')
        setCurrentUser(data)
        setProfileName(data.name ?? '')
        setProfileEmail(data.email ?? '')
      })
      .catch(() => setCurrentUser(null))
  }, [token])

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setFormError('')
    try {
      const payload: Record<string, string> = {
        name: profileName,
        email: profileEmail,
      }
      if (profilePassword) {
        payload.password = profilePassword
        payload.password_confirmation = profilePasswordConfirmation
      }
      const response = await fetch(`${apiBaseUrl}/user/profile`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.errors ? Object.values(data.errors).flat().join(' ') : data.message || 'Unable to update profile')
      }
      setCurrentUser(data)
      setProfilePassword('')
      setProfilePasswordConfirmation('')
      setToast({ type: 'success', message: 'Profile updated successfully.' })
      window.setTimeout(() => setToast(null), 4000)
      setHeaderModal(null)
    } catch (profileError) {
      setFormError(profileError instanceof Error ? profileError.message : 'Unable to update profile')
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    const parts = location.pathname.split('/').filter(Boolean)
    const route = parts.length > 1 ? parts[1] : 'overview'
    setActiveSection(routeSectionMap[route] ?? 'Overview')
  }, [location.pathname])

  const vehicleDraftKey = selectedVehicle?.id
    ? `rentivo_vehicle_draft_edit_${selectedVehicle.id}`
    : 'rentivo_vehicle_draft_create'

  const clearVehicleModal = () => {
    vehicleModalClosedRef.current = true
    localStorage.removeItem(vehicleDraftKey)
    setModal(null)
    setSelectedVehicle(null)
    setVehicleModalMode('create')
    setVehicleDraftValues({})
    setVehicleDraftImage('')
    setVehicleImagePreview('')
    setCoverageByDuration({})
    setOutsideCharges({})
    setSelectedDurations([24])
    const params = new URLSearchParams(location.search)
    params.delete('vehicle')
    params.delete('mode')
    navigate(`${location.pathname}${params.toString() ? `?${params}` : ''}`, { replace: true })
  }

  const openVehicle = (vehicle: Vehicle, mode: 'view' | 'edit') => {
    vehicleModalClosedRef.current = false
    setSelectedVehicle(vehicle)
    setVehicleModalMode(mode)
    setModal('vehicle')
    const imageUrl = vehicle.image_url || (vehicle.image_path ? `${storageBaseUrl}/storage/${vehicle.image_path}` : '')
    setVehicleImagePreview(imageUrl)
    setSelectedDurations(vehicle.rental_rates?.length ? vehicle.rental_rates.map((rate) => rate.duration_hours) : [24])
    const coverage: Record<number, { type: 'all' | 'province' | 'region'; locations: string[] }> = {}
    const charges: Record<number, string> = {}
    vehicle.rental_rates?.forEach((rate) => {
      coverage[rate.duration_hours] = {
        type: (rate.coverage_type as 'all' | 'province' | 'region') ?? 'all',
        locations: rate.coverage_locations ?? [],
      }
      charges[rate.duration_hours] = String(rate.outside_amount ?? '')
    })
    setCoverageByDuration(coverage)
    setOutsideCharges(charges)
    if (mode === 'edit') {
      const key = `rentivo_vehicle_draft_edit_${vehicle.id}`
      const saved = localStorage.getItem(key)
      if (saved) {
        try {
          const draft = JSON.parse(saved) as { values?: Record<string,string>; durations?: number[]; coverage?: typeof coverage; outside?: Record<number,string>; image?: string }
          setVehicleDraftValues(draft.values ?? {})
          setSelectedDurations(draft.durations ?? vehicle.rental_rates?.map((rate) => rate.duration_hours) ?? [24])
          setCoverageByDuration(draft.coverage ?? coverage)
          setOutsideCharges(draft.outside ?? charges)
          if (draft.image) { setVehicleDraftImage(draft.image); setVehicleImagePreview(draft.image) }
        } catch {
          localStorage.removeItem(key)
        }
      }
    }
    const params = new URLSearchParams(location.search)
    params.set('vehicle', String(vehicle.id))
    params.set('mode', mode)
    navigate(`${location.pathname}?${params}`, { replace: true })
  }

  const openCreateVehicle = () => {
    setSelectedVehicle(null)
    setVehicleModalMode('create')
    setSelectedDurations([24])
    setCoverageByDuration({})
    setOutsideCharges({})
    setVehicleDraftValues({})
    setVehicleDraftImage('')
    setVehicleImagePreview('')
    const saved = localStorage.getItem('rentivo_vehicle_draft_create')
    if (saved) {
      try {
        const draft = JSON.parse(saved) as { values?: Record<string,string>; durations?: number[]; coverage?: Record<number,{type:'all'|'province'|'region';locations:string[]}>; outside?: Record<number,string>; image?: string }
        setVehicleDraftValues(draft.values ?? {})
        setSelectedDurations(draft.durations ?? [24])
        setCoverageByDuration(draft.coverage ?? {})
        setOutsideCharges(draft.outside ?? {})
        if (draft.image) {
          setVehicleDraftImage(draft.image)
          setVehicleImagePreview(draft.image)
        }
      } catch {}
    }
    vehicleModalClosedRef.current = false
    setModal('vehicle')
    const params = new URLSearchParams(location.search)
    params.set('vehicle', 'create')
    params.set('mode', 'create')
    navigate(`${location.pathname}?${params}`, { replace: true })
  }

  const handleVehicleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const previewUrl = URL.createObjectURL(file)
    setVehicleImagePreview(previewUrl)
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result ?? '')
      setVehicleDraftImage(dataUrl)
      setVehicleImagePreview(dataUrl)
    }
    reader.readAsDataURL(file)
  }

  useEffect(() => {
    if (modal) return
    if (vehicleModalClosedRef.current) return
    const params = new URLSearchParams(location.search)
    const vehicleParam = params.get('vehicle')
    const mode = params.get('mode')
    if (!vehicleParam) return
    if (vehicleParam === 'create') {
      vehicleModalClosedRef.current = false
      setSelectedVehicle(null)
      setVehicleModalMode(mode === 'create' ? 'create' : 'create')
      setModal('vehicle')
      setVehicleDraftValues({})
      setVehicleDraftImage('')
      setVehicleImagePreview('')
      const saved = localStorage.getItem('rentivo_vehicle_draft_create')
      if (saved) {
        try {
          const draft = JSON.parse(saved) as { values?: Record<string,string>; durations?: number[]; coverage?: Record<number,{type:'all'|'province'|'region';locations:string[]}>; outside?: Record<number,string>; image?: string }
          setVehicleDraftValues(draft.values ?? {})
          setSelectedDurations(draft.durations ?? [24])
          setCoverageByDuration(draft.coverage ?? {})
          setOutsideCharges(draft.outside ?? {})
          if (draft.image) { setVehicleDraftImage(draft.image); setVehicleImagePreview(draft.image) }
        } catch {}
      }
      return
    }
    const vehicle = vehicles.find((item) => item.id === Number(vehicleParam))
    if (vehicle && (mode === 'view' || mode === 'edit')) openVehicle(vehicle, mode)
  }, [location.search, vehicles, modal])

  useEffect(() => {
    if (modal !== 'vehicle' || vehicleModalMode === 'view') return
    const draft = {
      values: vehicleDraftValues,
      durations: selectedDurations,
      coverage: coverageByDuration,
      outside: outsideCharges,
      image: vehicleDraftImage,
    }
    localStorage.setItem(vehicleDraftKey, JSON.stringify(draft))
  }, [modal, vehicleModalMode, vehicleDraftKey, vehicleDraftValues, selectedDurations, coverageByDuration, outsideCharges, vehicleDraftImage])

  useEffect(() => {
    if (modal !== 'vehicle' || vehicleModalMode === 'view' || !vehicleFormRef.current) return
    Object.entries(vehicleDraftValues).forEach(([name, value]) => {
      const field = vehicleFormRef.current?.elements.namedItem(name)
      if (field instanceof HTMLInputElement && field.type === 'file') return
      if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) {
        field.value = value
      }
    })
  }, [modal, vehicleModalMode, vehicleDraftValues])

  useEffect(() => {
    if (!modal) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (modal === 'vehicle') clearVehicleModal()
      else setModal(null)
    }
    window.addEventListener('keydown', handleEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleEscape)
    }
  }, [modal])

  useEffect(() => {
    if (!confirmation) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !confirming) setConfirmation(null)
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [confirmation, confirming])


  useEffect(() => {
    if (modal !== 'booking') return
    if (editingBookingId) return
    setSelectedCustomerId('')
    setSelectedVehicleId('')
    setQuickAddCustomerOpen(false)
    setQuickCustomer({ name: '', email: '', phone: '' })
    setBookingRangeStart(null)
    setBookingRangeEnd(null)
    setBookingPickupTime('08:00')
    setBookingReturnTime('08:00')
    setBookingDestinationProvince('')
    setBookingDestinationCity('')
    setCustomRentalRate('')
    setBookingCustomRentalRate(false)
    setBookingAdditionalCharges('0')
    setBookingRemarks('')
  }, [modal, editingBookingId])

  const dateKey = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const handleBookingDateClick = (date: Date) => {
    if (!bookingRangeStart || bookingRangeEnd) {
      setBookingRangeStart(date)
      setBookingRangeEnd(null)
      return
    }
    if (date < bookingRangeStart) {
      setBookingRangeEnd(bookingRangeStart)
      setBookingRangeStart(date)
    } else {
      setBookingRangeEnd(date)
    }
  }

  const quickAddCustomer = async () => {
    if (!quickCustomer.name.trim()) {
      setFormError('Enter a customer name.')
      return
    }
    setSubmitting(true)
    setFormError('')
    try {
      const response = await fetch(`${apiBaseUrl}/dashboard/customers`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: quickCustomer.name,
          email: quickCustomer.email || null,
          phone: quickCustomer.phone || null,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to add customer.')
      setCustomers((current) => [...current, data].sort((a, b) => a.name.localeCompare(b.name)))
      setSelectedCustomerId(String(data.id))
      setQuickCustomer({ name: '', email: '', phone: '' })
      setQuickAddCustomerOpen(false)
    } catch (quickError) {
      setFormError(quickError instanceof Error ? quickError.message : 'Unable to add customer.')
    } finally {
      setSubmitting(false)
    }
  }

  const openCustomerProfile = async (customer: Customer) => {
    setSelectedCustomer(customer)
    try {
      const response = await fetch(`${apiBaseUrl}/dashboard/customers/${customer.id}`, { headers: authHeaders })
      if (!response.ok) throw new Error('Unable to load customer profile.')
      setSelectedCustomer(await response.json())
    } catch (profileError) {
      setToast({
        type: 'error',
        message: profileError instanceof Error ? profileError.message : 'Unable to load customer profile.',
      })
      window.setTimeout(() => setToast(null), 5000)
    }
  }

  const openCustomerEdit = (customer: Customer) => {
    setEditingCustomerId(customer.id)
    setCustomerFiles({})
    setModal('customer')
  }

  const archiveCustomer = async (customer: Customer) => {
    setConfirmation({
      title: customer.archived_at ? 'Restore customer?' : 'Archive customer?',
      description: customer.archived_at
        ? `${customer.name} will become an active customer again.`
        : `${customer.name} will be hidden from active customer lists. Their booking history will remain intact.`,
      confirmLabel: customer.archived_at ? 'Restore customer' : 'Archive customer',
      tone: customer.archived_at ? 'primary' : 'danger',
      action: async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/dashboard/customers/${customer.id}/archive`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ archive: !customer.archived_at }),
      })
      if (!response.ok) throw new Error('Unable to change customer status.')
      await reload()
    } catch (actionError) {
      setToast({ type: 'error', message: actionError instanceof Error ? actionError.message : 'Unable to change customer status.' })
      window.setTimeout(() => setToast(null), 5000)
    }
      },
    })
  }

  const deleteCustomer = async (customer: Customer) => {
    setConfirmation({
      title: 'Delete customer permanently?',
      description: `${customer.name} will be permanently removed. This action cannot be undone.`,
      confirmLabel: 'Delete customer',
      tone: 'danger',
      action: async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/dashboard/customers/${customer.id}`, {
        method: 'DELETE',
        headers: authHeaders,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to delete customer.')
      await reload()
    } catch (actionError) {
      setToast({ type: 'error', message: actionError instanceof Error ? actionError.message : 'Unable to delete customer.' })
      window.setTimeout(() => setToast(null), 5000)
    }
      },
    })
  }

  const openBookingDetails = async (
    booking: BookingSectionItem,
    initialTab: 'details' | 'extensions' | 'customer' | 'payments' | 'pre-inspection' | 'post-inspection' = 'details',
  ) => {
    setSelectedBooking(booking as typeof selectedBooking)
    setBookingDetailTab(initialTab)
    try {
      const response = await fetch(`${apiBaseUrl}/dashboard/bookings/${booking.id}`, { headers: authHeaders })
      if (!response.ok) throw new Error('Unable to load booking details.')
      const data = await response.json()
      setSelectedBooking(data)
      let preInspectionData: BookingInspection | null = null
      const inspectionResponse = await fetch(`${apiBaseUrl}/dashboard/bookings/${booking.id}/inspection`, { headers: authHeaders })
      if (inspectionResponse.ok) {
        const inspectionData = await inspectionResponse.json()
        const saved = inspectionData.inspection as BookingInspection | null
        preInspectionData = saved
        setInspection(saved)
        if (saved) {
          setInspectionFuel(saved.fuel_level)
          setInspectionOdometer(String(saved.odometer_reading))
          setInspectionEasytrip(String(saved.easytrip_balance))
          setInspectionAutosweep(String(saved.autosweep_balance))
          setInspectionFunctions({
            'Lights': true,
            'Doors & Locks': true,
            'Wipers & Washer': true,
            'Airconditioner': true,
            'Handbrake/Parkbrake': true,
            'Windows/Sunroof': true,
            'Radio/Infotainment': true,
            'Horn': true,
            'Dashcam/Recording': true,
            'Fuel Cap/Door': true,
            ...(saved.functions ?? {}),
          })
          setInspectionTires(saved.tires ?? {})
          setInspectionSigner(saved.signer_name ?? '')
          setInspectionReleaseAt(saved.actual_release_at ? parseBookingDateTime(saved.actual_release_at).toISOString().slice(0,16) : '')
          setInspectionSignatureData(saved.signature_data ?? '')
        } else {
          setInspectionFuel(100)
          setInspectionOdometer('')
          setInspectionEasytrip('')
          setInspectionAutosweep('')
          setInspectionTires({})
          setInspectionSignatureData('')
          setInspectionFunctions({
            'Lights': true,
            'Doors & Locks': true,
            'Wipers & Washer': true,
            'Airconditioner': true,
            'Handbrake/Parkbrake': true,
            'Windows/Sunroof': true,
            'Radio/Infotainment': true,
            'Horn': true,
            'Dashcam/Recording': true,
            'Fuel Cap/Door': true,
          })
        }
      }
      const postResponse = await fetch(`${apiBaseUrl}/dashboard/bookings/${booking.id}/post-inspection`, { headers: authHeaders })
      if (postResponse.ok) {
        const postData = await postResponse.json()
        const savedPost = postData.inspection as BookingPostInspection | null
        setPostInspection(savedPost)
        setPostInspectionFuel(savedPost?.fuel_level ?? 100)
        setPostInspectionOdometer(String(savedPost?.odometer_reading ?? ''))
        setPostInspectionEasytrip(String(savedPost?.easytrip_balance ?? ''))
        setPostInspectionAutosweep(String(savedPost?.autosweep_balance ?? ''))
        setPostInspectionFunctions({
          ...defaultInspectionFunctions(),
          ...(preInspectionData?.functions ?? {}),
          ...(savedPost?.functions ?? {}),
        })
        setPostInspectionTires(savedPost?.tires ?? preInspectionData?.tires ?? {})
        setPostInspectionSigner(savedPost?.signer_name ?? '')
        setPostInspectionActualReturnAt(savedPost?.actual_return_at ? parseBookingDateTime(savedPost.actual_return_at).toISOString().slice(0,16) : '')
        setPostInspectionSignatureData(savedPost?.signature_data ?? '')
      }
    } catch (detailError) {
      setToast({ type: 'error', message: detailError instanceof Error ? detailError.message : 'Unable to load booking details.' })
      window.setTimeout(() => setToast(null), 5000)
    }
  }

  const saveBookingInspection = async (complete: boolean) => {
    if (!selectedBooking) return
    setSubmitting(true)
    setFormError('')
    try {
      const formData = new FormData()
      formData.set('fuel_level', String(inspectionFuel))
      formData.set('odometer_reading', inspectionOdometer || '0')
      formData.set('easytrip_balance', inspectionEasytrip || '0')
      formData.set('autosweep_balance', inspectionAutosweep || '0')
      formData.set('functions', JSON.stringify(inspectionFunctions))
      formData.set('tires', JSON.stringify(inspectionTires))
      if (inspectionSigner) formData.set('signer_name', inspectionSigner)
      if (inspectionReleaseAt) formData.set('actual_release_at', inspectionReleaseAt)
      exteriorFiles.forEach((file, index) => {
        formData.append('exterior[]', file)
        formData.set(`exterior_labels.${index}`, inspectionMediaLabels[`exterior-${index}`] ?? '')
        formData.set(`exterior_conditions.${index}`, inspectionMediaConditions[`exterior-${index}`] ?? 'good')
      })
      interiorFiles.forEach((file, index) => {
        formData.append('interior[]', file)
        formData.set(`interior_labels.${index}`, inspectionMediaLabels[`interior-${index}`] ?? '')
        formData.set(`interior_conditions.${index}`, inspectionMediaConditions[`interior-${index}`] ?? 'good')
      })
      if (inspectionSignatureData.length > 100) formData.set('signature_data', inspectionSignatureData)

      const saveResponse = await fetch(`${apiBaseUrl}/dashboard/bookings/${selectedBooking.id}/inspection`, {
        method: 'POST',
        headers: authHeaders,
        body: formData,
      })
      const saveData = await saveResponse.json()
      if (!saveResponse.ok) throw new Error(saveData.message || 'Unable to save pre-inspection.')
      setInspection(saveData.inspection)

      if (complete) {
        if (!inspectionSigner.trim()) throw new Error('Renter name is required to complete the pre-inspection.')
        if (inspectionSignatureData.length < 100) throw new Error('Renter signature is required to complete the pre-inspection.')
        if (!inspectionReleaseAt) throw new Error('Actual release date and time is required.')
        const completeResponse = await fetch(`${apiBaseUrl}/dashboard/bookings/${selectedBooking.id}/inspection/complete`, {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            signer_name: inspectionSigner,
            signature_data: inspectionSignatureData,
            actual_release_at: inspectionReleaseAt,
          }),
        })
        const completeData = await completeResponse.json()
        if (!completeResponse.ok) throw new Error(completeData.message || 'Unable to complete pre-inspection.')
        setSelectedBooking((current) => current ? { ...current, ...completeData.booking } : completeData.booking)
        setInspection(completeData.inspection)
        setToast({ type: 'success', message: 'Pre-inspection completed and rental marked active.' })
        window.setTimeout(() => setToast(null), 4000)
      } else {
        setToast({ type: 'success', message: 'Pre-inspection draft saved.' })
        window.setTimeout(() => setToast(null), 4000)
      }
      await reload()
    } catch (inspectionError) {
      setFormError(inspectionError instanceof Error ? inspectionError.message : 'Unable to save pre-inspection.')
    } finally {
      setSubmitting(false)
    }
  }

  const saveBookingPostInspection = async (complete: boolean) => {
    if (!selectedBooking) return
    setSubmitting(true)
    setFormError('')
    try {
      const formData = new FormData()
      formData.set('fuel_level', String(postInspectionFuel))
      formData.set('odometer_reading', postInspectionOdometer || '0')
      formData.set('easytrip_balance', postInspectionEasytrip || '0')
      formData.set('autosweep_balance', postInspectionAutosweep || '0')
      formData.set('functions', JSON.stringify(postInspectionFunctions))
      formData.set('tires', JSON.stringify(postInspectionTires))
      if (postInspectionSigner) formData.set('signer_name', postInspectionSigner)
      if (postInspectionActualReturnAt) formData.set('actual_return_at', postInspectionActualReturnAt)
      if (postInspectionSignatureData.length > 100) formData.set('signature_data', postInspectionSignatureData)
      postExteriorFiles.forEach((file, index) => {
        formData.append('exterior[]', file)
        formData.set(`exterior_labels.${index}`, postMediaLabels[`exterior-${index}`] ?? '')
        formData.set(`exterior_conditions.${index}`, postMediaConditions[`exterior-${index}`] ?? 'good')
      })
      postInteriorFiles.forEach((file, index) => {
        formData.append('interior[]', file)
        formData.set(`interior_labels.${index}`, postMediaLabels[`interior-${index}`] ?? '')
        formData.set(`interior_conditions.${index}`, postMediaConditions[`interior-${index}`] ?? 'good')
      })

      const saveResponse = await fetch(`${apiBaseUrl}/dashboard/bookings/${selectedBooking.id}/post-inspection`, {
        method: 'POST',
        headers: authHeaders,
        body: formData,
      })
      const saveData = await saveResponse.json()
      if (!saveResponse.ok) throw new Error(saveData.message || 'Unable to save post-inspection.')
      setPostInspection(saveData.inspection)

      if (complete) {
        if (!postInspectionSigner.trim()) throw new Error('Renter name is required to complete the post-inspection.')
        if (postInspectionSignatureData.length < 100) throw new Error('Renter signature is required to complete the post-inspection.')
        if (!postInspectionActualReturnAt) throw new Error('Actual return date and time is required.')
        const completeResponse = await fetch(`${apiBaseUrl}/dashboard/bookings/${selectedBooking.id}/post-inspection/complete`, {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            signer_name: postInspectionSigner,
            signature_data: postInspectionSignatureData,
            actual_return_at: postInspectionActualReturnAt,
          }),
        })
        const completeData = await completeResponse.json()
        if (!completeResponse.ok) throw new Error(completeData.message || 'Unable to complete post-inspection.')
        setPostInspection(completeData.inspection)
        setSelectedBooking((current) => current ? { ...current, ...completeData.booking } : completeData.booking)
        setToast({ type: 'success', message: 'Post-inspection completed. Rental is ready for completion.' })
        window.setTimeout(() => setToast(null), 4000)
      } else {
        setToast({ type: 'success', message: 'Post-inspection draft saved.' })
        window.setTimeout(() => setToast(null), 4000)
      }
      await reload()
    } catch (inspectionError) {
      setFormError(inspectionError instanceof Error ? inspectionError.message : 'Unable to save post-inspection.')
    } finally {
      setSubmitting(false)
    }
  }

  const openBookingEdit = (booking: BookingSectionItem) => {
    setEditingBookingId(booking.id)
    setSelectedCustomerId(String(booking.customer?.id ?? ''))
    setSelectedVehicleId(String(booking.vehicle?.id ?? ''))
    const pickup = parseBookingDateTime(booking.pickup_at)
    const returnDate = parseBookingDateTime(booking.return_at)
    setBookingRangeStart(pickup)
    setBookingRangeEnd(returnDate)
    setBookingPickupTime(`${String(pickup.getHours()).padStart(2, '0')}:${String(pickup.getMinutes()).padStart(2, '0')}`)
    setBookingReturnTime(`${String(returnDate.getHours()).padStart(2, '0')}:${String(returnDate.getMinutes()).padStart(2, '0')}`)
    setBookingCalendarMonth(new Date(pickup.getFullYear(), pickup.getMonth(), 1))
    setBookingDestinationProvince((booking as Booking & { destination_province?: string }).destination_province ?? '')
    setBookingDestinationCity((booking as Booking & { destination_city?: string }).destination_city ?? '')
    setBookingCustomRentalRate(Boolean(booking.custom_rental_rate))
    setCustomRentalRate(booking.custom_rental_rate ? String(booking.rental_amount) : '')
    setBookingAdditionalCharges(String(booking.additional_charges ?? 0))
    setBookingRemarks((booking as Booking & { remarks?: string }).remarks ?? '')
    setModal('booking')
  }

  const openExtensionModal = (booking: (typeof selectedBooking)) => {
    if (!booking) return
    setExtensionReturnAt(booking.return_at.slice(0, 16))
    setExtensionPricingMode('hourly')
    setExtensionFee('')
    setExtensionModal(true)
  }

  const saveBookingExtension = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedBooking) return
    setSubmitting(true)
    setFormError('')
    try {
      const response = await fetch(`${apiBaseUrl}/dashboard/bookings/${selectedBooking.id}/extensions`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_return_at: extensionReturnAt,
          pricing_mode: extensionPricingMode,
          fee: Number(extensionFee),
          notes: '',
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to save booking extension.')
      setSelectedBooking(data)
      setExtensionModal(false)
      await reload()
    } catch (extensionError) {
      setFormError(extensionError instanceof Error ? extensionError.message : 'Unable to save booking extension.')
    } finally {
      setSubmitting(false)
    }
  }

  const openPaymentModal = (booking: typeof selectedBooking) => {
    if (!booking) return
    const paid = (booking.payments ?? []).filter((payment) => payment.status === 'paid').reduce((sum, payment) => sum + Number(payment.amount), 0)
    const balance = Math.max(0, Number(booking.total_amount) - paid)
    setPaymentAmount(balance > 0 ? String(balance) : '')
    setPaymentMethod('Cash')
    setPaymentPaidAt(new Date().toISOString().slice(0, 16))
    setPaymentNotes('')
    setPaymentFundId('')
    setFormError('')
    setPaymentModal(true)
    void fetch(`${apiBaseUrl}/dashboard/funds`, { headers: authHeaders })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.message || 'Unable to load funds')
        setPaymentFunds(Array.isArray(data.funds) ? data.funds : [])
      })
      .catch((loadError) => setFormError(loadError instanceof Error ? loadError.message : 'Unable to load funds'))
  }

  const saveBookingPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedBooking) return
    setSubmitting(true)
    setFormError('')
    try {
      const response = await fetch(`${apiBaseUrl}/dashboard/bookings/${selectedBooking.id}/payments`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(paymentAmount),
          method: paymentMethod,
          paid_at: paymentPaidAt,
          notes: paymentNotes,
          fund_id: paymentFundId ? Number(paymentFundId) : null,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to record payment.')
      setSelectedBooking(data)
      setPaymentModal(false)
      await reload()
    } catch (paymentError) {
      setFormError(paymentError instanceof Error ? paymentError.message : 'Unable to record payment.')
    } finally {
      setSubmitting(false)
    }
  }

  const deleteBookingPayment = async (payment: Payment) => {
    if (!selectedBooking) return
    setConfirmation({
      title: 'Delete this payment?',
      description: `The ₱${Number(payment.amount).toLocaleString('en-PH')} payment will be removed and the balance recalculated.`,
      confirmLabel: 'Delete payment',
      tone: 'danger',
      action: async () => {
        try {
          const response = await fetch(`${apiBaseUrl}/dashboard/payments/${payment.id}`, {
            method: 'DELETE',
            headers: authHeaders,
          })
          const data = await response.json()
          if (!response.ok) throw new Error(data.message || 'Unable to delete payment.')
          setSelectedBooking(data)
          await reload()
        } catch (paymentError) {
          setToast({ type: 'error', message: paymentError instanceof Error ? paymentError.message : 'Unable to delete payment.' })
          window.setTimeout(() => setToast(null), 5000)
        }
      },
    })
  }

  const undoBookingExtension = async () => {
    if (!selectedBooking) return
    setSubmitting(true)
    try {
      const response = await fetch(`${apiBaseUrl}/dashboard/bookings/${selectedBooking.id}/extensions/undo`, {
        method: 'POST',
        headers: authHeaders,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to undo booking extension.')
      setSelectedBooking(data)
      await reload()
    } catch (undoError) {
      setToast({ type: 'error', message: undoError instanceof Error ? undoError.message : 'Unable to undo booking extension.' })
      window.setTimeout(() => setToast(null), 5000)
    } finally {
      setSubmitting(false)
    }
  }

  const updateBookingStatus = async (booking: BookingSectionItem, status: 'confirmed' | 'upcoming' | 'pre_inspection' | 'ongoing' | 'active' | 'complete' | 'completed' | 'cancelled', confirmCancellation = true) => {
    if (status === 'cancelled' && confirmCancellation) {
      setConfirmation({
        title: 'Cancel this booking?',
        description: `${booking.reference} will be cancelled. This will also return the vehicle to available when applicable.`,
        confirmLabel: 'Cancel booking',
        tone: 'danger',
        action: () => updateBookingStatus(booking, 'cancelled', false),
      })
      return
    }
    try {
      const response = await fetch(`${apiBaseUrl}/dashboard/bookings/${booking.id}/status`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to update booking status.')
      setToast({ type: 'success', message: `Booking ${status === 'active' ? 'marked active' : status}.` })
      window.setTimeout(() => setToast(null), 4000)
      await reload()
    } catch (statusError) {
      setToast({ type: 'error', message: statusError instanceof Error ? statusError.message : 'Unable to update booking status.' })
      window.setTimeout(() => setToast(null), 5000)
    }
  }

  const submitCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setFormError('')
    const form = event.currentTarget
    const formData = new FormData(form)
    if (modal === 'booking') {
      if (!bookingRangeStart || !bookingRangeEnd) {
        setFormError('Select both a pickup date and a return date.')
        setSubmitting(false)
        return
      }
      const pickupAt = `${dateKey(bookingRangeStart)}T${bookingPickupTime}`
      const returnAt = `${dateKey(bookingRangeEnd)}T${bookingReturnTime}`
      formData.set('pickup_at', pickupAt)
      formData.set('return_at', returnAt)
      formData.set('custom_rental_rate', bookingCustomRentalRate ? '1' : '0')
      if (!bookingCustomRentalRate) {
        formData.set('rental_amount', '0')
      }
    }
    let endpoint = ''
    if (modal === 'booking') endpoint = 'bookings'
    if (modal === 'vehicle') endpoint = 'vehicles'
    if (modal === 'customer') endpoint = 'customers'
    if (modal === 'partner') endpoint = 'partners'
    if (modal === 'source') endpoint = 'booking-sources'
    let body: BodyInit
    if (modal === 'customer') {
      const customerForm = new FormData()
      formData.forEach((value, key) => {
        if (key.startsWith('attachments_')) return
        customerForm.append(key, value)
      })
      Object.entries(customerFiles).forEach(([category, files]) => {
        files.forEach((file) => customerForm.append(category, file))
      })
      body = customerForm
    } else if (modal === 'vehicle') {
      const plateNumber = String(formData.get('plate_number') || '').trim().toUpperCase()
      formData.set('plate_number', plateNumber)
      const rentalRates: Array<{ duration_hours: number; location_scope: 'all' | 'province' | 'region'; province: string | null; amount: number; amount_type: 'fixed'; outside_amount: number; coverage_type: 'all' | 'province' | 'region'; coverage_locations: string[] }> = []
      selectedDurations.forEach((duration) => {
        const amount = Number(formData.get(`rate_all_${duration}`) || 0)
        if (amount <= 0) return
        const coverage = coverageByDuration[duration] ?? { type: 'all', locations: [] }
        rentalRates.push({
          duration_hours: duration,
          location_scope: coverage.type,
          province: null,
          amount,
          amount_type: 'fixed',
          outside_amount: Number(outsideCharges[duration] || 0),
          coverage_type: coverage.type,
          coverage_locations: coverage.locations,
        })
      })
      formData.set('rental_rates', JSON.stringify(rentalRates))
      if (!formData.get('image') || (formData.get('image') as File).size === 0) {
        if (vehicleDraftImage.startsWith('data:image/')) {
          const imageResponse = await fetch(vehicleDraftImage)
          const imageBlob = await imageResponse.blob()
          formData.append('image', imageBlob, 'vehicle-draft.png')
        }
      }
      if (vehicleModalMode === 'edit') formData.set('_method', 'PUT')
      body = formData
    } else {
      body = JSON.stringify(Object.fromEntries(formData.entries()))
    }
    try {
      const method = (modal === 'booking' && editingBookingId) || (modal === 'customer' && editingCustomerId) ? 'PUT' : 'POST'
      const endpointPath = modal === 'vehicle' && vehicleModalMode === 'edit'
        ? `${endpoint}/${selectedVehicle?.id}`
        : modal === 'booking' && editingBookingId
          ? `${endpoint}/${editingBookingId}`
          : modal === 'customer' && editingCustomerId
            ? `${endpoint}/${editingCustomerId}`
          : endpoint
      const response = await fetch(`${apiBaseUrl}/dashboard/${endpointPath}`, {
        method,
        headers: modal === 'vehicle' || modal === 'customer' ? authHeaders : { ...authHeaders, 'Content-Type': 'application/json' },
        body,
      })
      const data = await response.json()
      if (!response.ok) {
        const validationMessage = data.errors
          ? Object.entries(data.errors).flatMap(([, messages]) => messages as string[]).join(' ')
          : data.message
        throw new Error(validationMessage || 'Unable to save.')
      }
      if (data.warning) {
        setToast({ type: 'error', message: data.warning })
        window.setTimeout(() => setToast(null), 7000)
      } else if (modal === 'vehicle') {
        setToast({ type: 'success', message: 'Vehicle created successfully.' })
        window.setTimeout(() => setToast(null), 4000)
      }
      setModal(null)
      setEditingBookingId(null)
      setEditingCustomerId(null)
      if (modal === 'vehicle') {
        vehicleModalClosedRef.current = true
        localStorage.removeItem(vehicleDraftKey)
        setSelectedVehicle(null)
        setVehicleModalMode('create')
        setVehicleDraftValues({})
        setVehicleDraftImage('')
        const params = new URLSearchParams(location.search)
        params.delete('vehicle')
        params.delete('mode')
        navigate(`${location.pathname}${params.toString() ? `?${params}` : ''}`, { replace: true })
      }
      form.reset()
      setVehicleImagePreview('')
      setSelectedDurations([24])
      setCoverageByDuration({})
      setOutsideCharges({})
      await reload()
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : 'Unable to save.')
    } finally {
      setSubmitting(false)
    }
  }

  const stats = summary ? [
    { label: 'Total revenue', value: `₱${summary.stats.month_revenue.toLocaleString('en-PH')}`, change: `${summary.stats.revenue_change >= 0 ? '+' : ''}${summary.stats.revenue_change}%`, detail: 'vs. last month', icon: 'wallet' as IconName, tone: 'purple' },
    { label: 'Active bookings', value: summary.stats.active_bookings.toString(), change: '', detail: 'currently active', icon: 'calendar' as IconName, tone: 'blue' },
    { label: 'Fleet utilization', value: `${summary.stats.fleet_utilization}%`, change: '', detail: `${summary.stats.rented_vehicles} on rental`, icon: 'car' as IconName, tone: 'orange' },
    { label: 'Total customers', value: summary.stats.total_customers.toLocaleString('en-PH'), change: '', detail: 'workspace customers', icon: 'users' as IconName, tone: 'green' },
  ] : []

  const stagger = { hidden: {}, visible: { transition: { staggerChildren: prefersReducedMotion ? 0 : 0.06 } } }
  const item = { hidden: prefersReducedMotion ? {} : { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.38 } } }

  const renderSection = () => {
    if ([
      'Customers', 'Booking Sources', 'Users', 'Roles',
    ].includes(activeSection)) {
      return <DataSections activeSection={activeSection} customers={customers} payments={payments} partners={partners} bookingSources={bookingSources} workspaceUsers={workspaceUsers} vehicles={vehicles} summary={summary} onOpenCustomerCreate={() => setModal('customer')} onOpenCustomerEdit={(customer) => { setEditingCustomerId(customer.id); setCustomerFiles({}); setModal('customer') }} onOpenCustomerProfile={openCustomerProfile} onArchiveCustomer={archiveCustomer} onDeleteCustomer={deleteCustomer} onOpenPartner={() => setModal('partner')} onOpenBookingSource={() => setModal('source')} onUsersChanged={() => void reload()} />
    }
    if (activeSection === 'Funds') return <FundsSection />
    if (activeSection === 'Expenses') return <ExpensesSection />
    if (activeSection === 'Partners') return <PartnersSection partners={partners} onChanged={() => reload()} />
    if (['Fleet Utilization Report','Income Flow Report','Revenue','Commissions'].includes(activeSection)) return <ReportsSection activeSection={activeSection} bookings={bookings} payments={payments} vehicles={vehicles} partners={partners} bookingSources={bookingSources} />
    if (activeSection === 'Calendar') return <CalendarSection bookings={bookings} month={calendarMonth} onMonthChange={setCalendarMonth} onNewBooking={() => setModal('booking')} onOpenBooking={(booking) => void openBookingDetails(booking as BookingSectionItem)} getVehicleImageUrl={(vehicle) => vehicle ? vehicleImageUrl(vehicle) ?? '' : ''} />
    if (activeSection === 'Contract Builder') return <ContractBuilderSection title={contractTitle} content={contractContent} onTitleChange={setContractTitle} onContentChange={setContractContent} onSave={() => { localStorage.setItem('rentivo_contract_title', contractTitle); localStorage.setItem('rentivo_contract_content', contractContent) }} />
    if (activeSection === 'Rental Operations') return <RentalOperationsSection bookings={bookings} vehicles={vehicles} getVehicleImageUrl={(vehicle) => vehicle ? vehicleImageUrl(vehicle) ?? '' : ''} onOpenBooking={(booking) => void openBookingDetails(booking as BookingSectionItem)} onEditBooking={(booking) => openBookingEdit(booking as BookingSectionItem)} onOpenVehicles={() => navigate('/dashboard/vehicles')} />
    if (activeSection === 'Bookings') return <BookingsSection title={activeSection} bookings={bookings} onNew={() => { setEditingBookingId(null); setModal('booking') }} onDetails={(booking, initialTab) => void openBookingDetails(booking, initialTab)} onEdit={openBookingEdit} onStatusChange={(booking, status) => void updateBookingStatus(booking, status)} getVehicleImageUrl={(vehicle) => vehicle ? vehicleImageUrl(vehicle) ?? '' : ''} />
    if (activeSection === 'Vehicles') return <VehiclesSection vehicles={vehicles} onCreate={openCreateVehicle} onView={(vehicle) => openVehicle(vehicle, 'view')} onEdit={(vehicle) => openVehicle(vehicle, 'edit')} getVehicleImageUrl={(vehicle) => vehicleImageUrl(vehicle) ?? ''} />
    if (activeSection === 'Settings') return <SettingsSection />
    return <motion.section initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className='rounded-xl border border-dashed border-[#dcd8e6] bg-white px-6 py-16 text-center'><h2 className='text-xl font-semibold'>{activeSection}</h2><p className='mt-2 text-sm text-[#8b8494]'>No data has been configured for this module yet.</p></motion.section>
  }

  return (
    <div className="min-h-screen bg-[#f7f6fb] text-[#17141f]">
      <AnimatePresence>{sidebarOpen && <motion.button aria-label="Close navigation" className="fixed inset-0 z-30 bg-[#17141f]/35 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSidebarOpen(false)} />}</AnimatePresence>
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-[#2c0f73]/10 bg-white px-4 py-6 transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center px-3"><img src={wordmark} alt="Rentivo" className="h-10 w-auto" /></div>
        <div className="mt-8 px-3"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#aaa4b4]">Workspace</p><div className="mt-3 flex items-center gap-3 rounded-xl bg-[#f7f6fb] p-3">{companyLogoUrl ? <img src={companyLogoUrl} alt={`${companyName} logo`} className="h-9 w-9 shrink-0 rounded-lg object-contain" /> : <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#5b21b6] text-sm font-bold text-white">{companyName.slice(0,1).toUpperCase()}</div>}<div className="min-w-0"><p className="truncate text-sm font-bold text-[#21142f]">{companyName}</p><p className="text-xs text-[#8b8494]">Admin workspace</p></div></div></div>
        <nav className="rentivo-sidebar-scroll mt-5 min-h-0 flex-1 space-y-2 overflow-y-auto pb-4">
          {navGroups.map((group) => <div key={group.label}><button type="button" onClick={() => setOpenGroups((current) => ({ ...current, [group.label]: !current[group.label] }))} className="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#aaa4b4]"><span>{group.label}</span><motion.span animate={{ rotate: openGroups[group.label] ? 90 : 0 }}>›</motion.span></button><AnimatePresence initial={false}>{openGroups[group.label] && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden"><div className="space-y-1 pt-1">{group.items.map((navItem) => <button key={navItem.label} type="button" onClick={() => { setActiveSection(navItem.label); setSidebarOpen(false); navigate(`/dashboard/${sectionRouteMap[navItem.label] ?? 'overview'}`) }} className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition ${activeSection === navItem.label ? 'bg-[#f0eafa] text-[#5b21b6]' : 'text-[#686173] hover:bg-[#f7f6fb] hover:text-[#21142f]'}`}><Icon name={navItem.icon} size={18} />{navItem.label}</button>)}</div></motion.div>}</AnimatePresence></div>)}
        </nav>
        <div className="mt-auto shrink-0 border-t border-[#eeeaf3] bg-white pt-4">
          <button type="button" onClick={() => { setActiveSection('Settings'); setSidebarOpen(false); navigate('/dashboard/settings') }} className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold transition ${activeSection === 'Settings' ? 'bg-[#f0eafa] text-[#5b21b6]' : 'text-[#686173] hover:bg-[#f7f6fb] hover:text-[#21142f]'}`}><Icon name="settings" size={19} />Settings</button>
          <button type="button" onClick={() => { localStorage.removeItem('rentivo_access_token'); window.location.href = '/' }} className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold text-[#686173] transition hover:bg-[#f7f6fb]"><span>↪</span>Sign out</button>
        </div>
      </aside>

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-[#2c0f73]/10 bg-white/90 px-5 backdrop-blur-md sm:px-8"><div className="flex items-center gap-3"><button type="button" aria-label="Open navigation" onClick={() => setSidebarOpen(true)} className="cursor-pointer rounded-lg p-2 text-[#686173] lg:hidden"><span className="block h-0.5 w-5 bg-current shadow-[0_6px_0_currentColor,0_-6px_0_currentColor]" /></button><div className="hidden items-center gap-2 text-sm text-[#8b8494] sm:flex"><span>Workspace</span><span>/</span><strong className="font-semibold text-[#40384b]">{activeSection}</strong></div><h1 className="text-lg font-bold sm:hidden">{activeSection}</h1></div><div className="flex items-center gap-2 sm:gap-4"><button type="button" aria-label="Search" className="cursor-pointer rounded-lg p-2.5 text-[#686173] hover:bg-[#f7f6fb]"><Icon name="search" /></button><button type="button" aria-label="Notifications" className="relative cursor-pointer rounded-lg p-2.5 text-[#686173] hover:bg-[#f7f6fb]"><Icon name="bell" /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#ef4444]" /></button><div className="h-8 w-px bg-[#eeeaf3]" /><div className="relative"><button type="button" aria-expanded={headerMenuOpen} aria-haspopup="menu" onClick={() => setHeaderMenuOpen((open) => !open)} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-[#ede9fe] text-sm font-bold text-[#6d28d9] ring-offset-2 transition hover:ring-2 hover:ring-[#c4b5fd]" title={currentUser?.name ?? 'User'}>{userInitials}</button><AnimatePresence>{headerMenuOpen && <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.98 }} transition={{ duration: 0.16 }} role="menu" className="absolute right-0 top-[calc(100%+10px)] w-64 overflow-hidden rounded-xl border border-[#2c0f73]/10 bg-white p-2 shadow-[0_18px_50px_rgba(45,28,82,0.16)]"><div className="border-b border-[#eeeaf3] px-3 py-3"><p className="truncate text-sm font-bold text-[#21142f]">{currentUser?.name ?? 'User'}</p><p className="mt-0.5 truncate text-xs text-[#8b8494]">{currentUser?.email ?? ''}</p></div><button type="button" role="menuitem" onClick={() => { setHeaderMenuOpen(false); setHeaderModal('profile') }} className="mt-1 flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold text-[#40384b] hover:bg-[#f7f6fb] hover:text-[#5b21b6]"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ede9fe] text-[#6d28d9]">👤</span>My Profile</button><button type="button" role="menuitem" onClick={() => { setHeaderMenuOpen(false); setHeaderModal('subscription') }} className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold text-[#40384b] hover:bg-[#f7f6fb] hover:text-[#5b21b6]"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ede9fe] text-[#6d28d9]">▦</span>My Subscription</button></motion.div>}</AnimatePresence></div></div></header>
        <main className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10">
          {subscriptionNotice && (
            <div className={`mb-6 flex flex-col gap-3 rounded-xl border px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between ${subscriptionNotice.urgent ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`} role="alert">
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${subscriptionNotice.urgent ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>!</span>
                <div>
                  <p className={`text-sm font-bold ${subscriptionNotice.urgent ? 'text-red-800' : 'text-amber-900'}`}>{subscriptionNotice.title}</p>
                  <p className={`mt-1 text-sm ${subscriptionNotice.urgent ? 'text-red-700' : 'text-amber-800'}`}>{subscriptionNotice.detail}</p>
                </div>
              </div>
              <button type="button" onClick={() => setHeaderModal('subscription')} className={`shrink-0 cursor-pointer rounded-lg px-4 py-2.5 text-sm font-bold ${subscriptionNotice.urgent ? 'bg-red-700 text-white hover:bg-red-800' : 'bg-amber-800 text-white hover:bg-amber-900'}`}>
                View subscription
              </button>
            </div>
          )}
          {loading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1,2,3,4].map((key) => <div key={key} className="h-36 animate-pulse rounded-xl bg-white" />)}</div> : error ? <div className="rounded-xl border border-red-100 bg-red-50 p-6 text-sm text-red-700" role="alert">{error}</div> : activeSection !== 'Overview' ? renderSection() : (
            <OverviewSection
              summary={summary}
              prefersReducedMotion={Boolean(prefersReducedMotion)}
              stats={stats}
              stagger={stagger}
              item={item}
              onNewBooking={() => setModal('booking')}
              onViewBookings={() => navigate('/dashboard/bookings')}
            />
          )}
        </main>
      </div>

      <AnimatePresence>
        {modal === 'vehicle' && (
          <VehicleModal
            mode={vehicleModalMode}
            vehicle={selectedVehicle}
            imagePreview={vehicleImagePreview}
            selectedDurations={selectedDurations}
            coverageByDuration={coverageByDuration}
            outsideCharges={outsideCharges}
            provinces={provinces}
            partners={partners}
            submitting={submitting}
            formError={formError}
            formRef={vehicleFormRef}
            prefersReducedMotion={Boolean(prefersReducedMotion)}
            onClose={clearVehicleModal}
            onEdit={() => setVehicleModalMode('edit')}
            onSubmit={submitCreate}
            onChange={(event) => {
              const values = Object.fromEntries(new FormData(event.currentTarget).entries())
              setVehicleDraftValues(Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value)])))
            }}
            onSetMode={setVehicleModalMode}
            onSetDurations={setSelectedDurations}
            onSetCoverage={setCoverageByDuration}
            onSetOutsideCharges={setOutsideCharges}
            onImageChange={handleVehicleImageChange}
          />
        )}
        {modal === 'booking' && (
          <BookingModal
            editing={Boolean(editingBookingId)}
            submitting={submitting}
            formError={formError}
            formRef={vehicleFormRef}
            customers={customers}
            vehicles={vehicles}
            provinces={provinces}
            citiesByProvince={citiesByProvince}
            selectedCustomerId={selectedCustomerId}
            selectedVehicleId={selectedVehicleId}
            quickAddOpen={quickAddCustomerOpen}
            quickCustomer={quickCustomer}
            calendarMonth={bookingCalendarMonth}
            rangeStart={bookingRangeStart}
            rangeEnd={bookingRangeEnd}
            pickupTime={bookingPickupTime}
            returnTime={bookingReturnTime}
            destinationProvince={bookingDestinationProvince}
            destinationCity={bookingDestinationCity}
            customRentalRateEnabled={bookingCustomRentalRate}
            customRentalRate={customRentalRate}
            additionalCharges={bookingAdditionalCharges}
            remarks={bookingRemarks}
            prefersReducedMotion={Boolean(prefersReducedMotion)}
            getVehicleImageUrl={(vehicle) => vehicleImageUrl(vehicle) ?? ''}
            onClose={() => { setModal(null); setEditingBookingId(null) }}
            onSubmit={submitCreate}
            onCustomerChange={setSelectedCustomerId}
            onVehicleChange={setSelectedVehicleId}
            onQuickAddOpenChange={setQuickAddCustomerOpen}
            onQuickCustomerChange={setQuickCustomer}
            onQuickAdd={quickAddCustomer}
            onCalendarMonthChange={setBookingCalendarMonth}
            onDateClick={handleBookingDateClick}
            onPickupTimeChange={setBookingPickupTime}
            onReturnTimeChange={setBookingReturnTime}
            onDestinationProvinceChange={(value) => { setBookingDestinationProvince(value); setBookingDestinationCity('') }}
            onDestinationCityChange={setBookingDestinationCity}
            onCustomRentalRateEnabledChange={setBookingCustomRentalRate}
            onCustomRentalRateChange={setCustomRentalRate}
            onAdditionalChargesChange={setBookingAdditionalCharges}
            onRemarksChange={setBookingRemarks}
          />
        )}
        {modal && modal !== 'vehicle' && modal !== 'booking' && (
          <CrudModal
            kind={modal as 'customer' | 'partner' | 'source'}
            customerId={editingCustomerId}
            customer={customers.find((item) => item.id === editingCustomerId) ?? null}
            customerFiles={customerFiles}
            submitting={submitting}
            formRef={vehicleFormRef}
            prefersReducedMotion={Boolean(prefersReducedMotion)}
            onCustomerFilesChange={(category, files) => setCustomerFiles((current) => ({ ...current, [category]: files }))}
            onClose={() => { setModal(null); setEditingCustomerId(null) }}
            onSubmit={submitCreate}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>{selectedCustomer && (
        <CustomerProfileDrawer
          customer={selectedCustomer}
          storageBaseUrl={storageBaseUrl}
          prefersReducedMotion={Boolean(prefersReducedMotion)}
          vehicleLabel={(vehicle) => vehicleBookingLabel(vehicle)}
          bookingDateTime={bookingDateTime}
          bookingStatusLabel={bookingStatusLabel}
          onClose={() => setSelectedCustomer(null)}
          onEdit={(customer) => { setSelectedCustomer(null); openCustomerEdit(customer) }}
          onOpenBooking={(booking) => { setSelectedCustomer(null); void openBookingDetails(booking) }}
        />
      )}</AnimatePresence>
      <AnimatePresence>{paymentModal && selectedBooking && (
        <PaymentModal
          reference={selectedBooking.reference}
          total={Number(selectedBooking.total_amount)} paid={bookingPaidAmount(selectedBooking)} balance={bookingBalance(selectedBooking)}
          amount={paymentAmount} method={paymentMethod} paidAt={paymentPaidAt} notes={paymentNotes}
          funds={paymentFunds} fundId={paymentFundId}
          submitting={submitting} error={formError} prefersReducedMotion={Boolean(prefersReducedMotion)}
          onAmountChange={setPaymentAmount} onMethodChange={setPaymentMethod} onPaidAtChange={setPaymentPaidAt}
          onNotesChange={setPaymentNotes} onClose={() => setPaymentModal(false)} onSubmit={saveBookingPayment}
          onFundChange={setPaymentFundId}
        />
      )}</AnimatePresence>

      <BookingDetailsDrawer
        selectedBooking={selectedBooking}
        bookingDetailTab={bookingDetailTab}
        setBookingDetailTab={setBookingDetailTab}
        prefersReducedMotion={prefersReducedMotion}
        onCloseBooking={() => setSelectedBooking(null)}
        onOpenCustomers={() => navigate('/dashboard/customers')}
        openBookingEdit={() => { if (selectedBooking) openBookingEdit(selectedBooking) }}
        openExtensionModal={() => openExtensionModal(selectedBooking)}
        openPaymentModal={() => openPaymentModal(selectedBooking)}
        deleteBookingPayment={deleteBookingPayment}
        undoBookingExtension={undoBookingExtension}
        setConfirmation={setConfirmation}
        submitting={submitting}
        formError={formError}
        inspection={inspection}
        inspectionFuel={inspectionFuel}
        setInspectionFuel={setInspectionFuel}
        inspectionOdometer={inspectionOdometer}
        setInspectionOdometer={setInspectionOdometer}
        inspectionEasytrip={inspectionEasytrip}
        setInspectionEasytrip={setInspectionEasytrip}
        inspectionAutosweep={inspectionAutosweep}
        setInspectionAutosweep={setInspectionAutosweep}
        inspectionFunctions={inspectionFunctions}
        setInspectionFunctions={setInspectionFunctions}
        inspectionTires={inspectionTires}
        setInspectionTires={setInspectionTires}
        inspectionSigner={inspectionSigner}
        setInspectionSigner={setInspectionSigner}
        inspectionReleaseAt={inspectionReleaseAt}
        setInspectionReleaseAt={setInspectionReleaseAt}
        exteriorFiles={exteriorFiles}
        setExteriorFiles={setExteriorFiles}
        interiorFiles={interiorFiles}
        setInteriorFiles={setInteriorFiles}
        inspectionMediaLabels={inspectionMediaLabels}
        setInspectionMediaLabels={setInspectionMediaLabels}
        inspectionMediaConditions={inspectionMediaConditions}
        setInspectionMediaConditions={setInspectionMediaConditions}
        inspectionSignatureData={inspectionSignatureData}
        setInspectionSignatureData={setInspectionSignatureData}
        saveBookingInspection={saveBookingInspection}
        postInspection={postInspection}
        postInspectionFuel={postInspectionFuel}
        setPostInspectionFuel={setPostInspectionFuel}
        postInspectionOdometer={postInspectionOdometer}
        setPostInspectionOdometer={setPostInspectionOdometer}
        postInspectionEasytrip={postInspectionEasytrip}
        setPostInspectionEasytrip={setPostInspectionEasytrip}
        postInspectionAutosweep={postInspectionAutosweep}
        setPostInspectionAutosweep={setPostInspectionAutosweep}
        postInspectionFunctions={postInspectionFunctions}
        setPostInspectionFunctions={setPostInspectionFunctions}
        postInspectionTires={postInspectionTires}
        setPostInspectionTires={setPostInspectionTires}
        postInspectionSigner={postInspectionSigner}
        setPostInspectionSigner={setPostInspectionSigner}
        postInspectionActualReturnAt={postInspectionActualReturnAt}
        setPostInspectionActualReturnAt={setPostInspectionActualReturnAt}
        postExteriorFiles={postExteriorFiles}
        setPostExteriorFiles={setPostExteriorFiles}
        postInteriorFiles={postInteriorFiles}
        setPostInteriorFiles={setPostInteriorFiles}
        postInspectionSignatureData={postInspectionSignatureData}
        setPostInspectionSignatureData={setPostInspectionSignatureData}
        postMediaLabels={postMediaLabels}
        setPostMediaLabels={setPostMediaLabels}
        postMediaConditions={postMediaConditions}
        setPostMediaConditions={setPostMediaConditions}
        saveBookingPostInspection={saveBookingPostInspection}
      />

      <AnimatePresence>{extensionModal && selectedBooking && (
        <ExtensionModal
          reference={selectedBooking.reference}
          returnAt={extensionReturnAt} pricingMode={extensionPricingMode} fee={extensionFee}
          submitting={submitting} error={formError} prefersReducedMotion={Boolean(prefersReducedMotion)}
          onReturnAtChange={setExtensionReturnAt} onPricingModeChange={setExtensionPricingMode} onFeeChange={setExtensionFee}
          onClose={() => setExtensionModal(false)} onSubmit={saveBookingExtension}
        />
      )}</AnimatePresence>
      <AnimatePresence>
        {headerModal === 'profile' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] flex items-center justify-center bg-[#17141f]/55 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setHeaderModal(null) }}>
            <motion.form initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} onSubmit={saveProfile} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" aria-label="My Profile">
              <div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5b21b6]">Account</p><h2 className="mt-2 text-2xl font-bold">My Profile</h2></div><button type="button" onClick={() => setHeaderModal(null)} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-2xl text-[#8b8494] hover:bg-[#f7f6fb]" aria-label="Close">×</button></div>
              <div className="mt-6 grid gap-4">
                <label><span className="mb-2 block text-sm font-semibold">Full name</span><input value={profileName} onChange={(event) => setProfileName(event.target.value)} required className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label>
                <label><span className="mb-2 block text-sm font-semibold">Email</span><input type="email" value={profileEmail} onChange={(event) => setProfileEmail(event.target.value)} required className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label>
                <div className="grid gap-3 sm:grid-cols-2"><label><span className="mb-2 block text-sm font-semibold">New password</span><input type="password" value={profilePassword} onChange={(event) => setProfilePassword(event.target.value)} minLength={profilePassword ? 8 : undefined} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label><label><span className="mb-2 block text-sm font-semibold">Confirm password</span><input type="password" value={profilePasswordConfirmation} onChange={(event) => setProfilePasswordConfirmation(event.target.value)} className="w-full rounded-lg border border-[#dcd8e6] px-4 py-3" /></label></div>
                {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}
              </div>
              <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setHeaderModal(null)} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-4 py-3 text-sm font-bold text-[#686173]">Cancel</button><button type="submit" disabled={submitting} className="cursor-pointer rounded-lg bg-[#5b21b6] px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">{submitting ? 'Saving...' : 'Save profile'}</button></div>
            </motion.form>
          </motion.div>
        )}
        {headerModal === 'subscription' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] flex items-center justify-center bg-[#17141f]/55 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setHeaderModal(null) }}>
            <motion.div initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} className="max-h-[calc(100dvh-2rem)] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl sm:p-8" role="dialog" aria-modal="true" aria-label="My Subscription">
              <div className="flex items-center justify-between"><h2 className="text-2xl font-bold">My Subscription</h2><button type="button" onClick={() => navigate('/pricing')} className="cursor-pointer rounded-lg bg-[#5b21b6] px-4 py-2.5 text-sm font-bold text-white">Change Subscription Plan</button></div>
              <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
                <div className="rounded-xl border border-[#e5e1ed] p-5 sm:p-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8b8494]">Your plan</p><p className="mt-3 text-2xl font-bold text-[#21142f]">{isFreeTrial ? `FREE TRIAL - ${planName}` : planName} <span className="text-sm font-semibold text-[#686173]">/ {billingCycleLabel}</span></p><div className="mt-8 grid gap-4 sm:grid-cols-2"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#ede9fe] text-[#5b21b6]">▦</span><div><p className="text-xs text-[#8b8494]">Started on</p><p className="mt-1 text-sm font-bold">{subscriptionStartLabel}</p></div></div><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#ede9fe] text-[#5b21b6]">↻</span><div><p className="text-xs text-[#8b8494]">{isFreeTrial ? 'Trial ends' : 'Next renewal'}</p><p className="mt-1 text-sm font-bold">{subscriptionEndLabel}</p></div></div></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><div><p className="text-xs text-[#8b8494]">Billing currency</p><p className="mt-1 text-sm font-bold">{summary?.organization.billing_currency ?? 'PHP'}</p></div><div><p className="text-xs text-[#8b8494]">Payment status</p><p className={`mt-1 inline-block rounded px-2 py-1 text-xs font-bold ${subscriptionStatus === 'expired' ? 'bg-red-100 text-red-700' : 'bg-[#ede9fe] text-[#5b21b6]'}`}>{subscriptionStatus === 'expired' ? 'EXPIRED' : isFreeTrial ? 'FREE TRIAL' : 'ACTIVE'}</p></div></div></div>
                <div className="rounded-xl border border-[#e5e1ed] p-5"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8b8494]">Plan usage</p><span className="text-[#5b21b6]">▦</span></div><div className="mt-5"><div className="flex justify-between text-sm"><span>Users</span><strong>{workspaceUsers.length}</strong></div><p className="mt-1 text-xs text-[#8b8494]">Unlimited users</p></div><div className="mt-5"><div className="flex justify-between text-sm"><span>Vehicles</span><strong>{vehicles.length} of {vehicleLimit >= 9999 ? 'Unlimited' : vehicleLimit}</strong></div>{vehicleLimit < 9999 && <><div className="mt-2 h-2 overflow-hidden rounded-full bg-[#ede9fe]"><div className="h-full bg-[#5b21b6]" style={{ width: `${Math.min(100, vehicles.length / vehicleLimit * 100)}%` }} /></div><p className="mt-1 text-xs text-[#8b8494]">{Math.max(0, vehicleLimit - vehicles.length)} slots remaining</p></>}</div></div>
              </div>
              <div className="mt-6"><h3 className="text-lg font-bold">Subscription Billing History</h3><div className="mt-4 overflow-x-auto rounded-xl border border-[#e5e1ed]"><table className="w-full min-w-[900px] text-left text-xs"><thead><tr className="border-b border-[#eeeaf3] text-[#8b8494]"><th className="p-4">Plan</th><th className="p-4">Billing cycle</th><th className="p-4">Price</th><th className="p-4">Processing fee</th><th className="p-4">Subtotal</th><th className="p-4">Refund amount</th><th className="p-4">Discount</th><th className="p-4">Total due</th><th className="p-4">Starts at</th><th className="p-4">Ends at</th></tr></thead><tbody><tr><td className="p-4 font-semibold">{isFreeTrial ? `FREE TRIAL - ${planName}` : planName}</td><td className="p-4">{billingCycleLabel}</td><td className="p-4">₱0.00</td><td className="p-4">₱0.00</td><td className="p-4">₱0.00</td><td className="p-4">₱0.00</td><td className="p-4">—</td><td className="p-4">₱0.00</td><td className="p-4">{subscriptionStartLabel}</td><td className="p-4">{subscriptionEndLabel}</td></tr></tbody></table></div></div>
              <div className="mt-5 rounded-xl border border-[#e5e1ed] bg-[#faf9fc] p-4 text-sm text-[#686173]"><p className="font-semibold text-[#40384b]">Renewals and subscription concerns</p><p className="mt-1">For renewals or plan changes, contact Rentivo manually at <a href="https://facebook.com/rentivoph" target="_blank" rel="noreferrer" className="font-bold text-[#5b21b6] underline">facebook.com/rentivoph</a> or call <a href="tel:+639939928496" className="font-bold text-[#5b21b6] underline">(+63) 993 992 8496</a>.</p></div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>{confirmation && (
        <ConfirmationModal
          title={confirmation.title} description={confirmation.description} confirmLabel={confirmation.confirmLabel}
          tone={confirmation.tone} confirming={confirming} prefersReducedMotion={Boolean(prefersReducedMotion)}
          onCancel={() => setConfirmation(null)}
          onConfirm={async () => { setConfirming(true); try { await confirmation.action() } finally { setConfirming(false); setConfirmation(null) } }}
        />
      )}</AnimatePresence>
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0, y: 10, scale: 0.98 }}
            role={toast.type === 'error' ? 'alert' : 'status'}
            className={`fixed bottom-6 right-6 z-[60] max-w-sm rounded-xl border px-4 py-3 text-sm font-semibold shadow-[0_16px_40px_rgba(45,28,82,0.18)] ${toast.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]'}`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
