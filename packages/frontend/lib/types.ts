export type MessageRole = "user" | "assistant";

export interface LedgerProof {
  topicId: string;
  sequenceNumber: number;
  mirrorUrl: string;
  hashscanUrl: string;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  paymentAmount?: string;
  txId?: string;
  ledger?: LedgerProof;
  timestamp: number;
}

export interface Transaction {
  id: string;
  timestamp: number;
  amount: string;
  txId: string;
}

export type StatusStep = "sending" | "payment-required" | "paying" | "generating" | "complete";
