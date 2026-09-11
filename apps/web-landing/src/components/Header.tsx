"use client";

import { useState } from "react";
import Link from "next/link";

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navItems = [
    { href: "/", label: "Home" },
    { href: "/about", label: "About" },
    { href: "/courses", label: "Courses" },
    { href: "/contact", label: "Contact" },
    { href: "/faq", label: "FAQ" },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link href="/" className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#201a7c] to-[#ab3b43] rounded-xl flex items-center justify-center">
                <i className="fas fa-graduation-cap text-white text-lg"></i>
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold text-gray-900 heading-primary">
                  EduPlatform
                </span>
                <span className="text-xs text-gray-500 -mt-1">
                  Learning Excellence
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-8">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="nav-link text-gray-700 hover:text-[#201a7c] px-3 py-2 text-sm font-medium transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            <button className="p-3 text-gray-600 hover:text-[#201a7c] hover:bg-gray-50 rounded-lg transition-colors">
              <i className="fas fa-search text-lg"></i>
            </button>
            <Link
              href="https://app.tap2goph.com/"
              className="bg-gradient-to-r from-[#201a7c] to-[#ab3b43] text-white px-6 py-3 rounded-lg font-medium hover:from-[#1a1569] hover:to-[#8f2f36] transition-all duration-300 inline-flex items-center text-sm"
            >
              <i className="fas fa-user-circle mr-2"></i>
              My Account
            </Link>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-gray-700 hover:text-[#201a7c] focus:outline-none focus:text-[#201a7c] p-2"
            >
              <i className={`fas ${isMenuOpen ? "fa-times" : "fa-bars"} text-lg`}></i>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white border-t border-gray-200 shadow-lg">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-[#201a7c] hover:bg-gray-50 rounded-md transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <div className="pt-4 pb-2 border-t border-gray-200 mt-4 space-y-3">
                <button className="w-full p-3 text-gray-600 hover:text-[#201a7c] hover:bg-gray-50 rounded-lg transition-colors flex items-center justify-center">
                  <i className="fas fa-search text-lg mr-2"></i>
                  Search
                </button>
                <Link
                  href="https://app.tap2goph.com/"
                  className="block w-full text-center bg-gradient-to-r from-[#201a7c] to-[#ab3b43] text-white px-6 py-4 rounded-lg font-medium hover:from-[#1a1569] hover:to-[#8f2f36] transition-all duration-300 inline-flex items-center justify-center"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <i className="fas fa-user-circle mr-2"></i>
                  My Account
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
