# Medication verification readiness — 2026-10-22

## Current build repair: edac077f

Subsequent supplied logs for `edac077f` and `4f84bf1` confirm that the Vital inference error disappeared but reveal two remaining `TS2684` generic `Function.call` errors in the permission readers. Their next correction explicitly instantiates the captured RPC with the loop's exact identity-function name union before calling it. This preserves the original function identity, receiver and SDK argument default without casts or type suppression. Independent review checked that expression against the locked SDK signature; the 190 targeted permission checks passed again. The earlier repair was therefore not a successful full TypeScript build. The next remote build must confirm this additional correction and any subsequently reconstructed code.

The supplied Vercel logs for `9cec6f7`, `384f71e` and `5b1be35` all reached the project TypeScript check and reported the same three errors. Commit `edac077f80663679e6eae77457f24ba3376f55a4` adds the missing generated `resolve_current_profile_id` signature, calls the two argumentless identity RPCs without an explicit argument object, and explicitly types the generic Vital history page. The resolver's zero-argument UUID signature was independently checked against Staging; no resolver or clinical authorization semantics changed.

The targeted permission selection passed 190 checks, the Vital selection passed 494, and the care-documentation/authority selection passed 322. These selections are not added together. A separate fixed checkout containing this code and the corrected SDK-default test wrapper passed the complete existing Node glob: **13,958 passed, zero failed or skipped**. The wrapper models the SDK's empty default arguments while retaining its exact-empty-argument assertions and separation from clinical writes. This result does not cover subsequent reconstructed BasicCare or Nutrition candidates.

Vercel started new builds for `edac077f`. Their observed statuses are mixed; no successful complete production verification chain, Web type-check result, Expo export or deployed acceptance is claimed. The actual team build-log connection remains unavailable with HTTP 403. Historical successful status labels below are dated snapshots and do not supersede these current limits. Pflege remains locked, the PR remains a draft, and no production migration, promotion or activation was performed.

## Available verification

The strict verifier runs existing medication Node checks, the shared clinical workspace-authority checks when present, and the locked-deployment checks. The latter were previously outside the medication filename filter. It also inventories the five existing project-level medication and unreleased-module Vitest suites and checks every archive Edge TypeScript file for syntax.

The report explicitly distinguishes local automated-check completion from release acceptance. It never installs tools or fetches Edge dependencies. Default exit code 2 means required automated checks were not run; exit code 1 means an executed check failed. The explicit development option `--allow-incomplete` does not change `complete:false` in its report.

On the clean baseline commit `009347b4c94fcf23dd759b1b16061c6ccd67436a`, 854 medication Node checks plus five locked-deployment checks passed: 859 checks in total. All five Edge files passed Node syntax checks. The default verifier returned exit code 2. This baseline result does not attest to later uncommitted changes being developed in the shared workspace.

The five tracked Vitest test sources have been materialized in the existing checkout. Their runner is absent, so these suites remain unexecuted:

- src/__tests__/modules/unreleasedModulesGlobalLock.test.ts
- src/__tests__/navigation/unreleasedModulesVisibilityLock.test.ts
- src/__tests__/pflege/liveMedicationAmbulatoryIntensive.test.ts
- src/__tests__/pflege/medicationAdministrationDatabase.test.ts
- src/__tests__/pflege/medicationAdministrationDomain.test.ts

No TypeScript compiler, Deno, esbuild, React/ReactDOM or Babel compiler was found in the project or existing primary runtime dependency tree. The Playwright package is available, but its Chromium, Firefox and WebKit executable paths do not exist, and no system browser executable was found. This establishes the local-tool limitation only; it is not a claim about every connected browser surface.

## Existing remote build evidence

### Current PR 155 / commit d952138c

The [sanitized build manifest](../../audit/pflege-d952-build-evidence-20261022.json) records the exact commit `d952138cb6cb7a5fc54f60bd2785805aa8ef11f3`, source queries, observed project IDs, deployment URLs and access failure. This is a snapshot of the published PR head, not evidence for later uncommitted changes.

The Vercel bot and GitHub statuses reported:

