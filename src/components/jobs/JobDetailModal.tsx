"use client";

import React, { useState, useEffect } from "react";
import { 
  X, 
  Building2, 
  MapPin, 
  Banknote, 
  Clock, 
  ExternalLink, 
  ShieldCheck, 
  Briefcase, 
  AlertTriangle,
  History,
  CheckCircle2,
  ChevronDown,
  Layers,
  Sparkles
} from "lucide-react";
import { Job, JobAuditLog } from "@/lib/types";
import { RankingEngine } from "@/lib/scoring/ranking";

interface JobDetailModalProps {
  job: Job | null;
  onClose: () => void;
  onOpenReport: (job: Job) => void;
}

export const JobDetailModal: React.FC<JobDetailModalProps> = ({
  job,
  onClose,
  onOpenReport
}) => {
  const [auditLogs, setAuditLogs] = useState<JobAuditLog[]>([]);
  const [duplicates, setDuplicates] = useState<Job[]>([]);
  const [showAudit, setShowAudit] = useState(false);
  const [loadingExtras, setLoadingExtras] = useState(false);

  useEffect(() => {
    if (!job) return;
    setLoadingExtras(true);
    fetch(`/api/jobs/${job.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.auditLogs) setAuditLogs(data.auditLogs);
        if (data.duplicates) setDuplicates(data.duplicates);
      })
      .catch(console.error)
      .finally(() => setLoadingExtras(false));
  }, [job]);

  if (!job) return null;

  const explanation = RankingEngine.explainRanking(
    job.overall_confidence,
    job.distance_km,
    job.last_verified_at,
    job.remote
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 flex items-start justify-between gap-4 bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-emerald-700 bg-emerald-100/70 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>{job.source_id.toUpperCase()}</span>
              </span>
              <span className="text-xs font-medium text-slate-500 bg-white border border-slate-200 px-2.5 py-0.5 rounded-full">
                {explanation.summaryBadge}
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 leading-snug">{job.title}</h2>
            <div className="flex items-center gap-2 text-sm text-slate-600 mt-1.5 font-medium">
              <Building2 className="w-4 h-4 text-slate-400" />
              <span>{job.company_name}</span>
              {job.company_verified && (
                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 font-semibold">Verified Employer</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm text-slate-700">
          
          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Location</span>
              <div className="font-semibold text-slate-800 text-xs flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="truncate">{job.remote ? "Remote" : (job.city || job.location_text)}</span>
              </div>
              {job.distance_km !== undefined && !job.remote && (
                <span className="text-[11px] text-blue-600 font-medium block mt-0.5">{job.distance_km} km away</span>
              )}
            </div>

            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Work Mode</span>
              <div className="font-semibold text-slate-800 text-xs flex items-center gap-1 capitalize">
                <Briefcase className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>{job.work_mode}</span>
              </div>
              <span className="text-[11px] text-slate-500 capitalize block mt-0.5">{job.employment_type.replace("_", " ")}</span>
            </div>

            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Salary</span>
              <div className="font-semibold text-slate-800 text-xs flex items-center gap-1">
                <Banknote className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>
                  {job.salary_min ? `${job.salary_currency || "$"} ${job.salary_min.toLocaleString()}` : "Undisclosed"}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 block mt-0.5">
                {job.salary_verified ? "Verified in source" : "Not disclosed"}
              </span>
            </div>

            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Experience</span>
              <div className="font-semibold text-slate-800 text-xs capitalize">
                {job.experience_level.replace("_", " ")}
              </div>
              <span className="text-[11px] text-slate-500 block mt-0.5">{job.category}</span>
            </div>
          </div>

          {/* Skills Badges */}
          {job.skills && job.skills.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Required Skills & Technologies</h4>
              <div className="flex flex-wrap gap-1.5">
                {job.skills.map((skill, idx) => (
                  <span 
                    key={idx} 
                    className="px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Job Description */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Job Description</h4>
            <div className="prose prose-sm text-slate-700 max-w-none whitespace-pre-line leading-relaxed bg-white border border-slate-100 p-4 rounded-xl">
              {job.description}
            </div>
          </div>

          {/* Duplicate Sources ("Also listed on X other sources") */}
          {duplicates.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-xs mb-2">
                <Layers className="w-4 h-4 text-amber-600" />
                <span>Also listed on {duplicates.length} other source{duplicates.length > 1 ? "s" : ""}:</span>
              </div>
              <ul className="space-y-1.5 text-xs text-amber-800">
                {duplicates.map(dup => (
                  <li key={dup.id} className="flex items-center justify-between bg-white px-3 py-1.5 rounded border border-amber-100">
                    <span className="font-medium">{dup.source_id.toUpperCase()}</span>
                    <a 
                      href={dup.application_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-amber-700 hover:text-amber-900 underline flex items-center gap-1 font-semibold"
                    >
                      <span>View Source</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Provenance & Freshness Box */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
            <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Source Provenance & Audit Trail</span>
            </h4>
            <div className="grid grid-cols-2 gap-2 text-slate-600">
              <div><span className="text-slate-400">Source:</span> <span className="font-medium text-slate-800">{job.source_id}</span></div>
              <div><span className="text-slate-400">Reliability Score:</span> <span className="font-medium text-slate-800">{(job.source_reliability * 100).toFixed(0)}%</span></div>
              <div><span className="text-slate-400">Last Verified:</span> <span className="font-medium text-slate-800">{explanation.verificationLabel}</span></div>
              <div><span className="text-slate-400">Geocoding Accuracy:</span> <span className="font-medium text-slate-800 capitalize">{job.geocoding_accuracy.replace("_", " ")}</span></div>
            </div>

            <button
              onClick={() => setShowAudit(!showAudit)}
              className="text-blue-600 hover:text-blue-800 text-[11px] font-semibold flex items-center gap-1 pt-1"
            >
              <History className="w-3.5 h-3.5" />
              <span>{showAudit ? "Hide Transformation History" : "View Transformation History"}</span>
            </button>

            {showAudit && auditLogs.length > 0 && (
              <div className="mt-2 space-y-1.5 pt-2 border-t border-slate-200">
                {auditLogs.map(log => (
                  <div key={log.id} className="text-[11px] bg-white p-2 rounded border border-slate-200">
                    <span className="font-bold text-slate-700 uppercase">{log.stage}</span>
                    <span className="text-slate-400 ml-2">by {log.actor}</span>
                    <div className="text-slate-500 font-mono text-[10px] mt-0.5 truncate">
                      {JSON.stringify(log.details)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 flex items-center justify-between gap-4 bg-slate-50">
          <button
            onClick={() => onOpenReport(job)}
            className="text-xs text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1 hover:underline"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Report this job</span>
          </button>

          <a
            href={job.application_url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md flex items-center gap-2 transition"
          >
            <span>Apply on Original Source</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>

      </div>
    </div>
  );
};
