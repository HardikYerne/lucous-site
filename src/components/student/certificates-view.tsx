"use client";

import * as React from "react";
import Link from "next/link";
import { Award, Download, FileText, Loader2, Lock } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { RequireStudent } from "@/components/student/require-student";
import { computeProgress } from "@/components/student/progress-utils";
import { apiFetch, getStoredUser, type StudentProgressData } from "@/lib/api";
import { useSession } from "@/lib/use-session";

// Optional: put your own certificate design at public/certificate-template.png.
// When it exists it is used as the background and only the student's name, date and ID are added on top.
const TEMPLATE_URL = "/certificate-template.png";
const W = 1684; // A4 landscape at 2x
const H = 1190;

interface CertData {
  name: string;
  dateText: string;
  certId: string;
}

function hashId(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  return h.toString(36).toUpperCase().padStart(6, "0").slice(-6);
}

function drawCertificate(
  canvas: HTMLCanvasElement,
  data: CertData,
  template: HTMLImageElement | null
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = W;
  canvas.height = H;
  ctx.clearRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  const fitName = (y: number, color: string) => {
    let size = 130;
    ctx.fillStyle = color;
    do {
      ctx.font = `italic ${size}px "Brush Script MT", "Segoe Script", "Snell Roundhand", cursive`;
      size -= 4;
    } while (ctx.measureText(data.name).width > W * 0.7 && size > 40);
    ctx.fillText(data.name, W / 2, y);
  };

  if (template) {
    ctx.drawImage(template, 0, 0, W, H);
    fitName(H * 0.52, "#1f2a5a");
    ctx.font = "30px Georgia, serif";
    ctx.fillStyle = "#333";
    ctx.textAlign = "left";
    ctx.fillText(data.dateText, W * 0.12, H * 0.86);
    ctx.textAlign = "right";
    ctx.fillText(data.certId, W * 0.88, H * 0.86);
    return;
  }

  // Built-in design
  ctx.fillStyle = "#fffdf7";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#1f2a5a";
  ctx.lineWidth = 14;
  ctx.strokeRect(40, 40, W - 80, H - 80);
  ctx.strokeStyle = "#b8892b";
  ctx.lineWidth = 4;
  ctx.strokeRect(70, 70, W - 140, H - 140);

  // Lucous wordmark
  const letters = [
    ["L", "#4285f4"],
    ["u", "#ef6a5b"],
    ["c", "#f4b400"],
    ["o", "#4285f4"],
    ["u", "#34a853"],
    ["s", "#ef6a5b"],
  ] as const;
  ctx.font = "bold 84px Poppins, Arial, sans-serif";
  const widths = letters.map(([l]) => ctx.measureText(l).width);
  let x = W / 2 - widths.reduce((a, b) => a + b, 0) / 2;
  ctx.textAlign = "left";
  letters.forEach(([l, c], i) => {
    ctx.fillStyle = c;
    ctx.fillText(l, x, 240);
    x += widths[i];
  });

  ctx.textAlign = "center";
  ctx.fillStyle = "#1f2a5a";
  ctx.font = "bold 76px Georgia, serif";
  ctx.fillText("CERTIFICATE OF COMPLETION", W / 2, 400);
  ctx.fillStyle = "#b8892b";
  ctx.fillRect(W / 2 - 160, 430, 320, 4);

  ctx.fillStyle = "#555";
  ctx.font = "italic 38px Georgia, serif";
  ctx.fillText("This certificate is proudly presented to", W / 2, 520);

  fitName(690, "#1f2a5a");
  ctx.strokeStyle = "#b8892b";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(W * 0.22, 725);
  ctx.lineTo(W * 0.78, 725);
  ctx.stroke();

  ctx.fillStyle = "#444";
  ctx.font = "34px Georgia, serif";
  ctx.fillText("for successfully completing 100% of their learning journey on Lucous", W / 2, 810);
  ctx.fillText("through lessons, practice and tests, games and AI Tutor discussions.", W / 2, 860);

  ctx.font = "30px Georgia, serif";
  ctx.fillStyle = "#333";
  ctx.textAlign = "left";
  ctx.fillText(`Date: ${data.dateText}`, 170, 1010);
  ctx.textAlign = "right";
  ctx.fillText(`Certificate ID: ${data.certId}`, W - 170, 1010);
  ctx.textAlign = "center";
  ctx.strokeStyle = "#555";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 170, 985);
  ctx.lineTo(W / 2 + 170, 985);
  ctx.stroke();
  ctx.fillText("Lucous Learning", W / 2, 1022);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Minimal single-page A4 PDF that embeds the certificate image.
