export interface UnderlineTab<T extends string> {
  id: T;
  label: string;
  /** Точка рядом с подписью — на вкладке есть заполненные поля */
  marked?: boolean;
}

/**
 * Вкладки во всю ширину: серая базовая линия и полоска акцентного цвета,
 * которая переезжает под активную вкладку.
 */
export function UnderlineTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: UnderlineTab<T>[];
  active: T;
  onChange: (id: T) => void;
}) {
  const index = Math.max(0, tabs.findIndex((tab) => tab.id === active));
  const width = 100 / tabs.length;

  return (
    <div className="relative flex border-b border-border" role="tablist">
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`flex-1 min-w-0 px-1 pt-1 pb-2 text-xs truncate transition-colors ${
              isActive ? "text-text-primary font-medium" : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {tab.label}
            {tab.marked && <span className="inline-block w-1 h-1 rounded-full bg-accent ml-1 align-middle" />}
          </button>
        );
      })}
      <span
        className="absolute -bottom-px h-0.5 rounded-full bg-accent transition-[left] duration-300 ease-out"
        style={{ left: `${index * width}%`, width: `${width}%` }}
      />
    </div>
  );
}
