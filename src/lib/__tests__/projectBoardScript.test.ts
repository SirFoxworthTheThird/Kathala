import { describe, it, expect, beforeEach } from 'vitest'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/*
  scripts/project-board.sh, which keeps the GitHub Project board from a
  workflow run (.github/workflows/project-board.yml), against a stand-in `gh`:
  each call is written down, and answered from files the test sets out. The
  real board is the owner's, and no test reaches it.
*/

const SCRIPT = join(__dirname, '../../../scripts/project-board.sh')

const STUB = `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$STATE/calls"
case "$2" in
  list) if [ -f "$STATE/project" ]; then echo '{"projects":[{"number":5,"title":"Kathala roadmap"}]}'; else echo '{"projects":[]}'; fi ;;
  create) touch "$STATE/project"; echo '{"number":5}' ;;
  view) echo '{"id":"PVT_5","url":"https://github.com/users/O/projects/5"}' ;;
  link) exit 0 ;;
  field-list) cat "$STATE/fields" ;;
  item-add) echo "{\\"id\\":\\"ITEM_\${7##*/}\\"}" ;;
  item-list) cat "$STATE/items" ;;
  *) exit 0 ;;
esac
`

const STATUS = { id: 'F_status', name: 'Status', type: 'ProjectV2SingleSelectField', options: [{ id: 'O_todo', name: 'Todo' }, { id: 'O_done', name: 'Done' }] }
const PRIORITY = { id: 'F_prio', name: 'Priority', type: 'ProjectV2SingleSelectField', options: [{ id: 'O_p1', name: 'P1' }, { id: 'O_p2', name: 'P2' }] }

let state: string
beforeEach(() => {
  state = mkdtempSync(join(tmpdir(), 'board-'))
  writeFileSync(join(state, 'gh'), STUB)
  chmodSync(join(state, 'gh'), 0o755)
  writeFileSync(join(state, 'fields'), JSON.stringify({ fields: [STATUS] }))
  writeFileSync(join(state, 'items'), JSON.stringify({ items: [] }))
  writeFileSync(join(state, 'calls'), '')
})

function run(action: string, opts: { ops?: unknown; token?: string; project?: boolean } = {}) {
  if (opts.project !== false) writeFileSync(join(state, 'project'), '')
  const r = spawnSync('bash', [SCRIPT], {
    encoding: 'utf8',
    env: {
      PATH: `${state}:${process.env.PATH}`, STATE: state,
      GH_TOKEN: opts.token ?? 'token', PROJECT_OWNER: 'O', PROJECT_REPO: 'O/Kathala', PROJECT_TITLE: 'Kathala roadmap',
      BOARD_ACTION: action, BOARD_OPS: opts.ops === undefined ? '[]' : typeof opts.ops === 'string' ? opts.ops : JSON.stringify(opts.ops),
    },
  })
  const calls = readFileSync(join(state, 'calls'), 'utf8').split('\n').filter(Boolean)
  return { code: r.status, out: `${r.stdout}${r.stderr}`, calls }
}

