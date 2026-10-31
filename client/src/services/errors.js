import toast from 'react-hot-toast';

// Turn an axios (or any) failure into something a user can act on, instead of
// a bare "Failed to load X". Falls back to the HTTP status when the backend did
// not send a message.
export const describeError = (error, fallback = 'Something went wrong') => {
  if (!error) return fallback;
  const data = error.response?.data;
  const msg =
    (data && (data.message || data.error)) ||
    (typeof data === 'string' ? data : null) ||
    error.friendlyMessage ||
    error.message;

  if (error.response) {
    const status = error.response.status;
    if (status === 401) return 'Your session expired. Please sign in again.';
    if (status === 403) return msg || 'You do not have permission to view this.';
    if (status === 404) return msg || 'That resource no longer exists.';
    if (status === 429) return msg || 'Too many requests. Please wait a moment.';
    if (status >= 500) return msg || `Server error (${status}).`;
    return msg || `Request failed (${status}).`;
  }

  if (error.code === 'ERR_NETWORK' || /Network Error/i.test(error.message || '')) {
    return 'Cannot reach the server. Check that the API is running on port 5000.';
  }
  if (error.code === 'ECONNABORTED') return 'The server took too long to respond.';

  return msg || fallback;
};

// React StrictMode mounts effects twice in development, so a failing fetch
// fires two identical toasts. This keeps the last message for a short window
// and ignores exact duplicates, without changing behaviour in production.
let lastMessage = '';
let lastAt = 0;

export const toastError = (error, fallback = 'Something went wrong') => {
  const message = typeof error === 'string' ? error : describeError(error, fallback);
  const now = Date.now();
  if (message === lastMessage && now - lastAt < 1200) return;
  lastMessage = message;
  lastAt = now;
  toast.error(message);
};

export const toastSuccess = (message) => {
  lastMessage = '';
  toast.success(message);
};
