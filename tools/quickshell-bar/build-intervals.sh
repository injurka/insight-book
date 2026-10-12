#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
bundle=$(mktemp)
trap 'rm -f "$bundle"' EXIT
bun build intervals-entry.js --target browser --outfile "$bundle"
bun - "$bundle" <<'JS'
import ts from '../../apps/client/node_modules/typescript'
const license = await Bun.file('../../apps/client/node_modules/ts-fsrs/LICENSE').text()
const source = (await Bun.file(process.argv[2]).text()).split('export {')[0]
const compiled = ts.transpile(source, {target: ts.ScriptTarget.ES5, module: ts.ModuleKind.None, downlevelIteration: true})
await Bun.write('qml/SrsIntervals.js', '.pragma library\n// Generated from ts-fsrs; rebuild with build-intervals.sh.\n/*\n' + license + '*/\n' + compiled)
JS
