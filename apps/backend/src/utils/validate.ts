import { ZodSchema, ZodError } from 'zod';
import { FastifyReply } from 'fastify';

/**
 * Validates request body against a Zod schema.
 * Returns the validated data or null if validation fails.
 * Automatically sends a 400 response with error details on failure.
 */
export function validateBody<T>(
  schema: ZodSchema<T>,
  body: unknown,
  reply: FastifyReply
): T | null {
  try {
    return schema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      const firstError = error.errors[0];
      reply.status(400).send({
        success: false,
        error: firstError?.message || 'Validation failed',
        details: error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
    } else {
      reply.status(400).send({
        success: false,
        error: 'Validation failed',
      });
    }
    return null;
  }
}

/**
 * Validates query parameters against a Zod schema.
 * Returns the validated data or null if validation fails.
 */
export function validateQuery<T>(
  schema: ZodSchema<T>,
  query: unknown,
  reply: FastifyReply
): T | null {
  try {
    return schema.parse(query);
  } catch (error) {
    if (error instanceof ZodError) {
      const firstError = error.errors[0];
      reply.status(400).send({
        success: false,
        error: firstError?.message || 'Invalid query parameters',
        details: error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
    } else {
      reply.status(400).send({
        success: false,
        error: 'Invalid query parameters',
      });
    }
    return null;
  }
}
