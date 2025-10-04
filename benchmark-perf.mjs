#!/usr/bin/env node

/**
 * Performance benchmark for glob pattern matching optimizations
 *
 * Measures:
 * - Files per second for various patterns
 * - Pattern compilation cache effectiveness
 * - Result memoization impact
 * - Fast path optimization benefits
 */

import { glob, getCacheStats, clearAllCaches } from './dist/esm/index.js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Create a test directory structure if it doesn't exist
async function setupTestDirectory() {
  const testDir = join(__dirname, 'bench-test-files')

  if (fs.existsSync(testDir)) {
    return testDir
  }

  console.log('Setting up test directory...')
  fs.mkdirSync(testDir, { recursive: true })

  // Create nested structure with various file types
  const dirs = ['src', 'lib', 'test', 'dist', 'node_modules']
  const subdirs = ['utils', 'core', 'helpers', 'components']
  const extensions = ['js', 'ts', 'tsx', 'json', 'md']

  for (const dir of dirs) {
    const dirPath = join(testDir, dir)
    fs.mkdirSync(dirPath, { recursive: true })

    // Create files in main dir
    for (let i = 0; i < 50; i++) {
      const ext = extensions[i % extensions.length]
      fs.writeFileSync(join(dirPath, `file-${i}.${ext}`), `// file ${i}`)
    }

    // Create subdirectories
    for (const subdir of subdirs) {
      const subdirPath = join(dirPath, subdir)
      fs.mkdirSync(subdirPath, { recursive: true })

      for (let i = 0; i < 30; i++) {
        const ext = extensions[i % extensions.length]
        fs.writeFileSync(join(subdirPath, `file-${i}.${ext}`), `// file ${i}`)
      }
    }
  }

  console.log('Test directory created.')
  return testDir
}

async function benchmark(name, pattern, testDir, iterations = 5) {
  const times = []
  let results = []

  // Warm up
  await glob(pattern, { cwd: testDir })

  // Clear caches for baseline measurement
  clearAllCaches()

  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    results = await glob(pattern, { cwd: testDir })
    const end = performance.now()
    times.push(end - start)
  }

  const avgTime = times.reduce((a, b) => a + b, 0) / times.length
  const filesPerSec = (results.length / avgTime) * 1000
  const cacheStats = getCacheStats()

  return {
    name,
    pattern,
    avgTime: avgTime.toFixed(2),
    filesMatched: results.length,
    filesPerSec: filesPerSec.toFixed(0),
    cacheStats,
  }
}

async function runBenchmarks() {
  console.log('='.repeat(70))
  console.log('Glob Pattern Matching Performance Benchmark')
  console.log('='.repeat(70))
  console.log()

  const testDir = await setupTestDirectory()

  const patterns = [
    { name: 'Simple extension (*.js)', pattern: '**/*.js' },
    { name: 'Simple extension (*.ts)', pattern: '**/*.ts' },
    { name: 'Multiple extensions', pattern: '**/*.{js,ts,tsx}' },
    { name: 'Deep glob', pattern: '**/src/**/*.js' },
    { name: 'Complex pattern', pattern: '**/+(src|lib)/**/*.@(js|ts)' },
    { name: 'All files', pattern: '**/*' },
    { name: 'JSON files only', pattern: '**/*.json' },
    { name: 'Test files', pattern: '**/test/**/*.js' },
  ]

  console.log('Running benchmarks...\n')

  const results = []
  for (const { name, pattern } of patterns) {
    const result = await benchmark(name, pattern, testDir, 10)
    results.push(result)

    console.log(`${name}`)
    console.log(`  Pattern: ${pattern}`)
    console.log(`  Files matched: ${result.filesMatched}`)
    console.log(`  Average time: ${result.avgTime}ms`)
    console.log(`  Files/second: ${result.filesPerSec}`)
    console.log(`  Cache stats:`)
    console.log(`    Pattern cache: ${result.cacheStats.patternCacheSize}`)
    console.log(`    Result cache: ${result.cacheStats.resultCacheSize}`)
    console.log(`    Stat cache: ${result.cacheStats.statCacheSize}`)
    console.log()
  }

  // Summary
  console.log('='.repeat(70))
  console.log('Summary')
  console.log('='.repeat(70))
  console.log()
  console.log('Pattern'.padEnd(35) + 'Files'.padEnd(10) + 'Time (ms)'.padEnd(12) + 'Files/sec')
  console.log('-'.repeat(70))

  for (const result of results) {
    const name = result.name.padEnd(35)
    const files = String(result.filesMatched).padEnd(10)
    const time = String(result.avgTime).padEnd(12)
    const fps = String(result.filesPerSec)
    console.log(`${name}${files}${time}${fps}`)
  }

  console.log()
  console.log('='.repeat(70))
  console.log('Cache Effectiveness')
  console.log('='.repeat(70))

  const finalStats = getCacheStats()
  console.log(`Pattern cache size: ${finalStats.patternCacheSize} (reused patterns)`)
  console.log(`Result cache size: ${finalStats.resultCacheSize} (cached results)`)
  console.log(`Stat cache size: ${finalStats.statCacheSize} (cached fs stats)`)
  console.log()

  console.log('Benchmark complete!')
}

runBenchmarks().catch(console.error)
