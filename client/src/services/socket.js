import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:5000';

let socket = null;

export const connectSocket = (token) => {
  if (socket?.connected) return socket;

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on('connect', () => {
    console.log('Socket connected:', socket.id);
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error.message);
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = () => socket;

export const onNewOrder = (callback) => {
  if (!socket) return;
  socket.on('newOrder', callback);
};

export const onOrderUpdate = (callback) => {
  if (!socket) return;
  socket.on('orderUpdate', callback);
};

export const onPickupScheduled = (callback) => {
  if (!socket) return;
  socket.on('pickupScheduled', callback);
};

export const onPaymentReceived = (callback) => {
  if (!socket) return;
  socket.on('paymentReceived', callback);
};

export const offNewOrder = (callback) => {
  if (!socket) return;
  socket.off('newOrder', callback);
};

export const offOrderUpdate = (callback) => {
  if (!socket) return;
  socket.off('orderUpdate', callback);
};

export const offPickupScheduled = (callback) => {
  if (!socket) return;
  socket.off('pickupScheduled', callback);
};

export const offPaymentReceived = (callback) => {
  if (!socket) return;
  socket.off('paymentReceived', callback);
};

export const emitJoinSellerRoom = (sellerId) => {
  if (!socket) return;
  socket.emit('joinSellerRoom', sellerId);
};

export const emitJoinOrderRoom = (orderId) => {
  if (!socket) return;
  socket.emit('joinOrderRoom', orderId);
};

export const emitLeaveSellerRoom = (sellerId) => {
  if (!socket) return;
  socket.emit('leaveSellerRoom', sellerId);
};

export const emitLeaveOrderRoom = (orderId) => {
  if (!socket) return;
  socket.emit('leaveOrderRoom', orderId);
};
