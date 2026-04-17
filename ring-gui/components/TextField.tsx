import {
  type CSSProperties,
  type KeyboardEventHandler,
  useEffect,
  useId,
  useRef,
} from "react";

interface TextFieldProps {
  id?: string;
  label?: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  multiline?: boolean;
  rows?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  autoResize?: boolean;
  ariaLabel?: string;
  containerClassName?: string;
  controlClassName?: string;
  containerStyle?: CSSProperties;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement | HTMLTextAreaElement>;
}

export function TextField({
  id,
  label,
  value,
  onValueChange,
  placeholder,
  type = "text",
  multiline = false,
  rows = 3,
  disabled = false,
  autoFocus = false,
  autoResize = false,
  ariaLabel,
  containerClassName,
  controlClassName,
  containerStyle,
  onKeyDown,
}: TextFieldProps) {
  const generatedId = useId().replace(/:/g, "-");
  const controlId = id ?? `text-field-${generatedId}`;
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!multiline || !autoResize) {
      return;
    }

    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 208)}px`;
  }, [autoResize, multiline, value]);

  const fieldClassName = containerClassName
    ? `field ${containerClassName}`
    : "field";

  if (multiline) {
    return (
      <div className={fieldClassName} style={containerStyle}>
        {label ? <label htmlFor={controlId}>{label}</label> : null}
        <textarea
          ref={textareaRef}
          id={controlId}
          rows={rows}
          value={value}
          disabled={disabled}
          autoFocus={autoFocus}
          placeholder={placeholder}
          className={controlClassName}
          aria-label={label ? undefined : ariaLabel}
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={onKeyDown}
        />
      </div>
    );
  }

  return (
    <div className={fieldClassName} style={containerStyle}>
      {label ? <label htmlFor={controlId}>{label}</label> : null}
      <input
        id={controlId}
        type={type}
        value={value}
        disabled={disabled}
        autoFocus={autoFocus}
        placeholder={placeholder}
        className={controlClassName}
        aria-label={label ? undefined : ariaLabel}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}
