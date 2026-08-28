const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

export async function fetchChesscomGames(username: string, maxGames = 15): Promise<string> {
  // Add random 1-10s delay to avoid rate limiting
  await delay(Math.floor(Math.random() * 10000) + 1000);

  // Chess.com requires fetching the archives list first
  const archivesRes = await fetch(`https://api.chess.com/pub/player/${username}/games/archives`);
  if (!archivesRes.ok) {
    throw new Error('Failed to fetch Chess.com archives');
  }
  const archivesData = await archivesRes.json();
  const archives = archivesData.archives;
  
  if (!archives || archives.length === 0) {
    return '';
  }

  // Fetch the most recent month's archive
  const latestArchiveUrl = archives[archives.length - 1];
  const gamesRes = await fetch(latestArchiveUrl);
  if (!gamesRes.ok) {
    throw new Error('Failed to fetch Chess.com games');
  }
  const gamesData = await gamesRes.json();
  
  // Extract PGNs
  const games = gamesData.games || [];
  // Return the last `maxGames` PGNs joined together
  const recentGames = games.slice(-maxGames);
  return recentGames.map((g: any) => g.pgn).join('\n\n');
}

export async function fetchLichessExplorer(fen: string) {
  await delay(Math.floor(Math.random() * 10000) + 1000);
  const response = await fetch(`https://explorer.lichess.ovh/lichess?fen=${encodeURIComponent(fen)}`);
  if (!response.ok) {
    throw new Error('Failed to fetch Lichess explorer stats');
  }
  return await response.json();
}
