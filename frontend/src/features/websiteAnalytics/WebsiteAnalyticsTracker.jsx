import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { recordWebsitePage } from './websiteAnalytics.client'

// The tracker is mounted once in App, not in individual pages. React Router
// navigation counts as one page visit; component re-renders do not.
export default function WebsiteAnalyticsTracker() {
  const { pathname } = useLocation()
  useEffect(() => {
    recordWebsitePage(pathname)
  }, [pathname])
  return null
}