describe('the project board script', () => {
  it('says what is missing without a token, and calls nothing', () => {
    const r = run('list', { token: '' })
    expect(r.code).toBe(1)
    expect(r.out).toContain('PROJECT_TOKEN')
    expect(r.calls).toEqual([])
  })

  it('setup makes the board, links it, and makes only the fields it lacks; run again, it makes nothing', () => {
    const first = run('setup', { project: false })
    expect(first.code).toBe(0)
    expect(first.calls.filter((c) => c.startsWith('project create'))).toHaveLength(1)
    expect(first.calls).toContain('project link 5 --owner O --repo O/Kathala')
    // Status is every board's own; Priority and Group are made.
    expect(first.calls.filter((c) => c.startsWith('project field-create')).map((c) => c.match(/--name (\w+)/)![1])).toEqual(['Priority', 'Group'])
    writeFileSync(join(state, 'fields'), JSON.stringify({ fields: [STATUS, PRIORITY, { ...PRIORITY, id: 'F_group', name: 'Group' }] }))
    writeFileSync(join(state, 'calls'), '')
    const again = run('setup')
    expect(again.code).toBe(0)
    expect(again.calls.some((c) => c.startsWith('project create') || c.startsWith('project field-create'))).toBe(false)
  })

  it('apply adds an issue or a pull request and sets its fields by option name', () => {
    writeFileSync(join(state, 'fields'), JSON.stringify({ fields: [STATUS, PRIORITY] }))
    const r = run('apply', { ops: [{ op: 'add', issue: 697, fields: { Priority: 'P1', Status: 'Todo' } }, { op: 'add', pr: 693 }] })
    expect(r.code).toBe(0)
    expect(r.calls).toContain('project item-add 5 --owner O --url https://github.com/O/Kathala/issues/697 --format json')
    expect(r.calls).toContain('project item-edit --id ITEM_697 --project-id PVT_5 --field-id F_prio --single-select-option-id O_p1')
    expect(r.calls).toContain('project item-edit --id ITEM_697 --project-id PVT_5 --field-id F_status --single-select-option-id O_todo')
    expect(r.calls).toContain('project item-add 5 --owner O --url https://github.com/O/Kathala/pull/693 --format json')
    expect(r.out).toContain('On the board: https://github.com/O/Kathala/issues/697 (Priority: P1 Status: Todo)')
  })

  it('an option or a field the board does not have fails the run, and says which', () => {
    const r = run('apply', { ops: [{ op: 'add', issue: 697, fields: { Status: 'Someday', Owner: 'x' } }] })
    expect(r.code).not.toBe(0)
    expect(r.out).toContain("'Status' has no option 'Someday'")
    expect(r.out).toContain("No field 'Owner'")
    expect(r.calls.some((c) => c.startsWith('project item-edit'))).toBe(false)
  })

  it('nothing in the inputs is run as a command: a number that is not one is refused, and a value is only a value', () => {
    const marker = join(state, 'pwned')
    const r = run('apply', { ops: [
      { op: 'add', issue: `697; touch ${marker}` },
      { op: 'add', issue: 698, fields: { Status: `$(touch ${marker})` } },
    ] })
    expect(r.code).not.toBe(0)
    expect(r.out).toContain('Not a number')
    expect(existsSync(marker)).toBe(false)
    expect(r.calls.some((c) => c.includes('697;'))).toBe(false)
  })

  it('archive and remove act on an item that is there, and say so of one that is not', () => {
    writeFileSync(join(state, 'items'), JSON.stringify({ items: [{ id: 'ITEM_702', content: { number: 702, title: 'A family tree', url: 'https://github.com/O/Kathala/issues/702' }, status: 'Todo' }] }))
    const r = run('apply', { ops: [{ op: 'archive', issue: 702 }, { op: 'remove', issue: 703 }] })
    expect(r.code).toBe(0)
    expect(r.calls).toContain('project item-archive 5 --owner O --id ITEM_702')
    expect(r.calls.some((c) => c.startsWith('project item-delete'))).toBe(false)
    expect(r.out).toContain('Not on the board, nothing to remove: https://github.com/O/Kathala/issues/703')
  })

  it('list prints each item with its fields; with no board, it says to run setup', () => {
    writeFileSync(join(state, 'items'), JSON.stringify({ items: [{ id: 'ITEM_697', content: { number: 697, title: 'Import a manuscript from Word', url: 'u' }, status: 'Todo', priority: 'P1' }] }))
    const r = run('list')
    expect(r.code).toBe(0)
    expect(r.out).toContain('## Kathala roadmap: 1 items')
    expect(r.out).toContain('- #697 Import a manuscript from Word — status: Todo, priority: P1')
    rmSync(join(state, 'project'))
    const none = run('list', { project: false })
    expect(none.code).not.toBe(0)
    expect(none.out).toContain("Run the workflow with action 'setup' first")
  })

  it('a malformed list of operations, or an unknown action, fails plainly', () => {
    expect(run('apply', { ops: '{"op":"add"}' }).out).toContain('BOARD_OPS is not a JSON array')
    expect(run('tidy').out).toContain("Unknown action 'tidy'")
  })
})
