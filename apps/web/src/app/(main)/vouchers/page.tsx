'use client'

import React, { useState } from 'react'
import { Ticket, Calendar, Clock, Gift, Star, Filter, Search, Tag } from 'lucide-react'

interface Voucher {
  id: string
  title: string
  description: string
  discount: string
  code: string
  expiryDate: string
  minOrder?: number
  category: 'food' | 'delivery' | 'restaurant' | 'general'
  isUsed: boolean
  isExpired: boolean
  terms: string[]
}

export default function VouchersPage() {
  const [activeTab, setActiveTab] = useState<'available' | 'used' | 'expired'>('available')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  // Mock data for vouchers
  const vouchers: Voucher[] = [
    {
      id: '1',
      title: 'Free Delivery',
      description: 'Get free delivery on your next order',
      discount: 'Free Delivery',
      code: 'FREEDEL2024',
      expiryDate: '2024-03-15',
      minOrder: 300,
      category: 'delivery',
      isUsed: false,
      isExpired: false,
      terms: ['Valid for orders above ₱300', 'Cannot be combined with other offers', 'Valid until March 15, 2024']
    },
    {
      id: '2',
      title: '20% Off Food Orders',
      description: 'Save 20% on all food orders from participating restaurants',
      discount: '20% OFF',
      code: 'FOOD20OFF',
      expiryDate: '2024-02-28',
      minOrder: 500,
      category: 'food',
      isUsed: false,
      isExpired: false,
      terms: ['Valid for food orders only', 'Minimum order ₱500', 'Maximum discount ₱200']
    },
    {
      id: '3',
      title: 'Birthday Special',
      description: 'Special birthday discount for our valued customers',
      discount: '₱100 OFF',
      code: 'BIRTHDAY100',
      expiryDate: '2024-01-30',
      category: 'general',
      isUsed: true,
      isExpired: false,
      terms: ['Valid on birthday month only', 'One-time use per customer']
    },
    {
      id: '4',
      title: 'New Year Promo',
      description: 'Welcome the new year with amazing savings',
      discount: '15% OFF',
      code: 'NEWYEAR15',
      expiryDate: '2024-01-15',
      category: 'general',
      isUsed: false,
      isExpired: true,
      terms: ['Valid until January 15, 2024', 'Cannot be combined with other offers']
    },
    {
      id: '5',
      title: 'Restaurant Partner Deal',
      description: 'Exclusive discount from our partner restaurants',
      discount: '₱150 OFF',
      code: 'PARTNER150',
      expiryDate: '2024-04-01',
      minOrder: 800,
      category: 'restaurant',
      isUsed: false,
      isExpired: false,
      terms: ['Valid at partner restaurants only', 'Minimum order ₱800', 'Valid until April 1, 2024']
    }
  ]

  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'food', label: 'Food' },
    { value: 'delivery', label: 'Delivery' },
    { value: 'restaurant', label: 'Restaurant' },
    { value: 'general', label: 'General' }
  ]

  const filteredVouchers = vouchers.filter(voucher => {
    const matchesTab = 
      (activeTab === 'available' && !voucher.isUsed && !voucher.isExpired) ||
      (activeTab === 'used' && voucher.isUsed) ||
      (activeTab === 'expired' && voucher.isExpired)
    
    const matchesSearch = voucher.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         voucher.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         voucher.code.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesCategory = selectedCategory === 'all' || voucher.category === selectedCategory

    return matchesTab && matchesSearch && matchesCategory
  })

  const handleUseVoucher = (voucherId: string) => {
    console.log('Use voucher:', voucherId)
  }

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    console.log('Copied code:', code)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'food': return '🍽️'
      case 'delivery': return '🚚'
      case 'restaurant': return '🏪'
      default: return '🎁'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white">
        <div className="px-2.5 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Vouchers</h1>
              <p className="text-gray-600 mt-1">Manage and redeem your vouchers</p>
            </div>
            <button
              onClick={() => console.log('Browse vouchers')}
              className="px-4 py-2 bg-white text-[#eba236] border border-[#eba236] rounded-lg hover:bg-[#eba236] hover:text-white transition-colors duration-200 text-sm font-medium"
            >
              Browse More
            </button>
          </div>

          {/* Search and Filter */}
          <div className="space-y-4 mb-6">
            <div className="relative">
              <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search vouchers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#eba236] focus:border-transparent"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto">
              <i className="fas fa-filter w-4 h-4 text-gray-400 flex-shrink-0" />
              {categories.map((category) => (
                <button
                  key={category.value}
                  onClick={() => setSelectedCategory(category.value)}
                  className={`px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    selectedCategory === category.value
                      ? 'bg-[#eba236] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {category.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-6">
            <button
              onClick={() => setActiveTab('available')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'available'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Available ({vouchers.filter(v => !v.isUsed && !v.isExpired).length})
            </button>
            <button
              onClick={() => setActiveTab('used')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'used'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Used ({vouchers.filter(v => v.isUsed).length})
            </button>
            <button
              onClick={() => setActiveTab('expired')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'expired'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Expired ({vouchers.filter(v => v.isExpired).length})
            </button>
          </div>
        </div>
      </div>

      <div className="px-2.5 pb-6">
        {filteredVouchers.length > 0 ? (
          <div className="space-y-4">
            {filteredVouchers.map((voucher) => (
              <div key={voucher.id} className="bg-white rounded-lg p-6 relative overflow-hidden">
                {/* Voucher Design Elements */}
                <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-[#eba236] to-orange-400 opacity-10 rounded-bl-full"></div>
                
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-10 h-10 bg-[#eba236] bg-opacity-10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-lg">{getCategoryIcon(voucher.category)}</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{voucher.title}</h3>
                      <p className="text-gray-600 text-sm mb-2">{voucher.description}</p>
                      
                      <div className="flex items-center gap-4 mb-3">
                        <div className="flex items-center gap-1">
                          <i className="fas fa-tag w-4 h-4 text-[#eba236]" />
                          <span className="text-[#eba236] font-semibold">{voucher.discount}</span>
                        </div>
                        {voucher.minOrder && (
                          <span className="text-xs text-gray-500">Min. order ₱{voucher.minOrder}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-gray-500 block">Voucher Code</span>
                      <span className="font-mono font-semibold text-gray-900">{voucher.code}</span>
                    </div>
                    <button
                      onClick={() => handleCopyCode(voucher.code)}
                      className="px-3 py-1 bg-white text-[#eba236] border border-[#eba236] rounded text-xs font-medium hover:bg-[#eba236] hover:text-white transition-colors duration-200"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <i className="fas fa-calendar w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600">
                      Expires: {formatDate(voucher.expiryDate)}
                    </span>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    voucher.isExpired
                      ? 'bg-red-100 text-red-800'
                      : voucher.isUsed
                      ? 'bg-gray-100 text-gray-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {voucher.isExpired ? 'Expired' : voucher.isUsed ? 'Used' : 'Available'}
                  </span>
                </div>

                {/* Terms and Conditions */}
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-gray-700 mb-2">Terms & Conditions:</h4>
                  <ul className="space-y-1">
                    {voucher.terms.map((term, index) => (
                      <li key={index} className="text-xs text-gray-600 flex items-start gap-1">
                        <span className="w-1 h-1 bg-gray-400 rounded-full mt-1.5 flex-shrink-0"></span>
                        {term}
                      </li>
                    ))}
                  </ul>
                </div>

                {!voucher.isUsed && !voucher.isExpired && (
                  <button
                    onClick={() => handleUseVoucher(voucher.id)}
                    className="w-full py-2 bg-white text-[#eba236] border border-[#eba236] rounded-lg hover:bg-[#eba236] hover:text-white transition-colors duration-200 font-medium"
                  >
                    Use Voucher
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg p-8 text-center">
            <i className="fas fa-ticket-alt w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {activeTab === 'available' && 'No Available Vouchers'}
              {activeTab === 'used' && 'No Used Vouchers'}
              {activeTab === 'expired' && 'No Expired Vouchers'}
            </h3>
            <p className="text-gray-600 mb-6">
              {activeTab === 'available' && 'Check back later for new vouchers and deals.'}
              {activeTab === 'used' && 'Your used vouchers will appear here.'}
              {activeTab === 'expired' && 'Your expired vouchers will appear here.'}
            </p>
            {activeTab === 'available' && (
              <button
                onClick={() => console.log('Browse vouchers')}
                className="px-6 py-2 bg-white text-[#eba236] border border-[#eba236] rounded-lg hover:bg-[#eba236] hover:text-white transition-colors duration-200 font-medium"
              >
                Browse Vouchers
              </button>
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-8 bg-white rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => console.log('Redeem code')}
              className="flex items-center justify-center gap-2 py-3 bg-white text-[#eba236] border border-[#eba236] rounded-lg hover:bg-[#eba236] hover:text-white transition-colors duration-200 text-sm font-medium"
            >
              <i className="fas fa-ticket-alt w-4 h-4" />
              Redeem Code
            </button>
            <button
              onClick={() => console.log('Share voucher')}
              className="flex items-center justify-center gap-2 py-3 bg-white text-[#eba236] border border-[#eba236] rounded-lg hover:bg-[#eba236] hover:text-white transition-colors duration-200 text-sm font-medium"
            >
              <i className="fas fa-gift w-4 h-4" />
              Share Voucher
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}