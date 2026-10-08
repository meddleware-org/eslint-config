import { describe, it, expect } from 'vitest'
import { Linter } from 'eslint'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'
import { splitGlobs, suiBoundary, vueGlobs } from '../src/index.js'

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

  it('exempts tests and files outside src', () => {
    const code = `declare const Transaction: any\nexport const t = new Transaction()`
    expect(lint(code, 'src/a.test.ts')).toEqual([])
    expect(lint(code, 'src/__tests__/a.ts')).toEqual([])
    expect(lint(code, 'scripts/e2e.ts')).toEqual([])
  })

  it('lets the wallet shim import the client but still refuses commands, reads and transactions', () => {
    const wallet = (code: string) => lint(code, 'src/wallet.ts')
    expect(wallet(`import { SuiGrpcClient } from '@mysten/sui/grpc'\nexport const c = SuiGrpcClient`)).toEqual([])
    expect(wallet(`declare const Transaction: any\nexport const t = new Transaction()`)).toContain('no-restricted-syntax')
    expect(wallet(`declare const tx: any\ntx.moveCall({})`)).toContain('no-restricted-syntax')
    expect(wallet(`declare const c: any\nexport const r = c.core.getObject({})`)).toContain('no-restricted-syntax')
    expect(wallet(`import type { J } from '@mysten/sui/jsonRpc'\nexport type X = J`)).toContain('@typescript-eslint/no-restricted-imports')
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

describe('script boundary: variants a name-only selector would miss', () => {
  const refused = (code: string, file = 'src/a.ts') => expect(lint(`declare const tx: any, client: any, Transaction: any, bytes: any\n${code}`, file), code).toContain('no-restricted-syntax')
  const allowed = (code: string, file = 'src/a.ts') => expect(lint(`declare const tx: any, client: any, bus: any\n${code}`, file), code).toEqual([])

  it('refuses a command by any reference, not only a call', () => {
    refused('export const { moveCall } = tx')
    refused('export const f = tx.moveCall.bind(tx)')
    refused("export const r = tx['moveCall']({})")
    refused('export const f = tx.makeMoveVec')
  })

  it('refuses static members of Transaction and computed access to the read methods', () => {
    refused('export const t = Transaction.from(bytes)')
    refused("export const r = client['getObject']({})")
  })

  it('refuses the reads and execution the first version missed', () => {
    for (const call of ['listCoins', 'listDynamicFields', 'getDynamicField', 'getTransaction', 'simulateTransaction', 'executeTransaction']) {
      refused(`export const r = client.core.${call}({})`)
    }
  })

  it('allows the typed balance and epoch reads, and unrelated calls that share a generic name', () => {
    allowed('export const a = client.core.getBalance({ owner: "0x1" })')
    allowed('export const b = client.core.listBalances({ owner: "0x1" })')
    allowed('export const e = client.getCurrentSystemState()')
    allowed("export const p = bus.send('x')")
  })

  it('refuses dynamic imports built from a template literal or a concatenation', () => {
    refused('export const m = () => import(`@mysten/sui/grpc`)')
    refused("export const m = () => import('@mysten/sui/' + 'grpc')")
    refused("export const m = () => import('@mysten/sui/graphql')")
  })

  it('refuses require() of the restricted paths and allows the utility subpaths', () => {
    refused("declare function require(s: string): any\nexport const r = require('@mysten/sui/grpc')")
    allowed("declare function require(s: string): any\nexport const r = require('@mysten/sui/utils')")
    expect(lint(`export const m = () => import('@mysten/sui/utils')`, 'src/a.ts')).toEqual([])
  })

  it('refuses the entry points the first version did not list', () => {
    for (const path of ['@mysten/sui/graphql', '@mysten/sui/faucet', '@mysten/sui/cryptography']) {
      expect(lint(`import { X } from '${path}'\nexport const x = X`, 'src/a.ts'), path).toContain('@typescript-eslint/no-restricted-imports')
    }
    expect(lint(`import type { X } from '@mysten/sui/graphql'\nexport type Y = X`, 'src/a.ts')).toEqual([])
  })

  it('allows the utility subpaths at runtime', () => {
    expect(lint(`import { normalizeSuiAddress } from '@mysten/sui/utils'\nimport { bcs } from '@mysten/sui/bcs'\nexport const x = [normalizeSuiAddress, bcs]`, 'src/a.ts')).toEqual([])
  })

  it('covers plain JavaScript files with the core import rule, without needing the TypeScript plugin', () => {
    for (const file of ['src/a.js', 'src/a.mjs', 'src/a.cjs']) {
      expect(lint('tx.moveCall({})', file), file).toContain('no-restricted-syntax')
    }
    expect(lint(`import { SuiGrpcClient } from '@mysten/sui/grpc'\nexport const c = SuiGrpcClient`, 'src/a.js')).toContain('no-restricted-imports')
    expect(lint(`import { normalizeSuiAddress } from '@mysten/sui/utils'\nexport const n = normalizeSuiAddress`, 'src/a.js')).toEqual([])
  })

  it('splits globs by extension', () => {
    expect(splitGlobs(['src/**/*.{ts,mts,js,vue}', 'lib/**/*.js', 'x/*.ts'])).toEqual({
      ts: ['src/**/*.{ts,mts,vue}', 'x/*.ts'],
      js: ['src/**/*.js', 'lib/**/*.js'],
    })
  })
})

describe('options', () => {
  it('keeps the consumer\'s own restrictions in force through the extra* options', () => {
    const code = `declare const o: object\nfor (const k in o) { void k }\nimport lodash from 'lodash'\nexport const l = lodash`
    const without = lint(code, 'src/a.ts')
    expect(without).not.toContain('no-restricted-syntax') // the boundary REPLACES the consumer's own rule options
    const withExtra = lint(code, 'src/a.ts', {
      extraSyntax: [{ selector: 'ForInStatement', message: 'no for-in' }],
      extraImportPaths: [{ name: 'lodash', message: 'no lodash' }],
    })
    expect(withExtra).toContain('no-restricted-syntax')
    expect(withExtra).toContain('@typescript-eslint/no-restricted-imports')
  })

  it('does not crash on TS-only files and puts no template rule where there are no .vue globs', () => {
    expect(lint('tx.moveCall({})', 'src/a.ts', { files: ['src/**/*.ts'] })).toContain('no-restricted-syntax')
  })

  it('applies the template rule where the consumer put its components, not only under src', () => {
    const sfc = '<script setup lang="ts">\ndeclare const url: string\n</script>\n<template><a :href="url">x</a></template>'
    const opts = { files: ['app/**/*.{ts,vue}'] }
    expect(lint(sfc, 'app/A.vue', opts)).toContain('vue/no-restricted-syntax')
    expect(lint(sfc, 'src/A.vue', opts)).toEqual([])
  })

  it('derives the .vue globs from the script globs', () => {
    expect(vueGlobs(['src/**/*.{ts,vue}', 'lib/**/*.ts', 'x/**/*.vue'])).toEqual(['src/**/*.vue', 'x/**/*.vue'])
    expect(vueGlobs(['src/**/*.ts'])).toEqual([])
  })

  it('merges the consumer\'s template restrictions', () => {
    const sfc = '<script setup lang="ts">\n</script>\n<template><blink>x</blink></template>'
    expect(lint(sfc, 'src/A.vue', { extraTemplateSyntax: [{ selector: 'VElement[rawName=blink]', message: 'no blink' }] })).toContain('vue/no-restricted-syntax')
  })
})

describe('template sinks the first version missed', () => {
  const sfc = (tpl: string) => `<script setup lang="ts">\ndeclare const url: string, attr: string, flag: boolean, obj: Record<string, string>\ndeclare function safeHref(u: string): string | undefined\n</script>\n<template>${tpl}</template>`
  const refused = (tpl: string) => expect(lint(sfc(tpl), 'src/A.vue'), tpl).toContain('vue/no-restricted-syntax')
  const allowed = (tpl: string) => expect(lint(sfc(tpl), 'src/A.vue'), tpl).toEqual([])

  it('refuses the extra URL attributes, srcdoc, meta content and v-html', () => {
    refused('<svg><use :xlink:href="url" /></svg>')
    refused('<a :ping="url">x</a>')
    refused('<link :imagesrcset="url">')
    refused('<iframe :srcdoc="url"></iframe>')
    refused('<meta http-equiv="refresh" :content="url">')
    expect(lint(sfc('<p v-html="url"></p>'), 'src/A.vue')).toContain('vue/no-v-html')
  })

  it('refuses argument-less v-bind and dynamic attribute names on native elements', () => {
    refused('<a v-bind="{ href: url }">x</a>')
    refused('<a v-bind="obj">x</a>')
    refused('<a :[attr]="url">x</a>')
  })

  it('refuses an upper-case native tag, which the DOM builds as the native element', () => {
    refused('<IMG :src="url">')
    refused('<A :href="url">x</A>')
  })

  it('refuses url() built in a bound style', () => {
    refused('<div :style="{ backgroundImage: `url(${url})` }"></div>')
    refused(`<div :style="{ backgroundImage: 'url(https://x.example/p.png)' }"></div>`)
  })

  it('accepts a ternary whose branches are both safe, and refuses one with an unsafe branch', () => {
    allowed('<a :href="flag ? safeHref(url) : undefined">x</a>')
    allowed(`<a :href="flag ? '/a' : safeHref(url)">x</a>`)
    refused('<a :href="flag ? url : undefined">x</a>')
    refused('<a :href="flag ? safeHref(url) : url">x</a>')
  })

  it('keeps components and plain styles alone', () => {
    allowed('<ExplorerLink :href="url" /><Card :srcdoc="url" /><div :style="{ color: url }"></div>')
    allowed('<a v-bind:title="url" :class="{ x: flag }">x</a>')
  })

  it('escapes a helper name that contains a regular-expression character', () => {
    const tpl = '<img :src="toUrl$(url)">'
    expect(lint(`<script setup lang="ts">\ndeclare const url: string\ndeclare function toUrl$(u: string): string\n</script>\n<template>${tpl}</template>`, 'src/A.vue', { urlHelpers: ['toUrl$'] })).toEqual([])
  })
})
