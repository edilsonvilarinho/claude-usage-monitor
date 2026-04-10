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

export const SyncSettingsSchema = z.object({
  theme: z.string().optional(),
  language: z.string().optional(),
  notifyThreshold: z.number().int().min(0).max(100).optional(),
  updatedAt: z.number().int().positive(),
});

export const SyncPushPayloadSchema = z.object({
  deviceId: z.string().min(1),
  daily: z.array(SyncDailySnapshotSchema),
  sessionWindows: z.array(SyncSessionWindowSchema),
  timeSeries: z.array(SyncTimeSeriesPointSchema),
  usageSnapshots: z.array(SyncUsageSnapshotSchema),
  currentWindow: SyncCurrentWindowSchema.optional(),
  settings: SyncSettingsSchema.optional(),
});

export type SyncPushPayloadInput = z.input<typeof SyncPushPayloadSchema>;
export type SyncPushPayloadOutput = z.output<typeof SyncPushPayloadSchema>;
