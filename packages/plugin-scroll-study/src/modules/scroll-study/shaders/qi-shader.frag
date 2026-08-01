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
    for (int i = 0; i < 5; ++i) {
        v += a * noise(p);
        p = rot * p * 2.0 + vec2(100.0);
        a *= 0.5;
    }
    return v;
}

void main() {
    vec2 uv = vUv * 2.0; // scale up the pattern
    
    vec2 q = vec2(0.0);
    q.x = fbm(uv + 0.05 * uTime);
    q.y = fbm(uv + vec2(1.0));

    vec2 r = vec2(0.0);
    r.x = fbm(uv + 1.0 * q + vec2(1.7, 9.2) + 0.1 * uTime);
    r.y = fbm(uv + 1.0 * q + vec2(8.3, 2.8) + 0.08 * uTime);

    float f = fbm(uv + r);
    
    // Golden Daoist Qi colors
    vec3 color = mix(vec3(0.015, 0.0075, 0.0), vec3(0.1125, 0.0375, 0.0), clamp((f*f)*3.0, 0.0, 1.0)); // dark background
    color = mix(color, vec3(0.45, 0.15, 0.0), clamp(length(q), 0.0, 1.0)); // warm amber
    color = mix(color, vec3(0.75, 0.45, 0.075), clamp(length(r.x) * 1.5, 0.0, 1.0)); // bright gold highlights
    
    gl_FragColor = vec4(color * f * 1.5, 1.0);
}