function buildPdf(jpeg: Uint8Array, imgW: number, imgH: number): Blob {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (data: string | Uint8Array) => {
    const bytes = typeof data === "string" ? enc.encode(data) : data;
    chunks.push(bytes);
    length += bytes.length;
  };
  const obj = (n: number, body: string | Uint8Array[]) => {
    offsets[n] = length;
    push(`${n} 0 obj\n`);
    if (typeof body === "string") push(body);
    else body.forEach(push);
    push("\nendobj\n");
  };
  const content = "q 842 0 0 595 0 0 cm /Im0 Do Q";

  push("%PDF-1.4\n");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  obj(
    3,
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>"
  );
  obj(4, [
    enc.encode(
      `<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`
    ),
    jpeg,
    enc.encode("\nendstream"),
  ]);
  obj(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);

  const xrefAt = length;
  push("xref\n0 6\n0000000000 65535 f \n");
  for (let n = 1; n <= 5; n++) push(`${String(offsets[n]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`);

  const out = new Uint8Array(length);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return new Blob([out], { type: "application/pdf" });
}

export function CertificatesView() {
  const session = useSession();
  const user = getStoredUser();
  const email = user?.email ?? session?.email ?? "student";
  const studentName = (user?.name ?? session?.name ?? "Student").trim() || "Student";

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [summary, setSummary] = React.useState<ReturnType<typeof computeProgress> | null>(null);
  const [template, setTemplate] = React.useState<HTMLImageElement | null | undefined>(undefined);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [prog, chats] = await Promise.all([
          apiFetch<StudentProgressData>("/student/progress"),
          apiFetch<{ conversations: unknown[] }>("/ai/tutor/conversations").catch(() => ({
            conversations: [],
          })),
        ]);
        if (active) setSummary(computeProgress(prog, chats.conversations?.length ?? 0));
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Failed to load progress");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Look for an optional custom template image
  React.useEffect(() => {
    const img = new Image();
    img.onload = () => setTemplate(img);
    img.onerror = () => setTemplate(null);
    img.src = TEMPLATE_URL;
  }, []);

  // Keep the first issue date so the certificate does not change on every visit
  const cert: CertData = React.useMemo(() => {
    const key = `lucous_certificate_issued_${email}`;
    let issued = "";
    try {
      issued = window.localStorage.getItem(key) ?? "";
    } catch {
      /* ignore */
    }
    if (!issued) {
      issued = new Date().toISOString();
      try {
        if (summary?.complete) window.localStorage.setItem(key, issued);
      } catch {
        /* ignore */
      }
    }
    const d = new Date(issued);
    return {
      name: studentName,
      dateText: d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }),
      certId: `LUC-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}-${hashId(email + studentName)}`,
    };
  }, [email, studentName, summary?.complete]);

  const complete = Boolean(summary?.complete);

  React.useEffect(() => {
    if (!complete || template === undefined || !canvasRef.current) return;
    drawCertificate(canvasRef.current, cert, template);
  }, [complete, template, cert]);

  const fileBase = `Lucous-Certificate-${studentName.replace(/[^a-z0-9]+/gi, "-")}`;

  function downloadPng() {
    canvasRef.current?.toBlob((b) => b && downloadBlob(b, `${fileBase}.png`), "image/png");
  }

  function downloadPdf() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const base64 = canvas.toDataURL("image/jpeg", 0.92).split(",")[1] ?? "";
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    downloadBlob(buildPdf(bytes, canvas.width, canvas.height), `${fileBase}.pdf`);
  }

  return (
    <RequireStudent title="Certificate">
      <div className="grid gap-5">
        <section>
          <h1 className="font-heading text-2xl font-semibold">Certificate</h1>
          <p className="text-sm text-muted-foreground">
            Reach 100% learning progress to unlock your certificate.
          </p>
        </section>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Checking your progress…
          </p>
        ) : null}

        {summary && !complete ? (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Lock className="size-4 text-muted-foreground" aria-hidden />
                <CardTitle>Certificate locked</CardTitle>
              </div>
              <CardDescription>
                You are at {summary.percent}%. Keep learning to reach 100%.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={summary.percent}>
                <ProgressLabel>Learning progress</ProgressLabel>
                <ProgressValue />
              </Progress>
              <ul className="grid gap-2 text-sm">
                {summary.parts.map((p) => (
                  <li key={p.key} className="flex items-center justify-between gap-3">
                    <span>{p.label}</span>
                    <span className="text-muted-foreground">
                      {p.target > 0 ? `${Math.min(p.done, p.target)} / ${p.target}` : "—"}
                    </span>
                  </li>
                ))}
              </ul>
              <Link href="/student/learn" className={buttonVariants()}>
                Continue learning
              </Link>
            </CardContent>
          </Card>
        ) : null}

        {complete ? (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Award className="size-5 text-primary" aria-hidden />
                <CardTitle>Congratulations, {studentName}!</CardTitle>
              </div>
              <CardDescription>
                You completed 100% of your learning progress. Download your certificate below.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <canvas
                ref={canvasRef}
                className="h-auto w-full rounded-lg border shadow-sm"
                aria-label={`Certificate of completion for ${studentName}`}
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={downloadPdf} className="gap-1.5">
                  <FileText className="size-4" aria-hidden /> Download PDF
                </Button>
                <Button type="button" variant="outline" onClick={downloadPng} className="gap-1.5">
                  <Download className="size-4" aria-hidden /> Download image
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </RequireStudent>
  );
}
