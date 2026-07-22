import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const friendRequestStatusEnum = ["pending", "accepted", "declined"] as const;
export const notificationTypeEnum = ["friend_request", "friend_online", "game_invite", "game_result", "system"] as const;

export const friendRequestsTable = sqliteTable("friend_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fromUserId: integer("from_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  toUserId: integer("to_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  status: text("status", { enum: friendRequestStatusEnum }).notNull().default("pending"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const friendsTable = sqliteTable("friends", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  friendId: integer("friend_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const notificationsTable = sqliteTable("notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  type: text("type", { enum: notificationTypeEnum }).notNull(),
  message: text("message").notNull(),
  isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
  data: text("data"), // JSON string
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const insertFriendRequestSchema = createInsertSchema(friendRequestsTable).omit({ id: true, createdAt: true });
export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({ id: true, createdAt: true });

export type FriendRequest = typeof friendRequestsTable.$inferSelect;
export type Friend = typeof friendsTable.$inferSelect;
export type Notification = typeof notificationsTable.$inferSelect;
