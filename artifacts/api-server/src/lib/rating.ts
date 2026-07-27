import { db } from "@workspace/db";
import { ratingsTable, gamesTable, usersTable } from "@workspace/db";
import { eq, and, ne, isNotNull, asc } from "drizzle-orm";

export function getTimeControlCategory(tc: string): "bullet" | "blitz" | "rapid" | "classical" {
  if (tc.startsWith("bullet")) return "bullet";
  if (tc.startsWith("blitz")) return "blitz";
  if (tc.startsWith("rapid")) return "rapid";
  return "classical";
}

const BOT_RATINGS: Record<string, number> = {
  beginner: 800,
  easy: 1000,
  intermediate: 1300,
  advanced: 1600,
  expert: 1900,
  master: 2200,
  grandmaster: 2500,
};

export function getBotRating(botLevel?: string | null): number {
  if (!botLevel) return 1200;
  return BOT_RATINGS[botLevel.toLowerCase()] || 1200;
}

export function calculateEloChange(playerRating: number, opponentRating: number, actualScore: number, kFactor = 32): number {
  const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
  return Math.round(kFactor * (actualScore - expectedScore));
}

export async function updateGameRatings(
  gameId: number,
  result: "white" | "black" | "draw",
  whitePlayerId: number,
  blackPlayerId: number | null,
  timeControl: string,
  mode: string,
  botLevel?: string | null
): Promise<{ whiteRatingChange: number; blackRatingChange: number }> {
  // Do not rate local games
  if (mode === "local") {
    return { whiteRatingChange: 0, blackRatingChange: 0 };
  }

  const category = getTimeControlCategory(timeControl);

  // Ensure ratingsTable row exists for white player
  let [whiteRatings] = await db.select().from(ratingsTable).where(eq(ratingsTable.userId, whitePlayerId)).limit(1);
  if (!whiteRatings) {
    [whiteRatings] = await db.insert(ratingsTable).values({ userId: whitePlayerId }).returning();
  }

  const whiteCurrentRating = whiteRatings[category] ?? 800;
  let blackCurrentRating = 800;
  let blackRatings: typeof whiteRatings | null = null;

  if (mode === "bot") {
    blackCurrentRating = getBotRating(botLevel);
  } else if (blackPlayerId) {
    [blackRatings] = await db.select().from(ratingsTable).where(eq(ratingsTable.userId, blackPlayerId)).limit(1);
    if (!blackRatings) {
      [blackRatings] = await db.insert(ratingsTable).values({ userId: blackPlayerId }).returning();
    }
    blackCurrentRating = blackRatings[category] ?? 800;
  }

  // Determine scores
  let whiteScore = 0.5;
  let blackScore = 0.5;
  if (result === "white") {
    whiteScore = 1;
    blackScore = 0;
  } else if (result === "black") {
    whiteScore = 0;
    blackScore = 1;
  }

  const whiteChange = calculateEloChange(whiteCurrentRating, blackCurrentRating, whiteScore);
  const blackChange = calculateEloChange(blackCurrentRating, whiteCurrentRating, blackScore);

  const newWhiteRating = Math.max(100, whiteCurrentRating + whiteChange);
  await db.update(ratingsTable)
    .set({ [category]: newWhiteRating, updatedAt: new Date() })
    .where(eq(ratingsTable.userId, whitePlayerId));

  if (blackPlayerId && mode !== "bot") {
    const newBlackRating = Math.max(100, blackCurrentRating + blackChange);
    await db.update(ratingsTable)
      .set({ [category]: newBlackRating, updatedAt: new Date() })
      .where(eq(ratingsTable.userId, blackPlayerId));
  }

  return { whiteRatingChange: whiteChange, blackRatingChange: blackChange };
}

export async function recalculateAllRatings(): Promise<void> {
  try {
    // Reset all user ratings to 800 defaults
    await db.update(ratingsTable).set({
      bullet: 800,
      blitz: 800,
      rapid: 800,
      classical: 800,
      updatedAt: new Date(),
    });

    // Fetch finished competitive games in chronological order
    const games = await db.select().from(gamesTable).where(
      and(
        eq(gamesTable.status, "finished"),
        ne(gamesTable.mode, "local"),
        isNotNull(gamesTable.result)
      )
    ).orderBy(asc(gamesTable.createdAt));

    for (const g of games) {
      if (g.result) {
        await updateGameRatings(
          g.id,
          g.result as "white" | "black" | "draw",
          g.whitePlayerId,
          g.blackPlayerId,
          g.timeControl,
          g.mode,
          g.botLevel
        );
      }
    }
  } catch (err) {
    console.error("Failed to recalculate all ratings:", err);
  }
}
