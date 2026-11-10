import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import { InvalidFileTypeError } from './config/multer';
// 1. Naye Imports add kiye hain
import { createServer } from 'http';
import { Server } from 'socket.io';

// Routes imports (Aapke project ke hisaab se)
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import cropRoutes from './routes/crop.routes';
import orderRoutes from './routes/order.routes';
import deliveryRoutes from './routes/delivery.routes';
import adminRoutes from './routes/admin.routes';
import paymentRoutes from './routes/payment.routes';
import walletRoutes from './routes/wallet.routes';
import analyticsRoutes from './routes/analytics.routes';
import supplierRoutes from './routes/supplier.routes';
import reviewRoutes from './routes/review.routes';
import complaintRoutes from './routes/complaint.routes';
import notificationRoutes from './routes/notification.routes';
import locationRoutes from './routes/location.routes';

// Abhi error dega kyunki file banani baaki hai, par yahi iski sahi jagah hai
import { initSocket } from './sockets/socket.handler'; 
import { startCronJobs } from './services/cron.service';

dotenv.config();

const app = express();

// 2. HTTP Server manually banaya aur Express (app) ko uske andar daala
const httpServer = createServer(app);

// 3. Socket.io Tower ko us HTTP server ke upar fit kiya
export const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
  // Clients only send short IDs, so reject large messages (default is 1 MB).
  maxHttpBufferSize: 10_000,
});

// Middlewares
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(express.urlencoded({ extended: true }));

// Express Routes (Standard HTTP)
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/crops', cropRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/delivery', deliveryRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/wallet', walletRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/suppliers', supplierRoutes);
app.use('/api/v1/reviews', reviewRoutes);
app.use('/api/v1/complaints', complaintRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/location', locationRoutes);

// Health Check API
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

const UPLOAD_ERROR_MESSAGES: Partial<Record<multer.ErrorCode, string>> = {
  LIMIT_FILE_SIZE: 'Each photo must be 5 MB or smaller.',
  LIMIT_FILE_COUNT: 'Too many photos were sent.',
  LIMIT_UNEXPECTED_FILE: 'Too many photos were sent.',
};

// Errors passed to next(), such as rejected uploads, get a JSON reply the frontend can show.
// Without this, Express sends its own HTML error page.
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof multer.MulterError) {
    res.status(400).json({
      success: false,
      code: err.code,
      message: UPLOAD_ERROR_MESSAGES[err.code] ?? 'Photo upload failed.',
    });
    return;
  }

  if (err instanceof InvalidFileTypeError) {
    res.status(400).json({ success: false, code: 'INVALID_FILE_TYPE', message: err.message });
    return;
  }

  // Errors from body parsing carry their own status, and expose=true when the message is safe to show.
  const { status, expose, message } = err as { status?: number; expose?: boolean; message?: string };
  const httpStatus = typeof status === 'number' && status >= 400 && status < 600 ? status : 500;
  if (httpStatus >= 500) console.error('Unhandled error:', err);
  res.status(httpStatus).json({
    success: false,
    message: expose && message ? message : 'Something went wrong. Please try again.',
  });
});

// 4. Socket Handler ko initialize karna
initSocket(io);
startCronJobs();

const PORT = process.env.PORT || 5000;

// 5. IMPORTANT: Ab app.listen nahi, httpServer.listen hoga!
httpServer.listen(PORT, () => {
  console.log(`🚀 HTTP & Real-Time Server running on port ${PORT}`);
});
