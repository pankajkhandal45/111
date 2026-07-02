import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userRoleEnum = ["user", "admin"] as const;

export const usersTable = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  isGuest: integer("is_guest", { mode: "boolean" }).notNull().default(false),
  avatar: text("avatar"),
  country: text("country"),
  bio: text("bio"),
  role: text("role", { enum: userRoleEnum }).notNull().default("user"),
  isOnline: integer("is_online", { mode: "boolean" }).notNull().default(false),
  lastSeen: integer("last_seen", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const ratingsTable = sqliteTable("ratings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  bullet: integer("bullet").notNull().default(800),
  blitz: integer("blitz").notNull().default(800),
  rapid: integer("rapid").notNull().default(800),
  classical: integer("classical").notNull().default(800),
  puzzleRating: integer("puzzle_rating").notNull().default(800),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertRatingSchema = createInsertSchema(ratingsTable).omit({ id: true, updatedAt: true });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
export type Rating = typeof ratingsTable.$inferSelect;
