import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const avatarsDir = path.join(__dirname, '../public/images/avatars')

async function convertToWebP() {
  const files = fs.readdirSync(avatarsDir)
  const pngFiles = files.filter(f => f.endsWith('.png'))

  console.log(`Found ${pngFiles.length} PNG files to convert`)

  for (const file of pngFiles) {
    const inputPath = path.join(avatarsDir, file)
    const outputPath = path.join(avatarsDir, file.replace('.png', '.webp'))

    if (fs.existsSync(outputPath)) {
      console.log(`Skipping ${file} - WebP version already exists`)
      continue
    }

    try {
      await execAsync(`npx @squoosh/cli "${inputPath}" --output-dir "${avatarsDir}" --webp`)
      console.log(`Converted ${file} to WebP`)
    } catch (error) {
      console.error(`Failed to convert ${file}:`, error.message)
    }
  }

  console.log('Conversion complete!')
}

convertToWebP().catch(console.error)
