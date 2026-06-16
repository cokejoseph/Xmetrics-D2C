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
      {/*
        macOS arrow cursor — black fill, white 1px border, drop shadow.
        viewBox 0 0 14 22: matches macOS default cursor proportions (~14×22 CSS px at 1×).
        Hotspot at SVG origin (0,0) = tip of arrow.
      */}
      <svg width="14" height="22" viewBox="0 0 14 22" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M1.5 1.5 L1.5 18.5 L5 14.5 L8 20.8 L10.5 19.8 L7.5 13.5 L13.5 13.5 Z"
          fill="#1a1a1a"
          stroke="white"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}
