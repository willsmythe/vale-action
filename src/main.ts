import * as core from '@actions/core';
import * as tmp from 'tmp';

import execa = require('execa');

import * as input from './input';

/**
 * These environment variables are exposed for GitHub Actions.
 *
 * See https://bit.ly/2WlFUD7 for more information.
 */
const {GITHUB_TOKEN, GITHUB_WORKSPACE} = process.env;

export async function run(actionInput: input.Input): Promise<void> {
  const alertResp = await execa('vale', actionInput.args  );
  // NOTE: GitHub Actions currently only support 'warning' and 'error', so we
  // convert 'suggestion' to 'warning'.
  //
  // TODO: Is there a better way to handle this?
  var converted = alertResp.stdout.replace(/suggestion/g, 'warning');
  if (converted.length == 0) {
    converted = alertResp.stderr.replace(/suggestion/g, 'warning');
  }
  core.info(converted);
}

async function main(): Promise<void> {
  try {
    const userToken = GITHUB_TOKEN as string;
    const workspace = GITHUB_WORKSPACE as string;

    const tmpobj = tmp.fileSync({postfix: '.ini', dir: workspace});
    const actionInput = await input.get(tmpobj, userToken, workspace);

    await run(actionInput);

    tmpobj.removeCallback();
  } catch (error) {
    core.setFailed(error.message);
  }
}

main();
