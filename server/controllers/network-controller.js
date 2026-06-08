import { getNetwork } from "../dao/dao-network.js";

export async function getFullNetwork(req, res) {
  const network = await getNetwork();
  res.json(network);
}
