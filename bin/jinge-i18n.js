#!/usr/bin/env node

const yargs = require('yargs');

const arg = yargs
  .strict()
  .usage('Usage: jinge-i18n [command] <options>')
  .command('extract', 'extract all texts to translate', (yarg) => {
    yarg
      .usage('Usage: jinge-i18n extract [options]')
      .option('inline-tag', {
        alias: 't',
        array: true,
        demandOption: false,
        describe: 'inline tags to do i18n concat',
      })
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
      .example(
        "jinge-i18n extract --scan './src/**/*.{ts,html}' --locale en",
        'scan src directory and mark en as traget locale',
      )
      .example(
        "jinge-i18n extract --scan 'src/**/*.ts' 'src2/**/*.html' --locale en jp",
        'scan src and src2 directories and mark en and jp as traget locales',
      );
  })
  .command('generate', 'generate dictionary & metadata file', (yarg) => {
    yarg.usage('Usage: jinge-i18n generate [options]').option('inline-tag', {
      alias: 't',
      array: true,
      demandOption: false,
      describe: 'inline tags to do i18n concat',
    });
  })
  .demandCommand(1)
  .alias('version', 'v')
  .help()
  .alias('help', 'h').argv;

const inlineTags = Object.fromEntries(
  (arg.inlineTag || []).map((it) => {
    const ts = it.split(':');
    return [ts[0], { type: 'component', library: ts[1], component: ts[2] }];
  }),
);

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
    inlineTags,
  });
} else {
  require('../compiler/generate').generate({
    inlineTags,
  });
}
