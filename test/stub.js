/**
 * Stands in for MagicDoor's Auth and Portal services so the server can be exercised without a
 * live backend: records what it was sent, and can be told to reject a key or expire a token.
 */
import { createServer } from "node:http";

export function startStub() {
  const requests = [];
  const tokenCalls = [];
  const state = { failNext401: false, rejectKey: false, expiresIn: 900 };
  /** Per-path canned responses, for exercising how oversized payloads get trimmed. */
  const responses = new Map();
  let issued = 0;

  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://stub");

    if (req.method === "POST" && url.pathname === "/api-keys/token") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        const parsed = JSON.parse(body || "{}");
        tokenCalls.push(parsed);

        if (state.rejectKey || !String(parsed.key ?? "").startsWith("magic_")) {
          res.writeHead(401).end();
          return;
        }

        issued += 1;
        json(res, { accessToken: fakeJwt(issued), tokenType: "Bearer", expiresIn: state.expiresIn });
      });
      return;
    }

    requests.push({
      host: req.headers.host ?? "",
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      all: [...url.searchParams.entries()],
      auth: req.headers.authorization ?? "",
    });

    if (state.failNext401) {
      state.failNext401 = false;
      res.writeHead(401).end();
      return;
    }

    if (url.pathname.includes("forbidden")) {
      res.writeHead(403).end();
      return;
    }

    json(res, responses.get(url.pathname) ?? {
      items: [{ id: "1", name: "Test Property" }], totalCount: 1, totalPages: 1, page: 1, pageSize: 25,
    });
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve({
        server, requests, tokenCalls, state,
        setResponse: (path, body) => responses.set(path, body),
        url: `http://127.0.0.1:${server.address().port}`,
      });
    });
  });
}

function json(res, body) {
  const payload = JSON.stringify(body);
  res.writeHead(200, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) });
  res.end(payload);
}

function fakeJwt(sequence) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "RS256" })}.${encode({ sub: "1", seq: sequence })}.signature`;
}
