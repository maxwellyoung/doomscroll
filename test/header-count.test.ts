import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { URL } from 'node:url';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Exercise the actual header without loading native bindings in Node.
// The animation mock completes springs immediately so its target is observable.
test('header reports unique seen cards and animates that same count', () => {
  const require = createRequire(import.meta.url);
  const source = readFileSync(new URL('../components/Header.tsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exported: { Header?: (props: { seen: number; total: number }) => unknown } = {};
  let target = -1;
  runInNewContext(compiled, {
    exports: exported,
    require: (name: string) => {
      if (name === 'react-native') return { View: 'View', Text: 'Text', StyleSheet: { create: (styles: unknown) => styles } };
      if (name === 'react') return { useEffect: (effect: () => void) => effect() };
      if (name === 'react-native-reanimated') return {
        default: { View: 'AnimatedView' },
        useSharedValue: (value: number) => ({ value }),
        withSpring: (value: number) => { target = value; return value; },
        useAnimatedStyle: (style: () => unknown) => style(),
      };
      if (name === '@/lib/design') return { color: {}, space: {}, spring: { gentle: {} } };
      return require(name);
    },
  });
  function text(node: unknown): string {
    if (node == null) return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(text).join('');
    return text((node as { props?: { children?: unknown } }).props?.children);
  }
  assert.ok(exported.Header);
  for (const [seen, total, fraction] of [[0, 10, 0], [1, 10, 0.1], [10, 10, 1], [0, 0, 0]]) {
    const rendered = text(exported.Header({ seen, total }));
    assert.equal(rendered, `doomscroll${seen}/${total} seen`);
    assert.equal(target, fraction);
  }
});
