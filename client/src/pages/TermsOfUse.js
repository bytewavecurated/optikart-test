import React from 'react';
import { FiFileText, FiShield, FiUsers, FiAlertTriangle, FiBookOpen, FiGlobe } from 'react-icons/fi';
import Header from '../components/Header';
import Footer from '../components/Footer';

const sections = [
  {
    title: '1. Acceptance of Terms',
    content: 'By accessing or using OptiKart.com ("the Platform"), you agree to be bound by these Terms of Use and all applicable laws and regulations. If you do not agree with any part of these terms, you must not use our platform. These terms apply to all users, including buyers, sellers, and visitors.',
  },
  {
    title: '2. User Agreement',
    content: 'You must be at least 18 years old to use OptiKart. By creating an account, you confirm that all information provided is accurate and complete. You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account. You agree not to use the platform for any unlawful purpose or in any way that could damage, disable, or impair the platform.',
  },
  {
    title: '3. Account Responsibilities',
    content: 'You are responsible for safeguarding your password and account access. You agree to notify OptiKart immediately of any unauthorized use of your account. OptiKart reserves the right to suspend or terminate accounts that violate these terms, contain false information, or are used for fraudulent activities.',
  },
  {
    title: '4. Seller Terms',
    content: 'Sellers on OptiKart must register with valid business credentials and comply with all applicable laws. Sellers are responsible for product quality, accurate descriptions, timely shipping, and customer service. OptiKart reserves the right to suspend or remove sellers who violate platform policies, receive excessive complaints, or engage in fraudulent activities. A commission fee is charged on each successful sale as per the agreed seller agreement.',
  },
  {
    title: '5. Product Listings & Pricing',
    content: 'All product listings are created by sellers and OptiKart makes reasonable efforts to ensure accuracy. However, we do not guarantee that product descriptions, images, or prices are completely accurate, complete, or error-free. Prices are subject to change without prior notice. In case of pricing errors, we reserve the right to cancel orders and issue refunds.',
  },
  {
    title: '6. Intellectual Property',
    content: 'All content on OptiKart, including text, graphics, logos, icons, images, and software, is the property of OptiKart Technologies Pvt. Ltd. or its licensors and is protected by Indian and international copyright, trademark, and intellectual property laws. You may not reproduce, distribute, modify, or create derivative works without our express written permission.',
  },
  {
    title: '7. Prohibited Activities',
    content: 'Users are prohibited from: (a) uploading false or misleading content; (b) attempting to gain unauthorized access to our systems; (c) using automated tools to access or scrape the platform; (d) interfering with other users\' experience; (e) selling counterfeit or infringing products; (f) engaging in any activity that violates applicable laws.',
  },
  {
    title: '8. Limitation of Liability',
    content: 'OptiKart shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the platform. Our total liability shall not exceed the amount paid by you for the specific product or service giving rise to the claim. We are not liable for losses due to force majeure events, third-party actions, or technical failures beyond our reasonable control.',
  },
  {
    title: '9. Indemnification',
    content: 'You agree to indemnify and hold harmless OptiKart, its directors, employees, and agents from any claims, damages, losses, or expenses arising from your use of the platform, violation of these terms, or infringement of any third-party rights.',
  },
  {
    title: '10. Dispute Resolution',
    content: 'Any disputes arising from these terms or your use of OptiKart shall first be attempted to be resolved through good-faith negotiation. If unresolved within 30 days, the dispute shall be submitted to arbitration under the Arbitration and Conciliation Act, 1996. The arbitration shall be conducted in Bangalore, India, in English, by a sole arbitrator appointed by OptiKart. The courts in Bangalore shall have exclusive jurisdiction.',
  },
  {
    title: '11. Modifications to Terms',
    content: 'OptiKart reserves the right to modify these terms at any time. Changes will be effective immediately upon posting on the platform. Continued use of the platform after changes constitutes acceptance of the modified terms. We encourage you to review these terms periodically.',
  },
  {
    title: '12. Governing Law',
    content: 'These terms shall be governed by and construed in accordance with the laws of India. The Information Technology Act, 2000, the Consumer Protection Act, 2019, and the Indian Contract Act, 1872 shall apply to these terms.',
  },
];

const TermsOfUse = () => {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>Terms of Use</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-light)', marginBottom: '8px' }}>Last updated: June 1, 2026</p>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '32px', lineHeight: 1.7 }}>
            Please read these Terms of Use carefully before using OptiKart.com. By using our platform, you agree to be bound by these terms.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
            {sections.map((section, idx) => (
              <div key={idx} className="card" style={{ padding: '24px' }}>
                <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '12px', color: 'var(--text-primary)' }}>{section.title}</h2>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.8 }}>{section.content}</p>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: '24px', background: 'var(--primary-light)', marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <FiGlobe style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Contact Us</h3>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  If you have any questions about these Terms of Use, please contact us at:<br />
                  <strong>Email:</strong> legal@optikart.com<br />
                  <strong>Phone:</strong> 1800-123-4567<br />
                  <strong>Address:</strong> OptiKart Technologies Pvt. Ltd., 4th Floor, Prestige Tower, Indiranagar, Bangalore - 560038
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default TermsOfUse;
