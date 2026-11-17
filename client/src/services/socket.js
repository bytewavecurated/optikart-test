import { io } from 'socket.io-client';

// Use environment variable or derive from API URL
// Default to the origin the app was served from so the socket follows the
// API host in every environment instead of failing against a fixed port.
const SOCKET_URL =
  process.env.REACT_APP_SOCKET_URL ||
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000');

let socket = null;
let socketToken = null;

export const connectSocket = (token) => {
  /*
   * Reconnecting with a DIFFERENT token must tear down the old socket and open
   * a new one. The guard used to be just "already connected? reuse it", which
   * was harmless while the server ignored the handshake token and is fatal now
   * that it authenticates: a seller signing in on a page that had earlier held
   * a customer (or a previous seller's) socket would keep that socket, so their
   * `seller_<id>` room never joined and new-order alerts silently never
   * arrived - the exact "endpoint answers, feature is dead" failure this codebase
   * keeps meeting. Same token, same connection: reuse it.
   */
  if (socket?.connected && socketToken === token) return socket;
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  socketToken = token;

  socket = io(SOCKET_URL, {
    auth: { token },
    // HTTP polling first, then upgrade to a websocket. Leading with the bare
    // websocket fails outright behind proxies and on some networks, which used
    // to leave seller alerts dead with only a console error to show for it.
    transports: ['polling', 'websocket'],
    upgrade: true,
    reconnection: true,
    reconnectionAttempts: 8,
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
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    socketToken = null;
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
