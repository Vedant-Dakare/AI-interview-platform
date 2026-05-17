import { memo } from 'react'
import { motion, useMotionTemplate } from 'framer-motion'
import { useMouseParallax } from './useMouseParallax'

function MouseParallaxLayer({
  children,
  className = '',
  strength = 1,
  maxOffset = 12,
  smoothing = 0.08,
}) {
  const { x, y } = useMouseParallax({ strength, maxOffset, smoothing })
  const transform = useMotionTemplate`translate3d(${x}px, ${y}px, 0)`

  return (
    <motion.div className={`parallax-layer ${className}`.trim()} style={{ transform }}>
      {children}
    </motion.div>
  )
}

export default memo(MouseParallaxLayer)
