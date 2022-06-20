const path = require('path');
const { promises: fs } = require('fs');
const { execSync } = require('child_process');
const esbuild = require('esbuild');
const chokidar = require('chokidar');
const debugTargetProjectDir = (() => {
  const dir = process.env.DEBUG_PROJECT;
  return dir ? path.join(dir, 'node_modules/jinge-compiler/lib') : undefined;
})();
const WATCH = process.env.WATCH === 'true';
const ROOT_DIR = path.resolve(__dirname, '../');
const DIST_LIB_DIR = path.resolve(process.cwd(), debugTargetProjectDir || 'lib');
const DIST_COMPILER_DIR = path.resolve(__dirname, '../compiler');

async function glob(dir) {
  const subs = await fs.readdir(dir);
  let files = [];
  for await (const sub of subs) {
    if (/\.ts$/.test(sub)) {
      files.push(path.join(dir, sub));
    } else if (!/\./.test(sub)) {
      files = files.concat(await glob(path.join(dir, sub)));
    }
  }
  return files;
}

async function transformFile(file) {
  const src = await fs.readFile(file, 'utf-8');
  let rf = path.relative(ROOT_DIR, file);
  const isSrc = rf.startsWith('src/');
  rf = rf.substring(isSrc ? 4 : 5);

  const { code, map, warnings } = await esbuild.transform(src, {
    target: isSrc ? 'es2020' : 'node18',
    format: isSrc ? 'esm' : 'cjs',
    loader: path.extname(file).slice(1),
    sourcemap: true,
    sourcefile: `${path.relative(path.dirname(file), ROOT_DIR)}/${isSrc ? 'src' : 'tool'}/${rf}`,
    sourcesContent: false,
  });
  if (warnings?.length) console.error(warnings);
  if (!code) return; // ignore empty file
  const distfile = path.join(isSrc ? DIST_LIB_DIR : DIST_COMPILER_DIR, rf.replace(/\.ts$/, '.js'));
  execSync(`mkdir -p ${path.dirname(distfile)}`);
  await Promise.all([
    fs.writeFile(distfile, code + `\n//# sourceMappingURL=${path.basename(distfile) + '.map'}`),
    fs.writeFile(
      distfile + '.map',
      map.replace('"version": 3', `"version": 3,\n  "sourceRoot": "",\n  "file": "${path.basename(distfile)}"`),
    ),
  ]);
}
async function handleChange(file) {
  if (!/\.ts$/.test(file)) return;
  const fn = path.relative(ROOT_DIR, file);
  try {
    await transformFile(file);
    console.log(fn, 'compiled.');
  } catch (ex) {
    console.error(fn, 'failed.');
    console.error(ex);
  }
}
(async () => {
  const files = (await Promise.all([glob(path.join(ROOT_DIR, 'src')), glob(path.join(ROOT_DIR, 'tool'))])).reduce(
    (p, c) => p.concat(c),
    [],
  );

  for await (const file of files) {
    await transformFile(file);
  }
  console.log('Build finished.');
  if (!WATCH) return;
  console.log('Continue watching...');
  chokidar
    .watch(path.join(ROOT_DIR, '{src,tool}/**/*.ts'), {
      ignoreInitial: true,
    })
    .on('add', (file) => handleChange(file))
    .on('change', (file) => handleChange(file));
})().catch((err) => {
  console.error(err);
  process.exit(-1);
});
