'use client'

import React, { useState } from 'react'

interface Coupon {
  id: string
  title: string
  description: string
  discount: string
  discountType: 'percentage' | 'fixed' | 'bogo' | 'free_item'
  code: string
  expiryDate: string
  minOrder?: number
  maxDiscount?: number
  category: 'food' | 'delivery' | 'restaurant' | 'drinks' | 'desserts'
  isUsed: boolean
  isExpired: boolean
  usageLimit: number
  usageCount: number
  restaurant?: string
  terms: string[]
}

export default function CouponsPage() {
  const [activeTab, setActiveTab] = useState<'available' | 'used' | 'expired'>('available')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  // Mock data for coupons
  const coupons: Coupon[] = [
    {
      id: '1',
      title: 'Buy 1 Get 1 Free Pizza',
      description: 'Order any large pizza and get another one absolutely free',
      discount: 'BOGO',
      discountType: 'bogo',
      code: 'PIZZA2FOR1',
      expiryDate: '2024-03-20',
      minOrder: 600,
      category: 'food',
      isUsed: false,
      isExpired: false,
      usageLimit: 1,
      usageCount: 0,
      restaurant: 'Mario\'s Pizza Palace',
      terms: ['Valid for large pizzas only', 'Cannot be combined with other offers', 'Dine-in and delivery available']
    },
    {
      id: '2',
      title: '30% Off Burgers',
      description: 'Get 30% discount on all burger meals',
      discount: '30%',
      discountType: 'percentage',
      code: 'BURGER30',
      expiryDate: '2024-02-25',
      minOrder: 400,
      maxDiscount: 150,
      category: 'food',
      isUsed: false,
      isExpired: false,
      usageLimit: 3,
      usageCount: 1,
      restaurant: 'Burger Junction',
      terms: ['Valid for burger meals only', 'Maximum discount ₱150', 'Valid 3 times per customer']
    },
    {
      id: '3',
      title: 'Free Dessert',
      description: 'Get a free dessert with any main course order',
      discount: 'Free Item',
      discountType: 'free_item',
      code: 'FREEDESSERT',
      expiryDate: '2024-01-25',
      minOrder: 500,
      category: 'desserts',
      isUsed: true,
      isExpired: false,
      usageLimit: 1,
      usageCount: 1,
      restaurant: 'Sweet Treats Cafe',
      terms: ['Valid with main course purchase', 'Choose from selected desserts', 'One-time use only']
    },
    {
      id: '4',
      title: '₱100 Off Drinks',
      description: 'Save ₱100 on beverage orders above ₱300',
      discount: '₱100',
      discountType: 'fixed',
      code: 'DRINKS100',
      expiryDate: '2024-01-10',
      minOrder: 300,
      category: 'drinks',
      isUsed: false,
      isExpired: true,
      usageLimit: 2,
      usageCount: 0,
      restaurant: 'Fresh Juice Bar',
      terms: ['Valid for beverages only', 'Minimum order ₱300', 'Valid until January 10, 2024']
    },
    {
      id: '5',
      title: '25% Off Family Meals',
      description: 'Perfect for family dining with 25% savings',
      discount: '25%',
      discountType: 'percentage',
      code: 'FAMILY25',
      expiryDate: '2024-04-15',
      minOrder: 1000,
      maxDiscount: 300,
      category: 'food',
      isUsed: false,
      isExpired: false,
      usageLimit: 2,
      usageCount: 0,
      restaurant: 'Family Feast Restaurant',
      terms: ['Valid for family meal sets', 'Minimum order ₱1000', 'Maximum discount ₱300']
    }
  ]

  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'food', label: 'Food' },
    { value: 'drinks', label: 'Drinks' },
    { value: 'desserts', label: 'Desserts' },
    { value: 'delivery', label: 'Delivery' },
    { value: 'restaurant', label: 'Restaurant' }
  ]

  const filteredCoupons = coupons.filter(coupon => {
    const matchesTab = 
      (activeTab === 'available' && !coupon.isUsed && !coupon.isExpired && coupon.usageCount < coupon.usageLimit) ||
      (activeTab === 'used' && (coupon.isUsed || coupon.usageCount >= coupon.usageLimit)) ||
      (activeTab === 'expired' && coupon.isExpired)
    
    const matchesSearch = coupon.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         coupon.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         coupon.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         coupon.restaurant?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesCategory = selectedCategory === 'all' || coupon.category === selectedCategory

    return matchesTab && matchesSearch && matchesCategory
  })

  const handleUseCoupon = (couponId: string) => {
    console.log('Use coupon:', couponId)
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
      case 'drinks': return '🥤'
      case 'desserts': return '🍰'
      case 'delivery': return '🚚'
      case 'restaurant': return '🏪'
      default: return '🎁'
    }
  }

  const getDiscountIcon = (discountType: string) => {
    switch (discountType) {
      case 'percentage': return <i className="fas fa-percent w-4 h-4" />
      case 'bogo': return <i className="fas fa-copy w-4 h-4" />
      case 'free_item': return <i className="fas fa-gift w-4 h-4" />
      default: return <i className="fas fa-tag w-4 h-4" />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white">
        <div className="px-2.5 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Coupons</h1>
              <p className="text-gray-600 mt-1">Discover and redeem exclusive restaurant coupons</p>
            </div>
            <button
              onClick={() => console.log('Browse coupons')}
              className="px-4 py-2 bg-white text-[#eba236] border border-[#eba236] rounded-lg hover:bg-[#eba236] hover:text-white transition-colors duration-200 text-sm font-medium"
            >
              Discover More
            </button>
          </div>

          {/* Search and Filter */}
          <div className="space-y-4 mb-6">
            <div className="relative">
              <input
                type="text"
                placeholder="Search coupons..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#eba236] focus:border-transparent"
              />
              <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
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
              Available ({coupons.filter(c => !c.isUsed && !c.isExpired && c.usageCount < c.usageLimit).length})
            </button>
            <button
              onClick={() => setActiveTab('used')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'used'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Used ({coupons.filter(c => c.isUsed || c.usageCount >= c.usageLimit).length})
            </button>
            <button
              onClick={() => setActiveTab('expired')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'expired'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Expired ({coupons.filter(c => c.isExpired).length})
            </button>
          </div>
        </div>
      </div>

      <div className="px-2.5 pb-6">
        {filteredCoupons.length > 0 ? (
          <div className="space-y-4">
            {filteredCoupons.map((coupon) => (
              <div key={coupon.id} className="bg-white rounded-lg p-6 relative overflow-hidden">
                {/* Coupon Design Elements */}
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-[#eba236] to-orange-400 opacity-10 rounded-bl-full"></div>
                <div className="absolute -right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 bg-gray-50 rounded-full"></div>
                <div className="absolute -left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 bg-gray-50 rounded-full"></div>
                
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-12 h-12 bg-[#eba236] bg-opacity-10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-lg">{getCategoryIcon(coupon.category)}</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{coupon.title}</h3>
                      <p className="text-gray-600 text-sm mb-2">{coupon.description}</p>
                      {coupon.restaurant && (
                        <p className="text-[#eba236] text-sm font-medium mb-2">📍 {coupon.restaurant}</p>
                      )}
                      
                      <div className="flex items-center gap-4 mb-3">
                        <div className="flex items-center gap-2">
                          <div className="text-[#eba236]">
                            {getDiscountIcon(coupon.discountType)}
                          </div>
                          <span className="text-[#eba236] font-bold text-lg">{coupon.discount}</span>
                        </div>
                        {coupon.minOrder && (
                          <span className="text-xs text-gray-500">Min. order ₱{coupon.minOrder}</span>
                        )}
                        {coupon.maxDiscount && (
                          <span className="text-xs text-gray-500">Max. ₱{coupon.maxDiscount}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-3 mb-4 border-2 border-dashed border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-gray-500 block">Coupon Code</span>
                      <span className="font-mono font-bold text-gray-900 text-lg">{coupon.code}</span>
                    </div>
                    <button
                      onClick={() => handleCopyCode(coupon.code)}
                      className="px-3 py-1 bg-white text-[#eba236] border border-[#eba236] rounded text-xs font-medium hover:bg-[#eba236] hover:text-white transition-colors duration-200"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <i className="fas fa-calendar w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        Expires: {formatDate(coupon.expiryDate)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <i className="fas fa-cut w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        {coupon.usageCount}/{coupon.usageLimit} used
                      </span>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    coupon.isExpired
                      ? 'bg-red-100 text-red-800'
                      : coupon.usageCount >= coupon.usageLimit
                      ? 'bg-gray-100 text-gray-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {coupon.isExpired ? 'Expired' : coupon.usageCount >= coupon.usageLimit ? 'Used Up' : 'Available'}
                  </span>
                </div>

                {/* Terms and Conditions */}
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-gray-700 mb-2">Terms & Conditions:</h4>
                  <ul className="space-y-1">
                    {coupon.terms.map((term, index) => (
                      <li key={index} className="text-xs text-gray-600 flex items-start gap-1">
                        <span className="w-1 h-1 bg-gray-400 rounded-full mt-1.5 flex-shrink-0"></span>
                        {term}
                      </li>
                    ))}
                  </ul>
                </div>

                {!coupon.isUsed && !coupon.isExpired && coupon.usageCount < coupon.usageLimit && (
                  <button
                    onClick={() => handleUseCoupon(coupon.id)}
                    className="w-full py-3 bg-white text-[#eba236] border border-[#eba236] rounded-lg hover:bg-[#eba236] hover:text-white transition-colors duration-200 font-medium"
                  >
                    Use Coupon
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg p-8 text-center">
            <i className="fas fa-cut w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {activeTab === 'available' && 'No Available Coupons'}
              {activeTab === 'used' && 'No Used Coupons'}
              {activeTab === 'expired' && 'No Expired Coupons'}
            </h3>
            <p className="text-gray-600 mb-6">
              {activeTab === 'available' && 'Check back later for new restaurant coupons and deals.'}
              {activeTab === 'used' && 'Your used coupons will appear here.'}
              {activeTab === 'expired' && 'Your expired coupons will appear here.'}
            </p>
            {activeTab === 'available' && (
              <button
                onClick={() => console.log('Browse coupons')}
                className="px-6 py-2 bg-white text-[#eba236] border border-[#eba236] rounded-lg hover:bg-[#eba236] hover:text-white transition-colors duration-200 font-medium"
              >
                Discover Coupons
              </button>
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-8 bg-white rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => console.log('Redeem coupon code')}
              className="flex items-center justify-center gap-2 py-3 bg-white text-[#eba236] border border-[#eba236] rounded-lg hover:bg-[#eba236] hover:text-white transition-colors duration-200 text-sm font-medium"
            >
              <i className="fas fa-cut w-4 h-4" />
              Redeem Code
            </button>
            <button
              onClick={() => console.log('Browse restaurants')}
              className="flex items-center justify-center gap-2 py-3 bg-white text-[#eba236] border border-[#eba236] rounded-lg hover:bg-[#eba236] hover:text-white transition-colors duration-200 text-sm font-medium"
            >
              <i className="fas fa-star w-4 h-4" />
              Browse Restaurants
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}