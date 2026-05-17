import { memo, useMemo } from 'react'
import MouseParallaxLayer from './MouseParallaxLayer'

const FloatingParticles = memo(function FloatingParticles({ count = 18, strength = 0.35 }) {
  const particles = useMemo(() => {
    return Array.from({ length: count }, (_, index) => {
      const size = 2 + Math.random() * 3
      const radius = 120 + Math.random() * 520
      const angle = Math.random() * 360
      const drift = 6 + Math.random() * 10
      return {
        id: `particle-${index}`,
        size,
        radius,
        angle,
        drift,
        opacity: 0.12 + Math.random() * 0.25,
        delay: Math.random() * 6,
        duration: 14 + Math.random() * 18,
      }
    })
  }, [count])

  return (
    <MouseParallaxLayer className="particle-field" strength={strength} maxOffset={12}>
      {particles.map((particle) => (
        <span
          key={particle.id}
          className="particle"
          style={{
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            opacity: particle.opacity,
            animationDelay: `${particle.delay}s`,
            animationDuration: `${particle.duration}s`,
            '--particle-radius': `${particle.radius}px`,
            '--particle-angle': `${particle.angle}deg`,
            '--particle-drift': `${particle.drift}px`,
          }}
        />
      ))}
    </MouseParallaxLayer>
  )
})

export default FloatingParticles
