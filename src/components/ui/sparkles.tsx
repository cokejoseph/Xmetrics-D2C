import { useCallback, useId } from 'react'
import Particles, { ParticlesProvider, useParticlesProvider } from '@tsparticles/react'
import type { Engine, Container } from '@tsparticles/engine'
import { loadSlim } from '@tsparticles/slim'
import { cn } from '@/lib/utils'
import { motion, useAnimation } from 'framer-motion'

type SparklesProps = {
  id?: string
  className?: string
  background?: string
  minSize?: number
  maxSize?: number
  speed?: number
  particleColor?: string
  particleDensity?: number
}

function SparklesInner({ id, className, background, minSize, maxSize, speed, particleColor, particleDensity }: SparklesProps) {
  const { loaded } = useParticlesProvider()
  const controls = useAnimation()
  const generatedId = useId()

  const particlesLoaded = useCallback(async (container?: Container) => {
    if (container) {
      controls.start({ opacity: 1, transition: { duration: 1 } })
    }
  }, [controls])

  return (
    <motion.div animate={controls} className={cn('opacity-0', className)}>
      {loaded && (
        <Particles
          id={id ?? generatedId}
          className="h-full w-full"
          particlesLoaded={particlesLoaded}
          options={{
            background: { color: { value: background ?? 'transparent' } },
            fullScreen: { enable: false, zIndex: 0 },
            fpsLimit: 120,
            particles: {
              color: { value: particleColor ?? '#bae6fd' },
              links: {
                color: particleColor ?? '#bae6fd',
                distance: 120,
                enable: true,
                opacity: 0.2,
                width: 0.6,
              },
              move: {
                direction: 'none',
                enable: true,
                outModes: { default: 'out' },
                random: false,
                speed: { min: 0.1, max: 0.8 },
                straight: false,
              },
              number: {
                density: { enable: true, width: 800, height: 800 },
                value: particleDensity ?? 60,
              },
              opacity: {
                value: { min: 0.1, max: 0.8 },
                animation: {
                  enable: true,
                  speed: speed ?? 2,
                  sync: false,
                },
              },
              shape: { type: 'circle' },
              size: { value: { min: minSize ?? 0.6, max: maxSize ?? 2 } },
            },
            detectRetina: true,
          }}
        />
      )}
    </motion.div>
  )
}

export function SparklesCore(props: SparklesProps) {
  const init = useCallback(async (engine: Engine) => {
    await loadSlim(engine)
  }, [])

  return (
    <ParticlesProvider init={init}>
      <SparklesInner {...props} />
    </ParticlesProvider>
  )
}
