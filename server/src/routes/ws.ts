import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Server } from 'net';
import { randomUUID } from 'crypto';
import { logger } from '../logger';

const clients = new Map<WebSocket, string>();

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
    const clientId = randomUUID();
    clients.set(ws, clientId);
    logger.info({ ip: req.socket.remoteAddress, count: clients.size, clientId }, 'WebSocket client connected');

    ws.send(JSON.stringify({ type: 'connected', timestamp: Date.now(), clientId }));
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
  broadcastToClients({ type: 'client_count', count: Math.max(0, clients.size - 1), timestamp: Date.now() });
};

export const broadcastToClients = (message: object) => {
  const data = JSON.stringify(message);
  clients.forEach((_, ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  });
};

export const getConnectedClientsCount = () => Math.max(0, clients.size - 1);
