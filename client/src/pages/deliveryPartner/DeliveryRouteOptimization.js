import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { deliveryPartner as deliveryApi } from '../../services/api';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import toast from 'react-hot-toast';
import { FiMapPin, FiClock, FiDollarSign, FiNavigation, FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';

const DeliveryRouteOptimization = () => {
  const navigate = useNavigate();
  const [routeData, setRouteData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [partnerLocation, setPartnerLocation] = useState(null);

  useEffect(() => {
    // Get partner's current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setPartnerLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude
          });
        },
        (error) => {
          console.error('Geolocation error:', error);
          toast.error('Unable to get your location. Please enable location services.');
        }
      );
    }
  }, []);

  const optimizeRoute = async () => {
    try {
      setLoading(true);
      const res = await deliveryApi.optimizeRoute();

      if (res.data.success) {
        setRouteData(res.data.data);
        toast.success('Route optimized successfully');
      } else {
        toast.error(res.data.message || 'Failed to optimize route');
      }
    } catch (error) {
      console.error('Error optimizing route:', error);
      toast.error('Failed to optimize route');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Header />
      <div className="container page-wrapper">
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>Route Optimization</h1>
          <p style={{ color: 'var(--text-secondary)' }}>AI-powered route planning for efficient deliveries</p>
        </div>

        {/* Optimize Button */}
        <div className="card" style={{ padding: '20px', marginBottom: '24px', textAlign: 'center' }}>
          <FiRoute size={48} color="var(--primary)" style={{ marginBottom: '16px' }} />
          <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '12px' }}>Optimize Your Delivery Route</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
            Get the most efficient route for your pending deliveries
          </p>
          <button
            onClick={optimizeRoute}
            disabled={loading}
            className="btn btn-primary"
            style={{ padding: '12px 32px', fontSize: '16px' }}
          >
            {loading ? 'Optimizing...' : 'Optimize Route'}
          </button>
        </div>

        {routeData && (
          <>
            {/* Route Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <div className="card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <FiRoute size={24} color="var(--primary)" />
                  <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Total Distance</span>
                </div>
                <div style={{ fontSize: '32px', fontWeight: 700 }}>{routeData.metrics.totalDistance} km</div>
              </div>

              <div className="card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <FiClock size={24} color="var(--warning)" />
                  <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Total Time</span>
                </div>
                <div style={{ fontSize: '32px', fontWeight: 700 }}>{Math.floor(routeData.metrics.totalTime / 60)}h {routeData.metrics.totalTime % 60}m</div>
              </div>

              <div className="card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <FiMapPin size={24} color="var(--success)" />
                  <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Deliveries</span>
                </div>
                <div style={{ fontSize: '32px', fontWeight: 700 }}>{routeData.metrics.totalDeliveries}</div>
              </div>

              <div className="card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <FiDollarSign size={24} color="var(--success)" />
                  <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Est. Earnings</span>
                </div>
                <div style={{ fontSize: '32px', fontWeight: 700 }}>₹{routeData.metrics.estimatedEarnings}</div>
              </div>
            </div>

            {/* Additional Metrics */}
            <div className="card" style={{ padding: '20px', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Route Details</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Avg Distance/Delivery</div>
                  <div style={{ fontSize: '20px', fontWeight: 600 }}>{routeData.metrics.avgDistancePerDelivery} km</div>
                </div>
                <div>
                  <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Avg Time/Delivery</div>
                  <div style={{ fontSize: '20px', fontWeight: 600 }}>{routeData.metrics.avgTimePerDelivery} min</div>
                </div>
                <div>
                  <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Est. Fuel Cost</div>
                  <div style={{ fontSize: '20px', fontWeight: 600 }}>₹{routeData.metrics.estimatedFuelCost}</div>
                </div>
              </div>
            </div>

            {/* Optimized Route */}
            <div className="card" style={{ padding: '20px', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Optimized Route</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {routeData.optimizedRoute.map((delivery, index) => (
                  <div key={index} style={{ padding: '16px', border: '2px solid var(--border)', borderRadius: '8px', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: '-12px', left: '16px', background: 'var(--primary)', color: 'white', padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>
                      Stop {delivery.sequenceNumber}
                    </div>
                    <div style={{ marginTop: '8px' }}>
                      <div style={{ fontWeight: 600, marginBottom: '8px' }}>
                        Order #{delivery.order.orderNumber}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <FiMapPin size={16} />
                          <span>{delivery.order.shippingAddress?.name}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <FiMapPin size={16} />
                          <span>{delivery.order.shippingAddress?.street}, {delivery.order.shippingAddress?.city}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <FiClock size={16} />
                          <span>Distance: {delivery.distanceFromPrevious.toFixed(2)} km · ETA: {delivery.estimatedTimeFromPrevious} min</span>
                        </div>
                        {delivery.priority === 1 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--warning)' }}>
                            <FiAlertTriangle size={16} />
                            <span>High Priority</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommendations */}
            {routeData.recommendations && routeData.recommendations.length > 0 && (
              <div className="card" style={{ padding: '20px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Recommendations</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {routeData.recommendations.map((rec, index) => (
                    <div key={index} style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', borderLeft: `4px solid ${rec.priority === 'high' ? 'var(--danger)' : rec.priority === 'medium' ? 'var(--warning)' : 'var(--success)'}` }}>
                      <div style={{ display: 'flex', alignItems: 'start', gap: '12px' }}>
                        <FiAlertTriangle size={20} color={rec.priority === 'high' ? 'var(--danger)' : rec.priority === 'medium' ? 'var(--warning)' : 'var(--success)'} style={{ marginTop: '2px' }} />
                        <div>
                          <div style={{ fontWeight: 600, marginBottom: '4px', textTransform: 'capitalize' }}>{rec.type}</div>
                          <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{rec.message}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
      <Footer />
    </>
  );
};

export default DeliveryRouteOptimization;
