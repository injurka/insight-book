precision highp float;
uniform float uTime;
varying vec2 vUv;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
    for (int i = 0; i < 4; ++i) {
        v += a * noise(p);
        p = rot * p * 2.0;
        a *= 0.5;
    }
    return v;
}

void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float dist = length(p);
    
    float angle = atan(p.y, p.x);
    
    // Dynamic Qi vortex swirling motion
    float swirl = angle * 2.5 + uTime * 2.0 - dist * 3.5;
    vec2 swirlUv = vec2(cos(swirl), sin(swirl)) * dist;
    
    float n1 = fbm(swirlUv * 3.0 + vec2(uTime * 0.35));
    float n2 = fbm(p * 3.5 - vec2(uTime * 0.5));
    
    // Core glow
    float core = smoothstep(0.32, 0.0, dist);
    
    // Pulsing energy ring
    float ringRadius = 0.50 + sin(uTime * 1.8) * 0.04;
    float ring = smoothstep(0.12, 0.0, abs(dist - ringRadius)) * (0.5 + 0.5 * n1);
    
    // Outer plasma aura
    float aura = smoothstep(0.92, 0.20, dist) * (n1 * 0.6 + n2 * 0.4);
    
    float energyInt = core * 1.3 + ring * 0.7 + aura * 0.5;
    
    // Vibrant & Ethereal Golden Qi Palette
    vec3 colCore = vec3(1.0, 0.98, 0.85);  // Radiant White-Gold Core
    vec3 colMid  = vec3(0.98, 0.68, 0.12);  // Rich Amber Gold
    vec3 colEdge = vec3(0.82, 0.32, 0.04);  // Deep Ethereal Qi Red-Amber
    
    vec3 color = mix(colEdge, colMid, clamp(energyInt, 0.0, 1.0));
    color = mix(color, colCore, clamp(core * 1.1, 0.0, 1.0));
    
    // Clean WebGL alpha transparency
    float alpha = clamp(core * 1.8 + ring * 1.0 + aura * 0.7, 0.0, 0.92);
    alpha *= smoothstep(0.95, 0.72, dist);

    gl_FragColor = vec4(color * alpha, alpha);
}
