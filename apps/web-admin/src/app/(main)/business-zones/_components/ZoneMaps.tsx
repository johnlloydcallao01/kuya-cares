// @ts-nocheck
'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { GoogleMap, useJsApiLoader, Polygon, Marker, InfoWindow } from '@react-google-maps/api'
import {
  TerraDraw,
  TerraDrawPolygonMode,
  TerraDrawRectangleMode,
  TerraDrawCircleMode,
  TerraDrawSelectMode,
} from 'terra-draw'
import { TerraDrawGoogleMapsAdapter } from 'terra-draw-google-maps-adapter'

const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_MAPS_BACKEND_KEY || 'AIzaSyAMJO82LtLjj81N1sfQkQVZLygmF4hggEQ'
const libraries: ('places' | 'geometry')[] = ['places', 'geometry']

const mapContainerStyle = { width: '100%', height: '100%' }
const defaultCenter = { lat: 14.5995, lng: 120.9842 } // Manila

function geoJSONToPaths(geo: any): google.maps.LatLngLiteral[][] {
  if (!geo || !geo.coordinates) return []
  if (geo.type === 'Polygon') {
    return geo.coordinates.map((ring: number[][]) => ring.map(([lng, lat]: number[]) => ({ lat, lng })))
  }
  if (geo.type === 'MultiPolygon') {
    const paths: google.maps.LatLngLiteral[][] = []
    for (const poly of geo.coordinates) {
      for (const ring of poly) {
        paths.push(ring.map(([lng, lat]: number[]) => ({ lat, lng })))
      }
    }
    return paths
  }
  return []
}

function getCenterFromGeoJSON(geo: any): google.maps.LatLngLiteral | null {
  const paths = geoJSONToPaths(geo)
  if (paths.length === 0 || paths[0].length === 0) return null
  const pts = paths[0]
  let lat = 0, lng = 0
  for (const p of pts) { lat += p.lat; lng += p.lng }
  return { lat: lat / pts.length, lng: lng / pts.length }
}

function isValidPolygonGeometry(geo: any): boolean {
  if (!geo || geo.type !== 'Polygon' || !Array.isArray(geo.coordinates) || geo.coordinates.length === 0) return false
  const ring = geo.coordinates[0]
  if (!Array.isArray(ring) || ring.length < 4) return false
  const distinct = new Set(ring.map((c: number[]) => `${c[0]},${c[1]}`))
  return distinct.size >= 3
}
function snapshotToBoundary(snapshot: any[]): any | null {
  if (!snapshot || snapshot.length === 0) return null
  const polys = snapshot.filter((f: any) => {
    const g = f.geometry
    if (!g) return false
    if (g.type === 'Polygon') return isValidPolygonGeometry(g)
    if (g.type === 'MultiPolygon') {
      return Array.isArray(g.coordinates) && g.coordinates.some((poly: any) => isValidPolygonGeometry({ type: 'Polygon', coordinates: poly }))
    }
    return false
  })
  if (polys.length === 0) return null
  if (polys.length === 1) return polys[0].geometry
  const coords: number[][][][] = []
  for (const f of polys) {
    const g = f.geometry
    if (g.type === 'Polygon') coords.push(g.coordinates)
    else if (g.type === 'MultiPolygon') coords.push(...g.coordinates)
  }
  if (coords.length === 0) return null
  if (coords.length === 1) return { type: 'Polygon', coordinates: coords[0] }
  return { type: 'MultiPolygon', coordinates: coords }
}

