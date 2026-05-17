import { memo, useEffect, useRef, useState } from 'react'
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring } from 'framer-motion'

function MagneticHover({
  children,
  className = '',
  block = false,
  maxMove = 6,
  maxRotate = 1.2,
  scale = 1.01,
  tilt = false,
}) {
  const prefersReducedMotion = useReducedMotion()
  const [isEnabled, setIsEnabled] = useState(false)
  const ref = useRef(null)
  const frame = useRef(0)
  const target = useRef({ x: 0, y: 0, rotateX: 0, rotateY: 0, scale: 1 })

  const rawX = useMotionValue(0)
  const rawY = useMotionValue(0)
  const rawRotateX = useMotionValue(0)
  const rawRotateY = useMotionValue(0)
  const rawScale = useMotionValue(1)

  const x = useSpring(rawX, { stiffness: 180, damping: 18, mass: 0.2 })
  const y = useSpring(rawY, { stiffness: 180, damping: 18, mass: 0.2 })
  const rotateX = useSpring(rawRotateX, { stiffness: 160, damping: 16, mass: 0.2 })
  const rotateY = useSpring(rawRotateY, { stiffness: 160, damping: 16, mass: 0.2 })
  const springScale = useSpring(rawScale, { stiffness: 200, damping: 20, mass: 0.2 })

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
      rawRotateX.set(0)
      rawRotateY.set(0)
      rawScale.set(1)
    }
  }, [isEnabled, rawRotateX, rawRotateY, rawScale, rawX, rawY])

  useEffect(() => {
    return () => {
      if (frame.current) {
        window.cancelAnimationFrame(frame.current)
      }
    }
  }, [])

  const transform = useMotionTemplate`translate3d(${x}px, ${y}px, 0) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${springScale})`
  const wrapperClassName = `magnetic-wrapper${block ? ' magnetic-block' : ''} ${className}`.trim()

  function flushTargets() {
    frame.current = 0
    rawX.set(target.current.x)
    rawY.set(target.current.y)
    rawRotateX.set(target.current.rotateX)
    rawRotateY.set(target.current.rotateY)
    rawScale.set(target.current.scale)
  }

  function scheduleFlush() {
    if (frame.current) {
      return
    }
    frame.current = window.requestAnimationFrame(flushTargets)
  }

  function handlePointerMove(event) {
    if (!ref.current) {
      return
    }

    const rect = ref.current.getBoundingClientRect()
    const offsetX = (event.clientX - rect.left) / rect.width - 0.5
    const offsetY = (event.clientY - rect.top) / rect.height - 0.5

    target.current.x = offsetX * maxMove * 2
    target.current.y = offsetY * maxMove * 2
    target.current.scale = scale

    if (tilt) {
      target.current.rotateX = -offsetY * maxRotate * 2
      target.current.rotateY = offsetX * maxRotate * 2
    } else {
      target.current.rotateX = 0
      target.current.rotateY = 0
    }

    scheduleFlush()
  }

  function handlePointerLeave() {
    target.current = { x: 0, y: 0, rotateX: 0, rotateY: 0, scale: 1 }
    scheduleFlush()
  }

  if (!isEnabled) {
    return <div className={wrapperClassName}>{children}</div>
  }

  return (
    <div className={wrapperClassName} ref={ref} onPointerMove={handlePointerMove} onPointerLeave={handlePointerLeave}>
      <motion.div className="magnetic-inner" style={{ transform }}>
        {children}
      </motion.div>
    </div>
  )
}

export default memo(MagneticHover)
