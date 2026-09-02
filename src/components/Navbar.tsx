"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  MapPin, 
  Search, 
  Crosshair, 
  SlidersHorizontal, 
  ShieldCheck, 
  Sparkles,
  Loader2
} from "lucide-react";

interface NavbarProps {
  onSearch: (query: string) => void;
  onLocationSearch: (locationText: string) => void;
  onUseMyLocation: () => void;
  radiusKm: number;
  onRadiusChange: (radius: number) => void;
  onToggleFilters: () => void;
  isFiltersOpen: boolean;
  totalJobs: number;
  sourcesCount: number;
  isLoading: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onSearch,
  onLocationSearch,
  onUseMyLocation,
  radiusKm,
  onRadiusChange,
  onToggleFilters,
  isFiltersOpen,
  totalJobs,
  sourcesCount,
  isLoading
}) => {
  const [searchInput, setSearchInput] = useState("");
  const [locationInput, setLocationInput] = useState("");

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      onSearch(searchInput.trim());
    }
  };

  const handleLocationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (locationInput.trim()) {
      onLocationSearch(locationInput.trim());
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-col md:flex-row items-center justify-between gap-3">
        
        {/* Brand & Stats */}
        <div className="flex items-center justify-between w-full md:w-auto gap-4">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md group-hover:bg-blue-700 transition">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-slate-900 flex items-center gap-1.5">
                Job<span className="text-blue-600">Mapper</span>
              </span>
              <div className="text-[11px] text-slate-500 font-medium -mt-1 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                <span>Verified Source-Grounded</span>
              </div>
            </div>
          </Link>

          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>{totalJobs} Jobs</span>
            <span className="text-emerald-400">·</span>
            <span>{sourcesCount} Sources</span>
          </div>

          <Link 
            href="/admin" 
            className="md:hidden text-xs font-medium text-slate-600 hover:text-blue-600 px-2 py-1 rounded bg-slate-100"
          >
            Admin
          </Link>
        </div>

        {/* Natural Search Bar */}
        <form onSubmit={handleSearchSubmit} className="flex-1 max-w-xl w-full">
          <div className="relative flex items-center">
            <div className="absolute left-3 text-slate-400 flex items-center gap-1">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder='Try "Python engineer in Mumbai within 10km" or "Remote data analyst"'
              className="w-full pl-9 pr-24 py-2 text-sm bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-blue-500 rounded-lg outline-none transition shadow-inner"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="absolute right-1.5 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md flex items-center gap-1 transition shadow-sm"
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>Search</span>
            </button>
          </div>
        </form>

        {/* Location & Controls */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          {/* Quick Location Search */}
          <form onSubmit={handleLocationSubmit} className="relative hidden lg:block">
            <input
              type="text"
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
              placeholder="City, State or Country"
              className="w-44 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:bg-white"
            />
          </form>

          {/* Current Location Button */}
          <button
            onClick={onUseMyLocation}
            title="Use current location"
            className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 rounded-lg transition flex items-center gap-1.5 text-xs font-medium"
          >
            <Crosshair className="w-4 h-4 text-blue-600" />
            <span className="hidden xl:inline">Near Me</span>
          </button>

          {/* Radius Selector */}
          <div className="relative">
            <select
              value={radiusKm}
              onChange={(e) => onRadiusChange(Number(e.target.value))}
              className="text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-2 outline-none text-slate-700 font-medium cursor-pointer"
            >
              <option value={2}>Within 2 km</option>
              <option value={5}>Within 5 km</option>
              <option value={10}>Within 10 km</option>
              <option value={25}>Within 25 km</option>
              <option value={50}>Within 50 km</option>
              <option value={100}>Within 100 km</option>
            </select>
          </div>

          {/* Filter Toggle Button */}
          <button
            onClick={onToggleFilters}
            className={`p-2 border rounded-lg transition flex items-center gap-1 text-xs font-medium ${
              isFiltersOpen 
                ? "bg-blue-50 border-blue-300 text-blue-700" 
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Filters</span>
          </button>

          {/* Admin Dashboard Link */}
          <Link
            href="/admin"
            className="hidden md:flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 px-2 py-1.5 font-medium border border-transparent hover:border-slate-200 rounded-lg transition"
          >
            Admin
          </Link>
        </div>

      </div>
    </header>
  );
};
