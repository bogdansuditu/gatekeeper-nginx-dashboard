import { FastifyPluginAsync } from 'fastify';
import { db } from '../db/database.js';
import { getSyncStatus } from '../npm/npm.service.js';
import { getCfSyncStatus } from '../cloudflare/cloudflare.service.js';

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  // Liveness check for container orchestration
  fastify.get('/api/v1/health', async () => {
    return { status: 'healthy', timestamp: new Date().toISOString() };
  });

  // Aggregated health metrics for KPI cards & donut gauges
  fastify.get('/api/v1/health/stats', async () => {
    const apps = db.prepare(`
      SELECT id, is_ssl, forward_scheme, forward_port, last_known_status, last_response_time_ms
      FROM unified_applications
      WHERE is_enabled = 1
    `).all() as any[];

    const totalApps = apps.length;
    const onlineApps = apps.filter((a) => a.last_known_status === 'healthy').length;
    const downApps = apps.filter((a) => a.last_known_status === 'down').length;
    const degradedApps = totalApps - onlineApps - downApps;

    const latencies = apps
      .filter((a) => a.last_known_status === 'healthy' && a.last_response_time_ms > 0)
      .map((a) => a.last_response_time_ms);
    const avgLatencyMs = latencies.length > 0
      ? Math.round(latencies.reduce((acc, val) => acc + val, 0) / latencies.length)
      : 0;

    // Protocol distribution for radar/distribution chart
    const httpsCount = apps.filter((a) => a.is_ssl === 1 || a.forward_scheme === 'https').length;
    const httpCount = totalApps - httpsCount;

    // Port classification
    const standardWebPorts = apps.filter((a) => [80, 443, 8080, 8443].includes(a.forward_port)).length;
    const customPorts = totalApps - standardWebPorts;

    const npmSyncStatus = getSyncStatus();
    const cfSyncStatus = getCfSyncStatus();

    // Combined sync status label & count
    let combinedStatus = npmSyncStatus;
    if (cfSyncStatus.status === 'connected') {
      combinedStatus = {
        ...npmSyncStatus,
        hostCount: totalApps,
        message: npmSyncStatus.status === 'connected'
          ? `NPM (${npmSyncStatus.hostCount}) + Cloudflare (${cfSyncStatus.hostCount}) Active`
          : `Cloudflare Connected (${cfSyncStatus.hostCount} hosts)`,
      };
    }

    return {
      totalApps,
      onlineApps,
      downApps,
      degradedApps,
      avgLatencyMs,
      protocolStats: {
        httpsCount,
        httpCount,
      },
      portStats: {
        standardWebPorts,
        customPorts,
      },
      healthRatio: totalApps > 0 ? Math.round((onlineApps / totalApps) * 100) : 100,
      syncStatus: combinedStatus,
      cloudflareSyncStatus: cfSyncStatus,
    };
  });


  // Time-series history for the Latency Wave Chart
  fastify.get('/api/v1/health/history', async () => {
    const samples = db.prepare(`
      SELECT id, timestamp, online_count as onlineCount, down_count as downCount,
             total_count as totalCount, avg_latency_ms as avgLatencyMs
      FROM health_samples
      ORDER BY id ASC
      LIMIT 100
    `).all();

    return { samples };
  });
};
