import { Router } from "express";
import { db } from "@workspace/db";
import { friendRequestsTable, friendsTable, usersTable, ratingsTable, notificationsTable } from "@workspace/db";
import { eq, and, or, inArray } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth";

const router = Router();

// GET /api/friends
router.get("/friends", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const friendRows = await db.select().from(friendsTable)
      .where(or(eq(friendsTable.userId, userId), eq(friendsTable.friendId, userId)));

    const friendIds = friendRows.map(f => f.userId === userId ? f.friendId : f.userId);
    const uniqueFriendIds = Array.from(new Set(friendIds));

    if (uniqueFriendIds.length === 0) {
      res.json([]);
      return;
    }

    const rows = await db.select({
      id: usersTable.id,
      username: usersTable.username,
      avatar: usersTable.avatar,
      isOnline: usersTable.isOnline,
      lastSeen: usersTable.lastSeen,
      bullet: ratingsTable.bullet,
      blitz: ratingsTable.blitz,
      rapid: ratingsTable.rapid,
      classical: ratingsTable.classical,
    }).from(usersTable)
      .leftJoin(ratingsTable, eq(usersTable.id, ratingsTable.userId))
      .where(inArray(usersTable.id, uniqueFriendIds));

    const friends = rows.map(u => ({
      id: u.id,
      username: u.username,
      avatar: u.avatar ?? null,
      isOnline: u.isOnline,
      lastSeen: u.lastSeen ?? null,
      ratings: {
        bullet: u.bullet ?? 800,
        blitz: u.blitz ?? 800,
        rapid: u.rapid ?? 800,
        classical: u.classical ?? 800,
      },
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
    const requests = await db.select({
      id: friendRequestsTable.id,
      status: friendRequestsTable.status,
      createdAt: friendRequestsTable.createdAt,
      fromId: usersTable.id,
      fromUsername: usersTable.username,
      fromAvatar: usersTable.avatar,
    }).from(friendRequestsTable)
      .innerJoin(usersTable, eq(friendRequestsTable.fromUserId, usersTable.id))
      .where(and(eq(friendRequestsTable.toUserId, userId), eq(friendRequestsTable.status, "pending")));

    const result = requests.map(r => ({
      id: r.id,
      fromUser: { id: r.fromId, username: r.fromUsername, avatar: r.fromAvatar ?? null, rating: null },
      toUser: null,
      status: r.status,
      createdAt: r.createdAt,
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
    const requests = await db.select({
      id: friendRequestsTable.id,
      status: friendRequestsTable.status,
      createdAt: friendRequestsTable.createdAt,
      toId: usersTable.id,
      toUsername: usersTable.username,
      toAvatar: usersTable.avatar,
    }).from(friendRequestsTable)
      .innerJoin(usersTable, eq(friendRequestsTable.toUserId, usersTable.id))
      .where(and(eq(friendRequestsTable.fromUserId, userId), eq(friendRequestsTable.status, "pending")));

    const result = requests.map(r => ({
      id: r.id,
      fromUser: null,
      toUser: { id: r.toId, username: r.toUsername, avatar: r.toAvatar ?? null, rating: null },
      status: r.status,
      createdAt: r.createdAt,
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
    const id = parseInt(req.params.id as string);
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

    // Send notification to recipient
    await db.insert(notificationsTable).values({
      userId: toUser.id,
      type: "friend_request",
      message: `📩 ${fromUser.username} sent you a friend request`,
      data: JSON.stringify({ requestId: request.id, fromUserId: fromUser.id, username: fromUser.username, avatar: fromUser.avatar }),
    });

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
    const id = parseInt(req.params.id as string);
    const userId = req.userId!;

    const [request] = await db.select().from(friendRequestsTable)
      .where(and(eq(friendRequestsTable.id, id), eq(friendRequestsTable.toUserId, userId))).limit(1);
    if (!request) { res.status(404).json({ error: "Request not found" }); return; }

    await db.update(friendRequestsTable).set({ status: "accepted" }).where(eq(friendRequestsTable.id, id));

    await db.insert(friendsTable).values({ userId, friendId: request.fromUserId });

    // Send notification to sender that their request was accepted
    const [acceptingUser] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    await db.insert(notificationsTable).values({
      userId: request.fromUserId,
      type: "friend_request",
      message: `🎉 ${acceptingUser?.username || 'Someone'} accepted your friend request!`,
      data: JSON.stringify({ acceptedByUserId: userId, username: acceptingUser?.username, avatar: acceptingUser?.avatar }),
    });

    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to accept" });
  }
});

// POST /api/friends/requests/:id/decline
router.post("/friends/requests/:id/decline", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string);
    await db.update(friendRequestsTable).set({ status: "declined" }).where(eq(friendRequestsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to decline" });
  }
});

export default router;
