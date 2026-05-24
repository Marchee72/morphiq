export interface Message {
  id?: string;
  profileId: string;
  timestamp: Date;
  sender: 'user' | 'assistant';
  content: string;
}
