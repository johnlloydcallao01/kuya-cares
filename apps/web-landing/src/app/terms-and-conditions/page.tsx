import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export default function TermsAndConditionsPage() {
  return (
    <main className="min-h-screen bg-white">
      <Header />

      <section className="pt-24 pb-16 bg-gradient-to-br from-[#201a7c]/5 to-[#ab3b43]/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="heading-primary text-4xl md:text-5xl text-gray-900 mb-6">
              Terms and Conditions
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              These Terms and Conditions govern your access to and use of our
              websites, mobile applications, and related services.
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 text-body text-gray-700">
          <div className="space-y-4">
            <h2 className="heading-secondary text-2xl font-semibold text-gray-900">
              1. Acceptance of terms
            </h2>
            <p>
              By creating an account, accessing, or using our services, you
              agree to be bound by these Terms and Conditions and our Privacy
              Policy. If you do not agree, you must not use our services.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="heading-secondary text-2xl font-semibold text-gray-900">
              2. Eligibility
            </h2>
            <p>
              You must be legally capable of entering into a binding agreement
              under the laws of your jurisdiction to use our services. By using
              the services, you represent and warrant that you meet this
              requirement.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="heading-secondary text-2xl font-semibold text-gray-900">
              3. Accounts and security
            </h2>
            <p>
              You are responsible for maintaining the confidentiality of your
              account credentials and for all activities that occur under your
              account. You agree to notify us promptly of any unauthorized use
              or suspected breach of security.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="heading-secondary text-2xl font-semibold text-gray-900">
              4. Use of services
            </h2>
            <p>
              You agree to use our services only for lawful purposes and in
              accordance with these Terms. You must not misuse the services,
              interfere with their operation, or attempt to access them using
              methods other than those we provide.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="heading-secondary text-2xl font-semibold text-gray-900">
              5. Payments and subscriptions
            </h2>
            <p>
              Certain features or content may be offered on a paid basis. When
              you make a purchase or subscribe, you authorize us and our payment
              providers to charge the applicable fees and taxes using your
              selected payment method.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="heading-secondary text-2xl font-semibold text-gray-900">
              6. Intellectual property
            </h2>
            <p>
              All content, trademarks, logos, and other materials displayed
              through the services are owned by us or our licensors and are
              protected by intellectual property laws. You may not copy,
              modify, distribute, or create derivative works without prior
              written permission.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="heading-secondary text-2xl font-semibold text-gray-900">
              7. Limitation of liability
            </h2>
            <p>
              To the maximum extent permitted by law, we are not liable for any
              indirect, incidental, consequential, or punitive damages arising
              out of or related to your use of the services.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="heading-secondary text-2xl font-semibold text-gray-900">
              8. Changes to these Terms
            </h2>
            <p>
              We may update these Terms from time to time. When we make
              material changes, we will notify you by updating the date at the
              top of this page or through other appropriate channels. Your
              continued use of the services after changes take effect
              constitutes acceptance of the updated Terms.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="heading-secondary text-2xl font-semibold text-gray-900">
              9. Contact us
            </h2>
            <p>
              If you have questions about these Terms and Conditions, you can
              contact us at:
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
