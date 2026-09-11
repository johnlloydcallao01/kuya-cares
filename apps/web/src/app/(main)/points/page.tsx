'use client'

import React, { useState } from 'react'

interface PointsTransaction {
  id: string
  type: 'earned' | 'redeemed' | 'expired'
  amount: number
  description: string
  date: string
  orderId?: string
  restaurant?: string
}

interface Reward {
  id: string
  title: string
  description: string
  pointsCost: number
  category: 'food' | 'delivery' | 'discount' | 'exclusive'
  image: string
  isAvailable: boolean
  expiryDate?: string
  terms: string[]
}

interface Achievement {
  id: string
  title: string
  description: string
  pointsReward: number
  progress: number
  target: number
  isCompleted: boolean
  icon: string
}

export default function PointsPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'rewards' | 'history' | 'achievements'>('overview')

  // Mock data
  const currentPoints = 2450
  const pointsThisMonth = 380
  const totalEarned = 15670
  const totalRedeemed = 13220

  const recentTransactions: PointsTransaction[] = [
    {
      id: '1',
      type: 'earned',
      amount: 50,
      description: 'Order completion bonus',
      date: '2024-01-20',
      orderId: 'ORD-2024-001',
      restaurant: 'Mario\'s Pizza Palace'
    },
    {
      id: '2',
      type: 'earned',
      amount: 25,
      description: 'Review bonus',
      date: '2024-01-19',
      orderId: 'ORD-2024-002',
      restaurant: 'Burger Junction'
    },
    {
      id: '3',
      type: 'redeemed',
      amount: -200,
      description: 'Free delivery voucher',
      date: '2024-01-18'
    },
    {
      id: '4',
      type: 'earned',
      amount: 100,
      description: 'Weekly challenge completed',
      date: '2024-01-17'
    },
    {
      id: '5',
      type: 'earned',
      amount: 75,
      description: 'Large order bonus (₱1000+)',
      date: '2024-01-16',
      orderId: 'ORD-2024-003',
      restaurant: 'Family Feast Restaurant'
    }
  ]

  const availableRewards: Reward[] = [
    {
      id: '1',
      title: 'Free Delivery',
      description: 'Get free delivery on your next order',
      pointsCost: 200,
      category: 'delivery',
      image: '🚚',
      isAvailable: true,
      terms: ['Valid for 30 days', 'Cannot be combined with other offers', 'Minimum order ₱300']
    },
    {
      id: '2',
      title: '₱100 Food Voucher',
      description: 'Save ₱100 on food orders above ₱500',
      pointsCost: 500,
      category: 'discount',
      image: '🍽️',
      isAvailable: true,
      expiryDate: '2024-03-31',
      terms: ['Minimum order ₱500', 'Valid for 60 days', 'Food orders only']
    },
    {
      id: '3',
      title: 'Premium Membership (1 Month)',
      description: 'Enjoy premium benefits for one month',
      pointsCost: 1000,
      category: 'exclusive',
      image: '👑',
      isAvailable: true,
      terms: ['Includes free delivery', 'Priority support', 'Exclusive deals access']
    },
    {
      id: '4',
      title: 'Free Dessert',
      description: 'Get a free dessert with any main course',
      pointsCost: 300,
      category: 'food',
      image: '🍰',
      isAvailable: true,
      terms: ['Valid at participating restaurants', 'With main course purchase', 'Valid for 45 days']
    },
    {
      id: '5',
      title: '₱250 Restaurant Credit',
      description: 'Credit to use at any partner restaurant',
      pointsCost: 1200,
      category: 'discount',
      image: '💳',
      isAvailable: false,
      terms: ['Valid at all partner restaurants', 'No minimum order', 'Valid for 90 days']
    }
  ]

  const achievements: Achievement[] = [
    {
      id: '1',
      title: 'First Order',
      description: 'Complete your first order',
      pointsReward: 100,
      progress: 1,
      target: 1,
      isCompleted: true,
      icon: '🎯'
    },
    {
      id: '2',
      title: 'Frequent Diner',
      description: 'Complete 10 orders',
      pointsReward: 250,
      progress: 7,
      target: 10,
      isCompleted: false,
      icon: '🍽️'
    },
    {
      id: '3',
      title: 'Review Master',
      description: 'Leave 5 restaurant reviews',
      pointsReward: 150,
      progress: 3,
      target: 5,
      isCompleted: false,
      icon: '⭐'
    },
    {
      id: '4',
      title: 'Big Spender',
      description: 'Spend ₱5000 in total',
      pointsReward: 500,
      progress: 3200,
      target: 5000,
      isCompleted: false,
      icon: '💰'
    }
  ]

  const handleRedeemReward = (rewardId: string) => {
    console.log('Redeem reward:', rewardId)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'food': return 'bg-orange-100 text-orange-800'
      case 'delivery': return 'bg-blue-100 text-blue-800'
      case 'discount': return 'bg-green-100 text-green-800'
      case 'exclusive': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white">
        <div className="px-2.5 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Points & Rewards</h1>
              <p className="text-gray-600 mt-1">Earn points and redeem amazing rewards</p>
            </div>
            <button
              onClick={() => console.log('How to earn points')}
              className="px-4 py-2 bg-white text-[#eba236] border border-[#eba236] rounded-lg hover:bg-[#eba236] hover:text-white transition-colors duration-200 text-sm font-medium"
            >
              How to Earn
            </button>
          </div>

          {/* Points Balance Card */}
          <div className="bg-gradient-to-r from-[#eba236] to-orange-400 rounded-lg p-6 text-white mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold mb-1">Current Balance</h2>
                <div className="flex items-center gap-2">
                  <i className="fas fa-coins w-6 h-6" />
                  <span className="text-3xl font-bold">{currentPoints.toLocaleString()}</span>
                  <span className="text-lg opacity-90">points</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm opacity-90 mb-1">This Month</div>
                <div className="flex items-center gap-1">
                  <i className="fas fa-chart-line w-4 h-4" />
                  <span className="font-semibold">+{pointsThisMonth}</span>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white border-opacity-20">
              <div>
                <div className="text-sm opacity-90">Total Earned</div>
                <div className="font-semibold">{totalEarned.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-sm opacity-90">Total Redeemed</div>
                <div className="font-semibold">{totalRedeemed.toLocaleString()}</div>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-6 overflow-x-auto">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'overview'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('rewards')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'rewards'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Rewards
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'history'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              History
            </button>
            <button
              onClick={() => setActiveTab('achievements')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'achievements'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Achievements
            </button>
          </div>
        </div>
      </div>

      <div className="px-2.5 pb-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-white rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setActiveTab('rewards')}
                  className="flex items-center justify-center gap-2 py-3 bg-white text-[#eba236] border border-[#eba236] rounded-lg hover:bg-[#eba236] hover:text-white transition-colors duration-200 text-sm font-medium"
                >
                  <i className="fas fa-gift w-4 h-4" />
                  Browse Rewards
                </button>
                <button
                  onClick={() => setActiveTab('achievements')}
                  className="flex items-center justify-center gap-2 py-3 bg-white text-[#eba236] border border-[#eba236] rounded-lg hover:bg-[#eba236] hover:text-white transition-colors duration-200 text-sm font-medium"
                >
                  <i className="fas fa-trophy w-4 h-4" />
                  View Achievements
                </button>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
                <button
                  onClick={() => setActiveTab('history')}
                  className="text-[#eba236] text-sm font-medium hover:underline"
                >
                  View All
                </button>
              </div>
              <div className="space-y-3">
                {recentTransactions.slice(0, 3).map((transaction) => (
                  <div key={transaction.id} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        transaction.type === 'earned' 
                          ? 'bg-green-100 text-green-600' 
                          : transaction.type === 'redeemed'
                          ? 'bg-blue-100 text-blue-600'
                          : 'bg-red-100 text-red-600'
                      }`}>
                        {transaction.type === 'earned' ? '+' : transaction.type === 'redeemed' ? '-' : '!'}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{transaction.description}</p>
                        <p className="text-xs text-gray-500">{formatDate(transaction.date)}</p>
                      </div>
                    </div>
                    <span className={`font-semibold ${
                      transaction.type === 'earned' ? 'text-green-600' : 'text-gray-600'
                    }`}>
                      {transaction.type === 'earned' ? '+' : ''}{transaction.amount}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Ways to Earn */}
            <div className="bg-white rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Ways to Earn Points</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-8 h-8 bg-[#eba236] bg-opacity-10 rounded-lg flex items-center justify-center">
                    <span>🛒</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">Complete Orders</p>
                    <p className="text-sm text-gray-600">Earn 1 point for every ₱10 spent</p>
                  </div>
                  <span className="text-[#eba236] font-semibold">1pt/₱10</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-8 h-8 bg-[#eba236] bg-opacity-10 rounded-lg flex items-center justify-center">
                    <span>⭐</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">Write Reviews</p>
                    <p className="text-sm text-gray-600">Share your dining experience</p>
                  </div>
                  <span className="text-[#eba236] font-semibold">25pts</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-8 h-8 bg-[#eba236] bg-opacity-10 rounded-lg flex items-center justify-center">
                    <span>🎯</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">Complete Challenges</p>
                    <p className="text-sm text-gray-600">Weekly and monthly challenges</p>
                  </div>
                  <span className="text-[#eba236] font-semibold">50-200pts</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'rewards' && (
          <div className="space-y-4">
            {availableRewards.map((reward) => (
              <div key={reward.id} className="bg-white rounded-lg p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-12 h-12 bg-[#eba236] bg-opacity-10 rounded-lg flex items-center justify-center text-2xl">
                      {reward.image}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{reward.title}</h3>
                      <p className="text-gray-600 text-sm mb-2">{reward.description}</p>
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(reward.category)}`}>
                        {reward.category.charAt(0).toUpperCase() + reward.category.slice(1)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <i className="fas fa-coins w-4 h-4 text-[#eba236]" />
                    <span className="font-bold text-[#eba236]">{reward.pointsCost.toLocaleString()} points</span>
                  </div>
                  {reward.expiryDate && (
                    <span className="text-xs text-gray-500">
                      Expires: {formatDate(reward.expiryDate)}
                    </span>
                  )}
                </div>

                <div className="mb-4">
                  <h4 className="text-xs font-medium text-gray-700 mb-2">Terms:</h4>
                  <ul className="space-y-1">
                    {reward.terms.map((term, index) => (
                      <li key={index} className="text-xs text-gray-600 flex items-start gap-1">
                        <span className="w-1 h-1 bg-gray-400 rounded-full mt-1.5 flex-shrink-0"></span>
                        {term}
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={() => handleRedeemReward(reward.id)}
                  disabled={!reward.isAvailable || currentPoints < reward.pointsCost}
                  className={`w-full py-2 rounded-lg font-medium transition-colors duration-200 ${
                    reward.isAvailable && currentPoints >= reward.pointsCost
                      ? 'bg-white text-[#eba236] border border-[#eba236] hover:bg-[#eba236] hover:text-white'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {!reward.isAvailable 
                    ? 'Not Available' 
                    : currentPoints < reward.pointsCost 
                    ? `Need ${(reward.pointsCost - currentPoints).toLocaleString()} more points`
                    : 'Redeem Now'
                  }
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-white rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Points History</h3>
            <div className="space-y-4">
              {recentTransactions.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      transaction.type === 'earned' 
                        ? 'bg-green-100 text-green-600' 
                        : transaction.type === 'redeemed'
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-red-100 text-red-600'
                    }`}>
                      {transaction.type === 'earned' ? <i className="fas fa-chart-line w-4 h-4" /> : 
                       transaction.type === 'redeemed' ? <i className="fas fa-gift w-4 h-4" /> : 
                       <i className="fas fa-calendar w-4 h-4" />}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{transaction.description}</p>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span>{formatDate(transaction.date)}</span>
                        {transaction.orderId && (
                          <>
                            <span>•</span>
                            <span>{transaction.orderId}</span>
                          </>
                        )}
                      </div>
                      {transaction.restaurant && (
                        <p className="text-xs text-gray-500">{transaction.restaurant}</p>
                      )}
                    </div>
                  </div>
                  <span className={`font-bold ${
                    transaction.type === 'earned' ? 'text-green-600' : 'text-gray-600'
                  }`}>
                    {transaction.type === 'earned' ? '+' : ''}{transaction.amount}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'achievements' && (
          <div className="space-y-4">
            {achievements.map((achievement) => (
              <div key={achievement.id} className="bg-white rounded-lg p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${
                      achievement.isCompleted ? 'bg-green-100' : 'bg-gray-100'
                    }`}>
                      {achievement.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{achievement.title}</h3>
                      <p className="text-gray-600 text-sm mb-2">{achievement.description}</p>
                      <div className="flex items-center gap-2">
                        <i className="fas fa-coins w-4 h-4 text-[#eba236]" />
                        <span className="text-[#eba236] font-semibold">{achievement.pointsReward} points</span>
                      </div>
                    </div>
                  </div>
                  {achievement.isCompleted && (
                    <div className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                      Completed
                    </div>
                  )}
                </div>

                {!achievement.isCompleted && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">Progress</span>
                      <span className="text-sm font-medium text-gray-900">
                        {achievement.progress.toLocaleString()} / {achievement.target.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-[#eba236] h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min((achievement.progress / achievement.target) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}