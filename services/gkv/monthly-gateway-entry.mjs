// Build input only. The checked-in .mjs API bundle is the Vercel entry point.
import {createMonthlyHostHandler} from '../../api/_lib/monthly-host-handler.mjs';
export default createMonthlyHostHandler({env:process.env});
