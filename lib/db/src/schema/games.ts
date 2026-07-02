import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const gameStatusEnum = ["waiting", "active", "finished", "abandoned"] as const;
export const gameResultEnum = ["white", "black", "draw"] as const;
export const gameModeEnum = ["bot", "local", "online", "private"] as const;
export const moveClassificationEnum = [
  "brilliant", "great", "best", "excellent", "good", "inaccuracy", "mistake", "blunder"
] as const;

export const gamesTable = sqliteTable("games", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fen: text("fen").notNull().default("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"),
  pgn: text("pgn").notNull().default(""),
  status: text("status", { enum: gameStatusEnum }).notNull().default("waiting"),
  result: text("result", { enum: gameResultEnum }),
  resultReason: text("result_reason"),
  timeControl: text("time_control").notNull(),
  mode: text("mode", { enum: gameModeEnum }).notNull(),
  botLevel: text("bot_level"),
  whitePlayerId: integer("white_player_id").notNull().references(() => usersTable.id),
  blackPlayerId: integer("black_player_id").references(() => usersTable.id),
  whiteTimeMs: integer("white_time_ms"),
  blackTimeMs: integer("black_time_ms"),
  roomCode: text("room_code").unique(),
  opening: text("opening"),
  openingEco: text("opening_eco"),
  whiteAccuracy: integer("white_accuracy"),
  blackAccuracy: integer("black_accuracy"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const movesTable = sqliteTable("moves", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gameId: integer("game_id").notNull().references(() => gamesTable.id, { onDelete: "cascade" }),
  moveNumber: integer("move_number").notNull(),
  san: text("san").notNull(),
  fromSquare: text("from_square").notNull(),
  toSquare: text("to_square").notNull(),
  promotion: text("promotion"),
  fen: text("fen").notNull(),
  timeTakenMs: integer("time_taken_ms"),
  classification: text("classification", { enum: moveClassificationEnum }),
  evaluation: integer("evaluation"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const insertGameSchema = createInsertSchema(gamesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMoveSchema = createInsertSchema(movesTable).omit({ id: true, createdAt: true });

export type InsertGame = z.infer<typeof insertGameSchema>;
export type Game = typeof gamesTable.$inferSelect;
export type Move = typeof movesTable.$inferSelect;
