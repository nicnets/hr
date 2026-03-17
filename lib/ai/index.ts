import OpenAI from 'openai';
import { getDb } from '@/lib/db';
import type { TaskSubmission } from '@/types';

// Initialize OpenAI client
function getOpenAIClient(): OpenAI | null {
  const db = getDb();
  const config = db.prepare('SELECT * FROM ai_config WHERE id = 1').get() as {
    api_key: string | null;
    model_name: string;
    is_enabled: boolean;
  } | undefined;

  if (!config?.api_key || !config.is_enabled) {
    return null;
  }

  return new OpenAI({
    apiKey: config.api_key,
  });
}

// Get AI config
export function getAIConfig() {
  const db = getDb();
  const config = db.prepare('SELECT * FROM ai_config WHERE id = 1').get() as {
    id: number;
    api_key: string | null;
    model_name: string;
    is_enabled: boolean;
    test_status: string | null;
    test_message: string | null;
    updated_at: string;
  } | undefined;

  if (!config) {
    // Create default config
    db.prepare(`
      INSERT INTO ai_config (id, model_name, is_enabled)
      VALUES (1, 'gpt-4o-mini', 0)
    `).run();
    return {
      id: 1,
      api_key: null,
      model_name: 'gpt-4o-mini',
      is_enabled: false,
      test_status: null,
      test_message: null,
      updated_at: new Date().toISOString(),
    };
  }

  return config;
}

