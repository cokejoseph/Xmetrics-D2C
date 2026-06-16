import { useEffect, useRef } from 'react'

export default function CustomCursor() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return

    document.documentElement.classList.add('has-custom-cursor')

    let mx = -200, my = -200
    let raf = 0

    const onMove = (e: MouseEvent) => {
      mx = e.clientX
      my = e.clientY
    }

    const setHover = (on: boolean) => {
      ref.current?.classList.toggle('cursor-arrow--hover', on)
    }

    const onOver = (e: MouseEvent) => {
      if ((e.target as Element)?.closest('a, button, [role="button"], label, input, select, textarea')) {
        setHover(true)
      }
    }
    const onOut = (e: MouseEvent) => {
      const to = e.relatedTarget as Element | null
      if (!to?.closest('a, button, [role="button"], label, input, select, textarea')) {
        setHover(false)
      }
    }

    const tick = () => {
      if (ref.current) ref.current.style.transform = `translate(${mx}px, ${my}px)`
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
    <div ref={ref} className="cursor-arrow" aria-hidden="true">
      {/* macOS-style arrow cursor — tip at top-left (0,0) of the SVG */}
      <svg width="18" height="23" viewBox="0 0 18 23" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M2.5 1.5 L2.5 19.5 L6.8 15.2 L10.2 21.8 L12.8 20.7 L9.4 14.1 L16.5 14.1 Z"
          fill="white"
          stroke="#111827"
          strokeWidth="1.2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}