// ------------------------------------------------------------
// Drawing map for form — Terra Draw (simple, stable)
// ------------------------------------------------------------
export function BusinessZoneDrawingMap({
  value,
  onChange,
  height = 420,
}: {
  value: any | null
  onChange: (geo: any | null) => void
  height?: number
}) {
  const { isLoaded, loadError } = useJsApiLoader({ googleMapsApiKey: GOOGLE_KEY, libraries })
  const mapRef = useRef<google.maps.Map | null>(null)
  const drawRef = useRef<TerraDraw | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchBusy, setSearchBusy] = useState(false)
  const [predictions, setPredictions] = useState<any[]>([])
  const [mode, setMode] = useState<string>('polygon')
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const initialValueRef = useRef<any>(value)
  const lastCommittedValueRef = useRef<string | null>(null)
  const searchSelectionLockRef = useRef(false)

  const center = React.useMemo(() => getCenterFromGeoJSON(value) || defaultCenter, [value])

  const syncDrawFromValue = useCallback((nextGeo: any) => {
    const draw = drawRef.current
    if (!draw) return

    const snapshot = draw.getSnapshot() as any[]
    const currentGeo = snapshotToBoundary(snapshot)
    const currentJson = JSON.stringify(currentGeo ?? null)
    const nextJson = JSON.stringify(nextGeo ?? null)
    if (currentJson === nextJson) return

    try {
      draw.clear()
    } catch {
      const ids = snapshot.map((f: any) => f.id).filter(Boolean)
      if (ids.length) {
        try { draw.removeFeatures(ids as any) } catch {}
      }
    }

    if (nextGeo && (nextGeo.type === 'Polygon' || nextGeo.type === 'MultiPolygon')) {
      try {
        if (nextGeo.type === 'MultiPolygon') {
          const features = nextGeo.coordinates.map((polyCoords: any) => ({
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: polyCoords },
            properties: { mode: 'polygon' },
          }))
          draw.addFeatures(features as any)
        } else {
          draw.addFeatures([{ type: 'Feature', geometry: nextGeo, properties: { mode: 'polygon' } } as any])
        }
      } catch {}
    }

    lastCommittedValueRef.current = nextJson
  }, [])

  const initTerraDraw = useCallback((map: google.maps.Map) => {
    if (drawRef.current) return
    const mapDiv = map.getDiv()
    if (mapDiv && !mapDiv.id) mapDiv.id = 'terra-draw-business-zone-map'

    const adapter = new TerraDrawGoogleMapsAdapter({
      lib: google.maps as any,
      map,
      coordinatePrecision: 9,
    } as any)

    const draw = new TerraDraw({
      adapter: adapter as any,
      modes: [
        new TerraDrawPolygonMode(),
        new TerraDrawRectangleMode(),
        new TerraDrawCircleMode(),
        new TerraDrawSelectMode({
          flags: {
            polygon: { feature: { draggable: true, coordinates: { draggable: true, resizable: true, deletable: true } } },
            rectangle: { feature: { draggable: true, coordinates: { draggable: true, resizable: true, deletable: true } } },
            circle: { feature: { draggable: true, coordinates: { draggable: true, resizable: true, deletable: true } } },
          } as any,
        }),
      ],
    } as any)

    drawRef.current = draw
    draw.start()

    draw.on('ready', () => {
      const initial = initialValueRef.current
      if (initial && (initial.type === 'Polygon' || initial.type === 'MultiPolygon')) {
        try {
          if (initial.type === 'MultiPolygon') {
            const features = initial.coordinates.map((polyCoords: any) => ({
              type: 'Feature' as const,
              geometry: { type: 'Polygon' as const, coordinates: polyCoords },
              properties: { mode: 'polygon' },
            }))
            draw.addFeatures(features as any)
          } else {
            draw.addFeatures([{ type: 'Feature', geometry: initial, properties: { mode: 'polygon' } } as any])
          }
          draw.setMode('select')
          setMode('select')
        } catch {}
      } else {
        draw.setMode('polygon')
        setMode('polygon')
      }
    })

    draw.on('change', () => {
      const modeName = draw.getMode()
      if (modeName === 'polygon' || modeName === 'rectangle' || modeName === 'circle') {
        return
      }

      const snapshot = draw.getSnapshot() as any[]
      const boundary = snapshotToBoundary(snapshot)
      const hasValid = boundary !== null
      const isEmpty = snapshot.length === 0

      if (hasValid || isEmpty) {
        const nextJson = JSON.stringify(boundary ?? null)
        if (lastCommittedValueRef.current === nextJson) return
        lastCommittedValueRef.current = nextJson
        onChange(boundary)
      }
    })

    draw.on('finish', () => {
      const snapshot = draw.getSnapshot() as any[]
      const boundary = snapshotToBoundary(snapshot)
      const nextJson = JSON.stringify(boundary ?? null)
      if (lastCommittedValueRef.current === nextJson) return
      if (boundary) {
        lastCommittedValueRef.current = nextJson
        onChange(boundary)
      }
    })
  }, [onChange])

  const onLoadMap = useCallback((map: google.maps.Map) => {
    mapRef.current = map
    const tryInit = () => {
      if (drawRef.current) return
      initTerraDraw(map)
    }
    if (map.getProjection()) {
      tryInit()
    } else {
      google.maps.event.addListenerOnce(map, 'projection_changed', tryInit)
      google.maps.event.addListenerOnce(map, 'idle', tryInit)
      setTimeout(tryInit, 600)
    }
  }, [initTerraDraw])

  useEffect(() => {
    const serializedValue = JSON.stringify(value ?? null)
    if (lastCommittedValueRef.current === serializedValue) return
    syncDrawFromValue(value)
    lastCommittedValueRef.current = serializedValue
  }, [value, syncDrawFromValue])

  const handleClear = () => {
    const draw = drawRef.current
    if (draw) {
      try { draw.clear() } catch {
        try {
          const ids = (draw.getSnapshot() as any[]).map((f: any) => f.id).filter(Boolean)
          if (ids.length) draw.removeFeatures(ids as any)
        } catch {}
      }
    }
    lastCommittedValueRef.current = JSON.stringify(null)
    onChange(null)
  }

  const handleDeleteSelected = () => {
    const draw = drawRef.current
    if (!draw) return
    try {
      draw.clear()
      lastCommittedValueRef.current = JSON.stringify(null)
      setContextMenu(null)
      setTimeout(() => onChange(null), 50)
    } catch {
      try {
        const snap = draw.getSnapshot() as any[]
        const ids = snap.map((f: any) => f.id).filter(Boolean)
        if (ids.length) draw.removeFeatures(ids as any)
        lastCommittedValueRef.current = JSON.stringify(null)
        setContextMenu(null)
        setTimeout(() => onChange(null), 50)
      } catch {}
    }
  }

  const handleMode = (m: string) => {
    const draw = drawRef.current
    if (!draw) return
    if (mapRef.current) {
      mapRef.current.setOptions({
        disableDoubleClickZoom: true,
        gestureHandling: 'greedy',
      })
    }
    draw.setMode(m as any)
    setMode(m)
  }

  const focusMapOnPlace = useCallback((place: any) => {
    if (!place || !mapRef.current || !window.google?.maps) return

    const g = window.google.maps
    const loc = place.location || place.geometry?.location
    if (!loc) {
      setSearchError('This place does not have coordinates yet.')
      return
    }

    const viewport = place.viewport || place.geometry?.viewport || new g.LatLngBounds(loc, loc)
    mapRef.current.fitBounds(viewport)
    mapRef.current.setCenter(loc)
    mapRef.current.setZoom(Math.max(mapRef.current.getZoom() || 11, 11))
    setSearchError(null)
    setPredictions([])
  }, [])

  const handleSuggestionSelect = useCallback(async (prediction: any) => {
    const placeId = prediction?.placePrediction?.placeId || prediction?.place_id
    if (!placeId || !window.google?.maps?.places?.Place) {
      const nextText = prediction?.description || prediction?.structured_formatting?.main_text || searchInput
      searchSelectionLockRef.current = true
      setSearchInput(nextText)
      setPredictions([])
      return
    }

    setSearchBusy(true)
    try {
      const place = new window.google.maps.places.Place({ id: placeId, requestedLanguage: 'en' })
      await place.fetchFields({ fields: ['displayName', 'formattedAddress', 'location', 'viewport'] })
      const finalPlace = {
        location: place.location,
        viewport: place.viewport,
        displayName: place.displayName,
        formattedAddress: place.formattedAddress,
      }
      const finalText = finalPlace.formattedAddress || finalPlace.displayName || searchInput
      searchSelectionLockRef.current = true
      setSearchInput(finalText)
      setPredictions([])
      focusMapOnPlace(finalPlace)
    } catch {
      setSearchError('Unable to load the selected place. Please try again.')
    } finally {
      setSearchBusy(false)
    }
  }, [focusMapOnPlace, searchInput])

  useEffect(() => {
    const query = searchInput.trim()
    if (searchSelectionLockRef.current) {
      searchSelectionLockRef.current = false
      setPredictions([])
      return
    }

    if (!query || !window.google || !window.google.maps || !window.google.maps.places || !window.google.maps.places.AutocompleteSuggestion) {
      setPredictions([])
      return
    }

    const timeout = setTimeout(async () => {
      try {
        const { suggestions } = await window.google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: query,
          locationBias: {
            center: { lat: 12.8797, lng: 121.7740 },
            radius: 50000,
          },
        })

        const nextPredictions = (suggestions || [])
          .map((s: any) => s.placePrediction)
          .filter(Boolean)
          .slice(0, 6)

        setPredictions(nextPredictions)
      } catch {
        setPredictions([])
      }
    }, 220)

    return () => clearTimeout(timeout)
  }, [searchInput])

  const handleSearch = () => {
    const query = searchInput.trim()
    if (!query || !mapRef.current) return

    const g = (window as any)?.google
    if (!g || !g.maps || !g.maps.Geocoder || !g.maps.LatLngBounds) {
      setSearchError('Google Maps is still loading. Please try again in a moment.')
      return
    }

    setSearchBusy(true)
    setSearchError(null)

    const geocodeWithFallback = (request: any) => {
      const geocoder = new g.maps.Geocoder()
      geocoder.geocode(request, (results: any[], status: string) => {
        setSearchBusy(false)

        if (status !== g.maps.GeocoderStatus.OK || !results || !results[0] || !mapRef.current) {
          setSearchError(`No results found for "${query}".`)
          return
        }

        const place = results[0]
        const loc = place.geometry.location
        const viewport = place.geometry.viewport || new g.maps.LatLngBounds(loc, loc)

        mapRef.current.fitBounds(viewport)
        mapRef.current.setCenter(loc)
        mapRef.current.setZoom(Math.max(mapRef.current.getZoom() || 11, 11))
        setSearchError(null)
        setPredictions([])
      })
    }

    geocodeWithFallback({ address: query, componentRestrictions: { country: 'PH' } })
  }

  useEffect(() => {
    return () => {
      try { drawRef.current?.stop() } catch {}
    }
  }, [])

  if (loadError) return <div className="h-[420px] flex items-center justify-center bg-red-50 border rounded-xl text-sm text-red-600">Failed to load Google Maps: {String(loadError)}</div>
  if (!isLoaded) return <div className="h-[420px] flex items-center justify-center bg-gray-50 border rounded-xl text-sm text-gray-500 animate-pulse">Loading map…</div>

  return (
    <div className="space-y-2">
      <div className="flex gap-2 flex-wrap">
        <div className="flex-1 flex gap-2 min-w-[200px] relative">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onFocus={() => setPredictions((prev) => prev.length > 0 ? prev : [])}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearch() } }}
            placeholder="Search location (e.g., Makati, Cebu)…"
            className="flex-1 px-3 py-2 rounded-lg border bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-[#262626] text-sm"
          />
          <button type="button" disabled={searchBusy} onClick={handleSearch} className="px-3 py-2 rounded-lg bg-gray-900 text-white text-xs font-semibold disabled:opacity-60">
            {searchBusy ? 'Searching…' : 'Search'}
          </button>

          {predictions.length > 0 && (
            <div className="absolute left-0 right-[88px] top-[calc(100%+6px)] z-20 bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-lg shadow-lg overflow-hidden">
              {predictions.map((prediction: any, index: number) => {
                const title = prediction?.text?.text || prediction?.structured_formatting?.main_text || 'Location'
                const subtitle = prediction?.text?.text || prediction?.structured_formatting?.secondary_text || ''
                const placeId = prediction?.placeId || prediction?.place_id
                return (
                  <button
                    key={placeId || `${title}-${index}`}
                    type="button"
                    onClick={() => handleSuggestionSelect({ placePrediction: prediction })}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-[#262626] border-b border-gray-100 dark:border-[#262626] last:border-b-0"
                  >
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{title}</div>
                    {subtitle && subtitle !== title && <div className="text-xs text-gray-500 dark:text-[#a1a1aa] truncate">{subtitle}</div>}
                  </button>
                )
              })}
            </div>
          )}
        </div>
        <button type="button" onClick={handleClear} className="px-3 py-2 rounded-lg border bg-white dark:bg-[#171717] text-xs font-medium">Clear All</button>
      </div>
      {searchError && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{searchError}</div>}

      <div className="flex flex-wrap gap-1 p-2 bg-gray-50 dark:bg-[#0a0a0a] rounded-xl border border-gray-200 dark:border-[#262626]">
        <span className="text-xs font-semibold text-gray-500 self-center mr-1">Draw:</span>
        {[
          { id: 'polygon', label: 'Polygon', color: '#eba236' },
          { id: 'rectangle', label: 'Rectangle', color: '#3b82f6' },
          { id: 'circle', label: 'Circle', color: '#10b981' },
        ].map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => handleMode(b.id)}
            className={`px-2.5 py-1.5 rounded-full text-xs font-semibold border flex items-center gap-1 ${mode===b.id?'text-white':'bg-white dark:bg-[#171717] text-gray-700 dark:text-[#a1a1aa] border-gray-200 dark:border-[#262626]'}`}
            style={mode===b.id ? { backgroundColor: b.color, borderColor: b.color } : {}}
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: mode===b.id ? 'white' : b.color }} /> {b.label}
          </button>
        ))}
        <span className="w-px bg-gray-200 dark:bg-[#262626] mx-1" />
        <button type="button" onClick={() => handleMode('select')} className={`px-2.5 py-1.5 rounded-full text-xs font-semibold border ${mode==='select'?'bg-blue-600 text-white border-blue-600':'bg-white dark:bg-[#171717] border-gray-200 dark:border-[#262626]'}`}>Select/Edit</button>
      </div>

      <div
        onContextMenu={(e) => {
          e.preventDefault()
          const draw = drawRef.current
          if (!draw || draw.getSnapshot().length===0) return
          setContextMenu({ x: e.clientX, y: e.clientY })
        }}
        onClick={() => { if (contextMenu) setContextMenu(null) }}
        style={{ height }} className="rounded-xl overflow-hidden border border-gray-200 dark:border-[#262626] relative"
      >
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={center}
          zoom={value ? 12 : 11}
          onLoad={onLoadMap}
          options={{
            streetViewControl: false,
            mapTypeControl: true,
            clickableIcons: false,
            disableDoubleClickZoom: true,
            gestureHandling: 'greedy',
          }}
        >
        </GoogleMap>
        {contextMenu && typeof document !== 'undefined' && createPortal(
          <div
            style={{ left: contextMenu.x, top: contextMenu.y }}
            className="fixed z-[9999] bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#262626] rounded-lg shadow-xl py-1 min-w-[160px] text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-1.5 font-semibold text-gray-700 dark:text-[#a1a1aa] border-b border-gray-100 dark:border-[#262626]">Polygon</div>
            <button type="button" onClick={handleDeleteSelected} className="w-full text-left px-3 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 flex items-center gap-2">
              <span>🗑️</span> Remove
            </button>
            <button type="button" onClick={() => setContextMenu(null)} className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-[#262626] text-gray-600">Cancel</button>
          </div>,
          document.body
        )}
      </div>
      {contextMenu && typeof document !== 'undefined' && createPortal(<div className="fixed inset-0 z-[9998]" onClick={() => setContextMenu(null)} onContextMenu={(e)=>{e.preventDefault(); setContextMenu(null)}} />, document.body)}
      <p className="text-[11px] text-gray-500">
        <b>Polygon:</b> Click to place vertices, double-click or click first vertex to close. <b>Rectangle/Circle:</b> Click then drag. Stay in selected draw mode to add more polygons — only <b>Select/Edit</b> click switches mode. Right-click → Remove to delete whole zone.
      </p>
    </div>
  )
}

