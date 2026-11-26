const currentOrigin = typeof window === 'undefined' ? '' : window.location.origin

export const publicSiteUrl = (import.meta.env.VITE_PUBLIC_SITE_URL || currentOrigin).replace(/\/+$/, '')
export const appSiteUrl = (import.meta.env.VITE_APP_URL || currentOrigin).replace(/\/+$/, '')

export const isSplitHostDeployment = Boolean(
  import.meta.env.VITE_PUBLIC_SITE_URL
  && import.meta.env.VITE_APP_URL
  && new URL(publicSiteUrl).host !== new URL(appSiteUrl).host,
)

export const isDashboardHost = isSplitHostDeployment
  && window.location.host === new URL(appSiteUrl).host
