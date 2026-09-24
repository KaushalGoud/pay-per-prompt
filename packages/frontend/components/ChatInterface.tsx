"use client";

import { useState, useRef, useEffect } from "react";
import { Message, Transaction, LedgerProof } from "@/lib/types";
import { MessageBubble } from "./MessageBubble";
import { Button } from "@/components/ui/button";
import { Loader2, Send } from "lucide-react";
import { fetchWithPayment } from "@/lib/x402-hedera-client";
import { decodePaymentResponseHeader } from "@x402/fetch";

interface ChatInterfaceProps {
  messages: Message[];
  onNewMessage: (message: Message, transaction?: Transaction) => void;
}

interface AskResponseData {
  answer?: string;
  ledger?: {
    topicId: string;
    sequenceNumber: number;
    txId: string;
    mirrorUrl: string;
    hashscanUrl: string;
  };
}

export function ChatInterface({ messages, onNewMessage }: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentStatus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: input,
      timestamp: Date.now(),
    };

    onNewMessage(userMessage);

    setInput("");
    setIsLoading(true);
    setCurrentStatus("Paying on Hedera testnet & generating answer...");

    try {
      // One call: fetchWithPayment handles 402 → sign → retry internally
      const response = await fetchWithPayment("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: userMessage.content }),
      });

      const data = (await response.json()) as AskResponseData;

      if (!response.ok) {
        throw new Error((data as { error?: string }).error || "Unable to get a response.");
      }

      // Pull real settlement details from the PAYMENT-RESPONSE header
      let paymentAmount: string | undefined;
      let txId: string | undefined;

      const paymentResponseHeader =
        response.headers.get("PAYMENT-RESPONSE") || response.headers.get("payment-response");

      if (paymentResponseHeader) {
        const decoded = decodePaymentResponseHeader(paymentResponseHeader) as {
          transaction?: string;
        };
        if (decoded?.transaction) {
          const [account, timePart] = decoded.transaction.split("@");
          const [seconds, nanos] = timePart.split(".");
          txId = `${account}-${seconds}-${nanos}`;
        }
        paymentAmount = process.env.NEXT_PUBLIC_PRICE_HBAR || "0.1";
      }

      // Every fulfilled answer carries its HCS audit proof
      const ledger: LedgerProof | undefined = data.ledger
        ? {
            topicId: data.ledger.topicId,
            sequenceNumber: data.ledger.sequenceNumber,
            mirrorUrl: data.ledger.mirrorUrl,
            hashscanUrl: data.ledger.hashscanUrl,
          }
        : undefined;

      const aiMessage: Message = {
        id: `msg-${Date.now() + 1}`,
        role: "assistant",
        content: typeof data.answer === "string" && data.answer.trim() ? data.answer : "No response was returned.",
        paymentAmount,
        txId,
        ledger,
        timestamp: Date.now(),
      };

      const transaction = txId
        ? {
            id: `tx-${Date.now()}`,
            timestamp: Date.now(),
            amount: paymentAmount ?? "0.1",
            txId,
          }
        : undefined;

      onNewMessage(aiMessage, transaction);
    } catch (error) {
      console.error("Error:", error);
      const errorText = error instanceof Error ? error.message : "Sorry, something went wrong. Please try again.";
      const errorMessage: Message = {
        id: `msg-${Date.now() + 2}`,
        role: "assistant",
        content: errorText,
        timestamp: Date.now(),
      };
      onNewMessage(errorMessage);
    } finally {
      setIsLoading(false);
      setCurrentStatus(null);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4">
        {messages.length === 0 && !isLoading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">PayPerPrompt</h1>
              <p className="text-sm text-muted-foreground">
                Ask questions and pay with HBAR. Start your conversation below.
              </p>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {isLoading && currentStatus && (
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                <Loader2 className="w-4 h-4 animate-spin text-accent" />
                <span>{currentStatus}</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 lg:p-6 border-t border-border/30 bg-secondary/50">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question..."
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 rounded-lg bg-background text-foreground border border-border/50 placeholder:text-muted-foreground/50 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          />
          <Button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-accent hover:bg-accent/90 text-accent-foreground gap-2"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {isLoading ? "" : "Ask"}
          </Button>
        </form>
      </div>
    </div>
  );
}
