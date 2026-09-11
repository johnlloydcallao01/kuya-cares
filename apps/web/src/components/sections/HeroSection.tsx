import React from 'react';

/**
 * Compact Hero Banner Component for Maritime Training Platform
 *
 * Features:
 * - Compact banner design with rounded corners
 * - Maritime-themed background
 * - Side margins for rounded appearance
 * - Minimal text with clear CTA
 */
export function HeroSection() {
  return (
    <section className="p-2.5">
      <div
        className="relative rounded-2xl overflow-hidden shadow-xl"
        style={{
          background: 'linear-gradient(135deg, #201a7c 0%, #ab3b43 100%)'
        }}
      >
        {/* Maritime Background Pattern */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-15"
          style={{
            backgroundImage: `url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 200"><defs><pattern id="waves" x="0" y="0" width="100" height="20" patternUnits="userSpaceOnUse"><path d="M0,10 Q25,0 50,10 T100,10" stroke="%23ffffff" stroke-width="1" fill="none" opacity="0.3"/></pattern></defs><rect width="1200" height="200" fill="url(%23waves)"/><g opacity="0.4"><circle cx="150" cy="40" r="1.5" fill="%23ffffff"/><circle cx="350" cy="60" r="1" fill="%23ffffff"/><circle cx="550" cy="35" r="1.5" fill="%23ffffff"/><circle cx="750" cy="55" r="1" fill="%23ffffff"/><circle cx="950" cy="45" r="1.5" fill="%23ffffff"/></g><g opacity="0.6"><path d="M50,80 L70,85 L90,80 L110,85 L130,80" stroke="%23ffffff" stroke-width="1.5" fill="none"/><path d="M200,90 L220,95 L240,90 L260,95 L280,90" stroke="%23ffffff" stroke-width="1.5" fill="none"/><path d="M400,75 L420,80 L440,75 L460,80 L480,75" stroke="%23ffffff" stroke-width="1.5" fill="none"/></g><g opacity="0.3"><polygon points="100,120 110,110 120,120 110,130" fill="%23ffffff"/><polygon points="300,130 310,120 320,130 310,140" fill="%23ffffff"/><polygon points="500,115 510,105 520,115 510,125" fill="%23ffffff"/><polygon points="700,125 710,115 720,125 710,135" fill="%23ffffff"/><polygon points="900,110 910,100 920,110 910,120" fill="%23ffffff"/></g><path d="M0,160 Q200,140 400,160 T800,160 Q1000,140 1200,160 L1200,200 L0,200 Z" fill="%23ffffff" opacity="0.1"/></svg>')`
          }}
        />

        {/* Content */}
        <div className="relative z-10 px-6 sm:px-8 lg:px-12 py-5 lg:py-12">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            {/* Text Content */}
            <div className="lg:flex-1">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white leading-tight">
                Master Maritime Excellence
              </h1>

              <p className="mt-3 text-sm sm:text-base lg:text-lg text-blue-100 leading-relaxed">
                Professional maritime training programs designed by industry experts.
              </p>
            </div>

            {/* Call-to-Action */}
            <div className="mt-6 lg:mt-0 lg:ml-8 flex gap-3">
              <button className="bg-white text-blue-900 px-4 py-2 sm:px-6 sm:py-3 rounded-lg font-medium text-sm sm:text-base hover:bg-blue-50 transition-colors duration-200 shadow-lg hover:shadow-xl">
                Browse Products
              </button>

              <button className="border-2 border-white text-white px-4 py-2 sm:px-6 sm:py-3 rounded-lg font-medium text-sm sm:text-base hover:bg-white hover:text-blue-900 transition-colors duration-200">
                Learn More
              </button>
            </div>
          </div>
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-4 right-4 w-3 h-3 bg-blue-300 rounded-full opacity-60 animate-pulse"></div>
        <div className="absolute bottom-4 right-8 w-2 h-2 bg-white rounded-full opacity-40 animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 right-6 w-1.5 h-1.5 bg-blue-200 rounded-full opacity-50 animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>
    </section>
  );
}
