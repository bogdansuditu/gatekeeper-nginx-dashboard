import axios, { AxiosInstance } from 'axios';
import https from 'node:https';
import { config } from '../config.js';

export interface CloudflareTunnel {
  id: string;
  name: string;
  status: string; // 'healthy' | 'down' | 'inactive' | 'degraded'
  created_at: string;
  conns_active_at?: string;
  remote_config?: boolean;
}

export interface CloudflareIngressRule {
  hostname?: string;
  service: string;
  path?: string;
  originRequest?: Record<string, unknown>;
}

export interface CloudflareTunnelConfig {
  tunnel_id: string;
  version?: number;
  config?: {
    ingress?: CloudflareIngressRule[];
    'warp-routing'?: {
      enabled: boolean;
    };
  };
}

export class CloudflareClient {
  private accountId: string;
  private apiToken: string;
  private client: AxiosInstance;

  constructor(accountId: string, apiToken: string) {
    this.accountId = accountId.trim();
    this.apiToken = apiToken.trim();

    this.client = axios.create({
      baseURL: 'https://api.cloudflare.com/client/v4',
      timeout: 15000,
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Gatekeeper-Cloudflare-Sync/1.0',
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: config.strictSSL,
      }),
    });
  }

  /**
   * List non-deleted Cloudflare Tunnels in the account
   */
  async listTunnels(): Promise<CloudflareTunnel[]> {
    try {
      const response = await this.client.get(`/accounts/${this.accountId}/cfd_tunnel?is_deleted=false`);
      if (response.data && response.data.success && Array.isArray(response.data.result)) {
        return response.data.result.map((t: any) => ({
          id: t.id,
          name: t.name,
          status: t.status || 'unknown',
          created_at: t.created_at,
          conns_active_at: t.conns_active_at,
          remote_config: t.remote_config,
        }));
      }
      return [];
    } catch (err: any) {
      const msg = err.response?.data?.errors?.[0]?.message || err.message || 'Failed to list Cloudflare tunnels';
      throw new Error(`Cloudflare API error: ${msg}`);
    }
  }

  /**
   * Fetch active ingress configurations for a specific tunnel
   */
  async getTunnelConfiguration(tunnelId: string): Promise<CloudflareTunnelConfig> {
    try {
      const response = await this.client.get(`/accounts/${this.accountId}/cfd_tunnel/${tunnelId}/configurations`);
      if (response.data && response.data.success && response.data.result) {
        return response.data.result;
      }
      return { tunnel_id: tunnelId };
    } catch (err: any) {
      const msg = err.response?.data?.errors?.[0]?.message || err.message || 'Failed to get tunnel configuration';
      throw new Error(`Failed to fetch tunnel ingress rules for ${tunnelId}: ${msg}`);
    }
  }

  /**
   * Test Cloudflare credentials and return active tunnels
   */
  async testConnection(): Promise<{
    success: boolean;
    tunnels: CloudflareTunnel[];
    message: string;
  }> {
    try {
      const tunnels = await this.listTunnels();
      return {
        success: true,
        tunnels,
        message: `Successfully connected to Cloudflare API! Found ${tunnels.length} tunnel(s) in account ${this.accountId.slice(0, 6)}...`,
      };
    } catch (err: any) {
      return {
        success: false,
        tunnels: [],
        message: err.message || 'Cloudflare connection test failed',
      };
    }
  }
}
