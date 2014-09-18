#version 100
#pragma debug(off)
#line 2 // does not work actually
#extension whatever follows

/* commented out
#define */ /* SOMETHING 0.1
#define ELSE */ // 0.2

#if __VERSION__ == 120
#define V 120
#elif __VERSION__ == 140
#define V 140
#else
#define V 100
#endif

#ifdef V
#if defined(V)
#undef V
#endif
#elif 1 == 2
#endif

#ifndef V
#define V 150
#endif

#if (1 + 1) / 2 * 5 - 2 == 0 || ~((1 | 2) & 3) ^ 1 < 2 || !(2 >= 1) && -1 >= 2 || 2 != +2
#endif

void main()
{
    gl_Position = vec3(V, 0, 0);
}
