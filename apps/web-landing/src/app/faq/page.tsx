"use client";

import { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export default function FAQPage() {
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const faqCategories = [
    {
      title: "Getting Started",
      icon: "fas fa-rocket",
      faqs: [
        {
          question: "How do I create an account?",
          answer: "Creating an account is simple! Click the 'Get Started' button on our homepage, fill in your basic information, and verify your email address. You'll have immediate access to our free courses and a 14-day trial of premium content."
        },
        {
          question: "What's included in the free trial?",
          answer: "Our 14-day free trial includes full access to all premium courses, interactive labs, assessments, certificates, and 24/7 support. No credit card required to start your trial."
        },
        {
          question: "How do I choose the right course?",
          answer: "Use our skill assessment tool to identify your current level, browse courses by category or skill level, read course descriptions and reviews, and check the learning outcomes. Our AI-powered recommendation engine can also suggest courses based on your goals."
        },
        {
          question: "Can I switch between courses?",
          answer: "Absolutely! You can enroll in multiple courses simultaneously and switch between them at any time. Your progress is automatically saved, so you can pick up exactly where you left off."
        }
      ]
    },
    {
      title: "Courses & Content",
      icon: "fas fa-book-open",
      faqs: [
        {
          question: "How often is content updated?",
          answer: "We update our content regularly to ensure it stays current with industry trends. Major updates happen quarterly, with minor updates and new content added monthly. You'll always have access to the latest version of any course you're enrolled in."
        },
        {
          question: "Are the certificates recognized by employers?",
          answer: "Yes! Our certificates are industry-recognized and accepted by leading companies worldwide. They include verification codes and are backed by our partnerships with major technology companies and educational institutions."
        },
        {
          question: "Can I download course materials?",
          answer: "Premium subscribers can download most course materials including PDFs, code samples, and project files for offline access. Video content is available for offline viewing through our mobile app."
        },
        {
          question: "Do you offer hands-on projects?",
          answer: "Every course includes practical, hands-on projects that simulate real-world scenarios. You'll build a portfolio of work that demonstrates your skills to potential employers."
        }
      ]
    },
    {
      title: "Pricing & Billing",
      icon: "fas fa-credit-card",
      faqs: [
        {
          question: "What payment methods do you accept?",
          answer: "We accept all major credit cards (Visa, MasterCard, American Express), PayPal, and bank transfers for enterprise accounts. All payments are processed securely through industry-standard encryption."
        },
        {
          question: "Can I cancel my subscription anytime?",
          answer: "Yes, you can cancel your subscription at any time with no cancellation fees. You'll continue to have access to your courses until the end of your current billing period."
        },
        {
          question: "Do you offer refunds?",
          answer: "We offer a 30-day money-back guarantee for all subscriptions. If you're not satisfied with your learning experience, contact our support team for a full refund."
        },
        {
          question: "Are there discounts for students or teams?",
          answer: "Yes! We offer 50% discounts for students with valid .edu email addresses and volume discounts for teams of 5 or more. Contact our sales team for enterprise pricing."
        }
      ]
    },
    {
      title: "Technical Support",
      icon: "fas fa-headset",
      faqs: [
        {
          question: "What browsers are supported?",
          answer: "Our platform works on all modern browsers including Chrome, Firefox, Safari, and Edge. We recommend using the latest version for the best experience. Our mobile app is available for iOS and Android."
        },
        {
          question: "I'm having trouble accessing my course. What should I do?",
          answer: "First, try refreshing your browser and clearing your cache. If the issue persists, check our status page for any ongoing issues, or contact our 24/7 support team through live chat or email."
        },
        {
          question: "Can I access courses on mobile devices?",
          answer: "Yes! Our platform is fully responsive and works great on mobile devices. We also have dedicated mobile apps for iOS and Android with offline viewing capabilities."
        },
        {
          question: "How do I reset my password?",
          answer: "Click the 'Forgot Password' link on the login page, enter your email address, and we'll send you a secure reset link. The link expires after 24 hours for security purposes."
        }
      ]
    },
    {
      title: "Enterprise & Teams",
      icon: "fas fa-building",
      faqs: [
        {
          question: "Do you offer custom content creation?",
          answer: "Yes! We work with enterprise clients to create custom courses tailored to their specific needs, industry requirements, and company culture. Our instructional design team can develop content from scratch or adapt existing materials."
        },
        {
          question: "How does team management work?",
          answer: "Enterprise accounts include a comprehensive admin dashboard where you can invite team members, assign courses, track progress, generate reports, and manage billing. You can also set up learning paths and deadlines."
        },
        {
          question: "Can we integrate with our existing LMS?",
          answer: "Yes, we offer API integrations and support popular LMS platforms including Moodle, Canvas, and Blackboard. We can also provide SCORM-compliant packages for seamless integration."
        },
        {
          question: "What analytics and reporting do you provide?",
          answer: "Enterprise accounts include detailed analytics on learner progress, completion rates, assessment scores, time spent learning, and skill development. Reports can be exported in various formats and scheduled for automatic delivery."
        }
      ]
    }
  ];

  const toggleFAQ = (categoryIndex: number, faqIndex: number) => {
    const uniqueIndex = categoryIndex * 1000 + faqIndex;
    setOpenFAQ(openFAQ === uniqueIndex ? null : uniqueIndex);
  };

  const filteredCategories = faqCategories.map(category => ({
    ...category,
    faqs: category.faqs.filter(faq =>
      faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })).filter(category => category.faqs.length > 0);

  return (
    <main className="min-h-screen">
      <Header />
      
      {/* Hero Section */}
      <section className="pt-24 pb-16 bg-gradient-to-br from-[#201a7c]/5 to-[#ab3b43]/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="heading-primary text-4xl md:text-6xl text-gray-900 mb-6">
              Frequently Asked <span className="text-[#201a7c]">Questions</span>
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
              Find answers to common questions about our platform, courses, and services. 
              Can't find what you're looking for? Contact our support team.
            </p>
            
            {/* Search Bar */}
            <div className="max-w-2xl mx-auto">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search for answers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-6 py-4 pl-12 text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#201a7c] focus:border-transparent shadow-lg"
                />
                <i className="fas fa-search absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Content */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {filteredCategories.length === 0 ? (
            <div className="text-center py-12">
              <i className="fas fa-search text-6xl text-gray-300 mb-4"></i>
              <h3 className="text-2xl font-semibold text-gray-900 mb-2">No results found</h3>
              <p className="text-gray-600 mb-6">
                We couldn't find any FAQs matching your search. Try different keywords or browse our categories below.
              </p>
              <button
                onClick={() => setSearchTerm("")}
                className="btn-primary"
              >
                Clear Search
              </button>
            </div>
          ) : (
            <div className="space-y-12">
              {filteredCategories.map((category, categoryIndex) => (
                <div key={categoryIndex}>
                  <div className="flex items-center mb-8">
                    <div className="w-12 h-12 bg-[#201a7c]/10 rounded-xl flex items-center justify-center mr-4">
                      <i className={`${category.icon} text-[#201a7c] text-lg`}></i>
                    </div>
                    <h2 className="heading-secondary text-2xl font-bold text-gray-900">
                      {category.title}
                    </h2>
                  </div>
                  
                  <div className="space-y-4">
                    {category.faqs.map((faq, faqIndex) => {
                      const uniqueIndex = categoryIndex * 1000 + faqIndex;
                      const isOpen = openFAQ === uniqueIndex;
                      
                      return (
                        <div
                          key={faqIndex}
                          className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden"
                        >
                          <button
                            onClick={() => toggleFAQ(categoryIndex, faqIndex)}
                            className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                          >
                            <h3 className="font-semibold text-gray-900 pr-4">
                              {faq.question}
                            </h3>
                            <i className={`fas fa-chevron-${isOpen ? 'up' : 'down'} text-gray-400 flex-shrink-0 transition-transform`}></i>
                          </button>
                          
                          {isOpen && (
                            <div className="px-6 pb-4">
                              <div className="border-t border-gray-100 pt-4">
                                <p className="text-gray-600 leading-relaxed">
                                  {faq.answer}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Contact Support */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="heading-primary text-3xl md:text-4xl text-gray-900 mb-4">
            Still Have Questions?
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Our support team is here to help you 24/7. Get in touch and we'll respond within 2 hours.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <i className="fas fa-comments text-3xl text-[#201a7c] mb-4"></i>
              <h3 className="font-semibold text-gray-900 mb-2">Live Chat</h3>
              <p className="text-gray-600 text-sm mb-4">Get instant help from our support team</p>
              <button className="text-[#201a7c] hover:text-[#1a1569] font-medium">
                Start Chat →
              </button>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm">
              <i className="fas fa-envelope text-3xl text-[#ab3b43] mb-4"></i>
              <h3 className="font-semibold text-gray-900 mb-2">Email Support</h3>
              <p className="text-gray-600 text-sm mb-4">Send us a detailed message</p>
              <button className="text-[#ab3b43] hover:text-[#8f2f36] font-medium">
                Send Email →
              </button>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm">
              <i className="fas fa-phone text-3xl text-[#201a7c] mb-4"></i>
              <h3 className="font-semibold text-gray-900 mb-2">Phone Support</h3>
              <p className="text-gray-600 text-sm mb-4">Speak directly with our team</p>
              <button className="text-[#201a7c] hover:text-[#1a1569] font-medium">
                Call Now →
              </button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
