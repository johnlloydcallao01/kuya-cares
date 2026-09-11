import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export default function AccountDeletionRequestPage() {
  return (
    <main className="min-h-screen bg-white">
      <Header />

      <section className="pt-24 pb-16 bg-gradient-to-br from-[#201a7c]/5 to-[#ab3b43]/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="heading-primary text-4xl md:text-5xl text-gray-900 mb-6">
              Account Deletion
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              This page explains how you can permanently delete your account and
              what happens to your data when you do so.
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 text-body text-gray-700">
          <div className="space-y-4">
            <h2 className="heading-secondary text-2xl font-semibold text-gray-900">
              1. Delete your account from within the app
            </h2>
            <p>
              If you have an account in our mobile or web applications, you can
              request deletion directly from within the app. In most cases, you
              can follow these steps:
            </p>
            <ol className="list-decimal list-inside space-y-2">
              <li>Open the app and sign in to your account.</li>
              <li>Go to the profile or account section.</li>
              <li>Select account settings or privacy settings.</li>
              <li>Choose the option to delete or close your account.</li>
              <li>Follow the on-screen instructions to confirm deletion.</li>
            </ol>
            <p>
              If you cannot find the delete option in your version of the app,
              you can still request deletion by contacting us directly.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="heading-secondary text-2xl font-semibold text-gray-900">
              2. Request account deletion by email
            </h2>
            <p>
              You can also request that your account be deleted by sending an
              email from the address associated with your account. Please
              include the subject line "Account deletion request" and provide
              enough information for us to locate your account.
            </p>
            <p className="font-medium">
              Email: hello@eduplatform.com
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="heading-secondary text-2xl font-semibold text-gray-900">
              3. What happens when your account is deleted
            </h2>
            <p>
              When your account is deleted, we remove or anonymize personally
              identifiable information associated with your profile, including
              your name, email address, and login details, except where we are
              required to retain certain information for legal, regulatory, or
              security reasons.
            </p>
            <p>
              Some aggregated or anonymized data that does not identify you
              personally may be retained for analytics, reporting, and service
              improvement purposes.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="heading-secondary text-2xl font-semibold text-gray-900">
              4. How long account deletion takes
            </h2>
            <p>
              We aim to process account deletion requests as quickly as
              possible. In most cases, your request will be processed within 30
              days. In some situations, such as when we must retain data to
              comply with legal obligations, processing may take longer, but we
              will inform you if this is the case.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="heading-secondary text-2xl font-semibold text-gray-900">
              5. Contact us
            </h2>
            <p>
              If you have any questions about deleting your account or need
              assistance with a request, please contact our support team at
              hello@eduplatform.com.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
