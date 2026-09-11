'use client';

import React, { useState } from 'react';

/**
 * Privacy Policy Page - Data privacy and protection information for Tap2Go
 * Features comprehensive privacy policy with minimal design
 */
export default function PrivacyPage() {
  const [activeSection, setActiveSection] = useState('overview');

  const sections = [
    { id: 'overview', title: 'Overview', icon: 'fa-info-circle' },
    { id: 'collection', title: 'Information We Collect', icon: 'fa-database' },
    { id: 'usage', title: 'How We Use Information', icon: 'fa-cogs' },
    { id: 'sharing', title: 'Information Sharing', icon: 'fa-share-alt' },
    { id: 'security', title: 'Data Security', icon: 'fa-shield-alt' },
    { id: 'retention', title: 'Data Retention', icon: 'fa-clock' },
    { id: 'rights', title: 'Your Rights', icon: 'fa-user-shield' },
    { id: 'cookies', title: 'Cookies & Tracking', icon: 'fa-cookie-bite' },
    { id: 'children', title: 'Children\'s Privacy', icon: 'fa-child' },
    { id: 'changes', title: 'Policy Changes', icon: 'fa-edit' },
    { id: 'contact', title: 'Contact Us', icon: 'fa-envelope' }
  ];

  const lastUpdated = "January 15, 2024";

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white">
        <div className="max-w-7xl mx-auto px-2.5 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Privacy Policy</h1>
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
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Privacy Policy Overview</h2>
                  <div className="prose prose-gray max-w-none">
                    <p className="text-gray-600 mb-4">
                      At Tap2Go, we are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our food delivery platform.
                    </p>
                    <p className="text-gray-600 mb-4">
                      This policy applies to all users of our website, mobile application, and related services. By using Tap2Go, you consent to the data practices described in this policy.
                    </p>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                      <h4 className="font-semibold text-blue-800 mb-2">Your Privacy Matters</h4>
                      <p className="text-blue-700 text-sm">
                        We believe in transparency about how we collect and use your data. This policy provides detailed information about our privacy practices.
                      </p>
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-2">Key Principles</h4>
                    <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                      <li>We only collect information necessary to provide our services</li>
                      <li>We never sell your personal information to third parties</li>
                      <li>We implement strong security measures to protect your data</li>
                      <li>You have control over your personal information</li>
                    </ul>
                  </div>
                </div>
              )}

              {activeSection === 'collection' && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Information We Collect</h2>
                  <div className="prose prose-gray max-w-none">
                    <h4 className="font-semibold text-gray-900 mb-2">Personal Information</h4>
                    <p className="text-gray-600 mb-4">
                      We collect personal information that you voluntarily provide when using our services:
                    </p>
                    <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                      <li>Name, email address, and phone number</li>
                      <li>Delivery addresses and location information</li>
                      <li>Payment information (processed securely by third-party providers)</li>
                      <li>Order history and preferences</li>
                      <li>Profile information and dietary preferences</li>
                      <li>Communications with customer support</li>
                    </ul>
                    
                    <h4 className="font-semibold text-gray-900 mb-2">Automatically Collected Information</h4>
                    <p className="text-gray-600 mb-4">
                      We automatically collect certain information when you use our platform:
                    </p>
                    <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                      <li>Device information (type, operating system, browser)</li>
                      <li>IP address and general location data</li>
                      <li>Usage patterns and app interactions</li>
                      <li>Cookies and similar tracking technologies</li>
                      <li>Performance and error logs</li>
                    </ul>

                    <h4 className="font-semibold text-gray-900 mb-2">Location Information</h4>
                    <p className="text-gray-600 mb-4">
                      We collect location information to provide delivery services, find nearby restaurants, and estimate delivery times. You can control location sharing through your device settings.
                    </p>
                  </div>
                </div>
              )}

              {activeSection === 'usage' && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">How We Use Your Information</h2>
                  <div className="prose prose-gray max-w-none">
                    <h4 className="font-semibold text-gray-900 mb-2">Service Provision</h4>
                    <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                      <li>Process and fulfill your food orders</li>
                      <li>Coordinate delivery services</li>
                      <li>Process payments and handle billing</li>
                      <li>Provide customer support</li>
                      <li>Send order confirmations and updates</li>
                    </ul>

                    <h4 className="font-semibold text-gray-900 mb-2">Service Improvement</h4>
                    <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                      <li>Analyze usage patterns to improve our platform</li>
                      <li>Personalize your experience and recommendations</li>
                      <li>Develop new features and services</li>
                      <li>Conduct research and analytics</li>
                      <li>Monitor and improve service quality</li>
                    </ul>

                    <h4 className="font-semibold text-gray-900 mb-2">Communication</h4>
                    <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                      <li>Send important service notifications</li>
                      <li>Provide customer support responses</li>
                      <li>Send promotional offers (with your consent)</li>
                      <li>Conduct surveys and gather feedback</li>
                    </ul>

                    <h4 className="font-semibold text-gray-900 mb-2">Legal and Security</h4>
                    <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                      <li>Comply with legal obligations</li>
                      <li>Prevent fraud and ensure platform security</li>
                      <li>Enforce our terms of service</li>
                      <li>Protect our rights and interests</li>
                    </ul>
                  </div>
                </div>
              )}

              {activeSection === 'sharing' && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Information Sharing</h2>
                  <div className="prose prose-gray max-w-none">
                    <p className="text-gray-600 mb-4">
                      We do not sell, trade, or rent your personal information to third parties. We may share your information in the following circumstances:
                    </p>

                    <h4 className="font-semibold text-gray-900 mb-2">Service Providers</h4>
                    <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                      <li>Restaurant partners (order details and delivery information)</li>
                      <li>Delivery partners (delivery address and contact information)</li>
                      <li>Payment processors (payment information for transaction processing)</li>
                      <li>Technology service providers (hosting, analytics, customer support)</li>
                    </ul>

                    <h4 className="font-semibold text-gray-900 mb-2">Legal Requirements</h4>
                    <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                      <li>When required by law or legal process</li>
                      <li>To protect our rights, property, or safety</li>
                      <li>To prevent fraud or illegal activities</li>
                      <li>In response to government requests</li>
                    </ul>

                    <h4 className="font-semibold text-gray-900 mb-2">Business Transfers</h4>
                    <p className="text-gray-600 mb-4">
                      In the event of a merger, acquisition, or sale of assets, your information may be transferred as part of the business transaction.
                    </p>

                    <h4 className="font-semibold text-gray-900 mb-2">Aggregated Data</h4>
                    <p className="text-gray-600 mb-4">
                      We may share aggregated, non-personally identifiable information for business purposes, research, or marketing.
                    </p>
                  </div>
                </div>
              )}

              {activeSection === 'security' && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Data Security</h2>
                  <div className="prose prose-gray max-w-none">
                    <p className="text-gray-600 mb-4">
                      We implement comprehensive security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.
                    </p>

                    <h4 className="font-semibold text-gray-900 mb-2">Technical Safeguards</h4>
                    <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                      <li>SSL/TLS encryption for data transmission</li>
                      <li>Encrypted storage of sensitive information</li>
                      <li>Regular security audits and vulnerability assessments</li>
                      <li>Secure payment processing through certified providers</li>
                      <li>Multi-factor authentication for administrative access</li>
                    </ul>

                    <h4 className="font-semibold text-gray-900 mb-2">Operational Safeguards</h4>
                    <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                      <li>Limited access to personal information on a need-to-know basis</li>
                      <li>Employee training on data protection and privacy</li>
                      <li>Regular monitoring of system access and activities</li>
                      <li>Incident response procedures for security breaches</li>
                    </ul>

                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                      <h4 className="font-semibold text-yellow-800 mb-2">Important Note</h4>
                      <p className="text-yellow-700 text-sm">
                        While we implement strong security measures, no method of transmission over the internet or electronic storage is 100% secure. We cannot guarantee absolute security.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'retention' && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Data Retention</h2>
                  <div className="prose prose-gray max-w-none">
                    <p className="text-gray-600 mb-4">
                      We retain your personal information only for as long as necessary to fulfill the purposes outlined in this privacy policy.
                    </p>

                    <h4 className="font-semibold text-gray-900 mb-2">Retention Periods</h4>
                    <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                      <li>Account information: Until account deletion or 3 years of inactivity</li>
                      <li>Order history: 7 years for tax and legal compliance</li>
                      <li>Payment information: As required by payment processors and regulations</li>
                      <li>Support communications: 3 years from last interaction</li>
                      <li>Marketing preferences: Until you opt out or account deletion</li>
                    </ul>

                    <h4 className="font-semibold text-gray-900 mb-2">Data Deletion</h4>
                    <p className="text-gray-600 mb-4">
                      When we no longer need your personal information, we securely delete or anonymize it. Some information may be retained in anonymized form for analytical purposes.
                    </p>

                    <h4 className="font-semibold text-gray-900 mb-2">Legal Requirements</h4>
                    <p className="text-gray-600 mb-4">
                      We may retain certain information longer if required by law, regulation, or for legitimate business purposes such as fraud prevention.
                    </p>
                  </div>
                </div>
              )}

              {activeSection === 'rights' && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Privacy Rights</h2>
                  <div className="prose prose-gray max-w-none">
                    <p className="text-gray-600 mb-4">
                      You have several rights regarding your personal information. We are committed to helping you exercise these rights.
                    </p>

                    <h4 className="font-semibold text-gray-900 mb-2">Access and Portability</h4>
                    <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                      <li>Request access to your personal information</li>
                      <li>Receive a copy of your data in a portable format</li>
                      <li>View your order history and account information</li>
                    </ul>

                    <h4 className="font-semibold text-gray-900 mb-2">Correction and Updates</h4>
                    <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                      <li>Update your profile and account information</li>
                      <li>Correct inaccurate personal information</li>
                      <li>Modify your delivery addresses and preferences</li>
                    </ul>

                    <h4 className="font-semibold text-gray-900 mb-2">Deletion and Restriction</h4>
                    <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                      <li>Request deletion of your personal information</li>
                      <li>Restrict processing of your data</li>
                      <li>Delete your account and associated data</li>
                    </ul>

                    <h4 className="font-semibold text-gray-900 mb-2">Communication Preferences</h4>
                    <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                      <li>Opt out of marketing communications</li>
                      <li>Manage notification preferences</li>
                      <li>Control promotional offers and updates</li>
                    </ul>

                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                      <h4 className="font-semibold text-green-800 mb-2">How to Exercise Your Rights</h4>
                      <p className="text-green-700 text-sm">
                        Contact our privacy team at privacy@tap2go.com or use the settings in your account to manage your preferences.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'cookies' && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Cookies & Tracking Technologies</h2>
                  <div className="prose prose-gray max-w-none">
                    <p className="text-gray-600 mb-4">
                      We use cookies and similar technologies to enhance your experience, analyze usage, and provide personalized content.
                    </p>

                    <h4 className="font-semibold text-gray-900 mb-2">Types of Cookies</h4>
                    <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                      <li><strong>Essential Cookies:</strong> Required for basic platform functionality</li>
                      <li><strong>Performance Cookies:</strong> Help us analyze and improve our services</li>
                      <li><strong>Functional Cookies:</strong> Remember your preferences and settings</li>
                      <li><strong>Marketing Cookies:</strong> Used for targeted advertising (with consent)</li>
                    </ul>

                    <h4 className="font-semibold text-gray-900 mb-2">Third-Party Tracking</h4>
                    <p className="text-gray-600 mb-4">
                      We may use third-party analytics and advertising services that use their own cookies and tracking technologies.
                    </p>

                    <h4 className="font-semibold text-gray-900 mb-2">Cookie Management</h4>
                    <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                      <li>Manage cookie preferences through our cookie banner</li>
                      <li>Control cookies through your browser settings</li>
                      <li>Opt out of targeted advertising through industry tools</li>
                      <li>Note that disabling cookies may affect platform functionality</li>
                    </ul>
                  </div>
                </div>
              )}

              {activeSection === 'children' && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Children&apos;s Privacy</h2>
                  <div className="prose prose-gray max-w-none">
                    <p className="text-gray-600 mb-4">
                      Our services are not intended for children under 18 years of age. We do not knowingly collect personal information from children.
                    </p>

                    <h4 className="font-semibold text-gray-900 mb-2">Age Verification</h4>
                    <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                      <li>Users must be at least 18 years old to create an account</li>
                      <li>We may verify age during account registration</li>
                      <li>Parents or guardians may create accounts for family use</li>
                    </ul>

                    <h4 className="font-semibold text-gray-900 mb-2">Parental Rights</h4>
                    <p className="text-gray-600 mb-4">
                      If we become aware that we have collected information from a child under 18, we will take steps to delete such information. Parents who believe we may have collected information from their child should contact us immediately.
                    </p>
                  </div>
                </div>
              )}

              {activeSection === 'changes' && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Privacy Policy Changes</h2>
                  <div className="prose prose-gray max-w-none">
                    <h4 className="font-semibold text-gray-900 mb-2">Policy Updates</h4>
                    <p className="text-gray-600 mb-4">
                      We may update this Privacy Policy from time to time to reflect changes in our practices, technology, legal requirements, or other factors.
                    </p>

                    <h4 className="font-semibold text-gray-900 mb-2">Notification of Changes</h4>
                    <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                      <li>Email notification for significant changes</li>
                      <li>In-app notifications and announcements</li>
                      <li>Updated &quot;Last Modified&quot; date on this page</li>
                      <li>Prominent notices on our platform</li>
                    </ul>

                    <h4 className="font-semibold text-gray-900 mb-2">Your Consent</h4>
                    <p className="text-gray-600 mb-4">
                      Your continued use of our services after changes are posted constitutes acceptance of the updated Privacy Policy. If you do not agree with changes, you may discontinue using our services.
                    </p>
                  </div>
                </div>
              )}

              {activeSection === 'contact' && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Contact Information</h2>
                  <div className="prose prose-gray max-w-none">
                    <p className="text-gray-600 mb-4">
                      If you have questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:
                    </p>

                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                      <h4 className="font-semibold text-gray-900 mb-3">Privacy Team</h4>
                      <div className="space-y-2 text-gray-600">
                        <div className="flex items-center space-x-2">
                          <i className="fas fa-envelope text-[#eba236]"></i>
                          <span>privacy@tap2go.com</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <i className="fas fa-phone text-[#eba236]"></i>
                          <span>+63 2 8123 4567</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <i className="fas fa-map-marker-alt text-[#eba236]"></i>
                          <span>Makati City, Metro Manila, Philippines</span>
                        </div>
                      </div>
                    </div>

                    <h4 className="font-semibold text-gray-900 mb-2">Data Protection Officer</h4>
                    <p className="text-gray-600 mb-4">
                      For specific data protection inquiries, you may contact our Data Protection Officer at dpo@tap2go.com.
                    </p>

                    <h4 className="font-semibold text-gray-900 mb-2">Response Time</h4>
                    <p className="text-gray-600 mb-4">
                      We aim to respond to privacy-related inquiries within 30 days. Complex requests may require additional time, and we will keep you informed of our progress.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="mt-6 flex flex-wrap gap-3">
              <button className="bg-white text-[#eba236] border border-[#eba236] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#eba236] hover:text-white transition-colors">
                Download Privacy Policy
              </button>
              <button className="bg-white text-[#eba236] border border-[#eba236] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#eba236] hover:text-white transition-colors">
                Manage Privacy Settings
              </button>
              <button className="bg-white text-[#eba236] border border-[#eba236] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#eba236] hover:text-white transition-colors">
                Contact Privacy Team
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}