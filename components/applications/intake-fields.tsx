"use client";

import type { IntakeQuestion, ProfileValues, QuestionAnswers } from "@/lib/intake";

const input = "mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 read-only:bg-slate-50";
const labels: Record<string, string> = { name: "Full name", first_name: "First name", last_name: "Last name", email: "Email address", phone: "Phone", headline: "Headline", city: "City", country: "Country", location: "Location", summary: "About you", linkedin_url: "LinkedIn URL", portfolio_url: "Portfolio URL", education: "Education", experience: "Experience" };
const repeat: Record<string, string[]> = { education: ["institution", "degree", "field_of_study", "start_date", "end_date", "description"], experience: ["company", "title", "start_date", "end_date", "description"] };
const title = (value: string) => value.replaceAll("_", " ").replace(/^./, char => char.toUpperCase());

export function ProfileFields({ fields, value, onChange, verifiedEmail }: { fields: Record<string, boolean> | null; value: ProfileValues; onChange: (value: ProfileValues) => void; verifiedEmail: string }) {
  const required = fields?.name ? ["name", "email"] : ["first_name", "last_name", "email"];
  const keys = [...new Set([...required, ...Object.keys(fields ?? {}).filter(key => fields?.[key])])].filter(key => key in labels);
  return <div className="space-y-5"><div className="grid gap-5 sm:grid-cols-2">{keys.filter(key => !repeat[key]).map(key => <label key={key} className={`block text-sm font-semibold text-slate-600 ${key === "summary" ? "sm:col-span-2" : ""}`}>
    {labels[key]} {required.includes(key) ? <span className="text-brand-600">*</span> : <span className="text-xs font-normal text-slate-400">(optional)</span>}
    {key === "summary" ? <textarea className={input} rows={4} maxLength={10000} value={String(value[key] ?? "")} onChange={event => onChange({ ...value, [key]: event.target.value })} />
      : <input className={input} type={key === "email" ? "email" : key.endsWith("_url") ? "url" : key === "phone" ? "tel" : "text"} autoComplete={({ first_name: "given-name", last_name: "family-name", name: "name", email: "email", phone: "tel" } as Record<string, string>)[key]} readOnly={key === "email"} required={required.includes(key)} maxLength={key.endsWith("_url") ? 2048 : key === "phone" ? 50 : ["first_name", "last_name", "city", "country"].includes(key) ? 100 : 255} value={key === "email" ? verifiedEmail : String(value[key] ?? "")} onChange={event => onChange({ ...value, [key]: event.target.value })} />}
  </label>)}</div>
    {keys.filter(key => repeat[key]).map(key => {
      const entries = Array.isArray(value[key]) ? value[key] : [];
      return <section key={key} className="rounded-xl border border-slate-200 p-4"><h3 className="text-sm font-semibold text-slate-700">{labels[key]} <span className="text-xs font-normal text-slate-400">(optional)</span></h3>
        {entries.map((entry, index) => <div key={index} className="mt-4 rounded-xl bg-slate-50 p-4"><div className="grid gap-4 sm:grid-cols-2">{repeat[key].map(field => <label key={field} className="text-xs font-medium text-slate-600">{title(field)}<input className={input} type={field.endsWith("_date") ? "date" : "text"} value={entry[field] ?? ""} onChange={event => onChange({ ...value, [key]: entries.map((row, i) => i === index ? { ...row, [field]: event.target.value } : row) })} /></label>)}</div><button type="button" className="mt-4 text-xs font-semibold text-rose-600" onClick={() => onChange({ ...value, [key]: entries.filter((_, i) => i !== index) })}>Remove {labels[key].toLowerCase()} entry {index + 1}</button></div>)}
        <button type="button" disabled={entries.length >= 50} className="mt-4 text-sm font-semibold text-brand-600 disabled:opacity-40" onClick={() => onChange({ ...value, [key]: [...entries, {}] })}>+ Add {labels[key].toLowerCase()}</button>
      </section>;
    })}
  </div>;
}

export function QuestionFields({ questions, value, onChange }: { questions: IntakeQuestion[]; value: QuestionAnswers; onChange: (value: QuestionAnswers) => void }) {
  return <div className="space-y-5">{questions.map(question => <label key={question.key} className="block text-sm font-semibold leading-6 text-slate-700">{question.label} {question.required ? <span className="text-brand-600">*</span> : <span className="text-xs font-normal text-slate-400">(optional)</span>}
    {question.type === "yes_no" ? <select className={input} required={question.required} value={value[question.key] === true ? "yes" : value[question.key] === false ? "no" : ""} onChange={event => onChange({ ...value, [question.key]: event.target.value === "" ? null : event.target.value === "yes" })}><option value="">Select an answer</option><option value="yes">Yes</option><option value="no">No</option></select>
      : <textarea className={input} rows={3} required={question.required} maxLength={10000} value={String(value[question.key] ?? "")} onChange={event => onChange({ ...value, [question.key]: event.target.value })} />}
  </label>)}</div>;
}
