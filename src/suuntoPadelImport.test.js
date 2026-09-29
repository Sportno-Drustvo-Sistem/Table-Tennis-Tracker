import { readFileSync } from 'node:fs'
import { createContext, runInContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { decodeSuuntoPadelSummary, parseSuuntoPadelWorkout } from './suuntoPadelImport'

const watchSource = readFileSync(new URL('../integrations/suunto-padel/main.js', import.meta.url), 'utf8')
const manifest = JSON.parse(readFileSync(new URL('../integrations/suunto-padel/manifest.json', import.meta.url), 'utf8'))

const watch = (single = false) => {
    const context = createContext({ localStorage: { getItem: () => single ? '0' : '1' } })
    runInContext(watchSource, context)
    const output = {}
    context.onLoad({}, output)
    return {
        output,
        point: team => context.onEvent({}, output, team === 1 ? 1 : 3),
        undo: () => context.onEvent({}, output, 2),
        summary: () => JSON.parse(JSON.stringify(context.getSummaryOutputs())).map(field => ({ Id: field.id, SummaryValue: field.value })),
    }
}

const game = (app, team) => { for (let i = 0; i < 4; i++) app.point(team) }
const straightSet = (app, team) => { for (let i = 0; i < 6; i++) game(app, team) }
const container = summary => JSON.stringify({ Header: { Zapps: [{ Zapp: { Name: manifest.name, SummaryOutputs: summary } }] } })
const summary = (v, a, b = 0, c = 0) => [v, a, b, c].map((value, i) => ({ Id: ['v', 'a', 'b', 'c'][i], SummaryValue: value }))

describe('Suunto padel watch and import', () => {
    it('scores deuce and advantage, returns to deuce, and requires a two-point lead', () => {
        const app = watch()
        for (let i = 0; i < 3; i++) { app.point(1); app.point(2) }
        expect(app.output).toMatchObject({ p1: 40, p2: 40, g1: 0 })
        app.point(1)
        expect(app.output.p1).toBe(-1)
        app.point(2)
        expect(app.output).toMatchObject({ p1: 40, p2: 40 })
        app.point(2); app.point(2)
        expect(app.output).toMatchObject({ p1: 0, p2: 0, g2: 1 })
    })

    it('keeps a long deuce game valid', () => {
        const app = watch()
        for (let i = 0; i < 100; i++) { app.point(1); app.point(2) }
        expect(app.output).toMatchObject({ p1: 40, p2: 40, g1: 0, g2: 0 })
        app.point(1); app.point(1)
        expect(app.output.g1).toBe(1)
    })

    it('round trips a three-set match where the winner has fewer total games', () => {
        const app = watch()
        straightSet(app, 2)
        for (let set = 0; set < 2; set++) {
            for (let i = 0; i < 5; i++) { game(app, 1); game(app, 2) }
            game(app, 1); game(app, 1)
        }
        expect(app.output.w).toBe(1)
        const result = parseSuuntoPadelWorkout(container(app.summary()))
        expect(result).toEqual({ matchFormat: 'best_of_3', setsData: [
            { team1Games: 0, team2Games: 6 },
            { team1Games: 7, team2Games: 5 },
            { team1Games: 7, team2Games: 5 },
        ] })
    })

    it('plays a 6–6 tiebreak beyond seven until there is a two-point lead', () => {
        const app = watch(true)
        for (let i = 0; i < 6; i++) { game(app, 1); game(app, 2) }
        for (let i = 0; i < 6; i++) { app.point(1); app.point(2) }
        app.point(2)
        expect(app.output).toMatchObject({ p1: 6, p2: 7, w: 0 })
        app.point(2)
        expect(decodeSuuntoPadelSummary(app.summary())).toEqual({ matchFormat: 'best_of_1', setsData: [{ team1Games: 6, team2Games: 7 }] })
    })

    it('undoes a match-winning point, rejects the unfinished export, and allows correction', () => {
        const app = watch(true)
        straightSet(app, 1)
        const finished = app.summary()
        app.point(2)
        expect(app.summary()).toEqual(finished)
        app.undo()
        expect(app.output).toMatchObject({ w: 0, g1: 5, p1: 40 })
        expect(() => decodeSuuntoPadelSummary(app.summary())).toThrow('before the padel match')
        app.point(1)
        expect(app.summary()).toEqual(finished)
    })

    it('undoes across a set transition and limits undo history to eight points', () => {
        const app = watch()
        straightSet(app, 1)
        app.undo()
        expect(app.output).toMatchObject({ n1: 0, g1: 5, p1: 40 })
        for (let i = 0; i < 30; i++) app.undo()
        const state = { ...app.output }
        app.undo()
        expect(app.output).toEqual(state)
        expect(app.output).toMatchObject({ g1: 4, p1: 0 })
    })

    it.each([
        [summary(1322, 46, 46), 'best_of_3'],
        [summary(1111, 60), 'best_of_1'],
    ])('accepts a complete valid result', (fields, format) => {
        expect(parseSuuntoPadelWorkout(container(fields)).matchFormat).toBe(format)
    })

    it.each([
        [summary(2322, 46, 46), 'Unsupported'],
        [summary(1312, 46, 46), 'recorded winner'],
        [summary(1313, 60, 60, 60), 'Extra sets'],
        [summary(1111, 65), 'unfinished or invalid set'],
        [summary(1111, 60, 60), 'extra set scores'],
        [summary(1111, 80), 'Invalid padel set'],
        [summary(1111, 60).slice(0, 3), 'incomplete'],
        [[...summary(1111, 60), { Id: 'v', SummaryValue: 1111 }], 'duplicate'],
        [summary(1111, 60).map(field => ({ ...field, SummaryValue: String(field.SummaryValue) })), 'Invalid'],
    ])('rejects corrupt or inconsistent results', (fields, message) => {
        expect(() => decodeSuuntoPadelSummary(fields)).toThrow(message)
    })

    it('rejects unrelated activities, malformed JSON and multiple matching workouts', () => {
        expect(() => parseSuuntoPadelWorkout('{}')).toThrow('No Tracker Padel')
        expect(() => parseSuuntoPadelWorkout('{')).toThrow()
        const header = JSON.parse(container(summary(1111, 60))).Header
        expect(() => parseSuuntoPadelWorkout(JSON.stringify([header, header]))).toThrow('one padel workout')
    })

    it('exports four small exact integer fields and declares every watch output', () => {
        const app = watch()
        straightSet(app, 1); straightSet(app, 1)
        expect(app.summary()).toHaveLength(4)
        expect(app.summary().every(field => Math.fround(field.SummaryValue) === field.SummaryValue)).toBe(true)
        expect(Object.keys(app.output).sort()).toEqual(manifest.out.map(field => field.name).sort())
    })
})
