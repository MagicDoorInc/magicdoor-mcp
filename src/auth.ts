/**
 * Turns the long-lived API key into short-lived access tokens.
 *
 * MagicDoor issues no refresh token — the API key is the durable credential, so renewing is just
 * exchanging the key again. This keeps one token in memory, renews it shortly before it expires,
 * and collapses concurrent renewals into a single request so a burst of tool calls cannot
 * stampede the auth service.
 */
import type { Config } from "./config.js";

/** Renew this long before the token actually expires, to cover clock skew and a slow request. */
const RENEW_BEFORE_EXPIRY_MS = 60_000;

interface TokenResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}

export class TokenProvider {
  private token: string | null = null;
  private expiresAt = 0;
  private inFlight: Promise<string> | null = null;

  constructor(private readonly config: Config) {}

  /** A valid access token, exchanging the API key first if the current one is missing or stale. */
  async getToken(): Promise<string> {
    if (this.token && Date.now() < this.expiresAt - RENEW_BEFORE_EXPIRY_MS) {
      return this.token;
    }

    this.inFlight ??= this.exchange().finally(() => {
      this.inFlight = null;
    });

    return this.inFlight;
  }

  /** Drop the cached token so the next call exchanges the key again. Used after a 401. */
  invalidate(): void {
    this.token = null;
    this.expiresAt = 0;
  }

  private async exchange(): Promise<string> {
    const response = await fetch(`${this.config.authUrl}/api-keys/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: this.config.apiKey }),
    });

    if (response.status === 401) {
      // MagicDoor answers every bad key the same way on purpose, so this list is the full set
      // of possibilities rather than a guess at which one happened.
      throw new Error(
        "MagicDoor rejected the API key. It may be revoked, expired, mistyped, or belong to a " +
          "deactivated user. Check it under Settings → API keys.",
      );
    }

    if (!response.ok) {
      throw new Error(
        `Could not reach MagicDoor to exchange the API key (HTTP ${response.status}). ` +
          `Tried ${this.config.authUrl}/api-keys/token.`,
      );
    }

    const body = (await response.json()) as TokenResponse;
    this.token = body.accessToken;
    this.expiresAt = Date.now() + body.expiresIn * 1000;

    return this.token;
  }
}
