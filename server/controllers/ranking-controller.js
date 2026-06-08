import { getRanking } from "../dao/dao-games.js";

export async function getRankingList(req, res) {
  const ranking = await getRanking();
  res.json(ranking);
}
