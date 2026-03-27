import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { GET as getSystemStatus } from '../../system-status/route';

const REPORTS_DIR = path.resolve(process.cwd(), '..', 'backend', 'services', 'admin_reports');

if (!fsSync.existsSync(REPORTS_DIR)) {
  fsSync.mkdirSync(REPORTS_DIR, { recursive: true });
}

export async function POST(req: Request) {
  try {
    const { mode } = await req.json().catch(() => ({ mode: 'fast' })); // fast or deep

    const latestPath = path.join(REPORTS_DIR, 'latest_ai_repair.md');
    
    // Caching Strategy: Check if latest < 3 minutes old
    if (fsSync.existsSync(latestPath)) {
      const stat = fsSync.statSync(latestPath);
      const ageMinutes = (Date.now() - stat.mtimeMs) / 1000 / 60;
      if (ageMinutes < 3) {
        const cached = await fs.readFile(latestPath, 'utf8');
        return NextResponse.json({ 
           markdown: cached, 
           source: 'cache',
           message: `Returned cached report (generated ${Math.round(ageMinutes)} min ago)` 
        });
      }
    }

    // 1. Fetch system payload
    const sysRes = await getSystemStatus();
    // Next.js Route Handlers return NextResponse, we can read the json payload
    const payload = await sysRes.json();
    
    // Convert necessary payload parts to readable text for AI to save tokens
    const minPayload = {
      system: payload.system,
      failed_red: payload.modules.filter((m: any) => m.status === 'RED'),
      delayed_yellow: payload.modules.filter((m: any) => m.status === 'YELLOW'),
      errors: payload.errors
    };

    const prompt = `
You are a senior system reliability engineer.
Analyze the system state and produce a structured maintenance report.

STRICT RULES:
- No speculation beyond given data
- No trading advice
- Focus on root cause, impact, and repair steps
- Output in clean markdown
- Do not assume missing data
- Only use given facts
- If unsure, say "unknown"

OUTPUT FORMAT:
## 🔴 System Diagnosis
[brief summary]

## Root Cause
[identified root causes based on RED/YELLOW states]

## Impact Scope
[downstream impact analysis]

## 🛠 Recommended Actions (Step-by-step)
[numbered actionable steps]

## ⚠ Notes
[any extra observations]

MODE: ${mode === 'deep' ? 'Detailed analysis with deep dive step-by-step.' : 'Fast, concise summary.'}

DATA:
${JSON.stringify(minPayload, null, 2)}
`;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ 
        error: "OPENAI_API_KEY not found in environment." 
      }, { status: 500 });
    }

    // Call OpenAI natively
    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an SRE AI diagnostic agent.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1
      })
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      throw new Error(`OpenAI API Error: ${errText}`);
    }

    const aiData = await aiRes.json();
    const markdownResult = aiData.choices[0].message.content;

    // Save as timestamp
    const now = new Date();
    // YYYYMMDD_HHMM
    const ts = now.toISOString().replace(/[-T:]/g,'').slice(0, 12); 
    const filename = `ai_repair_${ts}.md`;
    const fullPath = path.join(REPORTS_DIR, filename);

    await fs.writeFile(fullPath, markdownResult);
    // Overwrite latest
    await fs.writeFile(latestPath, markdownResult);

    return NextResponse.json({
       markdown: markdownResult,
       file: filename,
       source: 'api'
    });

  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
