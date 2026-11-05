/**
 * Per-Source projection of the admission rows and which cells each row offers.
 *
 * Upstream `SourceKind.policy.rows(stored)` builds these from the stored Source
 * config (src/sources/github.ts:80-90, src/sources/feishu.ts:90-101). The
 * returned `cells` are *availability* flags, not admission values: false means
 * the row can never produce that cell, so configuring it is dead.
 */
import { isPlainObject, normalizeFeishuConfig, normalizeGithubConfig } from './model.js'

const GITHUB_ROWS = [
  { id: 'issues', label: 'New Issues', observe: 'observeIssues', unaddressed: true },
  { id: 'pulls', label: 'New pull requests', observe: 'observePulls', unaddressed: true },
  { id: 'comments', label: 'Comments', observe: 'observeComments', unaddressed: true },
  { id: 'ci', label: 'Default branch CI', observe: 'observeCi', unaddressed: true },
]

function githubRows(config) {
  return GITHUB_ROWS.map(row => {
    const observed = config[row.observe] === true
    return {
      id: row.id,
      label: row.label,
      note: observed ? 'all' : '@ only',
      cells: {
        listedUnaddressed: row.id === 'ci' ? false : observed,
        unlistedAddressed: row.id === 'ci' ? false : true,
        unlistedUnaddressed: observed,
      },
    }
  })
}

function feishuRows(config) {
  const chats = (Array.isArray(config.chats) ? config.chats : [])
    .filter(chat => isPlainObject(chat) && typeof chat.chatId === 'string')
    .map(chat => ({
      id: chat.chatId,
      label: chat.name || chat.chatId,
      note: chat.listen === 'all' ? 'all' : '@ only',
      cells: {
        listedUnaddressed: chat.listen === 'all',
        unlistedAddressed: true,
        unlistedUnaddressed: chat.listen === 'all',
      },
    }))
  return [
    ...chats,
    {
      id: 'other',
      label: 'Other chats',
      note: config.otherChats === 'mentions' ? '@ only' : 'not received',
      cells: {
        listedUnaddressed: false,
        unlistedAddressed: config.otherChats === 'mentions',
        unlistedUnaddressed: false,
      },
    },
    {
      id: 'direct',
      label: 'Direct messages',
      note: config.directMessages ? 'received' : 'not received',
      cells: {
        listedUnaddressed: false,
        unlistedAddressed: config.directMessages,
        unlistedUnaddressed: false,
      },
    },
  ]
}

/**
 * Rows for one Source name. `known` is false when the name is not a Source kind
 * this snapshot knows; callers should then fall back to the raw admission keys
 * and say the projection is unavailable.
 */
export function sourceRows(settings, source) {
  const config = settings.sources?.[source]?.config
  if (source === 'github') return { known: true, rows: githubRows(normalizeGithubConfig(config)) }
  if (source === 'feishu') return { known: true, rows: feishuRows(normalizeFeishuConfig(config)) }
  return { known: false, rows: [] }
}

/** Look up one row by id; undefined when this Source never produces it. */
export function rowOf(settings, source, row) {
  const { known, rows } = sourceRows(settings, source)
  if (!known) return undefined
  return rows.find(item => item.id === row)
}
