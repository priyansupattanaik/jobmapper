"use client";

import React, { useState } from "react";
import { X, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Job, ReportReason } from "@/lib/types";

interface JobReportModalProps {
  job: Job | null;
  onClose: () => void;
}

export const JobReportModal: React.FC<JobReportModalProps> = ({
  job,
  onClose
}) => {
  const [reason, setReason] = useState<ReportReason>("broken_application_link");
  const [details, setDetails] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!job) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: job.id,
          reason,
          details
        })
      });

      if (res.ok) {
        setSubmitted(true);
        setTimeout(() => {
          onClose();
        }, 1800);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2 text-rose-600 font-bold text-base">
            <AlertTriangle className="w-5 h-5" />
            <h3>Report Problematic Job</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {submitted ? (
          <div className="py-8 text-center space-y-2">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto animate-bounce" />
            <h4 className="font-bold text-slate-800 text-base">Report Submitted</h4>
            <p className="text-xs text-slate-500">Thank you for keeping Job Mapper accurate and verified. Our moderation team will verify this listing.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <span className="font-medium text-slate-500 block mb-1">Reporting listing:</span>
              <p className="font-bold text-slate-800 text-sm">{job.title}</p>
              <p className="text-slate-600">{job.company_name}</p>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1.5">Reason for report</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as ReportReason)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-700 outline-none focus:border-blue-500"
              >
                <option value="broken_application_link">Broken application link / 404</option>
                <option value="job_no_longer_available">Job is filled or no longer available</option>
                <option value="incorrect_location">Incorrect location coordinates</option>
                <option value="incorrect_company">Incorrect company identity</option>
                <option value="misleading_information">Misleading salary / requirements</option>
                <option value="duplicate">Duplicate of another posting</option>
                <option value="suspicious_fraudulent">Suspicious or fraudulent listing</option>
                <option value="other">Other reason</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1.5">Additional details (optional)</label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
                placeholder="Provide any additional context or proof to help moderation..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-700 outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shadow-sm flex items-center gap-1.5"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Submit Report</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
