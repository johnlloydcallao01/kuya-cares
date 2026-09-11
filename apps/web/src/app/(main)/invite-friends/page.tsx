'use client';

import React, { useState } from 'react';
import ImageWrapper from '@/components/ui/ImageWrapper';

/**
 * Invite Friends Page - Referral program and friend invitations
 * Features professional referral system with minimal design
 */
export default function InviteFriendsPage() {
  const [referralCode] = useState('TAP2GO-JD2024');
  const [inviteMethod, setInviteMethod] = useState('link');
  const [friendEmail, setFriendEmail] = useState('');

  // Mock referral data
  const referralStats = {
    totalInvites: 12,
    successfulReferrals: 8,
    pendingInvites: 4,
    totalEarned: 120.00,
    availableReward: 45.00
  };

  const recentInvites = [
    {
      id: 1,
      name: 'Sarah Johnson',
      email: 'sarah.j@email.com',
      status: 'completed',
      reward: 15.00,
      date: '2024-01-15T10:30:00Z'
    },
    {
      id: 2,
      name: 'Mike Chen',
      email: 'mike.chen@email.com',
      status: 'pending',
      reward: 15.00,
      date: '2024-01-14T16:45:00Z'
    },
    {
      id: 3,
      name: 'Emma Wilson',
      email: 'emma.w@email.com',
      status: 'completed',
      reward: 15.00,
      date: '2024-01-13T09:20:00Z'
    },
    {
      id: 4,
      name: 'David Brown',
      email: 'david.brown@email.com',
      status: 'expired',
      reward: 0,
      date: '2024-01-10T14:15:00Z'
    }
  ];

  const handleCopyCode = () => {
    navigator.clipboard.writeText(referralCode);
    console.log('Referral code copied');
  };

  const handleCopyLink = () => {
    const referralLink = `https://tap2go.com/join?ref=${referralCode}`;
    navigator.clipboard.writeText(referralLink);
    console.log('Referral link copied');
  };

  const handleSendInvite = () => {
    if (friendEmail) {
      console.log(`Sending invite to: ${friendEmail}`);
      setFriendEmail('');
    }
  };

  const handleShareSocial = (platform: string) => {
    console.log(`Sharing on ${platform}`);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white">
        <div className="w-full px-2.5 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Invite Friends</h1>
              <p className="mt-1 text-sm text-gray-600">Share the love and earn rewards</p>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-2.5 py-4">
        {/* Referral Stats Card */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold">Your Referral Stats</h2>
              <p className="text-blue-100 text-sm">Keep inviting to earn more!</p>
            </div>
            <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              <i className="fas fa-users text-2xl"></i>
            </div>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold">{referralStats.totalInvites}</p>
              <p className="text-blue-100 text-xs">Total Invites</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{referralStats.successfulReferrals}</p>
              <p className="text-blue-100 text-xs">Successful</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">${referralStats.totalEarned.toFixed(0)}</p>
              <p className="text-blue-100 text-xs">Total Earned</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">${referralStats.availableReward.toFixed(0)}</p>
              <p className="text-blue-100 text-xs">Available</p>
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="bg-white rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
            <i className="fas fa-lightbulb mr-2 text-yellow-500"></i>
            How It Works
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <i className="fas fa-share text-blue-600"></i>
              </div>
              <h4 className="font-medium text-gray-900 mb-1">1. Share</h4>
              <p className="text-sm text-gray-600">Send your referral code to friends</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <i className="fas fa-user-plus text-green-600"></i>
              </div>
              <h4 className="font-medium text-gray-900 mb-1">2. They Join</h4>
              <p className="text-sm text-gray-600">Friends sign up using your code</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <i className="fas fa-gift text-purple-600"></i>
              </div>
              <h4 className="font-medium text-gray-900 mb-1">3. Earn Rewards</h4>
              <p className="text-sm text-gray-600">Get $15 for each successful referral</p>
            </div>
          </div>
        </div>

        {/* Your Referral Code */}
        <div className="bg-white rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
            <i className="fas fa-code mr-2 text-gray-600"></i>
            Your Referral Code
          </h3>
          <div className="bg-gray-50 rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="text-2xl font-mono font-bold text-gray-900">{referralCode}</p>
              <p className="text-sm text-gray-600 mt-1">Share this code with your friends</p>
            </div>
            <button
              onClick={handleCopyCode}
              className="px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
              style={{
                border: '1px solid #eba236',
                color: '#eba236',
                backgroundColor: 'white'
              }}
            >
              <i className="fas fa-copy mr-2"></i>
              Copy Code
            </button>
          </div>
        </div>

        {/* Invite Methods */}
        <div className="bg-white rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
            <i className="fas fa-paper-plane mr-2 text-gray-600"></i>
            Invite Friends
          </h3>
          
          {/* Method Tabs */}
          <div className="flex space-x-1 mb-4 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setInviteMethod('link')}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                inviteMethod === 'link'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Share Link
            </button>
            <button
              onClick={() => setInviteMethod('email')}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                inviteMethod === 'email'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Send Email
            </button>
            <button
              onClick={() => setInviteMethod('social')}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                inviteMethod === 'social'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Social Media
            </button>
          </div>

          {/* Share Link */}
          {inviteMethod === 'link' && (
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm text-gray-600 mb-2">Your referral link:</p>
                <p className="font-mono text-sm text-gray-900 break-all">
                  https://tap2go.com/join?ref={referralCode}
                </p>
              </div>
              <button
                onClick={handleCopyLink}
                className="w-full py-3 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                style={{
                  border: '1px solid #eba236',
                  color: '#eba236',
                  backgroundColor: 'white'
                }}
              >
                <i className="fas fa-link mr-2"></i>
                Copy Referral Link
              </button>
            </div>
          )}

          {/* Send Email */}
          {inviteMethod === 'email' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Friend&apos;s Email Address
                </label>
                <input
                  type="email"
                  value={friendEmail}
                  onChange={(e) => setFriendEmail(e.target.value)}
                  placeholder="Enter your friend's email"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={handleSendInvite}
                disabled={!friendEmail}
                className="w-full py-3 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  border: '1px solid #eba236',
                  color: '#eba236',
                  backgroundColor: 'white'
                }}
              >
                <i className="fas fa-envelope mr-2"></i>
                Send Invitation
              </button>
            </div>
          )}

          {/* Social Media */}
          {inviteMethod === 'social' && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleShareSocial('whatsapp')}
                className="flex items-center justify-center py-3 px-4 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                <i className="fab fa-whatsapp mr-2"></i>
                WhatsApp
              </button>
              <button
                onClick={() => handleShareSocial('facebook')}
                className="flex items-center justify-center py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <i className="fab fa-facebook mr-2"></i>
                Facebook
              </button>
              <button
                onClick={() => handleShareSocial('twitter')}
                className="flex items-center justify-center py-3 px-4 bg-blue-400 text-white rounded-lg hover:bg-blue-500 transition-colors"
              >
                <i className="fab fa-twitter mr-2"></i>
                Twitter
              </button>
              <button
                onClick={() => handleShareSocial('instagram')}
                className="flex items-center justify-center py-3 px-4 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors"
              >
                <i className="fab fa-instagram mr-2"></i>
                Instagram
              </button>
            </div>
          )}
        </div>

        {/* Recent Invites */}
        <div className="bg-white rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
            <i className="fas fa-history mr-2 text-gray-600"></i>
            Recent Invites
          </h3>
          
          {recentInvites.length > 0 ? (
            <div className="space-y-3">
              {recentInvites.map((invite) => (
                <div key={invite.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      invite.status === 'completed' ? 'bg-green-100' :
                      invite.status === 'pending' ? 'bg-yellow-100' : 'bg-gray-100'
                    }`}>
                      <i className={`fas ${
                        invite.status === 'completed' ? 'fa-check text-green-600' :
                        invite.status === 'pending' ? 'fa-clock text-yellow-600' : 'fa-times text-gray-600'
                      }`}></i>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{invite.name}</p>
                      <p className="text-sm text-gray-600">{invite.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${
                      invite.status === 'completed' ? 'text-green-600' : 'text-gray-500'
                    }`}>
                      {invite.status === 'completed' ? `+$${invite.reward.toFixed(0)}` : 
                       invite.status === 'pending' ? 'Pending' : 'Expired'}
                    </p>
                    <p className="text-xs text-gray-500">{formatDate(invite.date)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <i className="fas fa-user-friends text-2xl text-gray-400"></i>
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">No invites yet</h4>
              <p className="text-gray-600">Start inviting friends to earn rewards!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
