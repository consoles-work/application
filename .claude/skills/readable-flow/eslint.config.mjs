// Пороги скилла readable-flow для TS/TSX. Проект этот файл не читает:
// ts-metrics.sh копирует его во временную папку рядом с eslint и плагинами.
import tseslint from "typescript-eslint";
import sonarjs from "eslint-plugin-sonarjs";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { sonarjs, "react-hooks": reactHooks },
    linterOptions: { reportUnusedDisableDirectives: "off" },
    rules: {
      // React: хуки только на верхнем уровне, зависимости эффектов полные
      "react-hooks/rules-of-hooks": "warn",
      "react-hooks/exhaustive-deps": "warn",

      // Пороговые
      "sonarjs/cognitive-complexity": ["warn", 10],
      "max-depth": ["warn", 2],
      "max-params": ["warn", 4],

      // Нулевые
      "no-else-return": "warn",
      "prefer-const": "warn",
      "no-nested-ternary": "warn",
      "sonarjs/no-collapsible-if": "warn",
      "sonarjs/prefer-single-boolean-return": "warn",
      "sonarjs/no-inverted-boolean-check": "warn",
      "sonarjs/no-identical-functions": "warn",
      "sonarjs/no-duplicated-branches": "warn",
      "sonarjs/no-redundant-jump": "warn",
      "sonarjs/prefer-immediate-return": "warn",
      "no-restricted-syntax": [
        "warn",
        {
          selector: "CallExpression[callee.property.name='catch'] > ArrowFunctionExpression > BlockStatement[body.length=0]",
          message: "Ошибка проглатывается молча: обработать, показать тостом или оставить комментарий, почему её можно игнорировать.",
        },
      ],
    },
  },
];
