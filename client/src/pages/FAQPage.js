import React, { useState } from 'react';
import { FiChevronDown, FiChevronUp, FiSearch } from 'react-icons/fi';
import Header from '../components/Header';
import Footer from '../components/Footer';

const faqData = {
  General: [
    { q: 'What is OptiKart?', a: 'OptiKart is India\'s leading online eyewear platform offering sunglasses, eyeglasses, contact lenses, computer glasses, and sports eyewear from 100+ top brands. We serve customers across all 29 states and 8 union territories.' },
    { q: 'How do I create an account on OptiKart?', a: 'Click on the "Login" button in the top-right corner, then select "New User? Register". Enter your name, email, phone number, and create a password. You can also sign up using Google or Facebook.' },
    { q: 'Is OptiKart available on mobile?', a: 'Yes, OptiKart is fully responsive and works seamlessly on all mobile browsers. We are also launching dedicated iOS and Android apps soon.' },
    { q: 'Do you have physical stores?', a: 'OptiKart is currently an online-only platform. This allows us to offer better prices and wider selection. We plan to open experience centers in major cities in the future.' },
    { q: 'How can I contact customer support?', a: 'You can reach us via phone at 1800-123-4567 (Mon-Sat, 9am-9pm), email at support@optikart.com, or through the chat widget on our website. We also have a help center with detailed articles.' },
    { q: 'Do you ship internationally?', a: 'Currently, we only ship within India. We are working on expanding to international markets and will announce updates soon.' },
  ],
  Orders: [
    { q: 'How do I place an order?', a: 'Browse products, select your preferred frame and lens options, add to cart, and proceed to checkout. Enter your delivery address, choose a payment method, and confirm your order.' },
    { q: 'Can I modify my order after placing it?', a: 'You can modify your order within 30 minutes of placement by contacting customer support. After that, order modifications are not possible, but you can cancel and re-order.' },
    { q: 'How do I track my order?', a: 'Go to "My Orders" in your account dashboard, or click the tracking link sent to your email/SMS. You can also track orders using the Shiprocket tracking portal.' },
    { q: 'What if my order is delayed?', a: 'Delivery delays can occur during festivals, sales, or in remote areas. If your order is delayed beyond the estimated delivery date, please contact support and we will provide an update.' },
    { q: 'Can I cancel my order?', a: 'Yes, you can cancel your order anytime before it is shipped. Go to "My Orders" and click "Cancel Order". Refunds are processed within 5-7 business days.' },
    { q: 'What is the minimum order value?', a: 'There is no minimum order value on OptiKart. However, free delivery is available on orders above INR 999 (platform fee of INR 16 still applies).' },
  ],
  Payments: [
    { q: 'What payment methods do you accept?', a: 'We accept Credit/Debit Cards (Visa, Mastercard, RuPay, Amex), UPI (Google Pay, PhonePe, Paytm), Net Banking, Digital Wallets, Cash on Delivery, and EMI options.' },
    { q: 'Is my payment information secure?', a: 'Absolutely. All payments are processed through Razorpay, a PCI-DSS Level 1 certified gateway. We use 256-bit SSL encryption and never store your card details.' },
    { q: 'What if my payment fails?', a: 'If a payment fails, the amount will be refunded to your source account within 5-7 business days. You can retry with the same or a different payment method.' },
    { q: 'Do you offer EMI options?', a: 'Yes, we offer no-cost EMI on select credit cards and standard EMI options on most cards for orders above INR 3,000. EMI options are shown at checkout.' },
    { q: 'Is Cash on Delivery available?', a: 'Yes, COD is available for orders up to INR 10,000. Some premium products and custom prescription orders may require advance payment.' },
    { q: 'Can I get a GST invoice?', a: 'Yes, GST invoices are generated for all orders. You can download the invoice from your order details page or request it via email.' },
  ],
  Shipping: [
    { q: 'How long does delivery take?', a: 'Delivery timelines vary by location: Metro cities (2-4 days), Tier-2 cities (4-6 days), Tier-3 cities (6-8 days), and remote areas (8-12 business days).' },
    { q: 'What are the shipping charges?', a: 'A flat INR 16 platform fee applies to all orders. Shiprocket delivery charges range from INR 40-120 based on weight and destination. Orders above INR 999 get free delivery.' },
    { q: 'Which courier partners do you use?', a: 'We primarily use Shiprocket for pan-India delivery, with Delhivery for express metro delivery and Blue Dart for premium shipments.' },
    { q: 'Do you deliver to my area?', a: 'We deliver to 29,000+ pin codes across India covering all states and union territories. Enter your pin code at checkout to confirm delivery availability.' },
    { q: 'Can I choose a specific delivery date?', a: 'Currently, we do not support scheduled delivery dates. However, express delivery options are available for metro cities at an additional charge of INR 50.' },
    { q: 'What if no one is available to receive the package?', a: 'Our delivery partner will attempt delivery twice. If unsuccessful, the package will be returned to us and you will be contacted for re-delivery scheduling.' },
  ],
  Returns: [
    { q: 'What is your return policy?', a: 'We offer a 7-day easy return policy. Products must be unused, in original packaging with all tags intact. Custom prescription eyewear can only be returned if defective or incorrectly made.' },
    { q: 'How do I initiate a return?', a: 'Go to "My Orders", select the order, click "Return/Exchange", choose a reason, and select refund or exchange. Our delivery partner will pick up the product from your address.' },
    { q: 'How long does the refund take?', a: 'Refunds are processed within 5-7 business days after we receive and verify the returned product. UPI refunds are faster (1-2 days), while card refunds may take 5-7 days.' },
    { q: 'Can I exchange instead of returning?', a: 'Yes, you can choose exchange during the return process. The exchanged product will be shipped once we receive and verify the original product.' },
    { q: 'Who pays for return shipping?', a: 'OptiKart covers the return shipping cost for all valid returns. The pickup is arranged by our delivery partner at no charge to you.' },
    { q: 'What if I receive a damaged or wrong product?', a: 'Please contact us within 48 hours of delivery with photos of the damage or wrong item. We will arrange an immediate replacement or full refund at no cost to you.' },
  ],
  Prescription: [
    { q: 'How do I upload my prescription?', a: 'After adding prescription eyewear to your cart, you will be prompted to upload your prescription during checkout. You can upload a photo, PDF, or enter your prescription details manually.' },
    { q: 'What information do I need from my prescription?', a: 'You need your Sphere (SPH), Cylinder (CYL), Axis, and Pupillary Distance (PD) for each eye. If you need reading glasses, you need the Add power.' },
    { q: 'Can I order without a prescription?', a: 'Yes, you can order plano (zero power) glasses, sunglasses, or contact lenses without a prescription. For prescription eyewear, a valid prescription is required.' },
    { q: 'How accurate are the lenses made from uploaded prescriptions?', a: 'Our partnered labs follow strict quality standards with a tolerance of ±0.25D. Every pair undergoes quality check before dispatch.' },
    { q: 'What if the prescription glasses don\'t feel right?', a: 'If you experience discomfort, we recommend waiting 3-5 days for adjustment. If issues persist, visit your optometrist to verify the prescription and contact our support team.' },
    { q: 'Do you offer progressive/bifocal lenses?', a: 'Yes, we offer single vision, bifocal, and progressive lenses. Progressive lenses are available in premium variants with anti-reflective and blue-cut coatings.' },
  ],
  'Virtual Try-On': [
    { q: 'What is Virtual Try-On?', a: 'Virtual Try-On is an AI-powered feature that lets you see how different frames look on your face using your camera. It uses advanced facial mapping for realistic previews.' },
    { q: 'How do I use Virtual Try-On?', a: 'Click the "Try On" button on any product page. Allow camera access when prompted, and the frame will appear on your face in real-time. You can take a photo and share it.' },
    { q: 'Is my camera data stored?', a: 'No. Virtual Try-On processing happens entirely in your browser. No images or video data is uploaded to our servers. Your privacy is fully protected.' },
    { q: 'Does Virtual Try-On work on mobile?', a: 'Yes, Virtual Try-On works on both desktop and mobile browsers. For the best experience, use it in a well-lit environment facing the camera directly.' },
    { q: 'Can I compare multiple frames?', a: 'Yes, you can try on multiple frames and save your favorites to compare them side by side. You can also share try-on photos with friends for their opinion.' },
    { q: 'How accurate is the frame sizing in Virtual Try-On?', a: 'Our Virtual Try-On uses facial proportions to estimate frame sizing. For exact measurements, check the frame dimensions listed on each product page.' },
  ],
};

