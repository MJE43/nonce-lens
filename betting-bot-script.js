// Antebot → Pump Analyzer Live — DRY RUN logger
// Builds the ingest payload and request options, prints them, does not POST.
game = "pump";
betSize = 0.002;
difficulty = "expert";
rounds = 12;
initialBetSize = betSize;
asyncMode = true;
const API_URL = "http://127.0.0.1:8000/live/ingest"; // adjust if needed
MULTI_THRESHOLD = 17; // only log >= this multiplier

function mapBet(lastBet) {
  // Flattened schema expected by our API
  const iso = (() => {
    try {
      return new Date(lastBet.dateTime).toISOString();
    } catch {
      return null;
    }
  })();

  return {
    id: String(lastBet.id),
    dateTime: iso, // may be null; API will accept and use received_at
    nonce: Number(lastBet.nonce),
    amount: Number(lastBet.amount),
    payout: Number(lastBet.payout),
    difficulty: lastBet.state?.difficulty, // 'easy'|'medium'|'hard'|'expert'
    roundTarget: lastBet.state?.roundTargetMultiplier ?? null,
    roundResult: lastBet.state?.roundResultMultiplier ?? null,
    clientSeed: lastBet.clientSeed,
    serverSeedHashed: lastBet.serverSeedHashed,
  };
}

function buildRequest(payload) {
  const headers = {
    "Content-Type": "application/json",
  };
  return {
    url: API_URL,
    options: {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      keepalive: true,
    },
  };
}

engine.onBetPlaced(async (lastBet) => {
  if (lastBet.state.roundResultMultiplier <= MULTI_THRESHOLD) return;

  const payload = mapBet(lastBet);
  const req = buildRequest(payload);
  fetch(req.url, req.options)
    .then((res) =>
      res.ok
        ? res.text()
        : Promise.reject(new Error(`${res.status} ${res.statusText}`))
    )
    .then((txt) => log("Ingest ok:", txt))
    .catch((err) => log("Ingest failed:", err));
});

engine.onBettingStopped((isManualStop, lastError) => {
  playHitSound();
});
