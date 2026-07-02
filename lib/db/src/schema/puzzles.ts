import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const puzzleTypeEnum = ["mate1", "mate2", "mate3", "tactical", "endgame"] as const;

export const puzzlesTable = sqliteTable("puzzles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fen: text("fen").notNull(),
  solution: text("solution").notNull(), // JSON array of moves
  type: text("type", { enum: puzzleTypeEnum }).notNull(),
  rating: integer("rating").notNull().default(1000),
  title: text("title").notNull(),
  description: text("description"),
  isDaily: integer("is_daily", { mode: "boolean" }).notNull().default(false),
  dailyDate: text("daily_date"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const puzzleAttemptsTable = sqliteTable("puzzle_attempts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  puzzleId: integer("puzzle_id").notNull().references(() => puzzlesTable.id, { onDelete: "cascade" }),
  solved: integer("solved", { mode: "boolean" }).notNull(),
  timeTakenMs: integer("time_taken_ms").notNull(),
  ratingChange: integer("rating_change").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const puzzleStreaksTable = sqliteTable("puzzle_streaks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }).unique(),
  current: integer("current").notNull().default(0),
  best: integer("best").notNull().default(0),
  lastSolvedAt: integer("last_solved_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const insertPuzzleSchema = createInsertSchema(puzzlesTable).omit({ id: true, createdAt: true });
export const insertPuzzleAttemptSchema = createInsertSchema(puzzleAttemptsTable).omit({ id: true, createdAt: true });

export type Puzzle = typeof puzzlesTable.$inferSelect;
export type PuzzleAttempt = typeof puzzleAttemptsTable.$inferSelect;
export type PuzzleStreak = typeof puzzleStreaksTable.$inferSelect;
