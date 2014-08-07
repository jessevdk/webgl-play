#version 100

#define SOMETHING 0.1
#define ELSE 0.2

#if __VERSION__ == 100 && 1 + 2 * 2 == 5
#if defined SOMETHING
#define IT SOMETHING
#endif
#else
#define IT ELSE
#endif

void main()
{
    gl_Position = vec3(IT, 0, 0);
}
