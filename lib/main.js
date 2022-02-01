"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = void 0;
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const exec = __importStar(require("@actions/exec"));
const tmp = __importStar(require("tmp"));
const check_1 = require("./check");
const input = __importStar(require("./input"));
/**
 * These environment variables are exposed for GitHub Actions.
 *
 * See https://bit.ly/2WlFUD7 for more information.
 */
const { GITHUB_TOKEN, GITHUB_WORKSPACE } = process.env;
function run(actionInput) {
    return __awaiter(this, void 0, void 0, function* () {
        let stdout = '', stderr = '';
        try {
            const onlyAnnotateModifiedLines = core.getBooleanInput('onlyAnnotateModifiedLines');
            const reportStatusInRun = core.getBooleanInput('reportStatusInRun');
            const startedAt = new Date().toISOString();
            yield exec.exec('vale', actionInput.args, {
                listeners: {
                    stdout: (data) => { stdout += data; },
                    stderr: (data) => { stderr += data; }
                }
            });
            const runner = new check_1.CheckRunner(actionInput.files, stdout, onlyAnnotateModifiedLines);
            if (reportStatusInRun) {
                const annotations = runner.getAnnotations();
                // Post annotations for each alert using Actions workflow commands
                for (const annotation of annotations) {
                    const props = check_1.toAnnotationProperties(annotation);
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
            }
            else {
                let sha = github.context.sha;
                if (github.context.payload.pull_request) {
                    sha = github.context.payload.pull_request.head.sha;
                }
                yield runner.executeCheck({
                    token: actionInput.token,
                    name: 'Vale',
                    owner: github.context.repo.owner,
                    repo: github.context.repo.repo,
                    head_sha: sha,
                    started_at: startedAt,
                    context: { vale: actionInput.version }
                });
            }
        }
        catch (error) {
            if (error instanceof Error) {
                core.setFailed(error);
            }
            else {
                core.setFailed(stderr);
            }
        }
    });
}
exports.run = run;
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const userToken = GITHUB_TOKEN;
            const workspace = GITHUB_WORKSPACE;
            const tmpobj = tmp.fileSync({ postfix: '.ini', dir: workspace });
            const actionInput = yield input.get(tmpobj, userToken, workspace);
            yield run(actionInput);
            tmpobj.removeCallback();
        }
        catch (error) {
            if (error instanceof Error) {
                core.setFailed(error.message);
            }
            else {
                core.setFailed('Unknown error.');
            }
        }
    });
}
main();
