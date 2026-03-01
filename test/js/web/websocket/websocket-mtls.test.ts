import { describe, expect, it } from "bun:test";
import { tls } from "harness";

const MTLS_CERT = { ...tls };

function makeMTLSServer() {
  return Bun.serve({
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
        ws.send(msg);
      },
    },
  });
}

describe("WebSocket mTLS", () => {
  it("should connect with tls: { cert, key, ca } (Bun native style)", async () => {
    using server = makeMTLSServer();

    const { promise, resolve, reject } = Promise.withResolvers<string>();

    const ws = new WebSocket(`wss://localhost:${server.port}`, {
      tls: {
        cert: MTLS_CERT.cert,
        key: MTLS_CERT.key,
        ca: MTLS_CERT.cert,
        rejectUnauthorized: false,
      },
    });

    ws.onmessage = (e) => {
      resolve(e.data as string);
      ws.close();
    };
    ws.onerror = () => reject(new Error("WebSocket error"));

    expect(await promise).toBe("mtls-ok");
  });

  it("should connect with top-level cert, key, ca (Node.js ws style)", async () => {
    using server = makeMTLSServer();

    const { promise, resolve, reject } = Promise.withResolvers<string>();

    // Pass cert/key/ca at top level (like Node.js ws library)
    const ws = new WebSocket(`wss://localhost:${server.port}`, {
      cert: MTLS_CERT.cert,
      key: MTLS_CERT.key,
      ca: MTLS_CERT.cert,
      rejectUnauthorized: false,
    } as any);

    ws.onmessage = (e) => {
      resolve(e.data as string);
      ws.close();
    };
    ws.onerror = () => reject(new Error("WebSocket error"));

    expect(await promise).toBe("mtls-ok");
  });

  it("should reject client without cert when server requires it", async () => {
    using server = makeMTLSServer();

    const { promise, resolve } = Promise.withResolvers<{ errorFired: boolean; closeCode: number }>();

    let errorFired = false;

    // No client cert - should be rejected by server
    const ws = new WebSocket(`wss://localhost:${server.port}`, {
      tls: {
        rejectUnauthorized: false,
      },
    });

    ws.onerror = () => {
      errorFired = true;
    };
    ws.onclose = (e) => {
      resolve({ errorFired, closeCode: e.code });
    };

    const result = await promise;
    expect(result.errorFired).toBe(true);
  });

  it("should work with ws module using top-level mTLS options", async () => {
    using server = makeMTLSServer();

    const WS = require("ws");
    const { promise, resolve, reject } = Promise.withResolvers<string>();

    // Use ws module with top-level TLS options (Node.js convention)
    const ws = new WS(`wss://localhost:${server.port}`, {
      cert: MTLS_CERT.cert,
      key: MTLS_CERT.key,
      ca: MTLS_CERT.cert,
      rejectUnauthorized: false,
    });

    ws.on("message", (data: any) => {
      resolve(data.toString());
      ws.close();
    });
    ws.on("error", (err: any) => {
      reject(new Error(`ws error: ${err.message}`));
    });

    expect(await promise).toBe("mtls-ok");
  });

  it("should connect with Buffer cert/key", async () => {
    using server = makeMTLSServer();

    const { promise, resolve, reject } = Promise.withResolvers<string>();

    const ws = new WebSocket(`wss://localhost:${server.port}`, {
      tls: {
        cert: Buffer.from(MTLS_CERT.cert),
        key: Buffer.from(MTLS_CERT.key),
        ca: Buffer.from(MTLS_CERT.cert),
        rejectUnauthorized: false,
      },
    });

    ws.onmessage = (e) => {
      resolve(e.data as string);
      ws.close();
    };
    ws.onerror = () => reject(new Error("WebSocket error"));

    expect(await promise).toBe("mtls-ok");
  });

  it("should echo messages over mTLS WebSocket", async () => {
    using server = makeMTLSServer();

    const { promise, resolve, reject } = Promise.withResolvers<string>();
    const testMessage = "Hello mTLS WebSocket! 🔒";

    const ws = new WebSocket(`wss://localhost:${server.port}`, {
      tls: {
        cert: MTLS_CERT.cert,
        key: MTLS_CERT.key,
        ca: MTLS_CERT.cert,
        rejectUnauthorized: false,
      },
    });

    let gotServerMessage = false;
    ws.onmessage = (e) => {
      if (!gotServerMessage) {
        // First message is "mtls-ok" from server open handler
        gotServerMessage = true;
        ws.send(testMessage);
        return;
      }
      resolve(e.data as string);
      ws.close();
    };
    ws.onerror = () => reject(new Error("WebSocket error"));

    expect(await promise).toBe(testMessage);
  });
});
