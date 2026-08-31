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
  onSelectFloat,
  flyToTarget,
  onFlyToDone,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const pointsCollectionRef = useRef<Cesium.PointPrimitiveCollection | null>(null);
  const linesCollectionRef = useRef<Cesium.PolylineCollection | null>(null);
  const floatsEntitiesRef = useRef<Cesium.Entity[]>([]);
  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number; text: string } | null>(null);

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
    viewer.scene.screenSpaceCameraController.minimumZoomDistance = 20000;
    viewer.scene.screenSpaceCameraController.maximumZoomDistance = 30000000;

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
        onSelectFloat(pickedObject.id._floatSummary);
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

  // Update 3D Point Cloud & Current Vectors when sliceData, variable, or depth changes
  useEffect(() => {
    const pointsCol = pointsCollectionRef.current;
    const linesCol = linesCollectionRef.current;
    if (!pointsCol || !linesCol || !sliceData || !metadata) return;

    pointsCol.removeAll();
    linesCol.removeAll();

    const varMeta = metadata.variables[currentVariable] || { min: 0, max: 100 };
    // Exaggerate depth for 3D ocean column visualization (1m depth -> 400m altitude offset below sea level)
    const verticalOffset = -currentDepth * 400;

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

      // Add 3D Current Flow Vector Arrow if enabled
      if (showCurrents && pt.speed > 0.05) {
        // Compute arrow end coordinate based on (u, v) velocity
        const scale = 0.45;
        const endLon = pt.lon + (pt.u / Math.cos(Cesium.Math.toRadians(pt.lat))) * scale;
        const endLat = pt.lat + pt.v * scale;

        linesCol.add({
          positions: [
            Cesium.Cartesian3.fromDegrees(pt.lon, pt.lat, verticalOffset + 50),
            Cesium.Cartesian3.fromDegrees(endLon, endLat, verticalOffset + 50),
          ],
          width: 2.5,
          material: Cesium.Material.fromType('Color', {
            color: Cesium.Color.CYAN.withAlpha(0.75),
          }),
        });
      }
    });
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
