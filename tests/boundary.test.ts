import { describe, it, expect } from 'vitest'
import { Linter } from 'eslint'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'
import { suiBoundary } from '../src/index.js'

const CWD = '/repo'
const base: Linter.Config[] = [
  {
    files: ['**/*.ts'],
    languageOptions: { parser: tseslint.parser as Linter.Parser },
    plugins: { '@typescript-eslint': tseslint.plugin as never },
  },
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: { parser: tseslint.parser, sourceType: 'module' },
    },
    plugins: { vue: pluginVue as never, '@typescript-eslint': tseslint.plugin as never },
  },
]

function lint(code: string, file: string, extra: Parameters<typeof suiBoundary>[0] = {}): string[] {
  const linter = new Linter({ cwd: CWD })
  const messages = linter.verify(code, [...base, ...suiBoundary(extra)], { filename: `${CWD}/${file}` })
  const fatal = messages.filter((m) => m.fatal)
  if (fatal.length) throw new Error(fatal.map((m) => m.message).join('; '))
  return messages.map((m) => m.ruleId ?? 'parse')
}

describe('imports', () => {
  it('allows type-only imports of the restricted paths', () => {
    expect(lint(`import type { Transaction } from '@mysten/sui/transactions'\nexport type T = Transaction`, 'src/a.ts')).toEqual([])
    expect(lint(`import { type SuiGrpcClient } from '@mysten/sui/grpc'\nexport type C = SuiGrpcClient`, 'src/a.ts')).toEqual([])
  })

  it('refuses runtime and mixed imports', () => {
    expect(lint(`import { Transaction } from '@mysten/sui/transactions'\nexport const t = Transaction`, 'src/a.ts')).toContain('@typescript-eslint/no-restricted-imports')
    expect(lint(`import { SuiGrpcClient, type ClientWithCoreApi } from '@mysten/sui/grpc'\nexport const c = SuiGrpcClient`, 'src/a.ts')).toContain('@typescript-eslint/no-restricted-imports')
  })

  it('refuses JSON-RPC even as a type import', () => {
    expect(lint(`import type { SuiJsonRpcClient } from '@mysten/sui/jsonRpc'\nexport type J = SuiJsonRpcClient`, 'src/a.ts')).toContain('@typescript-eslint/no-restricted-imports')
  })

  it('refuses dynamic imports of the restricted paths', () => {
    expect(lint(`export const m = () => import('@mysten/sui/grpc')`, 'src/a.ts')).toContain('no-restricted-syntax')
  })
})

describe('chain calls', () => {
  it('refuses building transactions and reading objects in app code', () => {
    expect(lint(`declare const Transaction: any\nexport const t = new Transaction()`, 'src/a.ts')).toContain('no-restricted-syntax')
    for (const call of ['tx.moveCall({})', 'tx.splitCoins(a, b)', 'tx.transferObjects([], a)', 'client.core.getObject({})', 'client?.listOwnedObjects({})', 'c.listEvents({})']) {
      expect(lint(`declare const tx: any, client: any, c: any, a: any, b: any\nexport const r = ${call}`, 'src/a.ts')).toContain('no-restricted-syntax')
    }
  })

  it('leaves domain-client calls and unrelated code alone', () => {
    expect(lint(`declare const client: any\nexport const r = client.fetchGate('0x1')\nexport const d = new Date()`, 'src/a.ts')).toEqual([])
  })

  it('exempts the wallet shim, tests and files outside src', () => {
    const code = `declare const Transaction: any\nexport const t = new Transaction()`
    expect(lint(code, 'src/wallet.ts')).toEqual([])
    expect(lint(code, 'src/a.test.ts')).toEqual([])
    expect(lint(code, 'scripts/e2e.ts')).toEqual([])
  })

  it('applies inside Vue single-file components', () => {
    const sfc = `<script setup lang="ts">\ndeclare const tx: any\ntx.moveCall({})\n</script>\n<template><p>x</p></template>`
    expect(lint(sfc, 'src/components/A.vue')).toContain('no-restricted-syntax')
  })
})

describe('template URL bindings', () => {
  const sfc = (tpl: string) => `<script setup lang="ts">\ndeclare const url: string\ndeclare function safeHref(u: string): string | undefined\ndeclare function toUrl(u: string): string\n</script>\n<template>${tpl}</template>`

  it('refuses an unsanitised binding on a native element', () => {
    for (const tpl of ['<a :href="url">x</a>', '<img :src="url">', '<img v-bind:src="url">', '<form :action="url"></form>', '<img :src="toUrl(url)">']) {
      expect(lint(sfc(tpl), 'src/A.vue')).toContain('vue/no-restricted-syntax')
    }
  })

  it('accepts helper-wrapped bindings, literals and static template strings', () => {
    for (const tpl of ['<a :href="safeHref(url)">x</a>', `<a :href="'/docs'">x</a>`, '<a :href="`/docs`">x</a>', '<a href="/static">x</a>']) {
      expect(lint(sfc(tpl), 'src/A.vue')).toEqual([])
    }
  })

  it('leaves component props and non-URL attributes alone', () => {
    expect(lint(sfc('<ExplorerLink :href="url" /><my-link :href="url" /><p :title="url">x</p>'), 'src/A.vue')).toEqual([])
  })

  it('accepts a repo-specific helper', () => {
    expect(lint(sfc('<img :src="toUrl(url)">'), 'src/A.vue', { urlHelpers: ['toUrl'] })).toEqual([])
  })
})
