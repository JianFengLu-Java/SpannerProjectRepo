#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const inputPath = args[0]
const outputDir = args[1] || path.resolve('tools-output/eif-extracted')

if (!inputPath) {
	console.error('Usage: node scripts/extract-eif-pngs.mjs <input.eif> [outputDir]')
	process.exit(1)
}

const resolvedInput = path.resolve(inputPath)
if (!fs.existsSync(resolvedInput)) {
	console.error(`Input file not found: ${resolvedInput}`)
	process.exit(1)
}

fs.mkdirSync(outputDir, { recursive: true })

const data = fs.readFileSync(resolvedInput)
const pngHead = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const pngTail = Buffer.from([
	0x49,
	0x45,
	0x4e,
	0x44,
	0xae,
	0x42,
	0x60,
	0x82,
])

const extracted = []
let cursor = 0
let seq = 1

while (cursor < data.length) {
	const headAt = data.indexOf(pngHead, cursor)
	if (headAt < 0) break
	const tailAt = data.indexOf(pngTail, headAt + pngHead.length)
	if (tailAt < 0) break
	const end = tailAt + pngTail.length
	const png = data.subarray(headAt, end)

	const fileName = `emoji_${String(seq).padStart(4, '0')}.png`
	const filePath = path.join(outputDir, fileName)
	fs.writeFileSync(filePath, png)
	extracted.push({
		id: seq,
		name: `表情${String(seq).padStart(4, '0')}`,
		placeholder: `[表情${String(seq).padStart(4, '0')}]`,
		file: fileName,
		offsetStart: headAt,
		offsetEnd: end,
		size: png.length,
	})

	seq += 1
	cursor = end
}

const mapping = {
	source: resolvedInput,
	total: extracted.length,
	exportedAt: new Date().toISOString(),
	items: extracted,
}

fs.writeFileSync(
	path.join(outputDir, 'mapping.json'),
	`${JSON.stringify(mapping, null, 2)}\n`,
)

console.log(`Extracted ${extracted.length} PNG files to: ${outputDir}`)
console.log(`Mapping file: ${path.join(outputDir, 'mapping.json')}`)
