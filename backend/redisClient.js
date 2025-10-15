import Redis from 'ioredis';
import RedisMock from 'ioredis-mock';
import net from 'net';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 6379;

function parseRedisUrl(url) {
  try {
    const u = new URL(url);
    return { host: u.hostname || DEFAULT_HOST, port: parseInt(u.port || DEFAULT_PORT, 10), url };
  } catch {
    return { host: DEFAULT_HOST, port: DEFAULT_PORT, url: undefined };
  }
}

function checkPortOpen(host, port, timeoutMs = 700) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;

    const finalize = (result) => {
      if (done) return;
      done = true;
      try { socket.destroy(); } catch {}
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finalize(true));
    socket.once('error', () => finalize(false));
    socket.once('timeout', () => finalize(false));

    socket.connect(port, host);
  });
}

// Initialize with in-memory client immediately for synchronous availability
let redisClient = new RedisMock();
let usingMemory = true;
console.log("⚠️ Redis non détecté au démarrage. Utilisation d'un serveur Redis en mémoire (ioredis-mock) provisoire...");

(async () => {
  try {
    const envUrl = process.env.REDIS_URL;
    const { host, port, url } = envUrl ? parseRedisUrl(envUrl) : { host: DEFAULT_HOST, port: DEFAULT_PORT, url: undefined };

    const isOpen = await checkPortOpen(host, port);
    if (!isOpen) {
      console.log("ℹ️ Aucun serveur Redis local détecté sur", `${host}:${port}`);
      return; // keep memory client
    }

    // Try to connect to real Redis
    const opts = url ? {} : { host, port, connectTimeout: 1000 };
    const client = url ? new Redis(url, { connectTimeout: 1000, retryStrategy: () => null }) : new Redis(opts);
    client.on('error', (err) => {
      console.warn(`[Redis] Error: ${err?.message || err}`);
    });

    await client.ping();
    redisClient = client;
    usingMemory = false;
    console.log(`✅ Redis: connexion établie sur ${host}:${port}${url ? ' (via REDIS_URL)' : ''}`);
  } catch (e) {
    console.warn(`[Redis] Utilisation de la mémoire. Raison: ${e?.message || e}`);
    usingMemory = true;
  }
})();

export { redisClient };