// ------------------------------------------------------------
// Overview map: shows all zones + merchant markers (no drawing)
// ------------------------------------------------------------
export function BusinessZoneOverviewMap({
  zones,
  merchantZones,
  height = 260,
  onZoneClick,
}: {
  zones: any[]
  merchantZones: any[]
  height?: number
  onZoneClick?: (zone: any) => void
}) {
  const { isLoaded, loadError } = useJsApiLoader({ googleMapsApiKey: GOOGLE_KEY, libraries })
  const [selectedMerchant, setSelectedMerchant] = useState<any | null>(null)
  const mapRef = useRef<google.maps.Map | null>(null)

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map
    const bounds = new google.maps.LatLngBounds()
    let hasBounds = false
    for (const z of zones) {
      const paths = geoJSONToPaths(z.boundary)
      for (const p of paths) for (const pt of p) { bounds.extend(pt); hasBounds = true }
    }
    for (const m of merchantZones) {
      if (m.merchant_latitude && m.merchant_longitude) { bounds.extend({ lat: Number(m.merchant_latitude), lng: Number(m.merchant_longitude) }); hasBounds = true }
    }
    if (hasBounds) map.fitBounds(bounds)
  }, [zones, merchantZones])

  if (loadError) return <div className="h-[260px] flex items-center justify-center bg-red-50 border rounded-xl text-sm text-red-600">Map failed to load</div>
  if (!isLoaded) return <div className="h-[260px] flex items-center justify-center bg-gray-50 border rounded-xl text-sm text-gray-500 animate-pulse">Loading map…</div>

  return (
    <div style={{ height }} className="rounded-xl overflow-hidden border border-gray-200 dark:border-[#262626]">
      <GoogleMap mapContainerStyle={mapContainerStyle} center={defaultCenter} zoom={11} onLoad={onLoad} options={{ streetViewControl: false, mapTypeControl: true }}>
        {zones.map((z: any) => {
          const paths = geoJSONToPaths(z.boundary)
          if (paths.length === 0) return null
          const isActive = z.isActive !== false
          return paths.map((path, idx) => (
            <Polygon
              key={`${z.id}-${idx}`}
              paths={path}
              options={{
                fillColor: isActive ? '#10b981' : '#ef4444',
                fillOpacity: isActive ? 0.18 : 0.25,
                strokeColor: isActive ? '#10b981' : '#ef4444',
                strokeWeight: 2,
                clickable: true,
              }}
              onClick={() => onZoneClick?.(z)}
            />
          ))
        })}
        {merchantZones.slice(0, 100).map((m: any) => {
          if (!m.service_area) return null
          const paths = geoJSONToPaths(m.service_area)
          if (paths.length === 0) return null
          return paths.map((path, idx) => (
            <Polygon
              key={`sa-${m.id}-${idx}`}
              paths={path}
              options={{
                fillColor: '#3b82f6',
                fillOpacity: 0.1,
                strokeColor: '#3b82f6',
                strokeWeight: 1.5,
                strokeOpacity: 0.6,
                clickable: false,
                zIndex: 1,
              }}
            />
          ))
        })}
        {merchantZones.slice(0, 300).map((m: any) => {
          if (!m.merchant_latitude || !m.merchant_longitude) return null
          return (
            <Marker
              key={`m-${m.id}`}
              position={{ lat: Number(m.merchant_latitude), lng: Number(m.merchant_longitude) }}
              onClick={() => setSelectedMerchant(m)}
              icon={{
                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="${m.businessZone ? '#3b82f6' : '#f59e0b'}" stroke="white" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="white"/></svg>`),
                scaledSize: new google.maps.Size(20, 20),
              }}
            />
          )
        })}
        {selectedMerchant && (
          <InfoWindow position={{ lat: Number(selectedMerchant.merchant_latitude), lng: Number(selectedMerchant.merchant_longitude) }} onCloseClick={() => setSelectedMerchant(null)}>
            <div className="text-xs min-w-[160px]">
              <div className="font-semibold text-gray-900">{selectedMerchant.outletName}</div>
              <div className="text-gray-500 font-mono">{selectedMerchant.outletCode}</div>
              <div className="text-gray-500">{selectedMerchant.vendor?.businessName || '—'} • {selectedMerchant.businessZone ? `Zone: ${selectedMerchant.businessZone.name}` : 'Unassigned'}</div>
              <div className="text-gray-500">{selectedMerchant.service_area ? 'Has service_area' : 'No service_area'}</div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  )
}
