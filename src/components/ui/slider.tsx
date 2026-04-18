"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface SliderProps extends Omit<React.ComponentProps<"div">, "onChange"> {
  value?: number[]
  onValueChange?: (value: number[]) => void
  min?: number
  max?: number
  step?: number
}

function Slider({
  className,
  value = [50],
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  ...props
}: SliderProps) {
  const trackRef = React.useRef<HTMLDivElement>(null)
  const currentValue = value[0] ?? min
  const percentage = ((currentValue - min) / (max - min)) * 100

  function handleInteraction(clientX: number) {
    if (!trackRef.current) return
    const rect = trackRef.current.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const raw = min + pct * (max - min)
    const stepped = Math.round(raw / step) * step
    const clamped = Math.max(min, Math.min(max, stepped))
    onValueChange?.([clamped])
  }

  function handlePointerDown(e: React.PointerEvent) {
    e.preventDefault()
    handleInteraction(e.clientX)

    function onMove(ev: PointerEvent) {
      handleInteraction(ev.clientX)
    }
    function onUp() {
      document.removeEventListener("pointermove", onMove)
      document.removeEventListener("pointerup", onUp)
    }
    document.addEventListener("pointermove", onMove)
    document.addEventListener("pointerup", onUp)
  }

  return (
    <div
      data-slot="slider"
      ref={trackRef}
      onPointerDown={handlePointerDown}
      className={cn(
        "relative flex w-full touch-none select-none items-center cursor-pointer",
        className
      )}
      {...props}
    >
      <div className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-primary/20">
        <div
          className="absolute h-full bg-primary rounded-full"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div
        className="absolute block h-4 w-4 rounded-full border border-primary/50 bg-background shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        style={{ left: `calc(${percentage}% - 8px)` }}
      />
    </div>
  )
}

export { Slider }
