import { relations } from "drizzle-orm";
import { usersTable, ratingsTable, gamesTable, movesTable, puzzlesTable, puzzleAttemptsTable, puzzleStreaksTable, friendRequestsTable, friendsTable, notificationsTable } from "./schema";

export const usersRelations = relations(usersTable, ({ one, many }) => ({
  rating: one(ratingsTable, { fields: [usersTable.id], references: [ratingsTable.userId] }),
  whiteGames: many(gamesTable, { relationName: "whitePlayer" }),
  blackGames: many(gamesTable, { relationName: "blackPlayer" }),
  sentRequests: many(friendRequestsTable, { relationName: "fromUser" }),
  receivedRequests: many(friendRequestsTable, { relationName: "toUser" }),
  notifications: many(notificationsTable),
  puzzleAttempts: many(puzzleAttemptsTable),
}));

export const ratingsRelations = relations(ratingsTable, ({ one }) => ({
  user: one(usersTable, { fields: [ratingsTable.userId], references: [usersTable.id] }),
}));

export const gamesRelations = relations(gamesTable, ({ one, many }) => ({
  whitePlayer: one(usersTable, { fields: [gamesTable.whitePlayerId], references: [usersTable.id], relationName: "whitePlayer" }),
  blackPlayer: one(usersTable, { fields: [gamesTable.blackPlayerId], references: [usersTable.id], relationName: "blackPlayer" }),
  moves: many(movesTable),
}));

export const movesRelations = relations(movesTable, ({ one }) => ({
  game: one(gamesTable, { fields: [movesTable.gameId], references: [gamesTable.id] }),
}));

export const puzzleAttemptsRelations = relations(puzzleAttemptsTable, ({ one }) => ({
  user: one(usersTable, { fields: [puzzleAttemptsTable.userId], references: [usersTable.id] }),
  puzzle: one(puzzlesTable, { fields: [puzzleAttemptsTable.puzzleId], references: [puzzlesTable.id] }),
}));

export const friendRequestsRelations = relations(friendRequestsTable, ({ one }) => ({
  fromUser: one(usersTable, { fields: [friendRequestsTable.fromUserId], references: [usersTable.id], relationName: "fromUser" }),
  toUser: one(usersTable, { fields: [friendRequestsTable.toUserId], references: [usersTable.id], relationName: "toUser" }),
}));

export const friendsRelations = relations(friendsTable, ({ one }) => ({
  user: one(usersTable, { fields: [friendsTable.userId], references: [usersTable.id] }),
  friend: one(usersTable, { fields: [friendsTable.friendId], references: [usersTable.id] }),
}));

export const notificationsRelations = relations(notificationsTable, ({ one }) => ({
  user: one(usersTable, { fields: [notificationsTable.userId], references: [usersTable.id] }),
}));
