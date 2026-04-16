import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Server } from 'net';
import { logger } from '../logger';

const clients = new Set<WebSocket>();

let heartbeatInterval: NodeJS.Timeout | null = null;
let clientCountInterval: NodeJS.Timeout | null = null;

export const setupWebSocket = (server: Server) => {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request: IncomingMessage, socket, head) => {
    const url = new URL(request.url ?? '', `http://${request.headers.host}`);
    if (url.pathname === '/ws') {
      wss.handleUpgrade(request, socket as any, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    clients.add(ws);
    logger.info({ ip: req.socket.remoteAddress, count: clients.size }, 'WebSocket client connected');

    ws.send(JSON.stringify({ type: 'connected', timestamp: Date.now() }));
    broadcastClientCount();

    ws.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'pong') {
          logger.debug('Pong received from client');
        }
      } catch {
        // Ignore invalid messages
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      logger.info({ ip: req.socket.remoteAddress, count: clients.size }, 'WebSocket client disconnected');
      broadcastClientCount();
    });

    ws.on('error', (err) => {
      clients.delete(ws);
      logger.error({ err }, 'WebSocket error');
    });
  });

  heartbeatInterval = setInterval(() => {
    broadcastToClients({ type: 'ping', timestamp: Date.now() });
  }, 30000);

  clientCountInterval = setInterval(() => {
    broadcastClientCount();
  }, 10000);

  return clients;
};

const broadcastClientCount = () => {
  broadcastToClients({ type: 'client_count', count: clients.size, timestamp: Date.now() });
};

export const broadcastToClients = (message: object) => {
  const data = JSON.stringify(message);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
};

export const getConnectedClientsCount = () => clients.size;
