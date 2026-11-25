import { useEffect, useRef } from 'react'
import SignaturePadEngine from 'signature_pad'

export function SignaturePad({
  value,
  onChange,
  disabled = false,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePadEngine | null>(null)
  const ratioRef = useRef(1)
  const emittedValueRef = useRef('')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const pad = new SignaturePadEngine(canvas, {
      minWidth: 0.8,
      maxWidth: 2.8,
      penColor: '#21142f',
      velocityFilterWeight: 0.7,
      throttle: 8,
    })
    padRef.current = pad
    emittedValueRef.current = value

    const resizeCanvas = () => {
      const existingData = pad.isEmpty() ? null : pad.toData()
      const bounds = canvas.getBoundingClientRect()
      if (!bounds.width || !bounds.height) return
      const ratio = Math.max(window.devicePixelRatio || 1, 1)
      ratioRef.current = ratio
      canvas.width = Math.round(bounds.width * ratio)
      canvas.height = Math.round(bounds.height * ratio)
      canvas.getContext('2d')?.scale(ratio, ratio)
      pad.clear()
      if (existingData) pad.fromData(existingData)
    }

    resizeCanvas()
    if (value) void pad.fromDataURL(value, {
      ratio: ratioRef.current,
      width: canvas.clientWidth,
      height: canvas.clientHeight,
    })
    const resizeObserver = new ResizeObserver(resizeCanvas)
    resizeObserver.observe(canvas)
    pad.addEventListener('endStroke', () => {
      const nextValue = pad.toDataURL('image/png')
      emittedValueRef.current = nextValue
      onChange(nextValue)
    })
    return () => {
      pad.off()
      resizeObserver.disconnect()
      padRef.current = null
    }
  }, [onChange])

  useEffect(() => {
    const pad = padRef.current
    const canvas = canvasRef.current
    if (!pad || !canvas || value === emittedValueRef.current) return
    pad.clear()
    emittedValueRef.current = value
    if (value) void pad.fromDataURL(value, {
      ratio: ratioRef.current,
      width: canvas.clientWidth,
      height: canvas.clientHeight,
    })
  }, [value])

  const clearSignature = () => {
    if (disabled) return
    padRef.current?.clear()
    emittedValueRef.current = ''
    onChange('')
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold">Renter signature</span>
        {!disabled && <button type="button" onClick={clearSignature} className="cursor-pointer text-xs font-bold text-[#5b21b6]">Clear</button>}
      </div>
      <canvas
        ref={canvasRef}
        aria-label="Renter signature pad"
        className={`block h-32 w-full touch-none select-none rounded-lg border border-[#dcd8e6] bg-white ${disabled ? 'pointer-events-none' : 'cursor-crosshair'}`}
      />
      <p className="mt-2 text-[11px] text-[#8b8494]">Use your mouse, trackpad, finger, or stylus to sign.</p>
    </div>
  )
}
