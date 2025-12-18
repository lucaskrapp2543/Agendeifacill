import type { HandlerEvent } from '@netlify/functions';

export function json(statusCode: number, body: any, extraHeaders?: Record<string, string>) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Evita cache de respostas sensíveis
      'Cache-Control': 'no-store',
      ...(extraHeaders || {}),
    },
    body: JSON.stringify(body ?? {}),
  };
}

export function getQueryParam(event: HandlerEvent, key: string): string | null {
  return (event.queryStringParameters && event.queryStringParameters[key]) || null;
}

export function parseJsonBody<T = any>(event: HandlerEvent): T | null {
  if (!event.body) return null;
  try {
    return JSON.parse(event.body) as T;
  } catch {
    return null;
  }
}


