import { Router } from "express";
import { db } from "@workspace/db";
import { friendRequestsTable, friendsTable, usersTable, ratingsTable } from "@workspace/db";
import { eq, and, or } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth";

const router = Router();

// GET /api/friends
router.get("/friends", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const friendRows = await db.select().from(friendsTable)
      .where(or(eq(friendsTable.userId, userId), eq(friendsTable.friendId, userId)));

    const friendIds = friendRows.map(f => f.userId === userId ? f.friendId : f.userId);

    const friends = await Promise.all(friendIds.map(async (fid) => {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, fid)).limit(1);
      const [rating] = await db.select().from(ratingsTable).where(eq(ratingsTable.userId, fid)).limit(1);
      return {
        id: user.id,
        username: user.username,
        avatar: user.avatar ?? null,
        isOnline: user.isOnline,
        lastSeen: user.lastSeen ?? null,
        ratings: rating
          ? { bullet: rating.bullet, blitz: rating.blitz, rapid: rating.rapid, classical: rating.classical }
          : { bullet: 800, blitz: 800, rapid: 800, classical: 800 },
      };
    }));

    res.json(friends);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get friends" });
  }
});

// GET /api/friends/requests
router.get("/friends/requests", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const requests = await db.select().from(friendRequestsTable)
      .where(and(eq(friendRequestsTable.toUserId, userId), eq(friendRequestsTable.status, "pending")));

    const result = await Promise.all(requests.map(async (r) => {
      const [from] = await db.select().from(usersTable).where(eq(usersTable.id, r.fromUserId)).limit(1);
      return {
        id: r.id,
        fromUser: { id: from.id, username: from.username, avatar: from.avatar ?? null, rating: null },
        toUser: null,
        status: r.status,
        createdAt: r.createdAt,
      };
    }));

    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get friend requests" });
  }
});

// GET /api/friends/requests/sent
router.get("/friends/requests/sent", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const requests = await db.select().from(friendRequestsTable)
      .where(and(eq(friendRequestsTable.fromUserId, userId), eq(friendRequestsTable.status, "pending")));

    const result = await Promise.all(requests.map(async (r) => {
      const [to] = await db.select().from(usersTable).where(eq(usersTable.id, r.toUserId)).limit(1);
      return {
        id: r.id,
        fromUser: null,
        toUser: { id: to.id, username: to.username, avatar: to.avatar ?? null, rating: null },
        status: r.status,
        createdAt: r.createdAt,
      };
    }));

    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get sent requests" });
  }
});

// POST /api/friends/requests/:id/cancel
router.post("/friends/requests/:id/cancel", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.userId!;
    
    // Only the sender can cancel it
    const [request] = await db.select().from(friendRequestsTable)
      .where(and(eq(friendRequestsTable.id, id), eq(friendRequestsTable.fromUserId, userId))).limit(1);
    
    if (!request) { res.status(404).json({ error: "Request not found" }); return; }

    await db.delete(friendRequestsTable).where(eq(friendRequestsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to cancel request" });
  }
});

// POST /api/friends/requests
router.post("/friends/requests", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { username } = req.body;
    const fromUserId = req.userId!;

    const { sql } = await import("drizzle-orm");
    const [toUser] = await db.select().from(usersTable)
      .where(sql`lower(${usersTable.username}) = lower(${username})`)
      .limit(1);

    if (!toUser) { res.status(404).json({ error: "User not found" }); return; }
    if (toUser.id === fromUserId) { res.status(400).json({ error: "Cannot friend yourself" }); return; }

    const existing = await db.select().from(friendRequestsTable).where(
      or(
        and(eq(friendRequestsTable.fromUserId, fromUserId), eq(friendRequestsTable.toUserId, toUser.id)),
        and(eq(friendRequestsTable.fromUserId, toUser.id), eq(friendRequestsTable.toUserId, fromUserId))
      )
    ).limit(1);

    if (existing.length > 0) {
      const existingReq = existing[0];
      // If the other user already sent a request to me, just accept it
      if (existingReq.fromUserId === toUser.id && existingReq.status === "pending") {
        await db.update(friendRequestsTable).set({ status: "accepted" }).where(eq(friendRequestsTable.id, existingReq.id));
        await db.insert(friendsTable).values({ userId: fromUserId, friendId: toUser.id });
        res.json({ message: "Friend request accepted" });
        return;
      }
      res.status(400).json({ error: "Request already sent or received" });
      return;
    }

    // Check if already friends
    const alreadyFriend = await db.select().from(friendsTable).where(
      or(
        and(eq(friendsTable.userId, fromUserId), eq(friendsTable.friendId, toUser.id)),
        and(eq(friendsTable.userId, toUser.id), eq(friendsTable.friendId, fromUserId))
      )
    ).limit(1);
    if (alreadyFriend.length > 0) { res.status(400).json({ error: "Already friends" }); return; }

    const [request] = await db.insert(friendRequestsTable).values({
      fromUserId,
      toUserId: toUser.id,
      status: "pending",
    }).returning();

    const [fromUser] = await db.select().from(usersTable).where(eq(usersTable.id, fromUserId)).limit(1);

    res.status(201).json({
      id: request.id,
      fromUser: { id: fromUser.id, username: fromUser.username, avatar: fromUser.avatar ?? null, rating: null },
      toUser: { id: toUser.id, username: toUser.username, avatar: toUser.avatar ?? null, rating: null },
      status: request.status,
      createdAt: request.createdAt,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to send request" });
  }
});

// POST /api/friends/requests/:id/accept
router.post("/friends/requests/:id/accept", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.userId!;

    const [request] = await db.select().from(friendRequestsTable)
      .where(and(eq(friendRequestsTable.id, id), eq(friendRequestsTable.toUserId, userId))).limit(1);
    if (!request) { res.status(404).json({ error: "Request not found" }); return; }

    await db.update(friendRequestsTable).set({ status: "accepted" }).where(eq(friendRequestsTable.id, id));

    await db.insert(friendsTable).values({ userId, friendId: request.fromUserId });

    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to accept" });
  }
});

// POST /api/friends/requests/:id/decline
router.post("/friends/requests/:id/decline", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.update(friendRequestsTable).set({ status: "declined" }).where(eq(friendRequestsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to decline" });
  }
});

export default router;
