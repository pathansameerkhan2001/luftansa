"use client";

import { Mail, MessageCircle } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { CONTACT, whatsappHref } from "@/data/store";
import { composeContactMessage } from "@/lib/storefront/contact-message";

const TOPICS = ["An order", "A fragrance recommendation", "A gift", "Something else"] as const;
const FIELD =
  "mt-1.5 w-full rounded-xl border border-brand-gold/45 bg-white px-4 text-[15px] text-brand-black placeholder:text-brand-text/45 focus:border-brand-gold focus:shadow-[0_0_0_3px_rgba(198,167,106,0.2)] focus:outline-none";

/**
 * "Send us a message": composes a message and opens it in WhatsApp (or the
 * visitor's email app). Nothing is sent to or stored by this website.
 */
export function ContactComposer() {
  const id = useId();
  const [name, setName] = useState("");
  const [topic, setTopic] = useState<string>(TOPICS[0]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const text = composeContactMessage(name, topic, message);
  const valid = message.trim().length > 0;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) {
      setError("Please write your message.");
      document.getElementById(`${id}-message`)?.focus();
      return;
    }
    window.open(whatsappHref(text), "_blank", "noopener,noreferrer");
  };

  const mailto = `mailto:${CONTACT.email}?subject=${encodeURIComponent(`Question about ${topic.toLowerCase()}`)}&body=${encodeURIComponent(text)}`;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5" aria-describedby={`${id}-note`}>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-name`} className="text-[13.5px] font-semibold text-brand-black">
            Your name <span className="font-normal text-brand-text/55">(optional)</span>
          </label>
          <input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" className={`${FIELD} h-12`} />
        </div>
        <div>
          <label htmlFor={`${id}-topic`} className="text-[13.5px] font-semibold text-brand-black">
            Your question is about
          </label>
          <select id={`${id}-topic`} value={topic} onChange={(e) => setTopic(e.target.value)} className={`${FIELD} h-12 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23292d27%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:14px] bg-[right_1rem_center] bg-no-repeat pr-10`}>
            {TOPICS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor={`${id}-message`} className="text-[13.5px] font-semibold text-brand-black">
          Message
        </label>
        <textarea
          id={`${id}-message`}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            if (error) setError(null);
          }}
          rows={5}
          maxLength={1000}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          placeholder="For example: which fragrance would suit a gift for my father?"
          className={`${FIELD} resize-y py-3 leading-relaxed ${error ? "border-[#b8574a]" : ""}`}
        />
        {error ? (
          <p id={`${id}-error`} role="alert" className="mt-1.5 text-[13px] text-[#9a3b2b]">
            {error}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="submit"
          className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-full bg-brand-black px-6 text-[15px] font-semibold text-white transition-colors hover:bg-brand-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
        >
          <MessageCircle aria-hidden="true" className="size-5" strokeWidth={1.5} />
          Send on WhatsApp<span className="sr-only"> (opens in a new tab)</span>
        </button>
        <a
          href={mailto}
          className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-full border border-brand-black px-6 text-[15px] font-semibold text-brand-black transition-colors hover:bg-brand-black hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
        >
          <Mail aria-hidden="true" className="size-5" strokeWidth={1.5} />
          Send by email
        </a>
      </div>
      <p id={`${id}-note`} className="text-[12.5px] leading-relaxed text-brand-text/60">
        Your message opens in WhatsApp or your email app, ready to send to our team. Nothing is sent or stored by this website.
      </p>
    </form>
  );
}
