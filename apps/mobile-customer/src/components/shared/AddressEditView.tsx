import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Dimensions,
  PanResponder,
  ScrollView,
} from 'react-native';
import MapView, { Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapLayer, MapTypeControl } from './MapTypeControl';
import {
  ReverseGeocodeDetails,
  reverseGeocode,
} from '../../services/geocoding';

interface AddressEditViewProps {
  address: any;
  initialLat?: number | null;
  initialLng?: number | null;
  isSaving?: boolean;
  fullBleed?: boolean;
  saveLabel?: string;
  cancelLabel?: string;
  headerLabel?: string;
  initialExtraFields?: {
    street?: string;
    floorUnitRoom?: string;
    deliveryInstructions?: string;
    label?: string;
  };
  onChangeCoords: (lat: number, lng: number) => void;
  onAddressDetails?: (details: ReverseGeocodeDetails | null) => void;
  onSave: () => void;
  onCancel: () => void;
  onExtraFieldsChange?: (fields: {
    street?: string;
    floorUnitRoom?: string;
    deliveryInstructions?: string;
    label?: string;
  }) => void;
}

const DEFAULTS = { latitude: 14.5995, longitude: 120.9842 };
const PIN_SIZE = 48;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_COLLAPSED = Math.min(SCREEN_HEIGHT * 0.34, 300);
const SHEET_EXPANDED = SCREEN_HEIGHT * 0.80;

