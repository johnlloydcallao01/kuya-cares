'use client';

import React, { useState } from 'react';
import ImageWrapper from '@/components/ui/ImageWrapper';

/**
 * Settings Page - Manage app preferences and account settings
 * Features professional settings management with minimal design
 */
export default function SettingsPage() {
  const [notifications, setNotifications] = useState({
    orderUpdates: true,
    promotions: false,
    newRestaurants: true,
    weeklyDigest: false
  });

  const [preferences, setPreferences] = useState({
    language: 'en',
    currency: 'USD',
    theme: 'light',
    autoLocation: true
  });

  const handleNotificationChange = (key: string, value: boolean) => {
    setNotifications(prev => ({ ...prev, [key]: value }));
  };

  const handlePreferenceChange = (key: string, value: string | boolean) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  const settingSections = [
    {
      title: 'Account',
      icon: 'fa-user',
      items: [
        { label: 'Profile Information', icon: 'fa-edit', action: () => console.log('Edit profile') },
        { label: 'Change Password', icon: 'fa-lock', action: () => console.log('Change password') },
        { label: 'Email Preferences', icon: 'fa-envelope', action: () => console.log('Email preferences') },
        { label: 'Phone Number', icon: 'fa-phone', action: () => console.log('Phone number') }
      ]
    },
    {
      title: 'Privacy & Security',
      icon: 'fa-shield-alt',
      items: [
        { label: 'Two-Factor Authentication', icon: 'fa-mobile-alt', action: () => console.log('2FA') },
        { label: 'Login Activity', icon: 'fa-history', action: () => console.log('Login activity') },
        { label: 'Data & Privacy', icon: 'fa-database', action: () => console.log('Data privacy') },
        { label: 'Delete Account', icon: 'fa-trash', action: () => console.log('Delete account'), danger: true }
      ]
    },
    {
      title: 'Orders & Delivery',
      icon: 'fa-shopping-bag',
      items: [
        { label: 'Default Delivery Address', icon: 'fa-map-marker-alt', action: () => console.log('Default address') },
        { label: 'Delivery Instructions', icon: 'fa-clipboard-list', action: () => console.log('Delivery instructions') },
        { label: 'Order History', icon: 'fa-receipt', action: () => console.log('Order history') },
        { label: 'Favorite Restaurants', icon: 'fa-heart', action: () => console.log('Favorites') }
      ]
    },
    {
      title: 'Support',
      icon: 'fa-life-ring',
      items: [
        { label: 'Help Center', icon: 'fa-question-circle', action: () => console.log('Help center') },
        { label: 'Contact Support', icon: 'fa-headset', action: () => console.log('Contact support') },
        { label: 'Report a Problem', icon: 'fa-exclamation-triangle', action: () => console.log('Report problem') },
        { label: 'Terms of Service', icon: 'fa-file-contract', action: () => console.log('Terms') }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white">
        <div className="w-full px-2.5 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
              <p className="mt-1 text-sm text-gray-600">Manage your account and preferences</p>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-2.5 py-4">
        {/* User Profile Card */}
        <div className="bg-white rounded-lg p-4 mb-6">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
              <i className="fas fa-user text-2xl text-gray-600"></i>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">John Doe</h3>
              <p className="text-sm text-gray-600">john.doe@example.com</p>
              <p className="text-xs text-gray-500 mt-1">Member since January 2024</p>
            </div>
            <button 
              className="px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
              style={{
                border: '1px solid #eba236',
                color: '#eba236',
                backgroundColor: 'white'
              }}
            >
              Edit Profile
            </button>
          </div>
        </div>

        {/* Notifications Settings */}
        <div className="bg-white rounded-lg p-4 mb-4">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
            <i className="fas fa-bell mr-2 text-gray-600"></i>
            Notifications
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Order Updates</p>
                <p className="text-sm text-gray-600">Get notified about your order status</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifications.orderUpdates}
                  onChange={(e) => handleNotificationChange('orderUpdates', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Promotions & Offers</p>
                <p className="text-sm text-gray-600">Receive deals and special offers</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifications.promotions}
                  onChange={(e) => handleNotificationChange('promotions', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">New Restaurants</p>
                <p className="text-sm text-gray-600">Know when new restaurants join</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifications.newRestaurants}
                  onChange={(e) => handleNotificationChange('newRestaurants', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* App Preferences */}
        <div className="bg-white rounded-lg p-4 mb-4">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
            <i className="fas fa-cog mr-2 text-gray-600"></i>
            App Preferences
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Language</p>
                <p className="text-sm text-gray-600">Choose your preferred language</p>
              </div>
              <select
                value={preferences.language}
                onChange={(e) => handlePreferenceChange('language', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Currency</p>
                <p className="text-sm text-gray-600">Display prices in your currency</p>
              </div>
              <select
                value={preferences.currency}
                onChange={(e) => handlePreferenceChange('currency', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="CAD">CAD (C$)</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Auto-detect Location</p>
                <p className="text-sm text-gray-600">Automatically find nearby restaurants</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.autoLocation}
                  onChange={(e) => handlePreferenceChange('autoLocation', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Settings Sections */}
        {settingSections.map((section, index) => (
          <div key={index} className="bg-white rounded-lg p-4 mb-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
              <i className={`fas ${section.icon} mr-2 text-gray-600`}></i>
              {section.title}
            </h3>
            <div className="space-y-1">
              {section.items.map((item, itemIndex) => (
                <button
                  key={itemIndex}
                  onClick={item.action}
                  className={`w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors text-left ${
                    item.danger ? 'hover:bg-red-50' : ''
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <i className={`fas ${item.icon} text-sm ${
                      item.danger ? 'text-red-500' : 'text-gray-400'
                    }`}></i>
                    <span className={`font-medium ${
                      item.danger ? 'text-red-600' : 'text-gray-900'
                    }`}>
                      {item.label}
                    </span>
                  </div>
                  <i className="fas fa-chevron-right text-gray-400 text-xs"></i>
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* App Info */}
        <div className="bg-white rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
            <i className="fas fa-info-circle mr-2 text-gray-600"></i>
            App Information
          </h3>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>Version</span>
              <span>2.1.0</span>
            </div>
            <div className="flex justify-between">
              <span>Build</span>
              <span>2024.01.15</span>
            </div>
            <div className="flex justify-between">
              <span>Last Updated</span>
              <span>January 15, 2024</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200">
            <button 
              className="w-full py-2 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
              style={{
                border: '1px solid #eba236',
                color: '#eba236',
                backgroundColor: 'white'
              }}
            >
              Check for Updates
            </button>
          </div>
        </div>

        {/* Logout Button */}
        <div className="mt-6">
          <button className="w-full bg-red-600 text-white py-3 rounded-lg hover:bg-red-700 transition-colors font-medium">
            <i className="fas fa-sign-out-alt mr-2"></i>
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
