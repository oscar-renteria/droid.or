import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'))
const packages = []

for (const [packagePath, lockedPackage] of Object.entries(lock.packages)) {
  if (!packagePath.startsWith('node_modules/') || lockedPackage.dev) continue

  const packageDir = join(root, packagePath)
  if (!existsSync(packageDir)) continue

  const manifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'))
  const licenseFiles = readdirSync(packageDir)
    .filter((name) => /^(license|licence|copying|notice)(\..*)?$/i.test(name))
    .sort()
  const license =
    manifest.license ??
    lockedPackage.license ??
    manifest.licenses
      ?.map((item) => item.type)
      .filter(Boolean)
      .join(' OR ')

  if (!license && licenseFiles.length === 0) {
    throw new Error(`No license metadata or license text found for ${manifest.name}.`)
  }

  const repository =
    typeof manifest.repository === 'string' ? manifest.repository : manifest.repository?.url
  packages.push({
    name: manifest.name ?? packagePath.slice('node_modules/'.length),
    version: manifest.version ?? lockedPackage.version,
    license: license ?? 'Not declared; see included license text',
    source: repository || manifest.homepage,
    licenseFiles: licenseFiles.map((name) => ({
      name,
      text: readFileSync(join(packageDir, name), 'utf8').trim()
    }))
  })
}

if (packages.length === 0) {
  throw new Error('No installed production dependencies were found.')
}

packages.sort((left, right) => {
  if (left.name !== right.name) return left.name < right.name ? -1 : 1
  if (left.version === right.version) return 0
  return left.version < right.version ? -1 : 1
})

const sections = packages.map((dependency) => {
  const lines = [
    `Package: ${dependency.name}@${dependency.version}`,
    `License: ${dependency.license}`
  ]

  if (dependency.source) lines.push(`Source: ${dependency.source}`)
  if (dependency.licenseFiles.length === 0) {
    lines.push('No license text file is included in the installed package.')
  } else {
    for (const file of dependency.licenseFiles) {
      lines.push('', `--- ${file.name} ---`, file.text, `--- End ${file.name} ---`)
    }
  }

  return lines.join('\n')
})

const notices = [
  'THIRD-PARTY NOTICES',
  '',
  `Generated from ${packages.length} installed production dependencies. Do not edit.`,
  '',
  sections.join('\n\n')
].join('\n')

if ((notices.match(/^Package: /gm) ?? []).length !== packages.length) {
  throw new Error('Generated third-party notices do not cover every production dependency.')
}

writeFileSync(join(root, 'THIRD_PARTY_NOTICES.txt'), `${notices}\n`)
