"use client";

import { Message } from "@/lib/types";
import { ExternalLink, FileCheck2 } from "lucide-react";

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${
          isUser ? "bg-accent text-accent-foreground rounded-br-none" : "bg-message-bg text-foreground rounded-bl-none"
        }`}
      >
        <p className="text-sm leading-relaxed">{message.content}</p>

        {message.paymentAmount && message.txId && !isUser && (
          <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              <span className="text-accent font-semibold">{message.paymentAmount}</span> HBAR paid
            </span>
            <a
              href={`https://hashscan.io/testnet/transaction/${message.txId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:text-accent/80 transition-colors ml-2"
              aria-label="View transaction on HashScan"
            >
              <ExternalLink size={14} />
            </a>
          </div>
        )}

        {message.ledger && !isUser && (
          <div className="mt-2 pt-2 border-t border-border/40">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <FileCheck2 size={13} className="text-accent" />
              <span>
                Audited on HCS topic <span className="text-accent font-semibold">{message.ledger.topicId}</span> · seq{" "}
                <span className="text-accent font-semibold">{message.ledger.sequenceNumber}</span>
              </span>
            </p>
            <div className="mt-1.5 flex items-center gap-3 text-xs">
              <a
                href={message.ledger.hashscanUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:text-accent/80 transition-colors inline-flex items-center gap-1"
              >
                HashScan <ExternalLink size={12} />
              </a>
              <a
                href={message.ledger.mirrorUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-accent transition-colors inline-flex items-center gap-1"
              >
                Mirror node <ExternalLink size={12} />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
