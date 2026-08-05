import React from 'react';
import { FiDatabase, FiEye, FiShare2, FiCircle, FiUserCheck, FiMail, FiShield } from 'react-icons/fi';
import Header from '../components/Header';
import Footer from '../components/Footer';

const sections = [
  {
    icon: <FiDatabase size={20} />,
    title: '1. What Data We Collect',
    content: 'We collect the following types of information when you use OptiKart:',
    items: [
      'Personal Information: Name, email address, phone number, delivery address, and date of birth.',
      'Account Information: Login credentials, profile preferences, and purchase history.',
      'Prescription Data: Eye prescription details uploaded for prescription eyewear orders.',
      'Payment Information: Payment method type and transaction IDs (card numbers are tokenized and not stored).',
      'Device Information: IP address, browser type, device type, and operating system.',
      'Usage Data: Pages visited, products viewed, search queries, and time spent on the platform.',
      'Communication Data: Records of customer support interactions, emails, and chat messages.',
    ],
  },
  {
    icon: <FiEye size={20} />,
    title: '2. How We Use Your Data',
    content: 'We use your data for the following purposes:',
    items: [
      'To process and fulfill your orders, including prescription verification and lens manufacturing.',
      'To provide customer support and respond to your inquiries.',
      'To personalize your shopping experience with relevant product recommendations.',
      'To send order confirmations, shipping updates, and delivery notifications.',
      'To send promotional offers and newsletters (with your consent, which you can withdraw anytime).',
      'To improve our platform, products, and services based on usage analytics.',
      'To comply with legal obligations and prevent fraud.',
    ],
  },
  {
    icon: <FiShare2 size={20} />,
    title: '3. Data Sharing Policies',
    content: 'We share your data only in the following circumstances:',
    items: [
      'Delivery Partners: We share your name, address, and phone number with Shiprocket and other logistics partners for order delivery.',
      'Payment Processors: Transaction details are shared with Razorpay for payment processing.',
      'Lab Partners: Prescription details are shared with our lens manufacturing partners to create your eyewear.',
      'Legal Compliance: We may disclose data when required by law, court order, or government authority.',
      'Business Transfers: In case of merger, acquisition, or asset sale, your data may be transferred to the acquiring entity.',
      'We never sell your personal data to third parties for advertising or marketing purposes.',
    ],
  },
  {
    icon: <FiCircle size={20} />,
    title: '4. Cookie Policy',
    content: 'OptiKart uses cookies and similar tracking technologies to enhance your experience:',
    items: [
      'Essential Cookies: Required for the platform to function (login sessions, cart, security).',
      'Analytics Cookies: Help us understand how users interact with our platform (Google Analytics).',
      'Preference Cookies: Remember your preferences like language, location, and browsing settings.',
      'Marketing Cookies: Used to show relevant advertisements (only with your consent).',
      'You can manage cookie preferences through your browser settings. Disabling essential cookies may affect platform functionality.',
      'We do not use cookies to track your activity on other websites.',
    ],
  },
  {
    icon: <FiUserCheck size={20} />,
    title: '5. Your Rights',
    content: 'As a user, you have the following rights regarding your personal data:',
    items: [
      'Right to Access: Request a copy of all personal data we hold about you.',
      'Right to Correction: Request correction of inaccurate or incomplete personal data.',
      'Right to Deletion: Request deletion of your personal data (subject to legal retention requirements).',
      'Right to Portability: Request your data in a structured, machine-readable format.',
      'Right to Withdraw Consent: Withdraw consent for data processing at any time.',
      'Right to Opt-Out: Unsubscribe from marketing communications at any time via the unsubscribe link.',
      'Right to Lodge Complaint: File a complaint with the Data Protection Authority if you believe your rights are violated.',
    ],
  },
  {
    icon: <FiShield size={20} />,
    title: '6. Data Retention',
    content: 'We retain your data for the following periods:',
    items: [
      'Account data: Retained for the duration of your account plus 3 years after deletion request.',
      'Order history: Retained for 7 years as per tax and accounting requirements.',
      'Prescription data: Retained for 2 years or until you request deletion.',
      'Marketing preferences: Retained until you update or withdraw consent.',
      'Analytics data: Aggregated and anonymized data may be retained indefinitely.',
    ],
  },
  {
    icon: <FiMail size={20} />,
    title: '7. Contact for Privacy Concerns',
    content: 'If you have any questions, concerns, or requests regarding your personal data or this Privacy Policy, please contact our Data Protection Officer:',
    items: [
      'Email: privacy@optikart.com',
      'Phone: 1800-123-4567 (Mon-Sat, 9am-9pm)',
      'Address: Data Protection Officer, OptiKart Technologies Pvt. Ltd., 4th Floor, Prestige Tower, Indiranagar, Bangalore - 560038',
      'We will respond to all privacy-related requests within 30 days of receipt.',
    ],
  },
];

const PrivacyPolicy = () => {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>Privacy Policy</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-light)', marginBottom: '8px' }}>Last updated: June 1, 2026</p>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '32px', lineHeight: 1.7 }}>
            At OptiKart, we respect your privacy and are committed to protecting your personal data. This Privacy Policy explains how we collect, use, store, and protect your information when you use our platform.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
            {sections.map((section, idx) => (
              <div key={idx} className="card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ color: 'var(--primary)' }}>{section.icon}</div>
                  <h2 style={{ fontSize: '17px', fontWeight: 600 }}>{section.title}</h2>
                </div>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: section.items ? '12px' : 0 }}>{section.content}</p>
                {section.items && (
                  <ul style={{ paddingLeft: '20px', listStyle: 'disc', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 2 }}>
                    {section.items.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
