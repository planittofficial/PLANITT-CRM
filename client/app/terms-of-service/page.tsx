import { LegalDocumentShell } from "@/components/legal/legal-document-shell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | Planitt CRM",
  description: "Terms and Conditions for PLANITT SOLUTIONS PVT LTD mobile and web applications.",
};

export default function TermsOfServicePage() {
  return (
    <LegalDocumentShell title="Terms and Conditions" lastUpdated={{ display: "May 2, 2025", iso: "2025-05-02" }}>
      <p className="text-[var(--text-soft)]">
        PLANITT SOLUTIONS PVT LTD · Effective Date: May 2, 2025
      </p>
      <p className="text-[var(--text-soft)]">Applies to: Mobile App (iOS & Android), Web Application</p>

      <section className="space-y-4" aria-labelledby="terms-acceptance">
        <h2 id="terms-acceptance" className="text-xl font-bold text-[var(--text-main)] sm:text-2xl">
          1. Acceptance of Terms
        </h2>
        <p>
          These Terms and Conditions (&quot;Terms&quot;) constitute a legally binding agreement between you and PLANITT SOLUTIONS PVT
          LTD (a company incorporated under the Companies Act, 2013 / LLP Act, 2008, with registered office at S2, Renuka
          sai mandir,Gorewada Road 440013, India). By accessing or using our platform, you confirm that you are at least 18
          years of age (or have obtained parental/guardian consent), have read and understood these Terms, and agree to be
          bound by them.
        </p>
        <p>If you do not agree to these Terms, you must immediately cease using the platform.</p>
      </section>

      <section className="space-y-4" aria-labelledby="terms-services">
        <h2 id="terms-services" className="text-xl font-bold text-[var(--text-main)] sm:text-2xl">
          2. Description of Services
        </h2>
        <p>PLANITT SOLUTIONS PVT LTD provides a multi-modal SaaS platform combining:</p>
        <ul className="list-disc space-y-2 pl-6 marker:text-[var(--text-soft)]">
          <li>
            EdTech Services — Online courses, assessments, live sessions, certificates, and learning management tools.
          </li>
          <li>
            FinTech Services — Subscription billing, payment processing, invoicing, and (where applicable) financial education
            modules.
          </li>
        </ul>
        <p>
          Services are subject to change, and we may introduce, modify, or discontinue features at our discretion, with
          reasonable notice to users.
        </p>
      </section>

      <section className="space-y-4" aria-labelledby="terms-eligibility">
        <h2 id="terms-eligibility" className="text-xl font-bold text-[var(--text-main)] sm:text-2xl">
          3. Eligibility
        </h2>
        <ul className="list-disc space-y-2 pl-6 marker:text-[var(--text-soft)]">
          <li>You must be at least 18 years old or have verifiable parental consent if between 13–17 years.</li>
          <li>You must be a resident of or accessing the platform from India.</li>
          <li>You must not be barred from receiving services under applicable Indian law.</li>
          <li>Corporate users must be duly authorised representatives of a registered Indian entity.</li>
        </ul>
      </section>

      <section className="space-y-4" aria-labelledby="terms-account">
        <h2 id="terms-account" className="text-xl font-bold text-[var(--text-main)] sm:text-2xl">
          4. Account Registration and Security
        </h2>
        <p>To access our platform, you must create an account. You agree to:</p>
        <ul className="list-disc space-y-2 pl-6 marker:text-[var(--text-soft)]">
          <li>Provide accurate, current, and complete information during registration.</li>
          <li>Maintain the confidentiality of your credentials and not share them with any third party.</li>
          <li>Immediately notify us at planitt.official@gmail.com of any unauthorised use of your account.</li>
          <li>Accept responsibility for all activities that occur under your account.</li>
        </ul>
        <p>
          PLANITT SOLUTIONS PVT LTD reserves the right to suspend or terminate accounts that violate these Terms or are used
          for fraudulent or unlawful activity.
        </p>
      </section>

      <section className="space-y-4" aria-labelledby="terms-billing">
        <h2 id="terms-billing" className="text-xl font-bold text-[var(--text-main)] sm:text-2xl">
          5. Subscription Plans and Billing
        </h2>
        <h3 className="text-lg font-semibold text-[var(--text-main)]">5.1 Subscription</h3>
        <p>
          Access to premium features requires an active subscription. Subscription plans, pricing, and features are displayed
          on our pricing page and are subject to change with 30 days&apos; prior notice to existing subscribers.
        </p>
        <h3 className="text-lg font-semibold text-[var(--text-main)]">5.2 Recurring Billing</h3>
        <p>
          By subscribing to a paid plan, you authorise us to charge your chosen payment method on a recurring basis
          (monthly/annually) via Razorpay or Stripe. You agree to keep your payment information accurate and up to date.
        </p>
        <h3 className="text-lg font-semibold text-[var(--text-main)]">5.3 Free Trial</h3>
        <p>
          Where a free trial is offered, it automatically converts to a paid subscription at the end of the trial period
          unless cancelled before the trial ends.
        </p>
        <h3 className="text-lg font-semibold text-[var(--text-main)]">5.4 Refund Policy</h3>
        <ul className="list-disc space-y-2 pl-6 marker:text-[var(--text-soft)]">
          <li>Monthly subscriptions: No refunds after the billing cycle commences.</li>
          <li>
            Annual subscriptions: Pro-rata refund for unused complete months, at our discretion, if cancellation is requested
            within 72 hours of billing.
          </li>
          <li>Course-specific purchases: Non-refundable once course content has been accessed.</li>
        </ul>
        <p>
          All refunds are subject to RBI payment gateway guidelines and may take 5–10 business days to reflect.
        </p>
        <h3 className="text-lg font-semibold text-[var(--text-main)]">5.5 Taxes</h3>
        <p>
          All prices are exclusive of GST. Applicable GST will be charged in accordance with the Goods and Services Tax Act,
          2017 and will be reflected in your invoice.
        </p>
      </section>

      <section className="space-y-4" aria-labelledby="terms-payment-processors">
        <h2 id="terms-payment-processors" className="text-xl font-bold text-[var(--text-main)] sm:text-2xl">
          6. Third-Party Payment Processors
        </h2>
        <p>
          Payment transactions on our platform are processed by Razorpay Payment Solutions Pvt. Ltd. and/or Stripe, Inc. By
          making a payment, you also agree to their respective terms of service and privacy policies. PLANITT SOLUTIONS PVT
          LTD does not store your full payment card details and is not liable for payment processor outages or errors.
        </p>
      </section>

      <section className="space-y-4" aria-labelledby="terms-ip">
        <h2 id="terms-ip" className="text-xl font-bold text-[var(--text-main)] sm:text-2xl">
          7. Intellectual Property
        </h2>
        <p>
          All content on the platform — including but not limited to courses, videos, documents, assessments, software,
          trademarks, logos, and UI design — is the exclusive property of PLANITT SOLUTIONS PVT LTD or its licensors and is
          protected under the Copyright Act, 1957, the Trade Marks Act, 1999, and other applicable intellectual property
          laws.
        </p>
        <p>
          You are granted a limited, non-exclusive, non-transferable, revocable licence to access and use the content solely
          for your personal, non-commercial educational purposes.
        </p>
        <p>
          You may not: reproduce, distribute, publicly display, reverse-engineer, or create derivative works from any
          platform content without our prior written consent.
        </p>
      </section>

      <section className="space-y-4" aria-labelledby="terms-conduct">
        <h2 id="terms-conduct" className="text-xl font-bold text-[var(--text-main)] sm:text-2xl">
          8. User Obligations and Prohibited Conduct
        </h2>
        <p>You agree not to:</p>
        <ul className="list-disc space-y-2 pl-6 marker:text-[var(--text-soft)]">
          <li>Upload or share unlawful, defamatory, obscene, or harmful content.</li>
          <li>Impersonate any person or entity or misrepresent your affiliation.</li>
          <li>Attempt to gain unauthorised access to any part of the platform or its infrastructure.</li>
          <li>Use the platform to transmit spam, malware, or phishing material.</li>
          <li>Violate any applicable Indian law, including the IT Act, 2000, PMLA, 2002, or FEMA, 1999.</li>
          <li>Engage in any conduct that disrupts or damages the platform&apos;s operation.</li>
        </ul>
        <p>
          Violation may result in immediate account suspension, legal action, and reporting to appropriate authorities.
        </p>
      </section>

      <section className="space-y-4" aria-labelledby="terms-ugc">
        <h2 id="terms-ugc" className="text-xl font-bold text-[var(--text-main)] sm:text-2xl">
          9. User-Generated Content
        </h2>
        <p>
          If you submit content (forum posts, course reviews, assignment uploads), you grant us a royalty-free, worldwide
          licence to use, display, and distribute such content on the platform. You represent that you own or have the
          necessary rights to such content and that it does not infringe any third-party rights.
        </p>
      </section>

      <section className="space-y-4" aria-labelledby="terms-disclaimers">
        <h2 id="terms-disclaimers" className="text-xl font-bold text-[var(--text-main)] sm:text-2xl">
          10. Disclaimers
        </h2>
        <p>
          The platform is provided on an &apos;as is&apos; and &apos;as available&apos; basis. While we strive for accuracy, we make no
          warranties that:
        </p>
        <ul className="list-disc space-y-2 pl-6 marker:text-[var(--text-soft)]">
          <li>The platform will be uninterrupted, error-free, or free of viruses.</li>
          <li>Course content constitutes professional financial, legal, or investment advice.</li>
          <li>Results or outcomes from using the platform will meet your specific expectations.</li>
        </ul>
        <p>
          FinTech-related content on the platform is for educational purposes only and does not constitute regulated financial
          advice under SEBI or RBI guidelines.
        </p>
      </section>

      <section className="space-y-4" aria-labelledby="terms-liability">
        <h2 id="terms-liability" className="text-xl font-bold text-[var(--text-main)] sm:text-2xl">
          11. Limitation of Liability
        </h2>
        <p>
          To the maximum extent permitted under Indian law, PLANITT SOLUTIONS PVT LTD shall not be liable for any indirect,
          incidental, consequential, special, or punitive damages arising from your use of the platform, including loss of
          data, loss of revenue, or loss of business opportunity. Our total aggregate liability for any claim shall not exceed
          the subscription fee paid by you in the 3 months preceding the event giving rise to the claim.
        </p>
      </section>

      <section className="space-y-4" aria-labelledby="terms-indemnity">
        <h2 id="terms-indemnity" className="text-xl font-bold text-[var(--text-main)] sm:text-2xl">
          12. Indemnification
        </h2>
        <p>
          You agree to indemnify, defend, and hold harmless PLANITT SOLUTIONS PVT LTD , its directors, officers, employees,
          and agents from any claims, damages, losses, liabilities, and expenses (including reasonable legal fees) arising
          out of your violation of these Terms, your use of the platform, or your infringement of any third-party rights.
        </p>
      </section>

      <section className="space-y-4" aria-labelledby="terms-termination">
        <h2 id="terms-termination" className="text-xl font-bold text-[var(--text-main)] sm:text-2xl">
          13. Termination
        </h2>
        <p>
          Either party may terminate this agreement at any time. You may delete your account via account settings. PLANITT
          SOLUTIONS PVT LTD may suspend or terminate your account immediately if you breach these Terms, engage in
          fraudulent activity, or if required by law. Upon termination, your access to the platform will cease, and data
          retention will be governed by our Privacy Policy. Pro-rata refunds for annual subscriptions may apply as
          described in Section 5.4.
        </p>
      </section>

      <section className="space-y-4" aria-labelledby="terms-law">
        <h2 id="terms-law" className="text-xl font-bold text-[var(--text-main)] sm:text-2xl">
          14. Governing Law and Dispute Resolution
        </h2>
        <p>
          These Terms shall be governed by and construed in accordance with the laws of India. Any dispute arising out of or
          in connection with these Terms shall be subject to:
        </p>
        <ul className="list-disc space-y-2 pl-6 marker:text-[var(--text-soft)]">
          <li>
            Informal Resolution — The parties shall attempt to resolve any dispute through good-faith negotiation within 30 days
            of written notice.
          </li>
          <li>
            Arbitration — If unresolved, disputes shall be referred to binding arbitration under the Arbitration and
            Conciliation Act, 1996 (as amended), with the seat of arbitration in Nagpur, Maharashtra, India. The language of
            arbitration shall be English.
          </li>
          <li>
            Jurisdiction — Courts in Nagpur, Maharashtra shall have exclusive jurisdiction for any matter not subject to
            arbitration.
          </li>
        </ul>
      </section>

      <section className="space-y-4" aria-labelledby="terms-force-majeure">
        <h2 id="terms-force-majeure" className="text-xl font-bold text-[var(--text-main)] sm:text-2xl">
          15. Force Majeure
        </h2>
        <p>
          PLANITT SOLUTIONS PVT LTD shall not be held liable for any failure or delay in performance due to causes beyond our
          reasonable control, including acts of God, government actions, internet or power failures, cyber-attacks, pandemics,
          or natural disasters.
        </p>
      </section>

      <section className="space-y-4" aria-labelledby="terms-amendments">
        <h2 id="terms-amendments" className="text-xl font-bold text-[var(--text-main)] sm:text-2xl">
          16. Amendments
        </h2>
        <p>
          We reserve the right to modify these Terms at any time. We will notify you of material changes via email or in-app
          notification at least 15 days before the updated Terms take effect. Continued use of the platform constitutes your
          acceptance of the revised Terms.
        </p>
      </section>

      <section className="space-y-4" aria-labelledby="terms-contact">
        <h2 id="terms-contact" className="text-xl font-bold text-[var(--text-main)] sm:text-2xl">
          17. Contact Us
        </h2>
        <p>For questions, complaints, or legal notices, please contact:</p>
        <p>PLANITT SOLUTIONS PVT LTD</p>
        <p>Email: planitt.official@gmail.com</p>
        <p>Address: S2, Renuka sai mandir,Gorewada Road 440013, India</p>
        <p>© 2026 PLANITT SOLUTIONS PVT LTD . All rights reserved. Jurisdiction: India.</p>
      </section>
    </LegalDocumentShell>
  );
}
