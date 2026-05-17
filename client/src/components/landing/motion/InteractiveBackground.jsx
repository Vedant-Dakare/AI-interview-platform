import { memo, useEffect, useMemo, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import MouseParallaxLayer from './MouseParallaxLayer'
import FloatingParticles from './FloatingParticles'

function InteractiveBackground() {
  const prefersReducedMotion = useReducedMotion()
  const [quality, setQuality] = useState('high')

  useEffect(() => {
    if (prefersReducedMotion) {
      setQuality('low')
      return
    }

    let frameId = 0
    let lastSample = performance.now()
    let frames = 0

    const sample = (now) => {
      frames += 1
      if (now - lastSample >= 1000) {
        const fps = (frames * 1000) / (now - lastSample)
        setQuality((current) => {
          if (fps < 50 && current !== 'low') {
            return 'low'
          }
          if (fps > 55 && current !== 'high') {
            return 'high'
          }
          return current
        })
        frames = 0
        lastSample = now
      }
      frameId = window.requestAnimationFrame(sample)
    }

    frameId = window.requestAnimationFrame(sample)

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [prefersReducedMotion])

  const settings = useMemo(() => {
    const high = quality === 'high'
    return {
      orbStrength: high ? 0.85 : 0.45,
      gridStrength: high ? 0.45 : 0.25,
      particleStrength: high ? 0.35 : 0.18,
      particleCount: high ? 16 : 8,
    }
  }, [quality])

  return (
    <div className="interactive-bg" aria-hidden="true">
      <MouseParallaxLayer className="interactive-layer" strength={settings.orbStrength} maxOffset={24}>
        <div className="interactive-orb orb-a" />
        <div className="interactive-orb orb-b" />
        <div className="interactive-orb orb-c" />
      </MouseParallaxLayer>

      <MouseParallaxLayer className="interactive-layer" strength={settings.gridStrength} maxOffset={14}>
        <div className="interactive-grid" />
      </MouseParallaxLayer>

      <FloatingParticles count={settings.particleCount} strength={settings.particleStrength} />
    </div>
  )
}

export default memo(InteractiveBackground)
