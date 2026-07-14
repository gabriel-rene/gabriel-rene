import { writeFileSync, mkdirSync } from "node:fs"

const USER = "gabriel-rene"
const TOKEN = process.env.GH_TOKEN
if (!TOKEN) throw new Error("GH_TOKEN is required")

const QUERY = `
query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount } }
      }
    }
  }
}`

const res = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: {
    Authorization: `bearer ${TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ query: QUERY, variables: { login: USER } }),
})

if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`)
const json = await res.json()
if (json.errors) throw new Error(`GraphQL: ${JSON.stringify(json.errors)}`)

const calendar = json.data.user.contributionsCollection.contributionCalendar
const today = new Date().toISOString().slice(0, 10)
const days = calendar.weeks
  .flatMap((w) => w.contributionDays)
  .filter((d) => d.date <= today)
  .sort((a, b) => a.date.localeCompare(b.date))

// Walk backwards from the most recent day. A zero-count today does not break
// the streak, since the day is still in progress.
let current = 0
for (let i = days.length - 1; i >= 0; i--) {
  const day = days[i]
  if (day.contributionCount > 0) current++
  else if (!(day.date === today && current === 0)) break
}

let longest = 0
let run = 0
for (const day of days) {
  if (day.contributionCount > 0) longest = Math.max(longest, ++run)
  else run = 0
}

const stats = [
  { value: String(current), label: "CURRENT STREAK" },
  { value: String(longest), label: "LONGEST STREAK" },
  { value: String(calendar.totalContributions), label: "CONTRIBUTIONS · 12 MO" },
]

// Transparent background: these sit directly on GitHub's page, so the type uses
// GitHub's own foreground colors rather than a competing filled panel.
const THEMES = {
  light: { value: "#1f2328", label: "#59636e" },
  dark: { value: "#e6edf3", label: "#9198a1" },
}

const SERIF =
  "'Iowan Old Style','Palatino Linotype','Book Antiqua',Palatino,Georgia,'Times New Roman',serif"
const SANS = "'Helvetica Neue',Arial,sans-serif"

const render = (t) => {
  const columns = stats
    .map((s, i) => {
      const x = 4 + i * 336
      return `
  <text x="${x}" y="48" font-size="44" fill="${t.value}" font-family="${SERIF}">${s.value}</text>
  <text x="${x}" y="72" font-size="11" letter-spacing="3" fill="${t.label}" font-family="${SANS}">${s.label}</text>`
    })
    .join("")

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 100" width="1000" height="100" role="img" aria-label="Current streak ${current} days, longest streak ${longest} days, ${calendar.totalContributions} contributions in the last 12 months">${columns}
  <text x="4" y="94" font-size="9" letter-spacing="1.5" fill="${t.label}" fill-opacity="0.7" font-family="${SANS}">UPDATED ${today}</text>
</svg>
`
}

mkdirSync("assets", { recursive: true })
for (const [name, theme] of Object.entries(THEMES)) {
  writeFileSync(`assets/stats-${name}.svg`, render(theme))
}

console.log(`current=${current} longest=${longest} total=${calendar.totalContributions}`)
