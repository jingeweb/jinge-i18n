#!/usr/bin/env node

const yargs = require('yargs');

const arg = yargs
  .strict()
  .usage('Usage: jinge-i18n [command] <options>')
  .command('extract', 'extract all texts to translate', (yarg) => {
    yarg
      .usage('Usage: jinge-i18n extract [options]')
      .option('scan', {
        alias: 's',
        array: true,
        demandOption: true,
        describe: 'directories to scan',
      })
      .option('locale', {
        alias: 'l',
        array: true,
        demandOption: true,
        describe: 'target locales to translate',
      })
      .example("jinge-i18n extract --scan './src' --locale en", 'scan src directory and mark en as traget locale')
      .example(
        'jinge-i18n extract --scan src src2 --locale en jp',
        'scan src and src2 directories and mark en and jp as traget locales',
      );
  })
  .command('generate', 'generate dictionary & metadata file')
  .demandCommand(1)
  .alias('version', 'v')
  .help()
  .alias('help', 'h').argv;

if (arg._[0] === 'extract') {
  arg.locale.forEach((loc) => {
    if (!/^[a-z]+(_[a-z]+)?$/.test(loc)) {
      console.error('[error] locale must match /^[a-z]+(_[a-z]+)?$/, but got ' + loc);
      process.exit(-1);
    }
  });
  require('../compiler/extract').extract({
    scanDirs: arg.scan,
    targetLocales: arg.locale,
  });
} else {
  require('../compiler/generate').generate();
}
