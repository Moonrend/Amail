#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const serverRoot = join(root, 'packages', 'server')
const distRoot = join(serverRoot, 'dist')

const assets = [
  { from: 'src/web', to: 'web', required: true },
  { from: 'src/db/migrations', to: 'db/migrations', required: true },
]

mkdirSync(distRoot, { recursive: true })

for (const asset of assets) {
  const source = join(serverRoot, asset.from)
  const target = join(distRoot, asset.to)

  if (!existsSync(source)) {
    if (asset.required) {
      throw new Error(`Required server asset directory is missing: ${asset.from}`)
    }
    continue
  }

  rmSync(target, { recursive: true, force: true })
  mkdirSync(dirname(target), { recursive: true })
  cpSync(source, target, { recursive: true })
  console.log(`copied ${asset.from} -> dist/${asset.to}`)
}
