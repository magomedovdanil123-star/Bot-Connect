import { boolean, integer, jsonb, pgTable, real, serial, text, timestamp } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const musicTracksTable = pgTable("music_tracks", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull(),
  externalTrackId: text("external_track_id").notNull(),
  title: text("title").notNull(),
  artist: text("artist"),
  sourceUrl: text("source_url").notNull(),
  previewUrl: text("preview_url"),
  license: text("license").notNull().default("unknown"),
  licenseUrl: text("license_url"),
  requiresAttribution: boolean("requires_attribution").notNull().default(true),
  duration: integer("duration"),
  mood: text("mood"),
  category: text("category"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const soundEffectsTable = pgTable("sound_effects", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull(),
  externalEffectId: text("external_effect_id").notNull(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  sourceUrl: text("source_url").notNull(),
  previewUrl: text("preview_url"),
  license: text("license").notNull().default("unknown"),
  licenseUrl: text("license_url"),
  requiresAttribution: boolean("requires_attribution").notNull().default(true),
  duration: integer("duration"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const projectMusicTable = pgTable("project_music", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  musicTrackId: integer("music_track_id").references(() => musicTracksTable.id, { onDelete: "set null" }),
  source: text("source").notNull().default("provider"),
  originalName: text("original_name"),
  storagePath: text("storage_path"),
  audioUrl: text("audio_url"),
  volume: real("volume").notNull().default(0.12),
  fadeIn: integer("fade_in").notNull().default(1000),
  fadeOut: integer("fade_out").notNull().default(1500),
  loop: boolean("loop").notNull().default(true),
  ducking: boolean("ducking").notNull().default(true),
  startTime: integer("start_time").notNull().default(0),
  duration: integer("duration"),
  isActive: boolean("is_active").notNull().default(true),
  status: text("status").notNull().default("pending"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const projectSoundEffectsTable = pgTable("project_sound_effects", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  sceneId: integer("scene_id").notNull(),
  soundEffectId: integer("sound_effect_id").references(() => soundEffectsTable.id, { onDelete: "set null" }),
  kind: text("kind").notNull().default("sfx"),
  storagePath: text("storage_path"),
  audioUrl: text("audio_url"),
  startTime: integer("start_time").notNull(),
  duration: integer("duration"),
  volume: real("volume").notNull().default(0.3),
  fadeIn: integer("fade_in").notNull().default(50),
  fadeOut: integer("fade_out").notNull().default(100),
  isActive: boolean("is_active").notNull().default(true),
  status: text("status").notNull().default("pending"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const soundDesignPlansTable = pgTable("sound_design_plans", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"),
  plan: jsonb("plan"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const audioMixesTable = pgTable("audio_mixes", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"),
  storagePath: text("storage_path"),
  audioUrl: text("audio_url"),
  duration: integer("duration"),
  fileSize: integer("file_size"),
  peakDb: real("peak_db"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const audioProjectLocksTable = pgTable("audio_project_locks", {
  projectId: integer("project_id").primaryKey().references(() => projectsTable.id, { onDelete: "cascade" }),
  ownerId: text("owner_id").notNull(),
  kind: text("kind").notNull(),
  acquiredAt: timestamp("acquired_at", { withTimezone: true }).notNull().defaultNow(),
  heartbeatAt: timestamp("heartbeat_at", { withTimezone: true }).notNull().defaultNow(),
});

export const videoGenerationJobsTable = pgTable("video_generation_jobs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  topic: text("topic").notNull(),
  format: text("format").notNull().default("9:16"),
  duration: integer("duration").notNull().default(60),
  style: text("style").notNull().default("cinematic"),
  tone: text("tone").notNull().default("suspense"),
  status: text("status").notNull().default("pending"),
  currentStage: text("current_stage").notNull().default("pending"),
  progress: integer("progress").notNull().default(0),
  stages: jsonb("stages").notNull().default({}),
  subtitleStoragePath: text("subtitle_storage_path"),
  subtitleUrl: text("subtitle_url"),
  videoStoragePath: text("video_storage_path"),
  videoUrl: text("video_url"),
  videoDuration: integer("video_duration"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});