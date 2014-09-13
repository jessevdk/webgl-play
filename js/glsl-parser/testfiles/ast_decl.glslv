#version 100

precision highp float;

uniform mat4 projection;
varying vec3 color;

const int num_iter = 4;
highp float high_float;
mediump float medium_float;
lowp float low_float;
invariant low_float, medium_float;

invariant varying int nonvariant;

uniform bool boolarray[4];

int multivar1, multivar2 = 4, multivar3[2];

struct usertype {
    int a, b;
} uservalue1;

usertype uservalue2;

struct {
    struct A {
        int v;
    } a, b;

    A c;
} uservalue3;


void f(usertype a) {
	usertype b;
}

// vi:ts=4:et
