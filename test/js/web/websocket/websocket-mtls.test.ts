import { describe, expect, it } from "bun:test";
import { tls } from "harness";

const MTLS_CERT = { ...tls };

describe("WebSocket mTLS", () => {
  it("should connect with tls: { cert, key, ca } (Bun native style)", async () => {
    using server = Bun.serve({
      port: 0,
      tls: {
        ...MTLS_CERT,
        ca: MTLS_CERT.cert,
        requestCert: true,
        rejectUnauthorized: true,
      },
      fetch(req, server) {
        if (server.upgrade(req)) return undefined;
        return new Response("fail", { status: 400 });
      },
      websocket: {
        open(ws) {
          ws.send("mtls-ok");
        },
        message(ws, msg) {
          ws.send(`echo:${msg}`);
        },
      },
    });

    const { promise, resolve, reject } = Promise.withResolvers<string>();
    const timeout = setTimeout(() => reject(new Error("Timeout")), 5000);

    const ws = new WebSocket(`wss://localhost:${server.port}`, {
      tls: {
        cert: MTLS_CERT.cert,
        key: MTLS_CERT.key,
        ca: MTLS_CERT.cert,
        rejectUnauthorized: false,
      },
    });

    ws.onopen = () => ws.send("hello");
    ws.onmessage = (e) => {
      clearTimeout(timeout);
      resolve(e.data as string);
      ws.close();
    };
    ws.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("WebSocket error"));
    };

    expect(await promise).toBe("mtls-ok");
  });

  it("should connect with top-level cert, key, ca (Node.js ws style)", async () => {
    using server = Bun.serve({
      port: 0,
      tls: {
        ...MTLS_CERT,
        ca: MTLS_CERT.cert,
        requestCert: true,
        rejectUnauthorized: true,
      },
      fetch(req, server) {
        if (server.upgrade(req)) return undefined;
        return new Response("fail", { status: 400 });
      },
      websocket: {
        open(ws) {
          ws.send("mtls-toplevel-ok");
        },
        message(ws, msg) {
          ws.send(`echo:${msg}`);
        },
      },
    });

    const { promise, resolve, reject } = Promise.withResolvers<string>();
    const timeout = setTimeout(() => reject(new Error("Timeout")), 5000);

    // Pass cert/key/ca at top level (like Node.js ws library)
    const ws = new WebSocket(`wss://localhost:${server.port}`, {
      cert: MTLS_CERT.cert,
      key: MTLS_CERT.key,
      ca: MTLS_CERT.cert,
      rejectUnauthorized: false,
    } as any);

    ws.onopen = () => ws.send("hello");
    ws.onmessage = (e) => {
      clearTimeout(timeout);
      resolve(e.data as string);
      ws.close();
    };
    ws.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("WebSocket error"));
    };

    expect(await promise).toBe("mtls-toplevel-ok");
  });

  it("should reject client without cert when server requires it", async () => {
    using server = Bun.serve({
      port: 0,
      tls: {
        ...MTLS_CERT,
        ca: MTLS_CERT.cert,
        requestCert: true,
        rejectUnauthorized: true,
      },
      fetch(req, server) {
        if (server.upgrade(req)) return undefined;
        return new Response("fail", { status: 400 });
      },
      websocket: {
        open(ws) {
          ws.send("should-not-reach");
        },
        message() {},
      },
    });

    const { promise, resolve } = Promise.withResolvers<string>();
    const timeout = setTimeout(() => resolve("timeout"), 3000);

    // No client cert - should be rejected by server
    const ws = new WebSocket(`wss://localhost:${server.port}`, {
      tls: {
        rejectUnauthorized: false,
      },
    });

    ws.onopen = () => {
      clearTimeout(timeout);
      resolve("unexpectedly-opened");
    };
    ws.onerror = () => {
      clearTimeout(timeout);
      resolve("rejected");
    };

    const result = await promise;
    expect(result).toBe("rejected");
  });

  it("should work with ws module using top-level mTLS options", async () => {
    using server = Bun.serve({
      port: 0,
      tls: {
        ...MTLS_CERT,
        ca: MTLS_CERT.cert,
        requestCert: true,
        rejectUnauthorized: true,
      },
      fetch(req, server) {
        if (server.upgrade(req)) return undefined;
        return new Response("fail", { status: 400 });
      },
      websocket: {
        open(ws) {
          ws.send("ws-mtls-ok");
        },
        message(ws, msg) {
          ws.send(`echo:${msg}`);
        },
      },
    });

    const WS = require("ws");
    const { promise, resolve, reject } = Promise.withResolvers<string>();
    const timeout = setTimeout(() => reject(new Error("Timeout")), 5000);

    // Use ws module with top-level TLS options (Node.js convention)
    const ws = new WS(`wss://localhost:${server.port}`, {
      cert: MTLS_CERT.cert,
      key: MTLS_CERT.key,
      ca: MTLS_CERT.cert,
      rejectUnauthorized: false,
    });

    ws.on("open", () => ws.send("hello"));
    ws.on("message", (data: any) => {
      clearTimeout(timeout);
      resolve(data.toString());
      ws.close();
    });
    ws.on("error", (err: any) => {
      clearTimeout(timeout);
      reject(new Error(`ws error: ${err.message}`));
    });

    expect(await promise).toBe("ws-mtls-ok");
  });

  it("should connect with Buffer cert/key", async () => {
    using server = Bun.serve({
      port: 0,
      tls: {
        ...MTLS_CERT,
        ca: MTLS_CERT.cert,
        requestCert: true,
        rejectUnauthorized: true,
      },
      fetch(req, server) {
        if (server.upgrade(req)) return undefined;
        return new Response("fail", { status: 400 });
      },
      websocket: {
        open(ws) {
          ws.send("buffer-ok");
        },
        message(ws, msg) {
          ws.send(`echo:${msg}`);
        },
      },
    });

    const { promise, resolve, reject } = Promise.withResolvers<string>();
    const timeout = setTimeout(() => reject(new Error("Timeout")), 5000);

    const ws = new WebSocket(`wss://localhost:${server.port}`, {
      tls: {
        cert: Buffer.from(MTLS_CERT.cert),
        key: Buffer.from(MTLS_CERT.key),
        ca: Buffer.from(MTLS_CERT.cert),
        rejectUnauthorized: false,
      },
    });

    ws.onopen = () => ws.send("hello");
    ws.onmessage = (e) => {
      clearTimeout(timeout);
      resolve(e.data as string);
      ws.close();
    };
    ws.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("WebSocket error"));
    };

    expect(await promise).toBe("buffer-ok");
  });

  it("should echo messages over mTLS WebSocket", async () => {
    using server = Bun.serve({
      port: 0,
      tls: {
        ...MTLS_CERT,
        ca: MTLS_CERT.cert,
        requestCert: true,
        rejectUnauthorized: true,
      },
      fetch(req, server) {
        if (server.upgrade(req)) return undefined;
        return new Response("fail", { status: 400 });
      },
      websocket: {
        message(ws, msg) {
          ws.send(msg);
        },
      },
    });

    const { promise, resolve, reject } = Promise.withResolvers<string>();
    const timeout = setTimeout(() => reject(new Error("Timeout")), 5000);
    const testMessage = "Hello mTLS WebSocket! 🔒";

    const ws = new WebSocket(`wss://localhost:${server.port}`, {
      tls: {
        cert: MTLS_CERT.cert,
        key: MTLS_CERT.key,
        ca: MTLS_CERT.cert,
        rejectUnauthorized: false,
      },
    });

    ws.onopen = () => ws.send(testMessage);
    ws.onmessage = (e) => {
      clearTimeout(timeout);
      resolve(e.data as string);
      ws.close();
    };
    ws.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("WebSocket error"));
    };

    expect(await promise).toBe(testMessage);
  });
});
