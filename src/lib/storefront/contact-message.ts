/** The message the Contact page sends to Luftansa on WhatsApp or by email (pure). */
export function composeContactMessage(name: string, topic: string, message: string): string {
  return [`Hello Luftansa,${name.trim() ? ` this is ${name.trim()}.` : ""}`, `I have a question about: ${topic}.`, "", message.trim()].join("\n").trim();
}
