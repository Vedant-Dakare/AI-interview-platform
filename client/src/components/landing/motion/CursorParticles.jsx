import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring } from 'framer-motion'

const COLORS = [
  'rgba(110, 98, 255, 0.7)',
  'rgba(79, 140, 255, 0.65)',
  'rgba(139, 124, 255, 0.6)',
]

const CursorParticles = memo(function CursorParticles({ count = 8 }) {
  const prefersReducedMotion = useReducedMotion()
  const [isEnabled, setIsEnabled] = useState(false)
  const rawX = useMotionValue(0)
  const rawY = useMotionValue(0)
  const rawOpacity = useMotionValue(0)

  const x = useSpring(rawX, { stiffness: 120, damping: 18, mass: 0.25 })
  const y = useSpring(rawY, { stiffness: 120, damping: 18, mass: 0.25 })
  const opacity = useSpring(rawOpacity, { stiffness: 120, damping: 20, mass: 0.25 })

  const transform = useMotionTemplate`translate3d(${x}px, ${y}px, 0) translate3d(-50%, -50%, 0)`
  const rafRef = useRef(0)
  const idleTimeout = useRef(null)
  const target = useRef({ x: 0, y: 0 })

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
      rawOpacity.set(0)
      return
    }

    function scheduleFlush() {
      if (rafRef.current) {
        return
      }
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = 0
        rawX.set(target.current.x)
        rawY.set(target.current.y)
      })
    }

    function handlePointerMove(event) {
      target.current.x = event.clientX
      target.current.y = event.clientY
      rawOpacity.set(1)

      if (idleTimeout.current) {
        window.clearTimeout(idleTimeout.current)
      }

      idleTimeout.current = window.setTimeout(() => {
        rawOpacity.set(0)
      }, 900)

      scheduleFlush()
    }

    function reset() {
      rawOpacity.set(0)
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    window.addEventListener('blur', reset)
    document.addEventListener('mouseleave', reset)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('blur', reset)
      document.removeEventListener('mouseleave', reset)
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current)
      }
      if (idleTimeout.current) {
        window.clearTimeout(idleTimeout.current)
      }
    }
  }, [isEnabled, rawOpacity, rawX, rawY])

  const particles = useMemo(() => {
    return Array.from({ length: count }, (_, index) => {
      const radius = 20 + Math.random() * 26
      const angle = (360 / count) * index + Math.random() * 18
      const drift = 4 + Math.random() * 6
      const size = 2 + Math.random() * 2
      return {
        id: `cursor-${index}`,
        radius,
        angle,
        drift,
        size,
        opacity: 0.22 + Math.random() * 0.25,
        duration: 4 + Math.random() * 3,
        delay: Math.random() * 1.5,
        color: COLORS[index % COLORS.length],
      }
    })
  }, [count])

  if (!isEnabled) {
    return null
  }

  return (
    <motion.div className="cursor-particles" style={{ transform, opacity }} aria-hidden="true">
      {particles.map((particle) => (
        <span
          key={particle.id}
          className="cursor-particle"
          style={{
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            opacity: particle.opacity,
            animationDuration: `${particle.duration}s`,
            animationDelay: `${particle.delay}s`,
            '--cursor-radius': `${particle.radius}px`,
            '--cursor-angle': `${particle.angle}deg`,
            '--cursor-drift': `${particle.drift}px`,
            '--cursor-color': particle.color,
          }}
        />
      ))}
    </motion.div>
  )
})

export default CursorParticles
