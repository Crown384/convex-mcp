import { AuthFailure, ownerEmail } from "./settings";
export async function sendSignInCode(email: string, otp: string): Promise<void> {
  const key = process.env.MAILJET_API_KEY;
  const secret = process.env.MAILJET_SECRET_KEY;
  const sender = process.env.MAILJET_FROM_EMAIL;
  if (!ownerEmail(email) || !/^\d{6}$/.test(otp)) throw new AuthFailure("UNAUTHORIZED");
  if (!key || !secret || !sender || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sender))
    throw new AuthFailure("MAIL_NOT_CONFIGURED");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch("https://api.mailjet.com/v3.1/send", {
      method: "POST", redirect: "error", signal: controller.signal,
      headers: { Authorization: "Basic " + btoa(key + ":" + secret), "Content-Type": "application/json" },
      body: JSON.stringify({ Messages: [{
        From: { Email: sender, Name: "Pama Convex MCP" }, To: [{ Email: email }],
        Subject: "Your sign-in code",
        TextPart: "Your Pama Convex MCP sign-in code is " + otp + ". It expires in 5 minutes. If you did not request it, ignore this email.",
        HTMLPart: "<p>Your Pama Convex MCP sign-in code is:</p><p><strong>" + otp + "</strong></p><p>It expires in 5 minutes. If you did not request it, ignore this email.</p>",
      }] }),
    });
    if (!response.ok) throw new Error("delivery");
    const data = await response.json() as { Messages?: { Status?: string }[] };
    if (data.Messages?.length !== 1 || data.Messages[0].Status !== "success") throw new Error("delivery");
  } catch { throw new AuthFailure("MAIL_DELIVERY_FAILED"); }
  finally { clearTimeout(timer); }
}
