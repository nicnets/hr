import { processAutoClockOut } from './attendance';
import { processDailyAttendance, processApprovedExceptions, generateDailySummary } from './attendance';
import { 
  processRecurringTasks, 
  processAIAnalysis, 
  checkAttendanceViolations,
  getPendingAIAnalysisCount,
  getRecentAIAnalysis
} from './tasks';

export {
  processAutoClockOut,
  processDailyAttendance,
  processApprovedExceptions,
  generateDailySummary,
  processRecurringTasks,
  processAIAnalysis,
  checkAttendanceViolations,
  getPendingAIAnalysisCount,
  getRecentAIAnalysis,
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
  
  // 4. Process recurring task assignments (04:00 AM)
  const recurringTasks = await processRecurringTasks();
  console.log('Recurring tasks assigned:', recurringTasks);
  
  // 5. Process AI analysis (11:00 PM)
  const aiAnalysis = await processAIAnalysis();
  console.log('AI analysis:', aiAnalysis);
  
  // 6. Check attendance violations
  const violations = await checkAttendanceViolations();
  console.log('Attendance violations:', violations);
  
  // 7. Generate summary (11:59 PM)
  const summary = await generateDailySummary();
  console.log('Daily summary:', summary);
  
  return {
    autoClockOut,
    exceptions,
    dailyAttendance,
    recurringTasks,
    aiAnalysis,
    violations,
    summary,
  };
}
