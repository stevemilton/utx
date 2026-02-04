import { z } from 'zod';

// ============================================
// COMMON SCHEMAS
// ============================================

export const emailSchema = z
  .string()
  .email('Please enter a valid email address')
  .transform((val) => val.toLowerCase().trim());

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/\d/, 'Password must contain at least one number');

export const nameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(100, 'Name must be 100 characters or less')
  .transform((val) => val.trim());

export const uuidSchema = z.string().uuid('Invalid ID format');

// ============================================
// AUTH SCHEMAS
// ============================================

export const registerEmailSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: nameSchema,
});

export const loginEmailSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export const requestResetSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: passwordSchema,
});

export const resendVerificationSchema = z.object({
  email: emailSchema,
});

// ============================================
// WORKOUT SCHEMAS
// ============================================

export const createWorkoutSchema = z.object({
  photoUrl: z.string().url().optional().nullable(),
  workoutType: z.string().min(1, 'Workout type is required'),
  machineType: z.enum(['row', 'bike', 'ski']).optional().default('row'),
  totalTimeSeconds: z
    .number()
    .positive('Time must be positive')
    .max(86400, 'Time cannot exceed 24 hours'),
  totalDistanceMetres: z
    .number()
    .positive('Distance must be positive')
    .max(100000, 'Distance cannot exceed 100km'),
  avgSplit: z.number().positive(),
  avgStrokeRate: z.number().min(10, 'Stroke rate must be at least 10').max(60, 'Stroke rate cannot exceed 60').optional().nullable(),
  avgWatts: z.number().positive().optional().nullable(),
  avgHeartRate: z.number().min(30, 'Heart rate must be at least 30').max(250, 'Heart rate cannot exceed 250').optional().nullable(),
  maxHeartRate: z.number().min(30, 'Max heart rate must be at least 30').max(250, 'Max heart rate cannot exceed 250').optional().nullable(),
  calories: z.number().nonnegative().optional().nullable(),
  dragFactor: z.number().positive().optional().nullable(),
  intervals: z.array(z.any()).optional().nullable(),
  hrData: z.any().optional().nullable(),
  notes: z.string().max(2000, 'Notes cannot exceed 2000 characters').optional().nullable(),
  workoutDate: z.string().optional().nullable(),
  isPublic: z.boolean().optional().default(false),
});

export const updateWorkoutSchema = z.object({
  notes: z.string().max(2000, 'Notes cannot exceed 2000 characters').optional().nullable(),
  workoutType: z.string().optional(),
  workoutDate: z.string().optional().nullable(),
  totalDistanceMetres: z.number().positive().max(100000).optional(),
  totalTimeSeconds: z.number().positive().max(86400).optional(),
  avgSplit: z.number().positive().optional().nullable(),
  avgStrokeRate: z.number().min(10).max(60).optional().nullable(),
  avgWatts: z.number().positive().optional().nullable(),
  avgHeartRate: z.number().min(30).max(250).optional().nullable(),
  maxHeartRate: z.number().min(30).max(250).optional().nullable(),
  calories: z.number().nonnegative().optional().nullable(),
  dragFactor: z.number().positive().optional().nullable(),
  isPublic: z.boolean().optional(),
  machineType: z.enum(['row', 'bike', 'ski']).optional(),
});

// ============================================
// CLUB SCHEMAS
// ============================================

export const createClubSchema = z.object({
  name: z
    .string()
    .min(2, 'Club name must be at least 2 characters')
    .max(100, 'Club name must be 100 characters or less')
    .transform((val) => val.trim()),
  location: z.string().max(200, 'Location cannot exceed 200 characters').optional().transform((val) => val?.trim()),
});

export const joinClubSchema = z.object({
  inviteCode: z
    .string()
    .min(1, 'Invite code is required')
    .transform((val) => val.toUpperCase()),
});

export const joinRequestSchema = z.object({
  message: z.string().max(500, 'Message cannot exceed 500 characters').optional(),
});

export const rejectRequestSchema = z.object({
  reason: z.string().max(500, 'Reason cannot exceed 500 characters').optional(),
});

export const changeMemberRoleSchema = z.object({
  role: z.enum(['admin', 'member'], {
    errorMap: () => ({ message: 'Role must be "admin" or "member"' }),
  }),
});

// ============================================
// COMMENT SCHEMAS
// ============================================

export const commentSchema = z.object({
  content: z
    .string()
    .min(1, 'Comment cannot be empty')
    .max(1000, 'Comment cannot exceed 1000 characters')
    .transform((val) => val.trim()),
});

// ============================================
// TYPE EXPORTS
// ============================================

export type RegisterEmailInput = z.infer<typeof registerEmailSchema>;
export type LoginEmailInput = z.infer<typeof loginEmailSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type RequestResetInput = z.infer<typeof requestResetSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
export type CreateWorkoutInput = z.infer<typeof createWorkoutSchema>;
export type UpdateWorkoutInput = z.infer<typeof updateWorkoutSchema>;
export type CreateClubInput = z.infer<typeof createClubSchema>;
export type JoinClubInput = z.infer<typeof joinClubSchema>;
export type JoinRequestInput = z.infer<typeof joinRequestSchema>;
export type RejectRequestInput = z.infer<typeof rejectRequestSchema>;
export type ChangeMemberRoleInput = z.infer<typeof changeMemberRoleSchema>;
export type CommentInput = z.infer<typeof commentSchema>;
