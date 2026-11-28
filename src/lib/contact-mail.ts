import "server-only";

import { spawn } from "node:child_process";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cloudflareBindingsEnabled } from "@/lib/runtime";

const TO = "hyunheefulghum@gmail.com";
const FROM = "inquiries@notify.h-nyc.com";

export type InquiryMail = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  listingLabel: string;
  message: string;
};

function singleLine(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function mailBodies(inquiry: InquiryMail) {
  const name = singleLine(`${inquiry.firstName} ${inquiry.lastName}`);
  const listing = inquiry.listingLabel || "General inquiry";
  const subject = singleLine(`Inquiry from ${name}`).slice(0, 140);
  const text = [
    `Name: ${name}`,
    `Email: ${inquiry.email}`,
    `Phone: ${inquiry.phone}`,
    `Listing: ${listing}`,
    "",
    inquiry.message,
  ].join("\n");
  const html = `
    <p><strong>${escapeHtml(name)}</strong> sent a message from the Aitch NYC contact form.</p>
    <p>Email: <a href="mailto:${escapeHtml(inquiry.email)}">${escapeHtml(inquiry.email)}</a><br>
    Phone: ${escapeHtml(inquiry.phone)}<br>
    Listing: ${escapeHtml(listing)}</p>
    <p>${escapeHtml(inquiry.message).replace(/\n/g, "<br>")}</p>
  `.trim();
  return { name, subject, text, html };
}

function sendWithWrangler(inquiry: InquiryMail, subject: string, text: string, html: string, name: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(
      "npx",
      [
        "wrangler",
        "email",
        "sending",
        "send",
        "--from",
        FROM,
        "--from-name",
        "Aitch NYC",
        "--to",
        TO,
        "--reply-to",
        inquiry.email,
        "--reply-to-name",
        name,
        "--subject",
        subject,
        "--text",
        text,
        "--html",
        html,
      ],
      { cwd: process.cwd() },
    );
    let output = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("Email send timed out."));
    }, 45000);
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(output.trim() || `Email send failed (${code ?? "unknown"}).`));
    });
  });
}

export async function sendInquiryEmail(inquiry: InquiryMail) {
  const { name, subject, text, html } = mailBodies(inquiry);
  if (cloudflareBindingsEnabled()) {
    const { env } = await getCloudflareContext({ async: true });
    if (!env.EMAIL) throw new Error("The EMAIL binding is missing.");
    await env.EMAIL.send({
      from: { email: FROM, name: "Aitch NYC" },
      to: TO,
      replyTo: { email: inquiry.email, name },
      subject,
      text,
      html,
    });
    return;
  }
  await sendWithWrangler(inquiry, subject, text, html, name);
}
