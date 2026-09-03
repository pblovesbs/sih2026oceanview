import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { OceanMetadata, SliceData, FloatSummary, VariableKey, FloatDriftData } from '../types/ocean';
import { getColorForValue } from '../utils/colormaps';
import { generateRasterFromPoints } from '../utils/raster';
import { useOceanStore } from '../store/useOceanStore';
import { fetchContours, fetchDeltas, fetchSimulatedDrift } from '../services/api';


interface CesiumGlobeProps {
  metadata: OceanMetadata | null;
  sliceData: SliceData | null;
  floats: FloatSummary[];
  currentVariable: VariableKey;
  currentDepth: number;
  showCurrents: boolean;
  showFloats: boolean;
  showGrid: boolean;
  selectedFloat: FloatSummary | null;
  selectedFloatProfile: any;
  onSelectFloat: (float: FloatSummary) => void;
  flyToTarget: string | null;
  onFlyToDone: () => void;
  // Phase 4: temporal
  timePosition?: number;  // fractional: 2.35 = lerp 70% between step2 and step3
  timeSteps?: string[];   // active date sequence
  sliceDataB?: SliceData | null; // second timestep for crossfade
}

export const CesiumGlobe: React.FC<CesiumGlobeProps> = ({
  metadata,
  sliceData,
  sliceDataB,
  timePosition = 0,
  timeSteps = [],
  floats,
  currentVariable,
  currentDepth,
  showCurrents,
  showFloats,
  showGrid,
  selectedFloat,
  selectedFloatProfile,
  onSelectFloat,
  flyToTarget,
  onFlyToDone,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const pointsCollectionRef = useRef<Cesium.PointPrimitiveCollection | null>(null);
  const linesCollectionRef = useRef<Cesium.PolylineCollection | null>(null);
  const particlesRef = useRef<any[]>([]);
  const particleSystemListenerRef = useRef<any>(null);
  const imageryLayerARef = useRef<Cesium.ImageryLayer | null>(null);
  const imageryLayerBRef = useRef<Cesium.ImageryLayer | null>(null);
  const deltasLayerRef = useRef<Cesium.ImageryLayer | null>(null);
  // Track the actual ImageryLayer (not just provider) for reliable removal
  const gridLayerRef = useRef<Cesium.ImageryLayer | null>(null);
  // Legacy provider ref kept for backward compat — actual layer is in gridLayerRef
  const gridProviderRef = useRef<any>(null);

  // Global store subscriptions
  const storeHoveredDepth = useOceanStore((s) => s.hoveredDepth);
  const verticalExaggeration = useOceanStore((s) => s.verticalExaggeration);
  const colorMode = useOceanStore((s) => s.colorMode);
  const colorScaleMode = useOceanStore((s) => s.colorScaleMode);
  const showTemporalMorphing = useOceanStore((s) => s.showTemporalMorphing);
  const showThermocline = useOceanStore((s) => s.showThermocline);
  const showContours = useOceanStore((s) => s.showContours);
  const showDeltas = useOceanStore((s) => s.showDeltas);

  // hoverSyncDepth lives in a ref — NOT state — to avoid 60Hz React re-renders
  const hoverSyncDepthRef = useRef<number | null>(null);

  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number; text: string } | null>(null);
  // contextRevision bumped on webglcontextrestored to force effects to re-run
  const [contextRevision, setContextRevision] = useState(0);

  const [contoursData, setContoursData] = useState<any[]>([]);
  const [deltasData, setDeltasData] = useState<any>(null);
  const [simulatedDrifts, setSimulatedDrifts] = useState<Record<string, FloatDriftData>>({});
  const contoursCacheRef = useRef<Record<string, any[]>>({});
  const deltasCacheRef = useRef<Record<string, any>>({});

  useEffect(() => {
    fetchSimulatedDrift()
      .then((res) => {
        if (res && res.drifts) {
          setSimulatedDrifts(res.drifts);
        }
      })
      .catch((err) => console.warn('Simulated drift fetch error:', err));
  }, []);

  // ─── Cache Purge ───────────────────────────────────────────────────────────
  useEffect(() => {
    // Clear caches when the active time steps sequence changes to prevent WebGL tab crashing
    contoursCacheRef.current = {};
    deltasCacheRef.current = {};
  }, [timeSteps]);

  // Derive bbox from metadata, fallback to Bay of Bengal actual data extent
  const bbox: [number, number, number, number] = (metadata?.bbox as [number, number, number, number]) ?? [80.0, 6.0, 97.0, 22.0];
  const [minLon, minLat, maxLon, maxLat] = bbox;

  // ─── Phase 0: Initialize Cesium Viewer ────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const viewer = new Cesium.Viewer(containerRef.current, {
      animation: false,
      baseLayerPicker: false,
      fullscreenButton: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      sceneModePicker: false,
      selectionIndicator: false,
      timeline: false,
      navigationHelpButton: false,
      navigationInstructionsInitiallyVisible: false,
      scene3DOnly: true,
      skyAtmosphere: new Cesium.SkyAtmosphere(),
      useBrowserRecommendedResolution: false,
    });

    // ── Enable Detailed 3D Terrain ──────────────────────────────────────────
    Cesium.createWorldTerrainAsync().then(terrainProvider => {
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.terrainProvider = terrainProvider;
      }
    }).catch(err => console.warn('Could not load terrain', err));

    // Demand-driven rendering — every animated system must call requestRender() itself
    viewer.resolutionScale = 1.0;
    viewer.scene.requestRenderMode = true;
    viewer.scene.maximumRenderTimeChange = Infinity;

    // ── Adaptive Resolution Scaler ───────────────────────────────────────────
    // Tracks recent frame durations. Steps down under load, steps back up on sustained good perf.
    const frameTimes: number[] = [];
    const WINDOW = 60; // number of frames to evaluate
    const STEP_DOWN_THRESHOLD_MS = 16.6; // >60fps target
    const STEP_UP_THRESHOLD_MS = 13.0;  // >76fps sustained = safe to step up
    const SCALES = [1.0, 0.85, 0.70];
    let scaleIdx = 0;
    let lastFrameTime = performance.now();

    const resolutionListener = () => {
      const now = performance.now();
      const dt = now - lastFrameTime;
      lastFrameTime = now;
      frameTimes.push(dt);
      if (frameTimes.length > WINDOW) frameTimes.shift();
      if (frameTimes.length < WINDOW) return;

      const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;

      if (avg > STEP_DOWN_THRESHOLD_MS && scaleIdx < SCALES.length - 1) {
        scaleIdx++;
        viewer.resolutionScale = SCALES[scaleIdx];
        frameTimes.length = 0; // reset window after change
      } else if (avg < STEP_UP_THRESHOLD_MS && scaleIdx > 0) {
        scaleIdx--;
        viewer.resolutionScale = SCALES[scaleIdx];
        frameTimes.length = 0;
      }
    };
    viewer.scene.postRender.addEventListener(resolutionListener);
    // Expose scaleIdx getter for InspectionCube bloom gating
    (viewer as any)._scaleIdx = () => scaleIdx;

    // ── WebGL Context Loss / Recovery ────────────────────────────────────────
    const canvas = viewer.canvas;
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      console.warn('WebGL Context Lost — pausing render pipeline.');
    };
    const handleContextRestored = () => {
      console.log('WebGL Context Restored — triggering primitive rebuild.');
      // Bumping contextRevision forces all primitive-building useEffects to re-run,
      // re-uploading geometry to the fresh WebGL context automatically.
      setContextRevision(v => v + 1);
    };
    canvas.addEventListener('webglcontextlost', handleContextLost, false);
    canvas.addEventListener('webglcontextrestored', handleContextRestored, false);

    // ── Globe Aesthetics ──────────────────────────────────────────────────────
    viewer.scene.globe.enableLighting = true;
    viewer.scene.globe.depthTestAgainstTerrain = false;
    viewer.scene.globe.translucency.enabled = false;
    viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#020617');
    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#020617');
    viewer.scene.fog.enabled = true;
    viewer.scene.fog.density = 0.0003;

    // ── Blender-Style Camera Controls ────────────────────────────────────────
    const ssc = viewer.scene.screenSpaceCameraController;
    ssc.minimumZoomDistance = 20000;
    ssc.maximumZoomDistance = 30000000;
    ssc.inertiaSpin = 0.9;
    ssc.inertiaTranslate = 0.9;
    ssc.inertiaZoom = 0.9;
    ssc.tiltEventTypes = [
      Cesium.CameraEventType.MIDDLE_DRAG,
      { eventType: Cesium.CameraEventType.LEFT_DRAG, modifier: Cesium.KeyboardEventModifier.CTRL },
      { eventType: Cesium.CameraEventType.RIGHT_DRAG, modifier: Cesium.KeyboardEventModifier.CTRL },
    ];
    // Optimize for Mac Trackpads (Pinch to zoom, two finger drag to pan)
    ssc.zoomEventTypes = [
      Cesium.CameraEventType.WHEEL,
      Cesium.CameraEventType.PINCH
    ];
    ssc.translateEventTypes = [
      Cesium.CameraEventType.RIGHT_DRAG,
      { eventType: Cesium.CameraEventType.MIDDLE_DRAG, modifier: Cesium.KeyboardEventModifier.SHIFT },
    ];

    // ── Initial Camera ────────────────────────────────────────────────────────
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(88.5, 14.0, 3200000),
      orientation: {
        heading: Cesium.Math.toRadians(0.0),
        pitch: Cesium.Math.toRadians(-62.0),
        roll: 0.0,
      },
    });

    // ── EEZ Boundary Polygon (uses correct bbox) ─────────────────────────────
    viewer.entities.add({
      name: 'India EEZ — Bay of Bengal Sector',
      polygon: {
        hierarchy: Cesium.Cartesian3.fromDegreesArray([
          minLon, minLat,
          maxLon, minLat,
          maxLon, maxLat,
          minLon, maxLat,
          minLon, minLat,
        ]),
        material: Cesium.Color.CYAN.withAlpha(0.03),
        outline: true,
        outlineColor: Cesium.Color.CYAN.withAlpha(0.5),
        outlineWidth: 2,
        height: 0,
      },
    });

    // ── Shared Primitive Collections for current particles ───────────────────
    const points = viewer.scene.primitives.add(new Cesium.PointPrimitiveCollection());
    const polylines = viewer.scene.primitives.add(new Cesium.PolylineCollection());
    pointsCollectionRef.current = points;
    linesCollectionRef.current = polylines;

    // ── Click & Hover Handler ────────────────────────────────────────────────
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    handler.setInputAction((click: any) => {
      const pickedObject = viewer.scene.pick(click.position);
      if (Cesium.defined(pickedObject) && pickedObject.id && (pickedObject.id as any)._floatSummary) {
        const f = (pickedObject.id as any)._floatSummary as FloatSummary;
        onSelectFloat(f);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    handler.setInputAction((movement: any) => {
      const pickedObject = viewer.scene.pick(movement.endPosition);
      if (Cesium.defined(pickedObject) && pickedObject.id) {
        if ((pickedObject.id as any)._floatSummary) {
          const f = (pickedObject.id as any)._floatSummary as FloatSummary;
          setHoverInfo({
            x: movement.endPosition.x,
            y: movement.endPosition.y,
            text: `Argo Float #${f.platform_number}`,
          });
        } else if ((pickedObject.id as any).oceanPoint) {
          const p = (pickedObject.id as any).oceanPoint;
          setHoverInfo({
            x: movement.endPosition.x,
            y: movement.endPosition.y,
            text: `${p.lat.toFixed(2)}°N, ${p.lon.toFixed(2)}°E | T: ${p.temp?.toFixed(1)}°C | S: ${p.salinity?.toFixed(2)} PSU | V: ${p.speed?.toFixed(3)} m/s`,
          });
        } else {
          setHoverInfo(null);
        }
      } else {
        setHoverInfo(null);
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    viewerRef.current = viewer;
    setContextRevision(v => v + 1);

    return () => {
      viewer.scene.postRender.removeEventListener(resolutionListener);
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      handler.destroy();
      viewer.destroy();
      viewerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Phase 0: Hover Sync via CustomEvent → ref mutation (zero React re-renders) ───
  useEffect(() => {
    const handleToggle = (_e: any) => {/* 3D mode toggle stub */};
    const handleSync = (e: any) => {
      hoverSyncDepthRef.current = e.detail.depth;
      const viewer = viewerRef.current;
      if (!viewer || !selectedFloat) return;
      const plane = viewer.entities.getById('hover-sync-plane');
      if (!plane) return;
      if (e.detail.depth !== null) {
        (plane as any).show = true;
        (plane.position as Cesium.ConstantPositionProperty).setValue(
          Cesium.Cartesian3.fromDegrees(selectedFloat.lon, selectedFloat.lat, -e.detail.depth * 400)
        );
      } else {
        (plane as any).show = false;
      }
      viewer.scene.requestRender();
    };
    window.addEventListener('toggle3DHologram', handleToggle);
    window.addEventListener('syncHoverDepth', handleSync);
    return () => {
      window.removeEventListener('toggle3DHologram', handleToggle);
      window.removeEventListener('syncHoverDepth', handleSync);
    };
  }, [selectedFloat]);

  // ─── Phase 2: Vertical Exaggeration Synchronization ────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    try {
      (viewer.scene.globe as any).terrainExaggeration = verticalExaggeration;
      viewer.scene.requestRender();
    } catch {
      // safe fallback if terrain exaggeration isn't supported on current provider
    }
  }, [verticalExaggeration]);

  // ─── Phase 2: Direct Store Depth Hover Sync ─────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !selectedFloat) return;
    const plane = viewer.entities.getById('hover-sync-plane');
    if (!plane) return;
    if (storeHoveredDepth !== null) {
      (plane as any).show = true;
      const z = -storeHoveredDepth * (verticalExaggeration * 10);
      (plane.position as Cesium.ConstantPositionProperty).setValue(
        Cesium.Cartesian3.fromDegrees(selectedFloat.lon, selectedFloat.lat, z)
      );
      
      const pingId = 'ping-' + Date.now() + Math.random();
      const startTime = performance.now();
      viewer.entities.add({
        id: pingId,
        position: Cesium.Cartesian3.fromDegrees(selectedFloat.lon, selectedFloat.lat, z),
        ellipse: {
          semiMinorAxis: new Cesium.CallbackProperty(() => {
             const t = (performance.now() - startTime) / 1000;
             return 25000.0 + t * 40000.0;
          }, false),
          semiMajorAxis: new Cesium.CallbackProperty(() => {
             const t = (performance.now() - startTime) / 1000;
             return 25000.0 + t * 40000.0 + 100.0; // Ensure strictly >= minor axis
          }, false),
          material: new Cesium.ColorMaterialProperty(new Cesium.CallbackProperty(() => {
             const t = (performance.now() - startTime) / 1000;
             const alpha = Math.max(0, 1.0 - t);
             return Cesium.Color.CYAN.withAlpha(alpha * 0.5);
          }, false)),
        }
      });
      setTimeout(() => {
        if (viewerRef.current && !viewerRef.current.isDestroyed()) {
          viewerRef.current.entities.removeById(pingId);
        }
      }, 1000);
    } else {
      (plane as any).show = false;
    }
    viewer.scene.requestRender();
  }, [storeHoveredDepth, selectedFloat, verticalExaggeration]);


  // ─── Camera select / deselect synchronization ─────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    const ssc = viewer.scene.screenSpaceCameraController;

    if (!selectedFloat) {
      viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
      ssc.minimumZoomDistance = 20000;
      ssc.maximumZoomDistance = 30000000;
      viewer.resolutionScale = 1.0;
      viewer.scene.requestRender();
    } else {
      const screenWidth = containerRef.current?.clientWidth || window.innerWidth;
      const isMobile = screenWidth < 768;
      const offsetLon = isMobile ? selectedFloat.lon : selectedFloat.lon - 0.25;

      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(offsetLon, selectedFloat.lat - 0.7, 150000),
        orientation: {
          heading: Cesium.Math.toRadians(12.0),
          pitch: Cesium.Math.toRadians(-35.0),
          roll: 0.0,
        },
        duration: 1.5,
        easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT,
        complete: () => {
          if (!viewer || viewer.isDestroyed()) return;
          const center = Cesium.Cartesian3.fromDegrees(selectedFloat.lon, selectedFloat.lat, 0);
          const transform = Cesium.Transforms.eastNorthUpToFixedFrame(center);
          const xOffset = isMobile ? 0 : 50000;
          viewer.camera.lookAtTransform(transform, new Cesium.Cartesian3(xOffset, -150000.0, 150000.0));
          const maxD = selectedFloat.max_depth || 2000;
          ssc.minimumZoomDistance = 100;
          ssc.maximumZoomDistance = Math.max(150000, maxD * 200);
          viewer.scene.requestRender();
        },
      });
    }
  }, [selectedFloat?.id]);

  // ─── Coordinate Grid (toggleable) ────────────────────────────────────────────
  // gridLayerRef tracks the actual ImageryLayer for O(1) instantaneous removal
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    if (showGrid) {
      if (!gridLayerRef.current) {
        const provider = new Cesium.GridImageryProvider({
          color: Cesium.Color.CYAN.withAlpha(0.22),
          backgroundColor: Cesium.Color.TRANSPARENT,
        });
        gridLayerRef.current = viewer.imageryLayers.addImageryProvider(provider);
        gridProviderRef.current = provider;
      }
    } else {
      if (gridLayerRef.current) {
        viewer.imageryLayers.remove(gridLayerRef.current, true);
        gridLayerRef.current = null;
        gridProviderRef.current = null;
      }
    }
    viewer.scene.requestRender();
  }, [showGrid, contextRevision]);

  // ─── Wavy Thermocline Isosurface Entity (Cesium Globe) ───────────────────────
  // Renders a glowing grid-material plane at the mean thermocline depth (~120m)
  // with subtle animated undulation emulated via CallbackProperty opacity pulse.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    viewer.entities.removeById('thermocline-isosurface');
    viewer.entities.removeById('thermocline-label');
    
    // Clean up old wavy lines
    const toRemove: Cesium.Entity[] = [];
    viewer.entities.values.forEach(e => {
       if (e.id && String(e.id).startsWith('wavy-iso-')) {
          toRemove.push(e);
       }
    });
    toRemove.forEach(e => viewer.entities.remove(e));

    if (!showThermocline) {
      viewer.scene.requestRender();
      return;
    }

    // Dynamic Z position: ~120m thermocline depth × 400× exaggeration
    const thermoclineDepthM = 120;
    const zScale = (verticalExaggeration || 40) * 10;
    const thermoclineZ = -thermoclineDepthM * zScale;

    const startTime = performance.now();
    
    // ── True Wavy Isosurface (Grid of Polylines) ──
    const nx = 15;
    const ny = 15;
    const dLon = (maxLon - minLon) / (nx - 1);
    const dLat = (maxLat - minLat) / (ny - 1);

    const material = new Cesium.PolylineGlowMaterialProperty({
      glowPower: 0.15,
      taperPower: 1,
      color: Cesium.Color.fromCssColorString('#06b6d4').withAlpha(0.55),
    });

    // Horizontal lines
    for (let j = 0; j < ny; j++) {
      const lat = minLat + j * dLat;
      viewer.entities.add({
         id: `wavy-iso-h-${j}`,
         polyline: {
            positions: new Cesium.CallbackProperty((time, result) => {
               const t = (performance.now() - startTime) / 1000.0;
               const pos = [];
               for (let i = 0; i < nx; i++) {
                 const lon = minLon + i * dLon;
                 // Gerstner / N^2 physics wave
                 const wave1 = Math.sin(lon * 5.0 + t * 1.2) * 0.04;
                 const wave2 = Math.cos(lat * 4.0 - t * 0.8) * 0.025;
                 const wave3 = Math.sin((lon + lat) * 8.0 + t * 2.0) * 0.01;
                 const zOffset = (wave1 + wave2 + wave3) * 150000; 
                 pos.push(Cesium.Cartesian3.fromDegrees(lon, lat, thermoclineZ + zOffset));
               }
               if (viewerRef.current && !viewerRef.current.isDestroyed()) {
                  viewerRef.current.scene.requestRender();
               }
               return pos;
            }, false),
            width: 2,
            material,
            clampToGround: false
         }
      });
    }

    // Vertical lines
    for (let i = 0; i < nx; i++) {
      const lon = minLon + i * dLon;
      viewer.entities.add({
         id: `wavy-iso-v-${i}`,
         polyline: {
            positions: new Cesium.CallbackProperty((time, result) => {
               const t = (performance.now() - startTime) / 1000.0;
               const pos = [];
               for (let j = 0; j < ny; j++) {
                 const lat = minLat + j * dLat;
                 const wave1 = Math.sin(lon * 5.0 + t * 1.2) * 0.04;
                 const wave2 = Math.cos(lat * 4.0 - t * 0.8) * 0.025;
                 const wave3 = Math.sin((lon + lat) * 8.0 + t * 2.0) * 0.01;
                 const zOffset = (wave1 + wave2 + wave3) * 150000; 
                 pos.push(Cesium.Cartesian3.fromDegrees(lon, lat, thermoclineZ + zOffset));
               }
               return pos;
            }, false),
            width: 2,
            material,
            clampToGround: false
         }
      });
    }

    viewer.entities.add({
      id: 'thermocline-label',
      position: Cesium.Cartesian3.fromDegrees((minLon + maxLon) / 2, maxLat + 0.2, thermoclineZ),
      label: {
        text: `≈ Thermocline (~${thermoclineDepthM}m)`,
        font: 'bold 11px monospace',
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        fillColor: Cesium.Color.fromCssColorString('#22d3ee'),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 3,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 8000000),
      },
    });

    viewer.scene.requestRender();
  }, [showThermocline, verticalExaggeration, minLon, minLat, maxLon, maxLat, contextRevision]);

  // ─── Automatic Cinematic Depth Zoom (Preview Sea Surface to Selected Depth) ──
  const prevDepthRef = useRef<number>(currentDepth);
  const flightTimeoutRef = useRef<any>(null);
  const originalCameraState = useRef<{
    destination: Cesium.Cartesian3;
    heading: number;
    pitch: number;
    roll: number;
  } | null>(null);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    // Trigger zoom when depth changes and is not 0 (e.g., 10m, 20m, 50m, etc.)
    if (currentDepth > 0 && Math.abs(currentDepth - prevDepthRef.current) >= 5 && !selectedFloat) {
      prevDepthRef.current = currentDepth;

      // 1. Clean up any active flight and pending timeout
      viewer.camera.cancelFlight();
      if (flightTimeoutRef.current) {
        clearTimeout(flightTimeoutRef.current);
        flightTimeoutRef.current = null;
      }

      // 2. Save current baseline camera state ONLY if we aren't already zoomed in
      if (!originalCameraState.current) {
        originalCameraState.current = {
          destination: viewer.camera.position.clone(),
          heading: viewer.camera.heading,
          pitch: viewer.camera.pitch,
          roll: viewer.camera.roll,
        };
      }

      // 3. Calculate Target & Bounding Sphere
      const cornerLon = maxLon + 0.35;
      const cornerLat = minLat;
      const zScale = (verticalExaggeration || 40) * 10;
      const verticalOffset = -currentDepth * zScale; // Uniform vertical exaggeration
      const midPoint = Cesium.Cartesian3.fromDegrees(cornerLon, cornerLat, verticalOffset / 2);
      const boundingSphere = new Cesium.BoundingSphere(midPoint, Math.max(25000, Math.abs(verticalOffset / 2)));

      // 4. Calculate Dynamic Range (prevents ground clipping and scales with depth)
      const cameraRange = Math.max(90000, currentDepth * 1800);

      // 5. Execute Centered Fly-In to Bounding Sphere (Side-profile looking into the grid)
      viewer.camera.flyToBoundingSphere(boundingSphere, {
        offset: new Cesium.HeadingPitchRange(
          Cesium.Math.toRadians(35.0),  // Side profile looking into domain
          Cesium.Math.toRadians(-20.0), // Shallow side-on pitch clearly exposing sea level vs depth gap
          cameraRange
        ),
        duration: 1.4,
        easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT,
        complete: () => {
          // 6. Dwell for 1.8s, then smoothly slide back to user's baseline perspective
          flightTimeoutRef.current = setTimeout(() => {
            if (viewerRef.current && !viewerRef.current.isDestroyed() && originalCameraState.current) {
              const targetState = originalCameraState.current;
              viewerRef.current.camera.flyTo({
                destination: targetState.destination,
                orientation: {
                  heading: targetState.heading,
                  pitch: targetState.pitch,
                  roll: targetState.roll,
                },
                duration: 2.0,
                easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
                complete: () => {
                  originalCameraState.current = null;
                },
              });
            }
          }, 1800);
        },
      });
    } else {
      prevDepthRef.current = currentDepth;
    }

    viewer.scene.requestRender();
  }, [currentDepth, selectedFloat, maxLon, minLat]);

  // ─── Ocean Fabric Raster + Current Particles ──────────────────────────────────
  // contextRevision is included so this re-runs after WebGL context recovery
  useEffect(() => {
    const viewer = viewerRef.current;
    const pointsCol = pointsCollectionRef.current;
    const linesCol = linesCollectionRef.current;
    if (!viewer || !pointsCol || !linesCol || !sliceData || !metadata) return;

    // Explicit WebGL memory cleanup: remove listener and all particle primitives
    if (particleSystemListenerRef.current) {
      viewer.scene.preUpdate.removeEventListener(particleSystemListenerRef.current);
      particleSystemListenerRef.current = null;
    }
    particlesRef.current = [];
    // removeAll() clears geometric data from GPU buffer — cheaper than destroy()
    // and safe since the collection itself is kept alive on the scene.
    pointsCol.removeAll();
    linesCol.removeAll();

    const varMeta = metadata.variables[currentVariable] || { min: 0, max: 100 };
    const zScale = (verticalExaggeration || 40) * 10;
    const verticalOffset = -currentDepth * zScale;

    // Depth-slice laser plane and 3D depth indicator (Surface to selected depth)
    viewer.entities.removeById('depth-slice-plane');
    viewer.entities.removeById('depth-indicator-gauge');
    viewer.entities.removeById('depth-indicator-arrow');
    viewer.entities.removeById('depth-indicator-label');

    if (currentDepth > 0) {
      viewer.entities.add({
        id: 'depth-slice-plane',
        polygon: {
          hierarchy: Cesium.Cartesian3.fromDegreesArray([
            minLon, minLat,
            maxLon, minLat,
            maxLon, maxLat,
            minLon, maxLat,
            minLon, minLat,
          ]),
          height: verticalOffset,
          material: new Cesium.GridMaterialProperty({
            color: Cesium.Color.CYAN.withAlpha(0.2),
            cellAlpha: 0.02,
            lineCount: new Cesium.Cartesian2(34, 32),
            lineThickness: new Cesium.Cartesian2(1.0, 1.0),
          }),
          outline: true,
          outlineColor: Cesium.Color.CYAN.withAlpha(0.6),
        },
      });

      // 3D Depth Indicator at the Domain Corner (Surface 0m to active depth only)
      const cornerLon = maxLon + 0.35;
      const cornerLat = minLat;

      // Vertical Indicator Line with dedicated brackets at Surface (0m) and Depth Slice
      viewer.entities.add({
        id: 'depth-indicator-arrow',
        polyline: {
          positions: [
            // Top arm connected directly to the edge/corner of the surface grid at (maxLon, minLat, 0)
            Cesium.Cartesian3.fromDegrees(maxLon, cornerLat, 0),
            Cesium.Cartesian3.fromDegrees(cornerLon, cornerLat, 0),
            // Vertical shaft from surface (0m) down to active depth level
            Cesium.Cartesian3.fromDegrees(cornerLon, cornerLat, verticalOffset),
            // Bottom arm connected directly to the edge/corner of the active depth grid slice
            Cesium.Cartesian3.fromDegrees(maxLon, cornerLat, verticalOffset),
          ],
          width: 5.0,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.45,
            color: Cesium.Color.fromCssColorString('#38bdf8'),
          }),
        },
      });

      // Top Sea-Level Anchor Ring & Pointer connected at the grid edge
      viewer.entities.add({
        id: 'depth-indicator-gauge',
        position: Cesium.Cartesian3.fromDegrees(maxLon, cornerLat, 0),
        point: {
          pixelSize: 8,
          color: Cesium.Color.fromCssColorString('#0284c7'),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: '▲ Sea Level (0m)',
          font: 'bold 12px monospace',
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          fillColor: Cesium.Color.CYAN,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
          pixelOffset: new Cesium.Cartesian2(12, -4),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });

      // 3D Depth Indicator Badge at active level with arrow pointer
      viewer.entities.add({
        id: 'depth-indicator-label',
        position: Cesium.Cartesian3.fromDegrees(cornerLon + 0.2, cornerLat, verticalOffset),
        label: {
          text: `▼ -${Math.round(currentDepth)}m (Selected Depth)`,
          font: 'bold 13px monospace',
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          fillColor: Cesium.Color.fromCssColorString('#38bdf8'),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          verticalOrigin: Cesium.VerticalOrigin.CENTER,
          horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
          pixelOffset: new Cesium.Cartesian2(8, 0),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        point: {
          pixelSize: 10,
          color: Cesium.Color.fromCssColorString('#38bdf8'),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
    }

    // ── Raster Layer A (primary or base timestep) ─────────────────────────────
    const dataUrlA = generateRasterFromPoints(
      sliceData.points, currentVariable, varMeta.min, varMeta.max, getColorForValue, bbox, colorMode, colorScaleMode
    );
    if (imageryLayerARef.current) {
      viewer.imageryLayers.remove(imageryLayerARef.current);
      imageryLayerARef.current = null;
    }
    if (dataUrlA) {
      // tileWidth/tileHeight must match what raster.ts generates: 20px per degree
      const tileWidth = Math.round((maxLon - minLon) * 20);
      const tileHeight = Math.round((maxLat - minLat) * 20);
      const providerA = new Cesium.SingleTileImageryProvider({
        url: dataUrlA,
        rectangle: Cesium.Rectangle.fromDegrees(minLon, minLat, maxLon, maxLat),
        tileWidth,
        tileHeight,
      });
      imageryLayerARef.current = viewer.imageryLayers.addImageryProvider(providerA);
      imageryLayerARef.current.alpha = 0.85;
    }

    // ── Raster Layer B (next timestep for crossfade) ──────────────────────────
    if (imageryLayerBRef.current) {
      viewer.imageryLayers.remove(imageryLayerBRef.current);
      imageryLayerBRef.current = null;
    }
    if (sliceDataB && sliceDataB.points.length > 0) {
      const dataUrlB = generateRasterFromPoints(
        sliceDataB.points, currentVariable, varMeta.min, varMeta.max, getColorForValue, bbox, colorMode, colorScaleMode
      );
      if (dataUrlB) {
        const tileWidth = Math.round((maxLon - minLon) * 20);
        const tileHeight = Math.round((maxLat - minLat) * 20);
        const providerB = new Cesium.SingleTileImageryProvider({
          url: dataUrlB,
          rectangle: Cesium.Rectangle.fromDegrees(minLon, minLat, maxLon, maxLat),
          tileWidth,
          tileHeight,
        });
        imageryLayerBRef.current = viewer.imageryLayers.addImageryProvider(providerB);
        // Alpha is controlled in the render loop for crossfade
      }
    }

    // ── Raster Layer Deltas (Anomaly raster) ──────────────────────────────────
    if (deltasLayerRef.current) {
      viewer.imageryLayers.remove(deltasLayerRef.current);
      deltasLayerRef.current = null;
    }
    if (showDeltas && deltasData && deltasData.length > 0) {
      const dataUrlDeltas = generateRasterFromPoints(
        deltasData, currentVariable, varMeta.min, varMeta.max, getColorForValue, bbox, colorMode, colorScaleMode, true
      );
      if (dataUrlDeltas) {
        const tileWidth = Math.round((maxLon - minLon) * 20);
        const tileHeight = Math.round((maxLat - minLat) * 20);
        const providerDeltas = new Cesium.SingleTileImageryProvider({
          url: dataUrlDeltas,
          rectangle: Cesium.Rectangle.fromDegrees(minLon, minLat, maxLon, maxLat),
          tileWidth,
          tileHeight,
        });
        deltasLayerRef.current = viewer.imageryLayers.addImageryProvider(providerDeltas);
        deltasLayerRef.current.alpha = 1.0; // Handled inside raster generator (rgba capping)
      }
    }

    // ── Current Particles ─────────────────────────────────────────────────────
    let currentParticleCount = 0;
    const MAX_PARTICLES = 600;

    sliceData.points.forEach((pt) => {
      if (showCurrents && pt.speed > 0.05 && currentParticleCount < MAX_PARTICLES) {
        if (Math.random() > 0.3) return;
        const particle = pointsCol.add({
          position: Cesium.Cartesian3.fromDegrees(pt.lon, pt.lat, verticalOffset + 50),
          color: Cesium.Color.CYAN.withAlpha(0.8),
          pixelSize: 4,
        });
        particlesRef.current.push({
          primitive: particle,
          baseLon: pt.lon,
          baseLat: pt.lat,
          u: pt.u,
          v: pt.v,
          age: Math.random() * 60,
          maxAge: 40 + Math.random() * 40,
          verticalOffset: verticalOffset + 50,
        });
        currentParticleCount++;
      }
    });

    if (showCurrents && particlesRef.current.length > 0) {
      const listener = () => {
        particlesRef.current.forEach(p => {
          p.age += 1;
          if (p.age > p.maxAge) p.age = 0;
          const scale = 0.015;
          const curLon = p.baseLon + (p.u / Math.cos(Cesium.Math.toRadians(p.baseLat))) * scale * p.age;
          const curLat = p.baseLat + p.v * scale * p.age;
          const alpha = Math.max(0, 1.0 - (p.age / p.maxAge));
          p.primitive.color = Cesium.Color.CYAN.withAlpha(alpha * 0.9);
          p.primitive.position = Cesium.Cartesian3.fromDegrees(curLon, curLat, p.verticalOffset);
        });
        // Particles are animated — they MUST call requestRender() on every tick
        viewer.scene.requestRender();
      };
      viewer.scene.preUpdate.addEventListener(listener);
      particleSystemListenerRef.current = listener;
    }

    // P0 fix: unconditional requestRender so depth/variable changes draw even with no particles
    viewer.scene.requestRender();
  }, [sliceData, sliceDataB, currentVariable, currentDepth, showCurrents, metadata, contextRevision, bbox, minLon, minLat, maxLon, maxLat, colorMode, colorScaleMode]);

  // ─── Phase 4: Crossfade alpha update (runs on timeFrac change, NO raster rebuild) ─
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const frac = showTemporalMorphing ? (timePosition - Math.floor(timePosition)) : 0;
    if (imageryLayerARef.current) imageryLayerARef.current.alpha = showTemporalMorphing ? 0.85 * (1 - frac) : 0.85;
    if (imageryLayerBRef.current) imageryLayerBRef.current.alpha = showTemporalMorphing ? 0.85 * frac : 0.0;
    viewer.scene.requestRender();
  }, [timePosition, showTemporalMorphing]);

  // ─── Argo Float Markers (batched) ─────────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    if ((viewer as any)._floatPoints) viewer.scene.primitives.remove((viewer as any)._floatPoints);
    if ((viewer as any)._floatLines) viewer.scene.primitives.remove((viewer as any)._floatLines);
    if ((viewer as any)._floatLabels) viewer.scene.primitives.remove((viewer as any)._floatLabels);
    if ((viewer as any)._floatHalos) viewer.scene.primitives.remove((viewer as any)._floatHalos);

    if (!showFloats) { viewer.scene.requestRender(); return; }

    const floatPoints = new Cesium.PointPrimitiveCollection();
    const floatLines = new Cesium.PolylineCollection();
    const floatLabels = new Cesium.LabelCollection();
    const floatHalos = new Cesium.PointPrimitiveCollection();

    (viewer as any)._floatPoints = floatPoints;
    (viewer as any)._floatLines = floatLines;
    (viewer as any)._floatLabels = floatLabels;
    (viewer as any)._floatHalos = floatHalos;

    viewer.scene.primitives.add(floatHalos);   // halo behind main dot
    viewer.scene.primitives.add(floatPoints);
    viewer.scene.primitives.add(floatLines);
    viewer.scene.primitives.add(floatLabels);

    // Distinct vivid colors, one per float slot (cycles if >15)
    const FLOAT_COLORS = [
      '#00FFFF', // cyan
      '#FFD700', // gold
      '#FF6B35', // orange-red
      '#A78BFA', // violet
      '#34D399', // emerald
      '#F472B6', // pink
      '#60A5FA', // sky blue
      '#FBBF24', // amber
      '#4ADE80', // green
      '#FB7185', // rose
      '#38BDF8', // light blue
      '#C084FC', // purple
      '#86EFAC', // light green
      '#FCA5A5', // light red
      '#67E8F9', // light cyan
    ];

    floats.forEach((f, idx) => {
      const isSelected = selectedFloat && selectedFloat.id === f.id;
      const hexColor = FLOAT_COLORS[idx % FLOAT_COLORS.length];

      const dotColor = Cesium.Color.fromCssColorString(hexColor).withAlpha(isSelected ? 1.0 : 0.92);
      const outlineColor = isSelected
        ? Cesium.Color.WHITE.withAlpha(1.0)
        : Cesium.Color.fromCssColorString(hexColor).brighten(0.4, new Cesium.Color()).withAlpha(0.7);

      const dotSize = isSelected ? 18 : 13;

      // ── Outer halo (large, semi-transparent) ─────────────────────────────
      floatHalos.add({
        position: Cesium.Cartesian3.fromDegrees(f.lon, f.lat, 100),
        color: Cesium.Color.fromCssColorString(hexColor).withAlpha(isSelected ? 0.35 : 0.18),
        pixelSize: isSelected ? 46 : 30,
        outlineWidth: 0,
      });

      // ── Main dot ─────────────────────────────────────────────────────────
      const p = floatPoints.add({
        position: Cesium.Cartesian3.fromDegrees(f.lon, f.lat, 200),
        color: dotColor,
        pixelSize: dotSize,
        outlineColor: outlineColor,
        outlineWidth: isSelected ? 3 : 2,
      });
      (p as any).id = { _floatSummary: f };

      // ── Float number label ────────────────────────────────────────────────
      floatLabels.add({
        position: Cesium.Cartesian3.fromDegrees(f.lon, f.lat, 1000),
        text: `◉ ${f.platform_number}`,
        font: `bold ${isSelected ? '13px' : '11px'} "Courier New", monospace`,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        fillColor: Cesium.Color.fromCssColorString(hexColor).withAlpha(1.0),
        outlineColor: Cesium.Color.BLACK.withAlpha(0.95),
        outlineWidth: 4,
        showBackground: true,
        backgroundColor: Cesium.Color.fromCssColorString('#000000').withAlpha(0.65),
        backgroundPadding: new Cesium.Cartesian2(8, 5),
        pixelOffset: new Cesium.Cartesian2(0, -(dotSize + 10)),
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        // Always show labels — only hide when very far away (zoomed to global)
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 12000000),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        scale: isSelected ? 1.2 : 1.0,
      });

      // ── Tether line to seafloor ───────────────────────────────────────────
      const depth = f.max_depth || 2000;
      const zScale = (verticalExaggeration || 40) * 10;
      floatLines.add({
        positions: [
          Cesium.Cartesian3.fromDegrees(f.lon, f.lat, 200),
          Cesium.Cartesian3.fromDegrees(f.lon, f.lat, -depth * zScale),
        ],
        width: isSelected ? 3 : 1.5,
        material: Cesium.Material.fromType('Color', {
          color: Cesium.Color.fromCssColorString(hexColor).withAlpha(isSelected ? 0.7 : 0.35),
        }),
      });

      // ── Lagrangian Simulated Drift Path at 1000m Parking Depth ─────────────
      const drift = simulatedDrifts[f.id];
      if (drift && drift.drift_path && drift.drift_path.length > 1) {
        const parkingDepth = drift.parking_depth || 1000;
        const driftCartesians = drift.drift_path.map((pt) =>
          Cesium.Cartesian3.fromDegrees(pt.lon, pt.lat, -parkingDepth * zScale)
        );

        floatLines.add({
          positions: driftCartesians,
          width: isSelected ? 3.5 : 2.0,
          material: Cesium.Material.fromType('PolylineDash', {
            color: Cesium.Color.fromCssColorString(hexColor).withAlpha(isSelected ? 0.95 : 0.65),
            dashLength: 16.0,
          }),
        });

        // Drift waypoints
        driftCartesians.forEach((pos, ptIdx) => {
          if (ptIdx > 0) {
            floatPoints.add({
              position: pos,
              color: Cesium.Color.fromCssColorString(hexColor).withAlpha(isSelected ? 0.9 : 0.5),
              pixelSize: isSelected ? 6 : 4,
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 1,
            });
          }
        });
      }
    });

    viewer.scene.requestRender();
  }, [floats, showFloats, selectedFloat, contextRevision, verticalExaggeration, simulatedDrifts]);


  // ─── Fetch Contours & Deltas ─────────────────────────────────────────────
  useEffect(() => {
    const activeDates = timeSteps.length > 0 ? timeSteps : metadata?.time_steps;
    if (!activeDates || !activeDates.length) return;
    const baseIdx = Math.min(Math.floor(timePosition), activeDates.length - 1);
    const dateStr = activeDates[baseIdx];

    if (showContours) {
      if (contoursCacheRef.current[dateStr]) {
        setContoursData(contoursCacheRef.current[dateStr]);
      } else {
        fetchContours(dateStr).then(res => {
          contoursCacheRef.current[dateStr] = res.contours;
          setContoursData(res.contours);
        }).catch(e => console.error('Failed to fetch contours:', e));
      }
    }

    if (showDeltas) {
      const cacheKey = `${dateStr}-${currentVariable}-${currentDepth}`;
      if (deltasCacheRef.current[cacheKey]) {
        setDeltasData(deltasCacheRef.current[cacheKey]);
      } else {
        fetchDeltas(dateStr, currentVariable, currentDepth).then(res => {
          deltasCacheRef.current[cacheKey] = res.points;
          setDeltasData(res.points);
        }).catch(e => console.error('Failed to fetch deltas:', e));
      }
    }
  }, [showContours, showDeltas, timePosition, metadata, currentVariable, currentDepth, timeSteps]);

  // ─── Render Contours ────────────────────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    if (!showContours || contoursData.length === 0) {
      viewer.entities.values.forEach(e => {
        if (e.id && String(e.id).startsWith('contour-')) {
          e.show = false;
        }
      });
      viewer.scene.requestRender();
      return;
    }

    const tFrac = showTemporalMorphing ? (timePosition - Math.floor(timePosition)) : 0;
    
    contoursData.forEach((c: any) => {
      const id = `contour-${c.id}`;
      const labelId = `contour-label-${c.id}`;
      
      const positions = c.points.map((p: any) => {
        // Force positive altitude so it floats above the opaque globe surface
        const baseZ = c.depth === 40 ? 15000 : 25000;
        return Cesium.Cartesian3.fromDegrees(p.lon, p.lat, baseZ);
      });

      let entity = viewer.entities.getById(id);
      if (!entity) {
        // Draw-in reveal material
        const material = new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.15,
          taperPower: 1,
          color: Cesium.Color.fromCssColorString(c.color).withAlpha(0.9),
        });

        viewer.entities.add({
          id,
          polyline: {
            positions: positions,
            width: 5,
            material: material,
            clampToGround: false,
          }
        });
      } else {
        entity.show = true;
        // In-place update positions
        (entity.polyline!.positions as any) = new Cesium.ConstantProperty(positions);
      }

      // Add label somewhere in the middle
      if (c.points.length > 0) {
        const midPoint = c.points[Math.floor(c.points.length / 2)];
        const labelZ = c.depth === 40 ? 15000 : 25000;
        let labelEntity = viewer.entities.getById(labelId);
        const textMap: any = {
          'mld-ring': 'MLD Front ~40m',
          'thermocline-ring': '20°C Isotherm'
        };
        const text = textMap[c.id] || c.id;

        if (!labelEntity) {
          viewer.entities.add({
            id: labelId,
            position: Cesium.Cartesian3.fromDegrees(midPoint.lon, midPoint.lat, labelZ + 5000),
            label: {
              text: text,
              font: 'bold 12px "Courier New", monospace',
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              fillColor: Cesium.Color.fromCssColorString(c.color),
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 3,
              showBackground: true,
              backgroundColor: Cesium.Color.BLACK.withAlpha(0.5),
              backgroundPadding: new Cesium.Cartesian2(7, 4),
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            }
          });
        } else {
          labelEntity.show = true;
          (labelEntity.position as any) = new Cesium.ConstantPositionProperty(
            Cesium.Cartesian3.fromDegrees(midPoint.lon, midPoint.lat, labelZ + 5000)
          );
        }
      }
    });
    
    // Hide leftovers
    const currentIds = contoursData.map(c => `contour-${c.id}`);
    viewer.entities.values.forEach(e => {
      const eid = String(e.id);
      if (eid.startsWith('contour-') && !eid.includes('label')) {
        if (!currentIds.includes(eid)) e.show = false;
      }
      if (eid.startsWith('contour-label-')) {
        const baseId = eid.replace('contour-label-', 'contour-');
        if (!currentIds.includes(baseId)) e.show = false;
      }
    });

    viewer.scene.requestRender();
  }, [contoursData, showContours, verticalExaggeration, timePosition, showTemporalMorphing, contextRevision]);

  // ─── Render Deltas Annotations (Hotspots) ──────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    if (!showDeltas || !deltasData || deltasData.length === 0) {
      viewer.entities.values.forEach(e => {
        if (e.id && String(e.id).startsWith('delta-hotspot-')) {
          e.show = false;
        }
      });
      viewer.scene.requestRender();
      return;
    }

    // Find top 3 hotspots
    const sorted = [...deltasData].filter(d => d.norm_delta != null && d.norm_delta > 0.6).sort((a, b) => b.norm_delta - a.norm_delta);
    
    // Simple spatial deduplication to avoid clustering
    const hotspots: any[] = [];
    for (const d of sorted) {
      if (hotspots.length >= 3) break;
      const isTooClose = hotspots.some(h => Math.hypot(h.lon - d.lon, h.lat - d.lat) < 2.0);
      if (!isTooClose) hotspots.push(d);
    }

    const currentIds = hotspots.map((_, i) => `delta-hotspot-${i}`);

    hotspots.forEach((h, i) => {
      const id = `delta-hotspot-${i}`;
      const zScale = (verticalExaggeration || 40) * 10;
      const pos = Cesium.Cartesian3.fromDegrees(h.lon, h.lat, 15000);
      
      let entity = viewer.entities.getById(id);
      if (!entity) {
        viewer.entities.add({
          id,
          position: pos,
          point: {
            pixelSize: 15,
            color: Cesium.Color.RED.withAlpha(0.8),
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 3,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          label: {
            text: `⚠️ Active Anomaly\nΔ +${h.delta.toFixed(2)}`,
            font: 'bold 11px "Courier New", monospace',
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 3,
            showBackground: true,
            backgroundColor: Cesium.Color.RED.withAlpha(0.6),
            backgroundPadding: new Cesium.Cartesian2(6, 4),
            pixelOffset: new Cesium.Cartesian2(0, -25),
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          }
        });
      } else {
        entity.show = true;
        (entity.position as any) = new Cesium.ConstantPositionProperty(pos);
        if (entity.label) {
           (entity.label.text as any) = new Cesium.ConstantProperty(`⚠️ Active Anomaly\nΔ +${h.delta.toFixed(2)}`);
        }
      }
    });

    viewer.entities.values.forEach(e => {
      if (e.id && String(e.id).startsWith('delta-hotspot-') && !currentIds.includes(String(e.id))) {
        e.show = false;
      }
    });

    viewer.scene.requestRender();
  }, [deltasData, showDeltas, verticalExaggeration, contextRevision]);


  // ─── Camera Fly-To Presets ────────────────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !flyToTarget) return;
    const presets: Record<string, { lon: number; lat: number; alt: number; pitch: number; heading?: number }> = {
      bay_of_bengal: { lon: 88.5, lat: 14.0, alt: 3200000, pitch: -62 },
      full_india: { lon: 82.0, lat: 18.0, alt: 5200000, pitch: -80 },
      andaman: { lon: 93.5, lat: 11.5, alt: 1200000, pitch: -50, heading: 350 },
      chennai: { lon: 83.0, lat: 13.5, alt: 1400000, pitch: -48, heading: 15 },
    };
    const p = presets[flyToTarget];
    if (!p) return;
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(p.lon, p.lat, p.alt),
      orientation: {
        heading: Cesium.Math.toRadians(p.heading ?? 0),
        pitch: Cesium.Math.toRadians(p.pitch),
        roll: 0.0,
      },
      duration: 1.8,
      complete: onFlyToDone,
    });
  }, [flyToTarget, onFlyToDone]);

  // ─── Focus Mode: Selected Float — Tether + Stratified Nodes ──────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    viewer.entities.removeById('selected-float-hologram');
    viewer.entities.removeById('hover-sync-plane');
    viewer.entities.removeById('target-lock-reticle');

    if ((viewer as any)._hologramPoints) {
      viewer.scene.primitives.remove((viewer as any)._hologramPoints);
      (viewer as any)._hologramPoints = null;
    }

    if (selectedFloat) {
      const zScale = (verticalExaggeration || 40) * 10;
      const maxDepth = (selectedFloat.max_depth || 2000) * zScale;

      // Glowing tether (animated descent)
      let animatedDepth = 0;
      const startTime = performance.now();
      const duration = 2000;
      
      const positionsProperty = new Cesium.CallbackProperty(() => {
        const now = performance.now();
        const p = Math.min((now - startTime) / duration, 1.0);
        // Easing function (easeOutQuart)
        const ease = 1 - Math.pow(1 - p, 4);
        animatedDepth = ease * maxDepth;
        if (p < 1.0 && viewerRef.current) viewerRef.current.scene.requestRender();
        return [
          Cesium.Cartesian3.fromDegrees(selectedFloat.lon, selectedFloat.lat, 0),
          Cesium.Cartesian3.fromDegrees(selectedFloat.lon, selectedFloat.lat, -animatedDepth),
        ];
      }, false);

      viewer.entities.add({
        id: 'selected-float-hologram',
        polyline: {
          positions: positionsProperty,
          width: 4.0,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.25,
            color: Cesium.Color.CYAN,
            taperPower: 0.5,
          }),
        },
      });

      // Stratified depth nodes colored by temperature
      if (selectedFloatProfile?.data) {
        const hologramPoints = new Cesium.PointPrimitiveCollection();
        (viewer as any)._hologramPoints = hologramPoints;
        viewer.scene.primitives.add(hologramPoints);

        const data = selectedFloatProfile.data;
        const tMin = Math.min(...data.map((d: any) => d.temp));
        const tMax = Math.max(...data.map((d: any) => d.temp));
        const zScale = (verticalExaggeration || 40) * 10;

        data.forEach((d: any) => {
          const z = -d.depth * zScale;
          const { cesiumColor } = getColorForValue(d.temp, 'temp', tMin, tMax, colorMode, colorScaleMode);
          hologramPoints.add({
            position: Cesium.Cartesian3.fromDegrees(selectedFloat.lon, selectedFloat.lat, z),
            color: cesiumColor,
            pixelSize: 8,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          });
        });
      }

      // Hover sync plane — pre-created hidden, mutated cheaply by the event listener
      viewer.entities.add({
        id: 'hover-sync-plane',
        position: Cesium.Cartesian3.fromDegrees(selectedFloat.lon, selectedFloat.lat, 0),
        ellipse: {
          semiMinorAxis: 25000.0,
          semiMajorAxis: 25000.0,
          material: new Cesium.GridMaterialProperty({
            color: Cesium.Color.CYAN.withAlpha(0.6),
            cellAlpha: 0.1,
            lineCount: new Cesium.Cartesian2(4, 4),
            lineThickness: new Cesium.Cartesian2(1.5, 1.5),
          }),
          outline: true,
          outlineColor: Cesium.Color.CYAN,
          outlineWidth: 3,
        },
        show: false,
      });

      viewer.entities.add({
        id: 'target-lock-reticle',
        position: Cesium.Cartesian3.fromDegrees(selectedFloat.lon, selectedFloat.lat, 50),
        ellipse: {
          semiMinorAxis: 4000.0,
          semiMajorAxis: 4000.0,
          material: new Cesium.ColorMaterialProperty(new Cesium.CallbackProperty(() => {
            const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 150);
            return Cesium.Color.fromCssColorString('#f43f5e').withAlpha(pulse * 0.8);
          }, false)),
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString('#f43f5e'),
          outlineWidth: 3,
        }
      });
    }
    viewer.scene.requestRender();
  }, [selectedFloat, selectedFloatProfile, colorMode, colorScaleMode, contextRevision]);

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {hoverInfo && (
        <div
          className="absolute z-40 bg-slate-950/90 backdrop-blur-md border border-cyan-500/60 rounded-lg px-3 py-1.5 text-[11px] font-mono text-cyan-200 pointer-events-none shadow-xl transform -translate-x-1/2 -translate-y-12"
          style={{ left: `${hoverInfo.x}px`, top: `${hoverInfo.y}px` }}
        >
          {hoverInfo.text}
        </div>
      )}
    </div>
  );
};
