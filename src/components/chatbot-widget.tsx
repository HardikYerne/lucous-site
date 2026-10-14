"use client";

import { useEffect, useRef, useState } from "react";

const CHATBOT_URL =
    process.env.NEXT_PUBLIC_CHATBOT_URL ??
    "https://lucous-chatbot-frontend.vercel.app/";

const EMBEDDED_CHATBOT_URL = `${CHATBOT_URL}?embedded=true`;

export function ChatbotWidget() {
    const [open, setOpen] = useState(false);
    // Changing this key reloads the chatbot, which returns it to its small closed button.
    const [frameKey, setFrameKey] = useState(0);
    const frameRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        let timer: number | undefined;

        // The chatbot tells us when it opens or closes.
        const handleMessage = (event: MessageEvent) => {
            if (event.origin !== new URL(CHATBOT_URL).origin) return;

            if (event.data?.type === "LUCOUS_CHATBOT_OPEN") setOpen(true);
            if (event.data?.type === "LUCOUS_CHATBOT_CLOSE") setOpen(false);
        };

        // Fallback if the chatbot sends no message. It waits a moment so the
        // first click can finish inside the chatbot before the frame is resized.
        const handleBlur = () => {
            window.clearTimeout(timer);
            timer = window.setTimeout(() => {
                if (document.activeElement === frameRef.current) setOpen(true);
            }, 400);
        };

        window.addEventListener("message", handleMessage);
        window.addEventListener("blur", handleBlur);

        return () => {
            window.clearTimeout(timer);
            window.removeEventListener("message", handleMessage);
            window.removeEventListener("blur", handleBlur);
        };
    }, []);

    // While the chat is open, a click (or Escape) on the website itself closes it,
    // so the transparent chatbot area never keeps blocking the page. Clicks inside
    // the chatbot do not reach the website, so they are not affected.
    useEffect(() => {
        if (!open) return;

        const closeChat = () => {
            setOpen(false);
            setFrameKey((key) => key + 1);
        };
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") closeChat();
        };

        document.addEventListener("pointerdown", closeChat);
        document.addEventListener("keydown", handleKey);

        return () => {
            document.removeEventListener("pointerdown", closeChat);
            document.removeEventListener("keydown", handleKey);
        };
    }, [open]);

    return (
        <div
            className="fixed z-[99999]"
            style={{
                right: open ? "0px" : "16px",
                bottom: open ? "0px" : "16px",

                width: open ? "488px" : "108px",
                height: open ? "748px" : "108px",

                maxWidth: "100vw",
                maxHeight: "100dvh",

                background: "transparent",

                transition:
                    "width 0.25s ease, height 0.25s ease, right 0.25s ease, bottom 0.25s ease",
            }}
        >
            <iframe
                key={frameKey}
                ref={frameRef}
                src={EMBEDDED_CHATBOT_URL}
                title="LUCOUS AI Chatbot"
                className="block h-full w-full border-0"
                allow="microphone"
                style={{ colorScheme: "dark", background: "transparent" }}
            />
        </div>
    );
}