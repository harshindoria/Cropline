import { Server, Socket } from 'socket.io';

// Global variable io instance ko memory mein store karne ke liye
let _io: Server;

// Controllers (jaise delivery.controller) is function ko call karke 
// io instance le sakte hain bina circular dependency error ke
export const getIO = (): Server => {
  if (!_io) {
    throw new Error('Socket.io has not been initialized.');
  }
  return _io;
};

// Main initialization function jo index.ts se call hoga
export const initSocket = (io: Server): void => {
  _io = io;

  // Jab bhi koi naya client (walkie-talkie) connect hoga
  io.on('connection', (socket: Socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // ── EVENT 1: PERSONAL ROOM ───────────────────────────────────────────
    // Frontend app khulte hi apna user ID bhejegi taaki hum use uske 
    // personal notification kamre mein bitha sakein.
    socket.on('join:user', (userId: string) => {
      if (!userId) return;
      
      socket.join(`user:${userId}`);
      console.log(`[Socket] Client ${socket.id} joined room: user:${userId}`);
    });

    // ── EVENT 2: ORDER TRACKING ROOM ─────────────────────────────────────
    // Buyer aur Delivery Partner map screen kholte hi is order ke 
    // specific kamre mein aayenge taaki live location broadcast ho sake.
    socket.on('join:order', (orderId: string) => {
      if (!orderId) return;
      
      socket.join(`order:${orderId}`);
      console.log(`[Socket] Client ${socket.id} joined room: order:${orderId}`);
    });

    // ── EVENT 3: DISCONNECT ──────────────────────────────────────────────
    // Jab user app close kar de, ya tunnel mein jane se internet chala jaye
    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });
};