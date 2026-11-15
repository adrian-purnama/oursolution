import { useRef } from 'react'
import type { ReactNode } from 'react'
import { EASE_OUT, MOTION_OK, ScrollTrigger, gsap, useGSAP } from '#/lib/gsap'

/**
 * The landing page shell. Every `[data-reveal]` element inside fades up once
 * as it scrolls into view; elements entering together are staggered.
 * Their hidden start state lives in styles.css.
 */
export default function RevealScope({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const root = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add(MOTION_OK, () => {
        ScrollTrigger.batch('[data-reveal]', {
          start: 'top 88%',
          once: true,
          onEnter: (elements) =>
            gsap.to(elements, {
              opacity: 1,
              y: 0,
              duration: 0.8,
              ease: EASE_OUT,
              stagger: 0.08,
              overwrite: true,
            }),
        })
      })
    },
    { scope: root },
  )

  return (
    <main ref={root} className={className}>
      {children}
    </main>
  )
}
