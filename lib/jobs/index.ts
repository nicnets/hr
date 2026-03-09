import { processAutoClockOut } from './attendance';
import { processDailyAttendance, processApprovedExceptions, generateDailySummary } from './attendance';

export {
  processAutoClockOut,
  processDailyAttendance,
  processApprovedExceptions,
  generateDailySummary,
};

/**
 * Run all daily jobs manually (for testing or manual trigger)
 */
export async function runAllJobs() {
  console.log('Running all daily jobs...');
  
  // 1. Process auto clock-outs (6:05 PM)
  const autoClockOut = await processAutoClockOut();
  console.log('Auto clock-out:', autoClockOut);
  
  // 2. Process approved exceptions (6:30 PM)
  const exceptions = await processApprovedExceptions();
  console.log('Processed exceptions:', exceptions);
  
  // 3. Process daily attendance with penalties (11:55 PM)
  const dailyAttendance = await processDailyAttendance();
  console.log('Daily attendance:', dailyAttendance);
  
  // 4. Generate summary (11:59 PM)
  const summary = await generateDailySummary();
  console.log('Daily summary:', summary);
  
  return {
    autoClockOut,
    exceptions,
    dailyAttendance,
    summary,
  };
}
