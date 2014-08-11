#version 100

attribute vec4 position;
attribute vec3 normal;

uniform mat4 projection; // a single line comment after projection
uniform mat4 modelview;

varying vec3 f_normal;

// a single line comment before f_color
varying vec4 f_color;

void main(void) {
	gl_Position = projection * /* inline ml comment */ modelview * position;

	f_normal = normal;
	f_color = vec4(position, 1);
}
