import { useState, useMemo } from "react";
import { ChevronDown } from "lucide-react";

export interface SuggestOption {
  value: string;
  /** Сколько раз значение уже используется — показывается справа */
  count?: number;
}

/**
 * Поле ввода с подсказками: можно вписать своё значение или выбрать из списка.
 * Список фильтруется по набранному; стрелки — выбор, Enter — подставить, Escape — закрыть.
 */
export function SuggestInput({
  value,
  onChange,
  options,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  options: SuggestOption[];
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  // Пока пользователь не начал печатать после открытия — показываем весь список,
  // иначе при уже заполненном поле видно было бы только его же значение
  const [showAll, setShowAll] = useState(false);
  const [highlight, setHighlight] = useState(-1);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (showAll || !q) return options;
    return options.filter((o) => o.value.toLowerCase().includes(q));
  }, [options, value, showAll]);

  const openList = (all: boolean) => {
    setShowAll(all);
    setHighlight(-1);
    setOpen(true);
  };

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) { openList(true); return; }
      if (filtered.length === 0) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      setHighlight((h) => (h + step + filtered.length) % filtered.length);
    } else if (e.key === "Enter" && open && highlight >= 0 && filtered[highlight]) {
      e.preventDefault(); // не отправлять форму — только подставить значение
      pick(filtered[highlight].value);
    } else if (e.key === "Escape" && open) {
      e.stopPropagation(); // закрыть список, а не весь диалог
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowAll(false);
          setHighlight(-1);
          setOpen(true);
        }}
        onFocus={() => openList(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`${className} ${options.length > 0 ? "pr-8" : ""}`}
      />
      {options.length > 0 && (
        <button
          type="button"
          tabIndex={-1}
          // mousedown, а не click: иначе input успеет потерять фокус и закрыть список
          onMouseDown={(e) => {
            e.preventDefault();
            if (open) setOpen(false);
            else {
              (e.currentTarget.previousElementSibling as HTMLInputElement | null)?.focus();
              openList(true);
            }
          }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-primary"
        >
          <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      )}
      {open && filtered.length > 0 && (
        <div className="absolute z-10 left-0 right-0 mt-1 max-h-44 overflow-y-auto rounded-lg border border-border bg-surface-1 shadow-xl py-1">
          {filtered.map((o, i) => (
            <div
              key={o.value}
              onMouseDown={(e) => { e.preventDefault(); pick(o.value); }}
              onMouseEnter={() => setHighlight(i)}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer ${
                i === highlight ? "bg-accent/15 text-text-primary" : "text-text-secondary"
              }`}
            >
              <span className="truncate flex-1">{o.value}</span>
              {o.value === value && <span className="text-accent">✓</span>}
              {o.count !== undefined && <span className="text-2xs text-text-muted">{o.count}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
