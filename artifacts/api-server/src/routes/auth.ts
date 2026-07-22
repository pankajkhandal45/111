import { Router } from "express";
import bcrypt from "bcrypt";
import { db } from "@workspace/db";
import { usersTable, ratingsTable } from "@workspace/db";
import { eq, and, lt } from "drizzle-orm";
import { signToken, requireAuth, type AuthRequest } from "../lib/auth";

const router = Router();

// POST /api/auth/register
router.post("/auth/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      res.status(400).json({ error: "Username, email and password are required" });
      return;
    }

    const existingEmail = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (existingEmail.length > 0) {
      res.status(400).json({ error: "Email already registered" });
      return;
    }

    const existingUsername = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
    if (existingUsername.length > 0) {
      res.status(400).json({ error: "Username already taken" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db.insert(usersTable).values({
      username,
      email,
      passwordHash,
      isGuest: false,
    }).returning();

    await db.insert(ratingsTable).values({ userId: user.id });

    const token = signToken(user.id);
    res.status(201).json({ token, user: formatUser(user) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Registration failed" });
  }
});

// POST /api/auth/login
router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (!user || !user.passwordHash) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    await db.update(usersTable).set({ isOnline: true, lastSeen: new Date() }).where(eq(usersTable.id, user.id));
    const token = signToken(user.id);
    res.json({ token, user: formatUser(user) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

// POST /api/auth/guest
router.post("/auth/guest", async (req, res) => {
  try {
    const guestNum = Math.floor(Math.random() * 900000) + 100000;
    const username = `Guest${guestNum}`;
    const email = `guest_${guestNum}@chess.guest`;

    const [user] = await db.insert(usersTable).values({
      username,
      email,
      isGuest: true,
    }).returning();

    await db.insert(ratingsTable).values({ userId: user.id });

    const token = signToken(user.id);
    res.json({ token, user: formatUser(user) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Guest login failed" });
  }
});

// POST /api/auth/logout
router.post("/auth/logout", requireAuth, async (req: AuthRequest, res) => {
  if (req.userId) {
    await db.update(usersTable).set({ isOnline: false, lastSeen: new Date() }).where(eq(usersTable.id, req.userId));
  }
  res.json({ success: true });
});

// POST /api/auth/heartbeat — marks user online, clears stale offline users
router.post("/auth/heartbeat", requireAuth, async (req: AuthRequest, res) => {
  const now = new Date();
  const userId = req.userId!;
  const userWasOffline = !req.user?.isOnline;

  await db.update(usersTable)
    .set({ isOnline: true, lastSeen: now })
    .where(eq(usersTable.id, userId));

  // If user just came online, notify their friends
  if (userWasOffline && req.user) {
    try {
      const { friendsTable, notificationsTable } = await import("@workspace/db");
      const friendRows = await db.select().from(friendsTable)
        .where(or(eq(friendsTable.userId, userId), eq(friendsTable.friendId, userId)));

      const friendIds = Array.from(new Set(friendRows.map(f => f.userId === userId ? f.friendId : f.userId)));
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

      for (const fid of friendIds) {
        const existing = await db.select().from(notificationsTable).where(
          and(
            eq(notificationsTable.userId, fid),
            eq(notificationsTable.type, "friend_online"),
            gt(notificationsTable.createdAt, tenMinutesAgo)
          )
        ).limit(1);

        if (existing.length === 0) {
          await db.insert(notificationsTable).values({
            userId: fid,
            type: "friend_online",
            message: `🟢 ${req.user.username} is now online!`,
            data: JSON.stringify({ friendId: userId, username: req.user.username, avatar: req.user.avatar }),
          });
        }
      }
    } catch { /* ignore error */ }
  }

  // Mark users offline if no heartbeat for > 2 minutes
  const staleTime = new Date(now.getTime() - 2 * 60 * 1000);
  await db.update(usersTable)
    .set({ isOnline: false })
    .where(and(eq(usersTable.isOnline, true), lt(usersTable.lastSeen, staleTime)));

  res.json({ ok: true });
});

// GET /api/auth/me
router.get("/auth/me", requireAuth, async (req: AuthRequest, res) => {
  res.json(formatUser(req.user!));
});

export function formatUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    isGuest: user.isGuest,
    avatar: user.avatar,
    country: user.country,
    bio: user.bio,
    role: user.role,
    createdAt: user.createdAt,
  };
}

export default router;
