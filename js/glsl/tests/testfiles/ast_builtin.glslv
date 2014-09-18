#version 100

uniform vec2 _vec2;
uniform vec3 _vec3;
uniform vec4 _vec4;

uniform ivec2 _ivec2;
uniform ivec3 _ivec3;
uniform ivec4 _ivec4;

uniform bvec2 _bvec2;
uniform bvec3 _bvec3;
uniform bvec4 _bvec4;

uniform mat2 _mat2;
uniform mat3 _mat3;
uniform mat4 _mat4;

uniform float _float;
uniform int _int;
uniform bool _bool;

uniform sampler2D _sampler2D;
uniform samplerCube _samplercube;

void main() {
    float f;
    vec2 v2; vec3 v3; vec4 v4;
    ivec2 i2; ivec3 i3; ivec4 i4;
    bvec2 b2; bvec3 b3; bvec4 b4;
    mat2 m2; mat3 m3; mat4 m4;
    sampler2D s2d;
    samplerCube sc;

    // Angle and Trigonometry functions
    radians(f); radians(v2); radians(v3); radians(v4);
    degrees(f); degrees(v2); degrees(v3); degrees(v4);
    sin(f); sin(v2); sin(v3); sin(v4);
    cos(f); cos(v2); cos(v3); cos(v4);
    sin(f); sin(v2); sin(v3); sin(v4);
    asin(f); asin(v2); asin(v3); asin(v4);
    acos(f); acos(v2); acos(v3); acos(v4);
    atan(f, f); atan(v2, v2); atan(v3, v3); atan(v4, v4);
    atan(f); atan(v2); atan(v3); atan(v4);

    // Exponential Functions
    pow(f, f); pow(v2, v2); pow(v3, v3); pow(v4, v4);
    exp(f); exp(v2); exp(v3); exp(v4);
    log(f); log(v2); log(v3); log(v4);
    exp2(f); exp2(v2); exp2(v3); exp2(v4);
    log2(f); log2(v2); log2(v3); log2(v4);
    sqrt(f); sqrt(v2); sqrt(v3); sqrt(v4);
    inversesqrt(f); inversesqrt(v2); inversesqrt(v3); inversesqrt(v4);

    // Common Functions
    abs(f); abs(v2); abs(v3); abs(v4);
    sign(f); sign(v2); sign(v3); sign(v4);
    floor(f); floor(v2); floor(v3); floor(v4);
    ceil(f); ceil(v2); ceil(v3); ceil(v4);
    fract(f); fract(v2); fract(v3); fract(v4);
    mod(f, f); mod(v2, v2); mod(v3, v3); mod(v4, v4);
    min(f, f); min(v2, v2); min(v3, v3); min(v4, v4);
               min(v2, f); min(v3, f); min(v4, f);
    max(f, f); max(v2, v2); max(v3, v3); max(v4, v4);
               max(v2, f); max(v3, f); max(v4, f);
    clamp(f, f, f); clamp(v2, v2, v2); clamp(v3, v3, v3); clamp(v4, v4, v4);
                    clamp(v2, f, f); clamp(v3, f, f); clamp(v4, f, f);
    step(f, f); step(v2, v2); step(v3, v3); step(v4, v4);
                step(f, v2); step(f, v3); step(f, v4);
    smoothstep(f, f, f); smoothstep(v2, v2, v2); smoothstep(v3, v3, v3); smoothstep(v4, v4, v4);
                      smoothstep(f, f, v2); smoothstep(f, f, v3); smoothstep(f, f, v4);

    // Geometric Functions
    length(f); length(v2); length(v3); length(v4);
    distance(f, f); distance(v2, v2); distance(v3, v3); distance(v4, v4);
    dot(f, f); dot(v2, v2); dot(v3, v3); dot(v4, v4);
    cross(v3, v3);
    normalize(f); normalize(v2); normalize(v3); normalize(v4);
    faceforward(f, f, f); faceforward(v2, v2, v2); faceforward(v3, v3, v3); faceforward(v4, v4, v4);
    reflect(f, f); reflect(v2, v2); reflect(v3, v3); reflect(v4, v4);
    refract(f, f, f); refract(v2, v2, f); refract(v3, v3, f); refract(v4, v4, f);

    // Matrix Functions
    matrixCompMult(m2, m2); matrixCompMult(m3, m3); matrixCompMult(m4, m4);

    // Vector Relational Functions
    lessThan(v2, v2); lessThan(v3, v3); lessThan(v4, v4);
    lessThan(i2, i2); lessThan(i3, i3); lessThan(i4, i4);
    lessThanEqual(v2, v2); lessThanEqual(v3, v3); lessThanEqual(v4, v4);
    lessThanEqual(i2, i2); lessThanEqual(i3, i3); lessThanEqual(i4, i4);
    greaterThan(v2, v2); greaterThan(v3, v3); greaterThan(v4, v4);
    greaterThan(i2, i2); greaterThan(i3, i3); greaterThan(i4, i4);
    greaterThanEqual(v2, v2); greaterThanEqual(v3, v3); greaterThanEqual(v4, v4);
    greaterThanEqual(i2, i2); greaterThanEqual(i3, i3); greaterThanEqual(i4, i4);
    equal(v2, v2); equal(v3, v3); equal(v4, v4);
    equal(i2, i2); equal(i3, i3); equal(i4, i4);
    notEqual(v2, v2); notEqual(v3, v3); notEqual(v4, v4);
    notEqual(i2, i2); notEqual(i3, i3); notEqual(i4, i4);
    notEqual(b2, b2); notEqual(b3, b3); notEqual(b4, b4);
    any(b2); any(b3); any(b4);
    all(b2); all(b3); all(b4);
    not(b2); not(b3); not(b4);

    // Texture Lookup Functions
    texture2D(s2d, v2);
    texture2D(s2d, v2, f);
    texture2DProj(s2d, v3);
    texture2DProj(s2d, v3, f);
    texture2DProj(s2d, v4);
    texture2DProj(s2d, v4, f);
    texture2DLod(s2d, v2, f);
    texture2DProjLod(s2d, v3, f);
    texture2DProjLod(s2d, v4, f);
    textureCube(sc, v3);
    textureCube(sc, v3, f);
    textureCubeLod(sc, v3, f);
}

// vi:ts=4:et
