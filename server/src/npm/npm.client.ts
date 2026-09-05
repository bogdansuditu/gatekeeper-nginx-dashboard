import https from 'node:https';
import axios from 'axios';
import { config } from '../config.js';

export interface NpmProxyHostResponse {
  id: number;
  created_on: string;
  modified_on: string;
  owner_user_id: number;
  domain_names: string[];
  forward_host: string;
  forward_port: number;
  forward_scheme: string;
  enabled: number | boolean;
  ssl_forced: number | boolean;
  certificate_id: number;
  meta?: Record<string, unknown>;
}

export class NpmClient {
  private rawHost: string;
  private identity: string;
  private secret: string;
  private token: string | null = null;
  private activeHost: string;
  private httpsAgent: https.Agent;
  private timeoutMs: number;

  constructor(host: string, identity: string, secret: string) {
    this.rawHost = host.replace(/\/+$/, '');
    this.activeHost = this.rawHost;
    this.identity = identity;
    this.secret = secret;
    this.timeoutMs = config.npmTimeoutMs;
    this.httpsAgent = new https.Agent({
      rejectUnauthorized: config.strictSSL,
    });
  }

  private getCandidateHosts(): string[] {
    const candidates: string[] = [this.rawHost];

    // In Docker containers, 'localhost' or '127.0.0.1' points to the container itself.
    // Automatically provide 'host.docker.internal' as candidate for host-bound NPM instances.
    if (this.rawHost.includes('://localhost') || this.rawHost.includes('://127.0.0.1')) {
      const dockerHost = this.rawHost
        .replace('://localhost', '://host.docker.internal')
        .replace('://127.0.0.1', '://host.docker.internal');
      if (!candidates.includes(dockerHost)) {
        candidates.push(dockerHost);
      }
    }

    return candidates;
  }

  async authenticate(): Promise<string> {
    const candidateHosts = this.getCandidateHosts();
    let lastError: any = null;

    for (const host of candidateHosts) {
      try {
        const url = `${host}/api/tokens`;
        const response = await axios.post(
          url,
          { identity: this.identity, secret: this.secret },
          {
            httpsAgent: this.httpsAgent,
            timeout: this.timeoutMs,
            headers: { 'Content-Type': 'application/json' },
          }
        );

        if (response.data && response.data.token) {
          this.activeHost = host;
          this.token = response.data.token;
          return this.token!;
        }
      } catch (err: any) {
        lastError = err;
      }
    }

    const isTimeout = lastError?.code === 'ECONNABORTED' || lastError?.message?.includes('timeout');
    if (isTimeout) {
      throw new Error(
        `NPM connection timed out after ${this.timeoutMs}ms. Since Gatekeeper runs in Docker, if NPM is running on your host machine, use "http://host.docker.internal:81" or your host LAN IP instead of "localhost".`
      );
    }

    const message = lastError?.response?.data?.message || lastError?.message || 'Authentication failed';
    throw new Error(`NPM Authentication failed: ${message}`);
  }

  async getProxyHosts(): Promise<NpmProxyHostResponse[]> {
    if (!this.token) {
      await this.authenticate();
    }

    const url = `${this.activeHost}/api/nginx/proxy-hosts`;
    const response = await axios.get(url, {
      httpsAgent: this.httpsAgent,
      timeout: this.timeoutMs,
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    if (Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  }

  async testConnection(): Promise<{ success: boolean; hostCount: number; message: string }> {
    try {
      await this.authenticate();
      const hosts = await this.getProxyHosts();
      const activeCount = hosts.filter((h) => Boolean(h.enabled)).length;
      return {
        success: true,
        hostCount: activeCount,
        message: `Successfully connected to NPM via ${this.activeHost}. Found ${hosts.length} proxy host(s) (${activeCount} active). Click "Import Hosts Now" or "Save & Sync Hosts" to populate your dashboard.`,
      };
    } catch (err: any) {
      return {
        success: false,
        hostCount: 0,
        message: err.message || 'Connection failed',
      };
    }
  }
}
