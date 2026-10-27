export function connectLive({ getSequence, refresh, status }) {
  let source;
  let running = false;
  let wanted = getSequence();
  let retry;
  async function update() {
    if (running) return;
    running = true;
    try {
      while (getSequence() < wanted) await refresh();
    } catch (error) {
      status('Updates paused: ' + error.message);
      clearTimeout(retry);
      retry = setTimeout(update, 1500);
    } finally { running = false; }
  }
  function connect() {
    source = new EventSource('/api/events');
    const receive = event => {
      const data = JSON.parse(event.data);
      status(data.error ? 'Updates paused: ' + data.error : 'Live updates');
      wanted = Math.max(wanted, data.sequence);
      void update();
    };
    for (const type of ['ready', 'change', 'update-error']) source.addEventListener(type, receive);
    source.onerror = () => status('Reconnecting to local server…');
  }
  connect();
  window.addEventListener('pagehide', () => { source.close(); clearTimeout(retry); });
  window.addEventListener('pageshow', event => { if (event.persisted) connect(); });
}
