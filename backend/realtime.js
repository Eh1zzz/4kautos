import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { toId } from './utils/validation.js';
import { findById as findCarById } from './models/Car.js';
import { getRedis } from './config/redis.js';

/* Real-time layer (Socket.IO) for buyer↔seller chat.
   - Every socket authenticates with the same JWT used for REST.
   - Each user joins a personal room (user:<id>) for unread-badge nudges.
   - A user may only join a thread room (thread:<carId>:<buyerId>) if they are
     actually a party to it (the buyer, or the car's seller).
   The messages REST route pushes a lightweight "reload this thread" nudge to the
   room on every new message — the client then re-fetches via REST, so the socket
   is purely a low-latency signal and everything still works if it's unavailable. */
export async function initRealtime(httpServer, isAllowedOrigin) {
  const io = new Server(httpServer, {
    serveClient: false,
    cors: { origin: (origin, cb) => cb(null, isAllowedOrigin(origin)), credentials: false },
  });

  // Multi-instance: with the Redis adapter, a message emitted on one replica
  // reaches sockets connected to ANY replica. Without it (single node), the
  // default in-memory adapter is correct. Sticky sessions are an alternative,
  // but the adapter avoids requiring LB affinity.
  const redis = getRedis();
  if (redis) {
    try {
      const { createAdapter } = await import('@socket.io/redis-adapter');
      io.adapter(createAdapter(redis, redis.duplicate()));
      console.log('🔌 Socket.IO using Redis adapter (cross-replica broadcast)');
    } catch (err) {
      console.warn('Socket.IO Redis adapter unavailable — single-node broadcast:', err.message);
    }
  }

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('unauthorized'));
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = { id: payload.id, role: payload.role };
      next();
    } catch { next(new Error('unauthorized')); }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.user.id}`); // personal room for notifications

    socket.on('thread:join', async ({ carId, buyerId } = {}) => {
      try {
        const cId = toId(carId), bId = toId(buyerId);
        if (!cId || !bId) return;
        const car = await findCarById(cId);
        if (!car) return;
        // Authorise: only the buyer or the car's seller may listen to this thread.
        if (socket.user.id === bId || socket.user.id === car.seller_id)
          socket.join(`thread:${cId}:${bId}`);
      } catch { /* ignore */ }
    });

    socket.on('thread:leave', ({ carId, buyerId } = {}) => {
      const cId = toId(carId), bId = toId(buyerId);
      if (cId && bId) socket.leave(`thread:${cId}:${bId}`);
    });
  });

  return io;
}

// Helpers the messages route uses to push nudges (kept here so room names stay in one place).
export const threadRoom = (carId, buyerId) => `thread:${carId}:${buyerId}`;
export const userRoom = (userId) => `user:${userId}`;
