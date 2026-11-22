import http from 'node:http';
import { discordRpc, DiscordRpcClient } from './discordRpc.mjs';

const PORT = parseInt(process.env.DISCORD_BRIDGE_PORT, 10) || 3001;

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
}

export function createDiscordBridgeServer(port = PORT, rpcInstance = discordRpc) {
  const server = http.createServer(async (req, res) => {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      return res.end();
    }

    const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = reqUrl.pathname;

    // 1. Status endpoint
    if (pathname === '/api/discord/status' && req.method === 'GET') {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      return res.end(JSON.stringify({
        status: 'ok',
        service: 'Spotifree Discord RPC Bridge',
        ...rpcInstance.getStatus(),
      }));
    }

    // 2. Presence update endpoint
    if (pathname === '/api/discord/presence' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        try {
          const data = JSON.parse(body || '{}');
          rpcInstance.updatePresence(data);
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          return res.end(JSON.stringify({ success: true, updated: true }));
        } catch (err) {
          res.statusCode = 400;
          return res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    // 3. Clear presence endpoint
    if (pathname === '/api/discord/clear' && req.method === 'POST') {
      rpcInstance.clearPresence();
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      return res.end(JSON.stringify({ success: true, cleared: true }));
    }

    // 4. Update configuration endpoint
    if (pathname === '/api/discord/config' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        try {
          const data = JSON.parse(body || '{}');
          if (data.clientId) {
            rpcInstance.setClientId(data.clientId);
          }
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          return res.end(JSON.stringify({ success: true, ...rpcInstance.getStatus() }));
        } catch (err) {
          res.statusCode = 400;
          return res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    // 404
    res.statusCode = 404;
    return res.end(JSON.stringify({ error: 'Endpoint no encontrado' }));
  });

  return server;
}

// If run directly from CLI: node scripts/discordBridge.mjs
if (process.argv[1] && process.argv[1].endsWith('discordBridge.mjs')) {
  discordRpc.logEnabled = true;
  discordRpc.connect();

  const server = createDiscordBridgeServer(PORT, discordRpc);
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`\n[Spotifree] Puente Discord Rich Presence iniciado en http://127.0.0.1:${PORT}`);
    console.log(`[Discord IPC] Buscando cliente de Discord local en Windows...`);
    console.log(`[Estado] Cada canción que suene en Spotifree se mostrará automáticamente en Discord.\n`);
  });

  process.on('SIGINT', () => {
    discordRpc.destroy();
    server.close(() => process.exit(0));
  });
}
