"use client";

import React, { useEffect, useRef, useState } from "react";
import { Job } from "@/lib/types";
import { Compass, RefreshCw } from "lucide-react";

interface JobMapProps {
  jobs: Job[];
  center: { lat: number; lng: number };
  zoom: number;
  radiusKm: number;
  selectedJobId: string | null;
  onSelectJob: (job: Job) => void;
  onOpenDetails: (job: Job) => void;
  onSearchViewport: (bounds: { min_lat: number; max_lat: number; min_lng: number; max_lng: number }) => void;
}

export const JobMap: React.FC<JobMapProps> = ({
  jobs,
  center,
  zoom,
  radiusKm,
  selectedJobId,
  onSelectJob,
  onOpenDetails,
  onSearchViewport
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const circleLayerRef = useRef<any>(null);
  const [showSearchAreaBtn, setShowSearchAreaBtn] = useState(false);
  const [currentBounds, setCurrentBounds] = useState<any>(null);

  // Category Color Palette
  const getCategoryColor = (category: string) => {
    switch (category) {
      case "Software & Engineering": return "#2563eb"; // blue
      case "Data & AI": return "#7c3aed"; // purple
      case "Information Technology": return "#0891b2"; // cyan
      case "Finance & Accounting": return "#059669"; // emerald
      case "Sales": return "#d97706"; // amber
      case "Marketing": return "#ea580c"; // orange
      case "Healthcare": return "#e11d48"; // rose
      case "Design & Creative": return "#db2777"; // pink
      default: return "#475569"; // slate
    }
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    let isMounted = true;

    import("leaflet").then((L) => {
      if (!isMounted || !mapContainerRef.current) return;

      // Fix default Leaflet icon paths
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(mapContainerRef.current, {
        center: [center.lat, center.lng],
        zoom: zoom,
        zoomControl: false
      });

      // Add Zoom Control to bottom right
      L.control.zoom({ position: "bottomright" }).addTo(map);

      // CartoDB Positron / Voyager high quality tiles
      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19
      }).addTo(map);

      // Layer groups for markers and radius circle
      markersLayerRef.current = L.layerGroup().addTo(map);
      circleLayerRef.current = L.layerGroup().addTo(map);

      // Listen to map move/drag events for "Search this area"
      map.on("moveend", () => {
        const b = map.getBounds();
        setCurrentBounds({
          min_lat: b.getSouth(),
          max_lat: b.getNorth(),
          min_lng: b.getWest(),
          max_lng: b.getEast()
        });
        setShowSearchAreaBtn(true);
      });

      mapInstanceRef.current = map;
    });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Center & Radius Circle
  useEffect(() => {
    if (!mapInstanceRef.current || !circleLayerRef.current) return;

    import("leaflet").then((L) => {
      const map = mapInstanceRef.current;
      map.setView([center.lat, center.lng], map.getZoom());

      circleLayerRef.current.clearLayers();

      // Draw Radius Circle if radius is active
      if (radiusKm && radiusKm > 0) {
        L.circle([center.lat, center.lng], {
          radius: radiusKm * 1000,
          color: "#3b82f6",
          fillColor: "#3b82f6",
          fillOpacity: 0.08,
          weight: 1.5,
          dashArray: "4, 6"
        }).addTo(circleLayerRef.current);
      }

      // Add User/Center Pin
      const userPin = L.divIcon({
        className: "custom-user-pin",
        html: `
          <div style="
            width: 16px; 
            height: 16px; 
            background: #2563eb; 
            border: 3px solid white; 
            border-radius: 50%; 
            box-shadow: 0 0 0 4px rgba(37,99,235,0.3);
          "></div>
        `,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });
      L.marker([center.lat, center.lng], { icon: userPin }).addTo(circleLayerRef.current);
    });
  }, [center, radiusKm]);

  // Update Markers & Clustering
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    import("leaflet").then((L) => {
      markersLayerRef.current.clearLayers();

      const physicalJobs = jobs.filter(j => j.latitude !== null && j.longitude !== null);

      // Grid-based fast viewport clustering
      const currentZoom = mapInstanceRef.current.getZoom();
      const shouldCluster = currentZoom < 11;
      const gridSize = shouldCluster ? (currentZoom < 7 ? 1.5 : (currentZoom < 9 ? 0.6 : 0.25)) : 0;

      if (shouldCluster) {
        // Group points into clusters by spatial grid
        const clusterMap = new Map<string, Job[]>();
        for (const job of physicalJobs) {
          const gridLat = Math.round(job.latitude! / gridSize) * gridSize;
          const gridLng = Math.round(job.longitude! / gridSize) * gridSize;
          const key = `${gridLat.toFixed(3)}_${gridLng.toFixed(3)}`;
          if (!clusterMap.has(key)) clusterMap.set(key, []);
          clusterMap.get(key)!.push(job);
        }

        clusterMap.forEach((clusterJobs) => {
          if (clusterJobs.length === 1) {
            renderSingleMarker(L, clusterJobs[0]);
          } else {
            // Render Cluster Pin
            const avgLat = clusterJobs.reduce((sum, j) => sum + j.latitude!, 0) / clusterJobs.length;
            const avgLng = clusterJobs.reduce((sum, j) => sum + j.longitude!, 0) / clusterJobs.length;
            const count = clusterJobs.length;
            const size = count > 50 ? 44 : (count > 15 ? 38 : 32);

            const clusterIcon = L.divIcon({
              className: "custom-cluster-icon",
              html: `
                <div class="cluster-marker-pin" style="width: ${size}px; height: ${size}px;">
                  ${count}
                </div>
              `,
              iconSize: [size, size],
              iconAnchor: [size / 2, size / 2]
            });

            const marker = L.marker([avgLat, avgLng], { icon: clusterIcon }).addTo(markersLayerRef.current);
            marker.on("click", () => {
              mapInstanceRef.current.setView([avgLat, avgLng], currentZoom + 3);
            });
          }
        });
      } else {
        // Individual Markers
        for (const job of physicalJobs) {
          renderSingleMarker(L, job);
        }
      }
    });

    function renderSingleMarker(L: any, job: Job) {
      const isSelected = selectedJobId === job.id;
      const color = getCategoryColor(job.category);

      const icon = L.divIcon({
        className: "custom-job-pin",
        html: `
          <div class="job-marker-pin ${isSelected ? 'ring-4 ring-blue-400 scale-125' : ''}" style="background-color: ${color};">
            <span>●</span>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      });

      const marker = L.marker([job.latitude!, job.longitude!], { icon }).addTo(markersLayerRef.current);

      // Popup preview
      const popupHtml = `
        <div style="min-width: 200px; font-family: sans-serif;">
          <div style="font-size: 11px; font-weight: 700; color: #059669; text-transform: uppercase; margin-bottom: 2px;">
            ${job.source_id.toUpperCase()}
          </div>
          <div style="font-weight: 700; font-size: 13px; color: #0f172a; line-height: 1.2; margin-bottom: 4px;">
            ${job.title}
          </div>
          <div style="font-size: 12px; color: #475569; margin-bottom: 6px;">
            ${job.company_name} · ${job.city || job.location_text}
          </div>
          <div style="display: flex; gap: 4px; font-size: 11px; color: #64748b; margin-bottom: 8px;">
            <span style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${job.work_mode}</span>
            <span style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${job.category}</span>
          </div>
          <button 
            id="popup-btn-${job.id}" 
            style="width: 100%; padding: 6px; background: #2563eb; color: white; border: none; border-radius: 6px; font-weight: 600; font-size: 11px; cursor: pointer;"
          >
            View Job
          </button>
        </div>
      `;

      marker.bindPopup(popupHtml, { offset: [0, -10] });

      marker.on("click", () => {
        onSelectJob(job);
      });

      marker.on("popupopen", () => {
        const btn = document.getElementById(`popup-btn-${job.id}`);
        if (btn) {
          btn.onclick = () => onOpenDetails(job);
        }
      });

      if (isSelected) {
        marker.openPopup();
      }
    }
  }, [jobs, selectedJobId]);

  const handleSearchAreaClick = () => {
    if (currentBounds) {
      onSearchViewport(currentBounds);
      setShowSearchAreaBtn(false);
    }
  };

  return (
    <div className="relative w-full h-full">
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full z-10" />

      {/* "Search this area" Floating Button */}
      {showSearchAreaBtn && (
        <button
          onClick={handleSearchAreaClick}
          className="absolute top-4 left-1/2 -translate-x-1/2 z-20 px-4 py-2 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold rounded-full shadow-lg border border-slate-200 flex items-center gap-2 transition hover:scale-105 active:scale-95"
        >
          <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin-reverse" />
          <span>Search this area</span>
        </button>
      )}

      {/* Map Category Legend */}
      <div className="absolute bottom-6 left-4 z-20 bg-white/95 backdrop-blur-sm p-2.5 rounded-xl shadow-md border border-slate-200 text-[11px] font-medium hidden md:block">
        <div className="text-[10px] uppercase font-bold text-slate-400 mb-1.5">Categories</div>
        <div className="space-y-1">
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span><span>Software & Engineering</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span><span>Data & AI</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span><span>Finance & Accounting</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span><span>Sales & Marketing</span></div>
        </div>
      </div>
    </div>
  );
};
