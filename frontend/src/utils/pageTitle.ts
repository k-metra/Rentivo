const dashboardSectionTitles: Record<string, string> = {
  overview: 'Overview',
  calendar: 'Calendar',
  'contract-builder': 'Contract Builder',
  bookings: 'Bookings',
  'booking-requests': 'Booking Requests',
  'rental-operations': 'Rental Operations',
  funds: 'Funds',
  expenses: 'Expenses',
  partners: 'Partners',
  customers: 'Customers',
  vehicles: 'Vehicles',
  'booking-sources': 'Booking Sources',
  'fleet-utilization': 'Fleet Utilization Report',
  'income-flow': 'Income Flow Report',
  revenue: 'Revenue',
  commissions: 'Commissions',
  users: 'Users',
  roles: 'Roles',
  'audit-logs': 'Audit Logs',
  settings: 'Settings',
}

const pageTitles: Record<string, string> = {
  '/pricing': 'Pricing',
  '/forgot-password': 'Forgot Password',
  '/reset-password': 'Reset Password',
  '/onboarding': 'Set Up Your Workspace',
  '/rentivo-control': 'Rentivo Control',
  '/privacy-policy': 'Privacy Policy',
  '/terms-and-conditions': 'Terms and Conditions',
}

function brandedTitle(page: string) {
  return `${page} | Rentivo`
}

export function getPageTitle(pathname: string, search = '') {
  const normalizedPathname = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  const searchParams = new URLSearchParams(search)

  if (normalizedPathname === '/') {
    if (searchParams.get('signin') === '1') return brandedTitle('Sign In')
    if (searchParams.get('signup') === '1') return brandedTitle('Create Account')
    if (searchParams.get('verified') === '1') return brandedTitle('Verify Email')
    return 'Rentivo | Vehicle Rental Management'
  }

  const dashboardMatch = normalizedPathname.match(/^\/dashboard(?:\/([^/]+))?/)
  if (dashboardMatch) {
    return brandedTitle(dashboardSectionTitles[dashboardMatch[1] ?? 'overview'] ?? 'Overview')
  }

  if (normalizedPathname.startsWith('/booking/')) {
    const segments = normalizedPathname.split('/').filter(Boolean)
    if (segments[2] === 'my-bookings') return brandedTitle('My Bookings')
    if (segments[2] === 'vehicles') return brandedTitle('Vehicle Details')
    return brandedTitle('Book a Vehicle')
  }

  if (normalizedPathname.startsWith('/contract/')) return brandedTitle('Rental Contract')

  const page = pageTitles[normalizedPathname]
  return page ? brandedTitle(page) : 'Rentivo | Vehicle Rental Management'
}
