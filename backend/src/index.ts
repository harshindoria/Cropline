import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
// 1. Naye Imports add kiye hain
import { createServer } from 'http';
import { Server } from 'socket.io';

// Routes imports (Aapke project ke hisaab se)
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import cropRoutes from './routes/crop.routes';
import orderRoutes from './routes/order.routes';
import deliveryRoutes from './routes/delivery.routes';

// Abhi error dega kyunki file banani baaki hai, par yahi iski sahi jagah hai
import { initSocket } from './sockets/socket.handler'; 

dotenv.config();

const app = express();

// 2. HTTP Server manually banaya aur Express (app) ko uske andar daala
const httpServer = createServer(app);

// 3. Socket.io Tower ko us HTTP server ke upar fit kiya
export const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  },
});

// Middlewares
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Express Routes (Standard HTTP)
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/crops', cropRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/delivery', deliveryRoutes);

// Health Check API
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// 4. Socket Handler ko initialize karna
initSocket(io);

const PORT = process.env.PORT || 5000;

// 5. IMPORTANT: Ab app.listen nahi, httpServer.listen hoga!
httpServer.listen(PORT, () => {
  console.log(`🚀 HTTP & Real-Time Server running on port ${PORT}`);
});
