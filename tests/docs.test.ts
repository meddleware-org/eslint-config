/**
 * Tests of the documentation fragment (`docsRules`): a function, method, class or type without a doc comment is reported, a documented one
 * is not, and the tag rules turn on only with `params: true`. Each case runs through ESLint's own `Linter` with the TypeScript parser.
 */
import { describe, it, expect } from 'vitest'
import { Linter } from 'eslint'
import tseslint from 'typescript-eslint'
import jsdoc from 'eslint-plugin-jsdoc'
import { docsRules } from '../src/index.js'

/**
 * Lint `code` as `src/a.ts` with the documentation rules on.
 * @param code - the source text
 * @param params - whether the tag rules are on
 * @returns the rule id of every message
 */
function lint(code: string, params = false): string[] {
  const linter = new Linter({ cwd: '/repo' })
  const config: Linter.Config[] = [
    { files: ['**/*.ts'], languageOptions: { parser: tseslint.parser as Linter.Parser } },
    ...(docsRules({ plugin: jsdoc as never, params }) as Linter.Config[]),
  ]
  return linter.verify(code, config, 'src/a.ts').map((m) => m.ruleId ?? 'parse')
}

describe('docsRules', () => {
  it('reports an undocumented function, method, class and interface', () => {
    expect(lint('export function f() {}')).toContain('jsdoc/require-jsdoc')
    expect(lint('/** C. */\nexport class C {\n  m() {}\n}')).toContain('jsdoc/require-jsdoc')
    expect(lint('export class D {}')).toContain('jsdoc/require-jsdoc')
    expect(lint('export interface I { a: string }')).toContain('jsdoc/require-jsdoc')
  })

  it('accepts documented declarations', () => {
    expect(lint('/** F. */\nexport function f() {}')).toEqual([])
    expect(lint('/** C. */\nexport class C {\n  /** M. */\n  m() {}\n}')).toEqual([])
    expect(lint('/** I. */\nexport interface I { a: string }')).toEqual([])
  })

  it('asks for parameter and return tags only with params: true', () => {
    const src = '/** F. */\nexport function f(a: number): number {\n  return a\n}'
    expect(lint(src)).toEqual([])
    expect(lint(src, true)).toEqual(expect.arrayContaining(['jsdoc/require-param', 'jsdoc/require-returns']))
  })

  it('refuses to run without the plugin', () => {
    expect(() => docsRules({} as never)).toThrow(/eslint-plugin-jsdoc/)
  })
})
