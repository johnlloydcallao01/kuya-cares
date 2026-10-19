'use client'

import { createPortal } from 'react-dom'
import { useCallback, useEffect, useRef, useState } from 'react'
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api'
import {
  TerraDraw,
  TerraDrawCircleMode,
  TerraDrawPolygonMode,
  TerraDrawRectangleMode,
  TerraDrawSelectMode,
} from 'terra-draw'
import { TerraDrawGoogleMapsAdapter } from 'terra-draw-google-maps-adapter'

type Position = [number, number]
type PolygonGeometry = { type: 'Polygon'; coordinates: Position[][] }

export type ShippingZoneGeometry =
  | PolygonGeometry
  | { type: 'MultiPolygon'; coordinates: Position[][][] }

type DrawFeature = {
  id?: string
  type: 'Feature'
  geometry: PolygonGeometry | { type: 'MultiPolygon'; coordinates: Position[][][] }
  properties?: Record<string, unknown>
}

type SearchSuggestion = google.maps.places.AutocompleteSuggestion

type SearchPlace = {
  location?: google.maps.LatLng
  viewport?: google.maps.LatLngBounds
  displayName?: string | { toString: () => string }
  formattedAddress?: string
}

type MapMode = 'polygon' | 'rectangle' | 'circle' | 'select'

type ShippingZoneMapProps = {
  value: ShippingZoneGeometry | null
  onChange: (geometry: ShippingZoneGeometry | null) => void
}

type MenuPosition = { x: number; y: number } | null

const GOOGLE_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
  process.env.NEXT_PUBLIC_MAPS_BACKEND_KEY ||
  ''
const MAP_LIBRARIES: ('places' | 'geometry')[] = ['places', 'geometry']
const DEFAULT_CENTER = { lat: 14.5995, lng: 120.9842 }
const MAP_CONTAINER_STYLE = { width: '100%', height: '420px' }

function isPolygonGeometry(value: unknown): value is ShippingZoneGeometry {
  if (!value || typeof value !== 'object') return false
  const geometry = value as { type?: unknown; coordinates?: unknown }
  return (
    (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') &&
    Array.isArray(geometry.coordinates)
  )
}

function snapshotToBoundary(features: DrawFeature[]): ShippingZoneGeometry | null {
  const geometries = features
    .map((feature) => feature.geometry)
    .filter(isPolygonGeometry)
    .filter((geometry) => {
      const polygons =
        geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
      return polygons.every((polygon) => {
        const ring = polygon[0]
        return (
          Array.isArray(ring) &&
          ring.length >= 4 &&
          new Set(ring.map(([longitude, latitude]) => `${longitude},${latitude}`)).size >= 3
        )
      })
    })

  const polygons = geometries.flatMap((geometry) =>
    geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates,
  )
  if (polygons.length === 0) return null
  return polygons.length === 1
    ? { type: 'Polygon', coordinates: polygons[0] }
    : { type: 'MultiPolygon', coordinates: polygons }
}

function geometryToFeatures(geometry: ShippingZoneGeometry): DrawFeature[] {
  const polygons =
    geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  return polygons.map((coordinates) => ({
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates },
    properties: { mode: 'polygon' },
  }))
}

function focusMapOnPlace(map: google.maps.Map, place: SearchPlace): boolean {
  const location = place.location
  if (!location) return false
  const viewport = place.viewport ?? new google.maps.LatLngBounds(location, location)
  map.fitBounds(viewport)
  map.setCenter(location)
  map.setZoom(Math.max(map.getZoom() ?? 11, 11))
  return true
}

