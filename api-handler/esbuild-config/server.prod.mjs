import * as esbuild from 'esbuild'

try {

    await esbuild.build({
        entryPoints: ['src/index.ts'],
        bundle: true,
        sourcemap: true,
        minify: true,
        platform: 'node',
        target: ['node18.6'],
        packages: 'external',
        outdir: 'dist',
        define: {
            'process.env.NODE_ENV': "'production'"
        }
    })

    console.log('Server built successfully')

} catch (error) {
    console.log('An error occurred: ', error)
    process.exit(1)
}