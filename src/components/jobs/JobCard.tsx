"use client";

import React from "react";
import { 
  Building2, 
  MapPin, 
  Banknote, 
  Clock, 
  ExternalLink, 
  ShieldCheck, 
  Briefcase,
  ChevronRight
} from "lucide-react";
import { Job } from "@/lib/types";
import { RankingEngine } from "@/lib/scoring/ranking";

interface JobCardProps {
  job: Job;
  isSelected?: boolean;
  onSelect: (job: Job) => void;
  onOpenDetails: (job: Job) => void;
}

export const JobCard: React.FC<JobCardProps> = ({
  job,
  isSelected = false,
  onSelect,
  onOpenDetails
}) => {
  const explanation = RankingEngine.explainRanking(
    job.overall_confidence,
    job.distance_km,
    job.last_verified_at,
    job.remote
  );

  // Format Salary
  const formatSalary = () => {
    if (job.salary_min !== null && job.salary_min !== undefined) {
      const curr = job.salary_currency || "$";
      const sym = curr === "INR" ? "₹" : (curr === "EUR" ? "€" : (curr === "GBP" ? "£" : "$"));

      if (curr === "INR") {
        const minLakh = (job.salary_min / 100000).toFixed(1).replace(".0", "");
        const maxLakh = job.salary_max ? (job.salary_max / 100000).toFixed(1).replace(".0", "") : null;
        return maxLakh && maxLakh !== minLakh ? `₹${minLakh}–${maxLakh} LPA` : `₹${minLakh} LPA`;
      }

      const minK = Math.round(job.salary_min >= 1000 ? job.salary_min / 1000 : job.salary_min);
      const maxK = job.salary_max ? Math.round(job.salary_max >= 1000 ? job.salary_max / 1000 : job.salary_max) : null;
      const kSuffix = job.salary_min >= 1000 ? "k" : "";
      return maxK && maxK !== minK ? `${sym}${minK}k–${sym}${maxK}k` : `${sym}${minK}${kSuffix}`;
    }
    return "Salary not disclosed";
  };

  return (
    <div 
      onClick={() => onSelect(job)}
      className={`group p-4 rounded-xl border transition-all cursor-pointer relative bg-white ${
        isSelected 
          ? "border-blue-500 shadow-md ring-2 ring-blue-100" 
          : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
      }`}
    >
      {/* Top Meta: Source & Match explanation */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
          <ShieldCheck className="w-3 h-3 text-emerald-600" />
          <span>{job.source_id.replace("-", " ").toUpperCase()}</span>
        </div>
        <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
          {explanation.summaryBadge}
        </span>
      </div>

      {/* Title & Company */}
      <div className="mb-2">
        <h3 className="font-bold text-slate-900 text-sm group-hover:text-blue-600 transition leading-snug line-clamp-2">
          {job.title}
        </h3>
        <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-1 font-medium">
          <Building2 className="w-3.5 h-3.5 text-slate-400" />
          <span>{job.company_name}</span>
          {job.company_verified && (
            <span title="Verified employer">
              <ShieldCheck className="w-3 h-3 text-blue-500" />
            </span>
          )}
        </div>
      </div>

      {/* Badges: Location, Work Mode, Salary */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-600 mb-3 font-medium">
        <div className="flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5 text-slate-400" />
          <span>{job.remote ? "Remote" : (job.city || job.location_text)}</span>
          {job.distance_km !== undefined && !job.remote && (
            <span className="text-blue-600 font-semibold">({job.distance_km} km)</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Briefcase className="w-3.5 h-3.5 text-slate-400" />
          <span className="capitalize">{job.work_mode}</span>
          <span className="text-slate-300">·</span>
          <span className="capitalize">{job.employment_type.replace("_", " ")}</span>
        </div>

        <div className="flex items-center gap-1 text-slate-700 font-semibold">
          <Banknote className="w-3.5 h-3.5 text-emerald-600" />
          <span>{formatSalary()}</span>
        </div>
      </div>

      {/* Skills tags */}
      {job.skills && job.skills.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {job.skills.slice(0, 4).map((skill, idx) => (
            <span 
              key={idx} 
              className="text-[10px] font-medium bg-slate-50 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded"
            >
              {skill}
            </span>
          ))}
          {job.skills.length > 4 && (
            <span className="text-[10px] text-slate-400 font-medium px-1">
              +{job.skills.length - 4}
            </span>
          )}
        </div>
      )}

      {/* Bottom Actions */}
      <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 text-xs">
        <div className="flex items-center gap-1 text-[11px] text-slate-400">
          <Clock className="w-3 h-3" />
          <span>{explanation.verificationLabel}</span>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetails(job);
          }}
          className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-0.5 hover:underline"
        >
          <span>View Details</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

    </div>
  );
};
