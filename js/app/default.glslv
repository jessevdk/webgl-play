#version 100

attribute vec3 v_Position;

uniform mat4 modelViewProjection;

void main() {
    gl_Position = modelViewProjection * vec4(v_Position, 1);
}