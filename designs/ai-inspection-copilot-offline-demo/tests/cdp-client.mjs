import { execFile, spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

async function terminateProcessTree(child) {
  if (child.exitCode !== null || child.killed) return;
  if (process.platform !== "win32") {
    child.kill();
    return;
  }
  await new Promise((resolve) => {
    execFile(
      "taskkill.exe",
      ["/PID", String(child.pid), "/T", "/F"],
      { windowsHide: true },
      () => resolve(),
    );
  });
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

class CdpSession {
  constructor(webSocketUrl) {
    this.socket = new WebSocket(webSocketUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async connect() {
    const ready = deferred();
    this.socket.addEventListener("open", ready.resolve, { once: true });
    this.socket.addEventListener("error", ready.reject, { once: true });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const request = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) request?.reject(new Error(message.error.message));
        else request?.resolve(message.result);
        return;
      }
      for (const listener of this.listeners.get(message.method) ?? []) {
        listener(message.params);
      }
    });
    await ready.promise;
    return this;
  }

  send(method, params = {}) {
    const id = this.nextId++;
    const response = deferred();
    this.pending.set(id, response);
    this.socket.send(JSON.stringify({ id, method, params }));
    return response.promise;
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) ?? [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
  }

  once(method) {
    const response = deferred();
    const listener = (params) => {
      const listeners = this.listeners.get(method) ?? [];
      this.listeners.set(
        method,
        listeners.filter((item) => item !== listener),
      );
      response.resolve(params);
    };
    this.on(method, listener);
    return response.promise;
  }

  async evaluate(expression) {
    const response = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (response.exceptionDetails) {
      throw new Error(response.exceptionDetails.text);
    }
    return response.result.value;
  }

  close() {
    this.socket.close();
  }
}

async function waitForDevTools(child) {
  const response = deferred();
  let buffer = "";
  const timeout = setTimeout(
    () => response.reject(new Error("Chrome DevTools endpoint timed out")),
    10_000,
  );
  child.stderr.on("data", (chunk) => {
    buffer += chunk.toString();
    const match = buffer.match(/DevTools listening on (ws:\/\/[^\s]+)/);
    if (match) {
      clearTimeout(timeout);
      response.resolve(match[1]);
    }
  });
  child.once("exit", (code) => {
    clearTimeout(timeout);
    response.reject(new Error(`Chrome exited before DevTools was ready (${code})`));
  });
  return response.promise;
}

export async function launchOfflineChrome() {
  const profileDirectory = await mkdtemp(
    path.join(os.tmpdir(), "ai-inspection-cdp-"),
  );
  const child = spawn(
    chromePath,
    [
      "--headless",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-breakpad",
      "--disable-crash-reporter",
      "--disable-gpu",
      "--disable-renderer-backgrounding",
      "--no-sandbox",
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${profileDirectory}`,
      "--remote-debugging-port=0",
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  const browserWebSocket = await waitForDevTools(child);
  child.stderr?.destroy();
  const { hostname, port } = new URL(browserWebSocket);
  const targets = await fetch(`http://${hostname}:${port}/json/list`).then(
    (response) => response.json(),
  );
  const pageTarget = targets.find((target) => target.type === "page");
  if (!pageTarget) throw new Error("Chrome did not expose a page target");
  const session = await new CdpSession(pageTarget.webSocketDebuggerUrl).connect();

  return {
    session,
    async close() {
      session.close();
      child.stderr?.destroy();
      await terminateProcessTree(child);
      if (child.exitCode === null) {
        await Promise.race([
          once(child, "exit"),
          new Promise((resolve) => setTimeout(resolve, 2_000)),
        ]);
      }
      await rm(profileDirectory, {
        force: true,
        maxRetries: 5,
        recursive: true,
        retryDelay: 100,
      });
    },
  };
}
