import {
  type ExportConfig,
  type MetricsExportDependencies,
} from '../../app/integrate-metrics-export-to-prometheus-utils';

export interface PrometheusAdapterOptions {
  endpoint: string;
  interval?: number;
  enabled?: boolean;
  labels?: Record<string, string>;
  pushPath?: string;
  healthPath?: string;
  fetchImpl?: typeof fetch;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function joinUrl(base: string, path?: string): string {
  if (!path) {
    return base;
  }

  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  return `${trimTrailingSlash(base)}${path.startsWith('/') ? '' : '/'}${path}`;
}

function toExportConfig(options: PrometheusAdapterOptions): ExportConfig {
  return {
    endpoint: trimTrailingSlash(options.endpoint),
    interval: options.interval ?? 15,
    enabled: options.enabled ?? true,
    labels: options.labels ?? {},
  };
}

async function parsePushedSeries(response: Response): Promise<number> {
  try {
    const payload = (await response.json()) as { pushedSeries?: number; series?: number };
    if (typeof payload.pushedSeries === 'number') {
      return payload.pushedSeries;
    }

    if (typeof payload.series === 'number') {
      return payload.series;
    }
  } catch {
    // Fall back to the response status below.
  }

  return response.ok ? 1 : 0;
}

export function createPrometheusMetricsExportDependencies(
  options: PrometheusAdapterOptions,
): MetricsExportDependencies {
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    async resolveConfig() {
      const config = toExportConfig(options);
      return config.enabled ? config : null;
    },

    async pushMetrics(config) {
      const response = await fetchImpl(joinUrl(config.endpoint, options.pushPath), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: config.endpoint,
          interval: config.interval,
          enabled: config.enabled,
          labels: config.labels,
        }),
      });

      return {
        accepted: response.ok,
        pushedSeries: await parsePushedSeries(response),
      };
    },

    async queryExporterHealth(endpoint) {
      const response = await fetchImpl(joinUrl(endpoint, options.healthPath), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      return {
        healthy: response.ok,
        statusCode: response.status,
      };
    },
  };
}