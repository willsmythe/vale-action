import * as core from '@actions/core';
import * as github from '@actions/github';
import * as exec from '@actions/exec';
import * as tmp from 'tmp';

import {CheckRunner, toAnnotationProperties} from './check';
import * as input from './input';

/**
 * These environment variables are exposed for GitHub Actions.
 *
 * See https://bit.ly/2WlFUD7 for more information.
 */
const {GITHUB_TOKEN, GITHUB_WORKSPACE} = process.env;

export async function run(actionInput: input.Input): Promise<void> {
  let stdout = '', stderr = ''; 
  try {
    const onlyAnnotateModifiedLines = core.getBooleanInput('onlyAnnotateModifiedLines');
    const reportStatusInRun = core.getBooleanInput('reportStatusInRun');

    const startedAt = new Date().toISOString();

    await exec.exec('vale',
      actionInput.args, {
      listeners: {
        stdout: (data) => { stdout += data },
        stderr: (data) => { stderr += data }    
      }
    });

    const runner = new CheckRunner(
      actionInput.files,
      stdout,
      onlyAnnotateModifiedLines
    );

    if (reportStatusInRun) {
      const annotations = runner.getAnnotations();
      // Post annotations for each alert using Actions workflow commands
      for (const annotation of annotations) {
        const props = toAnnotationProperties(annotation);
        switch (annotation.annotation_level) {
          case 'failure':
            core.error(annotation.message, props);
            break;
          case 'warning':
            core.warning(annotation.message, props);
            break;
          default:
            core.notice(annotation.message, props);
        }
      }

      // If any errors were found, fail the action, which will fail the job (unless continue-on-error is true for the step)
      if (runner.anyErrors()) {
        core.setFailed('Failed due to one or more errors.');
      }
    } else {
      let sha = github.context.sha;
      if (github.context.payload.pull_request) {
        sha = github.context.payload.pull_request.head.sha;
      }

      await runner.executeCheck({
        token: actionInput.token,
        name: 'Vale',
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        head_sha: sha,
        started_at: startedAt,
        context: {vale: actionInput.version}
      });
    }    
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error);
    } else {
      core.setFailed(stderr);
    }
  }
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
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('Unknown error.');
    }
  }
}

main();
