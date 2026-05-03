import { LegalDocumentShell } from "@/components/legal/legal-document-shell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Planitt CRM",
  description: "Privacy Policy for PLANITT SOLUTIONS PVT LTD mobile and web applications.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalDocumentShell title="Privacy Policy" lastUpdated={{ display: "May 2, 2026", iso: "2026-05-02" }}>
      <p className="text-[var(--text-soft)]">
        PLANITT SOLUTIONS PVT LTD · Effective Date: May 2, 2026
      </p>
      <p className="text-[var(--text-soft)]">Applies to: Mobile App (iOS & Android), Web Application</p>

      <section className="space-y-4" aria-labelledby="privacy-intro">
        <h2 id="privacy-intro" className="text-xl font-bold text-[var(--text-main)] sm:text-2xl">
          1. Introduction
        </h2>
        <p>
          PLANITT SOLUTIONS PVT LTD (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) is a company incorporated under the laws of India,
          operating a SaaS-based EdTech and FinTech platform accessible via web and mobile applications. We are committed
          to protecting the privacy and security of the personal data of our users (&quot;you&quot;, &quot;user&quot;) in accordance with the
          Information Technology Act, 2000 (&quot;IT Act&quot;), the IT (Reasonable Security Practices and Procedures and Sensitive
          Personal Data or Information) Rules, 2011 (&quot;SPDI Rules&quot;), and the Digital Personal Data Protection Act, 2023
          (&quot;DPDP Act&quot;).
        </p>
        <p>
          This Privacy Policy explains how we collect, use, store, share, and protect your personal data. By accessing or
          using our platform, you consent to the practices described herein.
        </p>
      </section>

      <section className="space-y-4" aria-labelledby="privacy-collect">
        <h2 id="privacy-collect" className="text-xl font-bold text-[var(--text-main)] sm:text-2xl">
          2. Information We Collect
        </h2>
        <h3 className="text-lg font-semibold text-[var(--text-main)]">2.1 Personal Information You Provide</h3>
        <ul className="list-disc space-y-2 pl-6 marker:text-[var(--text-soft)]">
          <li>Full name</li>
          <li>Email address</li>
          <li>Mobile phone number</li>
          <li>Billing and payment information (processed via Razorpay / Stripe)</li>
          <li>Geographic location (when you grant permission)</li>
          <li>Account credentials (username, password — stored in hashed form)</li>
        </ul>
        <h3 className="text-lg font-semibold text-[var(--text-main)]">2.2 Information Collected Automatically</h3>
        <ul className="list-disc space-y-2 pl-6 marker:text-[var(--text-soft)]">
          <li>Device information (model, OS version, unique device identifiers)</li>
          <li>IP address and approximate location derived from it</li>
          <li>Browser type, version, and settings</li>
          <li>App usage data, clickstream data, session duration</li>
          <li>Cookies and similar tracking technologies</li>
        </ul>
        <h3 className="text-lg font-semibold text-[var(--text-main)]">2.3 Information from Third Parties</h3>
        <ul className="list-disc space-y-2 pl-6 marker:text-[var(--text-soft)]">
          <li>Authentication data when you sign in via Google OAuth</li>
          <li>Payment status, transaction IDs, and related metadata from Razorpay / Stripe</li>
          <li>Analytics and crash-reporting data from integrated SDKs</li>
        </ul>
      </section>

      <section className="space-y-4" aria-labelledby="privacy-purpose">
        <h2 id="privacy-purpose" className="text-xl font-bold text-[var(--text-main)] sm:text-2xl">
          3. Purpose of Data Collection
        </h2>
        <p>We collect and process your personal data for the following purposes:</p>
        <ul className="list-disc space-y-2 pl-6 marker:text-[var(--text-soft)]">
          <li>Account Management: Account creation, identity verification, and authentication</li>
          <li>
            Education Services: Providing access to course content, assessments, and personalised learning paths
          </li>
          <li>Payments &amp; Subscriptions: Processing subscription fees, managing recurring billing, and issuing invoices</li>
          <li>Communications: Delivering platform notifications, course updates, and transactional messages</li>
          <li>
            Analytics &amp; Improvement: Improving app performance, personalising user experience, and conducting A/B tests
          </li>
          <li>
            Legal Compliance: Complying with the IT Act, DPDP Act, RBI guidelines, and other applicable Indian laws
          </li>
          <li>Security: Detecting fraud, unauthorised access, and security threats</li>
        </ul>
      </section>

      <section className="space-y-4" aria-labelledby="privacy-legal-basis">
        <h2 id="privacy-legal-basis" className="text-xl font-bold text-[var(--text-main)] sm:text-2xl">
          4. Legal Basis for Processing
        </h2>
        <p>Under the DPDP Act, 2023, we process your personal data on the following lawful bases:</p>
        <ul className="list-disc space-y-2 pl-6 marker:text-[var(--text-soft)]">
          <li>
            Consent — You have provided explicit consent at the time of registration or when granting location/payment
            permissions.
          </li>
          <li>Contractual Necessity — Processing is necessary to fulfil our subscription and service agreement with you.</li>
          <li>Legitimate Interests — For analytics, security monitoring, and platform improvement.</li>
          <li>Legal Obligation — To comply with applicable Indian laws, RBI directions, and court orders.</li>
        </ul>
      </section>

      <section className="space-y-4" aria-labelledby="privacy-spdi">
        <h2 id="privacy-spdi" className="text-xl font-bold text-[var(--text-main)] sm:text-2xl">
          5. Sensitive Personal Data or Information (SPDI)
        </h2>
        <p>
          Under the SPDI Rules, payment information constitutes Sensitive Personal Data. We apply the following additional
          safeguards:
        </p>
        <ul className="list-disc space-y-2 pl-6 marker:text-[var(--text-soft)]">
          <li>
            Payment card details are never stored on our servers; they are tokenised and processed exclusively through
            PCI-DSS-compliant gateways (Razorpay / Stripe).
          </li>
          <li>You will be asked for separate, explicit consent before we collect or process any SPDI.</li>
          <li>You have the right to withdraw your consent to SPDI processing at any time.</li>
        </ul>
      </section>

      <section className="space-y-4" aria-labelledby="privacy-third-party">
        <h2 id="privacy-third-party" className="text-xl font-bold text-[var(--text-main)] sm:text-2xl">
          6. Third-Party Sharing and Disclosure
        </h2>
        <p>We do not sell or rent your personal data. We may share your data with:</p>
        <ul className="list-disc space-y-2 pl-6 marker:text-[var(--text-soft)]">
          <li>Razorpay / Stripe — for payment processing and recurring subscription management</li>
          <li>Google LLC — for OAuth authentication and analytics (subject to Google&apos;s Privacy Policy)</li>
          <li>Cloud infrastructure providers — for secure data hosting (data stored within India where required by law)</li>
          <li>
            Law enforcement or regulatory authorities — when required by a court order, SEBI, RBI, or other competent
            authority
          </li>
          <li>Successor entities — in the event of a merger, acquisition, or asset sale (you will be notified)</li>
        </ul>
        <p>
          All third-party processors are contractually bound to handle your data in accordance with applicable Indian law
          and equivalent data protection standards.
        </p>
      </section>

      <section className="space-y-4" aria-labelledby="privacy-retention">
        <h2 id="privacy-retention" className="text-xl font-bold text-[var(--text-main)] sm:text-2xl">
          7. Data Retention
        </h2>
        <p>We retain your personal data only as long as necessary for the purposes stated above or as required by law:</p>
        <ul className="list-disc space-y-2 pl-6 marker:text-[var(--text-soft)]">
          <li>Account and profile data — for the duration of your account, plus 5 years post-closure</li>
          <li>Payment records and transaction logs — 8 years (as mandated by RBI and Indian tax law)</li>
          <li>Usage and analytics data — 2 years in anonymised form</li>
          <li>Location data — session-only, not stored persistently unless you opt in</li>
        </ul>
      </section>

      <section className="space-y-4" aria-labelledby="privacy-rights">
        <h2 id="privacy-rights" className="text-xl font-bold text-[var(--text-main)] sm:text-2xl">
          8. Your Rights Under the DPDP Act, 2023
        </h2>
        <p>
          As a Data Principal, you have the following rights, exercisable by contacting us at planitt.official@gmail.com:
        </p>
        <ul className="list-disc space-y-2 pl-6 marker:text-[var(--text-soft)]">
          <li>Right to Access — Obtain a summary of the personal data we hold about you.</li>
          <li>Right to Correction — Request correction of inaccurate or incomplete data.</li>
          <li>Right to Erasure — Request deletion of your data, subject to legal retention obligations.</li>
          <li>
            Right to Grievance Redressal — Lodge a complaint with our Data Protection Officer (DPO) and escalate to the Data
            Protection Board of India.
          </li>
          <li>
            Right to Nominate — Nominate another individual to exercise rights on your behalf in case of death or
            incapacity.
          </li>
        </ul>
        <p>We will respond to all valid requests within 30 days.</p>
      </section>

      <section className="space-y-4" aria-labelledby="privacy-cookies">
        <h2 id="privacy-cookies" className="text-xl font-bold text-[var(--text-main)] sm:text-2xl">
          9. Cookies and Tracking Technologies
        </h2>
        <p>
          We use cookies, web beacons, and similar technologies on our web application. You can manage your cookie preferences
          through your browser settings. Disabling cookies may affect the functionality of certain features.
        </p>
        <ul className="list-disc space-y-2 pl-6 marker:text-[var(--text-soft)]">
          <li>Essential Cookies — Required for login sessions and security.</li>
          <li>Analytics Cookies — Help us understand usage patterns (can be opted out).</li>
          <li>Payment Cookies — Set by Razorpay / Stripe for secure transaction processing.</li>
        </ul>
      </section>

      <section className="space-y-4" aria-labelledby="privacy-security">
        <h2 id="privacy-security" className="text-xl font-bold text-[var(--text-main)] sm:text-2xl">
          10. Security
        </h2>
        <p>
          We implement industry-standard security measures including TLS 1.2+ encryption for data in transit, AES-256
          encryption for data at rest, role-based access controls, regular vulnerability assessments, and security audit
          logging. In the event of a data breach, we will notify affected users and the relevant authority as required by the
          DPDP Act.
        </p>
      </section>

      <section className="space-y-4" aria-labelledby="privacy-children">
        <h2 id="privacy-children" className="text-xl font-bold text-[var(--text-main)] sm:text-2xl">
          11. Children&apos;s Privacy
        </h2>
        <p>
          Our platform may be accessed by students. Where a user is below the age of 18, we require verifiable parental or
          guardian consent before collecting or processing their personal data, in compliance with the DPDP Act, 2023. We do
          not knowingly collect personal data from children under 13.
        </p>
      </section>

      <section className="space-y-4" aria-labelledby="privacy-changes">
        <h2 id="privacy-changes" className="text-xl font-bold text-[var(--text-main)] sm:text-2xl">
          12. Changes to This Policy
        </h2>
        <p>
          We may update this Privacy Policy periodically. We will notify you of material changes via email or in-app
          notification at least 15 days prior to the change taking effect. Continued use of the platform after such notice
          constitutes your acceptance of the revised policy.
        </p>
      </section>

      <section className="space-y-4" aria-labelledby="privacy-grievance">
        <h2 id="privacy-grievance" className="text-xl font-bold text-[var(--text-main)] sm:text-2xl">
          13. Grievance Officer
        </h2>
        <p>In accordance with the IT Act, 2000 and DPDP Act, 2023, we have designated a Grievance Officer:</p>
        <p>Name: [Grievance Officer Name]</p>
        <p>Email: planitt.official@gmail.com</p>
        <p>Address: S2, Renuka sai mandir,Gorewada Road 440013, India</p>
        <p>
          You may submit your grievance in writing; we will acknowledge it within 48 hours and resolve it within 30 days.
        </p>
      </section>
    </LegalDocumentShell>
  );
}
