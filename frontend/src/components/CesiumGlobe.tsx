import React, { useEffect, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { OceanMetadata, SliceData, FloatSummary, VariableKey } from '../types/ocean';
import { getColorForValue } from '../utils/colormaps';

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
}

export const CesiumGlobe: React.FC<CesiumGlobeProps> = ({
  metadata,
  sliceData,
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
  const floatsEntitiesRef = useRef<Cesium.Entity[]>([]);
  const particlesRef = useRef<any[]>([]);
  const particleSystemListenerRef = useRef<any>(null);
  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number; text: string } | null>(null);
  const [is3DMode, setIs3DMode] = useState(false);

  // Listen for 3D Hologram Mode Toggle from FloatDrawer
  useEffect(() => {
    const handleToggle = (e: any) => setIs3DMode(e.detail.enabled);
    window.addEventListener('toggle3DHologram', handleToggle);
    return () => window.removeEventListener('toggle3DHologram', handleToggle);
  }, []);

  // Initialize Cesium Viewer
  useEffect(() => {
    if (!containerRef.current) return;

    // Use default ImageryProvider (OpenStreetMap / Natural Earth)
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
    });

    // Darker ocean atmosphere styling
    viewer.scene.globe.enableLighting = true;
    viewer.scene.globe.depthTestAgainstTerrain = false;
    
    // Smooth, Blender-like Camera Controls
    const ssc = viewer.scene.screenSpaceCameraController;
    ssc.minimumZoomDistance = 20000;
    ssc.maximumZoomDistance = 30000000;
    ssc.inertiaSpin = 0.9;
    ssc.inertiaTranslate = 0.9;
    ssc.inertiaZoom = 0.9;

    // Blender mapping: 
    // - Scroll: Zoom (Default)
    // - Middle Drag: Orbit (Tilt)
    // - Shift + Middle Drag: Pan (Translate)
    // - Left Drag: Rotate Globe (Default)
    ssc.tiltEventTypes = [
      Cesium.CameraEventType.MIDDLE_DRAG, 
      Cesium.CameraEventType.PINCH,
      { eventType: Cesium.CameraEventType.LEFT_DRAG, modifier: Cesium.KeyboardEventModifier.CTRL },
      { eventType: Cesium.CameraEventType.RIGHT_DRAG, modifier: Cesium.KeyboardEventModifier.CTRL }
    ];
    ssc.translateEventTypes = [
      Cesium.CameraEventType.RIGHT_DRAG,
      { eventType: Cesium.CameraEventType.MIDDLE_DRAG, modifier: Cesium.KeyboardEventModifier.SHIFT }
    ];

    // Set initial camera view centered on Bay of Bengal / India
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(88.5, 14.0, 3200000),
      orientation: {
        heading: Cesium.Math.toRadians(0.0),
        pitch: Cesium.Math.toRadians(-62.0),
        roll: 0.0,
      },
    });

    // Add Indian EEZ Bay of Bengal Boundary Polygon
    viewer.entities.add({
      name: "India EEZ - Bay of Bengal Sector",
      polygon: {
        hierarchy: Cesium.Cartesian3.fromDegreesArray([
          80.0, 6.0,
          97.0, 6.0,
          97.0, 22.0,
          80.0, 22.0,
          80.0, 6.0
        ]),
        material: Cesium.Color.CYAN.withAlpha(0.03),
        outline: true,
        outlineColor: Cesium.Color.CYAN.withAlpha(0.5),
        outlineWidth: 2,
        height: 0,
      }
    });

    // Setup Point and Polyline Collections
    const points = viewer.scene.primitives.add(new Cesium.PointPrimitiveCollection());
    const polylines = viewer.scene.primitives.add(new Cesium.PolylineCollection());
    pointsCollectionRef.current = points;
    linesCollectionRef.current = polylines;

    // Setup Click & Hover Handler
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    
    // Left click on float entity
    handler.setInputAction((click: any) => {
      const pickedObject = viewer.scene.pick(click.position);
      if (Cesium.defined(pickedObject) && pickedObject.id && pickedObject.id._floatSummary) {
        const f = pickedObject.id._floatSummary;
        onSelectFloat(f);
        
        // Cinematic Camera Swoop to target
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(f.lon, f.lat - 1.2, 350000),
          orientation: {
            heading: Cesium.Math.toRadians(0.0),
            pitch: Cesium.Math.toRadians(-55.0),
            roll: 0.0,
          },
          duration: 2.0,
          easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT,
        });
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // Mouse move for hover inspection
    handler.setInputAction((movement: any) => {
      const pickedObject = viewer.scene.pick(movement.endPosition);
      if (Cesium.defined(pickedObject) && pickedObject.primitive && pickedObject.id && pickedObject.id.oceanPoint) {
        const p = pickedObject.id.oceanPoint;
        setHoverInfo({
          x: movement.endPosition.x,
          y: movement.endPosition.y,
          text: `Lat: ${p.lat}°N, Lon: ${p.lon}°E | Temp: ${p.temp}°C | Sal: ${p.salinity} PSU | Current: ${p.speed} m/s`,
        });
      } else {
        setHoverInfo(null);
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    viewerRef.current = viewer;

    return () => {
      handler.destroy();
      if (!viewer.isDestroyed()) {
        viewer.destroy();
      }
      viewerRef.current = null;
    };
  }, []);

  // Dynamic Responsive Coordinate Grid
  const gridProviderRef = useRef<any>(null);
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    if (showGrid) {
      if (!gridProviderRef.current) {
        gridProviderRef.current = new Cesium.GridImageryProvider({
          color: Cesium.Color.CYAN.withAlpha(0.2),
          // Using standard GridImageryProvider options
          backgroundColor: Cesium.Color.TRANSPARENT,
        });
        viewer.imageryLayers.addImageryProvider(gridProviderRef.current);
      }
    } else {
      if (gridProviderRef.current) {
        for (let i = 0; i < viewer.imageryLayers.length; i++) {
          const layer = viewer.imageryLayers.get(i);
          if (layer.imageryProvider === gridProviderRef.current) {
            viewer.imageryLayers.remove(layer);
            break;
          }
        }
        gridProviderRef.current = null;
      }
    }
  }, [showGrid]);

  // Update 3D Point Cloud & Current Vectors when sliceData, variable, or depth changes
  useEffect(() => {
    const viewer = viewerRef.current;
    const pointsCol = pointsCollectionRef.current;
    const linesCol = linesCollectionRef.current;
    if (!viewer || !pointsCol || !linesCol || !sliceData || !metadata) return;

    if (particleSystemListenerRef.current) {
        viewer.scene.preUpdate.removeEventListener(particleSystemListenerRef.current);
        particleSystemListenerRef.current = null;
    }
    particlesRef.current = [];

    pointsCol.removeAll();
    linesCol.removeAll();

    const varMeta = metadata.variables[currentVariable] || { min: 0, max: 100 };
    // Exaggerate depth for 3D ocean column visualization (1m depth -> 400m altitude offset below sea level)
    const verticalOffset = -currentDepth * 400;

    // Volumetric Depth Slicing "Laser-Cut" Effect Plane
    viewer.entities.removeById('depth-slice-plane');
    if (currentDepth > 0) {
      viewer.entities.add({
        id: 'depth-slice-plane',
        polygon: {
          hierarchy: Cesium.Cartesian3.fromDegreesArray([
            68.0, 6.0,
            97.0, 6.0,
            97.0, 24.0,
            68.0, 24.0,
            68.0, 6.0
          ]),
          height: verticalOffset,
          material: new Cesium.GridMaterialProperty({
            color: Cesium.Color.CYAN.withAlpha(0.2),
            cellAlpha: 0.02,
            lineCount: new Cesium.Cartesian2(40, 30),
            lineThickness: new Cesium.Cartesian2(1.0, 1.0),
          }),
          outline: true,
          outlineColor: Cesium.Color.CYAN.withAlpha(0.6),
        },
      });
    }

    sliceData.points.forEach((pt) => {
      let val = pt.temp;
      if (currentVariable === 'salinity') val = pt.salinity;
      else if (currentVariable === 'density') val = pt.density;
      else if (currentVariable === 'current_speed') val = pt.speed;

      const { cesiumColor } = getColorForValue(val, currentVariable, varMeta.min, varMeta.max);

      // Add 3D Point Primitive
      const pointPrimitive = pointsCol.add({
        position: Cesium.Cartesian3.fromDegrees(pt.lon, pt.lat, verticalOffset),
        color: cesiumColor,
        pixelSize: 8,
        outlineColor: Cesium.Color.BLACK.withAlpha(0.6),
        outlineWidth: 1.5,
      });
      // Attach metadata for tooltip
      (pointPrimitive as any).oceanPoint = pt;

      // WebGL Particle Trail Animation for Currents
      if (showCurrents && pt.speed > 0.05) {
          const particle = pointsCol.add({
              position: Cesium.Cartesian3.fromDegrees(pt.lon, pt.lat, verticalOffset + 50),
              color: Cesium.Color.CYAN.withAlpha(0.8),
              pixelSize: 5,
          });
          particlesRef.current.push({
              primitive: particle,
              baseLon: pt.lon,
              baseLat: pt.lat,
              u: pt.u,
              v: pt.v,
              age: Math.random() * 60,
              maxAge: 60 + Math.random() * 20,
              verticalOffset: verticalOffset + 50
          });
      }
    });

    if (showCurrents && particlesRef.current.length > 0) {
        const listener = () => {
            particlesRef.current.forEach(p => {
                p.age += 1;
                if (p.age > p.maxAge) p.age = 0;
                
                const scale = 0.015; // speed scalar for visual animation
                const curLon = p.baseLon + (p.u / Math.cos(Cesium.Math.toRadians(p.baseLat))) * scale * p.age;
                const curLat = p.baseLat + p.v * scale * p.age;
                
                // Trail fade out effect
                const alpha = Math.max(0, 1.0 - (p.age / p.maxAge));
                p.primitive.color = Cesium.Color.CYAN.withAlpha(alpha * 0.9);
                p.primitive.position = Cesium.Cartesian3.fromDegrees(curLon, curLat, p.verticalOffset);
            });
        };
        viewer.scene.preUpdate.addEventListener(listener);
        particleSystemListenerRef.current = listener;
    }
  }, [sliceData, currentVariable, currentDepth, showCurrents, metadata]);

  // Update Argo Float Markers
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    // Clear existing float entities
    floatsEntitiesRef.current.forEach((e) => viewer.entities.remove(e));
    floatsEntitiesRef.current = [];

    if (!showFloats) return;

    floats.forEach((f) => {
      // Create SVG beacon marker canvas
      const canvas = document.createElement('canvas');
      canvas.width = 36;
      canvas.height = 36;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Outer glowing ring
        ctx.beginPath();
        ctx.arc(18, 18, 14, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(245, 158, 11, 0.25)';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#f59e0b';
        ctx.stroke();

        // Inner solid dot
        ctx.beginPath();
        ctx.arc(18, 18, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#fbbf24';
        ctx.fill();
      }

      const entity = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(f.lon, f.lat, 1000),
        billboard: {
          image: canvas,
          verticalOrigin: Cesium.VerticalOrigin.CENTER,
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          scale: 1.0,
          eyeOffset: new Cesium.Cartesian3(0, 0, -1000),
        },
        label: {
          text: `WMO ${f.platform_number}`,
          font: '10px JetBrains Mono, monospace',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, 24),
          eyeOffset: new Cesium.Cartesian3(0, 0, -1000),
        },
      });

      (entity as any)._floatSummary = f;
      floatsEntitiesRef.current.push(entity);
    });
  }, [floats, showFloats]);

  // Handle Camera Fly-To Presets
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !flyToTarget) return;

    if (flyToTarget === 'bay_of_bengal') {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(88.5, 14.0, 3200000),
        orientation: {
          heading: Cesium.Math.toRadians(0.0),
          pitch: Cesium.Math.toRadians(-62.0),
          roll: 0.0,
        },
        duration: 1.8,
        complete: onFlyToDone,
      });
    } else if (flyToTarget === 'full_india') {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(82.0, 18.0, 5200000),
        orientation: {
          heading: Cesium.Math.toRadians(0.0),
          pitch: Cesium.Math.toRadians(-80.0),
          roll: 0.0,
        },
        duration: 2.0,
        complete: onFlyToDone,
      });
    } else if (flyToTarget === 'andaman') {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(93.5, 11.5, 1200000),
        orientation: {
          heading: Cesium.Math.toRadians(350.0),
          pitch: Cesium.Math.toRadians(-50.0),
          roll: 0.0,
        },
        duration: 1.8,
        complete: onFlyToDone,
      });
    } else if (flyToTarget === 'chennai') {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(83.0, 13.5, 1400000),
        orientation: {
          heading: Cesium.Math.toRadians(15.0),
          pitch: Cesium.Math.toRadians(-48.0),
          roll: 0.0,
        },
        duration: 1.8,
        complete: onFlyToDone,
      });
    }
  }, [flyToTarget, onFlyToDone]);

  // Localized Volumetric Hologram, 3D T-S Scatter, and Animated Profile Drop
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    viewer.entities.removeById('selected-float-hologram');
    viewer.entities.removeById('animated-probe');
    // Remove old scatter points and particle listeners
    if ((viewer as any)._hologramPoints) {
      viewer.scene.primitives.remove((viewer as any)._hologramPoints);
      (viewer as any)._hologramPoints = null;
    }
    if ((viewer as any)._dispersalPoints) {
      viewer.scene.primitives.remove((viewer as any)._dispersalPoints);
      (viewer as any)._dispersalPoints = null;
    }
    if ((viewer as any)._floatParticleListener) {
      viewer.scene.preUpdate.removeEventListener((viewer as any)._floatParticleListener);
      (viewer as any)._floatParticleListener = null;
    }

    if (selectedFloat) {
      // Provide a fallback depth in case max_depth is undefined or 0 to prevent NaN crash
      const depth = (selectedFloat.max_depth || 2000) * 400; 
      
      // The Base Cylinder (Volumetric highlight)
      viewer.entities.add({
        id: 'selected-float-hologram',
        position: Cesium.Cartesian3.fromDegrees(selectedFloat.lon, selectedFloat.lat, -depth / 2),
        cylinder: {
          length: depth,
          topRadius: 6000.0, 
          bottomRadius: 6000.0,
          material: Cesium.Color.ORANGE.withAlpha(0.1),
          outline: true,
          outlineColor: Cesium.Color.ORANGE.withAlpha(0.5),
          outlineWidth: 1.0,
        },
      });

      // 3D Holographic Mode (Idea 1 & Idea 2)
      if (is3DMode && selectedFloatProfile && selectedFloatProfile.data) {
        
        // 1. Animated Profile Probe (Idea 1)
        const startTime = Date.now();
        viewer.entities.add({
          id: 'animated-probe',
          position: new Cesium.CallbackProperty(() => {
            const elapsed = (Date.now() - startTime) / 1000.0;
            const cycleDuration = 4.0; // 4 seconds to drop
            const t = (elapsed % cycleDuration) / cycleDuration;
            const currentZ = -depth * t;
            return Cesium.Cartesian3.fromDegrees(selectedFloat.lon, selectedFloat.lat, currentZ);
          }, false),
          point: {
            pixelSize: 15,
            color: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.CYAN,
            outlineWidth: 3,
            disableDepthTestDistance: Number.POSITIVE_INFINITY
          }
        });

        // 2. Holographic 3D Scatter Plot (T-S Diagram) (Idea 2)
        // Offset the plot slightly to the east of the float
        const plotLonOffset = selectedFloat.lon + 0.3;
        const plotLatOffset = selectedFloat.lat;
        
        const hologramPoints = new Cesium.PointPrimitiveCollection();
        (viewer as any)._hologramPoints = hologramPoints;
        viewer.scene.primitives.add(hologramPoints);

        const data = selectedFloatProfile.data;
        // Find bounds to normalize the plot
        const tMin = Math.min(...data.map((d: any) => d.temp));
        const tMax = Math.max(...data.map((d: any) => d.temp));
        const sMin = Math.min(...data.map((d: any) => d.psal));
        const sMax = Math.max(...data.map((d: any) => d.psal));

        data.forEach((d: any) => {
          // Normalize T (X-axis offset) and S (Y-axis offset) between -0.2 and 0.2 degrees
          const normT = ((d.temp - tMin) / (tMax - tMin || 1)) * 0.4 - 0.2;
          const normS = ((d.psal - sMin) / (sMax - sMin || 1)) * 0.4 - 0.2;
          
          const z = -d.depth * 400; // Map depth to Z axis

          const { cesiumColor } = getColorForValue(d.temp, 'temp', tMin, tMax);

          hologramPoints.add({
            position: Cesium.Cartesian3.fromDegrees(plotLonOffset + normT, plotLatOffset + normS, z),
            color: cesiumColor,
            pixelSize: 6,
            disableDepthTestDistance: Number.POSITIVE_INFINITY
          });
        });

        // 3. Time-Warp Particle Trajectories (Idea 5)
        // Find nearest grid point to get local surface current (u, v) for the particles
        let localU = 0; let localV = 0;
        if (sliceData && sliceData.points.length > 0) {
          const nearest = sliceData.points.reduce((prev: any, curr: any) => {
            const dPrev = Math.pow(prev.lon - selectedFloat.lon, 2) + Math.pow(prev.lat - selectedFloat.lat, 2);
            const dCurr = Math.pow(curr.lon - selectedFloat.lon, 2) + Math.pow(curr.lat - selectedFloat.lat, 2);
            return (dCurr < dPrev) ? curr : prev;
          });
          localU = nearest.u || 0.1;
          localV = nearest.v || 0.1;
        }

        const dispersalPoints = new Cesium.PointPrimitiveCollection();
        (viewer as any)._dispersalPoints = dispersalPoints;
        viewer.scene.primitives.add(dispersalPoints);

        const floatParticles: any[] = [];
        for (let i = 0; i < 60; i++) {
          const pZ = -Math.random() * depth;
          const particle = dispersalPoints.add({
            position: Cesium.Cartesian3.fromDegrees(selectedFloat.lon, selectedFloat.lat, pZ),
            color: Cesium.Color.CYAN.withAlpha(0.8),
            pixelSize: 4,
            disableDepthTestDistance: Number.POSITIVE_INFINITY
          });
          floatParticles.push({
            primitive: particle,
            baseLon: selectedFloat.lon,
            baseLat: selectedFloat.lat,
            z: pZ,
            u: localU + (Math.random() - 0.5) * 0.15, // Add turbulence
            v: localV + (Math.random() - 0.5) * 0.15,
            age: Math.random() * 60,
            maxAge: 60 + Math.random() * 60
          });
        }

        const floatParticleListener = () => {
          floatParticles.forEach(p => {
            p.age += 1;
            if (p.age > p.maxAge) {
              p.age = 0;
            }
            const scale = 0.02; // dispersal speed
            const curLon = p.baseLon + (p.u / Math.cos(Cesium.Math.toRadians(p.baseLat))) * scale * p.age;
            const curLat = p.baseLat + p.v * scale * p.age;
            const alpha = Math.max(0, 1.0 - (p.age / p.maxAge));
            p.primitive.color = Cesium.Color.CYAN.withAlpha(alpha * 0.9);
            p.primitive.position = Cesium.Cartesian3.fromDegrees(curLon, curLat, p.z);
          });
        };
        viewer.scene.preUpdate.addEventListener(floatParticleListener);
        (viewer as any)._floatParticleListener = floatParticleListener;
      }
    }
  }, [selectedFloat, selectedFloatProfile, is3DMode, sliceData]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {/* Hover Data Tooltip */}
      {hoverInfo && (
        <div
          className="absolute z-40 bg-navy-950/90 backdrop-blur-md border border-cyan-500/60 rounded-lg px-3 py-1.5 text-[11px] font-mono text-cyan-200 pointer-events-none shadow-xl transform -translate-x-1/2 -translate-y-12"
          style={{ left: `${hoverInfo.x}px`, top: `${hoverInfo.y}px` }}
        >
          {hoverInfo.text}
        </div>
      )}
    </div>
  );
};
