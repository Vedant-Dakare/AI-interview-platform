import { useEffect, useRef, useState } from 'react'
import { useMotionValue, useReducedMotion, useSpring } from 'framer-motion'

const lerp = (start, end, amt) => start + (end - start) * amt

export function useMouseParallax({ strength = 1, maxOffset = 12, smoothing = 0.1 } = {}) {
  const prefersReducedMotion = useReducedMotion()
  const [isEnabled, setIsEnabled] = useState(false)
  const rawX = useMotionValue(0)
  const rawY = useMotionValue(0)

  const x = useSpring(rawX, { stiffness: 140, damping: 20, mass: 0.2 })
  const y = useSpring(rawY, { stiffness: 140, damping: 20, mass: 0.2 })

  useEffect(() => {
    if (prefersReducedMotion) {
      setIsEnabled(false)
      return
    }

    const media = window.matchMedia('(pointer: coarse), (max-width: 900px)')
    const update = () => setIsEnabled(!media.matches)

    update()
    media.addEventListener('change', update)

    return () => {
      media.removeEventListener('change', update)
    }
  }, [prefersReducedMotion])

  useEffect(() => {
    if (!isEnabled) {
      rawX.set(0)
      rawY.set(0)
      return
    }

    const target = { x: 0, y: 0 }
    const current = { x: 0, y: 0 }
    const rafId = { current: 0 }

    function handlePointerMove(event) {
      const { innerWidth: width, innerHeight: height } = window
      if (!width || !height) {
        return
      }

      const normalizedX = (event.clientX / width - 0.5) * 2
      const normalizedY = (event.clientY / height - 0.5) * 2

      target.x = normalizedX * maxOffset * strength
      target.y = normalizedY * maxOffset * strength
    }

    function reset() {
      target.x = 0
      target.y = 0
    }

    function tick() {
      current.x = lerp(current.x, target.x, smoothing)
      current.y = lerp(current.y, target.y, smoothing)
      rawX.set(current.x)
      rawY.set(current.y)
      rafId.current = window.requestAnimationFrame(tick)
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    window.addEventListener('blur', reset)
    document.addEventListener('mouseleave', reset)

    rafId.current = window.requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('blur', reset)
      document.removeEventListener('mouseleave', reset)
      window.cancelAnimationFrame(rafId.current)
    }
  }, [isEnabled, maxOffset, rawX, rawY, smoothing, strength])

  return { x, y, isEnabled }
}
