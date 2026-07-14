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

const THEMES = {
  light: { bg: "#E0D7D7", value: "#2A1F1F", label: "#6B5B5B", accent: "#A65D4E", rule: "#8A7A7A" },
  dark: { bg: "#312424", value: "#EDE6E6", label: "#B7A6A6", accent: "#C87B68", rule: "#A5928F" },
}

const SERIF =
  "'Iowan Old Style','Palatino Linotype','Book Antiqua',Palatino,Georgia,'Times New Roman',serif"
const SANS = "'Helvetica Neue',Arial,sans-serif"

const render = (t) => {
  const columns = stats
    .map((s, i) => {
      const x = 1000 * ((i + 0.5) / 3)
      return `
  <text x="${x}" y="78" text-anchor="middle" font-size="46" fill="${t.value}" font-family="${SERIF}">${s.value}</text>
  <text x="${x}" y="106" text-anchor="middle" font-size="11" letter-spacing="3" fill="${t.label}" font-family="${SANS}">${s.label}</text>`
    })
    .join("")

  const dividers = [1000 / 3, (1000 / 3) * 2]
    .map(
      (x) =>
        `<line x1="${x}" y1="40" x2="${x}" y2="100" stroke="${t.rule}" stroke-opacity="0.3" stroke-width="1"/>`
    )
    .join("\n  ")

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 150" width="1000" height="150" role="img" aria-label="Current streak ${current} days, longest streak ${longest} days, ${calendar.totalContributions} contributions in the last 12 months">
  <rect width="1000" height="150" fill="${t.bg}"/>
  <line x1="480" y1="28" x2="520" y2="28" stroke="${t.accent}" stroke-width="2"/>
  ${dividers}${columns}
  <text x="500" y="134" text-anchor="middle" font-size="9" letter-spacing="1.5" fill="${t.label}" fill-opacity="0.75" font-family="${SANS}">UPDATED ${today}</text>
</svg>
`
}

mkdirSync("assets", { recursive: true })
for (const [name, theme] of Object.entries(THEMES)) {
  writeFileSync(`assets/stats-${name}.svg`, render(theme))
}

console.log(`current=${current} longest=${longest} total=${calendar.totalContributions}`)
