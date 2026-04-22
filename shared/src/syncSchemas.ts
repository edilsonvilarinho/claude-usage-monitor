import { z } from 'zod';

export const SyncDailySnapshotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  maxWeekly: z.number().int().min(0),
  maxSession: z.number().int().min(0),
  maxCredits: z.number().int().min(0).max(100).optional(),
  sessionWindowCount: z.number().int().min(0),
  sessionAccum: z.number().int().min(0),
  updatedAt: z.number().int().positive(),
  updatedByDevice: z.string().min(1),
});

export const SyncSessionWindowSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  resetsAt: z.string().min(1),
  resetsAtMinute: z.number().int().positive(),
  peak: z.number().int().min(0),
  updatedAt: z.number().int().positive(),
});

export const SyncTimeSeriesPointSchema = z.object({
  ts: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  session: z.number().int().min(0),
  weekly: z.number().int().min(0),
  credits: z.number().int().min(0).max(100).optional(),
});

export const SyncUsageSnapshotSchema = z.object({
  ts: z.number().int().positive(),
  session: z.number().int().min(0),
  weekly: z.number().int().min(0),
});

export const SyncCurrentWindowSchema = z.object({
  resetsAt: z.string().min(1),
  peak: z.number().int().min(0),
  updatedAt: z.number().int().positive(),
});

const SyncNotificationsSchema = z.object({
  enabled: z.boolean().optional(),
  sessionThreshold: z.number().int().min(0).max(100).optional(),
  weeklyThreshold: z.number().int().min(0).max(100).optional(),
  resetThreshold: z.number().int().min(0).max(100).optional(),
  notifyOnReset: z.boolean().optional(),
  notifyOnWindowReset: z.boolean().optional(),
  soundEnabled: z.boolean().optional(),
});

export const SyncSettingsSchema = z.object({
  theme: z.enum(['system', 'dark', 'light']).optional(),
  language: z.enum(['en', 'pt-BR']).optional(),
  notifications: SyncNotificationsSchema.optional(),
  updatedAt: z.number().int().positive(),
});

export const AuthExchangeRequestSchema = z.object({
  accessToken: z.string().min(1),
  deviceId: z.string().min(1),
  deviceLabel: z.string().optional(),
});

export const AuthExchangeResponseSchema = z.object({
  jwt: z.string(),
  expiresAt: z.number().int().positive(),
  email: z.string().email(),
});

export const SyncCliEventSchema = z.object({
  ts: z.number().int().positive(),
  sessionId: z.string().min(1),
  toolName: z.string().min(1),
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  cacheReadTokens: z.number().int().min(0).default(0),
  cacheCreationTokens: z.number().int().min(0).default(0),
});

export const SyncPushRequestSchema = z.object({
  deviceId: z.string().min(1),
  daily: z.array(SyncDailySnapshotSchema),
  sessionWindows: z.array(SyncSessionWindowSchema),
  timeSeries: z.array(SyncTimeSeriesPointSchema),
  usageSnapshots: z.array(SyncUsageSnapshotSchema),
  currentWindow: SyncCurrentWindowSchema.optional(),
  settings: SyncSettingsSchema.optional(),
  cliEvents: z.array(SyncCliEventSchema).optional(),
});

export const SyncPullResponseSchema = z.object({
  daily: z.array(SyncDailySnapshotSchema),
  sessionWindows: z.array(SyncSessionWindowSchema),
  timeSeries: z.array(SyncTimeSeriesPointSchema),
  usageSnapshots: z.array(SyncUsageSnapshotSchema),
  currentWindow: SyncCurrentWindowSchema.optional(),
  settings: SyncSettingsSchema.optional(),
  serverTime: z.number().int().positive(),
});

// Alias mantido para compatibilidade
export const SyncPushPayloadSchema = SyncPushRequestSchema;
export type SyncPushPayloadInput = z.input<typeof SyncPushRequestSchema>;
export type SyncPushPayloadOutput = z.output<typeof SyncPushRequestSchema>;
