export type Status = 'accepted' | 'rejected' | 'other';
export type Topic = 'scholarship' | 'job' | 'other';

export interface EmailSummary {
  id: string;
  thread_id: string | null;
  sender: string | null;
  sender_email: string | null;
  subject: string | null;
  snippet: string | null;
  status: Status;
  topic: Topic;
  received_at: number | null;
  matched_keywords?: string[];
}

export interface EmailDetail extends EmailSummary {
  body: string | null;
  rfc822_message_id: string | null;
}

export interface Stats {
  total: number;
  accepted: number;
  rejected: number;
  scholarship_total: number;
  scholarship_accepted: number;
  scholarship_rejected: number;
}
