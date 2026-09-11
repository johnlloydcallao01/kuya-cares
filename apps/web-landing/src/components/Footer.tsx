"use client";

import Link from "next/link";

export function Footer() {
  const currentYear = new Date().getFullYear();

  const quickLinks = [
    { href: "/", label: "Home" },
    { href: "/about", label: "About Us" },
    { href: "/courses", label: "Courses" },
    { href: "/contact", label: "Contact" },
    { href: "/faq", label: "FAQ" }
  ];

  const courses = [
    { href: "/courses/data-science", label: "Data Science" },
    { href: "/courses/web-development", label: "Web Development" },
    { href: "/courses/cloud-computing", label: "Cloud Computing" },
    { href: "/courses/digital-marketing", label: "Digital Marketing" },
    { href: "/courses/cybersecurity", label: "Cybersecurity" }
  ];

  const company = [
    { href: "/about", label: "About Us" },
    { href: "/careers", label: "Careers" },
    { href: "/press", label: "Press" },
    { href: "/blog", label: "Blog" },
    { href: "/partners", label: "Partners" }
  ];

  const support = [
    { href: "/help", label: "Help Center" },
    { href: "/contact", label: "Contact Support" },
    { href: "/community", label: "Community" },
    { href: "/status", label: "System Status" },
    { href: "/feedback", label: "Feedback" }
  ];

  const legal = [
    { href: "/privacy-policy", label: "Privacy Policy" },
    { href: "/terms-and-conditions", label: "Terms and Conditions" },
    { href: "/cookie-policy", label: "Cookie Policy" },
    { href: "/accessibility", label: "Accessibility" },
    { href: "/licenses", label: "Licenses" }
  ];

  const socialLinks = [
    { href: "https://facebook.com", icon: "fab fa-facebook-f", label: "Facebook" },
    { href: "https://twitter.com", icon: "fab fa-twitter", label: "Twitter" },
    { href: "https://linkedin.com", icon: "fab fa-linkedin-in", label: "LinkedIn" },
    { href: "https://instagram.com", icon: "fab fa-instagram", label: "Instagram" },
    { href: "https://youtube.com", icon: "fab fa-youtube", label: "YouTube" }
  ];

  return (
    <footer className="bg-gray-900 text-white">
      {/* Main footer content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-8">
          {/* Company info */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-[#201a7c] to-[#ab3b43] rounded-xl flex items-center justify-center">
                <i className="fas fa-graduation-cap text-white text-lg"></i>
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold heading-primary">EduPlatform</span>
                <span className="text-xs text-gray-400 -mt-1">Learning Excellence</span>
              </div>
            </Link>
            <p className="text-gray-300 mb-6 leading-relaxed max-w-md">
              Empowering professionals worldwide with cutting-edge education and industry-leading expertise. 
              Transform your career with our comprehensive learning platform.
            </p>
            <div className="flex space-x-4">
              {socialLinks.map((social, index) => (
                <a
                  key={index}
                  href={social.href}
                  className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-[#201a7c] transition-colors group"
                  aria-label={social.label}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <i className={`${social.icon} group-hover:scale-110 transition-transform`}></i>
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-6 heading-secondary">Quick Links</h3>
            <ul className="space-y-3">
              {quickLinks.map((link, index) => (
                <li key={index}>
                  <Link
                    href={link.href}
                    className="text-gray-300 hover:text-white transition-colors hover:translate-x-1 transform duration-200 inline-block"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Popular Courses */}
          <div>
            <h3 className="text-lg font-semibold mb-6 heading-secondary">Popular Courses</h3>
            <ul className="space-y-3">
              {courses.map((course, index) => (
                <li key={index}>
                  <Link
                    href={course.href}
                    className="text-gray-300 hover:text-white transition-colors hover:translate-x-1 transform duration-200 inline-block"
                  >
                    {course.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-lg font-semibold mb-6 heading-secondary">Company</h3>
            <ul className="space-y-3">
              {company.map((item, index) => (
                <li key={index}>
                  <Link
                    href={item.href}
                    className="text-gray-300 hover:text-white transition-colors hover:translate-x-1 transform duration-200 inline-block"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-lg font-semibold mb-6 heading-secondary">Support</h3>
            <ul className="space-y-3">
              {support.map((item, index) => (
                <li key={index}>
                  <Link
                    href={item.href}
                    className="text-gray-300 hover:text-white transition-colors hover:translate-x-1 transform duration-200 inline-block"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>



        {/* Contact info */}
        <div className="border-t border-gray-800 mt-8 pt-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex items-start space-x-3">
              <i className="fas fa-map-marker-alt text-[#ab3b43] mt-1"></i>
              <div>
                <h4 className="font-semibold mb-1">Address</h4>
                <p className="text-gray-300 text-sm">
                  123 Education Street<br />
                  Learning City, LC 12345
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <i className="fas fa-phone text-[#ab3b43] mt-1"></i>
              <div>
                <h4 className="font-semibold mb-1">Phone</h4>
                <p className="text-gray-300 text-sm">+1 (555) 123-4567</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <i className="fas fa-envelope text-[#ab3b43] mt-1"></i>
              <div>
                <h4 className="font-semibold mb-1">Email</h4>
                <p className="text-gray-300 text-sm">hello@eduplatform.com</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom footer */}
      <div className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <p className="text-gray-400 text-sm">
              © {currentYear} EduPlatform. All rights reserved.
            </p>
            <div className="flex flex-wrap gap-6 mt-4 md:mt-0">
              {legal.map((item, index) => (
                <Link
                  key={index}
                  href={item.href}
                  className="text-gray-400 hover:text-white text-sm transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Back to top button */}
      <div className="fixed bottom-8 right-8 z-50">
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="w-12 h-12 bg-[#201a7c] hover:bg-[#1a1569] rounded-full flex items-center justify-center text-white shadow-lg transition-colors group"
          aria-label="Back to top"
        >
          <i className="fas fa-chevron-up group-hover:scale-110 transition-transform"></i>
        </button>
      </div>
    </footer>
  );
}