const GEOCODE_DEBOUNCE_MS = 800;
const GEOCODE_MIN_CHANGE_M = 12;

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function AddressEditView({
  address,
  initialLat,
  initialLng,
  isSaving,
  fullBleed = false,
  saveLabel = 'Save',
  cancelLabel = 'Cancel',
  headerLabel = 'Edit your address',
  initialExtraFields,
  onChangeCoords,
  onAddressDetails,
  onSave,
  onCancel,
  onExtraFieldsChange,
}: AddressEditViewProps) {
  const lat = typeof initialLat === 'number' && !Number.isNaN(initialLat)
    ? initialLat
    : DEFAULTS.latitude;
  const lng = typeof initialLng === 'number' && !Number.isNaN(initialLng)
    ? initialLng
    : DEFAULTS.longitude;

  const initialRegion = useMemo(
    () => ({
      latitude: lat,
      longitude: lng,
      latitudeDelta: 0.005,
      longitudeDelta: 0.005,
    }),
    [lat, lng],
  );

  const handleRegionChangeComplete = (region: Region) => {
    onChangeCoords(region.latitude, region.longitude);
    resolveAddress(region.latitude, region.longitude);
  };

  const [resolvedAddress, setResolvedAddress] =
    useState<string>(address?.formatted_address || address?.formattedAddress || '');
  const [mapLayer, setMapLayer] = useState<MapLayer>('standard');

  const reverseGeocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const lastGeocodedRef = useRef<{ lat: number; lng: number } | null>(null);

  const hasKnownAddress = Boolean(address?.formatted_address || address?.formattedAddress);

  useEffect(() => {
    if (hasKnownAddress && Number.isFinite(lat) && Number.isFinite(lng)) {
      lastGeocodedRef.current = { lat, lng };
    }
    return () => {
      if (reverseGeocodeTimer.current) {
        clearTimeout(reverseGeocodeTimer.current);
        reverseGeocodeTimer.current = null;
      }
      abortControllerRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resolveAddress = (lat: number, lng: number) => {
    const last = lastGeocodedRef.current;
    if (last && distanceMeters(last.lat, last.lng, lat, lng) < GEOCODE_MIN_CHANGE_M) {
      return;
    }
    lastGeocodedRef.current = { lat, lng };

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const myRequestId = ++requestIdRef.current;

    if (reverseGeocodeTimer.current) {
      clearTimeout(reverseGeocodeTimer.current);
    }
    reverseGeocodeTimer.current = setTimeout(async () => {
      const details = await reverseGeocode(lat, lng, { signal: controller.signal });
      if (controller.signal.aborted || myRequestId !== requestIdRef.current) return;
      if (details) {
        setResolvedAddress(details.formatted_address);
        onAddressDetails?.(details);
      } else {
        onAddressDetails?.(null);
      }
    }, GEOCODE_DEBOUNCE_MS);
  };

  const handleCancel = () => {
    if (reverseGeocodeTimer.current) {
      clearTimeout(reverseGeocodeTimer.current);
      reverseGeocodeTimer.current = null;
    }
    abortControllerRef.current?.abort();
    onCancel();
  };

  // ── Draggable handle via PanResponder ──────────────────────────────────────
  const sheetHeight = useRef(new Animated.Value(SHEET_COLLAPSED)).current;
  const [isExpanded, setIsExpanded] = useState(false);
  const currentHeight = useRef(SHEET_COLLAPSED);
  const startDragHeight = useRef(SHEET_COLLAPSED);

  const snapToTarget = useCallback((target: number) => {
    Animated.spring(sheetHeight, {
      toValue: target,
      useNativeDriver: false,
      damping: 20,
      stiffness: 200,
      mass: 1,
    }).start();
  }, [sheetHeight]);

  const toggleExpand = () => {
    const target = isExpanded ? SHEET_COLLAPSED : SHEET_EXPANDED;
    setIsExpanded(!isExpanded);
    snapToTarget(target);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
        onPanResponderMove: (_, g) => {
          const next = Math.max(
            SHEET_COLLAPSED,
            Math.min(SHEET_EXPANDED, startDragHeight.current - g.dy)
          );
          currentHeight.current = next;
          sheetHeight.setValue(next);
        },
        onPanResponderRelease: () => {
          const threshold = (SHEET_COLLAPSED + SHEET_EXPANDED) / 2;
          const target = currentHeight.current > threshold ? SHEET_EXPANDED : SHEET_COLLAPSED;
          setIsExpanded(target === SHEET_EXPANDED);
          snapToTarget(target);
        },
        onPanResponderGrant: () => {
          startDragHeight.current = currentHeight.current;
        },
      }),
    [snapToTarget, sheetHeight],
  );
  const [street, setStreet] = useState(initialExtraFields?.street || '');
  const [floorUnitRoom, setFloorUnitRoom] = useState(initialExtraFields?.floorUnitRoom || '');
  const [deliveryInstructions, setDeliveryInstructions] = useState(initialExtraFields?.deliveryInstructions || '');
  const [label, setLabel] = useState(initialExtraFields?.label || '');

  const emitExtraFields = (s: string, f: string, d: string, l: string) => {
    onExtraFieldsChange?.({ street: s, floorUnitRoom: f, deliveryInstructions: d, label: l });
  };

  const addressText =
    resolvedAddress || address?.formatted_address || address?.formattedAddress || 'Address';

  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      {/* ── Map ── */}
      <Animated.View style={[styles.mapWrap, { bottom: sheetHeight }]}>
        <MapView
          style={StyleSheet.absoluteFill}
          mapType={mapLayer}
          initialRegion={initialRegion}
          scrollEnabled
          zoomEnabled
          pitchEnabled={false}
          rotateEnabled={false}
          showsScale
          loadingEnabled
          loadingBackgroundColor="#F9FAFB"
          onRegionChangeComplete={handleRegionChangeComplete}
        />
        <View style={styles.markerWrap} pointerEvents="none">
          <View style={styles.pinBox}>
            <Ionicons name="location" size={PIN_SIZE} color="#f3a823" />
          </View>
        </View>
        <MapTypeControl value={mapLayer} onChange={setMapLayer} />
      </Animated.View>

      <View style={styles.mapHint} pointerEvents="none">
        <Ionicons name="finger-print-outline" size={14} color="#fff" />
        <Ionicons name="swap-horizontal" size={14} color="#fff" />
        <Ionicons name="location" size={13} color="#fff" />
      </View>

      <TouchableOpacity
        style={[styles.backButton, fullBleed && { top: insets.top + 12 }]}
        onPress={handleCancel}
        disabled={isSaving}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="arrow-back" size={22} color="#111827" />
      </TouchableOpacity>

      {/* ── Bottom section (entirely draggable) ── */}
      <Animated.View style={[styles.sheet, { height: sheetHeight }]} {...panResponder.panHandlers}>
        <View style={styles.sheetHandle}>
          <View style={styles.handleBar} />
        </View>

        <ScrollView
          style={styles.sheetBody}
          contentContainerStyle={styles.sheetBodyContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.sheetHeader}>
            <Text style={styles.editLabel}>{headerLabel}</Text>
            <TouchableOpacity onPress={toggleExpand} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name={isExpanded ? 'chevron-down' : 'chevron-up'} size={22} color="#f3a823" />
            </TouchableOpacity>
          </View>

          <Text style={styles.addressText} numberOfLines={3}>
            {addressText}
          </Text>

          <Text style={styles.hint}>Drag the map to fine-tune the exact pin location.</Text>

          {/* ── Extra fields (visible when expanded) ── */}
          {isExpanded && (
            <View style={styles.extraFields}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Street</Text>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="e.g. Rizal Avenue"
                  placeholderTextColor="#9CA3AF"
                  value={street}
                  onChangeText={(t) => { setStreet(t); emitExtraFields(t, floorUnitRoom, deliveryInstructions, label); }}
                  returnKeyType="next"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Floor / Unit / Room</Text>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="e.g. Unit 3A, 2nd Floor"
                  placeholderTextColor="#9CA3AF"
                  value={floorUnitRoom}
                  onChangeText={(t) => { setFloorUnitRoom(t); emitExtraFields(street, t, deliveryInstructions, label); }}
                  returnKeyType="next"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Delivery Instructions</Text>
                <TextInput
                  style={[styles.fieldInput, styles.fieldTextarea]}
                  placeholder="e.g. Ring doorbell twice, leave at the front desk…"
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={3}
                  value={deliveryInstructions}
                  onChangeText={(t) => { setDeliveryInstructions(t); emitExtraFields(street, floorUnitRoom, t, label); }}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Add a label</Text>
                <View style={styles.labelRow}>
                  {['Home', 'Work', 'Partner', 'Other'].map((lbl) => (
                    <TouchableOpacity
                      key={lbl}
                      style={[styles.labelChip, label === lbl && styles.labelChipActive]}
                      onPress={() => {
                        const next = label === lbl ? '' : lbl;
                        setLabel(next);
                        emitExtraFields(street, floorUnitRoom, deliveryInstructions, next);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.labelChipText, label === lbl && styles.labelChipTextActive]}>
                        {lbl}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          )}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel} disabled={isSaving}>
              <Text style={styles.cancelButtonText}>{cancelLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={onSave} disabled={isSaving}>
              {isSaving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveButtonText}>{saveLabel}</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 380,
    backgroundColor: '#F9FAFB',
    overflow: 'hidden',
  },
  mapWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  markerWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinBox: {
    transform: [{ translateY: -(PIN_SIZE / 2) }],
  },
  mapHint: {
    position: 'absolute',
    top: 14,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(17, 24, 39, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  backButton: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 5,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 12,
  },
  sheetHandle: {
    paddingTop: 16,
    paddingBottom: 12,
    alignItems: 'center',
  },
  handleBar: {
    width: 48,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D1D5DB',
  },
  sheetBody: {
    flex: 1,
  },
  sheetBodyContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  editLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f3a823',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  addressText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 22,
  },
  hint: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 8,
  },
  extraFields: {
    marginTop: 16,
    gap: 14,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  fieldInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  fieldTextarea: {
    minHeight: 80,
    paddingTop: 12,
  },
  labelRow: {
    flexDirection: 'row',
    gap: 10,
  },
  labelChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
  },
  labelChipActive: {
    borderColor: '#f3a823',
    backgroundColor: '#fef7e6',
  },
  labelChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  labelChipTextActive: {
    color: '#f3a823',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#f3a823',
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