const categories = Object.keys(faqData);

const FAQPage = () => {
  const [openItems, setOpenItems] = useState({});
  const [activeCategory, setActiveCategory] = useState('General');
  const [searchQuery, setSearchQuery] = useState('');

  const toggleItem = (key) => {
    setOpenItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const allFaqs = Object.entries(faqData).flatMap(([cat, items]) =>
    items.map((item, idx) => ({ ...item, category: cat, key: `${cat}-${idx}` }))
  );

  const filteredFaqs = searchQuery
    ? allFaqs.filter((faq) => faq.q.toLowerCase().includes(searchQuery.toLowerCase()) || faq.a.toLowerCase().includes(searchQuery.toLowerCase()))
    : null;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>Frequently Asked Questions</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-light)', marginBottom: '24px' }}>Find answers to common questions about OptiKart</p>

          <div style={{ position: 'relative', marginBottom: '24px', maxWidth: '500px' }}>
            <FiSearch style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)', fontSize: '18px' }} />
            <input
              type="text"
              placeholder="Search FAQs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input"
              style={{ paddingLeft: '44px' }}
            />
          </div>

          {filteredFaqs ? (
            <div style={{ marginBottom: '32px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Search Results ({filteredFaqs.length})</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filteredFaqs.map((faq) => (
                  <div key={faq.key} className="card" style={{ overflow: 'hidden' }}>
                    <button onClick={() => toggleItem(faq.key)} style={{ width: '100%', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left', fontSize: '14px', fontWeight: 500, background: 'none', cursor: 'pointer' }}>
                      <span>{faq.q}</span>
                      {openItems[faq.key] ? <FiChevronUp style={{ flexShrink: 0, color: 'var(--primary)' }} /> : <FiChevronDown style={{ flexShrink: 0, color: 'var(--text-light)' }} />}
                    </button>
                    {openItems[faq.key] && (
                      <div style={{ padding: '0 20px 16px', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>{faq.a}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 'var(--radius)',
                      fontSize: '13px',
                      fontWeight: 500,
                      background: activeCategory === cat ? 'var(--primary)' : 'var(--bg-white)',
                      color: activeCategory === cat ? '#fff' : 'var(--text-primary)',
                      border: activeCategory === cat ? 'none' : '1px solid var(--border)',
                      cursor: 'pointer',
                      transition: 'var(--transition)',
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '32px' }}>
                {faqData[activeCategory].map((faq, idx) => {
                  const key = `${activeCategory}-${idx}`;
                  return (
                    <div key={key} className="card" style={{ overflow: 'hidden' }}>
                      <button onClick={() => toggleItem(key)} style={{ width: '100%', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left', fontSize: '14px', fontWeight: 500, background: 'none', cursor: 'pointer' }}>
                        <span>{faq.q}</span>
                        {openItems[key] ? <FiChevronUp style={{ flexShrink: 0, color: 'var(--primary)' }} /> : <FiChevronDown style={{ flexShrink: 0, color: 'var(--text-light)' }} />}
                      </button>
                      {openItems[key] && (
                        <div style={{ padding: '0 20px 16px', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>{faq.a}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default FAQPage;
