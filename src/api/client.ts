/**
 * API Client for ABC Hotel Frontend
 */
import { ApiResponse } from '../types/index.ts';

function getApiBase(): string {
  if ((import.meta as any).env?.VITE_API_URL) {
    return (import.meta as any).env.VITE_API_URL.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host.includes('web.app') || host.includes('firebaseapp.com')) {
      return 'https://ais-pre-4mlfcjwnlezh6laaee6l3m-957856789904.asia-southeast1.run.app/api';
    }
  }
  return '/api';
}

const API_BASE = getApiBase();

export class ApiError extends Error {
  public code: string;
  public details?: any;
  public status: number;

  constructor(message: string, code = 'API_ERROR', status = 400, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export async function request<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('abc_auth_token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {})
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  let data: ApiResponse<T>;
  try {
    data = await response.json();
  } catch (err) {
    let message = 'Invalid server response. Please try again.';
    if (response.status === 401) {
      message = 'Your session has expired. Please log in again.';
    } else if (response.status === 403) {
      message = 'Access denied: You do not have permission to access this resource.';
    } else if (response.status >= 500 || response.status === 0) {
      message = 'Server is connecting or temporarily unavailable. Please try again.';
    }
    throw new ApiError(message, 'PARSE_ERROR', response.status);
  }

  if (!response.ok || !data.success) {
    if (response.status === 401) {
      // Clear expired or invalid token
      localStorage.removeItem('abc_auth_token');
    }
    const error = data.error || {
      code: 'REQUEST_FAILED',
      message: 'An error occurred while processing your request.'
    };

    let displayMessage = error.message;
    if (error.details && Array.isArray(error.details) && error.details.length > 0) {
      const issueMessages = error.details.map((d: any) => d.message).filter(Boolean);
      if (issueMessages.length > 0) {
        displayMessage = issueMessages.join('. ');
      }
    }

    throw new ApiError(displayMessage, error.code, response.status, error.details);
  }

  return data.data as T;
}
