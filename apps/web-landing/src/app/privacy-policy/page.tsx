import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-white">
      <Header />

      <section className="pt-24 pb-16 bg-gradient-to-br from-[#201a7c]/5 to-[#ab3b43]/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="heading-primary text-4xl md:text-5xl text-gray-900 mb-6">
              Privacy Policy
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Your privacy is important to us. This page explains what data we
              collect, how we use it, and the choices you have.
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 text-body text-gray-700">
          <div className="space-y-4">
            <h2 className="heading-secondary text-2xl font-semibold text-gray-900">
              1. Information we collect
            </h2>
            <p>
              When you use our websites and mobile applications, we may collect
              information that you provide directly to us, such as your name,
              email address, account credentials, and any details you choose to
              share when contacting support.
            </p>
            <p>
              We may also collect technical information automatically, including
              device information, log data, and usage information such as the
              pages you visit and actions you take within the app. This helps us
              operate, maintain, and improve our services.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="heading-secondary text-2xl font-semibold text-gray-900">
              2. How we use your information
            </h2>
            <p>We use your information to:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>Provide and maintain our services and your account</li>
              <li>Process transactions and send you service-related messages</li>
              <li>Personalize your experience and improve our products</li>
              <li>
                Communicate with you about updates, security alerts, and support
                messages
              </li>
              <li>
                Comply with legal obligations and enforce our terms and policies
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="heading-secondary text-2xl font-semibold text-gray-900">
              3. Data sharing and third parties
            </h2>
            <p>
              We do not sell your personal data. We may share your information
              with trusted service providers who help us operate our
              infrastructure, process payments, provide analytics, or deliver
              customer support. These providers are only allowed to use your
              data as needed to perform services on our behalf.
            </p>
            <p>
              We may also disclose information if required by law, to protect
              our rights, or in connection with a business transaction such as a
              merger or acquisition.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="heading-secondary text-2xl font-semibold text-gray-900">
              4. Data retention and security
            </h2>
            <p>
              We retain your personal data only for as long as necessary to
              provide our services, comply with legal obligations, resolve
              disputes, and enforce our agreements. We use technical and
              organizational measures designed to protect your information
              against unauthorized access, loss, or misuse.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="heading-secondary text-2xl font-semibold text-gray-900">
              5. Your rights and choices
            </h2>
            <p>
              Depending on your location, you may have rights over your personal
              data, including the right to access, correct, delete, or restrict
              certain uses of your information. You may also have the right to
              object to certain processing and to withdraw consent where
              processing is based on consent.
            </p>
            <p>
              To exercise these rights or request more information, you can
              contact us using the details provided below.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="heading-secondary text-2xl font-semibold text-gray-900">
              6. Contact us
            </h2>
            <p>
              If you have any questions about this Privacy Policy or how we
              handle your data, please contact us at:
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
