'use client';

import React, { useState } from 'react';

/**
 * Terms and Conditions Page - Legal terms for Tap2Go food delivery service
 * Features comprehensive terms with minimal design
 */
export default function TermsPage() {
  const [activeSection, setActiveSection] = useState('overview');

  const sections = [
    { id: 'overview', title: 'Overview', icon: 'fa-info-circle' },
    { id: 'acceptance', title: 'Acceptance of Terms', icon: 'fa-check-circle' },
    { id: 'services', title: 'Our Services', icon: 'fa-utensils' },
    { id: 'accounts', title: 'User Accounts', icon: 'fa-user' },
    { id: 'orders', title: 'Orders & Payments', icon: 'fa-shopping-cart' },
    { id: 'delivery', title: 'Delivery Terms', icon: 'fa-truck' },
    { id: 'conduct', title: 'User Conduct', icon: 'fa-gavel' },
    { id: 'liability', title: 'Liability', icon: 'fa-shield-alt' },
    { id: 'privacy', title: 'Privacy', icon: 'fa-lock' },
    { id: 'changes', title: 'Changes to Terms', icon: 'fa-edit' }
  ];

  const lastUpdated = "January 15, 2024";

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white">
        <div className="max-w-7xl mx-auto px-2.5 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Terms and Conditions</h1>
              <p className="mt-1 text-sm text-gray-600">Last updated: {lastUpdated}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-2.5 py-4">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Navigation Sidebar */}
          <div className="lg:w-1/4">
            <div className="bg-white rounded-lg p-2.5 sticky top-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Sections</h3>
              <nav className="space-y-1">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2 ${
                      activeSection === section.id
                        ? 'bg-[#eba236] text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <i className={`fas ${section.icon} text-sm`}></i>
                    <span>{section.title}</span>
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Content */}
          <div className="lg:w-3/4">
            <div className="bg-white rounded-lg p-2.5">
              {activeSection === 'overview' && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Overview</h2>
                  <div className="prose prose-gray max-w-none">
                    <p className="text-gray-600 mb-4">
                      Welcome to Tap2Go, your premier food delivery platform in the Philippines. These Terms and Conditions (&quot;Terms&quot;) govern your use of our website, mobile application, and services.
                    </p>
                    <p className="text-gray-600 mb-4">
                      By accessing or using Tap2Go, you agree to be bound by these Terms. If you do not agree with any part of these terms, you may not use our services.
                    </p>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                      <h4 className="font-semibold text-yellow-800 mb-2">Important Notice</h4>
                      <p className="text-yellow-700 text-sm">
                        Please read these terms carefully before using our services. Your continued use of Tap2Go constitutes acceptance of these terms.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'acceptance' && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Acceptance of Terms</h2>
                  <div className="prose prose-gray max-w-none">
                    <p className="text-gray-600 mb-4">
                      By creating an account, placing an order, or using any part of our service, you acknowledge that you have read, understood, and agree to be bound by these Terms.
                    </p>
                    <h4 className="font-semibold text-gray-900 mb-2">Eligibility</h4>
                    <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                      <li>You must be at least 18 years old to use our services</li>
                      <li>You must provide accurate and complete information</li>
                      <li>You must have the legal capacity to enter into binding agreements</li>
                      <li>You must comply with all applicable laws and regulations</li>
                    </ul>
                  </div>
                </div>
              )}

              {activeSection === 'services' && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Our Services</h2>
                  <div className="prose prose-gray max-w-none">
                    <p className="text-gray-600 mb-4">
                      Tap2Go provides an online platform that connects customers with local restaurants and food establishments for food ordering and delivery services.
                    </p>
                    <h4 className="font-semibold text-gray-900 mb-2">Service Description</h4>
                    <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                      <li>Online food ordering platform</li>
                      <li>Restaurant discovery and menu browsing</li>
                      <li>Order processing and payment handling</li>
                      <li>Delivery coordination and tracking</li>
                      <li>Customer support services</li>
                    </ul>
                    <h4 className="font-semibold text-gray-900 mb-2">Service Availability</h4>
                    <p className="text-gray-600 mb-4">
                      Our services are available in select areas within the Philippines. Service availability may vary by location and time of day.
                    </p>
                  </div>
                </div>
              )}

              {activeSection === 'accounts' && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">User Accounts</h2>
                  <div className="prose prose-gray max-w-none">
                    <h4 className="font-semibold text-gray-900 mb-2">Account Creation</h4>
                    <p className="text-gray-600 mb-4">
                      To use our services, you must create an account by providing accurate and complete information including your name, email address, phone number, and delivery address.
                    </p>
                    <h4 className="font-semibold text-gray-900 mb-2">Account Security</h4>
                    <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                      <li>You are responsible for maintaining the confidentiality of your account credentials</li>
                      <li>You must notify us immediately of any unauthorized use of your account</li>
                      <li>You are liable for all activities that occur under your account</li>
                      <li>We reserve the right to suspend or terminate accounts that violate these terms</li>
                    </ul>
                    <h4 className="font-semibold text-gray-900 mb-2">Account Information</h4>
                    <p className="text-gray-600 mb-4">
                      You agree to keep your account information current and accurate. Failure to do so may result in service interruptions or account suspension.
                    </p>
                  </div>
                </div>
              )}

              {activeSection === 'orders' && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Orders & Payments</h2>
                  <div className="prose prose-gray max-w-none">
                    <h4 className="font-semibold text-gray-900 mb-2">Order Placement</h4>
                    <p className="text-gray-600 mb-4">
                      When you place an order through our platform, you are making an offer to purchase food items from the restaurant. Orders are subject to acceptance by the restaurant.
                    </p>
                    <h4 className="font-semibold text-gray-900 mb-2">Pricing and Fees</h4>
                    <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                      <li>All prices are displayed in Philippine Pesos (PHP)</li>
                      <li>Prices may include delivery fees, service fees, and applicable taxes</li>
                      <li>Prices are subject to change without notice</li>
                      <li>Additional fees may apply for special requests or modifications</li>
                    </ul>
                    <h4 className="font-semibold text-gray-900 mb-2">Payment Methods</h4>
                    <p className="text-gray-600 mb-4">
                      We accept various payment methods including credit cards, debit cards, digital wallets (GCash, PayMaya), and cash on delivery where available.
                    </p>
                    <h4 className="font-semibold text-gray-900 mb-2">Order Modifications and Cancellations</h4>
                    <p className="text-gray-600 mb-4">
                      Orders may be modified or cancelled within a limited time after placement. Once preparation begins, modifications may not be possible.
                    </p>
                  </div>
                </div>
              )}

              {activeSection === 'delivery' && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Delivery Terms</h2>
                  <div className="prose prose-gray max-w-none">
                    <h4 className="font-semibold text-gray-900 mb-2">Delivery Areas</h4>
                    <p className="text-gray-600 mb-4">
                      Delivery is available within our designated service areas. Delivery availability may be limited during peak hours or adverse weather conditions.
                    </p>
                    <h4 className="font-semibold text-gray-900 mb-2">Delivery Times</h4>
                    <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                      <li>Estimated delivery times are approximate and may vary</li>
                      <li>Delivery times depend on restaurant preparation time, distance, and traffic conditions</li>
                      <li>We are not liable for delays caused by circumstances beyond our control</li>
                    </ul>
                    <h4 className="font-semibold text-gray-900 mb-2">Delivery Requirements</h4>
                    <p className="text-gray-600 mb-4">
                      You must provide accurate delivery information and be available to receive your order. Additional charges may apply for failed delivery attempts.
                    </p>
                  </div>
                </div>
              )}

              {activeSection === 'conduct' && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">User Conduct</h2>
                  <div className="prose prose-gray max-w-none">
                    <h4 className="font-semibold text-gray-900 mb-2">Prohibited Activities</h4>
                    <p className="text-gray-600 mb-4">You agree not to:</p>
                    <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                      <li>Use our services for any illegal or unauthorized purpose</li>
                      <li>Violate any applicable laws or regulations</li>
                      <li>Interfere with or disrupt our services or servers</li>
                      <li>Attempt to gain unauthorized access to our systems</li>
                      <li>Submit false or misleading information</li>
                      <li>Harass, abuse, or harm other users or our staff</li>
                      <li>Use our platform for commercial purposes without authorization</li>
                    </ul>
                    <h4 className="font-semibold text-gray-900 mb-2">Consequences</h4>
                    <p className="text-gray-600 mb-4">
                      Violation of these conduct rules may result in account suspension, termination, or legal action.
                    </p>
                  </div>
                </div>
              )}

              {activeSection === 'liability' && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Liability</h2>
                  <div className="prose prose-gray max-w-none">
                    <h4 className="font-semibold text-gray-900 mb-2">Service Disclaimer</h4>
                    <p className="text-gray-600 mb-4">
                      Our services are provided &quot;as is&quot; without warranties of any kind. We do not guarantee uninterrupted or error-free service.
                    </p>
                    <h4 className="font-semibold text-gray-900 mb-2">Food Quality and Safety</h4>
                    <p className="text-gray-600 mb-4">
                      Restaurants are responsible for food quality, safety, and preparation. We are not liable for food-related issues, allergic reactions, or foodborne illnesses.
                    </p>
                    <h4 className="font-semibold text-gray-900 mb-2">Limitation of Liability</h4>
                    <p className="text-gray-600 mb-4">
                      Our liability is limited to the amount paid for the specific order in question. We are not liable for indirect, incidental, or consequential damages.
                    </p>
                    <h4 className="font-semibold text-gray-900 mb-2">Indemnification</h4>
                    <p className="text-gray-600 mb-4">
                      You agree to indemnify and hold us harmless from any claims arising from your use of our services or violation of these terms.
                    </p>
                  </div>
                </div>
              )}

              {activeSection === 'privacy' && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Privacy</h2>
                  <div className="prose prose-gray max-w-none">
                    <h4 className="font-semibold text-gray-900 mb-2">Data Collection</h4>
                    <p className="text-gray-600 mb-4">
                      We collect and process personal information as described in our Privacy Policy. By using our services, you consent to such collection and processing.
                    </p>
                    <h4 className="font-semibold text-gray-900 mb-2">Data Usage</h4>
                    <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                      <li>To provide and improve our services</li>
                      <li>To process orders and payments</li>
                      <li>To communicate with you about your orders</li>
                      <li>To send promotional materials (with your consent)</li>
                      <li>To comply with legal obligations</li>
                    </ul>
                    <h4 className="font-semibold text-gray-900 mb-2">Data Protection</h4>
                    <p className="text-gray-600 mb-4">
                      We implement appropriate security measures to protect your personal information. However, no method of transmission over the internet is 100% secure.
                    </p>
                  </div>
                </div>
              )}

              {activeSection === 'changes' && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Changes to Terms</h2>
                  <div className="prose prose-gray max-w-none">
                    <h4 className="font-semibold text-gray-900 mb-2">Modifications</h4>
                    <p className="text-gray-600 mb-4">
                      We reserve the right to modify these Terms at any time. Changes will be effective immediately upon posting on our platform.
                    </p>
                    <h4 className="font-semibold text-gray-900 mb-2">Notification</h4>
                    <p className="text-gray-600 mb-4">
                      We will notify users of significant changes through email, app notifications, or prominent notices on our platform.
                    </p>
                    <h4 className="font-semibold text-gray-900 mb-2">Continued Use</h4>
                    <p className="text-gray-600 mb-4">
                      Your continued use of our services after changes are posted constitutes acceptance of the modified Terms.
                    </p>
                    <h4 className="font-semibold text-gray-900 mb-2">Contact Information</h4>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-gray-600 mb-2">
                        If you have questions about these Terms, please contact us:
                      </p>
                      <ul className="text-gray-600 space-y-1">
                        <li>Email: legal@tap2go.com</li>
                        <li>Phone: +63 2 8123 4567</li>
                        <li>Address: Makati City, Metro Manila, Philippines</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="mt-6 flex flex-wrap gap-3">
              <button className="bg-white text-[#eba236] border border-[#eba236] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#eba236] hover:text-white transition-colors">
                Download PDF
              </button>
              <button className="bg-white text-[#eba236] border border-[#eba236] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#eba236] hover:text-white transition-colors">
                Print Terms
              </button>
              <button className="bg-white text-[#eba236] border border-[#eba236] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#eba236] hover:text-white transition-colors">
                Contact Legal Team
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}