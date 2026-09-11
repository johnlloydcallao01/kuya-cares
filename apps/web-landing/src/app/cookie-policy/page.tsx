import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export default function CookiePolicyPage() {
  return (
    <main className="min-h-screen bg-white">
      <Header />

      <section className="pt-24 pb-16 bg-gradient-to-br from-[#201a7c]/5 to-[#ab3b43]/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="heading-primary text-4xl md:text-5xl text-gray-900 mb-6">
              Cookie Policy
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              This Cookie Policy explains how we use cookies and similar
              technologies when you visit our websites or use our services.
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 text-body text-gray-700">
          <div className="space-y-4">
            <h2 className="heading-secondary text-2xl font-semibold text-gray-900">
              1. What are cookies?
            </h2>
            <p>
              Cookies are small text files that are stored on your device when
              you visit a website. They are widely used to make websites work
              efficiently, remember your preferences, and provide information to
              the website owners.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="heading-secondary text-2xl font-semibold text-gray-900">
              2. Types of cookies we use
            </h2>
            <p>We may use the following types of cookies:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>
                <span className="font-medium">Essential cookies:</span> required
                for the website to function properly and to enable core
                features such as security and user authentication.
              </li>
              <li>
                <span className="font-medium">Performance and analytics
                cookies:</span> help us understand how visitors use our
                services so we can improve performance and user experience.
              </li>
              <li>
                <span className="font-medium">Preference cookies:</span> allow
                the website to remember choices you make, such as language or
                region.
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="heading-secondary text-2xl font-semibold text-gray-900">
              3. Third-party cookies
            </h2>
            <p>
              We may allow certain third parties to place cookies on your
              device for analytics, performance monitoring, or to support
              embedded content. These third parties may collect information
              about your online activities over time and across different
              websites.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="heading-secondary text-2xl font-semibold text-gray-900">
              4. Managing cookies
            </h2>
            <p>
              You can manage or disable cookies through your browser settings.
              Please note that disabling certain cookies may affect the
              functionality and performance of our services.
            </p>
            <p>
              Instructions for managing cookies are typically available in your
              browser&apos;s help or settings menu.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="heading-secondary text-2xl font-semibold text-gray-900">
              5. Changes to this Cookie Policy
            </h2>
            <p>
              We may update this Cookie Policy from time to time to reflect
              changes in our practices or legal requirements. Any updates will
              be posted on this page with an updated effective date.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="heading-secondary text-2xl font-semibold text-gray-900">
              6. Contact us
            </h2>
            <p>
              If you have questions about this Cookie Policy or our use of
              cookies, you can contact us at:
            </p>
            <p className="font-medium">
              Email: hello@eduplatform.com
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
