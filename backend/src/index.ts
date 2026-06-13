import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import http from 'http';
import dotenv from 'dotenv';

dotenv.config();

import pipelineRoutes from './routes/api/v1/pipelines';
import analyticsRoutes from './routes/api/v1/analytics';
import paymentRoutes from './routes/api/v1/payments';
// import webhookRoutes from './routes/api/v1/webhooks';
import { handleLogStream } from './services/logStreamer';

// Background worker bypassed for synchronous local demo
// import './worker';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());

// Stripe webhook needs raw body for signature verification
app.use('/api/v1/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

// Routes
app.use('/api/v1/pipelines', pipelineRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/payments', paymentRoutes);
// app.use('/api/v1/webhooks', webhookRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'deployguard-api' });
});

// Create HTTP server
const server = http.createServer(app);

// Attach WebSocket server
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('New WebSocket connection established');
  
  ws.on('message', (message: string) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'SUBSCRIBE_LOGS') {
        const pipelineId = data.pipelineId || 'unknown';
        handleLogStream(ws, pipelineId);
      }
    } catch (e) {
      console.error('WebSocket message parsing error:', e);
    }
  });
});

server.listen(port, () => {
  console.log(`HTTP and WebSocket Server running on port ${port}`);
});
