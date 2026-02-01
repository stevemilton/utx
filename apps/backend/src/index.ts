import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import jwt from '@fastify/jwt';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Middleware
import { authenticate, optionalAuth } from './middleware/auth.js';

// Routes - MVP Core
import { authRoutes } from './routes/auth.js';
import { usersRoutes } from './routes/users.js';
import { workoutRoutes } from './routes/workouts.js';
import { feedRoutes } from './routes/feed.js';
import { pbsRoutes } from './routes/pbs.js';
import { clubsRoutes } from './routes/clubs.js';
import { leaderboardsRoutes } from './routes/leaderboards.js';
import { stravaRoutes } from './routes/strava.js';

dotenv.config();

const prisma = new PrismaClient();

const server = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport:
      process.env.NODE_ENV !== 'production'
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
            },
          }
        : undefined,
  },
  // Increase body size limit for OCR endpoint (base64 images can be 5-10MB)
  bodyLimit: 15 * 1024 * 1024, // 15MB
});

// Plugins
server.register(cors, {
  origin: true, // Allow all origins in development
  credentials: true,
});

server.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
});

// Register JWT plugin
server.register(jwt, {
  secret: process.env.JWT_SECRET || 'utx-development-secret-change-in-production',
});

// Decorate with prisma
server.decorate('prisma', prisma);

// Decorate with auth middleware
server.decorate('authenticate', authenticate);
server.decorate('optionalAuth', optionalAuth);

// Health check
server.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Register routes - MVP Core
server.register(authRoutes, { prefix: '/auth' });
server.register(usersRoutes, { prefix: '/users' });
server.register(workoutRoutes, { prefix: '/workouts' });
server.register(feedRoutes, { prefix: '/feed' });
server.register(pbsRoutes, { prefix: '/pbs' });
server.register(clubsRoutes, { prefix: '/clubs' });
server.register(leaderboardsRoutes, { prefix: '/leaderboards' });
server.register(stravaRoutes, { prefix: '/strava' });

// Error handler
server.setErrorHandler((error: Error & { statusCode?: number }, request, reply) => {
  server.log.error(error);

  reply.status(error.statusCode || 500).send({
    success: false,
    error: error.message || 'Internal Server Error',
  });
});

// Startup
const start = async () => {
  try {
    await prisma.$connect();
    server.log.info('Connected to database');

    const port = parseInt(process.env.PORT || '3000', 10);
    const host = process.env.HOST || '0.0.0.0';

    await server.listen({ port, host });
    server.log.info(`Server listening on ${host}:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async () => {
  server.log.info('Shutting down...');
  await prisma.$disconnect();
  await server.close();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();

// Type declarations
declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    authenticate: typeof authenticate;
    optionalAuth: typeof optionalAuth;
  }
}

// Note: @fastify/jwt types are handled in middleware/auth.ts
// We use our own AuthenticatedUser type for request.user
