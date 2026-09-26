// Connection to the KMD over its WebSocket (port 81).
// Only the commands the KMD's own page knows can be sent, in exactly the same format
// (values as strings, as they come from the input fields on the KMD's own page).
const ALLOWED = new Set(['send_settings', 'set_calibration_weight', 'set_tw_window', 'set_stop_weight', 'start_calibration', 'restore_defaults']);
const STALE_AFTER_HIDDEN_MS = 10000;

export function createLiveSource(url = `ws://${location.hostname}:81/`) {
  const listeners = { message: new Set(), status: new Set() };
  let socket = null;
  let retries = 0;
  let retryTimer = null;
  let hiddenAt = 0;
  let status = 'connecting';

  const emit = (type, value) => listeners[type].forEach((fn) => fn(value));
  const setStatus = (value) => emit('status', (status = value));

  function open() {
    clearTimeout(retryTimer);
    if (socket) {
      socket.onclose = null;
      socket.close();
    }
    setStatus('connecting');
    const current = new WebSocket(url);
    socket = current;
    current.onopen = () => {
      retries = 0;
      setStatus('connected');
    };
    current.onmessage = (event) => {
      try {
        emit('message', JSON.parse(event.data));
      } catch {}
    };
    current.onclose = () => {
      if (socket !== current) return;
      setStatus('disconnected');
      retryTimer = setTimeout(open, Math.min(1000 * 2 ** retries++, 5000));
    };
    current.onerror = () => current.close();
  }

  // iOS does not keep connections open in the background: reconnect right away after a longer pause
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hiddenAt = Date.now();
    else if (socket?.readyState !== WebSocket.OPEN || Date.now() - hiddenAt > STALE_AFTER_HIDDEN_MS) open();
  });

  open();

  return {
    kind: 'live',
    get status() {
      return status;
    },
    on(type, fn) {
      listeners[type].add(fn);
      return () => listeners[type].delete(fn);
    },
    send(msg) {
      if (!ALLOWED.has(msg.type)) throw new Error(`Unknown command: ${msg.type}`);
      if (socket?.readyState !== WebSocket.OPEN) return false;
      socket.send(JSON.stringify(msg));
      return true;
    },
  };
}
