"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const API_URL = "/api";
const RESEND_SECONDS = 30;

/**
 * Asks the user for the 6-digit code that was emailed to them and verifies it.
 * Sends the first code automatically when `autoSend` is true.
 */
export function VerifyEmailForm({
  email,
  autoSend = true,
  onVerified,
}: {
  email: string;
  autoSend?: boolean;
  onVerified: () => void;
}) {
  const [code, setCode] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState("");
  const [info, setInfo] = React.useState("");
  const [cooldown, setCooldown] = React.useState(0);
  const sentOnce = React.useRef(false);

  const sendCode = React.useCallback(async () => {
    setError("");
    setInfo("");
    setSending(true);
    try {
      const res = await fetch(`${API_URL}/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, purpose: "VERIFY" }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "Could not send the verification code.");
        return;
      }
      setInfo(`We sent a 6-digit code to ${email}. It expires in 10 minutes.`);
      setCooldown(RESEND_SECONDS);
    } catch {
      setError("Unable to connect to LUCOUS server.");
    } finally {
      setSending(false);
    }
  }, [email]);

  React.useEffect(() => {
    if (autoSend && !sentOnce.current) {
      sentOnce.current = true;
      void sendCode();
    }
  }, [autoSend, sendCode]);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "Invalid or expired code.");
        return;
      }
      onVerified();
    } catch {
      setError("Unable to connect to LUCOUS server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="grid gap-3.5" onSubmit={onSubmit}>
      <p className="text-sm text-muted-foreground">
        {info || `Verify ${email} to finish creating your account.`}
      </p>

      <label className="grid gap-1.5 text-sm font-medium">
        Verification code
        <Input
          required
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="Enter 6-digit code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className="h-10 tracking-widest"
          disabled={loading}
        />
      </label>

      {error ? (
        <p className="text-sm font-normal text-destructive">{error}</p>
      ) : null}

      <Button type="submit" className="h-10 w-full text-sm" disabled={loading}>
        {loading ? "Verifying..." : "Verify email"}
      </Button>

      <Button
        type="button"
        variant="ghost"
        className="h-9 w-full text-sm"
        disabled={sending || cooldown > 0}
        onClick={sendCode}
      >
        {sending
          ? "Sending..."
          : cooldown > 0
            ? `Resend code in ${cooldown}s`
            : "Resend code"}
      </Button>
    </form>
  );
}
