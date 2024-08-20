import * as esbuild from 'esbuild';

try {
    const ctx = await esbuild.context({
        entryPoints: ['src/index.ts'],
        bundle: true,
        sourcemap: true,
        minify: false,
        platform: 'node',
        target: ['node18.6'],
        packages: 'external',
        define: {
            'process.env.NODE_ENV': "'deployment'"
        },
        outdir: 'dist',
    })

    await ctx.watch()

    console.log('Watching Server....')

} catch (error) {
    console.log('An error occurred: ', error)
    process.exit(1)
}