/**
 * Delivery Route Optimization Service
 * AI-powered route planning for delivery partners
 */

import Order from '../models/Order.js';
import DeliveryPartner from '../models/DeliveryPartner.js';

/**
 * Calculate distance between two coordinates using Haversine formula
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Estimate delivery time based on distance
 */
const estimateDeliveryTime = (distanceKm) => {
  const avgSpeed = 30; // km/h in city
  const timeHours = distanceKm / avgSpeed;
  return Math.round(timeHours * 60); // minutes
};

/**
 * Optimize delivery route using nearest neighbor algorithm
 */
export const optimizeRoute = async (partnerId) => {
  try {
    // Get delivery partner's current location
    const partner = await DeliveryPartner.findById(partnerId);
    if (!partner || !partner.currentLocation) {
      throw new Error('Partner location not available');
    }

    const currentLat = partner.currentLocation.coordinates[1];
    const currentLon = partner.currentLocation.coordinates[0];

    // Get all pending deliveries for this partner
    const pendingOrders = await Order.find({
      deliveryPartner: partnerId,
      orderStatus: { $in: ['picked_up', 'in_transit'] }
    }).populate('user', 'name phone email').sort({ createdAt: 1 });

    if (pendingOrders.length === 0) {
      return {
        success: true,
        message: 'No pending deliveries',
        data: {
          optimizedRoute: [],
          totalDistance: 0,
          totalTime: 0,
          totalDeliveries: 0
        }
      };
    }

    // Calculate distances from current location to all delivery addresses
    const deliveries = pendingOrders.map(order => {
      const deliveryLat = order.shippingAddress?.coordinates?.[1] || currentLat;
      const deliveryLon = order.shippingAddress?.coordinates?.[0] || currentLon;
      
      return {
        order,
        distance: calculateDistance(currentLat, currentLon, deliveryLat, deliveryLon),
        estimatedTime: estimateDeliveryTime(
          calculateDistance(currentLat, currentLon, deliveryLat, deliveryLon)
        ),
        priority: order.orderStatus === 'picked_up' ? 1 : 2, // Prioritize picked up orders
        createdAt: order.createdAt
      };
    });

    // Nearest neighbor algorithm for route optimization
    const optimizedRoute = [];
    const unvisited = [...deliveries];
    let currentPos = { lat: currentLat, lon: currentLon };
    let totalDistance = 0;
    let totalTime = 0;

    while (unvisited.length > 0) {
      // Find nearest unvisited delivery
      let nearestIndex = 0;
      let minDistance = Infinity;

      unvisited.forEach((delivery, index) => {
        const dist = calculateDistance(
          currentPos.lat,
          currentPos.lon,
          delivery.order.shippingAddress?.coordinates?.[1] || currentPos.lat,
          delivery.order.shippingAddress?.coordinates?.[0] || currentPos.lon
        );
        
        // Consider priority in distance calculation
        const adjustedDistance = dist * (delivery.priority === 1 ? 0.8 : 1);
        
        if (adjustedDistance < minDistance) {
          minDistance = adjustedDistance;
          nearestIndex = index;
        }
      });

      // Add nearest delivery to route
      const nextDelivery = unvisited.splice(nearestIndex, 1)[0];
      const distanceFromCurrent = calculateDistance(
        currentPos.lat,
        currentPos.lon,
        nextDelivery.order.shippingAddress?.coordinates?.[1] || currentPos.lat,
        nextDelivery.order.shippingAddress?.coordinates?.[0] || currentPos.lon
      );

      optimizedRoute.push({
        ...nextDelivery,
        sequenceNumber: optimizedRoute.length + 1,
        distanceFromPrevious: distanceFromCurrent,
        estimatedTimeFromPrevious: estimateDeliveryTime(distanceFromCurrent)
      });

      totalDistance += distanceFromCurrent;
      totalTime += estimateDeliveryTime(distanceFromCurrent);

      // Update current position
      currentPos = {
        lat: nextDelivery.order.shippingAddress?.coordinates?.[1] || currentPos.lat,
        lon: nextDelivery.order.shippingAddress?.coordinates?.[0] || currentPos.lon
      };
    }

    // Calculate total route metrics
    const totalDeliveries = optimizedRoute.length;
    const avgDistancePerDelivery = totalDistance / totalDeliveries;
    const avgTimePerDelivery = totalTime / totalDeliveries;

    // Estimate fuel cost (assuming 50 km/l and ₹100/l)
    const fuelCost = (totalDistance / 50) * 100;

    // Estimate earnings
    const estimatedEarnings = totalDeliveries * 50 + totalDistance * 10; // ₹50 per delivery + ₹10 per km

    return {
      success: true,
      data: {
        optimizedRoute,
        metrics: {
          totalDistance: Math.round(totalDistance * 100) / 100,
          totalTime: Math.round(totalTime),
          totalDeliveries,
          avgDistancePerDelivery: Math.round(avgDistancePerDelivery * 100) / 100,
          avgTimePerDelivery: Math.round(avgTimePerDelivery),
          estimatedFuelCost: Math.round(fuelCost),
          estimatedEarnings: Math.round(estimatedEarnings)
        },
        recommendations: generateRecommendations(optimizedRoute, totalDistance, totalTime)
      }
    };
  } catch (error) {
    console.error('Error optimizing route:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Generate delivery recommendations
 */
const generateRecommendations = (route, totalDistance, totalTime) => {
  const recommendations = [];

  // Time-based recommendations
  if (totalTime > 240) { // More than 4 hours
    recommendations.push({
      type: 'time',
      priority: 'high',
      message: 'Route will take over 4 hours. Consider breaking into multiple trips or prioritizing urgent deliveries.'
    });
  }

  // Distance-based recommendations
  if (totalDistance > 100) { // More than 100 km
    recommendations.push({
      type: 'distance',
      priority: 'high',
      message: 'Total distance exceeds 100 km. Plan fuel stops and rest breaks.'
    });
  }

  // Delivery count recommendations
  if (route.length > 10) {
    recommendations.push({
      type: 'volume',
      priority: 'medium',
      message: 'High delivery volume (10+). Consider batching nearby deliveries.'
    });
  }

  // Priority-based recommendations
  const highPriorityCount = route.filter(d => d.priority === 1).length;
  if (highPriorityCount > 0) {
    recommendations.push({
      type: 'priority',
      priority: 'medium',
      message: `${highPriorityCount} high-priority deliveries identified. These have been prioritized in the route.`
    });
  }

  // Weather/traffic recommendations (placeholder for future integration)
  recommendations.push({
    type: 'general',
    priority: 'low',
    message: 'Check weather and traffic conditions before starting. Avoid peak hours if possible.'
  });

  return recommendations;
};

/**
 * Get real-time route updates
 */
export const getRouteUpdates = async (partnerId, currentLat, currentLon) => {
  try {
    const partner = await DeliveryPartner.findById(partnerId);
    if (!partner) {
      throw new Error('Partner not found');
    }

    // Get pending deliveries
    const pendingOrders = await Order.find({
      deliveryPartner: partnerId,
      orderStatus: { $in: ['picked_up', 'in_transit'] }
    }).populate('user', 'name phone');

    // Calculate ETA for each delivery
    const updates = pendingOrders.map(order => {
      const deliveryLat = order.shippingAddress?.coordinates?.[1] || currentLat;
      const deliveryLon = order.shippingAddress?.coordinates?.[0] || currentLon;
      
      const distance = calculateDistance(currentLat, currentLon, deliveryLat, deliveryLon);
      const eta = estimateDeliveryTime(distance);

      return {
        orderId: order._id,
        orderNumber: order.orderNumber,
        customerName: order.user?.name,
        distance: Math.round(distance * 100) / 100,
        eta,
        status: order.orderStatus
      };
    });

    return {
      success: true,
      data: updates
    };
  } catch (error) {
    console.error('Error getting route updates:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export default {
  optimizeRoute,
  getRouteUpdates
};
