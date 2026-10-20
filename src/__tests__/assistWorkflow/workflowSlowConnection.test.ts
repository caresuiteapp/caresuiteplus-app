
import {afterEach,expect,it,vi} from 'vitest';
import {withWorkflowTimeout,WorkflowActionTimeoutError} from '@/features/assistWorkflow/internal/withWorkflowTimeout';
afterEach(()=>vi.useRealTimers());
it('accepts a thirty-second server reply within the normal action budget',async()=>{
 vi.useFakeTimers(); let resolve!: (v:string)=>void;
 const operation=new Promise<string>(r=>{resolve=r}); const result=withWorkflowTimeout(operation);
 await vi.advanceTimersByTimeAsync(30000); resolve('stored');
 expect(await result).toBe('stored'); expect(vi.getTimerCount()).toBe(0);
});
it('a confirmation timeout never cancels the underlying write',async()=>{
 vi.useFakeTimers(); let resolve!: (v:string)=>void;
 const operation=new Promise<string>(r=>{resolve=r}); const late=vi.fn(); void operation.then(late);
 const result=withWorkflowTimeout(operation,60000).catch(e=>e);
 await vi.advanceTimersByTimeAsync(60000); expect(await result).toBeInstanceOf(WorkflowActionTimeoutError);
 expect(late).not.toHaveBeenCalled(); resolve('confirmed'); await Promise.resolve();
 expect(late).toHaveBeenCalledExactlyOnceWith('confirmed'); expect(await operation).toBe('confirmed');
});
