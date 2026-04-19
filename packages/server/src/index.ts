import { createServer } from './server.js';

const PORT = parseInt(process.env['CUTSENSE_SERVER_PORT'] ?? '8300', 10);
const HOST = '127.0.0.1'; // localhost only - TCE calls over VPS loopback

const server = createServer();
server.listen(PORT, HOST, () => {
  console.log(`[cutsense-server] Listening on http://${HOST}:${PORT}`);
  console.log('[cutsense-server] Routes: POST /transcribe | POST /split | POST /edit | GET /jobs/:id/status');
});

server.on('error', (err) => {
  console.error('[cutsense-server] Fatal:', err);
  process.exit(1);
});
