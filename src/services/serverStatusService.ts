import WebSocket from 'ws';

const SERVER_URL = 'ws://104.131.23.0:3030/ws';

export type ServerStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface ServerStatusEvent {
  status: ServerStatus;
  error?: string;
}

type StatusCallback = (event: ServerStatusEvent) => void;

class ServerStatusService {
  private ws: WebSocket | null = null;
  private status: ServerStatus = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectDelay = 30000;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private listeners: Set<StatusCallback> = new Set();
  private pingInterval: NodeJS.Timeout | null = null;

  connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    this.setStatus('connecting');

    try {
      this.ws = new WebSocket(SERVER_URL);

      this.ws.on('open', () => {
        console.log('[ServerStatus] Connected');
        this.setStatus('connected');
        this.reconnectAttempts = 0;
        this.startPingInterval();
      });

      this.ws.on('message', (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'ping') {
            this.ws?.send(JSON.stringify({ type: 'pong' }));
          }
        } catch {
          // Ignore invalid messages
        }
      });

      this.ws.on('close', () => {
        console.log('[ServerStatus] Disconnected');
        this.setStatus('disconnected');
        this.cleanup();
        this.scheduleReconnect();
      });

      this.ws.on('error', (err) => {
        console.error('[ServerStatus] Error:', err.message);
        this.setStatus('error', err.message);
        this.cleanup();
        this.scheduleReconnect();
      });
    } catch (err) {
      console.error('[ServerStatus] Failed to create WebSocket:', err);
      this.setStatus('error', String(err));
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.cleanup();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus('disconnected');
  }

  getStatus(): ServerStatus {
    return this.status;
  }

  onStatusChange(callback: StatusCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private setStatus(status: ServerStatus, error?: string): void {
    this.status = status;
    this.listeners.forEach((cb) => cb({ status, error }));
  }

  private cleanup(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      return;
    }

    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );
    this.reconnectAttempts++;

    console.log(`[ServerStatus] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, delay);
  }

  private startPingInterval(): void {
    this.cleanup();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'pong' }));
      }
    }, 30000);
  }
}

export const serverStatusService = new ServerStatusService();