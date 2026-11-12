import { Search } from "lucide-react";
import { UTILITY_LINKS } from "./nav-config";

interface SearchFormProps {
  /** Unique id so desktop + mobile instances never share an input id. */
  id: string;
  className?: string;
  autoFocus?: boolean;
}

/**
 * Compact underline search field. Plain GET form → `/search?q=…`, so it works
 * without client JavaScript. Reused by the desktop header and the mobile panel.
 */
export function SearchForm({ id, className = "", autoFocus }: SearchFormProps) {
  return (
    <form role="search" action={UTILITY_LINKS.search.href} method="get" className={className}>
      <div className="flex h-8 items-center gap-2 border-b border-brand-black transition-shadow focus-within:shadow-[inset_0_-1px_0_var(--brand-black)]">
        <button
          type="submit"
          aria-label="Submit search"
          className="inline-flex shrink-0 items-center text-brand-black transition-colors hover:text-brand-gold focus-visible:text-brand-gold focus-visible:outline-none"
        >
          <Search aria-hidden="true" className="size-[15px]" strokeWidth={1.5} />
        </button>
        <label htmlFor={id} className="sr-only">
          Search for products
        </label>
        <input
          id={id}
          type="search"
          name="q"
          autoComplete="off"
          enterKeyHint="search"
          autoFocus={autoFocus}
          placeholder="Search for products"
          className="w-full min-w-0 bg-transparent text-[13px] tracking-[0.02em] text-brand-black placeholder:text-brand-text/55 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
      </div>
    </form>
  );
}
