/** Each actual Web fetcher invocation, including a timeout retry, owns one opaque attempt. */
export type CareAssessmentQueryAttempt=symbol;
export function createCareAssessmentQueryAttempt():CareAssessmentQueryAttempt{return Symbol('care-assessment-query-attempt');}
/** Timing out an existing request does not cancel it. Its later result must not publish over a newer attempt. */
export function assertCareAssessmentQueryAttempt(current:CareAssessmentQueryAttempt|null,captured:CareAssessmentQueryAttempt):void{
 if(current!==captured)throw Error('Dieser Pflegeplan-Leseversuch wurde durch einen neueren Leseversuch oder einen anderen Lesekontext abgelöst. Pflegeplan bitte erneut laden.');
}
/** Old retry closures may still execute after read access is restored. Bind them to their original render lifetime before starting any new request. */
export function assertCareAssessmentQueryLifetime(current:symbol|null,captured:symbol|null):void{
 if(!captured||current!==captured)throw Error('Der ursprüngliche Pflegeplan-Lesekontext dieses Leseversuchs wurde abgelöst. Pflegeplan bitte erneut laden.');
}
