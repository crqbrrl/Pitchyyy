export type Verdict = "HARD PASS" | "SKEPTICAL" | "INTRIGUED" | "EXCITED" | "ALL IN";

export interface VCReaction {
  vcName: string;
  verdict: Verdict;
  summary: string;
  scores: { label: string; score: number }[];
  pros: string[];
  cons: string[];
  toughQuestion: string;
  tailoringTips: string[];
  error?: string;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export async function analyzePitch(vcName: string, pitch: string): Promise<VCReaction> {
  const data = await postJson<Partial<VCReaction> & { error?: string }>("/api/analyze", {
    vcName,
    pitch,
  });

  if (data.error) throw new Error(data.error);

  const scores = data.scores ?? [];
  const average = scores.length > 0
    ? scores.reduce((acc, s) => acc + s.score, 0) / scores.length
    : 0;

  let verdict: Verdict = "HARD PASS";
  if (average >= 9) verdict = "ALL IN";
  else if (average >= 7) verdict = "EXCITED";
  else if (average >= 5) verdict = "INTRIGUED";
  else if (average >= 3) verdict = "SKEPTICAL";

  return { ...(data as VCReaction), verdict };
}

export async function extractPitchFromImage(base64Image: string, mimeType: string): Promise<string> {
  const data = await postJson<{ pitch?: string }>("/api/extract", {
    image: base64Image,
    mimeType,
  });
  return data.pitch ?? "";
}
