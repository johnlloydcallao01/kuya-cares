'use client';

import React, { useState } from 'react';

/**
 * Cookie Policy Page - Cookie usage for Kuya Cares food delivery service
 * Mirrors the Terms and Conditions page layout
 */
export default function CookiesPage() {
  const [activeSection, setActiveSection] = useState('overview');

  const sections = [
    { id: 'overview', title: 'Overview', icon: 'fa-info-circle' },
    { id: 'what-are-cookies', title: 'What Are Cookies', icon: 'fa-cookie-bite' },
    { id: 'types', title: 'Types We Use', icon: 'fa-list' },
    { id: 'how-we-use', title: 'How We Use Them', icon: 'fa-utensils' },
    { id: 'manage', title: 'Manage Preferences', icon: 'fa-sliders-h' },
    { id: 'third-party', title: 'Third-Party Cookies', icon: 'fa-share-alt' },
    { id: 'changes', title: 'Changes to Policy', icon: 'fa-edit' }
  ];

  const lastUpdated = "September 30, 2026";

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white">
        <div className="px-[10px] py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Cookie Policy</h1>
              <p className="mt-1 text-sm text-gray-600">Last updated: {lastUpdated}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-[10px] py-4">
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
                        ? 'bg-[#239459] text-white'
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
                      This Cookie Policy explains how Kuya Cares (&quot;we&quot;, &quot;us&quot;) uses cookies and similar technologies on our website and mobile application.
                    </p>
                    <p className="text-gray-600 mb-4">
                      By continuing to use Kuya Cares, you consent to our use of cookies as described in this policy. Our General Terms and Conditions and Privacy Policy apply alongside this policy.
                    </p>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                      <h4 className="font-semibold text-yellow-800 mb-2">Important Notice</h4>
                      <p className="text-yellow-700 text-sm">
                        You can control cookies through your browser settings and our preference controls, but blocking essential cookies may limit core features like sign-in, cart, and checkout.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'what-are-cookies' && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">What Are Cookies</h2>
                  <div className="prose prose-gray max-w-none">
                    <p className="text-gray-600 mb-4">
                      Cookies are small text files stored on your device when you visit a website. They help the site remember your actions and preferences over time.
                    </p>
                    <h4 className="font-semibold text-gray-900 mb-2">Similar Technologies</h4>
                    <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                      <li>Local storage and session storage</li>
                      <li>Pixels and web beacons for measuring usage</li>
                      <li>SDK identifiers in our mobile application</li>
                    </ul>
                  </div>
                </div>
              )}

              {activeSection === 'types' && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Types We Use</h2>
                  <div className="prose prose-gray max-w-none">
                    <h4 className="font-semibold text-gray-900 mb-2">Strictly Necessary</h4>
                    <p className="text-gray-600 mb-4">
                      Required for sign-in sessions, cart contents, checkout, and security. These cannot be disabled without breaking core functionality.
                    </p>
                    <h4 className="font-semibold text-gray-900 mb-2">Preferences</h4>
                    <p className="text-gray-600 mb-4">
                      Remember choices such as language, delivery address, and display settings.
                    </p>
                    <h4 className="font-semibold text-gray-900 mb-2">Analytics</h4>
                    <p className="text-gray-600 mb-4">
                      Help us understand aggregate usage (pages visited, features used) so we can improve performance and the ordering experience.
                    </p>
                    <h4 className="font-semibold text-gray-900 mb-2">Marketing</h4>
                    <p className="text-gray-600 mb-4">
                      Used for relevant vouchers, promotions, and measuring campaign effectiveness, only with your consent where required.
                    </p>
                  </div>
                </div>
              )}

              {activeSection === 'how-we-use' && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">How We Use Them</h2>
                  <div className="prose prose-gray max-w-none">
                    <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                      <li>Keep you signed in across visits and devices</li>
                      <li>Remember your cart, recent views, and wishlist</li>
                      <li>Pre-fill delivery addresses and payment preferences</li>
                      <li>Measure crashes, load times, and feature adoption</li>
                      <li>Personalize vouchers and recommendations</li>
                      <li>Prevent fraud and secure your account</li>
                    </ul>
                    <p className="text-gray-600 mb-4">
                      Cookie lifetimes vary: session cookies expire when you close the browser, while persistent cookies remain for up to 12 months unless cleared earlier.
                    </p>
                  </div>
                </div>
              )}

              {activeSection === 'manage' && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Manage Preferences</h2>
                  <div className="prose prose-gray max-w-none">
                    <h4 className="font-semibold text-gray-900 mb-2">Browser Controls</h4>
                    <p className="text-gray-600 mb-4">
                      Most browsers let you block or delete cookies in settings. Consult your browser&apos;s help pages for instructions.
                    </p>
                    <h4 className="font-semibold text-gray-900 mb-2">In-App Settings</h4>
                    <p className="text-gray-600 mb-4">
                      You can update marketing and analytics preferences at any time under Settings. Changes apply going forward.
                    </p>
                    <h4 className="font-semibold text-gray-900 mb-2">Effect of Blocking</h4>
                    <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                      <li>Blocking strictly necessary cookies will sign you out and empty your cart</li>
                      <li>Blocking preference cookies resets display and address defaults</li>
                      <li>Blocking analytics or marketing cookies does not affect ordering</li>
                    </ul>
                  </div>
                </div>
              )}

              {activeSection === 'third-party' && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Third-Party Cookies</h2>
                  <div className="prose prose-gray max-w-none">
                    <p className="text-gray-600 mb-4">
                      Some cookies are set by service providers that help us operate Kuya Cares:
                    </p>
                    <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                      <li>Payment processors (e.g. PayMongo) for secure checkout</li>
                      <li>Maps and location services for delivery tracking</li>
                      <li>Analytics providers for aggregated usage measurement</li>
                      <li>Cloud hosting and error-reporting infrastructure</li>
                    </ul>
                    <p className="text-gray-600 mb-4">
                      These providers have their own cookie and privacy policies, which we encourage you to review.
                    </p>
                  </div>
                </div>
              )}

              {activeSection === 'changes' && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Changes to Policy</h2>
                  <div className="prose prose-gray max-w-none">
                    <h4 className="font-semibold text-gray-900 mb-2">Modifications</h4>
                    <p className="text-gray-600 mb-4">
                      We may update this Cookie Policy as our use of cookies evolves. Changes take effect immediately upon posting.
                    </p>
                    <h4 className="font-semibold text-gray-900 mb-2">Contact Information</h4>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-gray-600 mb-2">
                        If you have questions about this policy, please contact us:
                      </p>
                      <ul className="text-gray-600 space-y-1">
                        <li>Email: legal@kuyacares.com</li>
                        <li>Phone: +63 2 8123 4567</li>
                        <li>Address: Makati City, Metro Manila, Philippines</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
