#!/usr/bin/env node
/**
 * Mock Terminal Relay — implements /health, /ssh and /db over WebSocket so
 * the Terminal Relay validation flow can be tested without provisioning a
 * real relay. Speaks the same raw-bytes protocol as ttyd: anything the client
 * sends is echoed back, plus a small per-route banner on connect.
 *
 * Usage:
 *   node scripts/mock-relay.mjs                 # ws://localhost:8787
 *   PORT=9000 node scripts/mock-relay.mjs       # ws://localhost:9000
 *   TLS_CERT=cert.pem TLS_KEY=key.pem node ...  # wss://localhost:8787
 *
 * In the Terminal Relay page set the endpoint to:
 *   ws://localhost:8787/ws
 * Then "Probar todas las rutas" will hit /ws/health, /ws/ssh, /ws/db.
 */
import { WebSocketServer } from "ws";
import http from "node:http";
import https from "node:https";
import fs from "node:fs";

const PORT = Number(process.env.PORT ?? 8787);
const TLS_CERT = process.env.TLS_CERT;
const TLS_KEY = process.env.TLS_KEY;

const ROUTES = new Set(["/health", "/ssh", "/db"]);

const banners = {
  "/health": "ok\n",
  "/ssh":
    "\x1b[32mMock Africa Cloud relay — SSH channel\x1b[0m\r\n" +
    "Connected to mock-vm (10.0.0.42). Type to echo. ^D to disconnect.\r\n" +
    "mock-vm:~$ ",
  "/db":
    "\x1b[36mMock Africa Cloud relay — DB channel\x1b[0m\r\n" +
    "psql (mock 16.1) — connected to mock_db as app_user\r\n" +
    "mock_db=> ",
};

const server = TLS_CERT && TLS_KEY
  ? https.createServer({ cert: fs.readFileSync(TLS_CERT), key: fs.readFileSync(TLS_KEY) })
  : http.createServer();

// Accept any base path; we only care about the trailing /health|/ssh|/db.
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url, "http://localhost");
  const route = ["/health", "/ssh", "/db"].find((r) => url.pathname.endsWith(r));
  if (!route) {
    socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    ws.send(banners[route]);
    if (route === "/health") {
      // Health is a one-shot probe — close after the OK.
      setTimeout(() => ws.close(1000, "ok"), 50);
      return;
    }
    ws.on("message", (data, isBinary) => {
      const text = isBinary ? data : data.toString("utf8");
      // Echo with a faux prompt to feel like a shell.
      if (route === "/ssh") {
        ws.send(`${text}\r\nmock-vm:~$ `);
      } else {
        ws.send(`${text}\r\nmock_db=> `);
      }
    });
    ws.on("close", () => {/* noop */});
    console.log(`[mock-relay] ${route} client connected`);
  });
});

server.listen(PORT, () => {
  const scheme = TLS_CERT ? "wss" : "ws";
  console.log(`[mock-relay] listening on ${scheme}://localhost:${PORT}`);
  console.log(`[mock-relay] routes: /health, /ssh, /db (any base path, e.g. /ws/health)`);
});
