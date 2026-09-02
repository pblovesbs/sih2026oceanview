import * as THREE from 'three';

export const VolumeShaderMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uVolume0: { value: null }, // THREE.Data3DTexture
    uVolume1: { value: null }, // THREE.Data3DTexture for temporal morphing
    uTimeProgress: { value: 0.0 }, // 0.0 to 1.0 interpolation between vol0 and vol1
    uTime: { value: 0.0 }, // Continuous time for animations
    uMinVal: { value: 5.0 },
    uMaxVal: { value: 30.0 },
    uSteps: { value: 100 },
    uAlphaThreshold: { value: 0.05 },
    uColorMode: { value: 0 }, // 0: Scientific, 1: Intuitive, 2: Anomaly
    uColorScaleMode: { value: 0 }, // 0: Linear, 1: Log
  },
  vertexShader: `
    varying vec3 vOrigin;
    varying vec3 vDirection;
    varying vec3 vPosition;

    void main() {
      vPosition = position;
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vOrigin = cameraPosition;
      vDirection = normalize(worldPosition.xyz - cameraPosition);
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `,
  fragmentShader: `
    precision highp float;
    precision highp sampler3D;

    varying vec3 vOrigin;
    varying vec3 vDirection;
    varying vec3 vPosition;

    uniform sampler3D uVolume0;
    uniform sampler3D uVolume1;
    uniform float uTimeProgress;
    uniform float uTime;
    uniform float uMinVal;
    uniform float uMaxVal;
    uniform float uAlphaThreshold;
    uniform float uSteps;
    uniform int uColorMode;
    uniform int uColorScaleMode;

    vec2 hitBox(vec3 orig, vec3 dir) {
      const vec3 box_min = vec3(-0.9);
      const vec3 box_max = vec3(0.9);
      vec3 inv_dir = 1.0 / dir;
      vec3 tmin_tmp = (box_min - orig) * inv_dir;
      vec3 tmax_tmp = (box_max - orig) * inv_dir;
      vec3 tmin = min(tmin_tmp, tmax_tmp);
      vec3 tmax = max(tmin_tmp, tmax_tmp);
      float t0 = max(tmin.x, max(tmin.y, tmin.z));
      float t1 = min(tmax.x, min(tmax.y, tmax.z));
      return vec2(t0, t1);
    }

    vec3 sampleColor(float val) {
      float t = 0.0;
      if (uColorScaleMode == 1) {
        float safeMin = max(0.001, uMinVal);
        float safeVal = max(0.001, val);
        float safeMax = max(0.002, uMaxVal);
        t = clamp((log(safeVal) - log(safeMin)) / (log(safeMax) - log(safeMin)), 0.0, 1.0);
      } else {
        t = clamp((val - uMinVal) / (uMaxVal - uMinVal), 0.0, 1.0);
      }
      
      if (uColorMode == 0) {
        // Scientific (Viridis approximation)
        vec3 c0 = vec3(0.267, 0.004, 0.329);
        vec3 c1 = vec3(0.127, 0.566, 0.550);
        vec3 c2 = vec3(0.993, 0.906, 0.144);
        if (t < 0.5) return mix(c0, c1, t * 2.0);
        return mix(c1, c2, (t - 0.5) * 2.0);
      } else if (uColorMode == 1) {
        // Intuitive (Blue -> White -> Red)
        vec3 cold = vec3(0.0, 0.3, 0.8);
        vec3 mid = vec3(0.9, 0.9, 0.9);
        vec3 hot = vec3(0.9, 0.1, 0.1);
        if (t < 0.5) return mix(cold, mid, t * 2.0);
        return mix(mid, hot, (t - 0.5) * 2.0);
      } else {
        // Anomaly
        vec3 neg = vec3(0.1, 0.2, 0.8);
        vec3 mid = vec3(1.0, 1.0, 1.0);
        vec3 pos = vec3(0.8, 0.2, 0.1);
        if (t < 0.5) return mix(neg, mid, t * 2.0);
        return mix(mid, pos, (t - 0.5) * 2.0);
      }
    }

    void main() {
      vec3 rayDir = normalize(vDirection);
      vec2 bounds = hitBox(vOrigin, rayDir);
      
      if (bounds.x > bounds.y) discard;

      bounds.x = max(bounds.x, 0.0);
      vec3 p = vOrigin + bounds.x * rayDir;
      vec3 inc = 1.0 / abs(rayDir);
      float delta = min(inc.x, min(inc.y, inc.z)) / uSteps;
      vec3 step = rayDir * delta;

      vec4 color = vec4(0.0);
      
      for (float t = bounds.x; t < bounds.y; t += delta) {
        // map pos (-0.9 to 0.9) to 0..1 for texture
        vec3 texPos = (p + 0.9) / 1.8; 
        if(texPos.x < 0.0 || texPos.x > 1.0 || 
           texPos.y < 0.0 || texPos.y > 1.0 || 
           texPos.z < 0.0 || texPos.z > 1.0) {
           p += step;
           continue;
        }

        float val0 = texture(uVolume0, texPos).r;
        float val1 = texture(uVolume1, texPos).r;
        float val = mix(val0, val1, uTimeProgress);
        
        // Skip empty or invalid
        if (val < uMinVal * 0.9 || val > uMaxVal * 1.5) {
          p += step;
          continue;
        }

        // Alpha calculation based on value density
        float alpha = uAlphaThreshold;
        
        // Accumulate
        vec3 rgb = sampleColor(val);
        color.rgb += (1.0 - color.a) * rgb * alpha;
        color.a += (1.0 - color.a) * alpha;
        
        if (color.a >= 0.95) break; // early exit
        
        p += step;
      }
      
      if (color.a == 0.0) discard;
      gl_FragColor = color;
    }
  `,
  transparent: true,
  side: THREE.BackSide,
  depthWrite: false,
});
