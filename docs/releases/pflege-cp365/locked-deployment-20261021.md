# Deploy current Pflege implementation without activation

User authorization: deploy the complete current Pflege implementation; do not unlock the module. Production data migrations and clinical feature activation are separate from shipping the web source.

## Release source

CP365 integration and medication staging changes through 7e65460f, merged with main 183f8b5b (2027 intake, consultation and Academy changes preserved). Intake validator conflicts use the current main source and matching generated Edge runtime.

The prepared Pflege intake hook is preserved at `src/hooks/pflege/useCareClientIntakeWizard.web.ts`. The generic Web hook forwards explicitly to the current shared Office hook; this prevents the prepared RPC workflow from replacing productive Office intake by platform-file resolution. No Pflege route is unlocked by this change.

## Verification

- Global `UNRELEASED_MODULE_KEYS` still includes Pflege.
- 73 targeted Node assertions passed: 68 medication lifecycle checks plus five locked-deployment/Office-hook boundary checks, including web/native and consultation-release variants.
- 7e65460f full Vercel web preview build reached READY. The merged release requires a separate Vercel build; its final result must be verified before reporting deployment complete.
- Older CP365 intake source-loader checks do not all match the current refactored Office intake exports/UI. Their initial attempts also encountered sparse-checkout omissions. These attempts are not recorded as successful release evidence. Current official release gates remain in `build:web:production`.
- Direct Vercel deployment/log API requests currently return 403 for the connected team. Git integration remains available. No API privilege or application access setting was changed.

## Remains locked

Pflege access, prepared clinical writers and quarantined Staging functions stay locked. No production clinical migrations, clinical approval or native Android release are included. Production build success would establish source deployment only, not acceptance of the unfinished workflows.
