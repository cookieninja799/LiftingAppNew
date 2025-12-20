import Constants from 'expo-constants';
import { Platform } from 'react-native';

const LOG_SERVER_PORT = 7243;
const LOG_PATH = '/ingest/273bebc2-49d2-4e67-aa1c-1b6f54b489ea';

const fallbackHost = Platform.select({
  android: '10.0.2.2',
  ios: '127.0.0.1',
  default: '127.0.0.1',
});

function getHostFromManifest(): string | undefined {
  const manifest = Constants.manifest2 ?? Constants.manifest;
  if (!manifest) return undefined;
  const debuggerHost =
    typeof manifest.debuggerHost === 'string'
      ? manifest.debuggerHost
      : typeof manifest?.packagerOpts?.devClient?.hostUri === 'string'
      ? manifest.packagerOpts.devClient.hostUri
      : undefined;
  if (!debuggerHost) return undefined;
  return debuggerHost.split(':')[0];
}

function getLogEndpoint() {
  const host = getHostFromManifest() ?? fallbackHost;
  return `http://${host}:${LOG_SERVER_PORT}${LOG_PATH}`;
}

export function debugLog({
  location,
  message,
  data,
  hypothesisId,
  runId,
  sessionId = 'debug-session',
}: {
  location: string;
  message: string;
  data?: Record<string, unknown>;
  hypothesisId: string;
  runId: string;
  sessionId?: string;
}) {
  fetch(getLogEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location,
      message,
      data: data ?? {},
      timestamp: Date.now(),
      sessionId,
      runId,
      hypothesisId,
    }),
  }).catch(() => {});
}
