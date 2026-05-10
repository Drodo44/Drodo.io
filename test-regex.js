import fs from 'node:fs'
const text = fs.readFileSync('src-tauri/Cargo.toml', 'utf8')
console.log('First 80 chars:', JSON.stringify(text.slice(0, 80)))
const match = text.match(/(\[package\][\s\S]*?^version = )"([^"]+)"/m)
console.log('Match:', match ? match[2] : 'NO MATCH')
