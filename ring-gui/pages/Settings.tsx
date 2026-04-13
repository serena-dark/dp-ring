import { type FormEvent, useEffect, useState } from "react";
import { useTheme, type ThemeMode } from "@ring-gui/lib/theme";

const OPTIONS: Array<{
  value: ThemeMode;
  label: string;
  description: string;
}> = [
  {
    value: "system",
    label: "System",
    description: "Follow OS preference",
  },
  {
    value: "light",
    label: "Light",
    description: "Neutral light console",
  },
  {
    value: "dark",
    label: "Dark",
    description: "Low-glare dark console",
  },
];

export default function Settings() {
  const {
    error,
    isLoading,
    isSaving,
    layout,
    resolvedTheme,
    setTemplate,
    setTheme,
    templateId,
    templates,
    theme,
    updateLayout,
  } = useTheme();
  const [layoutDraft, setLayoutDraft] = useState(layout);

  useEffect(() => {
    setLayoutDraft(layout);
  }, [layout]);

  async function handleLayoutSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await updateLayout(layoutDraft);
  }

  return (
    <div className="page">
      <section className="panel">
        <div className="panel-header">
          <h3>Theme Mode</h3>
        </div>

        <div className="theme-option-grid">
          {OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`theme-option${theme === option.value ? " is-selected" : ""}`}
              onClick={() => void setTheme(option.value)}
              disabled={isLoading}
            >
              <div className="theme-option-head">
                <strong>{option.label}</strong>
                <span className="theme-option-value">
                  {option.value === "system" ? resolvedTheme : option.value}
                </span>
              </div>
              <p className="subtle">{option.description}</p>
            </button>
          ))}
        </div>

        {error ? <p className="subtle">{error}</p> : null}
      </section>

      <section className="panel">
        <div className="panel-header">
          <h3>Template</h3>
        </div>

        <div className="theme-option-grid">
          {templates.map((template) => (
            <button
              key={template.id}
              type="button"
              className={`theme-option${templateId === template.id ? " is-selected" : ""}`}
              onClick={() => void setTemplate(template.id)}
              disabled={isLoading}
            >
              <div className="theme-option-head">
                <strong>{template.label}</strong>
                <span className="theme-option-value">{template.id}</span>
              </div>
              <p className="subtle">{template.description}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h3>Shell</h3>
        </div>

        <form className="field-grid" onSubmit={handleLayoutSubmit}>
          <div className="field">
            <label htmlFor="sidebar-width">Sidebar Width</label>
            <input
              id="sidebar-width"
              type="number"
              min={200}
              max={360}
              value={layoutDraft.sidebar_width_px}
              onChange={(event) =>
                setLayoutDraft((current) => ({
                  ...current,
                  sidebar_width_px: Number(event.target.value),
                }))
              }
            />
          </div>

          <div className="field">
            <label htmlFor="content-padding">Content Padding</label>
            <input
              id="content-padding"
              type="number"
              min={12}
              max={48}
              value={layoutDraft.content_padding_px}
              onChange={(event) =>
                setLayoutDraft((current) => ({
                  ...current,
                  content_padding_px: Number(event.target.value),
                }))
              }
            />
          </div>

          <div className="field">
            <label htmlFor="panel-radius">Panel Radius</label>
            <input
              id="panel-radius"
              type="number"
              min={8}
              max={28}
              value={layoutDraft.panel_radius_px}
              onChange={(event) =>
                setLayoutDraft((current) => ({
                  ...current,
                  panel_radius_px: Number(event.target.value),
                }))
              }
            />
          </div>

          <div className="field">
            <label htmlFor="theme-status">Status</label>
            <input
              id="theme-status"
              type="text"
              value={isSaving ? "Saving" : isLoading ? "Loading" : "Ready"}
              disabled
            />
          </div>

          <div className="button-row">
            <button type="submit" className="button" disabled={isSaving}>
              Save
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
