#version 100

precision mediump float;

varying vec3 fragNormal;
varying vec4 fragPos;

void main() {
    gl_FragColor = fragPos;
}
