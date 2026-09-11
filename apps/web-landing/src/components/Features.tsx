"use client";

import Image from "next/image";

export function Features() {
  const features = [
    {
      icon: "fas fa-brain",
      title: "AI-Powered Learning",
      description: "Personalized learning paths powered by advanced AI algorithms that adapt to your learning style and pace."
    },
    {
      icon: "fas fa-users-cog",
      title: "Expert Instructors",
      description: "Learn from industry veterans and certified professionals with decades of real-world experience."
    },
    {
      icon: "fas fa-certificate",
      title: "Industry Certifications",
      description: "Earn globally recognized certifications that boost your career and validate your expertise."
    },
    {
      icon: "fas fa-mobile-alt",
      title: "Mobile Learning",
      description: "Access your courses anywhere, anytime with our responsive mobile-first platform design."
    },
    {
      icon: "fas fa-chart-line",
      title: "Progress Analytics",
      description: "Track your learning progress with detailed analytics and performance insights."
    },
    {
      icon: "fas fa-handshake",
      title: "Career Support",
      description: "Get career guidance, job placement assistance, and networking opportunities with industry leaders."
    }
  ];

  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center px-4 py-2 bg-[#201a7c]/10 text-[#201a7c] rounded-full text-sm font-medium mb-4">
            <i className="fas fa-rocket mr-2"></i>
            Why Choose EduPlatform
          </div>
          <h2 className="heading-primary text-3xl md:text-4xl lg:text-5xl text-gray-900 mb-4">
            Everything You Need to
            <span className="text-[#201a7c]"> Excel</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Our comprehensive learning platform combines cutting-edge technology with proven educational methodologies 
            to deliver an unparalleled learning experience.
          </p>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {features.map((feature, index) => (
            <div
              key={index}
              className="card-hover bg-white p-8 rounded-2xl shadow-lg border border-gray-100 group"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-[#201a7c] to-[#ab3b43] rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                  <i className={`${feature.icon} text-2xl text-white`}></i>
                </div>
                <h3 className="heading-secondary text-xl font-semibold text-gray-900 mb-4">
                  {feature.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Feature showcase */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left content */}
          <div className="animate-fade-in-left">
            <div className="inline-flex items-center px-4 py-2 bg-[#ab3b43]/10 text-[#ab3b43] rounded-full text-sm font-medium mb-6">
              <i className="fas fa-check-circle mr-2"></i>
              Advanced Learning Platform
            </div>
            <h3 className="heading-primary text-3xl md:text-4xl text-gray-900 mb-6">
              Learn Smarter, Not Harder
            </h3>
            <p className="text-lg text-gray-600 mb-8 leading-relaxed">
              Our platform uses advanced analytics and machine learning to create personalized learning experiences 
              that adapt to your unique needs and learning style.
            </p>

            {/* Feature list */}
            <div className="space-y-4 mb-8">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-[#201a7c] rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <i className="fas fa-check text-white text-sm"></i>
                </div>
                <p className="text-gray-700">Adaptive learning algorithms that adjust to your pace</p>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-[#201a7c] rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <i className="fas fa-check text-white text-sm"></i>
                </div>
                <p className="text-gray-700">Real-time progress tracking and performance analytics</p>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-[#201a7c] rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <i className="fas fa-check text-white text-sm"></i>
                </div>
                <p className="text-gray-700">Interactive content with hands-on projects and assessments</p>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-[#201a7c] rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <i className="fas fa-check text-white text-sm"></i>
                </div>
                <p className="text-gray-700">24/7 support from expert instructors and mentors</p>
              </div>
            </div>

            <button className="btn-primary">
              <span>Explore Features</span>
              <i className="fas fa-arrow-right ml-2"></i>
            </button>
          </div>

          {/* Right image */}
          <div className="animate-fade-in-right">
            <div className="relative">
              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-8">
                <Image
                  src="https://images.unsplash.com/photo-1551434678-e076c223a692?w=600&h=400&fit=crop&crop=center"
                  alt="Advanced learning dashboard"
                  width={600}
                  height={400}
                  className="rounded-xl shadow-lg"
                />
              </div>
              
              {/* Floating elements */}
              <div className="absolute -top-4 -right-4 w-24 h-24 bg-yellow-400 rounded-full flex items-center justify-center animate-float shadow-lg">
                <i className="fas fa-lightbulb text-2xl text-yellow-800"></i>
              </div>
              <div className="absolute -bottom-4 -left-4 w-20 h-20 bg-green-400 rounded-full flex items-center justify-center animate-float shadow-lg" style={{ animationDelay: '1s' }}>
                <i className="fas fa-trophy text-xl text-green-800"></i>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
