import Link from "next/link";
import Image from "next/image";

export function CTA() {
  return (
    <section className="py-20 bg-gradient-to-br from-[#201a7c] via-[#1a1569] to-[#ab3b43] relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/5 rounded-full animate-float"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-white/5 rounded-full animate-float" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/4 w-32 h-32 bg-cyan-400/10 rounded-full animate-pulse-slow"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left content */}
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full text-white text-sm font-medium mb-6">
              <i className="fas fa-rocket mr-2"></i>
              Start Your Journey Today
            </div>

            <h2 className="heading-primary text-4xl md:text-5xl lg:text-6xl text-white mb-6">
              Ready to Transform
              <span className="block text-cyan-300">Your Career?</span>
            </h2>

            <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto lg:mx-0">
              Join over 50,000 professionals who have advanced their careers with our expert-led courses. 
              Start your free trial today and unlock your potential.
            </p>

            {/* Benefits list */}
            <div className="space-y-4 mb-8">
              <div className="flex items-center justify-center lg:justify-start space-x-3">
                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-check text-white text-sm"></i>
                </div>
                <span className="text-blue-100">14-day free trial with full access</span>
              </div>
              <div className="flex items-center justify-center lg:justify-start space-x-3">
                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-check text-white text-sm"></i>
                </div>
                <span className="text-blue-100">Industry-recognized certificates</span>
              </div>
              <div className="flex items-center justify-center lg:justify-start space-x-3">
                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-check text-white text-sm"></i>
                </div>
                <span className="text-blue-100">24/7 expert support and mentorship</span>
              </div>
              <div className="flex items-center justify-center lg:justify-start space-x-3">
                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-check text-white text-sm"></i>
                </div>
                <span className="text-blue-100">Lifetime access to course materials</span>
              </div>
            </div>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link
                href="/signup"
                className="bg-white text-[#201a7c] px-8 py-4 rounded-xl font-semibold text-lg hover:bg-gray-100 transition-all duration-300 hover:transform hover:scale-105 shadow-lg inline-flex items-center justify-center"
              >
                <i className="fas fa-rocket mr-2"></i>
                Start Free Trial
              </Link>
              <Link
                href="/demo"
                className="border-2 border-white text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-white hover:text-[#201a7c] transition-all duration-300 hover:transform hover:scale-105 inline-flex items-center justify-center"
              >
                <i className="fas fa-play mr-2"></i>
                Watch Demo
              </Link>
            </div>

            {/* Trust indicators */}
            <div className="mt-8 text-center lg:text-left">
              <p className="text-blue-200 text-sm mb-4">No credit card required • Cancel anytime</p>
              <div className="flex items-center justify-center lg:justify-start space-x-4">
                <div className="flex text-yellow-400">
                  <i className="fas fa-star"></i>
                  <i className="fas fa-star"></i>
                  <i className="fas fa-star"></i>
                  <i className="fas fa-star"></i>
                  <i className="fas fa-star"></i>
                </div>
                <span className="text-blue-100 text-sm">4.9/5 from 10,000+ reviews</span>
              </div>
            </div>
          </div>

          {/* Right content - Visual elements */}
          <div className="relative">
            <div className="relative">
              {/* Main image */}
              <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 shadow-2xl">
                <Image
                  src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&h=400&fit=crop&crop=center"
                  alt="Students celebrating success"
                  width={600}
                  height={400}
                  className="rounded-2xl shadow-lg"
                />
              </div>

              {/* Floating success metrics */}
              <div className="absolute -top-6 -left-6 bg-white rounded-2xl p-4 shadow-xl animate-float">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <i className="fas fa-trophy text-green-600 text-lg"></i>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">98%</div>
                    <div className="text-gray-600 text-sm">Success Rate</div>
                  </div>
                </div>
              </div>

              <div className="absolute -bottom-6 -right-6 bg-white rounded-2xl p-4 shadow-xl animate-float" style={{ animationDelay: '1s' }}>
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <i className="fas fa-graduation-cap text-blue-600 text-lg"></i>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">50K+</div>
                    <div className="text-gray-600 text-sm">Graduates</div>
                  </div>
                </div>
              </div>

              <div className="absolute top-1/2 -left-8 bg-white rounded-2xl p-4 shadow-xl animate-float" style={{ animationDelay: '2s' }}>
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                    <i className="fas fa-briefcase text-purple-600 text-lg"></i>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">85%</div>
                    <div className="text-gray-600 text-sm">Job Placement</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom section with urgency */}
        <div className="mt-16 text-center">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 max-w-4xl mx-auto">
            <div className="flex items-center justify-center mb-4">
              <i className="fas fa-clock text-yellow-400 text-2xl mr-3"></i>
              <span className="text-white text-lg font-semibold">Limited Time Offer</span>
            </div>
            <h3 className="text-2xl md:text-3xl font-bold text-white mb-4">
              Get 50% Off Your First Year
            </h3>
            <p className="text-blue-100 mb-6">
              Join now and save $500 on your annual subscription. Offer expires in 7 days!
            </p>
            <div className="flex items-center justify-center space-x-8 text-white">
              <div className="text-center">
                <div className="text-3xl font-bold">06</div>
                <div className="text-sm text-blue-200">Days</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold">23</div>
                <div className="text-sm text-blue-200">Hours</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold">45</div>
                <div className="text-sm text-blue-200">Minutes</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold">12</div>
                <div className="text-sm text-blue-200">Seconds</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
