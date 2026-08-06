import { useEffect, useRef, useState } from 'react'

interface AddressSuggestion {
  id: string
  label: string
}

interface AddressAutocompleteProps {
  value: string
  onChange: (value: string) => void
  className?: string
  placeholder?: string
  invalid?: boolean
}

interface PhotonProperties {
  name?: string
  street?: string
  housenumber?: string
  postcode?: string
  city?: string
  state?: string
  country?: string
}

interface PhotonFeature {
  properties: PhotonProperties
}

function formatPhotonAddress(props: PhotonProperties): string {
  const streetLine = [props.housenumber, props.street].filter(Boolean).join(' ')
  const locality = [props.city, props.state, props.postcode].filter(Boolean).join(', ')
  if (streetLine && locality) return `${streetLine}, ${locality}`
  return props.name || streetLine || locality || ''
}

async function fetchAddressSuggestions(
  query: string,
  signal: AbortSignal,
): Promise<AddressSuggestion[]> {
  const trimmed = query.trim()
  if (trimmed.length < 3) return []

  const url = new URL('https://photon.komoot.io/api/')
  url.searchParams.set('q', trimmed)
  url.searchParams.set('limit', '6')
  url.searchParams.set('lang', 'en')

  const response = await fetch(url.toString(), { signal })
  if (!response.ok) return []

  const data = (await response.json()) as { features?: PhotonFeature[] }
  const seen = new Set<string>()

  return (data.features ?? [])
    .map((feature) => formatPhotonAddress(feature.properties))
    .filter((label) => {
      if (!label || seen.has(label)) return false
      seen.add(label)
      return true
    })
    .map((label, index) => ({ id: `${index}-${label}`, label }))
}

export function AddressAutocomplete({
  value,
  onChange,
  className,
  placeholder,
  invalid,
}: AddressAutocompleteProps) {
  const [open, setOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || value.trim().length < 3) {
      setSuggestions([])
      setLoading(false)
      return
    }

    const controller = new AbortController()
    setLoading(true)

    const timer = window.setTimeout(async () => {
      try {
        const results = await fetchAddressSuggestions(value, controller.signal)
        setSuggestions(results)
      } catch {
        if (!controller.signal.aborted) setSuggestions([])
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 300)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [value, open])

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  const selectSuggestion = (label: string) => {
    onChange(label)
    setOpen(false)
    setSuggestions([])
  }

  const showDropdown = open && (loading || suggestions.length > 0)

  return (
    <div ref={containerRef} className="relative">
      <input
        className={`${className ?? ''} ${invalid ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
      />

      {showDropdown && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-md border border-slate-700 bg-slate-900 py-1 shadow-xl">
          {loading && suggestions.length === 0 && (
            <p className="px-3 py-2 text-xs text-slate-500">Searching addresses…</p>
          )}
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectSuggestion(suggestion.label)}
              className="block w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
            >
              {suggestion.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
