'use client';

import React, { useState } from 'react';
import ImageWrapper from '@/components/ui/ImageWrapper';

/**
 * Perks Page - Member benefits and exclusive offers
 * Features professional perks management with minimal design
 */
export default function PerksPage() {
  const [activeCategory, setActiveCategory] = useState('all');

  // Mock perks data
  const membershipTier = {
    current: 'Gold',
    progress: 75,
    nextTier: 'Platinum',
    ordersToNext: 8,
    totalOrders: 42
  };

  const perks = [
    {
      id: 1,
      title: 'Free Delivery',
      description: 'Get free delivery on orders over $25',
      category: 'delivery',
      tier: 'Bronze',
      icon: 'fa-shipping-fast',
      color: 'blue',
      isActive: true,
      usageCount: 15,
      maxUsage: null
    },
    {
      id: 2,
      title: 'Priority Support',
      description: '24/7 priority customer support',
      category: 'support',
      tier: 'Gold',
      icon: 'fa-headset',
      color: 'purple',
      isActive: true,
      usageCount: 3,
      maxUsage: null
    },
    {
      id: 3,
      title: 'Early Access',
      description: 'First access to new restaurants and menus',
      category: 'exclusive',
      tier: 'Gold',
      icon: 'fa-star',
      color: 'yellow',
      isActive: true,
      usageCount: 8,
      maxUsage: null
    },
    {
      id: 4,
      title: 'Double Points',
      description: 'Earn 2x points on weekend orders',
      category: 'rewards',
      tier: 'Silver',
      icon: 'fa-coins',
      color: 'green',
      isActive: true,
      usageCount: 12,
      maxUsage: null
    },
    {
      id: 5,
      title: 'VIP Events',
      description: 'Exclusive invites to food events and tastings',
      category: 'exclusive',
      tier: 'Platinum',
      icon: 'fa-calendar-star',
      color: 'indigo',
      isActive: false,
      usageCount: 0,
      maxUsage: 5
    },
    {
      id: 6,
      title: 'Birthday Treat',
      description: 'Special discount on your birthday month',
      category: 'special',
      tier: 'Bronze',
      icon: 'fa-birthday-cake',
      color: 'pink',
      isActive: true,
      usageCount: 1,
      maxUsage: 1
    }
  ];

  const categories = [
    { id: 'all', name: 'All Perks', icon: 'fa-gift' },
    { id: 'delivery', name: 'Delivery', icon: 'fa-shipping-fast' },
    { id: 'rewards', name: 'Rewards', icon: 'fa-coins' },
    { id: 'exclusive', name: 'Exclusive', icon: 'fa-star' },
    { id: 'support', name: 'Support', icon: 'fa-headset' },
    { id: 'special', name: 'Special', icon: 'fa-sparkles' }
  ];

  const filteredPerks = activeCategory === 'all' 
    ? perks 
    : perks.filter(perk => perk.category === activeCategory);

  const getColorClasses = (color: string) => {
    const colorMap = {
      blue: 'bg-blue-100 text-blue-600',
      purple: 'bg-purple-100 text-purple-600',
      yellow: 'bg-yellow-100 text-yellow-600',
      green: 'bg-green-100 text-green-600',
      indigo: 'bg-indigo-100 text-indigo-600',
      pink: 'bg-pink-100 text-pink-600'
    };
    return colorMap[color as keyof typeof colorMap] || 'bg-gray-100 text-gray-600';
  };

  const getTierColor = (tier: string) => {
    const tierColors = {
      Bronze: 'text-orange-600 bg-orange-100',
      Silver: 'text-gray-600 bg-gray-100',
      Gold: 'text-yellow-600 bg-yellow-100',
      Platinum: 'text-purple-600 bg-purple-100'
    };
    return tierColors[tier as keyof typeof tierColors] || 'text-gray-600 bg-gray-100';
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white">
        <div className="max-w-7xl mx-auto px-2.5 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">My Perks</h1>
              <p className="mt-1 text-sm text-gray-600">Exclusive benefits and rewards</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-2.5 py-4">
        {/* Membership Status */}
        <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-lg p-6 text-white mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold">{membershipTier.current} Member</h2>
              <p className="text-yellow-100 text-sm">
                {membershipTier.ordersToNext} more orders to reach {membershipTier.nextTier}
              </p>
            </div>
            <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              <i className="fas fa-crown text-2xl"></i>
            </div>
          </div>
          
          <div className="mb-3">
            <div className="flex justify-between text-sm mb-1">
              <span>Progress to {membershipTier.nextTier}</span>
              <span>{membershipTier.progress}%</span>
            </div>
            <div className="w-full bg-white bg-opacity-20 rounded-full h-2">
              <div 
                className="bg-white h-2 rounded-full transition-all duration-300"
                style={{ width: `${membershipTier.progress}%` }}
              ></div>
            </div>
          </div>
          
          <p className="text-yellow-100 text-sm">
            Total Orders: {membershipTier.totalOrders}
          </p>
        </div>

        {/* Category Filter */}
        <div className="bg-white rounded-lg p-4 mb-6">
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeCategory === category.id
                    ? 'text-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
                style={activeCategory === category.id ? { backgroundColor: '#eba236' } : {}}
              >
                <i className={`fas ${category.icon} mr-2`}></i>
                {category.name}
              </button>
            ))}
          </div>
        </div>

        {/* Perks Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {filteredPerks.map((perk) => (
            <div key={perk.id} className={`bg-white rounded-lg p-4 hover:shadow-md transition-shadow ${
              !perk.isActive ? 'opacity-60' : ''
            }`}>
              <div className="flex items-start justify-between mb-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${getColorClasses(perk.color)}`}>
                  <i className={`fas ${perk.icon} text-lg`}></i>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${getTierColor(perk.tier)}`}>
                    {perk.tier}
                  </span>
                  {perk.isActive ? (
                    <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-1 rounded-full">
                      Active
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                      Locked
                    </span>
                  )}
                </div>
              </div>
              
              <h3 className="font-semibold text-gray-900 mb-2">{perk.title}</h3>
              <p className="text-sm text-gray-600 mb-3">{perk.description}</p>
              
              {perk.isActive && (
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>
                    Used: {perk.usageCount}{perk.maxUsage ? `/${perk.maxUsage}` : ''}
                  </span>
                  {perk.maxUsage && (
                    <div className="w-16 bg-gray-200 rounded-full h-1">
                      <div 
                        className="bg-blue-500 h-1 rounded-full"
                        style={{ width: `${(perk.usageCount / perk.maxUsage) * 100}%` }}
                      ></div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Tier Benefits */}
        <div className="bg-white rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
            <i className="fas fa-layer-group mr-2 text-gray-600"></i>
            Membership Tiers
          </h3>
          
          <div className="space-y-4">
            {['Bronze', 'Silver', 'Gold', 'Platinum'].map((tier, index) => (
              <div key={tier} className={`p-4 rounded-lg border-2 ${
                tier === membershipTier.current 
                  ? 'border-yellow-400 bg-yellow-50' 
                  : 'border-gray-200 bg-gray-50'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <span className={`text-sm font-medium px-3 py-1 rounded-full ${getTierColor(tier)}`}>
                      {tier}
                    </span>
                    {tier === membershipTier.current && (
                      <span className="text-xs font-medium text-yellow-600 bg-yellow-100 px-2 py-1 rounded-full">
                        Current
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-gray-600">
                    {index * 10} orders required
                  </span>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-gray-600">
                  <span>• Free delivery</span>
                  <span>• {index + 1}x points</span>
                  <span>• Priority support</span>
                  <span>• Exclusive offers</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button className="flex items-center p-3 text-left hover:bg-gray-50 rounded-lg transition-colors">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                <i className="fas fa-history text-blue-600 text-sm"></i>
              </div>
              <div>
                <p className="font-medium text-gray-900 text-sm">Perk History</p>
                <p className="text-xs text-gray-500">View usage history</p>
              </div>
            </button>
            <button className="flex items-center p-3 text-left hover:bg-gray-50 rounded-lg transition-colors">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                <i className="fas fa-question-circle text-green-600 text-sm"></i>
              </div>
              <div>
                <p className="font-medium text-gray-900 text-sm">How Perks Work</p>
                <p className="text-xs text-gray-500">Learn about benefits</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}