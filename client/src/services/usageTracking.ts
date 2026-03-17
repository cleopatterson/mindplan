import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

export type EventType =
  | 'login'
  | 'logout'
  | 'parse_start'
  | 'parse_success'
  | 'parse_error'
  | 'pdf_export'
  | 'view_change';

interface UsageEvent {
  userId: string;
  userEmail: string;
  eventType: EventType;
  timestamp: Timestamp;
  sessionId: string;
  metadata?: Record<string, unknown>;
}

// One session ID per browser tab
const SESSION_ID = crypto.randomUUID();

export function getSessionId() {
  return SESSION_ID;
}

/** Fire-and-forget usage event — never throws */
export function logUsageEvent(
  userId: string,
  userEmail: string,
  eventType: EventType,
  metadata?: Record<string, unknown>,
) {
  const event: UsageEvent = {
    userId,
    userEmail,
    eventType,
    timestamp: Timestamp.now(),
    sessionId: SESSION_ID,
    metadata,
  };

  addDoc(collection(db, 'usage_events'), event).catch((err) =>
    console.warn('Failed to log usage event:', err),
  );
}
