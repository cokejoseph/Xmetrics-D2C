import { useEffect, useRef } from 'react'

export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return

    document.documentElement.classList.add('has-custom-cursor')

    let mx = -200, my = -200
    let rx = -200, ry = -200
    let raf = 0

    const onMove = (e: MouseEvent) => {
      mx = e.clientX
      my = e.clientY
    }

    const onOver = (e: MouseEvent) => {
      const t = e.target as Element
      if (t.closest('a, button, [role="button"], input, textarea, select, label, [tabindex]')) {
        ringRef.current?.classList.add('cursor-ring--hover')
        dotRef.current?.classList.add('cursor-dot--hover')
      }
    }

    const onOut = (e: MouseEvent) => {
      const t = e.relatedTarget as Element | null
      if (!t?.closest('a, button, [role="button"], input, textarea, select, label, [tabindex]')) {
        ringRef.current?.classList.remove('cursor-ring--hover')
        dotRef.current?.classList.remove('cursor-dot--hover')
      }
    }

    const tick = () => {
      const dot = dotRef.current
      const ring = ringRef.current
      if (dot) dot.style.transform = `translate(${mx}px, ${my}px)`
      if (ring) {
        rx += (mx - rx) * 0.12
        ry += (my - ry) * 0.12
        ring.style.transform = `translate(${rx}px, ${ry}px)`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseover', onOver)
    document.addEventListener('mouseout', onOut)

    return () => {
      document.documentElement.classList.remove('has-custom-cursor')
      cancelAnimationFrame(raf)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseover', onOver)
      document.removeEventListener('mouseout', onOut)
    }
  }, [])

  return (
    <>
      <div ref={dotRef} className="cursor-dot" aria-hidden="true" />
      <div ref={ringRef} className="cursor-ring" aria-hidden="true" />
    </>
  )
}
