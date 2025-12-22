/**
 * Centralized error handler for user-facing error messages.
 * Maps technical errors to user-friendly messages while logging full details for debugging.
 */
export function getUserFriendlyError(error: any, context: string): string {
  // Log full error for debugging (in development)
  if (import.meta.env.DEV) {
    console.error(`Error in ${context}:`, error);
  }
  
  const message = error?.message || '';
  const code = error?.code || '';
  
  // Authentication errors
  if (message.includes('Invalid login credentials')) {
    return 'Invalid email or password. Please check your credentials.';
  }
  if (message.includes('Email not confirmed')) {
    return 'Please confirm your email address before signing in.';
  }
  if (message.includes('JWT') || message.includes('token')) {
    return 'Your session has expired. Please sign in again.';
  }
  if (code === 'invalid_credentials' || message.includes('invalid_credentials')) {
    return 'Invalid credentials. Please try again.';
  }
  
  // Permission/RLS errors
  if (message.includes('row-level security') || code === 'PGRST301') {
    return 'You do not have permission to perform this action.';
  }
  if (code === 'PGRST116') {
    return 'Access denied. You may not have the required permissions.';
  }
  
  // Constraint violations
  if (code === '23505' || message.includes('duplicate key')) {
    return 'This record already exists.';
  }
  if (code === '23503' || message.includes('foreign key')) {
    return 'Cannot complete this action. The record is linked to other data.';
  }
  if (code === '23502' || message.includes('not-null')) {
    return 'Required information is missing. Please fill in all required fields.';
  }
  
  // Network errors
  if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return 'Unable to connect. Please check your internet connection.';
  }
  
  // Rate limiting
  if (message.includes('rate limit') || code === '429') {
    return 'Too many requests. Please wait a moment and try again.';
  }
  
  // Generic fallback
  return 'An error occurred. Please try again or contact support if the problem persists.';
}
