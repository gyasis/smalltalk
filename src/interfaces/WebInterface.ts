import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { BaseInterface } from './BaseInterface.js';
import { ChatMessage, InterfaceConfig } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface WebConfig extends InterfaceConfig {
  port?: number;
  host?: string;
  staticPath?: string;
  enableStaticFiles?: boolean;
  cors?: {
    origin?: string | string[];
    credentials?: boolean;
  };
  apiOnly?: boolean;
}

export class WebInterface extends BaseInterface {
  private app: express.Application;
  private server: any;
  private io: SocketIOServer;
  private webConfig: WebConfig;

  constructor(config: WebConfig = { type: 'web' }) {
    super(config);
    
    this.webConfig = {
      port: 3000,
      host: 'localhost',
      staticPath: path.join(__dirname, '../../interfaces/web'),
      enableStaticFiles: false,
      apiOnly: false,
      cors: {
        origin: "*",
        credentials: true
      },
      ...config
    };

    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: this.webConfig.cors
    });

    this.setupExpress();
    this.setupSocketIO();
  }

  private setupExpress(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Serve static files only if enabled
    if (this.webConfig.enableStaticFiles && this.webConfig.staticPath) {
      this.app.use(express.static(this.webConfig.staticPath));
      
      // Main route for HTML interface
      this.app.get('/', (req, res) => {
        if (!this.webConfig.apiOnly) {
          res.sendFile(path.join(this.webConfig.staticPath!, 'index.html'));
        } else {
          res.json({ 
            message: 'SmallTalk API Server',
            endpoints: ['/api/status', '/api/agents', '/api/chat'],
            websocket: true
          });
        }
      });
    } else if (this.webConfig.apiOnly) {
      // API-only mode - no static files
      this.app.get('/', (req, res) => {
        res.json({ 
          message: 'SmallTalk API Server',
          endpoints: ['/api/status', '/api/agents', '/api/chat'],
          websocket: true
        });
      });
    }

    // API endpoints
    this.app.get('/api/status', (req, res) => {
      res.json({ 
        status: 'running',
        interface: 'web',
        mode: this.webConfig.apiOnly ? 'api-only' : 'full',
        timestamp: new Date().toISOString(),
        connectedClients: this.getConnectedClients()
      });
    });

    this.app.get('/api/agents', (req, res) => {
      // This would be populated by the framework
      res.json({ agents: [] });
    });

    // Chat API endpoint for direct HTTP calls (alternative to WebSocket)
    this.app.post('/api/chat', async (req, res) => {
      try {
        const { message, sessionId } = req.body;
        
        if (!message) {
          return res.status(400).json({ error: 'Message is required' });
        }

        const response = await this.handleIncomingMessage(message);
        
        res.json({
          response,
          timestamp: new Date().toISOString(),
          sessionId: sessionId || 'http-session'
        });
      } catch (error) {
        res.status(500).json({
          error: 'Failed to process message',
          details: error instanceof Error ? error.message : String(error)
        });
      }
    });
  }

  private setupSocketIO(): void {
    this.io.on('connection', (socket) => {
      this.log('info', `Client connected: ${socket.id}`);
      
      socket.emit('welcome', {
        message: 'Connected to SmallTalk',
        timestamp: new Date().toISOString()
      });

      socket.on('chat_message', async (data) => {
        try {
          const { message, sessionId } = data;
          
          // Send user message to chat
          const userMessage: ChatMessage = {
            id: `${Date.now()}-user`,
            role: 'user',
            content: message,
            timestamp: new Date()
          };
          
          socket.emit('message_received', userMessage);
          
          // Process message through framework
          const response = await this.handleIncomingMessage(message);
          
          // Send response back
          const assistantMessage: ChatMessage = {
            id: `${Date.now()}-assistant`,
            role: 'assistant',
            content: response,
            timestamp: new Date()
          };
          
          socket.emit('message_response', assistantMessage);
          
        } catch (error) {
          socket.emit('error', {
            message: 'Failed to process message',
            error: error instanceof Error ? error.message : String(error)
          });
        }
      });

      socket.on('agent_switch', (data) => {
        const { agentName } = data;
        socket.emit('agent_switched', {
          agentName,
          timestamp: new Date().toISOString()
        });
      });

      socket.on('disconnect', () => {
        this.log('info', `Client disconnected: ${socket.id}`);
      });
    });
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.server.listen(this.webConfig.port, this.webConfig.host, () => {
        this.isRunning = true;
        
        const serverUrl = `http://${this.webConfig.host}:${this.webConfig.port}`;
        const mode = this.webConfig.apiOnly ? 'API-only' : 
                    this.webConfig.enableStaticFiles ? 'Full Web' : 'API + WebSocket';
        
        this.log('info', `SmallTalk ${mode} server started on ${serverUrl}`);
        
        if (this.webConfig.apiOnly) {
          this.log('info', 'Available endpoints: /api/status, /api/agents, /api/chat');
          this.log('info', 'WebSocket available for real-time communication');
        } else if (this.webConfig.enableStaticFiles) {
          this.log('info', 'HTML chat interface available at root URL');
          this.log('info', 'API endpoints and WebSocket also available');
        }
        
        this.emit('interface_started');
        resolve();
      });

      this.server.on('error', (error: Error) => {
        this.log('error', 'Failed to start web interface', error);
        reject(error);
      });
    });
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    return new Promise((resolve) => {
      this.server.close(() => {
        this.isRunning = false;
        this.log('info', 'Web interface stopped');
        this.emit('interface_stopped');
        resolve();
      });
    });
  }

  public async sendMessage(message: ChatMessage): Promise<void> {
    this.io.emit('new_message', message);
  }

  public broadcastAgentList(agents: string[]): void {
    this.io.emit('agents_updated', { agents });
  }

  public getConnectedClients(): number {
    return this.io.engine.clientsCount;
  }
}