#version 100

attribute vec3 pos;
attribute vec3 normal;

uniform mat4 modelViewProjection;

varying vec3 fragNormal;
varying vec4 fragPos;

void main() {
    fragNormal = normal;

    fragPos = modelViewProjection * vec4(pos, 1);
    gl_Position = fragPos;
}
