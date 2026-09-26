/**
 * Build the site for a deployed host, where it lives at the domain root.
 *
 * `npm run build` targets the local Apache at htdocs/pawsandfound/, which is
 * where the accessibility run and the classmates' installs expect it. A
 * deployed copy sits at the root instead, so the asset paths differ — see
 * `base` in vite.config.js.
 *
 * This exists rather than asking somebody to type `VITE_BASE=/ npm run build`
 * because in Git Bash on Windows that does not work: MSYS rewrites the bare
 * `/` into the Git installation path, and the build comes out asking for
 * /Program Files/Git/assets/... The page then loads as a blank screen with
 * four 404s, which is a miserable thing to debug on deployment day.
 *
 * Setting the variable inside Node sidesteps the shell entirely.
 */
import { spawnSync } from 'node:child_process'

const result = spawnSync('npx', ['vite', 'build'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, VITE_BASE: '/' },
})

process.exit(result.status ?? 1)