// Update AI config
export function updateAIConfig(config: {
  api_key?: string;
  model_name?: string;
  is_enabled?: boolean;
}) {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM ai_config WHERE id = 1').get();

  if (!existing) {
    db.prepare(`
      INSERT INTO ai_config (id, api_key, model_name, is_enabled, updated_at)
      VALUES (1, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      config.api_key || null,
      config.model_name || 'gpt-4o-mini',
      config.is_enabled ? 1 : 0
    );
  } else {
    const updates: string[] = [];
    const params: (string | number | null)[] = [];

    if (config.api_key !== undefined) {
      updates.push('api_key = ?');
      params.push(config.api_key);
    }
    if (config.model_name !== undefined) {
      updates.push('model_name = ?');
      params.push(config.model_name);
    }
    if (config.is_enabled !== undefined) {
      updates.push('is_enabled = ?');
      params.push(config.is_enabled ? 1 : 0);
    }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      db.prepare(`
        UPDATE ai_config SET ${updates.join(', ')} WHERE id = 1
      `).run(...params);
    }
  }
}

// Test OpenAI connection
export async function testAIConnection(apiKey: string, modelName: string): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const client = new OpenAI({ apiKey });
    
    // Make a minimal test request
    const response = await client.chat.completions.create({
      model: modelName,
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 5,
    });

    if (response.choices.length > 0) {
      return {
        success: true,
        message: 'Connection successful. API key is valid.',
      };
    }

    return {
      success: false,
      message: 'No response from model.',
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Failed to connect to OpenAI API.',
    };
  }
}

// Update test status
export function updateAITestStatus(status: string, message: string) {
  const db = getDb();
  db.prepare(`
    UPDATE ai_config 
    SET test_status = ?, test_message = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = 1
  `).run(status, message);
}

// Analyze task submission using OpenAI
export async function analyzeTaskSubmission(
  taskTitle: string,
  taskDescription: string,
  submission: TaskSubmission
): Promise<{
  score: number;
  task_understanding: number;
  work_authenticity: number;
  output_validity: number;
  effort_reasonableness: number;
  difficulty_consistency: number;
  risk_flags: string[];
  decision: 'approved' | 'needs_review' | 'rejected';
  analysis_summary: string;
} | null> {
  const client = getOpenAIClient();
  if (!client) {
    return null;
  }

  const db = getDb();
  const config = db.prepare('SELECT model_name FROM ai_config WHERE id = 1').get() as {
    model_name: string;
  };

  const prompt = `You are an internal task audit agent responsible for evaluating employee task submissions.

Your goal is to determine whether the employee's responses reasonably indicate that the task was completed and whether the reported effort appears realistic.

You must analyze the responses critically but fairly.

INPUT

Task Title:
${taskTitle}

Task Description:
${taskDescription}

Work Summary:
${submission.work_summary}

Task Objective:
${submission.task_objective}

Final Outcome:
${submission.final_outcome}

Scope Change:
${submission.scope_change}

Output Type:
${submission.output_type}

Output Description:
${submission.output_description}

Time Spent:
${submission.time_spent}

Difficulty Level:
${submission.difficulty_level}

Confidence Level:
${submission.confidence_level}

EVALUATION CRITERIA

Evaluate the submission using the following criteria.

1. Task Understanding (0-25 points)
   Determine whether the employee clearly understands the task based on the summary and objective.

2. Work Authenticity (0-20 points)
   Check whether the explanation appears genuine and detailed rather than vague or generic.

Generic responses include:
- Very short explanations
- Repetition of the task description
- No specific actions described
- Statements like "completed the task successfully"

3. Output Validity (0-25 points)
   Check whether the described output logically matches the task description.

4. Effort Reasonableness (0-20 points)
   Estimate the typical complexity of the task and compare with the reported time.

Use the following reference ranges:
Very Small Task: 5–30 minutes
Small Task: 30–120 minutes
Medium Task: 2–6 hours
Large Task: 6–12 hours
Very Large Task: Multi-day

If the reported time is far outside what would normally be expected, flag it.

5. Difficulty Consistency (0-10 points)
   Check whether the reported difficulty aligns with the description and time spent.

Maximum Score: 100

RISK FLAGS

Add risk flags when any of the following occur:
- Vague or generic explanations
- Output does not match the task
- Unrealistic time for the task
- Difficulty level inconsistent with the work described
- Scope change declared but no explanation implied

DECISION RULES
Score >= 80: Approve
Score 60–79: Needs Review
Score < 60: Reject

RESPONSE FORMAT
Respond ONLY with a valid JSON object in this exact format (no markdown, no code blocks):
{
  "score": number,
  "task_understanding": number,
  "work_authenticity": number,
  "output_validity": number,
  "effort_reasonableness": number,
  "difficulty_consistency": number,
  "risk_flags": ["flag1", "flag2"],
  "decision": "approved|needs_review|rejected",
  "analysis_summary": "Brief explanation of the decision"
}`;

  try {
    const response = await client.chat.completions.create({
      model: config?.model_name || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return null;
    }

    // Parse JSON response
    const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
    const result = JSON.parse(cleanContent);

    return {
      score: result.score || 0,
      task_understanding: result.task_understanding || 0,
      work_authenticity: result.work_authenticity || 0,
      output_validity: result.output_validity || 0,
      effort_reasonableness: result.effort_reasonableness || 0,
      difficulty_consistency: result.difficulty_consistency || 0,
      risk_flags: result.risk_flags || [],
      decision: result.decision || 'needs_review',
      analysis_summary: result.analysis_summary || '',
    };
  } catch (error) {
    console.error('AI Analysis error:', error);
    return null;
  }
}

// Save AI analysis result
export function saveAIAnalysis(
  taskId: number,
  submissionId: number,
  userId: number,
  analysis: {
    score: number;
    task_understanding: number;
    work_authenticity: number;
    output_validity: number;
    effort_reasonableness: number;
    difficulty_consistency: number;
    risk_flags: string[];
    decision: 'approved' | 'needs_review' | 'rejected';
    analysis_summary: string;
  }
) {
  const db = getDb();
  
  // Check if analysis already exists
  const existing = db.prepare('SELECT id FROM task_ai_analysis WHERE submission_id = ?').get(submissionId);
  
  if (existing) {
    db.prepare(`
      UPDATE task_ai_analysis
      SET score = ?, task_understanding = ?, work_authenticity = ?, output_validity = ?,
          effort_reasonableness = ?, difficulty_consistency = ?, risk_flags = ?, decision = ?,
          analysis_summary = ?, analyzed_at = CURRENT_TIMESTAMP, notification_sent = 0
      WHERE submission_id = ?
    `).run(
      analysis.score,
      analysis.task_understanding,
      analysis.work_authenticity,
      analysis.output_validity,
      analysis.effort_reasonableness,
      analysis.difficulty_consistency,
      JSON.stringify(analysis.risk_flags),
      analysis.decision,
      analysis.analysis_summary,
      submissionId
    );
  } else {
    db.prepare(`
      INSERT INTO task_ai_analysis 
      (task_id, submission_id, user_id, score, task_understanding, work_authenticity, 
       output_validity, effort_reasonableness, difficulty_consistency, risk_flags, decision, analysis_summary)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      taskId,
      submissionId,
      userId,
      analysis.score,
      analysis.task_understanding,
      analysis.work_authenticity,
      analysis.output_validity,
      analysis.effort_reasonableness,
      analysis.difficulty_consistency,
      JSON.stringify(analysis.risk_flags),
      analysis.decision,
      analysis.analysis_summary
    );
  }
}
