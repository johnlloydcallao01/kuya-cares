"use client";

import { useState } from "react";
import Image from "next/image";

export function Testimonials() {
  const testimonials = [
    {
      id: 1,
      name: "Sarah Johnson",
      position: "Senior Data Scientist",
      company: "Microsoft",
      image: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face",
      content: "EduPlatform transformed my career completely. The machine learning course was incredibly comprehensive and the hands-on projects gave me the confidence to transition into data science. The instructors are world-class!",
      rating: 5,
      course: "Advanced Data Science & ML"
    },
    {
      id: 2,
      name: "Michael Chen",
      position: "Full Stack Developer",
      company: "Google",
      image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face",
      content: "The web development bootcamp exceeded all my expectations. The curriculum is up-to-date with industry standards, and the project-based learning approach helped me build a strong portfolio that landed me my dream job.",
      rating: 5,
      course: "Full-Stack Web Development"
    },
    {
      id: 3,
      name: "Emily Rodriguez",
      position: "Cloud Architect",
      company: "Amazon",
      image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face",
      content: "The cloud architecture course provided exactly what I needed to advance my career. The real-world scenarios and hands-on labs with AWS were invaluable. I got promoted within 3 months of completing the course!",
      rating: 5,
      course: "Cloud Architecture & DevOps"
    },
    {
      id: 4,
      name: "David Park",
      position: "Marketing Director",
      company: "Meta",
      image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
      content: "As someone transitioning from traditional marketing to digital, this platform was a game-changer. The growth hacking strategies I learned helped increase our user acquisition by 300% in just 6 months.",
      rating: 5,
      course: "Digital Marketing & Growth"
    },
    {
      id: 5,
      name: "Lisa Thompson",
      position: "UX Design Lead",
      company: "Apple",
      image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face",
      content: "The UI/UX design course is phenomenal! The instructor's industry experience really shows, and the design thinking methodology has completely changed how I approach product design. Highly recommended!",
      rating: 5,
      course: "UI/UX Design & Product Strategy"
    },
    {
      id: 6,
      name: "Robert Kim",
      position: "Cybersecurity Analyst",
      company: "Tesla",
      image: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&h=150&fit=crop&crop=face",
      content: "The cybersecurity course provided cutting-edge knowledge and practical skills. The ethical hacking labs were incredibly realistic, and I now feel confident protecting our organization from advanced threats.",
      rating: 5,
      course: "Cybersecurity & Ethical Hacking"
    }
  ];

  const [currentIndex, setCurrentIndex] = useState(0);

  const nextTestimonial = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % testimonials.length);
  };

  const prevTestimonial = () => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + testimonials.length) % testimonials.length);
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <i
        key={i}
        className={`fas fa-star ${i < rating ? 'text-yellow-400' : 'text-gray-300'}`}
      ></i>
    ));
  };

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center px-4 py-2 bg-[#ab3b43]/10 text-[#ab3b43] rounded-full text-sm font-medium mb-4">
            <i className="fas fa-quote-left mr-2"></i>
            Student Success Stories
          </div>
          <h2 className="heading-primary text-3xl md:text-4xl lg:text-5xl text-gray-900 mb-4">
            What Our Students
            <span className="text-[#ab3b43]"> Say</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Hear from professionals who have transformed their careers and achieved their goals through our platform.
          </p>
        </div>

        {/* Main testimonial carousel */}
        <div className="relative max-w-4xl mx-auto mb-16">
          <div className="bg-gradient-to-br from-gray-50 to-white rounded-3xl p-8 md:p-12 shadow-xl border border-gray-100">
            <div className="text-center">
              {/* Quote icon */}
              <div className="w-16 h-16 bg-gradient-to-br from-[#201a7c] to-[#ab3b43] rounded-full flex items-center justify-center mx-auto mb-6">
                <i className="fas fa-quote-left text-2xl text-white"></i>
              </div>

              {/* Testimonial content */}
              <blockquote className="text-xl md:text-2xl text-gray-700 mb-8 leading-relaxed">
                "{testimonials[currentIndex].content}"
              </blockquote>

              {/* Rating */}
              <div className="flex justify-center space-x-1 mb-6">
                {renderStars(testimonials[currentIndex].rating)}
              </div>

              {/* Author info */}
              <div className="flex items-center justify-center space-x-4">
                <Image
                  src={testimonials[currentIndex].image}
                  alt={testimonials[currentIndex].name}
                  width={64}
                  height={64}
                  className="w-16 h-16 rounded-full object-cover"
                />
                <div className="text-left">
                  <div className="font-semibold text-gray-900 text-lg">
                    {testimonials[currentIndex].name}
                  </div>
                  <div className="text-gray-600">
                    {testimonials[currentIndex].position}
                  </div>
                  <div className="text-green-600 font-medium">
                    {testimonials[currentIndex].company}
                  </div>
                </div>
              </div>

              {/* Course badge */}
              <div className="mt-6">
                <span className="inline-flex items-center px-4 py-2 bg-[#201a7c]/10 text-[#201a7c] rounded-full text-sm font-medium">
                  <i className="fas fa-graduation-cap mr-2"></i>
                  {testimonials[currentIndex].course}
                </span>
              </div>
            </div>
          </div>

          {/* Navigation buttons */}
          <button
            onClick={prevTestimonial}
            className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-4 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-600 hover:text-[#201a7c] hover:shadow-xl transition-all duration-300"
          >
            <i className="fas fa-chevron-left"></i>
          </button>
          <button
            onClick={nextTestimonial}
            className="absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-4 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-600 hover:text-[#201a7c] hover:shadow-xl transition-all duration-300"
          >
            <i className="fas fa-chevron-right"></i>
          </button>

          {/* Dots indicator */}
          <div className="flex justify-center space-x-2 mt-8">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-3 h-3 rounded-full transition-colors ${
                  index === currentIndex ? 'bg-[#201a7c]' : 'bg-gray-300'
                }`}
              ></button>
            ))}
          </div>
        </div>

        {/* Testimonial grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.slice(0, 3).map((testimonial, index) => (
            <div
              key={testimonial.id}
              className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 card-hover"
            >
              <div className="flex justify-center space-x-1 mb-4">
                {renderStars(testimonial.rating)}
              </div>
              <p className="text-gray-600 mb-6 line-clamp-3">
                "{testimonial.content}"
              </p>
              <div className="flex items-center space-x-3">
                <Image
                  src={testimonial.image}
                  alt={testimonial.name}
                  width={48}
                  height={48}
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div>
                  <div className="font-semibold text-gray-900">
                    {testimonial.name}
                  </div>
                  <div className="text-sm text-gray-600">
                    {testimonial.position}
                  </div>
                  <div className="text-sm text-[#201a7c] font-medium">
                    {testimonial.company}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Trust indicators */}
        <div className="mt-16 text-center">
          <p className="text-gray-600 mb-8">Trusted by professionals from leading companies</p>
          <div className="flex flex-wrap justify-center items-center gap-8 opacity-60">
            <div className="text-2xl font-bold text-gray-700">Microsoft</div>
            <div className="text-2xl font-bold text-gray-700">Google</div>
            <div className="text-2xl font-bold text-gray-700">Amazon</div>
            <div className="text-2xl font-bold text-gray-700">Meta</div>
            <div className="text-2xl font-bold text-gray-700">Apple</div>
            <div className="text-2xl font-bold text-gray-700">Tesla</div>
          </div>
        </div>
      </div>
    </section>
  );
}
