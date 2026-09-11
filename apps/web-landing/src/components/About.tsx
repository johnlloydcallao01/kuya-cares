export function About() {
  return (
    <section id="about" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <div className="animate-fade-in-left">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              Leading Maritime Education Since 2008
            </h2>
            <p className="text-lg text-gray-600 mb-6 leading-relaxed">
              Grandline Maritime Training and Development Center Inc. has been at the forefront of maritime education, 
              providing world-class training programs that prepare professionals for successful careers at sea and on shore.
            </p>
            <p className="text-lg text-gray-600 mb-8 leading-relaxed">
              Our commitment to excellence, safety, and innovation has made us a trusted partner for maritime professionals 
              and shipping companies worldwide. We combine traditional maritime knowledge with modern technology to deliver 
              comprehensive training solutions.
            </p>

            {/* Key points */}
            <div className="space-y-4 mb-8">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <i className="fas fa-check text-white text-sm"></i>
                </div>
                <p className="text-gray-700">STCW and IMO compliant training programs</p>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <i className="fas fa-check text-white text-sm"></i>
                </div>
                <p className="text-gray-700">State-of-the-art simulation and training facilities</p>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <i className="fas fa-check text-white text-sm"></i>
                </div>
                <p className="text-gray-700">Experienced instructors with industry expertise</p>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <i className="fas fa-check text-white text-sm"></i>
                </div>
                <p className="text-gray-700">Strong industry partnerships and job placement support</p>
              </div>
            </div>

            <a
              href="#contact"
              className="btn-primary px-6 py-3 rounded-lg font-semibold inline-flex items-center space-x-2"
            >
              <span>Learn More About Us</span>
              <i className="fas fa-arrow-right"></i>
            </a>
          </div>

          {/* Image/Visual */}
          <div className="animate-fade-in-right">
            <div className="relative">
              <div className="bg-gradient-to-br from-blue-600 to-cyan-500 rounded-2xl p-8 text-white">
                <div className="grid grid-cols-2 gap-6">
                  <div className="text-center">
                    <div className="text-4xl font-bold mb-2">500+</div>
                    <div className="text-blue-100">Graduates</div>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl font-bold mb-2">25+</div>
                    <div className="text-blue-100">Courses</div>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl font-bold mb-2">15+</div>
                    <div className="text-blue-100">Years</div>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl font-bold mb-2">95%</div>
                    <div className="text-blue-100">Job Placement</div>
                  </div>
                </div>
                
                <div className="mt-8 text-center">
                  <i className="fas fa-anchor text-6xl text-blue-200 opacity-50"></i>
                </div>
              </div>
              
              {/* Floating elements */}
              <div className="absolute -top-4 -right-4 w-24 h-24 bg-yellow-400 rounded-full flex items-center justify-center animate-float">
                <i className="fas fa-award text-2xl text-yellow-800"></i>
              </div>
              <div className="absolute -bottom-4 -left-4 w-20 h-20 bg-green-400 rounded-full flex items-center justify-center animate-float" style={{ animationDelay: '1s' }}>
                <i className="fas fa-globe text-xl text-green-800"></i>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
