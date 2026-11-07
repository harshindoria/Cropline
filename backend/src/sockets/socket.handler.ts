import { Server, Socket } from 'socket.io';
import { OrderStatus } from '@prisma/client';
import prisma from '../config/db';
import { verifyToken } from '../utils/jwtUtils';
import { ACTIVE_JOB } from '../utils/deliveryJob';

// Global variable io instance ko memory mein store karne ke liye
let _io: Server | undefined;

// Controllers (jaise delivery.controller) is function ko call karke
// io instance le sakte hain bina circular dependency error ke
export const getIO = (): Server => {
  if (!_io) {
    throw new Error('Socket.io has not been initialized.');
  }
  return _io;
};

const MAX_ORDER_ROOMS_PER_SOCKET = 10;
const MAX_JOINS_PER_MINUTE = 30;
const MAX_ID_LENGTH = 64;
// setTimeout overflows above this value and would fire immediately (30d tokens exceed it).
const MAX_TIMEOUT_MS = 2_147_483_647;

// Location is never broadcast for these orders, so there is nothing to track.
const CLOSED_ORDER_STATUSES = new Set<OrderStatus>([
  OrderStatus.DELIVERED,
  OrderStatus.COMPLETED,
  OrderStatus.CANCELLED,
  OrderStatus.DISPUTED,
]);

type JoinOrderResult = { ok: true } | { ok: false; code: string };

// Live driver location is limited to the buyer and the assigned delivery partner.
// Missing and forbidden orders look identical, so order IDs can't be probed.
const canTrackOrder = async (userId: string, orderId: string): Promise<boolean> => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      buyerId: true,
      status: true,
      deliveryJobs: { where: ACTIVE_JOB, select: { deliveryPartnerId: true } },
    },
  });

  if (!order || CLOSED_ORDER_STATUSES.has(order.status)) return false;
  return order.buyerId === userId || order.deliveryJobs.some((job) => job.deliveryPartnerId === userId);
};

const isValidId = (id: unknown): id is string =>
  typeof id === 'string' && id.length > 0 && id.length <= MAX_ID_LENGTH;

// Disconnects a user's live sockets, e.g. when an admin suspends the account.
// Auth only runs at handshake, so an open connection would otherwise keep receiving events.
export const disconnectUser = (userId: string): void => {
  _io?.in(`user:${userId}`).disconnectSockets(true);
};

// Main initialization function jo index.ts se call hoga
export const initSocket = (io: Server): void => {
  _io = io;

  // Every connection must present a valid JWT. Same checks as the HTTP `protect` middleware.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== 'string' || !token) {
        next(new Error('AUTH_REQUIRED'));
        return;
      }

      const decoded = verifyToken(token);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, isActive: true },
      });

      if (!user || !user.isActive) {
        next(new Error('AUTH_FAILED'));
        return;
      }

      socket.data.userId = user.id;
      socket.data.tokenExp = decoded.exp;
      next();
    } catch {
      next(new Error('AUTH_FAILED'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId: string = socket.data.userId;

    // Personal room is assigned by the server from the verified token.
    // There is deliberately no client event for this.
    socket.join(`user:${userId}`);

    // Close the connection when the token expires.
    let expiryTimer: NodeJS.Timeout | undefined;
    if (socket.data.tokenExp) {
      const msLeft = socket.data.tokenExp * 1000 - Date.now();
      expiryTimer = setTimeout(() => socket.disconnect(true), Math.min(msLeft, MAX_TIMEOUT_MS));
    }

    let joinWindowStart = Date.now();
    let joinsInWindow = 0;

    // Order tracking room: only after an ownership check.
    socket.on('join:order', async (orderId: unknown, ack?: unknown) => {
      const reply = (result: JoinOrderResult) => {
        if (typeof ack === 'function') ack(result);
      };

      try {
        // Each attempt hits the database, so limit how often a client can try.
        if (Date.now() - joinWindowStart > 60_000) {
          joinWindowStart = Date.now();
          joinsInWindow = 0;
        }
        if (++joinsInWindow > MAX_JOINS_PER_MINUTE) {
          reply({ ok: false, code: 'RATE_LIMITED' });
          return;
        }

        const orderRooms = [...socket.rooms].filter((room) => room.startsWith('order:'));
        if (orderRooms.length >= MAX_ORDER_ROOMS_PER_SOCKET) {
          reply({ ok: false, code: 'TOO_MANY_ROOMS' });
          return;
        }

        if (!isValidId(orderId) || !(await canTrackOrder(userId, orderId))) {
          reply({ ok: false, code: 'ORDER_ACCESS_DENIED' });
          return;
        }

        await socket.join(`order:${orderId}`);
        reply({ ok: true });
      } catch (error) {
        console.error('[Socket] join:order failed:', error);
        reply({ ok: false, code: 'SERVER_ERROR' });
      }
    });

    socket.on('leave:order', (orderId: unknown) => {
      if (isValidId(orderId)) socket.leave(`order:${orderId}`);
    });

    socket.on('disconnect', () => {
      if (expiryTimer) clearTimeout(expiryTimer);
    });
  });
};
