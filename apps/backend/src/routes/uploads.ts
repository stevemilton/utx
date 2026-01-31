import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';

// Configure S3 client (works with Cloudflare R2, AWS S3, etc.)
const s3Client = new S3Client({
  region: process.env.S3_REGION || 'auto',
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'utx-uploads';
const CDN_URL = process.env.CDN_URL; // Optional CDN URL

interface PresignedUrlQuery {
  filename: string;
  contentType: string;
  folder?: string;
}

export async function uploadRoutes(server: FastifyInstance): Promise<void> {
  // Get presigned URL for direct upload
  server.get<{ Querystring: PresignedUrlQuery }>(
    '/presigned-url',
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest<{ Querystring: PresignedUrlQuery }>, reply: FastifyReply) => {
      const userId = request.user!.id;
      const { filename, contentType, folder = 'workouts' } = request.query;

      // Validate content type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/heic', 'image/webp'];
      if (!allowedTypes.includes(contentType)) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid file type. Only JPEG, PNG, HEIC, and WebP images are allowed.',
        });
      }

      // Generate unique key
      const ext = filename.split('.').pop() || 'jpg';
      const uniqueId = crypto.randomUUID();
      const key = `${folder}/${userId}/${uniqueId}.${ext}`;

      try {
        const command = new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
          ContentType: contentType,
        });

        const presignedUrl = await getSignedUrl(s3Client, command, {
          expiresIn: 3600, // 1 hour
        });

        // Construct the final URL
        const finalUrl = CDN_URL
          ? `${CDN_URL}/${key}`
          : `${process.env.S3_ENDPOINT}/${BUCKET_NAME}/${key}`;

        return reply.send({
          success: true,
          data: {
            uploadUrl: presignedUrl,
            key,
            finalUrl,
          },
        });
      } catch (error) {
        request.log.error(error, 'Failed to generate presigned URL');
        return reply.status(500).send({
          success: false,
          error: 'Failed to generate upload URL',
        });
      }
    }
  );

  // Direct upload endpoint (alternative to presigned URLs)
  server.post(
    '/direct',
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id;

      const file = await request.file();

      if (!file) {
        return reply.status(400).send({
          success: false,
          error: 'No file uploaded',
        });
      }

      // Validate content type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/heic', 'image/webp'];
      if (!allowedTypes.includes(file.mimetype)) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid file type. Only JPEG, PNG, HEIC, and WebP images are allowed.',
        });
      }

      // Generate unique key
      const ext = file.filename.split('.').pop() || 'jpg';
      const uniqueId = crypto.randomUUID();
      const key = `workouts/${userId}/${uniqueId}.${ext}`;

      try {
        // Read file buffer
        const buffer = await file.toBuffer();

        const command = new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
          Body: buffer,
          ContentType: file.mimetype,
        });

        await s3Client.send(command);

        // Construct the final URL
        const finalUrl = CDN_URL
          ? `${CDN_URL}/${key}`
          : `${process.env.S3_ENDPOINT}/${BUCKET_NAME}/${key}`;

        return reply.send({
          success: true,
          data: {
            key,
            url: finalUrl,
          },
        });
      } catch (error) {
        request.log.error(error, 'Failed to upload file');
        return reply.status(500).send({
          success: false,
          error: 'Failed to upload file',
        });
      }
    }
  );

  // Upload avatar
  server.post(
    '/avatar',
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id;

      const file = await request.file();

      if (!file) {
        return reply.status(400).send({
          success: false,
          error: 'No file uploaded',
        });
      }

      // Validate content type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.mimetype)) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid file type. Only JPEG, PNG, and WebP images are allowed.',
        });
      }

      // Use consistent key for avatar (will overwrite)
      const ext = file.filename.split('.').pop() || 'jpg';
      const key = `avatars/${userId}/avatar.${ext}`;

      try {
        const buffer = await file.toBuffer();

        const command = new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
          Body: buffer,
          ContentType: file.mimetype,
        });

        await s3Client.send(command);

        const finalUrl = CDN_URL
          ? `${CDN_URL}/${key}`
          : `${process.env.S3_ENDPOINT}/${BUCKET_NAME}/${key}`;

        // Update user's avatar URL
        await server.prisma.user.update({
          where: { id: userId },
          data: { avatarUrl: finalUrl },
        });

        return reply.send({
          success: true,
          data: {
            url: finalUrl,
          },
        });
      } catch (error) {
        request.log.error(error, 'Failed to upload avatar');
        return reply.status(500).send({
          success: false,
          error: 'Failed to upload avatar',
        });
      }
    }
  );
}
