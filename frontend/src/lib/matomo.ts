import { useEffect, useRef } from 'react'
import { useRouterState } from '@tanstack/react-router'

const MATOMO_URL = '//matomo-adrianpurnama209.oursolution.id/'
const MATOMO_SITE_ID = '1'

type MatomoQueue = Array<Array<unknown>>

declare global {
  interface Window {
    _paq?: MatomoQueue
  }
}

function getQueue(): MatomoQueue {
  return (window._paq = window._paq || [])
}

/** Configure the tracker and load matomo.js once per page load. */
function loadMatomo() {
  if (document.querySelector('script[data-matomo]')) return
  const paq = getQueue()
  paq.push(['setTrackerUrl', MATOMO_URL + 'matomo.php'])
  paq.push(['setSiteId', MATOMO_SITE_ID])
  paq.push(['enableLinkTracking'])

  const script = document.createElement('script')
  script.async = true
  script.src = MATOMO_URL + 'matomo.js'
  script.dataset.matomo = ''
  document.head.appendChild(script)
}

/**
 * Loads Matomo and records a page view for the first page and for every
 * client-side navigation, since those don't reload the page.
 */
export function useMatomoPageViews() {
  const href = useRouterState({ select: (state) => state.location.href })
  const previous = useRef<string | null>(null)

  useEffect(() => {
    loadMatomo()
  }, [])

  useEffect(() => {
    const referrer = previous.current
    previous.current = window.location.href
    // Give the new route a moment to set its <title>.
    const timer = window.setTimeout(() => {
      const paq = getQueue()
      if (referrer) paq.push(['setReferrerUrl', referrer])
      paq.push(['setCustomUrl', window.location.href])
      paq.push(['setDocumentTitle', document.title])
      paq.push(['trackPageView'])
    }, 300)
    return () => window.clearTimeout(timer)
  }, [href])
}
