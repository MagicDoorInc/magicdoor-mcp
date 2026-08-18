/** Minimal MCP client: spawns the built server and speaks JSON-RPC over its stdio. */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const entry = join(dirname(fileURLToPath(import.meta.url)), "..", "dist", "index.js");

export function startServer(env) {
  const child = spawn("node", [entry], {
    env: { ...process.env, ...env },
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stdout = "";
  const pending = new Map();
  let stderr = "";

  child.stderr.on("data", (chunk) => (stderr += chunk));
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
    let newline;
    while ((newline = stdout.indexOf("\n")) !== -1) {
      const line = stdout.slice(0, newline).trim();
      stdout = stdout.slice(newline + 1);
      if (!line) continue;
      const message = JSON.parse(line);
      const resolve = pending.get(message.id);
      if (resolve) {
        pending.delete(message.id);
        resolve(message);
      }
    }
  });

  let nextId = 0;

  return {
    call(method, params = {}) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        pending.set(id, resolve);
        child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
        setTimeout(() => reject(new Error(`timed out waiting for ${method}`)), 10_000).unref();
      });
    },
    notify(method, params = {}) {
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
    },
    async handshake() {
      await this.call("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test", version: "1" },
      });
      this.notify("notifications/initialized");
    },
    stderr: () => stderr,
    stop: () => child.kill(),
    exited: () => new Promise((resolve) => child.on("exit", resolve)),
  };
}
