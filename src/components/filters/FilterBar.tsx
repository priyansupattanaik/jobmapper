"use client";

import React from "react";
import { X, Check } from "lucide-react";
import { CATEGORY_NAMES } from "@/lib/ai/taxonomy";

export interface FilterState {
  work_mode: string[];
  employment_type: string[];
  experience_level: string[];
  category: string;
  salary_min: number | null;
  freshness_days: number | null;
  remote_only: boolean;
  sort_by: "relevance" | "distance" | "freshness" | "salary";
}

interface FilterBarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  onReset: () => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onChange,
  onReset
}) => {
  const toggleArrayItem = (key: "work_mode" | "employment_type" | "experience_level", value: string) => {
    const current = filters[key];
    const exists = current.includes(value);
    const updated = exists ? current.filter(item => item !== value) : [...current, value];
    onChange({ ...filters, [key]: updated });
  };

  const hasActiveFilters = 
    filters.work_mode.length > 0 ||
    filters.employment_type.length > 0 ||
    filters.experience_level.length > 0 ||
    Boolean(filters.category) ||
    filters.salary_min !== null ||
    filters.freshness_days !== null ||
    filters.remote_only;

  return (
    <div className="bg-white border-b border-slate-200 px-4 py-3 text-xs shadow-inner">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
        <span className="font-bold uppercase tracking-wider text-slate-500 text-[11px]">Filter Listings</span>
        {hasActiveFilters && (
          <button
            onClick={onReset}
            className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 hover:underline"
          >
            <X className="w-3.5 h-3.5" />
            <span>Reset All</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Work Mode */}
        <div>
          <label className="font-semibold text-slate-700 block mb-1.5">Work Mode</label>
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: "remote", label: "Remote" },
              { id: "hybrid", label: "Hybrid" },
              { id: "onsite", label: "On-site" }
            ].map(item => {
              const active = filters.work_mode.includes(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => toggleArrayItem("work_mode", item.id)}
                  className={`px-2 py-1 rounded-md border font-medium transition ${
                    active 
                      ? "bg-blue-600 text-white border-blue-600" 
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="font-semibold text-slate-700 block mb-1.5">Category</label>
          <select
            value={filters.category}
            onChange={(e) => onChange({ ...filters, category: e.target.value })}
            className="w-full bg-slate-50 border border-slate-200 rounded-md py-1 px-2 text-slate-700 outline-none focus:border-blue-500"
          >
            <option value="">All Categories</option>
            {CATEGORY_NAMES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Experience Level */}
        <div>
          <label className="font-semibold text-slate-700 block mb-1.5">Experience Level</label>
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: "internship", label: "Intern" },
              { id: "entry_level", label: "Entry" },
              { id: "mid_level", label: "Mid" },
              { id: "senior", label: "Senior" },
              { id: "executive", label: "Exec" }
            ].map(item => {
              const active = filters.experience_level.includes(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => toggleArrayItem("experience_level", item.id)}
                  className={`px-2 py-1 rounded-md border font-medium transition ${
                    active 
                      ? "bg-blue-600 text-white border-blue-600" 
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Freshness & Sort */}
        <div>
          <label className="font-semibold text-slate-700 block mb-1.5">Freshness & Sort</label>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={filters.freshness_days ?? ""}
              onChange={(e) => onChange({ ...filters, freshness_days: e.target.value ? Number(e.target.value) : null })}
              className="bg-slate-50 border border-slate-200 rounded-md py-1 px-2 text-slate-700 outline-none"
            >
              <option value="">Any Time</option>
              <option value={1}>Last 24 Hours</option>
              <option value={3}>Last 3 Days</option>
              <option value={7}>Last 7 Days</option>
              <option value={30}>Last 30 Days</option>
            </select>

            <select
              value={filters.sort_by}
              onChange={(e) => onChange({ ...filters, sort_by: e.target.value as any })}
              className="bg-slate-50 border border-slate-200 rounded-md py-1 px-2 text-slate-700 outline-none"
            >
              <option value="relevance">Top Match</option>
              <option value="distance">Nearest</option>
              <option value="freshness">Newest</option>
              <option value="salary">Highest Salary</option>
            </select>
          </div>
        </div>

      </div>
    </div>
  );
};
