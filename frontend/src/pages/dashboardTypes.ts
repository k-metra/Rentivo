export type CustomerAttachment = {
  id: number
  category: string
  file_path: string
  original_name: string
  url?: string
}

export type Customer = {
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
  attachments?: CustomerAttachment[]
}

export type Vehicle = {
  id: number
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
  partner_id?: number | null
  partner?: {
    id: number
    name: string
    first_name?: string
    middle_name?: string
    last_name?: string
  } | null
  rental_rates?: Array<{
    duration_hours: number
    amount: number | string
    outside_amount?: number | string
    coverage_type?: string
    coverage_locations?: string[]
  }>
}

export type Payment = {
  id: number
  amount: number | string
  method: string
  status: string
  paid_at?: string | null
  notes?: string
  creator?: { name: string }
  booking?: {
    id?: number
    reference?: string
    total_amount?: number | string
    customer?: { name: string }
    vehicle?: {
      id?: number
      name?: string
      brand: string
      model: string
      year?: number
      plate_number: string
      partner_id?: number | null
      partner?: {
        id: number
        name: string
        first_name?: string
        middle_name?: string
        last_name?: string
      } | null
    }
  }
}

export type Partner = {
  id: number
  name: string
  first_name?: string
  middle_name?: string
  last_name?: string
  type: string
  email?: string
  phone?: string
  address?: string
  notes?: string
  commission_rate: number | string
  status: string
}

export type BookingSource = {
  id: number
  name: string
  type: string
  commission_rate: number | string
  status: string
}

export type Booking = {
  id: number
  reference: string
  pickup_at: string
  return_at: string
  status: string
  payment_status?: string
  total_amount: number | string
  customer?: { id?: number; name: string }
  vehicle?: {
    id?: number
    name?: string
    brand: string
    model: string
    year?: number
    plate_number: string
    partner_id?: number | null
    partner?: {
      id: number
      name: string
      first_name?: string
      middle_name?: string
      last_name?: string
    } | null
  }
  payments?: Array<{ status: string; amount: number | string; paid_at?: string | null }>
}

export type WorkspaceUser = {
  id: number
  name: string
  email: string
  role: string
  role_id?: number | null
}

export type Summary = {
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
  stats: {
    month_revenue: number
    revenue_change: number
    active_bookings: number
    fleet_utilization: number
    total_customers: number
    total_vehicles: number
    rented_vehicles: number
    available_vehicles: number
    service_vehicles: number
  }
  upcoming_bookings: Array<{
    id: number
    reference: string
    pickup_at: string
    return_at: string
    status: string
    customer?: { name: string }
    vehicle?: {
      name?: string
      brand: string
      model: string
      year?: number
      image_path?: string
      image_url?: string
    }
  }>
  recent_activity: Array<{ title: string; text: string; time: string }>
  revenue_by_month: Array<{ period: string; value: number }>
}
