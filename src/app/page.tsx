"use client";

import React, { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { Navbar } from "@/components/Navbar";
import { FilterBar, FilterState } from "@/components/filters/FilterBar";
import { JobCard } from "@/components/jobs/JobCard";
import { JobDetailModal } from "@/components/jobs/JobDetailModal";
import { JobReportModal } from "@/components/jobs/JobReportModal";
import { Job, NearbyJobsResult } from "@/lib/types";
import { 
  MapPin, 
  Sparkles, 
  Layers, 
  ShieldCheck, 
  Clock, 
  Briefcase, 
  Map as MapIcon, 
  ListFilter,
  Loader2,
  AlertCircle
} from "lucide-react";

// Dynamically import JobMap with SSR disabled for Leaflet compatibility
const JobMap = dynamic(
  () => import("@/components/map/JobMap").then((mod) => mod.JobMap),
  { ssr: false, loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="text-xs font-semibold">Loading Interactive Map...</span>
      </div>
    </div>
  )}
);

export default function HomePage() {
  // Center: Default to Europe/Global or User Location
  const [center, setCenter] = useState<{ lat: number; lng: number }>({ lat: 42.6977, lng: 23.3219 }); // Sofia / Europe hub
  const [zoom, setZoom] = useState(6);
  const [radiusKm, setRadiusKm] = useState(50);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [coverage, setCoverage] = useState<NearbyJobsResult["coverage"]>({
    sources_count: 0,
    radius_km: null,
    center: null,
    latest_verification: null
  });

  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [detailModalJob, setDetailModalJob] = useState<Job | null>(null);
  const [reportModalJob, setReportModalJob] = useState<Job | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<"list" | "map">("map");

  const [filters, setFilters] = useState<FilterState>({
    work_mode: [],
    employment_type: [],
    experience_level: [],
    category: "",
    salary_min: null,
    freshness_days: null,
    remote_only: false,
    sort_by: "relevance"
  });

  // Fetch Jobs
  const fetchJobs = useCallback(async (customParams?: Record<string, any>) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();

      // Location / Radius
      if (center) {
        params.set("lat", center.lat.toString());
        params.set("lng", center.lng.toString());
        params.set("radius_km", radiusKm.toString());
      }

      // Applied Filters
      if (filters.work_mode.length > 0) params.set("work_mode", filters.work_mode.join(","));
      if (filters.employment_type.length > 0) params.set("employment_type", filters.employment_type.join(","));
      if (filters.experience_level.length > 0) params.set("experience_level", filters.experience_level.join(","));
      if (filters.category) params.set("category", filters.category);
      if (filters.salary_min !== null) params.set("salary_min", filters.salary_min.toString());
      if (filters.freshness_days !== null) params.set("freshness_days", filters.freshness_days.toString());
      if (filters.remote_only) params.set("remote_only", "true");
      params.set("sort_by", filters.sort_by);

      if (customParams) {
        for (const [k, v] of Object.entries(customParams)) {
          if (v !== undefined && v !== null) params.set(k, String(v));
        }
      }

      const res = await fetch(`/api/jobs/nearby?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch jobs");
      const data: NearbyJobsResult = await res.json();

      setJobs(data.jobs || []);
      setTotalCount(data.total || 0);
      if (data.coverage) setCoverage(data.coverage);
    } catch (err) {
      console.error("Error fetching jobs:", err);
    } finally {
      setIsLoading(false);
    }
  }, [center, radiusKm, filters]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Natural Language Search Handler
  const handleNaturalSearch = async (query: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();

      setJobs(data.jobs || []);
      setTotalCount(data.total || 0);
      if (data.coverage) setCoverage(data.coverage);

      // If intent produced coordinates, fly to them
      if (data.appliedFilters?.lat && data.appliedFilters?.lng) {
        setCenter({ lat: data.appliedFilters.lat, lng: data.appliedFilters.lng });
        setZoom(10);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Location Search Handler (Geocoding custom query)
  const handleLocationSearch = async (locationText: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(locationText)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.length > 0) {
          const newLat = parseFloat(data[0].lat);
          const newLng = parseFloat(data[0].lon);
          setCenter({ lat: newLat, lng: newLng });
          setZoom(10);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Browser Geolocation ("Near Me")
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setZoom(11);
      },
      (err) => {
        console.warn("Geolocation denied:", err.message);
        alert("Location access was denied or unavailable.");
      }
    );
  };

  // Viewport Search Handler ("Search this area")
  const handleSearchViewport = (bounds: { min_lat: number; max_lat: number; min_lng: number; max_lng: number }) => {
    const centerLat = (bounds.min_lat + bounds.max_lat) / 2;
    const centerLng = (bounds.min_lng + bounds.max_lng) / 2;
    setCenter({ lat: centerLat, lng: centerLng });
    fetchJobs({
      min_lat: bounds.min_lat,
      max_lat: bounds.max_lat,
      min_lng: bounds.min_lng,
      max_lng: bounds.max_lng
    });
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-100">
      
      {/* Top Navigation */}
      <Navbar
        onSearch={handleNaturalSearch}
        onLocationSearch={handleLocationSearch}
        onUseMyLocation={handleUseMyLocation}
        radiusKm={radiusKm}
        onRadiusChange={setRadiusKm}
        onToggleFilters={() => setIsFiltersOpen(!isFiltersOpen)}
        isFiltersOpen={isFiltersOpen}
        totalJobs={totalCount}
        sourcesCount={coverage.sources_count}
        isLoading={isLoading}
      />

      {/* Expandable Filter Bar */}
      {isFiltersOpen && (
        <FilterBar
          filters={filters}
          onChange={setFilters}
          onReset={() => setFilters({
            work_mode: [],
            employment_type: [],
            experience_level: [],
            category: "",
            salary_min: null,
            freshness_days: null,
            remote_only: false,
            sort_by: "relevance"
          })}
        />
      )}

      {/* Main Split-View Area */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        
        {/* Left Side: Job Cards List */}
        <div className={`
          w-full md:w-[460px] lg:w-[500px] xl:w-[540px] h-full flex flex-col bg-slate-50 border-r border-slate-200 shrink-0 z-20
          ${mobileTab === "map" ? "hidden md:flex" : "flex"}
        `}>
          {/* Transparency & Coverage Bar */}
          <div className="p-3 bg-white border-b border-slate-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>
                {totalCount} jobs discovered from {coverage.sources_count} verified sources
                {coverage.radius_km ? ` within ${coverage.radius_km} km` : ""}
              </span>
            </div>
            {isLoading && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
          </div>

          {/* Cards Scroll Container */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {jobs.length === 0 && !isLoading ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
                <AlertCircle className="w-12 h-12 text-slate-300" />
                <h4 className="font-bold text-slate-700 text-base">No verified jobs in this area</h4>
                <p className="text-xs text-slate-500 max-w-xs">
                  We only show authentic, traceable jobs discovered from verified sources. Try expanding your search radius or panning the map.
                </p>
                <button
                  onClick={() => setRadiusKm(100)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg transition"
                >
                  Expand to 100 km
                </button>
              </div>
            ) : (
              jobs.map(job => (
                <JobCard
                  key={job.id}
                  job={job}
                  isSelected={selectedJob?.id === job.id}
                  onSelect={(j) => {
                    setSelectedJob(j);
                    if (j.latitude && j.longitude) {
                      setCenter({ lat: j.latitude, lng: j.longitude });
                    }
                  }}
                  onOpenDetails={(j) => setDetailModalJob(j)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right Side: Interactive Leaflet Map */}
        <div className={`
          flex-1 h-full relative
          ${mobileTab === "list" ? "hidden md:block" : "block"}
        `}>
          <JobMap
            jobs={jobs}
            center={center}
            zoom={zoom}
            radiusKm={radiusKm}
            selectedJobId={selectedJob?.id || null}
            onSelectJob={(j) => setSelectedJob(j)}
            onOpenDetails={(j) => setDetailModalJob(j)}
            onSearchViewport={handleSearchViewport}
          />
        </div>

      </div>

      {/* Mobile Floating Tab Switcher */}
      <div className="md:hidden fixed bottom-5 left-1/2 -translate-x-1/2 z-40 bg-white/95 backdrop-blur-sm border border-slate-200 shadow-xl rounded-full p-1 flex items-center gap-1">
        <button
          onClick={() => setMobileTab("map")}
          className={`px-4 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 transition ${
            mobileTab === "map" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <MapIcon className="w-3.5 h-3.5" />
          <span>Map View</span>
        </button>
        <button
          onClick={() => setMobileTab("list")}
          className={`px-4 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 transition ${
            mobileTab === "list" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <ListFilter className="w-3.5 h-3.5" />
          <span>List ({totalCount})</span>
        </button>
      </div>

      {/* Job Details Modal */}
      {detailModalJob && (
        <JobDetailModal
          job={detailModalJob}
          onClose={() => setDetailModalJob(null)}
          onOpenReport={(j) => {
            setDetailModalJob(null);
            setReportModalJob(j);
          }}
        />
      )}

      {/* Report Job Modal */}
      {reportModalJob && (
        <JobReportModal
          job={reportModalJob}
          onClose={() => setReportModalJob(null)}
        />
      )}

    </div>
  );
}
