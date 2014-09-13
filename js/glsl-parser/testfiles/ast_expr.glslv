#version 100

float f(float, float);
float f();

void main() {
    float a, b;
    vec2 c[4];
    vec2 d;
    int i = 0;

    a = 2 + 1 * 3 + f(b, d.x) - d.x / 5.1 + 0555 + 0xef09 + -2;
    b++;
    ++b;
    b--;
    --b;

    !a;

    a == 3 ? 1 + 2 : 3 * 4;
    a != 2;
    c[i + 2].x;

    bool(a) || bool(b) && bool(c[0].x) || (bool(d.y) && !bool(c[0].y));

    a, b, c;

    a += 2;
    a -= 2;
    a *= 2;
    a /= 2;

    fv(void);
}

// vi:ts=4:et
