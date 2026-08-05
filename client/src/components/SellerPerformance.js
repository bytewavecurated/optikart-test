import React from 'react';
import { FiStar, FiTrendingUp, FiClock, FiRefreshCw, FiMessageSquare, FiAward, FiPackage } from 'react-icons/fi';

const styles = {
  container: {
    fontFamily: "'Roboto', sans-serif",
    background: '#fff',
    borderRadius: '4px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
    overflow: 'hidden',
  },
  header: {
    background: 'linear-gradient(135deg, #2874f0 0%, #1a5dc7 100%)',
    padding: '20px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sellerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  avatar: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    fontWeight: 700,
    color: '#fff',
  },
  sellerName: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#fff',
  },
  sellerSince: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.7)',
    marginTop: '2px',
  },
  badge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 14px',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: 700,
  },
  badgeExcellent: {
    background: '#ff9f00',
    color: '#fff',
  },
  badgeGood: {
    background: '#388e3c',
    color: '#fff',
  },
  badgeAverage: {
    background: '#f57c00',
    color: '#fff',
  },
  ratingSection: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    borderBottom: '1px solid #f0f0f0',
    gap: '24px',
  },
  ratingBig: {
    fontSize: '48px',
    fontWeight: 700,
    color: '#212121',
    lineHeight: 1,
  },
  ratingMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  starsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
  },
  totalRatings: {
    fontSize: '13px',
    color: '#888',
  },
  metrics: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '0',
  },
  metric: {
    padding: '16px 20px',
    borderBottom: '1px solid #f0f0f0',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  metricIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    flexShrink: 0,
  },
  metricContent: {
    flex: 1,
  },
  metricLabel: {
    fontSize: '12px',
    color: '#888',
    marginBottom: '2px',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  metricValue: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#212121',
  },
  metricTrend: {
    fontSize: '11px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    marginTop: '2px',
  },
  trendUp: {
    color: '#388e3c',
  },
  trendDown: {
    color: '#e43f5a',
  },
  progressBar: {
    width: '100%',
    height: '4px',
    background: '#f0f0f0',
    borderRadius: '2px',
    marginTop: '6px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: '2px',
    transition: 'width 0.5s ease',
  },
  footer: {
    padding: '16px 20px',
    background: '#fafafa',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: '12px',
    color: '#888',
  },
  viewDetails: {
    fontSize: '13px',
    color: '#2874f0',
    fontWeight: 600,
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
};

function getBadge(score) {
  if (score >= 4.5) return { label: 'Excellent', style: styles.badgeExcellent };
  if (score >= 3.5) return { label: 'Good', style: styles.badgeGood };
  return { label: 'Average', style: styles.badgeAverage };
}

export default function SellerPerformance({
  sellerName = 'OptiVision Store',
  since = 'Since 2022',
  rating = 4.6,
  totalRatings = 2847,
  totalSales = 12450,
  deliveryTime = '2.3 days',
  returnRate = 3.2,
  responseRate = 96,
  score = 4.6,
}) {
  const badge = getBadge(score);

  const metrics = [
    {
      icon: <FiPackage />,
      iconBg: '#e8f5e9',
      iconColor: '#388e3c',
      label: 'Total Sales',
      value: totalSales.toLocaleString(),
      trend: '+12%',
      trendUp: true,
      progress: Math.min((totalSales / 20000) * 100, 100),
      progressColor: '#388e3c',
    },
    {
      icon: <FiClock />,
      iconBg: '#e3f2fd',
      iconColor: '#2874f0',
      label: 'Avg Delivery',
      value: deliveryTime,
      trend: '-0.5 days',
      trendUp: true,
      progress: 75,
      progressColor: '#2874f0',
    },
    {
      icon: <FiRefreshCw />,
      iconBg: '#fff3e0',
      iconColor: '#f57c00',
      label: 'Return Rate',
      value: `${returnRate}%`,
      trend: '-0.8%',
      trendUp: true,
      progress: returnRate * 10,
      progressColor: returnRate < 5 ? '#388e3c' : '#f57c00',
    },
    {
      icon: <FiMessageSquare />,
      iconBg: '#f3e5f5',
      iconColor: '#9c27b0',
      label: 'Response Rate',
      value: `${responseRate}%`,
      trend: '+2%',
      trendUp: true,
      progress: responseRate,
      progressColor: responseRate > 90 ? '#388e3c' : '#f57c00',
    },
  ];

  const renderStars = (rating) => {
    return [1, 2, 3, 4, 5].map((i) => (
      <FiStar
        key={i}
        size={18}
        style={{
          color: i <= Math.floor(rating) ? '#ff9f00' : (i - 0.5 <= rating ? '#ff9f00' : '#ddd'),
          fill: i <= Math.floor(rating) ? '#ff9f00' : (i - 0.5 <= rating ? '#ff9f00' : 'none'),
        }}
      />
    ));
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.sellerInfo}>
          <div style={styles.avatar}>
            {sellerName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={styles.sellerName}>{sellerName}</div>
            <div style={styles.sellerSince}>{since}</div>
          </div>
        </div>
        <div style={{ ...styles.badge, ...badge.style }}>
          <FiAward size={14} />
          {badge.label}
        </div>
      </div>

      <div style={styles.ratingSection}>
        <div style={styles.ratingBig}>{rating.toFixed(1)}</div>
        <div style={styles.ratingMeta}>
          <div style={styles.starsRow}>
            {renderStars(rating)}
          </div>
          <div style={styles.totalRatings}>
            {totalRatings.toLocaleString()} ratings
          </div>
        </div>
      </div>

      <div style={styles.metrics} className="seller-metrics">
        {metrics.map((metric, i) => (
          <div key={i} style={styles.metric}>
            <div style={{ ...styles.metricIcon, background: metric.iconBg, color: metric.iconColor }}>
              {metric.icon}
            </div>
            <div style={styles.metricContent}>
              <div style={styles.metricLabel}>{metric.label}</div>
              <div style={styles.metricValue}>{metric.value}</div>
              <div style={{
                ...styles.metricTrend,
                ...(metric.trendUp ? styles.trendUp : styles.trendDown),
              }}>
                <FiTrendingUp size={12} />
                {metric.trend} vs last month
              </div>
              <div style={styles.progressBar}>
                <div
                  style={{
                    ...styles.progressFill,
                    width: `${metric.progress}%`,
                    background: metric.progressColor,
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={styles.footer}>
        <span style={styles.footerText}>Performance score updated daily</span>
        <a href="/seller/performance" style={styles.viewDetails}>
          View Details
        </a>
      </div>

      <style>{`
        @media (max-width: 600px) {
          .seller-metrics { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
