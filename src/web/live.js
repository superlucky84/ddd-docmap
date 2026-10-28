export function connectLive({ getSequence, refresh, status }) {
  let source;
  let running = false;
  let wanted = getSequence();
  let retry;
  let active = true;
  let connected = false;
  let serverError = null;
  async function update() {
    if (running || !active) return;
    running = true;
    try {
      while (active && getSequence() < wanted) await refresh();
      if (active && connected) status(serverError ? 'Updates paused: ' + serverError : 'Live updates');
    } catch (error) {
      if (!active) return;
      status('Updates paused: ' + error.message);
      clearTimeout(retry);
      retry = setTimeout(update, 1500);
    } finally { running = false; }
  }
  function connect() {
    active = true;
    source = new EventSource('/api/events');
    const receive = event => {
      if (!active) return;
      connected = true;
      const data = JSON.parse(event.data);
      serverError = data.error;
      status(data.error ? 'Updates paused: ' + data.error : 'Live updates');
      wanted = Math.max(wanted, data.sequence);
      void update();
    };
    for (const type of ['ready', 'change', 'update-error']) source.addEventListener(type, receive);
    source.onerror = () => { connected = false; if (active) status('Reconnecting to local server…'); };
  }
  connect();
  window.addEventListener('pagehide', () => { active = false; connected = false; source.close(); clearTimeout(retry); });
  window.addEventListener('pageshow', event => { if (event.persisted) connect(); });
}
