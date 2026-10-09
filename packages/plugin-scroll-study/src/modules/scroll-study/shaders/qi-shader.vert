attribute vec2 aPosition;
attribute vec2 aUV;
varying vec2 vUv;

void main() {
    vUv = aUV;
    gl_Position = vec4(aPosition, 0.0, 1.0);
}
