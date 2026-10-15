// Executes real component handlers with a small synchronous hook lifecycle.
// This is a logic harness, not a DOM/browser integration test.
import fs from 'node:fs'
import vm from 'node:vm'
import { transformSync } from 'esbuild'

export const hookHarness = (path, name, exports, stopAt, extra = {}, supportingFiles = []) => {
    const slots = []
    let cursor = 0, dirty = false, effects = [], latestProps, output
    const same = (a, b) => a && b && a.length === b.length && a.every((x, i) => Object.is(x, b[i]))
    const context = vm.createContext({
        console, setTimeout, clearTimeout, ...extra,
        useState(initial) {
            const i = cursor++
            if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial
            return [slots[i], value => {
                const next = typeof value === 'function' ? value(slots[i]) : value
                if (!Object.is(next, slots[i])) { slots[i] = next; dirty = true }
            }]
        },
        useRef(initial) {
            const i = cursor++
            return slots[i] ||= { current: initial }
        },
        useMemo(fn, deps) {
            const i = cursor++
            if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { deps, value: fn() }
            return slots[i].value
        },
        useCallback(fn, deps) { return context.useMemo(() => fn, deps) },
        useEffect(fn, deps) {
            const i = cursor++
            if (!slots[i] || !same(slots[i].deps, deps)) effects.push(() => {
                slots[i]?.cleanup?.()
                slots[i] = { deps, cleanup: fn() }
            })
        },
    })
    const clean = source => source.replace(/^import .*$/gm, '').replace(/^export default .*$/gm, '').replace(/export /g, '')
    supportingFiles.forEach(file => vm.runInContext(clean(fs.readFileSync(file, 'utf8')), context))
    let source = clean(fs.readFileSync(path, 'utf8'))
    const marker = source.indexOf(stopAt)
    if (marker < 0) throw new Error('Missing component harness marker: ' + path)
    source = source.slice(0, marker) + `return {${exports}}\n}\nglobalThis.component = ${name}`
    vm.runInContext(transformSync(source, { loader: 'jsx', format: 'cjs' }).code, context)
    const render = props => {
        latestProps = props || latestProps
        for (let attempts = 0; attempts < 20; attempts++) {
            cursor = 0; dirty = false; effects = []
            output = context.component(latestProps)
            effects.forEach(fn => fn())
            if (!dirty) return output
        }
        throw new Error('Harness did not settle')
    }
    return { render, unmount: () => slots.forEach(slot => slot?.cleanup?.()) }
}
