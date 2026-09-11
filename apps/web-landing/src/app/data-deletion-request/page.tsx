import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export default function DataDeletionRequestPage() {
  return (
    <main className="min-h-screen bg-white">
      <Header />

      <section className="pt-24 pb-16 bg-gradient-to-br from-[#201a7c]/5 to-[#ab3b43]/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="heading-primary text-4xl md:text-5xl text-gray-900 mb-6">
              Data Deletion Request
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              This page explains how you can request deletion of personal data
              associated with your account.
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 text-body text-gray-700">
          <div className="space-y-4">
            <h2 className="heading-secondary text-2xl font-semibold text-gray-900">
              1. Types of data you can request to delete
            </h2>
            <p>
              Depending on how you use our services, you can request deletion of
              personal data such as your profile information, contact details,
              learning history, and usage data that can be linked to your
              account.
            </p>
            <p>
              In some cases, we may need to retain certain information for legal
              or regulatory reasons, such as transaction records or information
              required to comply with applicable laws.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="heading-secondary text-2xl font-semibold text-gray-900">
              2. Request data deletion from within the app
            </h2>
            <p>
              If the app you are using includes an in-app privacy or data
              settings section, you can submit a data deletion request directly
              from there. Look for options such as "Privacy," "Data," or "Delete
              my data" in your account settings.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="heading-secondary text-2xl font-semibold text-gray-900">
              3. Request data deletion by email
            </h2>
            <p>
              You can also request deletion of your personal data by contacting
              our support team. Please send an email from the address associated
              with your account and include the subject line "Data deletion
              request."
            </p>
            <p>
              In your message, describe which data you want us to delete and, if
              applicable, which app or service you are using.
            </p>
            <p className="font-medium">
              Email: hello@eduplatform.com
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="heading-secondary text-2xl font-semibold text-gray-900">
              4. How we process data deletion requests
            </h2>
            <p>
              After we receive your request, we will verify your identity and
              review the data associated with your account. We aim to complete
              deletion of eligible data within 30 days, subject to any legal or
              contractual obligations that require us to retain certain
              information.
            </p>
            <p>
              When deletion is complete, we will confirm this via email or
              through in-app messaging where appropriate.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="heading-secondary text-2xl font-semibold text-gray-900">
              5. Contact us
            </h2>
            <p>
              If you have questions about data deletion or about how we handle
              your personal information, you can contact us at
              hello@eduplatform.com.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