export default function ShippingZoneMap({ value, onChange }: ShippingZoneMapProps) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'seller-shipping-zone-map',
    googleMapsApiKey: GOOGLE_KEY,
    libraries: MAP_LIBRARIES,
  })
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [mode, setMode] = useState<MapMode>(value ? 'select' : 'polygon')
  const [searchInput, setSearchInput] = useState('')
  const [predictions, setPredictions] = useState<SearchSuggestion[]>([])
  const [searchBusy, setSearchBusy] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [menuPosition, setMenuPosition] = useState<MenuPosition>(null)
  const drawRef = useRef<TerraDraw | null>(null)
  const initialValueRef = useRef(value)
  const lastCommittedValueRef = useRef(JSON.stringify(value ?? null))
  const onChangeRef = useRef(onChange)
  const searchSelectionLockRef = useRef(false)
  const [drawReady, setDrawReady] = useState(false)

  onChangeRef.current = onChange

  const commitBoundary = useCallback((geometry: ShippingZoneGeometry | null) => {
    const serialized = JSON.stringify(geometry ?? null)
    if (lastCommittedValueRef.current === serialized) return
    lastCommittedValueRef.current = serialized
    onChangeRef.current(geometry)
  }, [])

  const syncDrawFromValue = useCallback((nextGeometry: ShippingZoneGeometry | null) => {
    const draw = drawRef.current
    if (!draw) return

    const snapshot = draw.getSnapshot() as DrawFeature[]
    if (JSON.stringify(snapshotToBoundary(snapshot)) === JSON.stringify(nextGeometry ?? null)) {
      return
    }

    try {
      draw.clear()
    } catch {
      const ids = snapshot.map((feature) => feature.id).filter(Boolean)
      if (ids.length > 0) draw.removeFeatures(ids as string[])
    }

    if (nextGeometry) draw.addFeatures(geometryToFeatures(nextGeometry) as never)
    lastCommittedValueRef.current = JSON.stringify(nextGeometry ?? null)
  }, [])

  useEffect(() => {
    initialValueRef.current = value
  }, [value])

  useEffect(() => {
    if (!map || !isLoaded || drawRef.current) return
    let disposed = false
    let retryTimer: ReturnType<typeof setTimeout> | undefined

    const initialize = () => {
      if (disposed || drawRef.current) return
      const projection = map.getProjection()
      if (!projection) {
        retryTimer = setTimeout(initialize, 100)
        return
      }

      const mapDiv = map.getDiv()
      if (!mapDiv.id) mapDiv.id = 'terra-draw-seller-shipping-map'

      const adapter = new TerraDrawGoogleMapsAdapter({
        lib: google.maps,
        map,
        coordinatePrecision: 9,
      } as never)
      const draw = new TerraDraw({
        adapter,
        modes: [
          new TerraDrawPolygonMode(),
          new TerraDrawRectangleMode(),
          new TerraDrawCircleMode(),
          new TerraDrawSelectMode({
            flags: {
              polygon: {
                feature: {
                  draggable: true,
                  coordinates: { draggable: true, resizable: 'opposite', deletable: true },
                },
              },
              rectangle: {
                feature: {
                  draggable: true,
                  coordinates: { draggable: true, resizable: 'opposite', deletable: true },
                },
              },
              circle: {
                feature: {
                  draggable: true,
                  coordinates: { draggable: true, resizable: 'opposite', deletable: true },
                },
              },
            },
          }),
        ],
      })

      drawRef.current = draw
      draw.on('ready', () => {
        const initial = initialValueRef.current
        if (initial) {
          draw.addFeatures(geometryToFeatures(initial) as never)
          draw.setMode('select')
          setMode('select')
        } else {
          draw.setMode('polygon')
          setMode('polygon')
        }
        lastCommittedValueRef.current = JSON.stringify(initial ?? null)
        setDrawReady(true)
      })
      draw.on('change', () => {
        const currentMode = draw.getMode()
        if (
          currentMode === 'polygon' ||
          currentMode === 'rectangle' ||
          currentMode === 'circle'
        ) {
          return
        }
        const snapshot = draw.getSnapshot() as DrawFeature[]
        const geometry = snapshotToBoundary(snapshot)
        if (geometry || snapshot.length === 0) commitBoundary(geometry)
      })
      draw.on('finish', () => {
        const geometry = snapshotToBoundary(draw.getSnapshot() as DrawFeature[])
        if (geometry) commitBoundary(geometry)
      })
      draw.start()
    }

    initialize()
    return () => {
      disposed = true
      if (retryTimer) clearTimeout(retryTimer)
      try {
        drawRef.current?.stop()
      } finally {
        drawRef.current = null
      }
    }
  }, [commitBoundary, isLoaded, map])

  useEffect(() => {
    if (!drawReady) return
    const serialized = JSON.stringify(value ?? null)
    if (serialized === lastCommittedValueRef.current) return
    syncDrawFromValue(value)
  }, [drawReady, syncDrawFromValue, value])

  useEffect(() => {
    if (!value || !map) return
    const polygons =
      value.type === 'Polygon' ? [value.coordinates] : value.coordinates
    const bounds = new google.maps.LatLngBounds()
    polygons.forEach((polygon) =>
      polygon.flat().forEach(([longitude, latitude]) =>
        bounds.extend({ lat: latitude, lng: longitude }),
      ),
    )
    map.fitBounds(bounds)
  }, [map, value])

  useEffect(() => {
    const query = searchInput.trim()
    if (searchSelectionLockRef.current) {
      searchSelectionLockRef.current = false
      setPredictions([])
      return
    }
    if (!query || !window.google?.maps?.places?.AutocompleteSuggestion) {
      setPredictions([])
      return
    }

    const timeout = setTimeout(async () => {
      try {
        const response =
          await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: query,
            locationBias: { center: { lat: 12.8797, lng: 121.774 }, radius: 50000 },
          })
        setPredictions(
          (response.suggestions ?? [])
            .filter(
              (suggestion): suggestion is SearchSuggestion =>
                suggestion.placePrediction != null,
            )
            .slice(0, 6),
        )
      } catch {
        setPredictions([])
      }
    }, 220)

    return () => clearTimeout(timeout)
  }, [searchInput])

  const handleMode = (nextMode: MapMode) => {
    if (!drawRef.current) return
    map?.setOptions({ disableDoubleClickZoom: true, gestureHandling: 'greedy' })
    drawRef.current.setMode(nextMode)
    setMode(nextMode)
  }

  const handleClear = () => {
    const draw = drawRef.current
    if (draw) {
      try {
        draw.clear()
      } catch {
        const ids = (draw.getSnapshot() as DrawFeature[])
          .map((feature) => feature.id)
          .filter(Boolean)
        if (ids.length > 0) draw.removeFeatures(ids as string[])
      }
    }
    commitBoundary(null)
    setMenuPosition(null)
  }

  const focusPlaceSuggestion = async (
    prediction: google.maps.places.PlacePrediction,
  ) => {
    if (!prediction?.placeId || !google.maps.places.Place || !map) return
    setSearchBusy(true)
    setSearchError(null)
    try {
      const place = new google.maps.places.Place({
        id: prediction.placeId,
        requestedLanguage: 'en',
      })
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'location', 'viewport'],
      })
      const focused = focusMapOnPlace(map, place as SearchPlace)
      if (!focused) {
        setSearchError('This place does not have coordinates yet.')
        return
      }
      setSearchInput(place.formattedAddress ?? place.displayName?.toString() ?? searchInput)
      setPredictions([])
      searchSelectionLockRef.current = true
    } catch {
      setSearchError('Unable to load the selected place. Please try again.')
    } finally {
      setSearchBusy(false)
    }
  }

  const handleSearch = async () => {
    const query = searchInput.trim()
    if (!query || !map) return
    setSearchBusy(true)
    setSearchError(null)
    try {
      const { results } = await new google.maps.Geocoder().geocode({
        address: query,
        componentRestrictions: { country: 'PH' },
      })
      const result = results[0]
      if (!result?.geometry) {
        setSearchError('No Philippine location matched that search.')
        return
      }
      map.fitBounds(result.geometry.viewport)
      map.setCenter(result.geometry.location)
      map.setZoom(Math.max(map.getZoom() ?? 11, 11))
      setPredictions([])
    } catch {
      setSearchError('Unable to search this location. Please try again.')
    } finally {
      setSearchBusy(false)
    }
  }

  if (!GOOGLE_KEY) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        Add <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to the web app environment to
        draw delivery zones on the map.
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
        Google Maps could not be loaded. Check the Maps JavaScript API key and enabled
        Places API.
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="flex h-[420px] items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-600 dark:border-[#262626] dark:bg-[#0a0a0a] dark:text-gray-300">
        Loading map…
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="relative flex flex-wrap gap-2">
        <input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void handleSearch()
            }
          }}
          placeholder="Search location (e.g., Makati, Cebu)…"
          className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-[#262626] dark:bg-[#0a0a0a] dark:text-white"
        />
        <button
          type="button"
          disabled={searchBusy}
          onClick={() => void handleSearch()}
          className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-gray-900"
        >
          {searchBusy ? 'Searching…' : 'Search'}
        </button>
        {predictions.length > 0 && (
          <div className="absolute left-0 right-[88px] top-[calc(100%+6px)] z-20 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-[#262626] dark:bg-[#171717]">
            {predictions.map((suggestion, index) => {
                const prediction = suggestion.placePrediction
                if (!prediction) return null
                return (
                <button
                  key={prediction.placeId ?? index}
                  type="button"
                  onClick={() => void focusPlaceSuggestion(prediction)}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-[#262626]"
                >
                  <span className="block font-medium text-gray-900 dark:text-white">
                    {prediction.mainText?.toString() || prediction.text?.toString()}
                  </span>
                  {prediction.secondaryText && (
                    <span className="block text-xs text-gray-500">
                      {prediction.secondaryText.toString()}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
      {searchError && <p className="text-xs text-red-600">{searchError}</p>}

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-2 dark:border-[#262626] dark:bg-[#0a0a0a]">
        <span className="mr-1 self-center text-xs font-semibold text-gray-500">Draw:</span>
        {[
          { id: 'polygon' as const, label: 'Polygon', color: '#239459' },
          { id: 'rectangle' as const, label: 'Rectangle', color: '#3b82f6' },
          { id: 'circle' as const, label: 'Circle', color: '#10b981' },
        ].map((button) => (
          <button
            key={button.id}
            type="button"
            onClick={() => handleMode(button.id)}
            className={`flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs font-semibold ${
              mode === button.id
                ? 'text-white'
                : 'border-gray-200 bg-white text-gray-700 dark:border-[#262626] dark:bg-[#171717] dark:text-[#a1a1aa]'
            }`}
            style={
              mode === button.id
                ? { backgroundColor: button.color, borderColor: button.color }
                : undefined
            }
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: mode === button.id ? 'white' : button.color }}
            />
            {button.label}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-[#262626]" />
        <button
          type="button"
          onClick={() => handleMode('select')}
          className={`rounded-full border px-2.5 py-1.5 text-xs font-semibold ${
            mode === 'select'
              ? 'border-blue-600 bg-blue-600 text-white'
              : 'border-gray-200 bg-white text-gray-700 dark:border-[#262626] dark:bg-[#171717] dark:text-[#a1a1aa]'
          }`}
        >
          Select/Edit
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="ml-auto rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 dark:border-[#262626] dark:bg-[#171717] dark:text-gray-200"
        >
          Clear All
        </button>
      </div>

      <div className="relative">
        <GoogleMap
          mapContainerStyle={MAP_CONTAINER_STYLE}
          center={DEFAULT_CENTER}
          zoom={value ? 12 : 11}
          onLoad={setMap}
          onUnmount={() => setMap(null)}
          onRightClick={(event) => {
            const domEvent = event.domEvent as MouseEvent
            setMenuPosition({ x: domEvent.clientX, y: domEvent.clientY })
          }}
          options={{
            streetViewControl: false,
            mapTypeControl: true,
            clickableIcons: false,
            disableDoubleClickZoom: true,
            gestureHandling: 'greedy',
          }}
        />
        {menuPosition &&
          createPortal(
            <div
              className="fixed z-[9999]"
              style={{ left: menuPosition.x, top: menuPosition.y }}
              onMouseLeave={() => setMenuPosition(null)}
            >
              <button
                type="button"
                onClick={handleClear}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium shadow-lg dark:border-[#262626] dark:bg-[#171717] dark:text-white"
              >
                Remove drawn boundary
              </button>
            </div>,
            document.body,
          )}
      </div>
      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
        <span>
          {mode === 'polygon'
            ? 'Click to add polygon vertices; double-click or click the first point to finish.'
            : mode === 'rectangle'
              ? 'Click and drag to draw a rectangle.'
              : mode === 'circle'
                ? 'Click and drag to draw a circle.'
                : 'Select a shape to move, resize, or edit its boundary points.'}
        </span>
        <span>{drawReady ? 'Map drawing ready' : 'Preparing drawing tools…'}</span>
      </div>
    </div>
  )
}
