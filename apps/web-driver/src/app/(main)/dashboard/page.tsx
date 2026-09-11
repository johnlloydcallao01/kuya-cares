'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import { useUser } from '@/hooks/useAuth';

const mapContainerStyle = {
  width: '100%',
  height: '500px',
  borderRadius: '0.5rem',
};

const defaultCenter = {
  lat: 14.5995, // Manila default
  lng: 120.9842,
};

export default function DashboardPage() {
  const { user } = useUser();
  const [driverId, setDriverId] = useState('');
  const [isOnline, setIsOnline] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastSavedLocationKeyRef = useRef<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL;
  const API_KEY = process.env.NEXT_PUBLIC_PAYLOAD_API_KEY;
  const MAPS_API_KEY = process.env.NEXT_PUBLIC_MAPS_BACKEND_KEY || '';

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: MAPS_API_KEY,
  });

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 19)]);
  }, []);

  // Fetch driver profile for current user
  useEffect(() => {
    const fetchDriverProfile = async () => {
      if (!user?.id || !API_URL || !API_KEY) return;

      try {
        const response = await axios.get(`${API_URL}/drivers`, {
          params: {
            where: {
              user: {
                equals: user.id,
              },
            },
          },
          headers: {
            Authorization: `users API-Key ${API_KEY}`,
          },
        });

        if (response.data.docs.length > 0) {
          const driver = response.data.docs[0];
          setDriverId(driver.id);
          addLog(`✅ Driver profile loaded`);
          
          if (driver.current_latitude && driver.current_longitude) {
            setLocation({
              lat: driver.current_latitude,
              lng: driver.current_longitude,
            });
          }
        } else {
          addLog(`⚠️ No driver profile found. Please contact admin.`);
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        addLog(`❌ Failed to load driver profile: ${message}`);
      }
    };

    fetchDriverProfile();
  }, [user, API_URL, API_KEY, addLog]);

  const updateLocation = useCallback(async (lat: number, lng: number) => {
    if (!driverId) return;

    try {
      await axios.patch(
        `${API_URL}/drivers/${driverId}`,
        {
          current_latitude: lat,
          current_longitude: lng,
        },
        {
          headers: {
            Authorization: `users API-Key ${API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );
      addLog(`✅ Updated: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    } catch (error: unknown) {
      console.error(error);
      let message = 'Unknown error';
      if (axios.isAxiosError(error)) {
        message = error.response?.data?.errors?.[0]?.message || error.message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      addLog(`❌ Update failed: ${message}`);
    }
  }, [API_KEY, API_URL, addLog, driverId]);

  const detectLocationOnce = async () => {
    if (isDetectingLocation) return;

    if (!navigator.geolocation) {
      addLog('❌ Geolocation is not supported by your browser');
      return;
    }

    setIsDetectingLocation(true);
    addLog('📍 Detecting location...');

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      const { latitude, longitude } = position.coords;
      setLocation({ lat: latitude, lng: longitude });
      if (driverId) {
        await updateLocation(latitude, longitude);
      } else {
        addLog(`⚠️ Location detected but driver profile not loaded yet`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      addLog(`❌ Location error: ${message}`);
    } finally {
      setIsDetectingLocation(false);
    }
  };

  useEffect(() => {
    if (!driverId || !location) return;

    const key = `${driverId}:${location.lat}:${location.lng}`;
    if (lastSavedLocationKeyRef.current === key) return;

    lastSavedLocationKeyRef.current = key;
    updateLocation(location.lat, location.lng);
  }, [driverId, location, updateLocation]);

  const startTracking = () => {
    if (!navigator.geolocation) {
      addLog('❌ Geolocation is not supported by your browser');
      return;
    }

    if (!driverId) {
      addLog('❌ No driver profile loaded');
      return;
    }

    setIsOnline(true);
    addLog('🚀 Started tracking');

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setLocation({ lat: latitude, lng: longitude });
        updateLocation(latitude, longitude);
      },
      (error) => {
        addLog(`❌ Location error: ${error.message}`);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsOnline(false);
    addLog('🛑 Stopped tracking');
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  if (!isLoaded) {
    return <div>Loading Map...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">Welcome back, {user?.firstName}!</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className={`px-4 py-2 rounded-full font-medium ${
            isOnline ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
          }`}>
            Status: {isOnline ? 'Online' : 'Offline'}
          </div>
          
          <button
            onClick={detectLocationOnce}
            className="px-6 py-2 bg-white text-gray-900 rounded-lg hover:bg-gray-50 transition-colors shadow-sm border border-gray-200"
          >
            {isDetectingLocation ? 'Detecting...' : 'Detect My Location'}
          </button>

          {!isOnline ? (
            <button
              onClick={startTracking}
              disabled={!driverId}
              className={`px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm ${
                !driverId ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              Go Online
            </button>
          ) : (
            <button
              onClick={stopTracking}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm"
            >
              Go Offline
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map Section */}
        <div className="lg:col-span-2 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold mb-4">Live Location</h2>
          <div className="rounded-lg overflow-hidden">
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={location || defaultCenter}
              zoom={15}
              options={{
                streetViewControl: false,
                mapTypeControl: false,
              }}
            >
              {location && (
                <Marker
                  position={location}
                  title="Your Location"
                />
              )}
            </GoogleMap>
          </div>
        </div>

        {/* Activity Log Section */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 h-[600px] flex flex-col">
          <h2 className="text-lg font-semibold mb-4">Activity Log</h2>
          <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {logs.length === 0 ? (
              <p className="text-gray-400 text-center py-4">No activity yet</p>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="text-sm text-gray-600 bg-gray-50 p-2 rounded border border-gray-100">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
