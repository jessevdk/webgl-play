#version 100

int function_proto(int, vec2);

void main(void) {
    function_proto(2, vec2(1, 2));
}

int function_proto(int a, vec2 b) {
}

int function_param_qualifiers(in int a, inout int b, out int c) {

}

int function_type_qualifiers(const in int a, const mediump float b, const in lowp float c) {

}

// vi:ts=4:et
