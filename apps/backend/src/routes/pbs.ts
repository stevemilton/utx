import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface GetPBsParams {
  userId: string;
}

interface UpdatePBBody {
  distanceMetres: number;
  timeSeconds: number;
  split?: number;
  watts?: number;
  strokeRate?: number;
  achievedAt?: string;
}

export async function pbRoutes(server: FastifyInstance): Promise<void> {
  // Get user's personal bests
  server.get<{ Params: GetPBsParams }>(
    '/users/:userId',
    async (request: FastifyRequest<{ Params: GetPBsParams }>, reply: FastifyReply) => {
      const { userId } = request.params;

      const pbs = await server.prisma.personalBest.findMany({
        where: { userId },
        include: {
          workout: {
            select: {
              id: true,
              workoutDate: true,
            },
          },
        },
        orderBy: { distanceMetres: 'asc' },
      });

      // Get user info
      const user = await server.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          displayName: true,
          username: true,
          avatarUrl: true,
          gender: true,
          weightKg: true,
          birthDate: true,
        },
      });

      return reply.send({
        success: true,
        data: {
          user,
          personalBests: pbs,
        },
      });
    }
  );

  // Get current user's personal bests
  server.get(
    '/me',
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id;

      const pbs = await server.prisma.personalBest.findMany({
        where: { userId },
        include: {
          workout: {
            select: {
              id: true,
              workoutDate: true,
              photoUrl: true,
            },
          },
        },
        orderBy: { distanceMetres: 'asc' },
      });

      return reply.send({
        success: true,
        data: { personalBests: pbs },
      });
    }
  );

  // Manually add or update a PB
  server.post<{ Body: UpdatePBBody }>(
    '/me',
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest<{ Body: UpdatePBBody }>, reply: FastifyReply) => {
      const userId = request.user!.id;
      const { distanceMetres, timeSeconds, split, watts, strokeRate, achievedAt } = request.body;

      // Validate standard distance
      const standardDistances = [500, 1000, 2000, 5000, 6000, 10000, 21097, 42195];
      if (!standardDistances.includes(distanceMetres)) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid distance. Must be a standard erg distance.',
        });
      }

      // Calculate split if not provided
      const calculatedSplit = split || (timeSeconds / distanceMetres) * 500;

      const pb = await server.prisma.personalBest.upsert({
        where: {
          userId_distanceMetres: {
            userId,
            distanceMetres,
          },
        },
        update: {
          timeSeconds,
          split: calculatedSplit,
          watts,
          strokeRate,
          achievedAt: achievedAt ? new Date(achievedAt) : new Date(),
        },
        create: {
          userId,
          distanceMetres,
          timeSeconds,
          split: calculatedSplit,
          watts,
          strokeRate,
          achievedAt: achievedAt ? new Date(achievedAt) : new Date(),
        },
      });

      return reply.send({
        success: true,
        data: { personalBest: pb },
      });
    }
  );

  // Delete a PB
  server.delete<{ Params: { distance: string } }>(
    '/me/:distance',
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest<{ Params: { distance: string } }>, reply: FastifyReply) => {
      const userId = request.user!.id;
      const distanceMetres = parseInt(request.params.distance, 10);

      await server.prisma.personalBest.deleteMany({
        where: {
          userId,
          distanceMetres,
        },
      });

      return reply.send({
        success: true,
        message: 'Personal best deleted',
      });
    }
  );

  // Get PB history for a specific distance
  server.get<{ Params: { distance: string } }>(
    '/me/:distance/history',
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest<{ Params: { distance: string } }>, reply: FastifyReply) => {
      const userId = request.user!.id;
      const distanceMetres = parseInt(request.params.distance, 10);
      const tolerance = distanceMetres * 0.01; // 1% tolerance

      // Get all workouts at this distance
      const workouts = await server.prisma.workout.findMany({
        where: {
          userId,
          totalDistanceMetres: {
            gte: distanceMetres - tolerance,
            lte: distanceMetres + tolerance,
          },
        },
        select: {
          id: true,
          totalTimeSeconds: true,
          avgSplit: true,
          avgWatts: true,
          avgStrokeRate: true,
          workoutDate: true,
        },
        orderBy: { workoutDate: 'asc' },
      });

      // Calculate running best
      let runningBest = Infinity;
      const history = workouts.map((w) => {
        const isPB = w.totalTimeSeconds < runningBest;
        if (isPB) {
          runningBest = w.totalTimeSeconds;
        }
        return {
          ...w,
          isPB,
        };
      });

      return reply.send({
        success: true,
        data: { history },
      });
    }
  );

  // Compare PBs with another user
  server.get<{ Params: { userId: string } }>(
    '/compare/:userId',
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest<{ Params: { userId: string } }>, reply: FastifyReply) => {
      const currentUserId = request.user!.id;
      const { userId: otherUserId } = request.params;

      const [myPBs, theirPBs] = await Promise.all([
        server.prisma.personalBest.findMany({
          where: { userId: currentUserId },
          orderBy: { distanceMetres: 'asc' },
        }),
        server.prisma.personalBest.findMany({
          where: { userId: otherUserId },
          orderBy: { distanceMetres: 'asc' },
        }),
      ]);

      // Get user info
      const otherUser = await server.prisma.user.findUnique({
        where: { id: otherUserId },
        select: {
          id: true,
          displayName: true,
          username: true,
          avatarUrl: true,
        },
      });

      // Merge into comparison
      const distances = new Set([
        ...myPBs.map((p) => p.distanceMetres),
        ...theirPBs.map((p) => p.distanceMetres),
      ]);

      const comparison = Array.from(distances)
        .sort((a, b) => a - b)
        .map((distance) => {
          const myPB = myPBs.find((p) => p.distanceMetres === distance);
          const theirPB = theirPBs.find((p) => p.distanceMetres === distance);

          let difference = null;
          let winner = null;

          if (myPB && theirPB) {
            difference = myPB.timeSeconds - theirPB.timeSeconds;
            winner = difference < 0 ? 'me' : difference > 0 ? 'them' : 'tie';
          }

          return {
            distanceMetres: distance,
            myPB: myPB
              ? {
                  timeSeconds: myPB.timeSeconds,
                  split: myPB.split,
                  achievedAt: myPB.achievedAt,
                }
              : null,
            theirPB: theirPB
              ? {
                  timeSeconds: theirPB.timeSeconds,
                  split: theirPB.split,
                  achievedAt: theirPB.achievedAt,
                }
              : null,
            difference,
            winner,
          };
        });

      return reply.send({
        success: true,
        data: {
          otherUser,
          comparison,
        },
      });
    }
  );
}
