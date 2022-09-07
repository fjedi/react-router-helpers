import typescript from 'rollup-plugin-typescript2';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import { terser } from 'rollup-plugin-terser';
import replace from '@rollup/plugin-replace';
import nodePolyfills from 'rollup-plugin-node-polyfills';
//
import pkg from './package.json';

const input = 'src/index.tsx';
const commonOutputOptions = {
  exports: 'named',
  sourcemap: true,
  strict: false,
};
const commonPluginsHead = [
  replace({
    'process.env.NODE_ENV': JSON.stringify('production'),
    preventAssignment: true,
  }),
  // Preferably set as first plugin.
  peerDepsExternal(),
];
const commonPluginsMiddle = [commonjs(), typescript({ objectHashIgnoreUnknownHack: false })];

export default [
  {
    input,
    output: [
      {
        file: `${pkg.browser}.mjs`,
        format: 'es',
        ...commonOutputOptions,
      },
    ],
    plugins: [
      ...commonPluginsHead,
      nodeResolve({ browser: true }),
      ...commonPluginsMiddle,
      terser({
        ecma: 2015,
      }),
    ],
  },
  // isomorphic bundle (client+ssr)
  {
    input,
    output: [
      {
        file: pkg.main,
        format: 'cjs',
        ...commonOutputOptions,
      },
    ],
    plugins: [
      ...commonPluginsHead,
      nodePolyfills(),
      nodeResolve({ browser: false }),
      ...commonPluginsMiddle,
    ],
  },
];
