import React from 'react';
import { FiCheck, FiPackage, FiBox, FiTruck, FiMapPin, FiHome } from 'react-icons/fi';

const STEPS = [
  { key: 'ordered', label: 'Ordered', icon: <FiPackage />, desc: 'Order placed successfully' },
  { key: 'confirmed', label: 'Confirmed', icon: <FiCheck />, desc: 'Seller confirmed your order' },
  { key: 'packed', label: 'Packed', icon: <FiBox />, desc: 'Your item has been packed' },
  { key: 'picked', label: 'Picked Up', icon: <FiTruck />, desc: 'Collected by shipping partner' },
  { key: 'transit', label: 'In Transit', icon: <FiMapPin />, desc: 'On the way to your city' },
  { key: 'delivered', label: 'Delivered', icon: <FiHome />, desc: 'Delivered successfully' },
];

const styles = {
  container: {
    fontFamily: "'Roboto', sans-serif",
    background: '#fff',
    borderRadius: '4px',
    padding: '24px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '24px',
  },
  title: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#212121',
  },
  orderId: {
    fontSize: '13px',
    color: '#888',
    fontWeight: 500,
  },
  timeline: {
    position: 'relative',
    paddingLeft: '40px',
  },
  line: {
    position: 'absolute',
    left: '15px',
    top: '12px',
    bottom: '12px',
    width: '2px',
    background: '#e0e0e0',
  },
  lineProgress: {
    position: 'absolute',
    left: '15px',
    top: '12px',
    width: '2px',
    background: '#2874f0',
    transition: 'height 0.5s ease',
  },
  step: {
    position: 'relative',
    paddingBottom: '28px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
  },
  stepLast: {
    paddingBottom: '0',
  },
  iconWrap: {
    position: 'absolute',
    left: '-40px',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    zIndex: 1,
    transition: 'all 0.3s',
  },
  iconCompleted: {
    background: '#2874f0',
    color: '#fff',
  },
  iconCurrent: {
    background: '#fff',
    color: '#2874f0',
    border: '3px solid #2874f0',
    boxShadow: '0 0 0 4px rgba(40,116,240,0.15)',
  },
  iconPending: {
    background: '#f5f5f5',
    color: '#bbb',
    border: '2px solid #e0e0e0',
  },
  stepContent: {
    flex: 1,
  },
  stepLabel: {
    fontSize: '15px',
    fontWeight: 600,
    marginBottom: '2px',
  },
  stepLabelCompleted: {
    color: '#212121',
  },
  stepLabelCurrent: {
    color: '#2874f0',
  },
  stepLabelPending: {
    color: '#999',
  },
  stepDesc: {
    fontSize: '13px',
    color: '#888',
    marginBottom: '4px',
  },
  stepDate: {
    fontSize: '12px',
    color: '#aaa',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  trackingLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    color: '#2874f0',
    fontSize: '13px',
    fontWeight: 600,
    textDecoration: 'none',
    marginTop: '16px',
    padding: '8px 16px',
    border: '1px solid #2874f0',
    borderRadius: '4px',
    transition: 'all 0.2s',
  },
  eta: {
    marginTop: '16px',
    padding: '12px 16px',
    background: '#f0f6ff',
    borderRadius: '4px',
    fontSize: '14px',
    color: '#2874f0',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
};

export default function OrderTimeline({ currentStep = 3, orderId = 'ORD-2026-4521', orderDate, trackingUrl }) {
  const getStepStatus = (index) => {
    if (index < currentStep) return 'completed';
    if (index === currentStep) return 'current';
    return 'pending';
  };

  const stepDates = [
    'Jul 1, 2026, 10:30 AM',
    'Jul 1, 2026, 2:15 PM',
    'Jul 2, 2026, 9:00 AM',
    'Jul 2, 2026, 4:30 PM',
    'Jul 3, 2026, 8:00 AM',
    'Expected by Jul 5, 2026',
  ];

  const progressHeight = currentStep >= STEPS.length - 1
    ? '100%'
    : `${(currentStep / (STEPS.length - 1)) * 100}%`;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Order Status</h3>
        <span style={styles.orderId}>#{orderId}</span>
      </div>

      <div style={styles.timeline}>
        <div style={styles.line} />
        <div style={{ ...styles.lineProgress, height: progressHeight }} />

        {STEPS.map((step, index) => {
          const status = getStepStatus(index);
          const isLast = index === STEPS.length - 1;

          return (
            <div
              key={step.key}
              style={{
                ...styles.step,
                ...(isLast ? styles.stepLast : {}),
              }}
            >
              <div
                style={{
                  ...styles.iconWrap,
                  ...(status === 'completed' ? styles.iconCompleted : {}),
                  ...(status === 'current' ? styles.iconCurrent : {}),
                  ...(status === 'pending' ? styles.iconPending : {}),
                }}
              >
                {status === 'completed' ? <FiCheck size={14} /> : step.icon}
              </div>

              <div style={styles.stepContent}>
                <div
                  style={{
                    ...styles.stepLabel,
                    ...(status === 'completed' ? styles.stepLabelCompleted : {}),
                    ...(status === 'current' ? styles.stepLabelCurrent : {}),
                    ...(status === 'pending' ? styles.stepLabelPending : {}),
                  }}
                >
                  {step.label}
                </div>
                <div style={styles.stepDesc}>{step.desc}</div>
                <div style={styles.stepDate}>
                  {stepDates[index]}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {currentStep < STEPS.length - 1 && (
        <div style={styles.eta}>
          <FiTruck />
          Expected delivery by Jul 5, 2026
        </div>
      )}

      {trackingUrl && (
        <a href={trackingUrl} style={styles.trackingLink} target="_blank" rel="noopener noreferrer">
          <FiMapPin size={14} /> Track on Map
        </a>
      )}
    </div>
  );
}
