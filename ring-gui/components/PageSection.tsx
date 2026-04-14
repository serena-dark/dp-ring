import {
  type ReactNode,
  useEffect,
  useRef,
} from "react";
import { useRouter } from "@ring-gui/lib/router";

export function PageSection({
  id,
  label,
  children,
  className,
}: {
  id: string;
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  const { hash } = useRouter();
  const ref = useRef<HTMLElement | null>(null);
  const isFocused = hash === id;

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    ref.current?.classList.add("is-highlighted");
    const timeoutId = window.setTimeout(() => {
      ref.current?.classList.remove("is-highlighted");
    }, 1800);

    window.requestAnimationFrame(() => {
      ref.current?.scrollIntoView({
        block: "start",
        behavior: "smooth",
      });
      ref.current?.focus({ preventScroll: true });
    });

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isFocused, id]);

  return (
    <section
      id={id}
      ref={ref}
      aria-label={label}
      tabIndex={-1}
      className={[
        "page-section",
        isFocused ? "is-focused" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </section>
  );
}
