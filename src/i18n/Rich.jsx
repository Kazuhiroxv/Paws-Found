import { Fragment } from 'react'
import { t } from './index.js'

/**
 * A translated sentence with a link or emphasis inside it.
 *
 * The dictionary marks the inner words — "Read the <link>Privacy Notice</link>"
 * — and the caller says what each tag becomes. The words around the link stay
 * one sentence in the dictionary, so a translator can move the link to where
 * Filipino puts it. Text only: nothing in a dictionary is ever HTML.
 *
 * @param {Object} props
 * @param {string} props.k  The key.
 * @param {Record<string, string|number>} [props.vars]
 * @param {Record<string, (text: string) => React.ReactNode>} [props.tags]
 */
export function Rich({ k, vars, tags = {} }) {
  const text = t(k, vars)
  const parts = []
  const pattern = /<(\w+)>(.*?)<\/\1>/g
  let last = 0
  let match

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    const render = tags[match[1]]
    parts.push(render ? render(match[2]) : match[2])
    last = pattern.lastIndex
  }
  if (last < text.length) parts.push(text.slice(last))

  return parts.map((part, index) => <Fragment key={index}>{part}</Fragment>)
}
