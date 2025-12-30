/**
 * esbuild 打包脚本
 * 将 extension 及其依赖打包为单文件
 */
import * as esbuild from 'esbuild'

const isWatch = process.argv.includes('--watch')

const buildOptions: esbuild.BuildOptions = {
  entryPoints: ['packages/core/src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: true,
  minify: !isWatch,
}

async function main() {
  if (isWatch) {
    const ctx = await esbuild.context(buildOptions)
    await ctx.watch()
    console.log('[esbuild] Watching for changes...')
  } else {
    await esbuild.build(buildOptions)
    console.log('[esbuild] Build complete')
  }
}

main()
