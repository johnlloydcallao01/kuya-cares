'use client';

import React, { useState } from 'react';

/**
 * Help Center Page - Customer support and assistance
 * Features comprehensive help resources with minimal design
 */
export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const helpCategories = [
    {
      id: 1,
      title: "Getting Started",
      description: "Learn the basics of ordering food",
      icon: "fa-rocket",
      articles: [
        "How to create an account",
        "Setting up your profile",
        "First order guide",
        "Understanding delivery zones"
      ]
    },
    {
      id: 2,
      title: "Orders & Delivery",
      description: "Everything about placing and tracking orders",
      icon: "fa-shopping-bag",
      articles: [
        "How to place an order",
        "Tracking your delivery",
        "Modifying orders",
        "Delivery time estimates"
      ]
    },
    {
      id: 3,
      title: "Payments & Billing",
      description: "Payment methods and billing information",
      icon: "fa-credit-card",
      articles: [
        "Adding payment methods",
        "Understanding charges",
        "Refunds and cancellations",
        "Promotional codes"
      ]
    },
    {
      id: 4,
      title: "Account Management",
      description: "Managing your Tap2Go account",
      icon: "fa-user-cog",
      articles: [
        "Update profile information",
        "Change password",
        "Notification settings",
        "Delete account"
      ]
    },
    {
      id: 5,
      title: "Restaurants & Menu",
      description: "Finding restaurants and menu items",
      icon: "fa-utensils",
      articles: [
        "Restaurant search filters",
        "Menu customization",
        "Dietary preferences",
        "Restaurant ratings"
      ]
    },
    {
      id: 6,
      title: "Troubleshooting",
      description: "Common issues and solutions",
      icon: "fa-tools",
      articles: [
        "App not loading",
        "Payment failed",
        "Order not received",
        "Login problems"
      ]
    }
  ];

  const contactOptions = [
    {
      id: 1,
      title: "Live Chat",
      description: "Get instant help from our support team",
      icon: "fa-comments",
      action: "Start Chat",
      available: true,
      hours: "24/7 Available"
    },
    {
      id: 2,
      title: "Email Support",
      description: "Send us a detailed message",
      icon: "fa-envelope",
      action: "Send Email",
      available: true,
      hours: "Response within 24 hours"
    },
    {
      id: 3,
      title: "Phone Support",
      description: "Call us for urgent matters",
      icon: "fa-phone",
      action: "Call Now",
      available: true,
      hours: "Mon-Fri 8AM-8PM"
    }
  ];

  const faqs = [
    {
      id: 1,
      question: "How do I track my order?",
      answer: "You can track your order in real-time through the 'Orders' section in your account. You'll receive notifications at each stage of preparation and delivery."
    },
    {
      id: 2,
      question: "What payment methods do you accept?",
      answer: "We accept all major credit cards, debit cards, PayPal, GCash, PayMaya, and cash on delivery for eligible areas."
    },
    {
      id: 3,
      question: "Can I modify or cancel my order?",
      answer: "You can modify or cancel your order within 2 minutes of placing it. After that, please contact the restaurant directly or our support team."
    },
    {
      id: 4,
      question: "What if my order is late or incorrect?",
      answer: "If your order is significantly delayed or incorrect, please contact our support team immediately. We'll work with the restaurant to resolve the issue and may offer compensation."
    },
    {
      id: 5,
      question: "How do delivery fees work?",
      answer: "Delivery fees vary by distance and restaurant. Many restaurants offer free delivery for orders above a certain amount. You'll see all fees before confirming your order."
    },
    {
      id: 6,
      question: "Do you deliver to my area?",
      answer: "Enter your address in the app to see available restaurants in your area. We're constantly expanding our delivery zones."
    }
  ];

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleContactSupport = (method: string) => {
    console.log(`Contacting support via ${method}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white">
        <div className="max-w-7xl mx-auto px-2.5 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Help Center</h1>
              <p className="mt-1 text-sm text-gray-600">Find answers and get support</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-2.5 py-6">
        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <input
              type="text"
              placeholder="Search for help..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#eba236] focus:border-transparent"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <i className="fas fa-search text-gray-400"></i>
            </div>
          </div>
        </div>

        {/* Help Categories */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Browse by Category</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {helpCategories.map((category) => (
              <div
                key={category.id}
                className="bg-white rounded-lg p-2.5 hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <i className={`fas ${category.icon} text-[#eba236] text-xl`}></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {category.title}
                    </h3>
                    <p className="text-gray-600 text-sm mb-3">{category.description}</p>
                    <ul className="space-y-1">
                      {category.articles.map((article, index) => (
                        <li key={index} className="text-sm text-[#eba236] hover:text-[#d4941f] cursor-pointer">
                          • {article}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Contact Support */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Contact Support</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {contactOptions.map((option) => (
              <div
                key={option.id}
                className="bg-white rounded-lg p-2.5 text-center hover:shadow-md cursor-pointer"
              >
                <div className="flex flex-col items-center">
                  <i className={`fas ${option.icon} text-[#eba236] text-2xl mb-3`}></i>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {option.title}
                  </h3>
                  <p className="text-gray-600 text-sm mb-2">{option.description}</p>
                  <p className="text-xs text-gray-500 mb-3">{option.hours}</p>
                  <button
                    onClick={() => handleContactSupport(option.title)}
                    className="bg-white text-[#eba236] border border-[#eba236] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#eba236] hover:text-white transition-colors"
                  >
                    {option.action}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ Section */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Frequently Asked Questions</h2>
          <div className="bg-white rounded-lg p-2.5">
            <div className="space-y-4">
              {faqs.map((faq) => (
                <div key={faq.id} className="border-b border-gray-200 pb-4 last:border-b-0 last:pb-0">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {faq.question}
                  </h3>
                  <p className="text-gray-600 text-sm">
                    {faq.answer}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 flex flex-wrap gap-3">
          <button className="bg-white text-[#eba236] border border-[#eba236] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#eba236] hover:text-white transition-colors">
            Submit Feedback
          </button>
          <button className="bg-white text-[#eba236] border border-[#eba236] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#eba236] hover:text-white transition-colors">
            Report Issue
          </button>
          <button className="bg-white text-[#eba236] border border-[#eba236] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#eba236] hover:text-white transition-colors">
            Request Feature
          </button>
        </div>
      </div>
    </div>
  );
}
