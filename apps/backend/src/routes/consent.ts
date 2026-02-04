import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ConsentType } from '@prisma/client';

// Policy versions - increment when policies are updated
const POLICY_VERSIONS = {
  terms: '1.0.0',
  privacy: '1.0.0',
  marketing: '1.0.0',
  analytics: '1.0.0',
  coach_sharing: '1.0.0',
};

interface ConsentItem {
  consentType: ConsentType;
  granted: boolean;
}

interface SaveConsentsBody {
  consents: ConsentItem[];
  appVersion: string;
}

interface UpdateConsentBody {
  granted: boolean;
  appVersion: string;
}

// Helper to get client IP address
function getClientIp(request: FastifyRequest): string | null {
  const forwarded = request.headers['x-forwarded-for'];
  if (forwarded) {
    const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return ip.split(',')[0].trim();
  }
  return request.ip || null;
}

export async function consentRoutes(server: FastifyInstance) {
  const prisma = server.prisma;

  // POST /consent - Save multiple consents (during onboarding)
  server.post<{ Body: SaveConsentsBody }>(
    '/',
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest<{ Body: SaveConsentsBody }>, reply: FastifyReply) => {
      const userId = (request as any).userId;
      const { consents, appVersion } = request.body;

      if (!consents || !Array.isArray(consents) || consents.length === 0) {
        return reply.status(400).send({
          success: false,
          error: 'Consents array is required',
        });
      }

      const ipAddress = getClientIp(request);
      const savedConsents = [];

      for (const consent of consents) {
        const { consentType, granted } = consent;

        // Validate consent type
        if (!Object.values(ConsentType).includes(consentType)) {
          return reply.status(400).send({
            success: false,
            error: `Invalid consent type: ${consentType}`,
          });
        }

        const policyVersion = POLICY_VERSIONS[consentType as keyof typeof POLICY_VERSIONS];

        // Upsert consent record
        const savedConsent = await prisma.userConsent.upsert({
          where: {
            userId_consentType: {
              userId,
              consentType,
            },
          },
          update: {
            granted,
            policyVersion,
            ipAddress,
            appVersion,
            grantedAt: granted ? new Date() : undefined,
            revokedAt: !granted ? new Date() : null,
          },
          create: {
            userId,
            consentType,
            granted,
            policyVersion,
            ipAddress,
            appVersion,
          },
        });

        savedConsents.push(savedConsent);
      }

      return reply.send({
        success: true,
        data: { consents: savedConsents },
      });
    }
  );

  // GET /consent - Get current user's consent status
  server.get(
    '/',
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request as any).userId;

      const consents = await prisma.userConsent.findMany({
        where: { userId },
        orderBy: { consentType: 'asc' },
      });

      // Return current consent state with policy versions
      const consentStatus = Object.values(ConsentType).map((type) => {
        const existing = consents.find((c) => c.consentType === type);
        return {
          consentType: type,
          granted: existing?.granted ?? false,
          policyVersion: POLICY_VERSIONS[type as keyof typeof POLICY_VERSIONS],
          currentVersion: existing?.policyVersion,
          grantedAt: existing?.grantedAt,
          revokedAt: existing?.revokedAt,
          needsReConsent: existing
            ? existing.policyVersion !== POLICY_VERSIONS[type as keyof typeof POLICY_VERSIONS]
            : false,
        };
      });

      return reply.send({
        success: true,
        data: { consents: consentStatus },
      });
    }
  );

  // PATCH /consent/:type - Update single consent (from Settings > Privacy)
  server.patch<{ Params: { type: string }; Body: UpdateConsentBody }>(
    '/:type',
    { preHandler: [server.authenticate] },
    async (
      request: FastifyRequest<{ Params: { type: string }; Body: UpdateConsentBody }>,
      reply: FastifyReply
    ) => {
      const userId = (request as any).userId;
      const { type } = request.params;
      const { granted, appVersion } = request.body;

      // Validate consent type
      if (!Object.values(ConsentType).includes(type as ConsentType)) {
        return reply.status(400).send({
          success: false,
          error: `Invalid consent type: ${type}`,
        });
      }

      const consentType = type as ConsentType;

      // Don't allow revoking required consents
      if ((consentType === 'terms' || consentType === 'privacy') && !granted) {
        return reply.status(400).send({
          success: false,
          error: 'Cannot revoke required consent. To withdraw, please delete your account.',
        });
      }

      const ipAddress = getClientIp(request);
      const policyVersion = POLICY_VERSIONS[consentType as keyof typeof POLICY_VERSIONS];

      const updatedConsent = await prisma.userConsent.upsert({
        where: {
          userId_consentType: {
            userId,
            consentType,
          },
        },
        update: {
          granted,
          policyVersion,
          ipAddress,
          appVersion,
          grantedAt: granted ? new Date() : undefined,
          revokedAt: !granted ? new Date() : null,
        },
        create: {
          userId,
          consentType,
          granted,
          policyVersion,
          ipAddress,
          appVersion,
        },
      });

      return reply.send({
        success: true,
        data: updatedConsent,
      });
    }
  );

  // GET /consent/required - Check if user has accepted required consents
  server.get(
    '/required',
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request as any).userId;

      const requiredTypes: ConsentType[] = ['terms', 'privacy'];

      const consents = await prisma.userConsent.findMany({
        where: {
          userId,
          consentType: { in: requiredTypes },
          granted: true,
        },
      });

      const acceptedTypes = consents.map((c) => c.consentType);
      const missingConsents = requiredTypes.filter((type) => !acceptedTypes.includes(type));

      return reply.send({
        success: true,
        data: {
          hasRequiredConsents: missingConsents.length === 0,
          missingConsents,
        },
      });
    }
  );
}
