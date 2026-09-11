'use client';

import React, { useState } from 'react';
import ImageWrapper from '@/components/ui/ImageWrapper';

/**
 * Wallets Page - Manage payment methods and wallet balance
 * Features professional wallet management with minimal design
 */
export default function WalletsPage() {
  const [activeTab, setActiveTab] = useState('balance');

  // Mock wallet data
  const walletBalance = {
    total: 245.50,
    currency: 'USD',
    lastUpdated: '2024-01-15T10:30:00Z'
  };

  const paymentMethods = [
    {
      id: 1,
      type: 'credit',
      brand: 'Visa',
      last4: '4242',
      expiryMonth: 12,
      expiryYear: 2027,
      isDefault: true,
      cardholderName: 'John Doe'
    },
    {
      id: 2,
      type: 'credit',
      brand: 'Mastercard',
      last4: '8888',
      expiryMonth: 8,
      expiryYear: 2026,
      isDefault: false,
      cardholderName: 'John Doe'
    },
    {
      id: 3,
      type: 'debit',
      brand: 'Visa',
      last4: '1234',
      expiryMonth: 3,
      expiryYear: 2025,
      isDefault: false,
      cardholderName: 'John Doe'
    }
  ];

  const transactions = [
    {
      id: 1,
      type: 'order',
      description: 'Pizza Palace - Large Pepperoni',
      amount: -24.99,
      date: '2024-01-15T14:30:00Z',
      status: 'completed'
    },
    {
      id: 2,
      type: 'refund',
      description: 'Burger King - Order Cancelled',
      amount: 18.50,
      date: '2024-01-14T19:15:00Z',
      status: 'completed'
    },
    {
      id: 3,
      type: 'topup',
      description: 'Wallet Top-up',
      amount: 100.00,
      date: '2024-01-13T12:00:00Z',
      status: 'completed'
    },
    {
      id: 4,
      type: 'order',
      description: 'Sushi Express - Salmon Roll Set',
      amount: -32.75,
      date: '2024-01-12T20:45:00Z',
      status: 'completed'
    }
  ];

  const handleAddPaymentMethod = () => {
    console.log('Adding new payment method');
  };

  const handleTopUpWallet = () => {
    console.log('Topping up wallet');
  };

  const handleSetDefaultCard = (id: number) => {
    console.log(`Setting card ${id} as default`);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white">
        <div className="w-full px-2.5 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">My Wallet</h1>
              <p className="mt-1 text-sm text-gray-600">Manage payments and balance</p>
            </div>
            <button 
              onClick={handleTopUpWallet}
              className="px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
              style={{
                border: '1px solid #eba236',
                color: '#eba236',
                backgroundColor: 'white'
              }}
            >
              <i className="fas fa-plus mr-2"></i>
              Top Up
            </button>
          </div>
        </div>
      </div>

      {/* Wallet Balance Card */}
      <div className="w-full px-2.5 py-4">
        <div className="bg-gradient-to-r from-gray-900 to-gray-700 rounded-lg p-6 text-white mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-300 text-sm mb-1">Available Balance</p>
              <h2 className="text-3xl font-bold">${walletBalance.total.toFixed(2)}</h2>
              <p className="text-gray-300 text-xs mt-2">
                Last updated: {formatDate(walletBalance.lastUpdated)}
              </p>
            </div>
            <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              <i className="fas fa-wallet text-2xl"></i>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg mb-4 overflow-hidden">
          <div className="flex">
            <button
              onClick={() => setActiveTab('balance')}
              className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                activeTab === 'balance'
                  ? 'bg-gray-50 text-gray-900 border-b-2'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              style={activeTab === 'balance' ? { borderBottomColor: '#eba236' } : {}}
            >
              <i className="fas fa-history mr-2"></i>
              Transactions
            </button>
            <button
              onClick={() => setActiveTab('cards')}
              className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                activeTab === 'cards'
                  ? 'bg-gray-50 text-gray-900 border-b-2'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              style={activeTab === 'cards' ? { borderBottomColor: '#eba236' } : {}}
            >
              <i className="fas fa-credit-card mr-2"></i>
              Payment Methods
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'balance' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Recent Transactions</h3>
              <button className="text-sm text-gray-600 hover:text-gray-900">
                View All
              </button>
            </div>
            
            {transactions.map((transaction) => (
              <div key={transaction.id} className="bg-white rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      transaction.type === 'order' ? 'bg-red-100' :
                      transaction.type === 'refund' ? 'bg-green-100' : 'bg-blue-100'
                    }`}>
                      <i className={`fas ${
                        transaction.type === 'order' ? 'fa-shopping-bag text-red-600' :
                        transaction.type === 'refund' ? 'fa-undo text-green-600' : 'fa-plus text-blue-600'
                      }`}></i>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{transaction.description}</p>
                      <p className="text-sm text-gray-500">{formatDate(transaction.date)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${
                      transaction.amount > 0 ? 'text-green-600' : 'text-gray-900'
                    }`}>
                      {transaction.amount > 0 ? '+' : ''}${Math.abs(transaction.amount).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500 capitalize">{transaction.status}</p>
                  </div>
                </div>
              </div>
            ))}

            {transactions.length === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                  <i className="fas fa-history text-2xl text-gray-400"></i>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No transactions yet</h3>
                <p className="text-gray-600">Your transaction history will appear here</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'cards' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Payment Methods</h3>
              <button 
                onClick={handleAddPaymentMethod}
                className="px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
                style={{
                  border: '1px solid #eba236',
                  color: '#eba236',
                  backgroundColor: 'white'
                }}
              >
                <i className="fas fa-plus mr-2"></i>
                Add Card
              </button>
            </div>

            {paymentMethods.map((card) => (
              <div key={card.id} className="bg-white rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded flex items-center justify-center">
                      <i className="fas fa-credit-card text-white text-sm"></i>
                    </div>
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <p className="font-medium text-gray-900">
                          {card.brand} •••• {card.last4}
                        </p>
                        {card.isDefault && (
                          <span className="text-xs font-medium text-white px-2 py-1 rounded" style={{backgroundColor: '#eba236'}}>
                            DEFAULT
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        {card.cardholderName} • Expires {card.expiryMonth.toString().padStart(2, '0')}/{card.expiryYear}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {!card.isDefault && (
                      <button
                        onClick={() => handleSetDefaultCard(card.id)}
                        className="px-3 py-1.5 rounded text-xs font-medium hover:bg-gray-50 transition-colors"
                        style={{
                          border: '1px solid #eba236',
                          color: '#eba236',
                          backgroundColor: 'white'
                        }}
                      >
                        Set Default
                      </button>
                    )}
                    <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                      <i className="fas fa-edit"></i>
                    </button>
                    <button className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {paymentMethods.length === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                  <i className="fas fa-credit-card text-2xl text-gray-400"></i>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No payment methods</h3>
                <p className="text-gray-600 mb-6">Add a card to start ordering</p>
                <button 
                  onClick={handleAddPaymentMethod}
                  className="px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  style={{
                    border: '1px solid #eba236',
                    color: '#eba236',
                    backgroundColor: 'white'
                  }}
                >
                  <i className="fas fa-plus mr-2"></i>
                  Add Your First Card
                </button>
              </div>
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-8 bg-white rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button className="flex items-center p-3 text-left hover:bg-gray-50 rounded-lg transition-colors">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                <i className="fas fa-download text-green-600 text-sm"></i>
              </div>
              <div>
                <p className="font-medium text-gray-900 text-sm">Download Statement</p>
                <p className="text-xs text-gray-500">Get transaction history</p>
              </div>
            </button>
            <button className="flex items-center p-3 text-left hover:bg-gray-50 rounded-lg transition-colors">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                <i className="fas fa-shield-alt text-blue-600 text-sm"></i>
              </div>
              <div>
                <p className="font-medium text-gray-900 text-sm">Security Settings</p>
                <p className="text-xs text-gray-500">Manage payment security</p>
              </div>
            </button>
            <button className="flex items-center p-3 text-left hover:bg-gray-50 rounded-lg transition-colors">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                <i className="fas fa-gift text-purple-600 text-sm"></i>
              </div>
              <div>
                <p className="font-medium text-gray-900 text-sm">Rewards & Offers</p>
                <p className="text-xs text-gray-500">View available deals</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
