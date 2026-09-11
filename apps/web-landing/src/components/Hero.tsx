import Link from "next/link";
import Image from "next/image";

export function Hero() {
  return (
    <section className="gradient-hero min-h-screen flex items-center justify-center relative overflow-hidden pt-16">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full animate-float"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-white/5 rounded-full animate-float" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/4 w-32 h-32 bg-white/10 rounded-full animate-float" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/4 right-1/4 w-24 h-24 bg-cyan-300/20 rounded-full animate-pulse-slow"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="text-center lg:text-left">
            {/* Badge */}
            <div className="inline-flex items-center px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full text-white text-sm font-medium mb-6 animate-fade-in-up">
              <i className="fas fa-star text-yellow-300 mr-2"></i>
              #1 Enterprise LMS Platform
            </div>

            {/* Main heading */}
            <h1 className="heading-primary text-3xl md:text-4xl lg:text-5xl text-white mb-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
              Transform Your
              <span className="block text-cyan-300">Learning Journey</span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg md:text-xl text-blue-100 mb-8 max-w-2xl mx-auto lg:mx-0 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              Empower your team with our enterprise-grade learning management system.
              Comprehensive courses, expert instructors, and cutting-edge technology.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start items-center animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
              <Link
                href="/courses"
                className="bg-white text-blue-600 px-8 py-4 rounded-xl font-semibold text-lg hover:bg-gray-100 transition-all duration-300 hover:transform hover:scale-105 shadow-lg inline-flex items-center"
              >
                <i className="fas fa-play mr-2"></i>
                Start Learning
              </Link>
              <Link
                href="/demo"
                className="border-2 border-white text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-white hover:text-blue-600 transition-all duration-300 hover:transform hover:scale-105 inline-flex items-center"
              >
                <i className="fas fa-video mr-2"></i>
                Watch Demo
              </Link>
            </div>


          </div>

          {/* Right Content - Hero Image */}
          <div className="relative animate-fade-in-right" style={{ animationDelay: '0.5s' }}>
            <div className="relative">
              {/* Main hero image */}
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 shadow-2xl">
                <Image
                  src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&h=400&fit=crop&crop=center"
                  alt="Students learning together"
                  width={600}
                  height={400}
                  className="rounded-xl shadow-lg"
                  priority
                />
              </div>
              
              {/* Floating stats cards */}
              <div className="absolute -top-4 -left-4 bg-white rounded-xl p-4 shadow-lg animate-float">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <i className="fas fa-users text-green-600 text-lg"></i>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">50K+</div>
                    <div className="text-gray-600 text-sm">Active Learners</div>
                  </div>
                </div>
              </div>

              <div className="absolute -bottom-4 -right-4 bg-white rounded-xl p-4 shadow-lg animate-float" style={{ animationDelay: '1s' }}>
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <i className="fas fa-certificate text-blue-600 text-lg"></i>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">1000+</div>
                    <div className="text-gray-600 text-sm">Courses</div>
                  </div>
                </div>
              </div>

              <div className="absolute top-1/2 -left-8 bg-white rounded-xl p-4 shadow-lg animate-float" style={{ animationDelay: '2s' }}>
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <i className="fas fa-star text-yellow-600 text-lg"></i>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">4.9</div>
                    <div className="text-gray-600 text-sm">Rating</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
        <div className="text-white hover:text-cyan-300 transition-colors cursor-pointer">
          <i className="fas fa-chevron-down text-2xl"></i>
        </div>
      </div>
    </section>
  );
}
