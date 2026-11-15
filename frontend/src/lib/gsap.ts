import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(useGSAP, ScrollTrigger)
// Phone address bars resize the viewport mid-scroll; don't re-measure pins for that.
ScrollTrigger.config({ ignoreMobileResize: true })

/** Wrap every animation in `gsap.matchMedia().add(MOTION_OK, …)`. */
export const MOTION_OK = '(prefers-reduced-motion: no-preference)'

export const EASE_OUT = 'power3.out'

export { gsap, ScrollTrigger, useGSAP }
