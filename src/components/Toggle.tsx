/** Переключатель вкл./выкл. — строки настроек */
export function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`relative w-10 h-5 rounded-full transition-colors ${on ? "bg-accent" : "bg-surface-3"}`}>
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
          on ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}
