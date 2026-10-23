/** Подпись кнопки сохранения: создание или правка, ждём ли ответа */
export function submitLabelKey(isEdit: boolean, loading: boolean): string {
  if (isEdit) return loading ? "common.saving" : "common.save";

  return loading ? "common.creating" : "common.create";
}