| Project | Observed deployment status | Latest reported completion |
| --- | --- | --- |
| [caresuiteplus](https://vercel.com/caresuiteapps-projects/caresuiteplus/C5Xojukh39VW7FDFuyAxt2Q9Hb4Q) | Ready | 2026-10-22 06:43:14 UTC |
| [caresuiteplus-app](https://vercel.com/caresuiteapps-projects/caresuiteplus-app/4LAtKCEC9yLggv7jZ81HavcRnvST) | Building / pending | No completion reported |
| [caresuiteplusapp](https://vercel.com/caresuiteapps-projects/caresuiteplusapp/7SzUevDk127VFRGF68WgDwBUtiPv) | Ready | 2026-10-22 05:45:00 UTC |
| [repository](https://vercel.com/caresuiteapps-projects/repository/CKEUssd8bRTiLLCZQRFTikeaLHKY) | Ready | 2026-10-22 05:45:08 UTC |

The GitHub Netlify success context explicitly describes this commit's preview as canceled. Its three associated check runs are neutral with title `Deploy canceled`. [Exact deploy metadata](https://api.netlify.com/api/v1/deploys/6ad99f6de7890a3cd46779c6) reports `state: error`, build ID `6ad99f6de7890a3cd46779c4`, no error message and no publication timestamp. It establishes no successful application build.

The all-event GitHub Actions query for this exact SHA returned zero runs. The five check runs consist of Vercel feedback status, three canceled Netlify checks and a skipped Supabase preview; none supplies a compiler log. The sole tracked Actions workflow builds the native Android AAB and was not triggered for this Web task.

A direct lookup of the observed `caresuiteplus-app` project in the PR's actual team returned HTTP 403 for `caresuiteapps-projects` / `team_WGwttaoveTwuQPQQLBxozmit`. No team-list retry was made. The API advertises `authorize_team_access` / `authorize_team_sso` as recovery, but neither tool is available in the current registry and no existing Vercel CLI executable was found. Actual build commands, logs and Web type-check completion could not be inspected. Current deployment statuses therefore remain separate from a verified full compiler/build result. No authentication, deployment, promotion, project-setting or CI change was performed.

Fresh PR REST metadata reports `mergeable: true`, `rebaseable: true`, `mergeable_state: unstable` and `draft: true` for head `d952138c` and base `665f0ff5`. The earlier normalized `mergeable: false` was not reproduced: a local `git merge-tree --write-tree` calculation for those exact full SHAs exited 0 with tree `9681f78457546ebe1fd727d7801cc80e9b4a38d2` and no conflicts. No merge or rebase was performed. Pending checks and draft state remain; merge permission was not tested.

### Historical baseline 009347b4

The exact baseline commit has no pull-request GitHub Actions run.

The GitHub Netlify status reported success for deploy `6ad993a16d0829abd550f918`. The [read-only Netlify deploy metadata](https://api.netlify.com/api/v1/deploys/6ad993a16d0829abd550f918) reports `state: error` for the exact baseline commit and preview branch, with build ID `6ad993a16d0829abd550f916`, created at 04:40:01 UTC and updated at 04:40:14 UTC. The metadata provides no error message. The separate build endpoint requires authentication and returned HTTP 401, so its build log was not obtained. The GitHub success context therefore does not prove a successful application build or type check.

The tracked Netlify build configuration runs `npm ci && npx expo export --platform web` and has a commit-message ignore rule. It does not invoke the repository's production verification chain. No conclusion about the actual failed build command is drawn without its log.

A Vercel context for caresuiteplusapp eventually reported success, while the other contexts remained pending at inspection. A read of that observed deployment UID returned the existing team-scope HTTP 403. No scope-list retry, authentication change, deployment or project-setting change was attempted. Status alone does not prove which build command or verification steps ran.

## Acceptance still required

Full Web type checking, Edge type checking, the five existing Vitest suites, actual browser layout/interaction, deployed Auth/Storage/Edge HTTP acceptance and real simultaneous database transaction acceptance remain distinct evidence gaps. The Web tsconfig explicitly excludes `supabase/functions`, so even a successful Web type check would not cover the worker.

Staging SQL rollback fixtures and in-memory transport checks provide separate evidence described in the implementation notes. They do not establish production activation, medical acceptance or whole-module completion. Pflege remains globally locked.
