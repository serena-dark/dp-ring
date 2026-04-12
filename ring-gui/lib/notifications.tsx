/* eslint-disable react-refresh/only-export-components */

import {
  type ReactNode,
  createContext,
  useContext,
  useState,
} from "react";

type NoticeTone = "info" | "success" | "error";

interface Notice {
  id: number;
  tone: NoticeTone;
  message: string;
}

interface NotificationsValue {
  notify: (message: string, tone?: NoticeTone) => void;
  dismiss: (id: number) => void;
}

const NotificationsContext = createContext<NotificationsValue | null>(null);

let nextNoticeId = 1;

export function NotificationsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [items, setItems] = useState<Notice[]>([]);

  const dismiss = (id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  };

  const notify = (message: string, tone: NoticeTone = "info") => {
    const id = nextNoticeId++;
    setItems((current) => [...current, { id, tone, message }]);
    window.setTimeout(() => {
      dismiss(id);
    }, 4200);
  };

  return (
    <NotificationsContext.Provider value={{ notify, dismiss }}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="true">
        {items.map((item) => (
          <div key={item.id} className={`toast toast-${item.tone}`}>
            <p>{item.message}</p>
            <button type="button" className="icon-button" onClick={() => dismiss(item.id)}>
              x
            </button>
          </div>
        ))}
      </div>
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsValue {
  const value = useContext(NotificationsContext);
  if (!value) {
    throw new Error(
      "useNotifications must be used inside NotificationsProvider.",
    );
  }
  return value;
}
